import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { AgroAuditRepository } from "./agro-audit.repository.js";
import { AgroEvidenceRepository } from "./agro-evidence.repository.js";
import { AgroFarmRepository } from "./agro-farm.repository.js";

const VALID_ENTITY_TYPES = [
  "FARM", "FARM_UNIT", "ANIMAL", "ANIMAL_GROUP",
  "FARM_TASK", "INVENTORY_ITEM", "INVENTORY_MOVEMENT", "COST_ENTRY", "GENERAL",
] as const;

const VALID_MEDIA_TYPES = [
  "NOTE", "PHOTO", "VIDEO", "DOCUMENT", "EXTERNAL_URL", "OTHER",
] as const;

@Injectable()
export class AgroEvidenceService {
  constructor(
    private readonly repo: AgroEvidenceRepository,
    private readonly farmRepo: AgroFarmRepository,
    private readonly audit: AgroAuditRepository,
  ) {}

  private async assertFarmAccess(farmId: string, ownerId: string) {
    const farm = await this.farmRepo.findFarm(farmId);
    if (!farm || farm.ownerId !== ownerId) throw new NotFoundException(`Farm not found: ${farmId}`);
    return farm;
  }

  async listEvidence(farmId: string, ownerId: string, filters?: { entityType?: string; entityId?: string }) {
    await this.assertFarmAccess(farmId, ownerId);
    return this.repo.listEvidence(farmId, filters);
  }

  async getEvidence(evidenceId: string) {
    const evidence = await this.repo.findEvidence(evidenceId);
    if (!evidence) throw new NotFoundException(`Evidence not found: ${evidenceId}`);
    return evidence;
  }

  async createEvidence(farmId: string, ownerId: string, input: {
    entityType: string;
    entityId?: string;
    mediaType: string;
    title?: string;
    note?: string;
    fileUrl?: string;
    capturedAt?: Date;
    latitude?: number;
    longitude?: number;
  }) {
    await this.assertFarmAccess(farmId, ownerId);
    if (!VALID_ENTITY_TYPES.includes(input.entityType as any)) {
      throw new BadRequestException(`Invalid entityType: ${input.entityType}`);
    }
    if (!VALID_MEDIA_TYPES.includes(input.mediaType as any)) {
      throw new BadRequestException(`Invalid mediaType: ${input.mediaType}`);
    }
    if (input.mediaType === "PHOTO" && !input.fileUrl) {
      throw new BadRequestException("fileUrl is required for PHOTO evidence");
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
      capturedById: ownerId,
      latitude: input.latitude,
      longitude: input.longitude,
    });

    await this.audit.record({
      farmId, actorId: ownerId,
      entityType: "AgroEvidenceItem", entityId: evidence.id,
      action: "evidence.created",
      after: { entityType: evidence.entityType, mediaType: evidence.mediaType },
      source: "WEB",
    });
    return evidence;
  }

  async updateEvidence(evidenceId: string, ownerId: string, input: {
    title?: string;
    note?: string;
    fileUrl?: string;
  }) {
    const evidence = await this.getEvidence(evidenceId);
    await this.assertFarmAccess(evidence.farmId, ownerId);

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
    await this.assertFarmAccess(farmId, ownerId);
    return this.repo.listEvidence(farmId, { entityType, entityId });
  }

  async getRecentEvidence(farmId: string, ownerId: string, limit = 10) {
    await this.assertFarmAccess(farmId, ownerId);
    return this.repo.recentEvidence(farmId, Math.min(limit, 50));
  }
}
