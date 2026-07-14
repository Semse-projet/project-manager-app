import { Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../../infrastructure/prisma/prisma.service.js";
import { randomUUID } from "node:crypto";

export type WorkerApplicationRecord = {
  id: string;
  tenantId: string;
  fullName: string;
  email: string;
  phone: string | null;
  city: string | null;
  trade: string;
  yearsExperience: number | null;
  message: string | null;
  proposedRate: unknown;
  jobId: string | null;
  status: string;
  reviewNotes: string | null;
  reviewedBy: string | null;
  reviewedAt: Date | null;
  createdUserId: string | null;
  sessionToken: string | null;
  sourceChannel: string;
  createdAt: Date;
  updatedAt: Date;
};

@Injectable()
export class WorkerApplicationRepository {
  constructor(private readonly prisma: PrismaService) {}

  async createApplication(data: {
    tenantId: string;
    fullName: string;
    email: string;
    phone?: string;
    city?: string;
    trade: string;
    yearsExperience?: number;
    message?: string;
    proposedRate?: number;
    jobId?: string;
    sessionToken?: string;
    sourceChannel?: string;
  }): Promise<WorkerApplicationRecord> {
    const now = new Date();
    return this.prisma.workerApplication.create({
      data: {
        id: randomUUID(),
        tenantId: data.tenantId,
        fullName: data.fullName,
        email: data.email,
        phone: data.phone ?? null,
        city: data.city ?? null,
        trade: data.trade,
        yearsExperience: data.yearsExperience ?? null,
        message: data.message ?? null,
        proposedRate: data.proposedRate != null ? String(data.proposedRate) : null,
        jobId: data.jobId ?? null,
        status: "submitted",
        sessionToken: data.sessionToken ?? null,
        sourceChannel: data.sourceChannel ?? "web",
        createdAt: now,
        updatedAt: now,
      },
    }) as unknown as WorkerApplicationRecord;
  }

  async countOpenByEmail(tenantId: string, email: string): Promise<number> {
    return this.prisma.workerApplication.count({
      where: { tenantId, email, status: { in: ["submitted", "reviewing"] } },
    });
  }

  async countRecentBySession(tenantId: string, sessionToken: string, since: Date): Promise<number> {
    return this.prisma.workerApplication.count({
      where: { tenantId, sessionToken, createdAt: { gte: since } },
    });
  }

  async listApplications(params: {
    tenantId: string;
    status?: string;
    limit?: number;
    offset?: number;
  }): Promise<WorkerApplicationRecord[]> {
    return this.prisma.workerApplication.findMany({
      where: {
        tenantId: params.tenantId,
        ...(params.status && { status: params.status }),
      },
      orderBy: { createdAt: "desc" },
      take: params.limit ?? 50,
      skip: params.offset ?? 0,
    }) as unknown as WorkerApplicationRecord[];
  }

  async countByStatus(tenantId: string): Promise<Record<string, number>> {
    const groups = await this.prisma.workerApplication.groupBy({
      by: ["status"],
      where: { tenantId },
      _count: { _all: true },
    });
    const result: Record<string, number> = {};
    for (const group of groups as Array<{ status: string; _count: { _all: number } }>) {
      result[group.status] = group._count._all;
    }
    return result;
  }

  async getApplication(id: string, tenantId: string): Promise<WorkerApplicationRecord> {
    const record = await this.prisma.workerApplication.findFirst({ where: { id, tenantId } });
    if (!record) throw new NotFoundException("WorkerApplication not found");
    return record as unknown as WorkerApplicationRecord;
  }

  async updateApplication(id: string, tenantId: string, data: {
    status?: string;
    reviewNotes?: string;
    reviewedBy?: string;
    reviewedAt?: Date;
    createdUserId?: string;
  }): Promise<WorkerApplicationRecord> {
    await this.getApplication(id, tenantId);
    return this.prisma.workerApplication.update({
      where: { id },
      data: { ...data, updatedAt: new Date() },
    }) as unknown as WorkerApplicationRecord;
  }
}
