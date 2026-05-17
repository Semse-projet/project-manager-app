import { BadRequestException, Injectable, Logger, NotFoundException, Optional } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { PrismaService } from "../../infrastructure/prisma/prisma.service.js";
import { SseEventBusService } from "../../infrastructure/sse/sse-event-bus.service.js";
import { OperationalSignalsService } from "../operational-intelligence/operational-signals.service.js";

type ActorContext = {
  tenantId: string;
  userId: string;
  orgId: string;
  roles: string[];
};

type CreateChangeOrderInput = {
  buildOpsProjectId?: string;
  jobId?: string;
  milestoneId?: string;
  algorithmRunId?: string;
  title?: string;
  description?: string;
  trigger?: string;
  pricingMode?: string;
  estimatedMin?: number;
  estimatedMax?: number;
  probability?: number;
  evidenceJson?: unknown;
};

type ListChangeOrdersInput = {
  jobId?: string;
  buildOpsProjectId?: string;
  milestoneId?: string;
  status?: string;
  limit?: number;
};

// Lifecycle states (string enum — no migration required)
// predicted → submitted → approved → applied
//           → rejected (with reason)
//           → changes_requested (needs review before resubmit)
//           → voided (cancelled)

export type ChangeOrderStatus =
  | "predicted" | "submitted" | "approved" | "rejected"
  | "applied" | "changes_requested" | "voided";

export type ImpactResult = {
  changeOrderId:      string;
  status:             string;
  costDeltaMin:       number;
  costDeltaMax:       number;
  costDeltaAvg:       number;
  affectedMilestones: string[];
  riskLevel:          "low" | "medium" | "high" | "critical";
  paymentImpact:      "none" | "requires_approval" | "hold_required" | "already_applied";
  probability:        number | null;
  pricingMode:        string;
  auditReason:        string;
  computedAt:         string;
};

@Injectable()
export class ChangeOrdersService {
  private readonly logger = new Logger(ChangeOrdersService.name);

  constructor(
    private readonly prisma: PrismaService,
    @Optional() private readonly signals?: OperationalSignalsService,
    @Optional() private readonly sse?: SseEventBusService,
  ) {}

  private emitCOEvent(
    tenantId: string,
    eventType: "change-order:updated" | "change-order:applied",
    candidate: {
      id: string;
      status: string;
      buildOpsProjectId?: string | null;
      jobId?: string | null;
      milestoneId?: string | null;
      estimatedMin?: Prisma.Decimal | null;
      estimatedMax?: Prisma.Decimal | null;
    },
    extra: Record<string, unknown> = {},
  ): void {
    this.sse?.emit(`buildops:${tenantId}`, eventType, {
      changeOrderId:     candidate.id,
      status:            candidate.status,
      buildOpsProjectId: candidate.buildOpsProjectId ?? undefined,
      milestoneId:       candidate.milestoneId ?? undefined,
      jobId:             candidate.jobId ?? undefined,
      costDeltaAvg:      candidate.estimatedMin && candidate.estimatedMax
        ? (Number(candidate.estimatedMin) + Number(candidate.estimatedMax)) / 2
        : 0,
      ...extra,
    });
  }

  async list(actor: ActorContext, input: ListChangeOrdersInput) {
    return this.prisma.changeOrderCandidate.findMany({
      where: {
        tenantId: actor.tenantId,
        ...(input.jobId ? { jobId: input.jobId } : {}),
        ...(input.buildOpsProjectId ? { buildOpsProjectId: input.buildOpsProjectId } : {}),
        ...(input.milestoneId ? { milestoneId: input.milestoneId } : {}),
        ...(input.status ? { status: input.status } : {}),
      },
      orderBy: { createdAt: "desc" },
      take: Math.min(Math.max(input.limit ?? 50, 1), 200),
    });
  }

  async create(actor: ActorContext, input: CreateChangeOrderInput) {
    if (!input.title?.trim()) {
      throw new BadRequestException("Change order title is required");
    }
    if (!input.trigger?.trim()) {
      throw new BadRequestException("Change order trigger is required");
    }
    if (!input.jobId && !input.buildOpsProjectId && !input.milestoneId) {
      throw new BadRequestException("Change order must be linked to a job, BuildOps project, or milestone");
    }

    return this.prisma.changeOrderCandidate.create({
      data: {
        id: `co_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
        tenantId: actor.tenantId,
        buildOpsProjectId: input.buildOpsProjectId ?? null,
        jobId: input.jobId ?? null,
        milestoneId: input.milestoneId ?? null,
        algorithmRunId: input.algorithmRunId ?? null,
        title: input.title.trim(),
        description: input.description?.trim() || null,
        trigger: input.trigger.trim(),
        pricingMode: input.pricingMode?.trim() || "time_and_materials",
        estimatedMin: typeof input.estimatedMin === "number" ? new Prisma.Decimal(input.estimatedMin) : null,
        estimatedMax: typeof input.estimatedMax === "number" ? new Prisma.Decimal(input.estimatedMax) : null,
        probability: typeof input.probability === "number" ? Math.max(0, Math.min(100, Math.round(input.probability))) : null,
        evidenceJson: input.evidenceJson === undefined ? Prisma.JsonNull : input.evidenceJson as Prisma.InputJsonValue,
        status: "predicted",
      },
    });
  }

  async submit(actor: ActorContext, id: string) {
    const candidate = await this.findOwned(actor, id);
    if (!["predicted", "rejected"].includes(candidate.status)) {
      throw new BadRequestException(`Cannot submit change order while status is ${candidate.status}`);
    }
    const updated = await this.prisma.changeOrderCandidate.update({
      where: { id },
      data: { status: "submitted", submittedById: actor.userId, submittedAt: new Date() },
    });
    this.emitCOEvent(actor.tenantId, "change-order:updated", updated);
    return updated;
  }

  async approve(actor: ActorContext, id: string, clientNote?: string) {
    const candidate = await this.findOwned(actor, id);
    if (candidate.status !== "submitted") {
      throw new BadRequestException("Only submitted change orders can be approved");
    }
    const updated = await this.prisma.changeOrderCandidate.update({
      where: { id },
      data: { status: "approved", reviewedById: actor.userId, reviewedAt: new Date(), clientNote: clientNote?.trim() || null },
    });
    this.emitCOEvent(actor.tenantId, "change-order:updated", updated);
    return updated;
  }

  async reject(actor: ActorContext, id: string, clientNote?: string) {
    const candidate = await this.findOwned(actor, id);
    if (!["submitted", "predicted"].includes(candidate.status)) {
      throw new BadRequestException(`Cannot reject change order while status is ${candidate.status}`);
    }
    if (!clientNote?.trim()) {
      throw new BadRequestException("Rejection note is required");
    }
    const updated = await this.prisma.changeOrderCandidate.update({
      where: { id },
      data: { status: "rejected", reviewedById: actor.userId, reviewedAt: new Date(), clientNote: clientNote!.trim() },
    });
    this.emitCOEvent(actor.tenantId, "change-order:updated", updated);
    return updated;
  }

  async findOne(actor: ActorContext, id: string) {
    return this.findOwned(actor, id);
  }

  async requestChanges(actor: ActorContext, id: string, input: { requiredActions: string[]; note?: string }) {
    const candidate = await this.findOwned(actor, id);
    if (!["submitted", "predicted"].includes(candidate.status)) {
      throw new BadRequestException(`Cannot request changes on change order with status '${candidate.status}'`);
    }
    if (!input.requiredActions?.length) {
      throw new BadRequestException("requiredActions must not be empty");
    }
    const updated = await this.prisma.changeOrderCandidate.update({
      where: { id },
      data: {
        status: "changes_requested",
        reviewedById: actor.userId,
        reviewedAt:   new Date(),
        clientNote:   input.note?.trim() || null,
        evidenceJson: { requiredActions: input.requiredActions, changesRequestedAt: new Date().toISOString() } as Prisma.InputJsonValue,
      },
    });
    this.emitCOEvent(actor.tenantId, "change-order:updated", updated, { requiredActions: input.requiredActions });
    return updated;
  }

  async computeImpact(actor: ActorContext, id: string): Promise<ImpactResult> {
    const candidate = await this.findOwned(actor, id);

    const costMin = Number(candidate.estimatedMin ?? 0);
    const costMax = Number(candidate.estimatedMax ?? 0);
    const costAvg = costMin > 0 || costMax > 0 ? (costMin + costMax) / 2 : 0;

    // Affected milestones
    const affectedMilestones: string[] = candidate.milestoneId ? [candidate.milestoneId] : [];

    // Risk based on cost and probability
    let riskLevel: ImpactResult["riskLevel"] = "low";
    if (costAvg > 5000 || (candidate.probability ?? 0) > 80) riskLevel = "critical";
    else if (costAvg > 2000 || (candidate.probability ?? 0) > 60) riskLevel = "high";
    else if (costAvg > 500 || (candidate.probability ?? 0) > 40) riskLevel = "medium";

    // Payment impact
    let paymentImpact: ImpactResult["paymentImpact"] = "none";
    if (candidate.status === "applied") paymentImpact = "already_applied";
    else if (["submitted", "approved", "changes_requested"].includes(candidate.status)) paymentImpact = "requires_approval";
    else if (candidate.status === "predicted" && riskLevel === "critical") paymentImpact = "hold_required";

    return {
      changeOrderId:      id,
      status:             candidate.status,
      costDeltaMin:       costMin,
      costDeltaMax:       costMax,
      costDeltaAvg:       Math.round(costAvg * 100) / 100,
      affectedMilestones,
      riskLevel,
      paymentImpact,
      probability:        candidate.probability,
      pricingMode:        candidate.pricingMode,
      auditReason:        `CO '${candidate.title}' impact computed. status=${candidate.status} costAvg=$${costAvg} risk=${riskLevel}`,
      computedAt:         new Date().toISOString(),
    };
  }

  async applyToBuildOps(actor: ActorContext, id: string): Promise<{ applied: boolean; alreadyApplied: boolean; impact: ImpactResult }> {
    const candidate = await this.findOwned(actor, id);

    // Idempotence: already applied
    if (candidate.status === "applied") {
      const impact = await this.computeImpact(actor, id);
      return { applied: false, alreadyApplied: true, impact };
    }

    if (candidate.status !== "approved") {
      throw new BadRequestException(`Only approved change orders can be applied to BuildOps (current status: ${candidate.status})`);
    }

    const impact = await this.computeImpact(actor, id);

    // Mark as applied with audit trail in evidenceJson
    const appliedAt = new Date();
    await this.prisma.changeOrderCandidate.update({
      where: { id },
      data: {
        status:       "applied",
        reviewedById: actor.userId,
        reviewedAt:   appliedAt,
        evidenceJson: {
          appliedAt:     appliedAt.toISOString(),
          appliedById:   actor.userId,
          costDeltaAvg:  impact.costDeltaAvg,
          riskLevel:     impact.riskLevel,
          affectedMilestones: impact.affectedMilestones,
        } as Prisma.InputJsonValue,
      },
    });

    // Create operational signal for tracking
    if (this.signals && candidate.tenantId) {
      await this.signals.upsertSignal({
        tenantId:         candidate.tenantId,
        type:             "CHANGE_ORDER_RECOMMENDED",
        severity:         impact.riskLevel === "critical" ? "critical" : impact.riskLevel === "high" ? "high" : "medium",
        title:            `Change order applied: ${candidate.title}`,
        message:          `Change order applied to BuildOps. Cost delta: $${impact.costDeltaAvg}. Risk: ${impact.riskLevel}.`,
        recommendedAction: "Review BuildOps project scope and update milestones as needed",
        sourceAgent:       "ChangeOrderLifecycle",
        entityType:        "ChangeOrderCandidate",
        entityId:          id,
        jobId:             candidate.jobId ?? undefined,
        buildOpsProjectId: candidate.buildOpsProjectId ?? undefined,
        milestoneId:       candidate.milestoneId ?? undefined,
        metadataJson:      { status: "applied", costDeltaAvg: impact.costDeltaAvg, riskLevel: impact.riskLevel },
      }).catch((err: Error) => {
        this.logger.warn(`[ChangeOrders] Could not create signal for applied CO: ${err.message}`);
      });
    }

    // SSE: notify all pages that the change order was applied
    const appliedCandidate = await this.findOwned(actor, id);
    this.emitCOEvent(actor.tenantId, "change-order:applied", appliedCandidate, {
      applied: true, costDeltaAvg: impact.costDeltaAvg, riskLevel: impact.riskLevel,
    });

    return { applied: true, alreadyApplied: false, impact };
  }

  private async findOwned(actor: ActorContext, id: string) {
    const candidate = await this.prisma.changeOrderCandidate.findFirst({
      where: { id, tenantId: actor.tenantId },
    });
    if (!candidate) {
      throw new NotFoundException("Change order not found");
    }
    return candidate;
  }
}
