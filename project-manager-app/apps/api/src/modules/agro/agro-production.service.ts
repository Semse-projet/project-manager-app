import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { AgroAuditRepository } from "./agro-audit.repository.js";
import { AgroAnimalRepository } from "./agro-animal.repository.js";
import { AgroEconomicsRepository } from "./agro-economics.repository.js";
import { AgroFarmRepository } from "./agro-farm.repository.js";

const VALID_TYPES = ["MILK", "EGGS", "WEIGHT_GAIN", "BIRTH", "WOOL", "HONEY", "BREEDING_SERVICE", "OTHER"] as const;
const VALID_TARGET_TYPES = ["ANIMAL", "ANIMAL_GROUP", "FARM"] as const;
const VALID_UNITS = ["LITER", "UNIT", "DOZEN", "LB", "KG", "HEAD", "OTHER"] as const;

@Injectable()
export class AgroProductionService {
  constructor(
    private readonly repo: AgroEconomicsRepository,
    private readonly animalRepo: AgroAnimalRepository,
    private readonly farmRepo: AgroFarmRepository,
    private readonly audit: AgroAuditRepository,
  ) {}

  private async assertFarmAccess(farmId: string, ownerId: string) {
    const farm = await this.farmRepo.findFarm(farmId);
    if (!farm || farm.ownerId !== ownerId) throw new NotFoundException(`Farm not found: ${farmId}`);
    return farm;
  }

  async listRecords(farmId: string, ownerId: string, filters?: {
    type?: string;
    targetType?: string;
    targetId?: string;
    from?: Date;
    to?: Date;
  }) {
    await this.assertFarmAccess(farmId, ownerId);
    return this.repo.listProduction(farmId, filters);
  }

  async createRecord(farmId: string, ownerId: string, input: {
    targetType: string;
    targetId?: string;
    type: string;
    quantity: number;
    unit: string;
    unitPrice?: number;
    occurredAt?: Date;
    notes?: string;
  }) {
    await this.assertFarmAccess(farmId, ownerId);
    if (!VALID_TYPES.includes(input.type as any)) {
      throw new BadRequestException(`Invalid production type: ${input.type}`);
    }
    if (!VALID_TARGET_TYPES.includes(input.targetType as any)) {
      throw new BadRequestException(`Invalid target type: ${input.targetType}`);
    }
    if (!VALID_UNITS.includes(input.unit as any)) {
      throw new BadRequestException(`Invalid unit: ${input.unit}`);
    }
    if (input.quantity <= 0) throw new BadRequestException("Quantity must be positive");

    if (input.targetType === "ANIMAL") {
      if (!input.targetId) throw new BadRequestException("targetId is required for ANIMAL records");
      const animal = await this.animalRepo.findAnimal(input.targetId);
      if (!animal || animal.farmId !== farmId) throw new NotFoundException(`Animal not found: ${input.targetId}`);
    } else if (input.targetType === "ANIMAL_GROUP") {
      if (!input.targetId) throw new BadRequestException("targetId is required for ANIMAL_GROUP records");
      const group = await this.animalRepo.findGroup(input.targetId);
      if (!group || group.farmId !== farmId) throw new NotFoundException(`Animal group not found: ${input.targetId}`);
    }

    const totalValue = input.unitPrice != null ? input.quantity * input.unitPrice : undefined;
    const record = await this.repo.createProduction({
      farmId,
      targetType: input.targetType,
      targetId: input.targetId,
      type: input.type,
      quantity: input.quantity,
      unit: input.unit,
      unitPrice: input.unitPrice,
      totalValue,
      occurredAt: input.occurredAt ?? new Date(),
      notes: input.notes,
    });

    await this.audit.record({
      farmId, actorId: ownerId,
      entityType: "AgroProductionRecord", entityId: record.id,
      action: "production.recorded",
      after: { type: record.type, quantity: Number(record.quantity), unit: record.unit, totalValue: record.totalValue ? Number(record.totalValue) : null },
      source: "WEB",
    });
    return record;
  }

  async deleteRecord(recordId: string, ownerId: string) {
    const record = await this.repo.findProduction(recordId);
    if (!record) throw new NotFoundException(`Production record not found: ${recordId}`);
    await this.assertFarmAccess(record.farmId, ownerId);

    await this.repo.deleteProduction(recordId);
    await this.audit.record({
      farmId: record.farmId, actorId: ownerId,
      entityType: "AgroProductionRecord", entityId: recordId,
      action: "production.deleted",
      before: { type: record.type, quantity: Number(record.quantity) },
      source: "WEB",
    });
    return { deleted: true };
  }

  /** Resumen de producción de los últimos N días, agrupado por tipo. */
  async getSummary(farmId: string, ownerId: string, days = 30) {
    await this.assertFarmAccess(farmId, ownerId);
    const from = new Date(Date.now() - days * 24 * 3600 * 1000);
    const records = await this.repo.listProduction(farmId, { from });

    const byType = new Map<string, { type: string; quantity: number; totalValue: number; records: number }>();
    for (const r of records) {
      const entry = byType.get(r.type) ?? { type: r.type, quantity: 0, totalValue: 0, records: 0 };
      entry.quantity += Number(r.quantity);
      entry.totalValue += Number(r.totalValue ?? 0);
      entry.records += 1;
      byType.set(r.type, entry);
    }

    const totalValue = [...byType.values()].reduce((s, e) => s + e.totalValue, 0);
    return { since: from, days, totalValue, byType: [...byType.values()].sort((a, b) => b.totalValue - a.totalValue) };
  }
}
