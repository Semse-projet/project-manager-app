import { BadRequestException, Injectable, NotFoundException, Optional } from "@nestjs/common";
import { AgroAuditRepository } from "./agro-audit.repository.js";
import { AgroFarmRepository } from "./agro-farm.repository.js";
import { AgroFarmAccessService, authorizeFarmAction } from "./agro-farm-access.service.js";
import { allowedAgroFarmActions, type AgroFarmAction } from "./agro-farm-policy.js";

const VALID_OPERATION_TYPES = ["LIVESTOCK", "MIXED", "CROP"] as const;
export const AGRO_UNIT_TYPES = [
  "PASTURE", "CORRAL", "BARN", "STORAGE",
  "WATER_SOURCE", "WORK_AREA", "FIELD", "GREENHOUSE",
  // Pantalla /agro/[farmId]/infrastructure los usaba y el API los rechazaba con 400.
  "PADDOCK", "MILKING_AREA", "FEEDLOT", "QUARANTINE", "SCALE",
  "OTHER",
] as const;

const VALID_UNIT_TYPES = AGRO_UNIT_TYPES;

@Injectable()
export class AgroFarmService {
  constructor(
    private readonly repo: AgroFarmRepository,
    private readonly audit: AgroAuditRepository,
    @Optional() private readonly access?: AgroFarmAccessService,
  ) {}

  /**
   * Fincas propias y, con AgroFarmAccessService, también aquellas donde el
   * usuario es miembro ACTIVE. `viewerRole` indica con qué rol las ve (T-050).
   */
  async listFarms(userId: string) {
    const owned = await this.repo.listFarms(userId);
    if (!this.access) return owned;
    const memberships = await this.access.listMemberships(userId);
    return [
      ...owned.map((farm) => ({ ...farm, viewerRole: "OWNER" })),
      ...memberships.map((m) => ({ ...m.farm, viewerRole: m.role })),
    ];
  }

  async getFarm(farmId: string, userId: string, action: AgroFarmAction = "farm.read") {
    const actor = await authorizeFarmAction(this.access, this.repo, farmId, userId, action);
    const farm = await this.repo.findFarm(farmId);
    if (!farm) throw new NotFoundException(`Farm not found: ${farmId}`);
    // viewerRole/viewerActions permiten a la UI ocultar lo que el rol de finca no
    // puede hacer; el API sigue decidiendo en cada endpoint.
    return { ...farm, viewerRole: actor.role, viewerActions: allowedAgroFarmActions(actor.role) };
  }

  async createFarm(input: {
    ownerId: string;
    /** Tenant de la sesión (T-051): habilita el espejo de tareas en JobTask. */
    tenantId?: string;
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

  /**
   * Asigna tenant a una finca que quedó sin él (backfill ambiguo o cuando el
   * tenant de la sesión no existía al crearla). Solo el propietario, solo si
   * la finca no tiene tenant todavía, y solo al tenant de su propia sesión —
   * nunca a uno arbitrario. Habilita el espejo JobTask (T-051) en la
   * siguiente escritura de cada tarea; no migra las ya existentes.
   */
  async assignTenant(farmId: string, ownerId: string, tenantId: string) {
    const farm = await this.getFarm(farmId, ownerId, "farm.manage");
    if (farm.tenantId) {
      throw new BadRequestException(`Farm ${farmId} already has a tenant`);
    }
    const tenant = await this.repo.findTenant(tenantId);
    if (!tenant) throw new BadRequestException(`Unknown tenant: ${tenantId}`);
    const updated = await this.repo.assignTenant(farmId, tenantId);
    await this.audit.record({
      farmId, actorId: ownerId,
      entityType: "AgroFarm", entityId: farmId,
      action: "farm.tenant_assigned",
      after: { tenantId },
      source: "WEB",
    });
    return updated;
  }

  async updateFarm(farmId: string, ownerId: string, input: {
    name?: string;
    operationType?: string;
    locationLabel?: string;
    notes?: string;
  }) {
    const existing = await this.getFarm(farmId, ownerId, "farm.manage");
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

  async listUnits(farmId: string, ownerId: string) {
    await this.getFarm(farmId, ownerId);
    return this.repo.listUnits(farmId);
  }

  async getUnit(unitId: string, userId: string, action: AgroFarmAction = "farm.read") {
    const unit = await this.repo.findUnit(unitId);
    if (!unit) throw new NotFoundException(`Farm unit not found: ${unitId}`);
    try {
      await authorizeFarmAction(this.access, this.repo, unit.farmId, userId, action);
    } catch (err) {
      if (err instanceof NotFoundException) throw new NotFoundException(`Farm unit not found: ${unitId}`);
      throw err;
    }
    return unit;
  }

  async createUnit(farmId: string, ownerId: string, input: {
    name: string;
    type?: string;
    areaValue?: number;
    areaUnit?: string;
    notes?: string;
  }) {
    await this.getFarm(farmId, ownerId, "farm.manage");
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

  async updateUnit(unitId: string, ownerId: string, input: {
    name?: string;
    type?: string;
    areaValue?: number;
    areaUnit?: string;
    notes?: string;
  }) {
    const unit = await this.getUnit(unitId, ownerId, "farm.manage");
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

  async getAuditEvents(farmId: string, ownerId: string, limit?: number) {
    await this.getFarm(farmId, ownerId, "farm.audit_read");
    return this.audit.list({ farmId, limit });
  }
}
