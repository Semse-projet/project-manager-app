import { BadRequestException, Body, Controller, Get, Param, Post, Req } from "@nestjs/common";
import {
  assignDisputeSchema,
  createDisputeSchema,
  resolveProjectDisputeSchema,
  submitDisputeEvidenceSchema
} from "@semse/schemas";
import { ok } from "../../common/api-response.js";
import { toVisibleDispute } from "../../common/visible-response.js";
import { RequirePermissions } from "../../common/permissions.decorator.js";
import { resolveRequestContext } from "../../common/request-context.js";
import { resolveRequestId } from "../../common/request-id.js";
import { DisputesService } from "./disputes.service.js";

@Controller("v1/disputes")
export class DisputesController {
  constructor(private readonly disputesService: DisputesService) {}

  @Get()
  @RequirePermissions("disputes:read")
  async list(@Req() req: { headers?: Record<string, unknown> }) {
    const actor = resolveRequestContext(req);
    const disputes = await this.disputesService.list({
      tenantId: actor.tenantId,
      orgId: actor.orgId,
      userId: actor.userId,
      roles: actor.roles
    });
    return ok(resolveRequestId(req.headers ?? {}), disputes.map((item) => toVisibleDispute(item)));
  }

  @Post()
  @RequirePermissions("disputes:create")
  async create(@Req() req: { headers?: Record<string, unknown> }, @Body() body: Record<string, unknown>) {
    const parsed = createDisputeSchema.safeParse(body);
    if (!parsed.success) {
      throw new BadRequestException(parsed.error.flatten());
    }

    const actor = resolveRequestContext(req);
    const requestId = resolveRequestId(req.headers ?? {});
    const dispute = await this.disputesService.create({
      tenantId: actor.tenantId,
      orgId: actor.orgId,
      userId: actor.userId,
      roles: actor.roles,
      projectId: parsed.data.projectId,
      jobId: parsed.data.jobId,
      reason: parsed.data.reason,
      requestId
    });

    return ok(requestId, toVisibleDispute(dispute));
  }

  @Post(":disputeId/assign")
  @RequirePermissions("disputes:assign")
  async assign(
    @Req() req: { headers?: Record<string, unknown> },
    @Param("disputeId") disputeId: string,
    @Body() body: Record<string, unknown>
  ) {
    const parsed = assignDisputeSchema.safeParse(body);
    if (!parsed.success) {
      throw new BadRequestException(parsed.error.flatten());
    }

    const actor = resolveRequestContext(req);
    const requestId = resolveRequestId(req.headers ?? {});
    const dispute = await this.disputesService.assign({
      tenantId: actor.tenantId,
      orgId: actor.orgId,
      userId: actor.userId,
      roles: actor.roles,
      disputeId,
      assigneeUserId: parsed.data.assigneeUserId,
      requestId
    });

    return ok(requestId, toVisibleDispute(dispute));
  }

  @Post(":disputeId/submit-evidence")
  @RequirePermissions("disputes:create")
  async submitEvidence(
    @Req() req: { headers?: Record<string, unknown> },
    @Param("disputeId") disputeId: string,
    @Body() body: Record<string, unknown>
  ) {
    const parsed = submitDisputeEvidenceSchema.safeParse(body);
    if (!parsed.success) throw new BadRequestException(parsed.error.flatten());

    const actor = resolveRequestContext(req);
    const requestId = resolveRequestId(req.headers ?? {});
    const dispute = await this.disputesService.submitEvidence({
      tenantId: actor.tenantId,
      orgId: actor.orgId,
      userId: actor.userId,
      roles: actor.roles,
      disputeId,
      evidenceIds: parsed.data.evidenceIds,
      requestId
    });
    return ok(requestId, toVisibleDispute(dispute));
  }

  @Post(":disputeId/review")
  @RequirePermissions("disputes:assign")
  async markUnderReview(
    @Req() req: { headers?: Record<string, unknown> },
    @Param("disputeId") disputeId: string
  ) {
    const actor = resolveRequestContext(req);
    const requestId = resolveRequestId(req.headers ?? {});
    const dispute = await this.disputesService.markUnderReview({
      tenantId: actor.tenantId,
      orgId: actor.orgId,
      userId: actor.userId,
      roles: actor.roles,
      disputeId,
      requestId
    });
    return ok(requestId, toVisibleDispute(dispute));
  }

  @Post(":disputeId/resolve")
  @RequirePermissions("disputes:resolve")
  async resolve(
    @Req() req: { headers?: Record<string, unknown> },
    @Param("disputeId") disputeId: string,
    @Body() body: Record<string, unknown>
  ) {
    const parsed = resolveProjectDisputeSchema.safeParse(body);
    if (!parsed.success) {
      throw new BadRequestException(parsed.error.flatten());
    }

    const actor = resolveRequestContext(req);
    const requestId = resolveRequestId(req.headers ?? {});
    const dispute = await this.disputesService.resolve({
      tenantId: actor.tenantId,
      orgId: actor.orgId,
      userId: actor.userId,
      roles: actor.roles,
      disputeId,
      resolution: parsed.data.resolution,
      resolutionType: parsed.data.resolutionType,
      requestId
    });

    return ok(requestId, toVisibleDispute(dispute));
  }

  @Post(":disputeId/archive")
  @RequirePermissions("disputes:archive")
  async archive(@Req() req: { headers?: Record<string, unknown> }, @Param("disputeId") disputeId: string) {
    const actor = resolveRequestContext(req);
    const requestId = resolveRequestId(req.headers ?? {});
    const archived = await this.disputesService.archive({
      tenantId: actor.tenantId,
      orgId: actor.orgId,
      userId: actor.userId,
      roles: actor.roles,
      disputeId,
      requestId
    });

    return ok(requestId, archived);
  }

  @Post(":disputeId/restore")
  @RequirePermissions("disputes:restore")
  async restore(@Req() req: { headers?: Record<string, unknown> }, @Param("disputeId") disputeId: string) {
    const actor = resolveRequestContext(req);
    const requestId = resolveRequestId(req.headers ?? {});
    const restored = await this.disputesService.restore({
      tenantId: actor.tenantId,
      orgId: actor.orgId,
      userId: actor.userId,
      roles: actor.roles,
      disputeId,
      requestId
    });

    return ok(requestId, restored);
  }
}
