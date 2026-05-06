import { BadRequestException, Body, Controller, Get, Param, Post, Req } from "@nestjs/common";
import type { FastifyRequest } from "fastify";
import { ok } from "../../common/api-response.js";
import { RequirePermissions } from "../../common/permissions.decorator.js";
import { resolveRequestContext } from "../../common/request-context.js";
import { resolveRequestId } from "../../common/request-id.js";
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

@Controller("v1/buildops")
export class BuildOpsController {
  constructor(private readonly buildOpsService: BuildOpsService) {}

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
}
