import { Injectable, Logger, Optional } from "@nestjs/common";
import { PrismaService } from "../../infrastructure/prisma/prisma.service.js";
import type { SemseAgentsService } from "../semse-agents/semse-agents.service.js";

export type EcosystemMetrics = {
  generatedAt:   string;
  jobs: {
    total:         number;
    published:     number;
    inProgress:    number;
    completed:     number;
    byCategory:    Record<string, number>;
  };
  bids: {
    total:         number;
    submitted:     number;
    accepted:      number;
    conversionRate: number;   // accepted / total
  };
  milestones: {
    total:         number;
    approved:      number;
    pending:       number;
    completionRate: number;
  };
  evidence: {
    total:         number;
    approved:      number;
    missing:       number;
    rejected:      number;
    completionRate: number;
  };
  agents: {
    active:        number;
    totalMessages: number;
    totalErrors:   number;
    byAgent:       Array<{ name: string; active: boolean; messages: number; errors: number }>;
  };
  rag: {
    documents:    number;
    chunks:       number;
    retrievalMode: string;
  };
  signals: {
    open:          number;
    critical:      number;
    high:          number;
  };
};

@Injectable()
export class EcosystemMetricsService {
  private readonly logger = new Logger(EcosystemMetricsService.name);

  constructor(
    private readonly prisma: PrismaService,
    @Optional() private readonly semseAgents?: SemseAgentsService,
  ) {}

  async getMetrics(tenantId: string): Promise<EcosystemMetrics> {
    const [
      jobsData, bidsData, milestonesData, evidenceData, signalsData, ragData,
    ] = await Promise.all([
      this.getJobsMetrics(tenantId),
      this.getBidsMetrics(tenantId),
      this.getMilestonesMetrics(tenantId),
      this.getEvidenceMetrics(tenantId),
      this.getSignalsMetrics(tenantId),
      this.getRagMetrics(tenantId),
    ]);

    const agentStatus = this.semseAgents?.getStatus() ?? [];
    const activeAgents   = agentStatus.filter((a) => a.active).length;
    const totalMessages  = agentStatus.reduce((s, a) => s + a.processedMessages, 0);
    const totalErrors    = agentStatus.reduce((s, a) => s + a.errors, 0);

    this.logger.debug(`[EcosystemMetrics] tenantId=${tenantId} jobs=${jobsData.total}`);

    return {
      generatedAt: new Date().toISOString(),
      jobs:        jobsData,
      bids:        bidsData,
      milestones:  milestonesData,
      evidence:    evidenceData,
      agents: {
        active:        activeAgents,
        totalMessages,
        totalErrors,
        byAgent: agentStatus.map((a) => ({ name: a.name, active: a.active, messages: a.processedMessages, errors: a.errors })),
      },
      rag:     ragData,
      signals: signalsData,
    };
  }

  private async getJobsMetrics(tenantId: string) {
    const [total, published, inProgress, completed, byCategory] = await Promise.all([
      this.prisma.job.count({ where: { tenantId, deletedAt: null } }),
      this.prisma.job.count({ where: { tenantId, deletedAt: null, status: "PUBLISHED" } }),
      this.prisma.job.count({ where: { tenantId, deletedAt: null, status: { in: ["RESERVED", "ACCEPTED", "IN_PROGRESS"] as never[] } } }),
      this.prisma.job.count({ where: { tenantId, deletedAt: null, status: "COMPLETED" as never } }),
      this.prisma.job.groupBy({
        by: ["category"],
        where: { tenantId, deletedAt: null, status: "PUBLISHED" },
        _count: { id: true },
      }),
    ]);

    const byCategoryMap: Record<string, number> = {};
    for (const row of byCategory) {
      if (row.category) byCategoryMap[row.category] = row._count.id;
    }

    return { total, published, inProgress, completed, byCategory: byCategoryMap };
  }

  private async getBidsMetrics(tenantId: string) {
    const [total, submitted, accepted] = await Promise.all([
      this.prisma.bid.count({ where: { job: { tenantId } } }),
      this.prisma.bid.count({ where: { job: { tenantId }, status: "SUBMITTED" as never } }),
      this.prisma.bid.count({ where: { job: { tenantId }, status: "ACCEPTED" as never } }),
    ]);
    const conversionRate = total > 0 ? Math.round((accepted / total) * 100) : 0;
    return { total, submitted, accepted, conversionRate };
  }

  private async getMilestonesMetrics(tenantId: string) {
    const [total, approved, pending] = await Promise.all([
      this.prisma.milestone.count({ where: { project: { tenantId } } }),
      this.prisma.milestone.count({ where: { project: { tenantId }, status: "APPROVED" as never } }),
      this.prisma.milestone.count({ where: { project: { tenantId }, status: { in: ["DRAFT", "SUBMITTED", "AWAITING_REVIEW"] as never[] } } }),
    ]);
    const completionRate = total > 0 ? Math.round((approved / total) * 100) : 0;
    return { total, approved, pending, completionRate };
  }

  private async getEvidenceMetrics(tenantId: string) {
    const items = await this.prisma.milestoneEvidenceItem.findMany({
      where: { milestone: { project: { tenantId } } },
      select: { status: true },
    });
    const total    = items.length;
    const approved = items.filter((i) => i.status === "approved").length;
    const missing  = items.filter((i) => i.status === "missing").length;
    const rejected = items.filter((i) => i.status === "rejected").length;
    const completionRate = total > 0 ? Math.round((approved / total) * 100) : 0;
    return { total, approved, missing, rejected, completionRate };
  }

  private async getSignalsMetrics(tenantId: string) {
    const [open, critical, high] = await Promise.all([
      this.prisma.operationalSignal.count({ where: { tenantId, status: "open" } }),
      this.prisma.operationalSignal.count({ where: { tenantId, status: "open", severity: "critical" } }),
      this.prisma.operationalSignal.count({ where: { tenantId, status: "open", severity: "high" } }),
    ]);
    return { open, critical, high };
  }

  private async getRagMetrics(tenantId: string) {
    const docs = await this.prisma.prometeoDocument.count({ where: { tenantId } });
    const indexed = await this.prisma.prometeoDocument.findMany({
      where: { tenantId, status: "indexed" }, select: { chunkCount: true },
    });
    const chunks = indexed.reduce((s, d) => s + d.chunkCount, 0);
    const hasKey = typeof process.env.OPENAI_API_KEY === "string" && process.env.OPENAI_API_KEY.length > 10;
    return { documents: docs, chunks, retrievalMode: hasKey && chunks > 0 ? "hybrid" : "fts_fallback" };
  }
}
