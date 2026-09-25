import { Injectable } from "@nestjs/common";
import { PrismaService } from "../../infrastructure/prisma/prisma.service.js";
import { AgroAuditRepository } from "./agro-audit.repository.js";

type AuditInput = Parameters<AgroAuditRepository["record"]>[0];

const INCIDENT_INCLUDE = {
  farmUnit: { select: { id: true, name: true, type: true } },
  animal: { select: { id: true, tagCode: true, species: true, status: true } },
  animalGroup: { select: { id: true, name: true, species: true, count: true } },
  cropCycle: { select: { id: true, cropName: true, status: true } },
  inventoryItem: { select: { id: true, name: true, category: true } },
} as const;

export type AgroIncidentFilters = {
  status?: string[];
  severity?: string[];
  type?: string[];
  assignedToId?: string;
  reportedById?: string;
  farmUnitId?: string;
  animalId?: string;
  animalGroupId?: string;
  q?: string;
  limit?: number;
};

export type AgroIncidentCreateData = {
  farmId: string;
  farmUnitId?: string | null;
  animalId?: string | null;
  animalGroupId?: string | null;
  cropCycleId?: string | null;
  inventoryItemId?: string | null;
  reportedById: string;
  assignedToId?: string | null;
  relatedTaskSource?: string | null;
  relatedTaskId?: string | null;
  type: string;
  severity: string;
  severityConfirmed: boolean;
  status: string;
  title: string;
  description?: string | null;
  occurredAt?: Date | null;
  detectedAt: Date;
  triagedAt?: Date | null;
  source: string;
  clientEventId?: string | null;
  metadata?: Record<string, unknown> | null;
};

@Injectable()
export class AgroIncidentRepository {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AgroAuditRepository,
  ) {}

  async list(farmId: string, f: AgroIncidentFilters = {}) {
    const q = f.q?.trim();
    return this.prisma.agroIncident.findMany({
      where: {
        farmId,
        ...(f.status?.length && { status: { in: f.status } }),
        ...(f.severity?.length && { severity: { in: f.severity } }),
        ...(f.type?.length && { type: { in: f.type } }),
        ...(f.assignedToId && { assignedToId: f.assignedToId }),
        ...(f.reportedById && { reportedById: f.reportedById }),
        ...(f.farmUnitId && { farmUnitId: f.farmUnitId }),
        ...(f.animalId && { animalId: f.animalId }),
        ...(f.animalGroupId && { animalGroupId: f.animalGroupId }),
        ...(q && {
          OR: [
            { title: { contains: q, mode: "insensitive" as const } },
            { description: { contains: q, mode: "insensitive" as const } },
          ],
        }),
      },
      include: INCIDENT_INCLUDE,
      orderBy: [{ detectedAt: "desc" }],
      take: f.limit ?? 100,
    });
  }

  async find(incidentId: string) {
    return this.prisma.agroIncident.findUnique({ where: { id: incidentId }, include: INCIDENT_INCLUDE });
  }

  async findByClientEventId(farmId: string, clientEventId: string) {
    return this.prisma.agroIncident.findUnique({
      where: { farmId_clientEventId: { farmId, clientEventId } },
      include: INCIDENT_INCLUDE,
    });
  }

  async countByStatus(farmId: string) {
    const rows = await this.prisma.agroIncident.groupBy({ by: ["status", "severity"], where: { farmId }, _count: { _all: true } });
    return rows.map((r) => ({ status: r.status, severity: r.severity, count: r._count._all }));
  }

  /** Comprueba que las entidades relacionadas existen y pertenecen a la finca. */
  async relationsBelongToFarm(farmId: string, ids: {
    farmUnitId?: string | null; animalId?: string | null; animalGroupId?: string | null;
    cropCycleId?: string | null; inventoryItemId?: string | null;
  }): Promise<string[]> {
    const invalid: string[] = [];
    const check = async (field: string, id: string | null | undefined, find: (id: string) => Promise<{ farmId: string } | null>) => {
      if (!id) return;
      const row = await find(id);
      if (!row || row.farmId !== farmId) invalid.push(field);
    };
    const select = { farmId: true } as const;
    await Promise.all([
      check("farmUnitId", ids.farmUnitId, (id) => this.prisma.agroFarmUnit.findUnique({ where: { id }, select })),
      check("animalId", ids.animalId, (id) => this.prisma.agroAnimal.findUnique({ where: { id }, select })),
      check("animalGroupId", ids.animalGroupId, (id) => this.prisma.agroAnimalGroup.findUnique({ where: { id }, select })),
      check("cropCycleId", ids.cropCycleId, (id) => this.prisma.agroCropCycle.findUnique({ where: { id }, select })),
      check("inventoryItemId", ids.inventoryItemId, (id) => this.prisma.agroInventoryItem.findUnique({ where: { id }, select })),
    ]);
    return invalid;
  }

  /** Crea incidencia + evento de timeline en una transacción. */
  async create(data: AgroIncidentCreateData, audit: Omit<AuditInput, "entityId">) {
    return this.prisma.$transaction(async (tx) => {
      const incident = await tx.agroIncident.create({ data: data as any, include: INCIDENT_INCLUDE });
      await this.audit.record({ ...audit, entityId: incident.id }, tx);
      return incident;
    });
  }

  /**
   * Actualiza con control de concurrencia optimista por `status` esperado:
   * si otro actor cambió el estado entre la lectura y la escritura, count = 0.
   */
  async update(incidentId: string, expectedStatus: string, patch: Record<string, unknown>, audits: AuditInput[]) {
    return this.prisma.$transaction(async (tx) => {
      const res = await tx.agroIncident.updateMany({ where: { id: incidentId, status: expectedStatus }, data: patch as any });
      if (res.count === 0) return null;
      for (const a of audits) await this.audit.record(a, tx);
      return tx.agroIncident.findUnique({ where: { id: incidentId }, include: INCIDENT_INCLUDE });
    });
  }

  async appendAudit(audit: AuditInput) {
    return this.audit.record(audit);
  }
}
