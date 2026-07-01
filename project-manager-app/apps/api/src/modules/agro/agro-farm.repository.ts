import { Injectable } from "@nestjs/common";
import { PrismaService } from "../../infrastructure/prisma/prisma.service.js";

@Injectable()
export class AgroFarmRepository {
  constructor(private readonly prisma: PrismaService) {}

  async listFarms(tenantId: string, ownerId: string) {
    return this.prisma.agroFarm.findMany({
      where: { tenantId, ownerId },
      orderBy: { createdAt: "desc" },
    });
  }

  async findFarm(farmId: string) {
    return this.prisma.agroFarm.findUnique({ where: { id: farmId } });
  }

  async createFarm(input: {
    tenantId: string;
    ownerId: string;
    name: string;
    operationType?: string;
    locationLabel?: string;
    notes?: string;
  }) {
    return this.prisma.agroFarm.create({
      data: {
        tenantId: input.tenantId,
        ownerId: input.ownerId,
        name: input.name,
        operationType: input.operationType ?? "LIVESTOCK",
        locationLabel: input.locationLabel,
        notes: input.notes,
      },
    });
  }

  async updateFarm(farmId: string, input: {
    name?: string;
    operationType?: string;
    locationLabel?: string;
    notes?: string;
  }) {
    return this.prisma.agroFarm.update({
      where: { id: farmId },
      data: {
        ...(input.name !== undefined && { name: input.name }),
        ...(input.operationType !== undefined && { operationType: input.operationType }),
        ...(input.locationLabel !== undefined && { locationLabel: input.locationLabel }),
        ...(input.notes !== undefined && { notes: input.notes }),
      },
    });
  }

  async listUnits(farmId: string) {
    return this.prisma.agroFarmUnit.findMany({
      where: { farmId },
      orderBy: { createdAt: "asc" },
    });
  }

  async findUnit(unitId: string) {
    return this.prisma.agroFarmUnit.findUnique({ where: { id: unitId } });
  }

  async createUnit(input: {
    farmId: string;
    name: string;
    type?: string;
    areaValue?: number;
    areaUnit?: string;
    notes?: string;
  }) {
    return this.prisma.agroFarmUnit.create({
      data: {
        farmId: input.farmId,
        name: input.name,
        type: input.type ?? "OTHER",
        areaValue: input.areaValue,
        areaUnit: input.areaUnit,
        notes: input.notes,
      },
    });
  }

  async updateUnit(unitId: string, input: {
    name?: string;
    type?: string;
    areaValue?: number;
    areaUnit?: string;
    notes?: string;
  }) {
    return this.prisma.agroFarmUnit.update({
      where: { id: unitId },
      data: {
        ...(input.name !== undefined && { name: input.name }),
        ...(input.type !== undefined && { type: input.type }),
        ...(input.areaValue !== undefined && { areaValue: input.areaValue }),
        ...(input.areaUnit !== undefined && { areaUnit: input.areaUnit }),
        ...(input.notes !== undefined && { notes: input.notes }),
      },
    });
  }
}
