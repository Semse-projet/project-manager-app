import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { AgroAuditRepository } from "./agro-audit.repository.js";
import { AgroFarmRepository } from "./agro-farm.repository.js";

const VALID_OPERATION_TYPES = ["LIVESTOCK", "MIXED", "CROP"] as const;
const VALID_UNIT_TYPES = [
  "PASTURE", "CORRAL", "BARN", "STORAGE",
  "WATER_SOURCE", "WORK_AREA", "FIELD", "GREENHOUSE", "OTHER",
] as const;

@Injectable()
export class AgroFarmService {
  constructor(
    private readonly repo: AgroFarmRepository,
    private readonly audit: AgroAuditRepository,
  ) {}

  async listFarms(tenantId: string, ownerId: string) {
    return this.repo.listFarms(tenantId, ownerId);
  }

  async getFarm(farmId: string, tenantId: string, ownerId: string) {
    const farm = await this.repo.findFarm(farmId);
    if (!farm || farm.tenantId !== tenantId || farm.ownerId !== ownerId) {
      throw new NotFoundException(`Farm not found: ${farmId}`);
    }
    return farm;
  }

  async createFarm(input: {
    tenantId: string;
    ownerId: string;
    name: string;
    operationType?: string;
    locationLabel?: string;
    notes?: string;
  }) {
    if (!input.name?.trim()) throw new BadRequestException("Farm name is required");
    if (input.operationType && !VALID_OPERATION_TYPES.includes(input.operationType as any)) {
      throw new BadRequestException(`Invalid operationType: ${input.operationType}. Must be one of: ${VALID_OPERATION_TYPES.join(", ")}`);
    }

    const farm = await this.repo.createFarm(input);
    await this.audit.record({
      farmId: farm.id,
      actorId: input.ownerId,
      entityType: "AgroFarm",
      entityId: farm.id,
      action: "farm.created",
      after: { name: farm.name, operationType: farm.operationType },
      source: "SYSTEM",
    });
    return farm;
  }

  async updateFarm(farmId: string, tenantId: string, ownerId: string, input: {
    name?: string;
    operationType?: string;
    locationLabel?: string;
    notes?: string;
  }) {
    const existing = await this.getFarm(farmId, tenantId, ownerId);
    if (input.operationType && !VALID_OPERATION_TYPES.includes(input.operationType as any)) {
      throw new BadRequestException(`Invalid operationType: ${input.operationType}`);
    }

    const updated = await this.repo.updateFarm(farmId, input);
    await this.audit.record({
      farmId,
      actorId: ownerId,
      entityType: "AgroFarm",
      entityId: farmId,
      action: "farm.updated",
      before: { name: existing.name, operationType: existing.operationType },
      after: { name: updated.name, operationType: updated.operationType },
      source: "WEB",
    });
    return updated;
  }

  async listUnits(farmId: string, tenantId: string, ownerId: string) {
    await this.getFarm(farmId, tenantId, ownerId);
    return this.repo.listUnits(farmId);
  }

  async getUnit(unitId: string) {
    const unit = await this.repo.findUnit(unitId);
    if (!unit) throw new NotFoundException(`Farm unit not found: ${unitId}`);
    return unit;
  }

  async createUnit(farmId: string, tenantId: string, ownerId: string, input: {
    name: string;
    type?: string;
    areaValue?: number;
    areaUnit?: string;
    notes?: string;
  }) {
    await this.getFarm(farmId, tenantId, ownerId);
    if (!input.name?.trim()) throw new BadRequestException("Unit name is required");
    if (input.type && !VALID_UNIT_TYPES.includes(input.type as any)) {
      throw new BadRequestException(`Invalid unit type: ${input.type}. Must be one of: ${VALID_UNIT_TYPES.join(", ")}`);
    }

    const unit = await this.repo.createUnit({ farmId, ...input });
    await this.audit.record({
      farmId,
      actorId: ownerId,
      entityType: "AgroFarmUnit",
      entityId: unit.id,
      action: "farm_unit.created",
      after: { name: unit.name, type: unit.type },
      source: "WEB",
    });
    return unit;
  }

  async updateUnit(unitId: string, tenantId: string, ownerId: string, input: {
    name?: string;
    type?: string;
    areaValue?: number;
    areaUnit?: string;
    notes?: string;
  }) {
    const unit = await this.getUnit(unitId);
    const farm = await this.repo.findFarm(unit.farmId);
    if (!farm || farm.tenantId !== tenantId || farm.ownerId !== ownerId) {
      throw new NotFoundException(`Farm unit not found: ${unitId}`);
    }
    if (input.type && !VALID_UNIT_TYPES.includes(input.type as any)) {
      throw new BadRequestException(`Invalid unit type: ${input.type}`);
    }

    const updated = await this.repo.updateUnit(unitId, input);
    await this.audit.record({
      farmId: unit.farmId,
      actorId: ownerId,
      entityType: "AgroFarmUnit",
      entityId: unitId,
      action: "farm_unit.updated",
      before: { name: unit.name, type: unit.type },
      after: { name: updated.name, type: updated.type },
      source: "WEB",
    });
    return updated;
  }

  async getAuditEvents(farmId: string, tenantId: string, ownerId: string, limit?: number) {
    await this.getFarm(farmId, tenantId, ownerId);
    return this.audit.list({ farmId, limit });
  }
}
