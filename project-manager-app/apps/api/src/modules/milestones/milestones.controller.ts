import { Body, Controller, Get, Optional, Param, Patch, Post, Query, Req } from "@nestjs/common";
import {
  milestoneCreateSchema,
  milestoneReasonSchema
} from "@semse/schemas";
import { ok } from "../../common/api-response.js";
import { toVisibleMilestone } from "../../common/visible-response.js";
import { RequirePermissions } from "../../common/permissions.decorator.js";
import { resolveRequestContext } from "../../common/request-context.js";
import { resolveRequestId } from "../../common/request-id.js";
import { parseWithSchema } from "../../common/zod-validation.js";
import { MilestonesService } from "./milestones.service.js";
import { MilestonesRepository } from "./milestones.repository.js";
import { BuildOpsIntelligenceAgent } from "../operational-intelligence/buildops-intelligence.agent.js";
import { PaymentGovernanceService } from "../payments/payment-governance.service.js";
import { EvidenceReviewService } from "../operational-intelligence/evidence-review.service.js";
import { SseEventBusService } from "../../infrastructure/sse/sse-event-bus.service.js";

@Controller()
export class MilestonesController {
  constructor(
    private readonly milestonesService: MilestonesService,
    private readonly milestonesRepository: MilestonesRepository,
    @Optional() private readonly intelligenceAgent?: BuildOpsIntelligenceAgent,
    @Optional() private readonly paymentGovernance?: PaymentGovernanceService,
    @Optional() private readonly evidenceReview?: EvidenceReviewService,
    @Optional() private readonly sse?: SseEventBusService,
  ) {}

  @Post("v1/projects/:projectId/milestones")
  @RequirePermissions("milestones:create")
  async create(
    @Req() req: { headers?: Record<string, unknown> },
    @Param("projectId") projectId: string,
    @Body() body: unknown
  ) {
    const parsed = parseWithSchema(milestoneCreateSchema, body);
    const actor = resolveRequestContext(req);
    const requestId = resolveRequestId(req.headers ?? {});
    const milestone = await this.milestonesService.create({
      tenantId: actor.tenantId,
      projectId,
      title: parsed.title,
      amount: parsed.amount,
      sequence: parsed.sequence,
      userId: actor.userId,
      orgId: actor.orgId,
      roles: actor.roles,
      requestId
    });

    return ok(requestId, toVisibleMilestone(milestone));
  }

  @Post("v1/jobs/:jobId/milestones")
  @RequirePermissions("milestones:create")
  async createByJob(
    @Req() req: { headers?: Record<string, unknown> },
    @Param("jobId") jobId: string,
    @Body() body: unknown
  ) {
    const parsed = parseWithSchema(milestoneCreateSchema, body);
    const actor = resolveRequestContext(req);
    const requestId = resolveRequestId(req.headers ?? {});
    const milestone = await this.milestonesService.createByJob({
      tenantId: actor.tenantId,
      jobId,
      title: parsed.title,
      amount: parsed.amount,
      sequence: parsed.sequence,
      userId: actor.userId,
      orgId: actor.orgId,
      roles: actor.roles,
      requestId
    });

    return ok(requestId, toVisibleMilestone(milestone));
  }

  @Get("v1/jobs/:jobId/milestones")
  @RequirePermissions("milestones:read")
  async listByJob(@Req() req: { headers?: Record<string, unknown> }, @Param("jobId") jobId: string) {
    const actor = resolveRequestContext(req);
    const milestones = await this.milestonesService.listByJob({
      tenantId: actor.tenantId,
      jobId,
      userId: actor.userId,
      orgId: actor.orgId,
      roles: actor.roles
    });
    return ok(resolveRequestId(req.headers ?? {}), milestones.map((item) => toVisibleMilestone(item)));
  }

  @Post("v1/milestones/:milestoneId/submit")
  @RequirePermissions("milestones:submit")
  async submit(@Req() req: { headers?: Record<string, unknown> }, @Param("milestoneId") milestoneId: string) {
    const actor = resolveRequestContext(req);
    const requestId = resolveRequestId(req.headers ?? {});
    const milestone = await this.milestonesService.submit({
      tenantId: actor.tenantId,
      milestoneId,
      userId: actor.userId,
      orgId: actor.orgId,
      roles: actor.roles,
      requestId
    });
    return ok(requestId, toVisibleMilestone(milestone));
  }

  @Post("v1/milestones/:milestoneId/approve")
  @RequirePermissions("milestones:approve")
  async approve(@Req() req: { headers?: Record<string, unknown> }, @Param("milestoneId") milestoneId: string) {
    const actor = resolveRequestContext(req);
    const requestId = resolveRequestId(req.headers ?? {});
    const milestone = await this.milestonesService.approve({
      tenantId: actor.tenantId,
      milestoneId,
      userId: actor.userId,
      orgId: actor.orgId,
      roles: actor.roles,
      requestId
    });
    return ok(requestId, toVisibleMilestone(milestone));
  }

  @Post("v1/milestones/:milestoneId/reject")
  @RequirePermissions("milestones:reject")
  async reject(
    @Req() req: { headers?: Record<string, unknown> },
    @Param("milestoneId") milestoneId: string,
    @Body() body: unknown
  ) {
    const parsed = parseWithSchema(milestoneReasonSchema, body);
    const actor = resolveRequestContext(req);
    const requestId = resolveRequestId(req.headers ?? {});
    const milestone = await this.milestonesService.reject({
      tenantId: actor.tenantId,
      milestoneId,
      reason: parsed.reason,
      userId: actor.userId,
      orgId: actor.orgId,
      roles: actor.roles,
      requestId
    });
    return ok(requestId, toVisibleMilestone(milestone));
  }

  @Post("v1/milestones/:milestoneId/request-changes")
  @RequirePermissions("milestones:reject")
  async requestChanges(
    @Req() req: { headers?: Record<string, unknown> },
    @Param("milestoneId") milestoneId: string,
    @Body() body: unknown
  ) {
    const parsed = parseWithSchema(milestoneReasonSchema, body);
    const actor = resolveRequestContext(req);
    const requestId = resolveRequestId(req.headers ?? {});
    const milestone = await this.milestonesService.requestChanges({
      tenantId: actor.tenantId,
      milestoneId,
      reason: parsed.reason,
      userId: actor.userId,
      orgId: actor.orgId,
      roles: actor.roles,
      requestId
    });
    return ok(requestId, toVisibleMilestone(milestone));
  }

  // ── Evidence Items ──────────────────────────────────────────────────────────

  @Get("v1/milestones/:milestoneId/evidence-items")
  @RequirePermissions("milestones:read")
  async listEvidenceItems(
    @Req() req: { headers?: Record<string, unknown> },
    @Param("milestoneId") milestoneId: string,
  ) {
    const requestId = resolveRequestId(req.headers ?? {});
    const items = await this.milestonesRepository.listEvidenceItems(milestoneId);
    return ok(requestId, items);
  }

  @Post("v1/milestones/:milestoneId/evidence-items/seed")
  @RequirePermissions("milestones:create")
  async seedEvidenceItems(
    @Req() req: { headers?: Record<string, unknown> },
    @Param("milestoneId") milestoneId: string,
    @Body() body: { items: Array<{ label: string; description?: string; kind?: string; phase?: string; required?: boolean }> },
  ) {
    const requestId = resolveRequestId(req.headers ?? {});
    await this.milestonesRepository.seedEvidenceItems(milestoneId, body.items as Parameters<typeof this.milestonesRepository.seedEvidenceItems>[1]);
    const items = await this.milestonesRepository.listEvidenceItems(milestoneId);
    return ok(requestId, items);
  }

  @Patch("v1/milestones/:milestoneId/evidence-items/:itemId")
  @RequirePermissions("milestones:approve")
  async updateEvidenceItem(
    @Req() req: { headers?: Record<string, unknown> },
    @Param("milestoneId") milestoneId: string,
    @Param("itemId") itemId: string,
    @Body() body: {
      status: "submitted" | "approved" | "rejected" | "needs_reupload" | "missing";
      evidenceId?: string;
      reviewNote?: string;
      auditReason?: string;  // plain-text reason for rejection/reupload (required for rejected/needs_reupload)
    },
  ) {
    const { BadRequestException } = await import("@nestjs/common");
    const requiresReason = body.status === "rejected" || body.status === "needs_reupload";
    if (requiresReason && !body.reviewNote?.trim() && !body.auditReason?.trim()) {
      throw new BadRequestException("auditReason or reviewNote is required when rejecting or requesting reupload");
    }

    const actor = resolveRequestContext(req);
    const requestId = resolveRequestId(req.headers ?? {});
    const item = await this.milestonesRepository.updateEvidenceItemStatus({
      milestoneId,
      itemId,
      status:       body.status,
      evidenceId:   body.evidenceId,
      reviewNote:   body.reviewNote,
      auditReason:  body.auditReason,
      reviewedById: actor.userId,
    });

    void this.intelligenceAgent?.evaluateMilestone({
      tenantId: actor.tenantId,
      milestoneId,
      triggerEvent: `evidence_item.${body.status}`,
    }).catch(() => undefined);

    // SSE: notify frontend that evidence item changed → triggers governance refresh
    this.sse?.emit(`buildops:${actor.tenantId}`, "evidence-item:updated", {
      milestoneId,
      itemId,
      status: body.status,
      updatedAt: new Date().toISOString(),
    });

    return ok(requestId, item);
  }

  // ── Payment Readiness ────────────────────────────────────────────────────────

  @Get("v1/milestones/:milestoneId/payment-readiness")
  @RequirePermissions("milestones:read")
  async getPaymentReadiness(
    @Req() req: { headers?: Record<string, unknown> },
    @Param("milestoneId") milestoneId: string,
  ) {
    const actor = resolveRequestContext(req);
    const requestId = resolveRequestId(req.headers ?? {});
    const result = await this.milestonesRepository.computePaymentReadiness(milestoneId, actor.tenantId);
    return ok(requestId, result);
  }

  // ── Readiness summary (P1 — SEMSE se siente vivo) ───────────────────────────

  @Get("v1/milestones/:milestoneId/readiness")
  @RequirePermissions("milestones:read")
  async getReadiness(
    @Req() req: { headers?: Record<string, unknown> },
    @Param("milestoneId") milestoneId: string,
  ) {
    const actor = resolveRequestContext(req);
    const requestId = resolveRequestId(req.headers ?? {});

    // computePaymentReadiness already loads milestone + evidenceItems + disputes
    const readiness = await this.milestonesRepository.computePaymentReadiness(milestoneId, actor.tenantId);
    const ms = readiness.milestone;

    if (!ms) {
      const { NotFoundException } = await import("@nestjs/common");
      throw new NotFoundException("Milestone not found");
    }

    // evidenceReadiness from milestone field (string enum)
    const evidenceReadiness = ms.evidenceReadiness ?? "unknown";
    const paymentStatus = readiness.status;

    let risk: "low" | "medium" | "high" = "low";
    if (paymentStatus === "disputed" || readiness.blockers.length > 1) risk = "high";
    else if (paymentStatus === "not_ready" || readiness.blockers.length > 0) risk = "medium";

    return ok(requestId, {
      milestoneId,
      status:           ms.status,
      evidenceReadiness,
      paymentReadiness: paymentStatus,
      blockers:         readiness.blockers,
      reasons:          readiness.reasons,
      risk,
      nextAction:       readiness.nextAction,
      generatedAt:      new Date().toISOString(),
    });
  }

  @Get("v1/milestones/:milestoneId/vision-summary")
  @RequirePermissions("milestones:read")
  async getVisionSummary(
    @Req() req: { headers?: Record<string, unknown> },
    @Param("milestoneId") milestoneId: string,
  ) {
    const actor = resolveRequestContext(req);
    const requestId = resolveRequestId(req.headers ?? {});
    const summary = await this.milestonesRepository.getVisionSummary(milestoneId, actor.tenantId);
    return ok(requestId, summary);
  }

  // ── P2 — Payment release governance ─────────────────────────────────────────

  // ── Evidence CRUD advanced (Fase 1) ─────────────────────────────────────────

  @Get("v1/milestones/:milestoneId/evidence-items/:itemId")
  @RequirePermissions("milestones:read")
  async getEvidenceItemDetail(
    @Req() req: { headers?: Record<string, unknown> },
    @Param("milestoneId") milestoneId: string,
    @Param("itemId") itemId: string,
  ) {
    const actor = resolveRequestContext(req);
    const requestId = resolveRequestId(req.headers ?? {});
    const detail = await this.milestonesRepository.getEvidenceItemDetail(milestoneId, itemId, actor.tenantId);
    if (!detail) {
      const { NotFoundException } = await import("@nestjs/common");
      throw new NotFoundException("Evidence item not found");
    }
    return ok(requestId, detail);
  }

  @Get("v1/milestones/:milestoneId/evidence-items/:itemId/history")
  @RequirePermissions("milestones:read")
  async getEvidenceItemHistory(
    @Req() req: { headers?: Record<string, unknown> },
    @Param("milestoneId") _milestoneId: string,
    @Param("itemId") itemId: string,
    @Query("limit") limit?: string,
    @Query("cursor") cursor?: string,
  ) {
    const actor = resolveRequestContext(req);
    const requestId = resolveRequestId(req.headers ?? {});
    const result = await this.milestonesRepository.getEvidenceItemHistory(itemId, actor.tenantId, {
      limit: limit ? Number(limit) : 20,
      cursor: cursor ?? undefined,
    });
    return ok(requestId, result);
  }

  @Post("v1/milestones/:milestoneId/evidence-items/:itemId/archive")
  @RequirePermissions("milestones:approve")
  async archiveEvidenceItem(
    @Req() req: { headers?: Record<string, unknown> },
    @Param("milestoneId") milestoneId: string,
    @Param("itemId") itemId: string,
    @Body() body: { archiveReason: string },
  ) {
    const actor = resolveRequestContext(req);
    const requestId = resolveRequestId(req.headers ?? {});

    if (!body.archiveReason?.trim()) {
      const { BadRequestException } = await import("@nestjs/common");
      throw new BadRequestException("archiveReason is required to archive evidence");
    }

    const result = await this.milestonesRepository.archiveEvidenceItem({
      milestoneId,
      itemId,
      tenantId:      actor.tenantId,
      archiveReason: body.archiveReason.trim(),
      actorUserId:   actor.userId,
    });

    if (!result) {
      const { NotFoundException } = await import("@nestjs/common");
      throw new NotFoundException("Evidence item not found");
    }

    // Re-evaluate milestone intelligence (governance may need to block)
    void this.intelligenceAgent?.evaluateMilestone({
      tenantId: actor.tenantId, milestoneId, triggerEvent: "evidence_item.archived",
    }).catch(() => undefined);

    // SSE
    this.sse?.emit(`buildops:${actor.tenantId}`, "evidence-item:archived", {
      milestoneId, itemId, status: "archived", previousStatus: result.previousStatus, archived: true,
    });
    this.sse?.emit(`buildops:${actor.tenantId}`, "evidence-item:updated", {
      milestoneId, itemId, status: "archived", updatedAt: new Date().toISOString(),
    });

    return ok(requestId, {
      evidenceItemId:               itemId,
      status:                       "archived",
      previousStatus:               result.previousStatus,
      archived:                     true,
      governanceRefreshRecommended: true,
    });
  }

  @Post("v1/milestones/:milestoneId/evidence-items/:itemId/replace")
  @RequirePermissions("milestones:write")
  async replaceEvidenceItem(
    @Req() req: { headers?: Record<string, unknown> },
    @Param("milestoneId") milestoneId: string,
    @Param("itemId") itemId: string,
    @Body() body: { evidenceId: string; replacedReason: string },
  ) {
    const actor = resolveRequestContext(req);
    const requestId = resolveRequestId(req.headers ?? {});

    if (!body.evidenceId?.trim()) {
      const { BadRequestException } = await import("@nestjs/common");
      throw new BadRequestException("evidenceId is required");
    }
    if (!body.replacedReason?.trim()) {
      const { BadRequestException } = await import("@nestjs/common");
      throw new BadRequestException("replacedReason is required for evidence replacement");
    }

    const result = await this.milestonesRepository.replaceEvidenceItem({
      milestoneId,
      itemId,
      tenantId:       actor.tenantId,
      newEvidenceId:  body.evidenceId.trim(),
      replacedReason: body.replacedReason.trim(),
      actorUserId:    actor.userId,
    });

    if (!result) {
      const { NotFoundException } = await import("@nestjs/common");
      throw new NotFoundException("Evidence item not found");
    }

    // Re-evaluate milestone intelligence
    void this.intelligenceAgent?.evaluateMilestone({
      tenantId: actor.tenantId, milestoneId, triggerEvent: "evidence_item.replaced",
    }).catch(() => undefined);

    // SSE: notify frontend
    this.sse?.emit(`buildops:${actor.tenantId}`, "evidence-item:replaced", {
      milestoneId,
      itemId,
      status:         "submitted",
      previousStatus: result.previousStatus,
      replaced:       true,
      updatedAt:      new Date().toISOString(),
    });
    this.sse?.emit(`buildops:${actor.tenantId}`, "evidence-item:updated", {
      milestoneId, itemId, status: "submitted", updatedAt: new Date().toISOString(),
    });

    return ok(requestId, {
      evidenceItemId:            result.updated.id,
      status:                    result.updated.status,
      previousStatus:            result.previousStatus,
      replaced:                  true,
      governanceRefreshRecommended: true,
    });
  }

  // ── P3 — Evidence review agent ───────────────────────────────────────────────

  @Post("v1/milestones/:milestoneId/evidence-items/:itemId/run-review-agent")
  @RequirePermissions("milestones:write")
  async runEvidenceReviewAgent(
    @Req() req: { headers?: Record<string, unknown> },
    @Param("milestoneId") _milestoneId: string,
    @Param("itemId") itemId: string,
    @Body() body: { locale?: "es" | "en"; forceRulesOnly?: boolean } = {},
  ) {
    const actor = resolveRequestContext(req);
    const requestId = resolveRequestId(req.headers ?? {});

    if (!this.evidenceReview) {
      const { ServiceUnavailableException } = await import("@nestjs/common");
      throw new ServiceUnavailableException("Evidence review agent not available");
    }

    const result = await this.evidenceReview.runReview({
      evidenceItemId: itemId,
      tenantId:       actor.tenantId,
      reviewedById:   actor.userId,
      locale:         body.locale ?? "es",
      forceRulesOnly: body.forceRulesOnly,
    });

    return ok(requestId, result);
  }

  @Get("v1/milestones/:milestoneId/evidence-items/:itemId/review")
  @RequirePermissions("milestones:read")
  async getEvidenceReview(
    @Req() req: { headers?: Record<string, unknown> },
    @Param("milestoneId") _milestoneId: string,
    @Param("itemId") itemId: string,
  ) {
    const actor = resolveRequestContext(req);
    const requestId = resolveRequestId(req.headers ?? {});

    const review = await this.evidenceReview?.getLastReview(itemId, actor.tenantId) ?? null;
    return ok(requestId, review);
  }

  @Get("v1/milestones/:milestoneId/payment-governance")
  @RequirePermissions("milestones:read")
  async getPaymentGovernance(
    @Req() req: { headers?: Record<string, unknown> },
    @Param("milestoneId") milestoneId: string,
  ) {
    const actor = resolveRequestContext(req);
    const requestId = resolveRequestId(req.headers ?? {});

    if (!this.paymentGovernance) {
      // Fallback to basic readiness if governance service not injected
      const readiness = await this.milestonesRepository.computePaymentReadiness(milestoneId, actor.tenantId);
      return ok(requestId, {
        milestoneId,
        releaseStatus: readiness.status === "ready_to_release" ? "ready" : readiness.status,
        canRelease: readiness.status === "ready_to_release",
        blockers: readiness.blockers,
        nextBestAction: readiness.nextAction,
        governedAt: new Date().toISOString(),
      });
    }

    const result = await this.paymentGovernance.evaluate(milestoneId, actor.tenantId);
    return ok(requestId, result);
  }
}
