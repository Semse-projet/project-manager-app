import { Body, Controller, Get, Optional, Param, Patch, Post, Req } from "@nestjs/common";
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

@Controller()
export class MilestonesController {
  constructor(
    private readonly milestonesService: MilestonesService,
    private readonly milestonesRepository: MilestonesRepository,
    @Optional() private readonly intelligenceAgent?: BuildOpsIntelligenceAgent,
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
    @Body() body: { status: "submitted" | "approved" | "rejected"; evidenceId?: string; reviewNote?: string },
  ) {
    const actor = resolveRequestContext(req);
    const requestId = resolveRequestId(req.headers ?? {});
    const item = await this.milestonesRepository.updateEvidenceItemStatus({
      milestoneId,
      itemId,
      status:      body.status,
      evidenceId:  body.evidenceId,
      reviewNote:  body.reviewNote,
      reviewedById: actor.userId,
    });

    void this.intelligenceAgent?.evaluateMilestone({
      tenantId: actor.tenantId,
      milestoneId,
      triggerEvent: `evidence_item.${body.status}`,
    }).catch(() => undefined);

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
}
