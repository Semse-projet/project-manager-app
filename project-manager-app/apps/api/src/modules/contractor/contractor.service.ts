import { Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../../infrastructure/prisma/prisma.service.js";

export type LeadStatus =
  | "new" | "contacted" | "estimate_sent" | "estimate_approved"
  | "in_progress" | "completed" | "lost";

export type LeadUrgency = "asap" | "this_week" | "this_month" | "flexible";

export type LeadSource = "referral" | "nextdoor" | "facebook" | "call" | "website" | "other";

export type CreateLeadInput = {
  tenantId: string;
  orgId: string;
  createdBy: string;
  name: string;
  phone?: string;
  email?: string;
  address?: string;
  city?: string;
  state?: string;
  jobType?: string;
  description?: string;
  budgetRange?: string;
  urgency?: LeadUrgency;
  notes?: string;
  nextAction?: string;
  nextActionAt?: string;
  source?: LeadSource;
};

export type UpdateLeadInput = Partial<Omit<CreateLeadInput, "tenantId" | "orgId" | "createdBy">> & {
  status?: LeadStatus;
  jobId?: string;
  projectId?: string;
};

type LeadRow = {
  id: string;
  tenantId: string;
  orgId: string;
  createdBy: string;
  name: string;
  phone: string | null;
  email: string | null;
  address: string | null;
  city: string | null;
  state: string | null;
  jobType: string | null;
  description: string | null;
  budgetRange: string | null;
  urgency: string | null;
  status: string;
  notes: string | null;
  nextAction: string | null;
  nextActionAt: Date | null;
  jobId: string | null;
  projectId: string | null;
  source: string | null;
  createdAt: Date;
  updatedAt: Date;
};

function toView(row: LeadRow) {
  return {
    id: row.id,
    tenantId: row.tenantId,
    orgId: row.orgId,
    createdBy: row.createdBy,
    name: row.name,
    phone: row.phone,
    email: row.email,
    address: row.address,
    city: row.city,
    state: row.state,
    jobType: row.jobType,
    description: row.description,
    budgetRange: row.budgetRange,
    urgency: row.urgency as LeadUrgency | null,
    status: row.status as LeadStatus,
    notes: row.notes,
    nextAction: row.nextAction,
    nextActionAt: row.nextActionAt?.toISOString() ?? null,
    jobId: row.jobId,
    projectId: row.projectId,
    source: row.source as LeadSource | null,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

@Injectable()
export class ContractorService {
  constructor(private readonly prisma: PrismaService) {}

  async createLead(input: CreateLeadInput) {
    const row = await this.prisma.contractorLead.create({
      data: {
        tenantId: input.tenantId,
        orgId: input.orgId,
        createdBy: input.createdBy,
        name: input.name,
        phone: input.phone ?? null,
        email: input.email ?? null,
        address: input.address ?? null,
        city: input.city ?? null,
        state: input.state ?? null,
        jobType: input.jobType ?? null,
        description: input.description ?? null,
        budgetRange: input.budgetRange ?? null,
        urgency: input.urgency ?? null,
        status: "new",
        notes: input.notes ?? null,
        nextAction: input.nextAction ?? null,
        nextActionAt: input.nextActionAt ? new Date(input.nextActionAt) : null,
        source: input.source ?? null,
      },
    });
    return toView(row as LeadRow);
  }

  async listLeads(tenantId: string, options?: { status?: LeadStatus; orgId?: string; limit?: number; search?: string }) {
    const where = {
      tenantId,
      ...(options?.orgId ? { orgId: options.orgId } : {}),
      ...(options?.status ? { status: options.status } : {}),
      ...(options?.search ? {
        OR: [
          { name: { contains: options.search, mode: "insensitive" as const } },
          { phone: { contains: options.search, mode: "insensitive" as const } },
          { email: { contains: options.search, mode: "insensitive" as const } },
          { jobType: { contains: options.search, mode: "insensitive" as const } },
          { address: { contains: options.search, mode: "insensitive" as const } },
        ],
      } : {}),
    };
    const rows = await this.prisma.contractorLead.findMany({
      where,
      orderBy: [{ status: "asc" }, { createdAt: "desc" }],
      take: options?.limit ?? 100,
    });
    return rows.map((row: LeadRow) => toView(row));
  }

  async getLead(id: string, tenantId: string) {
    const row = await this.prisma.contractorLead.findFirst({ where: { id, tenantId } });
    if (!row) throw new NotFoundException(`Lead '${id}' not found`);
    return toView(row as LeadRow);
  }

  async updateLead(id: string, tenantId: string, input: UpdateLeadInput) {
    const existing = await this.getLead(id, tenantId);
    const updated = await this.prisma.contractorLead.update({
      where: { id: existing.id },
      data: {
        ...(input.name !== undefined ? { name: input.name } : {}),
        ...(input.phone !== undefined ? { phone: input.phone ?? null } : {}),
        ...(input.email !== undefined ? { email: input.email ?? null } : {}),
        ...(input.address !== undefined ? { address: input.address ?? null } : {}),
        ...(input.city !== undefined ? { city: input.city ?? null } : {}),
        ...(input.state !== undefined ? { state: input.state ?? null } : {}),
        ...(input.jobType !== undefined ? { jobType: input.jobType ?? null } : {}),
        ...(input.description !== undefined ? { description: input.description ?? null } : {}),
        ...(input.budgetRange !== undefined ? { budgetRange: input.budgetRange ?? null } : {}),
        ...(input.urgency !== undefined ? { urgency: input.urgency ?? null } : {}),
        ...(input.status !== undefined ? { status: input.status } : {}),
        ...(input.notes !== undefined ? { notes: input.notes ?? null } : {}),
        ...(input.nextAction !== undefined ? { nextAction: input.nextAction ?? null } : {}),
        ...(input.nextActionAt !== undefined ? { nextActionAt: input.nextActionAt ? new Date(input.nextActionAt) : null } : {}),
        ...(input.jobId !== undefined ? { jobId: input.jobId ?? null } : {}),
        ...(input.projectId !== undefined ? { projectId: input.projectId ?? null } : {}),
        ...(input.source !== undefined ? { source: input.source ?? null } : {}),
      },
    });
    return toView(updated as LeadRow);
  }

  async deleteLead(id: string, tenantId: string) {
    await this.getLead(id, tenantId);
    await this.prisma.contractorLead.delete({ where: { id } });
  }

  async getStats(tenantId: string, orgId?: string) {
    const where = { tenantId, ...(orgId ? { orgId } : {}) };
    const [total, byStatus] = await Promise.all([
      this.prisma.contractorLead.count({ where }),
      this.prisma.contractorLead.groupBy({
        by: ["status"],
        where,
        _count: { id: true },
      }),
    ]);
    const statusCounts = Object.fromEntries(
      byStatus.map((r: { status: string; _count: { id: number } }) => [r.status, r._count.id]),
    );
    return {
      total,
      new: statusCounts["new"] ?? 0,
      contacted: statusCounts["contacted"] ?? 0,
      estimate_sent: statusCounts["estimate_sent"] ?? 0,
      estimate_approved: statusCounts["estimate_approved"] ?? 0,
      in_progress: statusCounts["in_progress"] ?? 0,
      completed: statusCounts["completed"] ?? 0,
      lost: statusCounts["lost"] ?? 0,
    };
  }
}
