import {
  BadRequestException, ConflictException, Injectable, NotFoundException, Optional,
} from "@nestjs/common";
import { DomainEventBus } from "../domain-events/domain-event-bus.service.js";
import { AgroAuditRepository } from "./agro-audit.repository.js";
import { emitAgroIncidentCreated, emitAgroIncidentResolved } from "./agro-domain-events.js";
import { AgroEvidenceService, type AgroEvidenceInput } from "./agro-evidence.service.js";
import { AgroFarmAccessService, assertAgroFarmAction, type AgroFarmActor } from "./agro-farm-access.service.js";
import { canPerformAgroFarmAction, type AgroFarmAction } from "./agro-farm-policy.js";
import { AgroIncidentRepository, type AgroIncidentFilters } from "./agro-incident.repository.js";
import {
  AGRO_INCIDENT_SEVERITIES, AGRO_INCIDENT_SOURCES, AGRO_INCIDENT_TYPES,
  allowedIncidentTransitions, canTransitionIncident, incidentTransitionAction,
  incidentTransitionAuditAction, incidentTransitionTimestamps, isAgroIncidentStatus,
  isIncidentActive, suggestedSeverity, type AgroIncidentStatus, type AgroIncidentType,
} from "./agro-incident.domain.js";
import { AgroTaskRefResolver, parseAgroTaskRef } from "./agro-task-ref.resolver.js";

export type AgroIncidentRelations = {
  farmUnitId?: string | null;
  animalId?: string | null;
  animalGroupId?: string | null;
  cropCycleId?: string | null;
  inventoryItemId?: string | null;
};

export type CreateAgroIncidentInput = AgroIncidentRelations & {
  type: string;
  severity?: string;
  title: string;
  description?: string;
  occurredAt?: Date;
  assignedToId?: string;
  relatedTask?: { source?: string; id: string };
  source?: string;
  clientEventId?: string;
  evidence?: Array<Omit<AgroEvidenceInput, "entityType" | "entityId">>;
  metadata?: Record<string, unknown>;
};

const EVIDENCE_LIMIT_PER_REPORT = 10;
const TERMINAL_FOR_ACTIVITY = ["CANCELLED", "DUPLICATE"];

function assertIn(values: readonly string[], value: string | undefined, field: string) {
  if (value !== undefined && !values.includes(value)) {
    throw new BadRequestException(`Invalid ${field}: ${value}. Must be one of: ${values.join(", ")}`);
  }
}

type IncidentRow = NonNullable<Awaited<ReturnType<AgroIncidentRepository["find"]>>>;

@Injectable()
export class AgroIncidentService {
  constructor(
    private readonly repo: AgroIncidentRepository,
    private readonly access: AgroFarmAccessService,
    private readonly evidence: AgroEvidenceService,
    private readonly tasks: AgroTaskRefResolver,
    private readonly audit: AgroAuditRepository,
    @Optional() private readonly domainEventBus?: DomainEventBus,
  ) {}

  // ── Lectura ────────────────────────────────────────────────────────────────

  async list(farmId: string, userId: string, filters: AgroIncidentFilters = {}) {
    const actor = await this.access.require(farmId, userId, "incident.read");
    for (const s of filters.status ?? []) assertIn(["OPEN", "TRIAGED", "IN_PROGRESS", "RESOLVED", "CLOSED", "CANCELLED", "DUPLICATE"], s, "status");
    for (const s of filters.severity ?? []) assertIn(AGRO_INCIDENT_SEVERITIES, s, "severity");
    for (const t of filters.type ?? []) assertIn(AGRO_INCIDENT_TYPES, t, "type");
    const incidents = await this.repo.list(farmId, { ...filters, limit: Math.min(filters.limit ?? 100, 200) });
    return { viewerRole: actor.role, incidents };
  }

  /** Unidades, grupos y animales activos para elegir contexto al reportar (sin datos económicos). */
  async reportContext(farmId: string, userId: string) {
    const actor = await this.access.require(farmId, userId, "incident.report");
    return { viewerRole: actor.role, ...(await this.repo.reportContext(farmId)) };
  }

  async summary(farmId: string, userId: string) {
    await this.access.require(farmId, userId, "incident.read");
    const rows = await this.repo.countByStatus(farmId);
    const byStatus: Record<string, number> = {};
    const openBySeverity: Record<string, number> = {};
    for (const r of rows) {
      byStatus[r.status] = (byStatus[r.status] ?? 0) + r.count;
      if (isIncidentActive(r.status)) openBySeverity[r.severity] = (openBySeverity[r.severity] ?? 0) + r.count;
    }
    return { byStatus, openBySeverity };
  }

  async get(incidentId: string, userId: string) {
    const incident = await this.requireIncident(incidentId);
    const actor = await this.access.require(incident.farmId, userId, "incident.read");
    const [evidence, timeline, relatedTask] = await Promise.all([
      this.evidence.getEntityEvidenceForMember(incident.farmId, "INCIDENT", incident.id),
      this.audit.listForEntity({ farmId: incident.farmId, entityType: "AgroIncident", entityId: incident.id }),
      this.resolveLinkedTask(incident),
    ]);
    return {
      incident,
      evidence,
      timeline,
      relatedTask,
      viewer: this.viewerCapabilities(actor, incident),
    };
  }

  // ── Crear ─────────────────────────────────────────────────────────────────

  async create(farmId: string, userId: string, input: CreateAgroIncidentInput) {
    const actor = await this.access.require(farmId, userId, "incident.report");
    assertIn(AGRO_INCIDENT_TYPES, input.type, "type");
    assertIn(AGRO_INCIDENT_SEVERITIES, input.severity, "severity");
    assertIn(AGRO_INCIDENT_SOURCES, input.source, "source");
    if (!input.title?.trim()) throw new BadRequestException("Incident title is required");
    if ((input.evidence?.length ?? 0) > EVIDENCE_LIMIT_PER_REPORT) {
      throw new BadRequestException(`At most ${EVIDENCE_LIMIT_PER_REPORT} evidence items per report`);
    }

    if (input.clientEventId) {
      const existing = await this.repo.findByClientEventId(farmId, input.clientEventId);
      if (existing) return { incident: existing, duplicate: true, evidence: [] };
    }

    await this.assertRelations(farmId, input);
    if (input.assignedToId) {
      assertAgroFarmAction(actor, "incident.assign");
      await this.assertAssignable(farmId, input.assignedToId);
    }
    const relatedTask = parseAgroTaskRef(input.relatedTask);
    let taskSnapshot: Awaited<ReturnType<AgroTaskRefResolver["resolve"]>> | null = null;
    if (relatedTask) {
      assertAgroFarmAction(actor, "incident.link_task");
      taskSnapshot = await this.tasks.resolve(farmId, relatedTask);
    }

    const source = input.source ?? "WEB";
    const type = input.type as AgroIncidentType;
    // La severidad solo queda confirmada si la fija alguien con autoridad de
    // clasificación y no viene de una sugerencia de Prometeo.
    const canTriage = canPerformAgroFarmAction(actor.role, "incident.triage");
    const severityConfirmed = Boolean(input.severity) && canTriage && source !== "PROMETEO";
    const severity = input.severity ?? suggestedSeverity(type);
    const now = new Date();

    const incident = await this.repo.create({
      farmId,
      farmUnitId: input.farmUnitId ?? null,
      animalId: input.animalId ?? null,
      animalGroupId: input.animalGroupId ?? null,
      cropCycleId: input.cropCycleId ?? null,
      inventoryItemId: input.inventoryItemId ?? null,
      reportedById: userId,
      assignedToId: input.assignedToId ?? null,
      relatedTaskSource: relatedTask?.source ?? null,
      relatedTaskId: relatedTask?.id ?? null,
      type,
      severity,
      severityConfirmed,
      status: "OPEN",
      title: input.title.trim(),
      description: input.description ?? null,
      occurredAt: input.occurredAt ?? null,
      detectedAt: now,
      source,
      clientEventId: input.clientEventId ?? null,
      metadata: input.metadata ?? null,
    }, {
      farmId, actorId: userId, entityType: "AgroIncident",
      action: "incident.created",
      after: {
        type, severity, severityConfirmed, status: "OPEN", reporterRole: actor.role, source,
        relations: this.relationSnapshot(input),
        ...(input.assignedToId && { assignedToId: input.assignedToId }),
        ...(taskSnapshot && { relatedTask: { source: taskSnapshot.source, id: taskSnapshot.id, title: taskSnapshot.title } }),
      },
      source: this.auditSource(source),
    });

    const evidence = [];
    for (const item of input.evidence ?? []) {
      evidence.push(await this.attachEvidence(incident.farmId, incident.id, userId, item, source));
    }

    const farm = await this.access.getFarmContext(farmId);
    await emitAgroIncidentCreated(this.domainEventBus, farm, userId, incident);

    return { incident, duplicate: false, evidence };
  }

  // ── Mutaciones ─────────────────────────────────────────────────────────────

  async update(incidentId: string, userId: string, input: AgroIncidentRelations & {
    type?: string; severity?: string; severityReason?: string; title?: string; description?: string; occurredAt?: Date | null;
  }) {
    const incident = await this.requireIncident(incidentId);
    const actor = await this.access.requireMember(incident.farmId, userId);
    this.assertActive(incident);
    assertIn(AGRO_INCIDENT_TYPES, input.type, "type");
    assertIn(AGRO_INCIDENT_SEVERITIES, input.severity, "severity");

    const touchesClassification = input.type !== undefined || input.severity !== undefined
      || ["farmUnitId", "animalId", "animalGroupId", "cropCycleId", "inventoryItemId"].some((k) => (input as any)[k] !== undefined);
    const ownOpenReport = incident.reportedById === userId && incident.status === "OPEN";
    if (touchesClassification || !ownOpenReport) assertAgroFarmAction(actor, "incident.triage");
    await this.assertRelations(incident.farmId, input);

    const patch: Record<string, unknown> = {};
    const audits = [];
    const base = { farmId: incident.farmId, actorId: userId, entityType: "AgroIncident", entityId: incident.id, source: "WEB" };
    if (input.severity !== undefined && (input.severity !== incident.severity || !incident.severityConfirmed)) {
      patch.severity = input.severity;
      patch.severityConfirmed = true;
      audits.push({ ...base, action: "incident.severity_changed", before: { severity: incident.severity, severityConfirmed: incident.severityConfirmed }, after: { severity: input.severity, severityConfirmed: true, reason: input.severityReason ?? null, byRole: actor.role } });
    }
    if (input.type !== undefined && input.type !== incident.type) {
      patch.type = input.type;
      audits.push({ ...base, action: "incident.type_changed", before: { type: incident.type }, after: { type: input.type } });
    }
    const relationKeys = ["farmUnitId", "animalId", "animalGroupId", "cropCycleId", "inventoryItemId"] as const;
    const relationPatch: Record<string, string | null> = {};
    for (const k of relationKeys) {
      if (input[k] !== undefined && input[k] !== (incident as any)[k]) relationPatch[k] = input[k] ?? null;
    }
    if (Object.keys(relationPatch).length) {
      Object.assign(patch, relationPatch);
      audits.push({ ...base, action: "incident.relations_changed", before: Object.fromEntries(Object.keys(relationPatch).map((k) => [k, (incident as any)[k]])), after: relationPatch });
    }
    const textPatch: Record<string, unknown> = {};
    if (input.title !== undefined && input.title.trim() && input.title !== incident.title) textPatch.title = input.title.trim();
    if (input.description !== undefined && input.description !== incident.description) textPatch.description = input.description;
    if (input.occurredAt !== undefined) textPatch.occurredAt = input.occurredAt;
    if (Object.keys(textPatch).length) {
      Object.assign(patch, textPatch);
      audits.push({ ...base, action: "incident.updated", before: { title: incident.title }, after: textPatch });
    }
    if (audits.length === 0) return incident;
    return this.applyUpdate(incident, patch, audits);
  }

  async transition(incidentId: string, userId: string, input: {
    to: string; resolution?: string; reason?: string; duplicateOfId?: string;
  }) {
    const incident = await this.requireIncident(incidentId);
    const actor = await this.access.requireMember(incident.farmId, userId);
    if (!isAgroIncidentStatus(input.to)) throw new BadRequestException(`Invalid status: ${input.to}`);
    const to = input.to as AgroIncidentStatus;
    if (!canTransitionIncident(incident.status, to)) {
      throw new ConflictException(`Cannot transition incident from ${incident.status} to ${to}`);
    }
    assertAgroFarmAction(actor, incidentTransitionAction(incident.status, to), { isAssignee: incident.assignedToId === userId });

    const patch: Record<string, unknown> = { status: to, ...incidentTransitionTimestamps(incident.status, to, new Date()) };
    const after: Record<string, unknown> = { status: to, byRole: actor.role };
    if (to === "RESOLVED") {
      if (!input.resolution?.trim()) throw new BadRequestException("Resolving an incident requires a resolution");
      patch.resolution = input.resolution.trim();
      after.resolution = patch.resolution;
    }
    if (to === "CANCELLED") {
      if (!input.reason?.trim()) throw new BadRequestException("Cancelling an incident requires a reason");
      patch.cancelReason = input.reason.trim();
      after.reason = patch.cancelReason;
    }
    if (to === "DUPLICATE") {
      if (!input.duplicateOfId || input.duplicateOfId === incident.id) throw new BadRequestException("duplicateOfId must reference another incident");
      const original = await this.repo.find(input.duplicateOfId);
      if (!original || original.farmId !== incident.farmId) throw new BadRequestException("duplicateOfId must reference an incident of the same farm");
      patch.duplicateOfId = original.id;
      after.duplicateOfId = original.id;
    }
    if (to === "IN_PROGRESS" && input.reason?.trim()) after.reason = input.reason.trim();

    const updated = await this.applyUpdate(incident, patch, [{
      farmId: incident.farmId, actorId: userId, entityType: "AgroIncident", entityId: incident.id,
      action: incidentTransitionAuditAction(incident.status, to),
      before: { status: incident.status }, after, source: "WEB",
    }]);

    if (to === "RESOLVED") {
      const farm = await this.access.getFarmContext(incident.farmId);
      await emitAgroIncidentResolved(this.domainEventBus, farm, userId, {
        id: incident.id, farmId: incident.farmId, resolution: updated.resolution ?? "",
        reportedById: incident.reportedById, assignedToId: incident.assignedToId,
      });
    }

    return updated;
  }

  async assign(incidentId: string, userId: string, assignedToId: string | null) {
    const incident = await this.requireIncident(incidentId);
    const actor = await this.access.require(incident.farmId, userId, "incident.assign");
    this.assertActive(incident);
    if (assignedToId) await this.assertAssignable(incident.farmId, assignedToId);
    if (assignedToId === incident.assignedToId) return incident;
    return this.applyUpdate(incident, { assignedToId }, [{
      farmId: incident.farmId, actorId: userId, entityType: "AgroIncident", entityId: incident.id,
      action: assignedToId ? "incident.assigned" : "incident.unassigned",
      before: { assignedToId: incident.assignedToId }, after: { assignedToId, byRole: actor.role }, source: "WEB",
    }]);
  }

  async linkTask(incidentId: string, userId: string, ref: { source?: string; id: string } | null) {
    const incident = await this.requireIncident(incidentId);
    await this.access.require(incident.farmId, userId, "incident.link_task");
    if (TERMINAL_FOR_ACTIVITY.includes(incident.status)) throw new ConflictException(`Incident is ${incident.status}`);
    const parsed = parseAgroTaskRef(ref);
    const task = parsed ? await this.tasks.resolve(incident.farmId, parsed) : null;
    return this.applyUpdate(incident, {
      relatedTaskSource: parsed?.source ?? null, relatedTaskId: parsed?.id ?? null,
    }, [{
      farmId: incident.farmId, actorId: userId, entityType: "AgroIncident", entityId: incident.id,
      action: parsed ? "incident.task_linked" : "incident.task_unlinked",
      before: { relatedTaskSource: incident.relatedTaskSource, relatedTaskId: incident.relatedTaskId },
      after: task ? { source: task.source, id: task.id, title: task.title, status: task.status } : { relatedTaskId: null },
      source: "WEB",
    }]);
  }

  async comment(incidentId: string, userId: string, input: { body: string; kind?: "COMMENT" | "ASSESSMENT" }) {
    const incident = await this.requireIncident(incidentId);
    const kind = input.kind ?? "COMMENT";
    const action: AgroFarmAction = kind === "ASSESSMENT" ? "incident.assess" : "incident.comment";
    const actor = await this.access.require(incident.farmId, userId, action);
    if (!input.body?.trim()) throw new BadRequestException("Comment body is required");
    if (TERMINAL_FOR_ACTIVITY.includes(incident.status)) throw new ConflictException(`Incident is ${incident.status}`);
    await this.repo.appendAudit({
      farmId: incident.farmId, actorId: userId, entityType: "AgroIncident", entityId: incident.id,
      action: kind === "ASSESSMENT" ? "incident.assessment_added" : "incident.comment_added",
      after: { body: input.body.trim(), kind, authorRole: actor.role },
      source: "WEB",
    });
    return { ok: true };
  }

  async addEvidence(incidentId: string, userId: string, input: Omit<AgroEvidenceInput, "entityType" | "entityId">) {
    const incident = await this.requireIncident(incidentId);
    await this.access.require(incident.farmId, userId, "incident.add_evidence");
    if (TERMINAL_FOR_ACTIVITY.includes(incident.status)) throw new ConflictException(`Incident is ${incident.status}`);
    return this.attachEvidence(incident.farmId, incident.id, userId, input, "WEB");
  }

  // ── helpers ────────────────────────────────────────────────────────────────

  private async attachEvidence(farmId: string, incidentId: string, userId: string, input: Omit<AgroEvidenceInput, "entityType" | "entityId">, source: string) {
    const evidence = await this.evidence.recordEvidence(farmId, userId, { ...input, entityType: "INCIDENT", entityId: incidentId }, this.auditSource(source));
    await this.repo.appendAudit({
      farmId, actorId: userId, entityType: "AgroIncident", entityId: incidentId,
      action: "incident.evidence_added",
      after: { evidenceId: evidence.id, mediaType: evidence.mediaType, title: evidence.title ?? null },
      source: this.auditSource(source),
    });
    return evidence;
  }

  private async applyUpdate(incident: IncidentRow, patch: Record<string, unknown>, audits: Parameters<AgroIncidentRepository["update"]>[3]) {
    const updated = await this.repo.update(incident.id, incident.status, patch, audits);
    if (!updated) throw new ConflictException("Incident was modified concurrently; reload and retry");
    return updated;
  }

  private async requireIncident(incidentId: string): Promise<IncidentRow> {
    const incident = await this.repo.find(incidentId);
    if (!incident) throw new NotFoundException(`Incident not found: ${incidentId}`);
    return incident;
  }

  private assertActive(incident: { status: string }) {
    if (!isIncidentActive(incident.status)) {
      throw new ConflictException(`Incident is ${incident.status}; reopen it before editing`);
    }
  }

  private async assertRelations(farmId: string, input: AgroIncidentRelations) {
    const { farmUnitId, animalId, animalGroupId, cropCycleId, inventoryItemId } = input;
    const invalid = await this.repo.relationsBelongToFarm(farmId, { farmUnitId, animalId, animalGroupId, cropCycleId, inventoryItemId });
    if (invalid.length) throw new BadRequestException(`Related entities not found in this farm: ${invalid.join(", ")}`);
  }

  private async assertAssignable(farmId: string, assigneeId: string) {
    const role = await this.access.resolveRole(farmId, assigneeId);
    if (!role) throw new BadRequestException(`Assignee is not an active member of this farm: ${assigneeId}`);
  }

  private async resolveLinkedTask(incident: IncidentRow) {
    const ref = parseAgroTaskRef(incident.relatedTaskId ? { source: incident.relatedTaskSource ?? undefined, id: incident.relatedTaskId } : null);
    if (!ref) return null;
    try {
      return await this.tasks.resolve(incident.farmId, ref);
    } catch {
      // Tarea borrada o migrada: la referencia se conserva y la UI la marca como no disponible.
      return { source: ref.source, id: ref.id, missing: true };
    }
  }

  private relationSnapshot(input: AgroIncidentRelations) {
    return Object.fromEntries(
      (["farmUnitId", "animalId", "animalGroupId", "cropCycleId", "inventoryItemId"] as const)
        .filter((k) => input[k]).map((k) => [k, input[k]]),
    );
  }

  private auditSource(source: string) {
    // AgroAuditEvent.source: WEB | MOBILE | SYNC | SYSTEM | IMPORT (+ PROMETEO para trazabilidad del origen).
    return source === "API" ? "SYSTEM" : source;
  }

  private viewerCapabilities(actor: AgroFarmActor, incident: IncidentRow) {
    const isAssignee = incident.assignedToId === actor.userId;
    const transitions = allowedIncidentTransitions(incident.status).filter((to) =>
      canPerformAgroFarmAction(actor.role, incidentTransitionAction(incident.status, to), { isAssignee }));
    const can = (a: AgroFarmAction) => canPerformAgroFarmAction(actor.role, a, { isAssignee });
    return {
      role: actor.role,
      isAssignee,
      transitions,
      canTriage: can("incident.triage") && isIncidentActive(incident.status),
      canAssign: can("incident.assign") && isIncidentActive(incident.status),
      canLinkTask: can("incident.link_task") && !TERMINAL_FOR_ACTIVITY.includes(incident.status),
      canComment: can("incident.comment") && !TERMINAL_FOR_ACTIVITY.includes(incident.status),
      canAssess: can("incident.assess") && !TERMINAL_FOR_ACTIVITY.includes(incident.status),
      canAddEvidence: can("incident.add_evidence") && !TERMINAL_FOR_ACTIVITY.includes(incident.status),
    };
  }
}

