import { BadRequestException, Body, Controller, Get, Param, Post, Req } from "@nestjs/common";
import type { FastifyRequest } from "fastify";
import { ok } from "../../common/api-response.js";
import { RequirePermissions } from "../../common/permissions.decorator.js";
import { resolveRequestContext } from "../../common/request-context.js";
import { resolveRequestId } from "../../common/request-id.js";
import type { BuildOpsPlanApprovalSource } from "./buildops-plan-approval.types.js";
import { BuildOpsPlanApprovalService } from "./buildops-plan-approval.service.js";
import { BuildOpsService } from "./buildops.service.js";

function ctx(req: FastifyRequest) {
  return resolveRequestContext(req as Parameters<typeof resolveRequestContext>[0]);
}

const PROJECT_STATUSES = new Set([
  "draft",
  "estimating",
  "quoted",
  "approved",
  "in_progress",
  "paused",
  "completed",
  "dispute",
  "closed",
]);

const RISK_LEVELS = new Set(["low", "medium", "high", "critical"]);
const TASK_STATUSES = new Set(["todo", "in_progress", "blocked", "done", "canceled"]);
const TASK_PRIORITIES = new Set(["low", "medium", "high", "urgent"]);
const PLAN_APPROVAL_SOURCES = new Set(["client", "admin_override"]);

@Controller("v1/buildops")
export class BuildOpsController {
  constructor(
    private readonly buildOpsService: BuildOpsService,
    private readonly buildOpsPlanApprovalService: BuildOpsPlanApprovalService,
  ) {}

  @Get("overview")
  @RequirePermissions("projects:read")
  async overview(@Req() req: FastifyRequest) {
    const c = ctx(req);
    const data = await this.buildOpsService.overview(c.tenantId);
    return ok(resolveRequestId(req.headers ?? {}), data);
  }

  @Get("projects")
  @RequirePermissions("projects:read")
  async listProjects(@Req() req: FastifyRequest) {
    const c = ctx(req);
    const data = await this.buildOpsService.listProjects(c.tenantId);
    return ok(resolveRequestId(req.headers ?? {}), data);
  }

  @Get("projects/:projectId")
  @RequirePermissions("projects:read")
  async detail(@Req() req: FastifyRequest, @Param("projectId") projectId: string) {
    const c = ctx(req);
    const data = await this.buildOpsService.getProject(c.tenantId, projectId);
    return ok(resolveRequestId(req.headers ?? {}), data);
  }

  @Post("projects")
  @RequirePermissions("projects:create")
  async createProject(@Req() req: FastifyRequest, @Body() body: Record<string, unknown>) {
    const c = ctx(req);
    if (typeof body.title !== "string" || typeof body.trade !== "string" || typeof body.projectType !== "string" || typeof body.clientName !== "string" || typeof body.location !== "string") {
      throw new BadRequestException("Missing required project fields");
    }

    const data = await this.buildOpsService.createProject({
      tenantId: c.tenantId,
      orgId: c.orgId,
      createdBy: c.userId,
      title: body.title.trim(),
      description: typeof body.description === "string" ? body.description.trim() : null,
      trade: body.trade.trim(),
      projectType: body.projectType.trim(),
      clientName: body.clientName.trim(),
      professionalName: typeof body.professionalName === "string" ? body.professionalName.trim() : null,
      location: body.location.trim(),
      budgetEstimate: typeof body.budgetEstimate === "number" ? body.budgetEstimate : typeof body.budgetEstimate === "string" ? Number(body.budgetEstimate) : null,
      status: typeof body.status === "string" && PROJECT_STATUSES.has(body.status) ? body.status as any : "draft",
      riskScore: typeof body.riskScore === "number" ? body.riskScore : undefined,
      riskLevel: typeof body.riskLevel === "string" && RISK_LEVELS.has(body.riskLevel) ? body.riskLevel as any : undefined,
      startDate: typeof body.startDate === "string" ? body.startDate : null,
      dueDate: typeof body.dueDate === "string" ? body.dueDate : null,
    });

    return ok(resolveRequestId(req.headers ?? {}), data);
  }

  @Post("estimates/from-tool-result")
  @RequirePermissions("projects:create")
  async createFromToolResult(@Req() req: FastifyRequest, @Body() body: Record<string, unknown>) {
    const c = ctx(req);
    if (typeof body.sourceTool !== "string" || typeof body.sourceToolInput !== "object" || body.sourceToolInput === null || typeof body.sourceToolResult !== "object" || body.sourceToolResult === null) {
      throw new BadRequestException("Missing source tool payload");
    }

    const data = await this.buildOpsService.createFromToolResult({
      tenantId: c.tenantId,
      orgId: c.orgId,
      createdBy: c.userId,
      sourceTool: body.sourceTool,
      sourceToolInput: body.sourceToolInput as Record<string, unknown>,
      sourceToolResult: body.sourceToolResult as Record<string, unknown>,
      title: typeof body.title === "string" ? body.title : null,
      description: typeof body.description === "string" ? body.description : null,
      trade: typeof body.trade === "string" ? body.trade : null,
      projectType: typeof body.projectType === "string" ? body.projectType : null,
      clientName: typeof body.clientName === "string" ? body.clientName : null,
      professionalName: typeof body.professionalName === "string" ? body.professionalName : null,
      location: typeof body.location === "string" ? body.location : null,
    });

    return ok(resolveRequestId(req.headers ?? {}), data);
  }

  @Get("tasks")
  @RequirePermissions("projects:read")
  async listTasks(@Req() req: FastifyRequest) {
    const c = ctx(req);
    const query = req.query as Record<string, unknown> | undefined;
    const projectId = typeof query?.projectId === "string" ? query.projectId : null;
    const status = typeof query?.status === "string" && TASK_STATUSES.has(query.status) ? query.status : null;
    const data = await this.buildOpsService.listTasks(c.tenantId, { projectId, status });
    return ok(resolveRequestId(req.headers ?? {}), data);
  }

  @Get("tasks/:taskId")
  @RequirePermissions("projects:read")
  async detailTask(@Req() req: FastifyRequest, @Param("taskId") taskId: string) {
    const c = ctx(req);
    const data = await this.buildOpsService.getTask(c.tenantId, taskId);
    return ok(resolveRequestId(req.headers ?? {}), data);
  }

  @Get("milestones")
  @RequirePermissions("projects:read")
  async listMilestones(@Req() req: FastifyRequest) {
    const c = ctx(req);
    const data = await this.buildOpsService.listMilestones(c.tenantId);
    return ok(resolveRequestId(req.headers ?? {}), data);
  }

  @Post("tasks")
  @RequirePermissions("projects:create")
  async createTask(@Req() req: FastifyRequest, @Body() body: Record<string, unknown>) {
    const c = ctx(req);
    if (typeof body.title !== "string") {
      throw new BadRequestException("Missing task title");
    }

    const data = await this.buildOpsService.createTask({
      tenantId: c.tenantId,
      orgId: c.orgId,
      createdBy: c.userId,
      title: body.title.trim(),
      description: typeof body.description === "string" ? body.description.trim() : null,
      projectId: typeof body.projectId === "string" ? body.projectId : null,
      status: typeof body.status === "string" && TASK_STATUSES.has(body.status) ? body.status as any : undefined,
      priority: typeof body.priority === "string" && TASK_PRIORITIES.has(body.priority) ? body.priority as any : undefined,
      assigneeName: typeof body.assigneeName === "string" ? body.assigneeName.trim() : null,
      assigneeUserId: typeof body.assigneeUserId === "string" ? body.assigneeUserId.trim() : null,
      dueDate: typeof body.dueDate === "string" ? body.dueDate : null,
      sourceTool: typeof body.sourceTool === "string" ? body.sourceTool.trim() : null,
      evidenceRequired: body.evidenceRequired && typeof body.evidenceRequired === "object" ? body.evidenceRequired as Record<string, unknown> : null,
    });

    return ok(resolveRequestId(req.headers ?? {}), data);
  }

  @Post("plans/recover-stale-promotions")
  @RequirePermissions("ops:dashboard:write")
  async recoverStalePromotions(@Req() req: FastifyRequest, @Body() body: Record<string, unknown>) {
    const c = ctx(req);
    const olderThanMinutes = typeof body.olderThanMinutes === "number" ? body.olderThanMinutes : undefined;
    const data = await this.buildOpsService.recoverStalePromotions({
      tenantId: c.tenantId,
      olderThanMinutes,
    });
    return ok(resolveRequestId(req.headers ?? {}), data);
  }

  @Post("plans/:buildOpsProjectId/approve")
  @RequirePermissions("projects:status:update")
  async approvePlan(
    @Req() req: FastifyRequest,
    @Param("buildOpsProjectId") buildOpsProjectId: string,
    @Body() body: Record<string, unknown>,
  ) {
    const c = ctx(req);
    if (typeof body.source !== "string" || !PLAN_APPROVAL_SOURCES.has(body.source)) {
      throw new BadRequestException("Invalid approval source");
    }
    const source = body.source as BuildOpsPlanApprovalSource;

    const data = await this.buildOpsPlanApprovalService.approveClientPlan({
      tenantId: c.tenantId,
      orgId: c.orgId,
      userId: c.userId,
      roles: c.roles,
      buildOpsProjectId,
      source,
      reason: typeof body.reason === "string" ? body.reason : null,
    });

    return ok(resolveRequestId(req.headers ?? {}), data);
  }

  @Post("plans/:buildOpsProjectId/request-changes")
  @RequirePermissions("projects:status:update")
  async requestPlanChanges(
    @Req() req: FastifyRequest,
    @Param("buildOpsProjectId") buildOpsProjectId: string,
    @Body() body: Record<string, unknown>,
  ) {
    const c = ctx(req);
    const data = await this.buildOpsPlanApprovalService.requestChanges({
      tenantId: c.tenantId,
      orgId: c.orgId,
      userId: c.userId,
      roles: c.roles,
      buildOpsProjectId,
      comment: typeof body.comment === "string" ? body.comment : "",
    });

    return ok(resolveRequestId(req.headers ?? {}), data);
  }

  @Post("plans/:buildOpsProjectId/reject")
  @RequirePermissions("projects:status:update")
  async rejectPlan(
    @Req() req: FastifyRequest,
    @Param("buildOpsProjectId") buildOpsProjectId: string,
    @Body() body: Record<string, unknown>,
  ) {
    const c = ctx(req);
    const data = await this.buildOpsPlanApprovalService.rejectClientPlan({
      tenantId: c.tenantId,
      orgId: c.orgId,
      userId: c.userId,
      roles: c.roles,
      buildOpsProjectId,
      comment: typeof body.comment === "string" ? body.comment : "",
    });

    return ok(resolveRequestId(req.headers ?? {}), data);
  }

  @Post("plans/:buildOpsProjectId/unapprove")
  @RequirePermissions("projects:status:update")
  async unapprovePlan(
    @Req() req: FastifyRequest,
    @Param("buildOpsProjectId") buildOpsProjectId: string,
    @Body() body: Record<string, unknown>,
  ) {
    const c = ctx(req);
    const data = await this.buildOpsPlanApprovalService.unapproveClientPlan({
      tenantId: c.tenantId,
      orgId: c.orgId,
      userId: c.userId,
      roles: c.roles,
      buildOpsProjectId,
      reason: typeof body.reason === "string" ? body.reason : "",
    });

    return ok(resolveRequestId(req.headers ?? {}), data);
  }
}
