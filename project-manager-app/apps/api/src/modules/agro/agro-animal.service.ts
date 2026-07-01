import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { AgroAuditRepository } from "./agro-audit.repository.js";
import { AgroAnimalRepository } from "./agro-animal.repository.js";
import { AgroFarmRepository } from "./agro-farm.repository.js";

const VALID_SPECIES = ["CATTLE", "PIG", "GOAT", "SHEEP", "HORSE", "CHICKEN", "OTHER"] as const;
const VALID_SEX = ["MALE", "FEMALE", "UNKNOWN"] as const;
const VALID_STATUS = ["ACTIVE", "SOLD", "DEAD", "LOST", "INACTIVE"] as const;

@Injectable()
export class AgroAnimalService {
  constructor(
    private readonly repo: AgroAnimalRepository,
    private readonly farmRepo: AgroFarmRepository,
    private readonly audit: AgroAuditRepository,
  ) {}

  private async assertFarmAccess(farmId: string, tenantId: string, ownerId: string) {
    const farm = await this.farmRepo.findFarm(farmId);
    if (!farm || farm.tenantId !== tenantId || farm.ownerId !== ownerId) {
      throw new NotFoundException(`Farm not found: ${farmId}`);
    }
    return farm;
  }

  // ── Animals ───────────────────────────────────────────────────────────────

  async listAnimals(farmId: string, tenantId: string, ownerId: string) {
    await this.assertFarmAccess(farmId, tenantId, ownerId);
    return this.repo.listAnimals(farmId);
  }

  async getAnimal(animalId: string) {
    const animal = await this.repo.findAnimal(animalId);
    if (!animal) throw new NotFoundException(`Animal not found: ${animalId}`);
    return animal;
  }

  async createAnimal(farmId: string, tenantId: string, ownerId: string, input: {
    currentUnitId?: string;
    tagCode?: string;
    species: string;
    breed?: string;
    sex: string;
    birthDate?: Date;
    estimatedAgeMonths?: number;
    initialWeight?: number;
    acquisitionDate?: Date;
    acquisitionCost?: number;
    notes?: string;
  }) {
    await this.assertFarmAccess(farmId, tenantId, ownerId);
    if (!VALID_SPECIES.includes(input.species as any)) {
      throw new BadRequestException(`Invalid species: ${input.species}`);
    }
    if (!VALID_SEX.includes(input.sex as any)) {
      throw new BadRequestException(`Invalid sex: ${input.sex}`);
    }

    const animal = await this.repo.createAnimal({ farmId, ...input });
    await this.audit.record({
      farmId, actorId: ownerId,
      entityType: "AgroAnimal", entityId: animal.id,
      action: "animal.created",
      after: { species: animal.species, tagCode: animal.tagCode, sex: animal.sex },
      source: "WEB",
    });
    return animal;
  }

  async updateAnimal(animalId: string, tenantId: string, ownerId: string, input: {
    tagCode?: string;
    breed?: string;
    birthDate?: Date;
    estimatedAgeMonths?: number;
    notes?: string;
  }) {
    const animal = await this.getAnimal(animalId);
    await this.assertFarmAccess(animal.farmId, tenantId, ownerId);

    const updated = await this.repo.updateAnimal(animalId, input);
    await this.audit.record({
      farmId: animal.farmId, actorId: ownerId,
      entityType: "AgroAnimal", entityId: animalId,
      action: "animal.updated",
      before: { tagCode: animal.tagCode, breed: animal.breed },
      after: { tagCode: updated.tagCode, breed: updated.breed },
      source: "WEB",
    });
    return updated;
  }

  async moveAnimal(animalId: string, tenantId: string, ownerId: string, targetUnitId: string | null, notes?: string) {
    const animal = await this.getAnimal(animalId);
    await this.assertFarmAccess(animal.farmId, tenantId, ownerId);
    if (animal.status !== "ACTIVE") {
      throw new BadRequestException(`Cannot move animal with status: ${animal.status}`);
    }

    const updated = await this.repo.updateAnimal(animalId, { currentUnitId: targetUnitId });
    await this.audit.record({
      farmId: animal.farmId, actorId: ownerId,
      entityType: "AgroAnimal", entityId: animalId,
      action: "animal.moved",
      before: { currentUnitId: animal.currentUnitId },
      after: { currentUnitId: targetUnitId, notes },
      source: "WEB",
    });
    return updated;
  }

  async weighAnimal(animalId: string, tenantId: string, ownerId: string, weight: number, notes?: string) {
    if (weight <= 0) throw new BadRequestException("Weight must be positive");
    const animal = await this.getAnimal(animalId);
    await this.assertFarmAccess(animal.farmId, tenantId, ownerId);

    const updated = await this.repo.updateAnimal(animalId, { currentWeight: weight });
    await this.audit.record({
      farmId: animal.farmId, actorId: ownerId,
      entityType: "AgroAnimal", entityId: animalId,
      action: "animal.weighed",
      before: { currentWeight: animal.currentWeight ? Number(animal.currentWeight) : null },
      after: { currentWeight: weight, notes },
      source: "WEB",
    });
    return updated;
  }

  async changeAnimalStatus(animalId: string, tenantId: string, ownerId: string, status: string, reason?: string) {
    if (!VALID_STATUS.includes(status as any)) {
      throw new BadRequestException(`Invalid status: ${status}`);
    }
    const animal = await this.getAnimal(animalId);
    await this.assertFarmAccess(animal.farmId, tenantId, ownerId);

    const updated = await this.repo.updateAnimal(animalId, { status });
    await this.audit.record({
      farmId: animal.farmId, actorId: ownerId,
      entityType: "AgroAnimal", entityId: animalId,
      action: "animal.status_changed",
      before: { status: animal.status },
      after: { status, reason },
      source: "WEB",
    });
    return updated;
  }

  async getAnimalTimeline(animalId: string, tenantId: string, ownerId: string) {
    const animal = await this.getAnimal(animalId);
    await this.assertFarmAccess(animal.farmId, tenantId, ownerId);
    return this.repo.getEntityTimeline(animal.farmId, "AgroAnimal", animalId);
  }

  // ── Animal Groups ─────────────────────────────────────────────────────────

  async listGroups(farmId: string, tenantId: string, ownerId: string) {
    await this.assertFarmAccess(farmId, tenantId, ownerId);
    return this.repo.listGroups(farmId);
  }

  async getGroup(groupId: string) {
    const group = await this.repo.findGroup(groupId);
    if (!group) throw new NotFoundException(`Animal group not found: ${groupId}`);
    return group;
  }

  async createGroup(farmId: string, tenantId: string, ownerId: string, input: {
    currentUnitId?: string;
    name: string;
    species: string;
    count: number;
    averageWeight?: number;
    acquisitionDate?: Date;
    acquisitionCost?: number;
    notes?: string;
  }) {
    await this.assertFarmAccess(farmId, tenantId, ownerId);
    if (!input.name?.trim()) throw new BadRequestException("Group name is required");
    if (!VALID_SPECIES.includes(input.species as any)) {
      throw new BadRequestException(`Invalid species: ${input.species}`);
    }
    if (input.count < 1) throw new BadRequestException("Count must be at least 1");

    const group = await this.repo.createGroup({ farmId, ...input });
    await this.audit.record({
      farmId, actorId: ownerId,
      entityType: "AgroAnimalGroup", entityId: group.id,
      action: "animal_group.created",
      after: { name: group.name, species: group.species, count: group.count },
      source: "WEB",
    });
    return group;
  }

  async updateGroup(groupId: string, tenantId: string, ownerId: string, input: {
    name?: string;
    averageWeight?: number;
    notes?: string;
  }) {
    const group = await this.getGroup(groupId);
    await this.assertFarmAccess(group.farmId, tenantId, ownerId);

    const updated = await this.repo.updateGroup(groupId, input);
    await this.audit.record({
      farmId: group.farmId, actorId: ownerId,
      entityType: "AgroAnimalGroup", entityId: groupId,
      action: "animal_group.updated",
      before: { name: group.name },
      after: { name: updated.name },
      source: "WEB",
    });
    return updated;
  }

  async moveGroup(groupId: string, tenantId: string, ownerId: string, targetUnitId: string | null, notes?: string) {
    const group = await this.getGroup(groupId);
    await this.assertFarmAccess(group.farmId, tenantId, ownerId);
    if (group.status !== "ACTIVE") {
      throw new BadRequestException(`Cannot move group with status: ${group.status}`);
    }

    const updated = await this.repo.updateGroup(groupId, { currentUnitId: targetUnitId });
    await this.audit.record({
      farmId: group.farmId, actorId: ownerId,
      entityType: "AgroAnimalGroup", entityId: groupId,
      action: "animal_group.moved",
      before: { currentUnitId: group.currentUnitId },
      after: { currentUnitId: targetUnitId, notes },
      source: "WEB",
    });
    return updated;
  }

  async adjustGroupCount(groupId: string, tenantId: string, ownerId: string, newCount: number, reason?: string) {
    if (newCount < 0) throw new BadRequestException("Count cannot be negative");
    const group = await this.getGroup(groupId);
    await this.assertFarmAccess(group.farmId, tenantId, ownerId);

    const updated = await this.repo.updateGroup(groupId, { count: newCount });
    await this.audit.record({
      farmId: group.farmId, actorId: ownerId,
      entityType: "AgroAnimalGroup", entityId: groupId,
      action: "animal_group.count_adjusted",
      before: { count: group.count },
      after: { count: newCount, reason },
      source: "WEB",
    });
    return updated;
  }

  async changeGroupStatus(groupId: string, tenantId: string, ownerId: string, status: string, reason?: string) {
    if (!VALID_STATUS.includes(status as any)) {
      throw new BadRequestException(`Invalid status: ${status}`);
    }
    const group = await this.getGroup(groupId);
    await this.assertFarmAccess(group.farmId, tenantId, ownerId);

    const updated = await this.repo.updateGroup(groupId, { status });
    await this.audit.record({
      farmId: group.farmId, actorId: ownerId,
      entityType: "AgroAnimalGroup", entityId: groupId,
      action: "animal_group.status_changed",
      before: { status: group.status },
      after: { status, reason },
      source: "WEB",
    });
    return updated;
  }

  async getGroupTimeline(groupId: string, tenantId: string, ownerId: string) {
    const group = await this.getGroup(groupId);
    await this.assertFarmAccess(group.farmId, tenantId, ownerId);
    return this.repo.getEntityTimeline(group.farmId, "AgroAnimalGroup", groupId);
  }
}
