import { BadRequestException, Injectable, NotFoundException, Optional } from "@nestjs/common";
import { AgroAuditRepository } from "./agro-audit.repository.js";
import { AgroEvidenceRepository } from "./agro-evidence.repository.js";
import { AgroFarmRepository } from "./agro-farm.repository.js";
import { AgroFarmAccessService, authorizeFarmAction } from "./agro-farm-access.service.js";
import type { AgroFarmAction } from "./agro-farm-policy.js";

export const AGRO_EVIDENCE_ENTITY_TYPES = [
  "FARM", "FARM_UNIT", "ANIMAL", "ANIMAL_GROUP",
  "FARM_TASK", "INVENTORY_ITEM", "INVENTORY_MOVEMENT", "COST_ENTRY", "GENERAL",
  // Workforce & IncidentOps: la evidencia sigue siendo AgroEvidenceItem, no otro subsistema.
  "INCIDENT", "WORKER_CAPABILITY",
] as const;

export const AGRO_EVIDENCE_MEDIA_TYPES = [
  "NOTE", "PHOTO", "VIDEO", "AUDIO", "DOCUMENT", "FORM", "MEASUREMENT", "EXTERNAL_URL", "OTHER",
] as const;

const VALID_ENTITY_TYPES = AGRO_EVIDENCE_ENTITY_TYPES;
const VALID_MEDIA_TYPES = AGRO_EVIDENCE_MEDIA_TYPES;

// Medios que no tienen sentido sin archivo/enlace (VIDEO se mantiene opcional por compatibilidad).
const FILE_REQUIRED_MEDIA_TYPES = ["PHOTO", "AUDIO"] as const;

export type AgroEvidenceInput = {
  entityType: string;
  entityId?: string;
  mediaType: string;
  title?: string;
  note?: string;
  fileUrl?: string;
  capturedAt?: Date;
  latitude?: number;
  longitude?: number;
};

@Injectable()
export class AgroEvidenceService {
  constructor(
    private readonly repo: AgroEvidenceRepository,
    private readonly farmRepo: AgroFarmRepository,
    private readonly audit: AgroAuditRepository,
    @Optional() private readonly access?: AgroFarmAccessService,
  ) {}

  /** Política de rol de finca (T-050); sin AgroFarmAccessService, solo el propietario. */
  private authorize(farmId: string, userId: string, action: AgroFarmAction, opts: { isAssignee?: boolean } = {}) {
    return authorizeFarmAction(this.access, this.farmRepo, farmId, userId, action, opts);
  }

  async listEvidence(farmId: string, ownerId: string, filters?: { entityType?: string; entityId?: string }) {
    await this.authorize(farmId, ownerId, "farm.read");
    return this.repo.listEvidence(farmId, filters);
  }

  async getEvidence(evidenceId: string) {
    const evidence = await this.repo.findEvidence(evidenceId);
    if (!evidence) throw new NotFoundException(`Evidence not found: ${evidenceId}`);
    return evidence;
  }

  /** Lectura autorizada por finca (evita leer registros de fincas ajenas por id). */
  async getEvidenceForUser(evidenceId: string, userId: string) {
    const row = await this.getEvidence(evidenceId);
    await this.authorize(row.farmId, userId, "farm.read");
    return row;
  }

  async createEvidence(farmId: string, ownerId: string, input: AgroEvidenceInput) {
    await this.authorize(farmId, ownerId, "evidence.create");
    return this.recordEvidence(farmId, ownerId, input);
  }

  /**
   * Crea evidencia sin comprobar ownership: el llamador (incidencias,
   * workforce) ya autorizó al actor como miembro de la finca con
   * AgroFarmAccessService. Misma validación y misma auditoría que createEvidence.
   */
  async recordEvidence(farmId: string, actorId: string, input: AgroEvidenceInput, source = "WEB") {
    if (!VALID_ENTITY_TYPES.includes(input.entityType as any)) {
      throw new BadRequestException(`Invalid entityType: ${input.entityType}`);
    }
    if (!VALID_MEDIA_TYPES.includes(input.mediaType as any)) {
      throw new BadRequestException(`Invalid mediaType: ${input.mediaType}`);
    }
    if (FILE_REQUIRED_MEDIA_TYPES.includes(input.mediaType as any) && !input.fileUrl) {
      throw new BadRequestException(`fileUrl is required for ${input.mediaType} evidence`);
    }
    if (input.mediaType === "NOTE" && !input.note) {
      throw new BadRequestException("note is required for NOTE evidence");
    }

    const evidence = await this.repo.createEvidence({
      farmId,
      entityType: input.entityType,
      entityId: input.entityId,
      mediaType: input.mediaType,
      title: input.title,
      note: input.note,
      fileUrl: input.fileUrl,
      capturedAt: input.capturedAt ?? new Date(),
      capturedById: actorId,
      latitude: input.latitude,
      longitude: input.longitude,
    });

    await this.audit.record({
      farmId, actorId,
      entityType: "AgroEvidenceItem", entityId: evidence.id,
      action: "evidence.created",
      after: { entityType: evidence.entityType, entityId: evidence.entityId, mediaType: evidence.mediaType },
      source,
    });
    return evidence;
  }

  /** Evidencias de una entidad sin comprobar ownership (el llamador ya autorizó al miembro). */
  async getEntityEvidenceForMember(farmId: string, entityType: string, entityId: string) {
    return this.repo.listEvidence(farmId, { entityType, entityId });
  }

  /** Evidencias existentes de la finca entre `ids` (no lanza si falta alguna). */
  async findEvidenceInFarm(farmId: string, ids: string[]) {
    return this.repo.findEvidenceByIds(farmId, [...new Set(ids)]);
  }

  /** Verifica que todas las evidencias existen y pertenecen a la finca. */
  async assertEvidenceInFarm(farmId: string, evidenceIds: string[]) {
    const unique = [...new Set(evidenceIds)];
    const found = await this.repo.findEvidenceByIds(farmId, unique);
    if (found.length !== unique.length) {
      const foundIds = new Set(found.map((e: { id: string }) => e.id));
      const missing = unique.filter((id) => !foundIds.has(id));
      throw new BadRequestException(`Evidence not found in farm ${farmId}: ${missing.join(", ")}`);
    }
    return found;
  }

  async updateEvidence(evidenceId: string, ownerId: string, input: {
    title?: string;
    note?: string;
    fileUrl?: string;
  }) {
    const evidence = await this.getEvidence(evidenceId);
    // Cada miembro edita su propia evidencia; la de otros, solo supervisión.
    await this.authorize(evidence.farmId, ownerId, evidence.capturedById === ownerId ? "evidence.create" : "evidence.update_any");

    const updated = await this.repo.updateEvidence(evidenceId, input);
    await this.audit.record({
      farmId: evidence.farmId, actorId: ownerId,
      entityType: "AgroEvidenceItem", entityId: evidenceId,
      action: "evidence.updated",
      before: { title: evidence.title },
      after: { title: updated.title },
      source: "WEB",
    });
    return updated;
  }

  async getEntityEvidence(farmId: string, ownerId: string, entityType: string, entityId: string) {
    await this.authorize(farmId, ownerId, "farm.read");
    return this.repo.listEvidence(farmId, { entityType, entityId });
  }

  async getRecentEvidence(farmId: string, ownerId: string, limit = 10) {
    await this.authorize(farmId, ownerId, "farm.read");
    return this.repo.recentEvidence(farmId, Math.min(limit, 50));
  }
}
