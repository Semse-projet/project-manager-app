import { Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../../infrastructure/prisma/prisma.service.js";
import { AgroFarmRepository } from "./agro-farm.repository.js";

@Injectable()
export class AgroTraceabilityService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly farmRepo: AgroFarmRepository,
  ) {}

  private async assertFarm(farmId: string, ownerId: string) {
    const farm = await this.farmRepo.findFarm(farmId);
    if (!farm || farm.ownerId !== ownerId) throw new NotFoundException(`Farm not found: ${farmId}`);
    return farm;
  }

  // ── Traceability Events ────────────────────────────────────────────────────

  async listTraceabilityEvents(farmId: string, ownerId: string, filters: {
    entityType?: string; entityId?: string; productionCycleId?: string;
  }) {
    await this.assertFarm(farmId, ownerId);
    return this.prisma.agroTraceabilityEvent.findMany({
      where: {
        farmId,
        ...(filters.entityType && { entityType: filters.entityType }),
        ...(filters.entityId && { entityId: filters.entityId }),
        ...(filters.productionCycleId && { productionCycleId: filters.productionCycleId }),
      },
      orderBy: { occurredAt: "desc" },
    });
  }

  async createTraceabilityEvent(farmId: string, ownerId: string, body: {
    entityType: string; entityId: string; eventType: string;
    description: string; occurredAt: string;
    productionCycleId?: string;
    latitude?: number; longitude?: number;
    evidenceUrls?: string[]; verifiedBy?: string;
  }) {
    await this.assertFarm(farmId, ownerId);
    return this.prisma.agroTraceabilityEvent.create({
      data: {
        farmId,
        entityType: body.entityType,
        entityId: body.entityId,
        eventType: body.eventType,
        description: body.description,
        occurredAt: new Date(body.occurredAt),
        productionCycleId: body.productionCycleId,
        latitude: body.latitude,
        longitude: body.longitude,
        evidenceUrls: body.evidenceUrls ?? [],
        verifiedBy: body.verifiedBy,
      },
    });
  }

  async getEntityTimeline(farmId: string, ownerId: string, entityType: string, entityId: string) {
    await this.assertFarm(farmId, ownerId);
    return this.prisma.agroTraceabilityEvent.findMany({
      where: { farmId, entityType, entityId },
      orderBy: { occurredAt: "asc" },
    });
  }

  // ── Compliance Checks ──────────────────────────────────────────────────────

  async listComplianceChecks(farmId: string, ownerId: string, status?: string) {
    await this.assertFarm(farmId, ownerId);
    return this.prisma.agroComplianceCheck.findMany({
      where: { farmId, ...(status && { status }) },
      orderBy: [{ status: "asc" }, { dueDate: "asc" }],
    });
  }

  async createComplianceCheck(farmId: string, ownerId: string, body: {
    checkType: string; entityType?: string; entityId?: string;
    dueDate?: string; notes?: string;
  }) {
    await this.assertFarm(farmId, ownerId);
    return this.prisma.agroComplianceCheck.create({
      data: {
        farmId,
        checkType: body.checkType,
        entityType: body.entityType,
        entityId: body.entityId,
        dueDate: body.dueDate ? new Date(body.dueDate) : undefined,
        notes: body.notes,
      },
    });
  }

  async resolveComplianceCheck(checkId: string, ownerId: string, body: {
    status: string; notes?: string; evidenceUrls?: string[]; reviewedBy?: string;
  }) {
    const check = await this.prisma.agroComplianceCheck.findUnique({ where: { id: checkId } });
    if (!check) throw new NotFoundException(`Compliance check not found: ${checkId}`);
    await this.assertFarm(check.farmId, ownerId);
    return this.prisma.agroComplianceCheck.update({
      where: { id: checkId },
      data: {
        status: body.status,
        completedAt: ["COMPLIANT", "NON_COMPLIANT", "WAIVED"].includes(body.status) ? new Date() : undefined,
        notes: body.notes,
        evidenceUrls: body.evidenceUrls,
        reviewedBy: body.reviewedBy,
      },
    });
  }

  async getComplianceSummary(farmId: string, ownerId: string) {
    await this.assertFarm(farmId, ownerId);
    const checks = await this.prisma.agroComplianceCheck.findMany({ where: { farmId } }) as Array<{
      status: string;
      dueDate: Date | null;
    }>;
    const now = new Date();
    return {
      total:       checks.length,
      pending:     checks.filter((check) => check.status === "PENDING").length,
      compliant:   checks.filter((check) => check.status === "COMPLIANT").length,
      nonCompliant: checks.filter((check) => check.status === "NON_COMPLIANT").length,
      overdue:     checks.filter((check) => check.status === "PENDING" && check.dueDate && check.dueDate < now).length,
    };
  }
}
