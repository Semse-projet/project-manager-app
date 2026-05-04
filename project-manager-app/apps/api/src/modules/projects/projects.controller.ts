import { BadRequestException, Body, Controller, Get, Optional, Param, Patch, Query, Req } from "@nestjs/common";
import { listProjectsQuerySchema, updateProjectStatusSchema } from "@semse/schemas";
import { ok } from "../../common/api-response.js";
import { toVisibleMilestone } from "../../common/visible-response.js";
import { RequirePermissions } from "../../common/permissions.decorator.js";
import { resolveRequestContext } from "../../common/request-context.js";
import { resolveRequestId } from "../../common/request-id.js";
import { ProjectsService } from "./projects.service.js";
import { DigitalTwinService } from "../intelligence/digital-twin.service.js";

@Controller("v1/projects")
export class ProjectsController {
  constructor(
    private readonly projectsService: ProjectsService,
    @Optional() private readonly digitalTwin?: DigitalTwinService,
  ) {}

  @Get()
  @RequirePermissions("projects:read")
  async list(@Req() req: { headers?: Record<string, unknown> }, @Query() query: Record<string, unknown>) {
    const parsed = listProjectsQuerySchema.safeParse(query);
    if (!parsed.success) {
      throw new BadRequestException(parsed.error.flatten());
    }

    const actor = resolveRequestContext(req);
    const projects = await this.projectsService.list({
      tenantId: actor.tenantId,
      orgId: actor.orgId,
      userId: actor.userId,
      roles: actor.roles,
      status: parsed.data.status,
      jobId: parsed.data.jobId
    });
    return ok(resolveRequestId(req.headers ?? {}), projects);
  }

  @Get(":projectId")
  @RequirePermissions("projects:read")
  async detail(@Req() req: { headers?: Record<string, unknown> }, @Param("projectId") projectId: string) {
    const actor = resolveRequestContext(req);
    const project = await this.projectsService.detail({
      tenantId: actor.tenantId,
      orgId: actor.orgId,
      userId: actor.userId,
      roles: actor.roles,
      projectId
    });
    return ok(resolveRequestId(req.headers ?? {}), project);
  }

  @Get(":projectId/payments")
  @RequirePermissions("projects:financials:read")
  async payments(@Req() req: { headers?: Record<string, unknown> }, @Param("projectId") projectId: string) {
    const actor = resolveRequestContext(req);
    const transactions = await this.projectsService.payments({
      tenantId: actor.tenantId,
      orgId: actor.orgId,
      userId: actor.userId,
      roles: actor.roles,
      projectId
    });

    return ok(resolveRequestId(req.headers ?? {}), transactions);
  }

  @Get(":projectId/escrow")
  @RequirePermissions("projects:financials:read")
  async escrow(@Req() req: { headers?: Record<string, unknown> }, @Param("projectId") projectId: string) {
    const actor = resolveRequestContext(req);
    const summary = await this.projectsService.escrow({
      tenantId: actor.tenantId,
      orgId: actor.orgId,
      userId: actor.userId,
      roles: actor.roles,
      projectId
    });
    return ok(resolveRequestId(req.headers ?? {}), summary);
  }

  @Get(":projectId/milestones")
  @RequirePermissions("projects:read")
  async milestones(@Req() req: { headers?: Record<string, unknown> }, @Param("projectId") projectId: string) {
    const actor = resolveRequestContext(req);
    const milestones = await this.projectsService.milestones({
      tenantId: actor.tenantId,
      projectId,
      userId: actor.userId,
      orgId: actor.orgId,
      roles: actor.roles
    });
    return ok(resolveRequestId(req.headers ?? {}), milestones.map((m) => toVisibleMilestone(m)));
  }

  @Patch(":projectId/status")
  @RequirePermissions("projects:status:update")
  async updateStatus(
    @Req() req: { headers?: Record<string, unknown> },
    @Param("projectId") projectId: string,
    @Body() body: Record<string, unknown>
  ) {
    const parsed = updateProjectStatusSchema.safeParse(body);
    if (!parsed.success) {
      throw new BadRequestException(parsed.error.flatten());
    }

    const actor = resolveRequestContext(req);
    const requestId = resolveRequestId(req.headers ?? {});
    const project = await this.projectsService.updateStatus({
      tenantId: actor.tenantId,
      orgId: actor.orgId,
      userId: actor.userId,
      roles: actor.roles,
      projectId,
      status: parsed.data.status,
      requestId
    });

    // Auto-archive when project completes
    if (parsed.data.status === "completed") {
      void this.digitalTwin?.buildArchive({
        tenantId: actor.tenantId,
        projectId,
        archivedBy: actor.userId,
      }).catch(() => {/* non-blocking */});
    }

    return ok(requestId, project);
  }
}
