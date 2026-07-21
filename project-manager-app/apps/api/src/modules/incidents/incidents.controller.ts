import { BadRequestException, Body, Controller, Get, Param, Post, Query, Req } from "@nestjs/common";
import { z } from "zod";
import { ok } from "../../common/api-response.js";
import { RequirePermissions } from "../../common/permissions.decorator.js";
import { resolveRequestContext } from "../../common/request-context.js";
import { resolveRequestId } from "../../common/request-id.js";
import { IncidentsService } from "./incidents.service.js";

const createIncidentSchema = z.object({
  jobId:       z.string().min(1),
  type:        z.enum(["safety", "damage", "delay", "material", "other"]),
  severity:    z.enum(["low", "medium", "high", "critical"]),
  title:       z.string().min(1).max(200),
  description: z.string().max(3000).optional(),
});

@Controller("v1/incidents")
export class IncidentsController {
  constructor(private readonly incidentsService: IncidentsService) {}

  @Get()
  @RequirePermissions("jobs:read")
  async listByWorker(
    @Req() req: { headers?: Record<string, unknown> },
    @Query("status") status?: string
  ) {
    const actor = resolveRequestContext(req);
    const data = await this.incidentsService.listByWorker({ tenantId: actor.tenantId, userId: actor.userId, status });
    return ok(resolveRequestId(req.headers ?? {}), data);
  }

  @Get("by-job/:jobId")
  @RequirePermissions("jobs:read")
  async listByJob(
    @Req() req: { headers?: Record<string, unknown> },
    @Param("jobId") jobId: string
  ) {
    const actor = resolveRequestContext(req);
    const data = await this.incidentsService.listByJob({ tenantId: actor.tenantId, jobId, orgId: actor.orgId, roles: actor.roles });
    return ok(resolveRequestId(req.headers ?? {}), data);
  }

  @Get("all")
  @RequirePermissions("ops:read")
  async listAll(
    @Req() req: { headers?: Record<string, unknown> },
    @Query("status") status?: string,
    @Query("severity") severity?: string
  ) {
    const actor = resolveRequestContext(req);
    const data = await this.incidentsService.listAll({ tenantId: actor.tenantId, status, severity });
    return ok(resolveRequestId(req.headers ?? {}), data);
  }

  @Post()
  @RequirePermissions("jobs:create")
  async create(
    @Req() req: { headers?: Record<string, unknown> },
    @Body() body: unknown
  ) {
    const parsed = createIncidentSchema.safeParse(body);
    if (!parsed.success) throw new BadRequestException(parsed.error.flatten());
    const actor = resolveRequestContext(req);
    const data = await this.incidentsService.create({
      ...parsed.data,
      tenantId: actor.tenantId,
      reportedBy: actor.userId,
      orgId: actor.orgId,
      roles: actor.roles,
    });
    return ok(resolveRequestId(req.headers ?? {}), data);
  }

  @Post(":incidentId/resolve")
  @RequirePermissions("ops:write")
  async resolve(
    @Req() req: { headers?: Record<string, unknown> },
    @Param("incidentId") incidentId: string
  ) {
    const actor = resolveRequestContext(req);
    const data = await this.incidentsService.resolve({ tenantId: actor.tenantId, incidentId });
    return ok(resolveRequestId(req.headers ?? {}), data);
  }
}
