import { Injectable } from "@nestjs/common";
import { PrismaService } from "../../infrastructure/prisma/prisma.service.js";

@Injectable()
export class AgroAnimalRepository {
  constructor(private readonly prisma: PrismaService) {}

  // ── Animals ───────────────────────────────────────────────────────────────

  async listAnimals(farmId: string) {
    return this.prisma.agroAnimal.findMany({
      where: { farmId },
      orderBy: { createdAt: "desc" },
    });
  }

  async findAnimal(animalId: string) {
    return this.prisma.agroAnimal.findUnique({ where: { id: animalId } });
  }

  async createAnimal(input: {
    farmId: string;
    currentUnitId?: string;
    tagCode?: string;
    species: string;
    breed?: string;
    sex: string;
    birthDate?: Date;
    estimatedAgeMonths?: number;
    initialWeight?: number;
    currentWeight?: number;
    acquisitionDate?: Date;
    acquisitionCost?: number;
    notes?: string;
  }) {
    return this.prisma.agroAnimal.create({
      data: {
        farmId: input.farmId,
        currentUnitId: input.currentUnitId,
        tagCode: input.tagCode,
        species: input.species,
        breed: input.breed,
        sex: input.sex,
        birthDate: input.birthDate,
        estimatedAgeMonths: input.estimatedAgeMonths,
        initialWeight: input.initialWeight,
        currentWeight: input.currentWeight ?? input.initialWeight,
        status: "ACTIVE",
        acquisitionDate: input.acquisitionDate,
        acquisitionCost: input.acquisitionCost,
        notes: input.notes,
      },
    });
  }

  async updateAnimal(animalId: string, input: {
    currentUnitId?: string | null;
    tagCode?: string;
    breed?: string;
    birthDate?: Date;
    estimatedAgeMonths?: number;
    currentWeight?: number;
    status?: string;
    notes?: string;
  }) {
    return this.prisma.agroAnimal.update({
      where: { id: animalId },
      data: {
        ...(input.currentUnitId !== undefined && { currentUnitId: input.currentUnitId }),
        ...(input.tagCode !== undefined && { tagCode: input.tagCode }),
        ...(input.breed !== undefined && { breed: input.breed }),
        ...(input.birthDate !== undefined && { birthDate: input.birthDate }),
        ...(input.estimatedAgeMonths !== undefined && { estimatedAgeMonths: input.estimatedAgeMonths }),
        ...(input.currentWeight !== undefined && { currentWeight: input.currentWeight }),
        ...(input.status !== undefined && { status: input.status }),
        ...(input.notes !== undefined && { notes: input.notes }),
      },
    });
  }

  // ── Animal Groups ─────────────────────────────────────────────────────────

  async listGroups(farmId: string) {
    return this.prisma.agroAnimalGroup.findMany({
      where: { farmId },
      orderBy: { createdAt: "desc" },
    });
  }

  async findGroup(groupId: string) {
    return this.prisma.agroAnimalGroup.findUnique({ where: { id: groupId } });
  }

  async createGroup(input: {
    farmId: string;
    currentUnitId?: string;
    name: string;
    species: string;
    count: number;
    averageWeight?: number;
    acquisitionDate?: Date;
    acquisitionCost?: number;
    notes?: string;
  }) {
    return this.prisma.agroAnimalGroup.create({
      data: {
        farmId: input.farmId,
        currentUnitId: input.currentUnitId,
        name: input.name,
        species: input.species,
        count: input.count,
        averageWeight: input.averageWeight,
        status: "ACTIVE",
        acquisitionDate: input.acquisitionDate,
        acquisitionCost: input.acquisitionCost,
        notes: input.notes,
      },
    });
  }

  async updateGroup(groupId: string, input: {
    currentUnitId?: string | null;
    name?: string;
    count?: number;
    averageWeight?: number;
    status?: string;
    notes?: string;
  }) {
    return this.prisma.agroAnimalGroup.update({
      where: { id: groupId },
      data: {
        ...(input.currentUnitId !== undefined && { currentUnitId: input.currentUnitId }),
        ...(input.name !== undefined && { name: input.name }),
        ...(input.count !== undefined && { count: input.count }),
        ...(input.averageWeight !== undefined && { averageWeight: input.averageWeight }),
        ...(input.status !== undefined && { status: input.status }),
        ...(input.notes !== undefined && { notes: input.notes }),
      },
    });
  }

  // ── Timeline (audit events for entity) ───────────────────────────────────

  async getEntityTimeline(farmId: string, entityType: string, entityId: string, limit = 50) {
    return this.prisma.agroAuditEvent.findMany({
      where: { farmId, entityType, entityId },
      orderBy: { createdAt: "desc" },
      take: limit,
    });
  }
}
