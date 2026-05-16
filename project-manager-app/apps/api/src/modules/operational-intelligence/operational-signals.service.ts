import { Injectable, Logger, Optional } from "@nestjs/common";
import { PrismaService } from "../../infrastructure/prisma/prisma.service.js";
import { SseEventBusService } from "../../infrastructure/sse/sse-event-bus.service.js";

export type SignalType =
  | "EVIDENCE_GAP"
  | "PAYMENT_BLOCKED"
  | "LOW_CONFIDENCE_ESTIMATE"
  | "CHANGE_ORDER_RECOMMENDED"
  | "DISPUTE_RISK_HIGH";

export type SignalSeverity = "low" | "medium" | "high" | "critical";
export type SignalStatus = "open" | "acknowledged" | "resolved" | "dismissed";

export interface CreateSignalInput {
  tenantId: string;
  type: SignalType;
  severity: SignalSeverity;
  title: string;
  message: string;
  recommendedAction?: string;
  sourceAgent?: string;
  entityType: string;
  entityId: string;
  jobId?: string;
  buildOpsProjectId?: string;
  milestoneId?: string;
  metadataJson?: Record<string, unknown>;
}

@Injectable()
export class OperationalSignalsService {
  private readonly logger = new Logger(OperationalSignalsService.name);

  constructor(
    private readonly prisma: PrismaService,
    @Optional() private readonly sse?: SseEventBusService,
  ) {}

  async upsertSignal(input: CreateSignalInput): Promise<{ created: boolean; id: string }> {
    // Deduplication: skip if open signal with same type+entityType+entityId+milestoneId exists
    const existing = await this.prisma.operationalSignal.findFirst({
      where: {
        tenantId: input.tenantId,
        type: input.type,
        entityType: input.entityType,
        entityId: input.entityId,
        milestoneId: input.milestoneId ?? null,
        status: "open",
      },
      select: { id: true },
    });

    if (existing) {
      return { created: false, id: existing.id };
    }

    const signal = await this.prisma.operationalSignal.create({
      data: {
        tenantId: input.tenantId,
        type: input.type,
        severity: input.severity,
        title: input.title,
        message: input.message,
        recommendedAction: input.recommendedAction,
        sourceAgent: input.sourceAgent ?? "BuildOpsIntelligenceAgent",
        entityType: input.entityType,
        entityId: input.entityId,
        jobId: input.jobId,
        buildOpsProjectId: input.buildOpsProjectId,
        milestoneId: input.milestoneId,
        metadataJson: (input.metadataJson ?? {}) as object,
      },
    });

    // Emit real-time SSE notification for critical/high signals
    if (input.severity === "critical" || input.severity === "high") {
      this.sse?.emit(`mission-control:${input.tenantId}`, "operational-signal:created", {
        id: signal.id,
        type: input.type,
        severity: input.severity,
        title: input.title,
        message: input.message,
        recommendedAction: input.recommendedAction,
        buildOpsProjectId: input.buildOpsProjectId,
        milestoneId: input.milestoneId,
        createdAt: signal.createdAt.toISOString(),
      });
      this.logger.log(
        `[SSE] emitted operational-signal:created severity=${input.severity} type=${input.type} tenant=${input.tenantId}`,
      );
    }

    return { created: true, id: signal.id };
  }

  async list(filter: {
    tenantId?: string;
    status?: string;
    severity?: string;
    type?: string;
    jobId?: string;
    buildOpsProjectId?: string;
    milestoneId?: string;
    limit?: number;
  }) {
    const where: Record<string, unknown> = {};
    if (filter.tenantId) where.tenantId = filter.tenantId;
    if (filter.status) where.status = filter.status;
    if (filter.severity) where.severity = filter.severity;
    if (filter.type) where.type = filter.type;
    if (filter.jobId) where.jobId = filter.jobId;
    if (filter.buildOpsProjectId) where.buildOpsProjectId = filter.buildOpsProjectId;
    if (filter.milestoneId) where.milestoneId = filter.milestoneId;

    return this.prisma.operationalSignal.findMany({
      where,
      orderBy: [{ severity: "asc" }, { createdAt: "desc" }],
      take: filter.limit ?? 50,
    });
  }

  async acknowledge(id: string, tenantId: string): Promise<void> {
    await this.prisma.operationalSignal.updateMany({
      where: { id, tenantId },
      data: { status: "acknowledged", acknowledgedAt: new Date() },
    });
  }

  async resolve(id: string, tenantId: string): Promise<void> {
    await this.prisma.operationalSignal.updateMany({
      where: { id, tenantId },
      data: { status: "resolved", resolvedAt: new Date() },
    });
  }

  async dismiss(id: string, tenantId: string): Promise<void> {
    await this.prisma.operationalSignal.updateMany({
      where: { id, tenantId },
      data: { status: "dismissed" },
    });
  }

  async countOpen(tenantId: string): Promise<number> {
    return this.prisma.operationalSignal.count({
      where: { tenantId, status: "open" },
    });
  }
}
