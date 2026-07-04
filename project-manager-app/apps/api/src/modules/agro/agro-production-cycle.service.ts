import { Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../../infrastructure/prisma/prisma.service.js";
import { AgroFarmRepository } from "./agro-farm.repository.js";

@Injectable()
export class AgroProductionCycleService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly farmRepo: AgroFarmRepository,
  ) {}

  private async assertFarm(farmId: string, ownerId: string) {
    const farm = await this.farmRepo.findFarm(farmId);
    if (!farm || farm.ownerId !== ownerId) throw new NotFoundException(`Farm not found: ${farmId}`);
    return farm;
  }

  async listCycles(farmId: string, ownerId: string) {
    await this.assertFarm(farmId, ownerId);
    return this.prisma.agroProductionCycle.findMany({
      where: { farmId },
      include: { cropCycles: { select: { id: true, cropName: true, status: true } } },
      orderBy: { startDate: "desc" },
    });
  }

  async createCycle(farmId: string, ownerId: string, body: {
    name: string; cycleType: string; startDate: string;
    endDate?: string; notes?: string;
  }) {
    await this.assertFarm(farmId, ownerId);
    return this.prisma.agroProductionCycle.create({
      data: {
        farmId,
        name: body.name,
        cycleType: body.cycleType,
        startDate: new Date(body.startDate),
        endDate: body.endDate ? new Date(body.endDate) : undefined,
        notes: body.notes,
      },
    });
  }

  async getCycle(cycleId: string, ownerId: string) {
    const cycle = await this.prisma.agroProductionCycle.findUnique({
      where: { id: cycleId },
      include: {
        cropCycles: true,
        traceability: { orderBy: { occurredAt: "desc" }, take: 20 },
      },
    });
    if (!cycle) throw new NotFoundException(`Cycle not found: ${cycleId}`);
    await this.assertFarm(cycle.farmId, ownerId);
    return cycle;
  }

  async updateCycle(cycleId: string, ownerId: string, body: {
    name?: string; status?: string; endDate?: string | null; notes?: string | null;
  }) {
    const cycle = await this.prisma.agroProductionCycle.findUnique({ where: { id: cycleId } });
    if (!cycle) throw new NotFoundException(`Cycle not found: ${cycleId}`);
    await this.assertFarm(cycle.farmId, ownerId);
    return this.prisma.agroProductionCycle.update({
      where: { id: cycleId },
      data: {
        ...(body.name && { name: body.name }),
        ...(body.status && { status: body.status }),
        ...(body.endDate !== undefined && { endDate: body.endDate ? new Date(body.endDate) : null }),
        ...(body.notes !== undefined && { notes: body.notes }),
      },
    });
  }

  async listCropCycles(farmId: string, ownerId: string, cycleId?: string) {
    await this.assertFarm(farmId, ownerId);
    return this.prisma.agroCropCycle.findMany({
      where: { farmId, ...(cycleId && { productionCycleId: cycleId }) },
      include: {
        farmUnit: { select: { id: true, name: true } },
        inputApplications: { select: { id: true, inputType: true, quantity: true, unit: true, appliedAt: true } },
        harvestRecords: { select: { id: true, quantityKg: true, qualityGrade: true, harvestedAt: true } },
      },
      orderBy: { createdAt: "desc" },
    });
  }

  async createCropCycle(farmId: string, ownerId: string, body: {
    cropName: string; cropVariety?: string; productionCycleId?: string;
    fieldUnitId?: string; sowingDate?: string; expectedHarvestDate?: string;
    areaHectares?: number; seedQuantityKg?: number; notes?: string;
  }) {
    await this.assertFarm(farmId, ownerId);
    return this.prisma.agroCropCycle.create({
      data: {
        farmId,
        cropName: body.cropName,
        cropVariety: body.cropVariety,
        productionCycleId: body.productionCycleId,
        fieldUnitId: body.fieldUnitId,
        sowingDate: body.sowingDate ? new Date(body.sowingDate) : undefined,
        expectedHarvestDate: body.expectedHarvestDate ? new Date(body.expectedHarvestDate) : undefined,
        areaHectares: body.areaHectares,
        seedQuantityKg: body.seedQuantityKg,
        notes: body.notes,
      },
    });
  }

  async addInputApplication(cropCycleId: string, ownerId: string, body: {
    inputType: string; productName: string; quantity: number; unit: string;
    appliedAt: string; fieldUnitId?: string; notes?: string;
  }) {
    const crop = await this.prisma.agroCropCycle.findUnique({ where: { id: cropCycleId } });
    if (!crop) throw new NotFoundException(`CropCycle not found: ${cropCycleId}`);
    await this.assertFarm(crop.farmId, ownerId);
    return this.prisma.agroInputApplication.create({
      data: {
        farmId: crop.farmId,
        cropCycleId,
        inputType: body.inputType,
        productName: body.productName,
        quantity: body.quantity,
        unit: body.unit,
        appliedAt: new Date(body.appliedAt),
        fieldUnitId: body.fieldUnitId,
        notes: body.notes,
      },
    });
  }

  async recordHarvest(cropCycleId: string, ownerId: string, body: {
    harvestedAt: string; quantityKg: number; qualityGrade?: string;
    storageLocation?: string; destinationType?: string; notes?: string;
  }) {
    const crop = await this.prisma.agroCropCycle.findUnique({ where: { id: cropCycleId } });
    if (!crop) throw new NotFoundException(`CropCycle not found: ${cropCycleId}`);
    await this.assertFarm(crop.farmId, ownerId);
    const [harvest] = await this.prisma.$transaction([
      this.prisma.agroHarvestRecord.create({
        data: {
          farmId: crop.farmId,
          cropCycleId,
          harvestedAt: new Date(body.harvestedAt),
          quantityKg: body.quantityKg,
          qualityGrade: body.qualityGrade,
          storageLocation: body.storageLocation,
          destinationType: body.destinationType,
          notes: body.notes,
        },
      }),
      this.prisma.agroCropCycle.update({
        where: { id: cropCycleId },
        data: { status: "HARVESTED", actualHarvestDate: new Date(body.harvestedAt) },
      }),
    ]);
    return harvest;
  }
}
