import { BadRequestException, Injectable } from "@nestjs/common";
import { PrismaService } from "../../infrastructure/prisma/prisma.service.js";
import { AgroFarmAccessService } from "./agro-farm-access.service.js";
import { AgroTaskRefResolver, type ResolvedAgroTask } from "./agro-task-ref.resolver.js";
import {
  AGRO_INTAKE_DISCLAIMER, AGRO_INTAKE_ENGINE, buildIncidentTitle, classifyIncident, detectCompletion,
  detectSpecies, incidentProposalBase, matchEntities, normalizeText, scoreTaskMatch, type IntakeCandidate,
} from "./agro-intake.domain.js";

const MAX_TEXT = 4000;
const TASK_MATCH_THRESHOLD = 0.5;

export type AgroIntakeInput = {
  text: string;
  /** Evidencias ya capturadas (AgroEvidenceItem de la finca) — p. ej. el audio original. */
  evidenceIds?: string[];
  occurredAt?: Date;
};

/**
 * Prometeo Agro — capa operacional sobre los datos Agro, no otro chatbot.
 * Solo lectura: devuelve una propuesta; nada se persiste hasta que una persona
 * la confirma por los endpoints normales (incidencias / tareas), que auditan.
 */
@Injectable()
export class AgroIntakeService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly access: AgroFarmAccessService,
    private readonly tasks: AgroTaskRefResolver,
  ) {}

  async propose(farmId: string, userId: string, input: AgroIntakeInput) {
    const actor = await this.access.require(farmId, userId, "incident.report");
    const text = input.text?.trim() ?? "";
    if (!text) throw new BadRequestException("text is required");
    if (text.length > MAX_TEXT) throw new BadRequestException(`text exceeds ${MAX_TEXT} characters`);

    const normalized = normalizeText(text);
    const [units, groups, animals] = await Promise.all([
      this.prisma.agroFarmUnit.findMany({ where: { farmId }, select: { id: true, name: true } }),
      this.prisma.agroAnimalGroup.findMany({ where: { farmId, status: "ACTIVE" }, select: { id: true, name: true, species: true } }),
      this.prisma.agroAnimal.findMany({ where: { farmId, status: "ACTIVE", tagCode: { not: null } }, select: { id: true, tagCode: true, species: true } }),
    ]);
    const candidates: IntakeCandidate[] = [
      ...units.map((u) => ({ id: u.id, name: u.name, kind: "FARM_UNIT" as const })),
      ...groups.map((g) => ({ id: g.id, name: g.name, kind: "ANIMAL_GROUP" as const })),
      ...animals.map((a) => ({ id: a.id, name: a.tagCode ?? "", kind: "ANIMAL" as const })),
    ];
    const matches = matchEntities(normalized, candidates);
    const pick = (kind: IntakeCandidate["kind"]) => matches.find((m) => m.kind === kind) ?? null;
    const entities = {
      farmUnit: pick("FARM_UNIT"),
      animalGroup: pick("ANIMAL_GROUP"),
      animal: pick("ANIMAL"),
      species: detectSpecies(normalized),
      alternatives: matches.slice(0, 6),
    };
    const entityIds = new Set(matches.map((m) => m.id));
    const base = {
      engine: AGRO_INTAKE_ENGINE,
      domain: "agro" as const,
      reporter: { userId, farmRole: actor.role },
      entities,
      evidenceIds: input.evidenceIds ?? [],
      requiresHumanReview: true as const,
      disclaimer: AGRO_INTAKE_DISCLAIMER,
    };

    // 1) ¿Reporta trabajo hecho? buscar → relacionar → completar (antes que crear).
    const completion = detectCompletion(normalized);
    if (completion) {
      const open = await this.tasks.listOpen(farmId);
      const taskMatches = open
        .map((task) => ({ task: this.taskView(task), ...scoreTaskMatch(task, { taskType: completion.taskType, entityIds, normalized }) }))
        .filter((m) => m.score > 0)
        .sort((a, b) => b.score - a.score)
        .slice(0, 5);
      const best = taskMatches[0];
      return {
        ...base,
        intent: "TASK_COMPLETION" as const,
        confidence: best ? Math.min(0.95, best.score) : 0.4,
        taskMatches,
        recommendedAction: best && best.score >= TASK_MATCH_THRESHOLD
          ? { kind: "COMPLETE_TASK" as const, task: best.task }
          : {
              kind: "CREATE_TASK" as const,
              // Solo si no existe una tarea abierta que encaje: se propone registrarla ya completada.
              draft: {
                title: buildIncidentTitle("OTHER", text),
                type: completion.taskType,
                targetType: entities.animalGroup ? "ANIMAL_GROUP" : entities.farmUnit ? "FARM_UNIT" : entities.animal ? "ANIMAL" : "GENERAL",
                targetId: entities.animalGroup?.id ?? entities.farmUnit?.id ?? entities.animal?.id ?? null,
              },
            },
      };
    }

    // 2) ¿Reporta un problema? clasificar y buscar duplicados antes de crear.
    const classified = classifyIncident(normalized);
    if (classified) {
      const relations = {
        farmUnitId: entities.farmUnit?.id ?? null,
        animalGroupId: entities.animalGroup?.id ?? null,
        animalId: entities.animal?.id ?? null,
      };
      const duplicateCandidates = await this.prisma.agroIncident.findMany({
        where: {
          farmId,
          type: classified.type,
          status: { in: ["OPEN", "TRIAGED", "IN_PROGRESS"] },
          ...(relations.animalGroupId || relations.farmUnitId || relations.animalId
            ? { OR: [
                ...(relations.animalGroupId ? [{ animalGroupId: relations.animalGroupId }] : []),
                ...(relations.farmUnitId ? [{ farmUnitId: relations.farmUnitId }] : []),
                ...(relations.animalId ? [{ animalId: relations.animalId }] : []),
              ] }
            : {}),
        },
        select: { id: true, title: true, status: true, severity: true, detectedAt: true },
        orderBy: { detectedAt: "desc" },
        take: 5,
      });
      const hasEntity = Boolean(relations.animalGroupId || relations.farmUnitId || relations.animalId);
      const incident = {
        ...incidentProposalBase(classified.type),
        title: buildIncidentTitle(classified.type, text),
        description: text,
        occurredAt: input.occurredAt ?? null,
        relations,
        source: "PROMETEO" as const,
      };
      return {
        ...base,
        intent: "INCIDENT" as const,
        confidence: Math.min(0.9, 0.45 + 0.15 * classified.score + (hasEntity ? 0.2 : 0)),
        signals: classified.matched,
        incident,
        duplicateCandidates,
        recommendedAction: duplicateCandidates.length > 0
          ? { kind: "LINK_EXISTING_INCIDENT" as const, incidentId: duplicateCandidates[0]!.id, alternative: "CREATE_INCIDENT" as const }
          : { kind: "CREATE_INCIDENT" as const },
      };
    }

    return {
      ...base,
      intent: "UNKNOWN" as const,
      confidence: 0,
      recommendedAction: { kind: "ASK_HUMAN" as const, question: "¿Es un problema (incidencia) o un trabajo ya realizado?" },
    };
  }

  private taskView(task: ResolvedAgroTask) {
    return {
      source: task.source, id: task.id, title: task.title, type: task.type, status: task.status,
      targetType: task.targetType, targetId: task.targetId, dueAt: task.dueAt,
    };
  }
}
