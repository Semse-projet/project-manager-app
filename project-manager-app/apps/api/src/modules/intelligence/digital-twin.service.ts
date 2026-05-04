import { Injectable, Logger, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../../infrastructure/prisma/prisma.service.js";

export type DigitalTwinRecord = {
  id: string;
  tenantId: string;
  projectId: string;
  jobId: string | null;
  archivedAt: string;
  archivedBy: string;
  status: string;
  snapshotJson: Record<string, unknown>;
  financialJson: Record<string, unknown>;
  milestonesJson: unknown[];
  contractorId: string | null;
  contractorOrgId: string | null;
  clientOrgId: string | null;
  totalValue: number | null;
  durationDays: number | null;
  milestoneCount: number;
  evidenceCount: number;
  disputeCount: number;
  pdfUrl: string | null;
};

function toNum(v: unknown): number {
  return typeof v === "number" ? v : parseFloat(String(v ?? 0)) || 0;
}

@Injectable()
export class DigitalTwinService {
  private readonly logger = new Logger(DigitalTwinService.name);

  constructor(private readonly prisma: PrismaService) {}

  async buildArchive(input: {
    tenantId: string;
    projectId: string;
    archivedBy: string;
  }): Promise<DigitalTwinRecord> {
    // Load all project data in parallel
    const [project, milestones, evidences, disputes, escrow, invoices, expenses] = await Promise.all([
      this.prisma.project.findUnique({
        where: { id: input.projectId },
        include: {
          job: {
            include: {
              ratings: { select: { score: true, comment: true, fromUserId: true, createdAt: true } },
              bids: { where: { status: "ACCEPTED" }, select: { proOrgId: true, amount: true } },
            },
          },
          assignedProOrg: { select: { id: true, name: true, type: true } },
        },
      }),
      this.prisma.milestone.findMany({
        where: { projectId: input.projectId },
        include: { reviews: { select: { decision: true, comment: true, createdAt: true } } },
        orderBy: { sequence: "asc" },
      }),
      this.prisma.evidence.findMany({
        where: { projectId: input.projectId },
        select: { id: true, validationStatus: true, createdAt: true, bucketKey: true },
      }),
      this.prisma.dispute.findMany({
        where: { projectId: input.projectId },
        select: { id: true, status: true, reason: true, createdAt: true, resolvedAt: true },
      }),
      this.prisma.paymentEscrow.findUnique({
        where: { projectId: input.projectId },
        include: { transactions: { select: { type: true, amount: true, status: true, createdAt: true } } },
      }),
      this.prisma.invoice.findMany({
        where: { projectId: input.projectId },
        select: { id: true, number: true, status: true, total: true, paidAt: true, sentAt: true },
      }),
      this.prisma.projectExpense.findMany({
        where: { projectId: input.projectId, status: { not: "rejected" } },
        select: { category: true, amount: true, vendor: true, description: true },
      }),
    ]);

    if (!project) throw new NotFoundException(`Project '${input.projectId}' not found`);

    const startDate = project.startAt ?? project.createdAt;
    const endDate = new Date();
    const durationDays = Math.floor((endDate.getTime() - new Date(startDate).getTime()) / (1000 * 60 * 60 * 24));

    const escrowTotal = toNum(escrow?.totalAmount);
    const invoiceTotal = invoices.reduce((s: number, i: { total: unknown }) => s + toNum(i.total), 0);
    const expenseTotal = expenses.reduce((s: number, e: { amount: unknown }) => s + toNum(e.amount), 0);
    const totalValue = Math.max(escrowTotal, invoiceTotal);

    type MRow = { approvedAt: Date | null; dueAt: Date | null; status: string };
    const onTimeMilestones = milestones.filter((m: MRow) => m.approvedAt && m.dueAt
      ? new Date(m.approvedAt) <= new Date(m.dueAt)
      : m.status === "APPROVED").length;

    const snapshotJson: Record<string, unknown> = {
      project: {
        id: project.id,
        status: project.status,
        startAt: project.startAt,
        dueAt: project.dueAt,
        createdAt: project.createdAt,
      },
      job: {
        id: project.job.id,
        title: project.job.title,
        scope: project.job.scope,
        category: project.job.category,
        status: project.job.status,
        budgetMin: toNum(project.job.budgetMin), budgetMax: toNum(project.job.budgetMax),
        clientOrgId: project.job.clientOrgId,
      },
      contractor: {
        orgId: project.assignedProOrgId,
        orgName: project.assignedProOrg.name,
      },
      stats: {
        durationDays,
        milestoneCount: milestones.length,
        milestonesApproved: milestones.filter((m: MRow) => m.status === "APPROVED").length,
        onTimeMilestones,
        onTimeRate: milestones.length > 0 ? onTimeMilestones / milestones.length : 0,
        evidenceCount: evidences.length,
        disputeCount: disputes.length,
        disputeResolved: disputes.filter((d: { status: string }) => d.status === "RESOLVED").length,
      },
      ratings: project.job.ratings,
      archivedAt: new Date().toISOString(),
      archivedBy: input.archivedBy,
    };

    const financialJson: Record<string, unknown> = {
      escrow: escrow ? {
        totalAmount: escrowTotal,
        status: escrow.status,
        transactions: escrow.transactions.map((t: { type: string; amount: unknown; status: string }) => ({ type: t.type, amount: toNum(t.amount), status: t.status })),
      } : null,
      invoices: invoices.map((i: { number: string; status: string; total: unknown }) => ({ number: i.number, status: i.status, total: toNum(i.total) })),
      expenses: {
        total: expenseTotal,
        byCategory: expenses.reduce((acc: Record<string, number>, e: { category: string; amount: unknown }) => {
          acc[e.category] = (acc[e.category] ?? 0) + toNum(e.amount);
          return acc;
        }, {}),
      },
      summary: {
        totalValue,
        invoiceTotal,
        expenseTotal,
        grossMargin: invoiceTotal > 0 ? parseFloat(((invoiceTotal - expenseTotal) / invoiceTotal * 100).toFixed(2)) : null,
      },
    };

    type MilestoneRow = MRow & { id: string; title: string; sequence: number; amount: unknown; reviews: unknown[] };
    const milestonesJson = milestones.map((m: MilestoneRow) => ({
      id: m.id,
      title: m.title,
      sequence: m.sequence,
      amount: toNum(m.amount),
      status: m.status,
      approvedAt: m.approvedAt,
      dueAt: m.dueAt,
      onTime: m.approvedAt && m.dueAt ? new Date(m.approvedAt) <= new Date(m.dueAt) : null,
      reviews: m.reviews,
    }));

    const existing = await this.prisma.projectArchive.findUnique({ where: { projectId: input.projectId } });
    const data = {
      tenantId: input.tenantId,
      projectId: input.projectId,
      jobId: project.jobId,
      archivedBy: input.archivedBy,
      status: "complete",
      snapshotJson,
      financialJson,
      milestonesJson,
      contractorId: null,
      contractorOrgId: project.assignedProOrgId,
      clientOrgId: project.job.clientOrgId,
      totalValue,
      durationDays,
      milestoneCount: milestones.length,
      evidenceCount: evidences.length,
      disputeCount: disputes.length,
    };

    const archive = existing
      ? await this.prisma.projectArchive.update({ where: { projectId: input.projectId }, data })
      : await this.prisma.projectArchive.create({ data });

    this.logger.log(`[twin] archived project=${input.projectId} milestones=${milestones.length} value=${totalValue}`);
    return this.toRecord(archive);
  }

  async getArchive(projectId: string, tenantId: string): Promise<DigitalTwinRecord | null> {
    const row = await this.prisma.projectArchive.findFirst({
      where: { projectId, tenantId },
    });
    return row ? this.toRecord(row) : null;
  }

  async listArchives(tenantId: string, limit = 20): Promise<DigitalTwinRecord[]> {
    const rows = await this.prisma.projectArchive.findMany({
      where: { tenantId },
      orderBy: { archivedAt: "desc" },
      take: limit,
    });
    return rows.map((r: Record<string, unknown>) => this.toRecord(r));
  }

  private toRecord(row: Record<string, unknown>): DigitalTwinRecord {
    return {
      id: String(row.id),
      tenantId: String(row.tenantId),
      projectId: String(row.projectId),
      jobId: row.jobId ? String(row.jobId) : null,
      archivedAt: new Date(String(row.archivedAt)).toISOString(),
      archivedBy: String(row.archivedBy),
      status: String(row.status),
      snapshotJson: (row.snapshotJson as Record<string, unknown>) ?? {},
      financialJson: (row.financialJson as Record<string, unknown>) ?? {},
      milestonesJson: (row.milestonesJson as unknown[]) ?? [],
      contractorId: row.contractorId ? String(row.contractorId) : null,
      contractorOrgId: row.contractorOrgId ? String(row.contractorOrgId) : null,
      clientOrgId: row.clientOrgId ? String(row.clientOrgId) : null,
      totalValue: row.totalValue != null ? toNum(row.totalValue) : null,
      durationDays: row.durationDays != null ? Number(row.durationDays) : null,
      milestoneCount: Number(row.milestoneCount ?? 0),
      evidenceCount: Number(row.evidenceCount ?? 0),
      disputeCount: Number(row.disputeCount ?? 0),
      pdfUrl: row.pdfUrl ? String(row.pdfUrl) : null,
    };
  }
}
