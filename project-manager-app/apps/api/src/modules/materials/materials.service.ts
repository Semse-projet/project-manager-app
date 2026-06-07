import { BadRequestException, Injectable } from "@nestjs/common";
import { PrismaService } from "../../infrastructure/prisma/prisma.service.js";
import { databaseEnabled } from "../../infrastructure/persistence/persistence-mode.js";

export interface MaterialRequestRecord {
  id: string;
  tenantId: string;
  jobId: string;
  requestedBy: string;
  milestone: string | null;
  item: string;
  quantity: number;
  unit: string;
  estimatedCost: number | null;
  status: string;
  approvedBy: string | null;
  approvedAt: string | null;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
}

function toRecord(row: {
  id: string; tenantId: string; jobId: string; requestedBy: string;
  milestone: string | null; item: string;
  quantity: { toNumber(): number }; unit: string;
  estimatedCost: { toNumber(): number } | null;
  status: string; approvedBy: string | null; approvedAt: Date | null;
  notes: string | null; createdAt: Date; updatedAt: Date;
}): MaterialRequestRecord {
  return {
    id: row.id, tenantId: row.tenantId, jobId: row.jobId,
    requestedBy: row.requestedBy, milestone: row.milestone,
    item: row.item, quantity: row.quantity.toNumber(), unit: row.unit,
    estimatedCost: row.estimatedCost ? row.estimatedCost.toNumber() : null,
    status: row.status, approvedBy: row.approvedBy,
    approvedAt: row.approvedAt ? row.approvedAt.toISOString() : null,
    notes: row.notes,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

const MOCK_REQUESTS: MaterialRequestRecord[] = [];

@Injectable()
export class MaterialsService {
  constructor(private readonly prisma: PrismaService) {}

  async listByWorker(input: { tenantId: string; userId: string; status?: string }): Promise<MaterialRequestRecord[]> {
    if (!databaseEnabled()) return MOCK_REQUESTS;
    const rows = await this.prisma.materialRequest.findMany({
      where: { tenantId: input.tenantId, requestedBy: input.userId, ...(input.status ? { status: input.status } : {}) },
      orderBy: { createdAt: "desc" },
    });
    return rows.map(toRecord);
  }

  async listByJob(input: { tenantId: string; jobId: string }): Promise<MaterialRequestRecord[]> {
    if (!databaseEnabled()) return MOCK_REQUESTS;
    const rows = await this.prisma.materialRequest.findMany({
      where: { tenantId: input.tenantId, jobId: input.jobId },
      orderBy: { createdAt: "desc" },
    });
    return rows.map(toRecord);
  }

  async listAll(input: { tenantId: string; status?: string }): Promise<MaterialRequestRecord[]> {
    if (!databaseEnabled()) return MOCK_REQUESTS;
    const rows = await this.prisma.materialRequest.findMany({
      where: { tenantId: input.tenantId, ...(input.status ? { status: input.status } : {}) },
      orderBy: { createdAt: "desc" },
    });
    return rows.map(toRecord);
  }

  async create(input: {
    tenantId: string; jobId: string; requestedBy: string;
    milestone?: string; item: string; quantity: number;
    unit: string; estimatedCost?: number; notes?: string;
  }): Promise<MaterialRequestRecord> {
    if (!input.item.trim()) throw new BadRequestException("item required");

    if (!databaseEnabled()) {
      const mock: MaterialRequestRecord = {
        id: `mat_${Date.now()}`,
        status: "pending",
        approvedBy: null, approvedAt: null,
        milestone: input.milestone ?? null,
        estimatedCost: input.estimatedCost ?? null,
        notes: input.notes ?? null,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        ...input,
        quantity: input.quantity,
        unit: input.unit,
      };
      MOCK_REQUESTS.push(mock);
      return mock;
    }

    const row = await this.prisma.materialRequest.create({
      data: {
        tenantId: input.tenantId,
        jobId: input.jobId,
        requestedBy: input.requestedBy,
        milestone: input.milestone,
        item: input.item,
        quantity: input.quantity,
        unit: input.unit,
        estimatedCost: input.estimatedCost,
        notes: input.notes,
      },
    });
    return toRecord(row);
  }

  async approve(input: { tenantId: string; requestId: string; approvedBy: string }): Promise<MaterialRequestRecord> {
    if (!databaseEnabled()) {
      const r = MOCK_REQUESTS.find(r => r.id === input.requestId);
      if (r) { r.status = "approved"; r.approvedBy = input.approvedBy; r.approvedAt = new Date().toISOString(); }
      return r ?? ({} as MaterialRequestRecord);
    }
    const row = await this.prisma.materialRequest.update({
      where: { id: input.requestId, tenantId: input.tenantId },
      data: { status: "approved", approvedBy: input.approvedBy, approvedAt: new Date() },
    });
    return toRecord(row);
  }
}
