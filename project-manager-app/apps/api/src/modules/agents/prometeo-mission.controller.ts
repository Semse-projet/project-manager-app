import { BadRequestException, Body, Controller, Get, Param, Post, Req } from "@nestjs/common";
import { prometeoMissionCheckpointSchema, prometeoMissionCreateSchema } from "@semse/schemas";
import { ok } from "../../common/api-response.js";
import { RequirePermissions } from "../../common/permissions.decorator.js";
import { resolveRequestContext } from "../../common/request-context.js";
import { resolveRequestId } from "../../common/request-id.js";
import { PrometeoMissionService } from "./prometeo-mission.service.js";

@Controller("v1/prometeo/missions")
export class PrometeoMissionController {
  private readonly missions: PrometeoMissionService;

  constructor(missions: PrometeoMissionService) {
    this.missions = missions;
  }

  @Post()
  @RequirePermissions("agents:run:create")
  async create(@Req() req: { headers?: Record<string, unknown> }, @Body() body: unknown) {
    const parsed = prometeoMissionCreateSchema.safeParse(body);
    if (!parsed.success) throw new BadRequestException(parsed.error.flatten());
    const actor = resolveRequestContext(req);
    const data = await this.missions.create(actor, parsed.data);
    return ok(resolveRequestId(req.headers ?? {}), data);
  }

  @Get(":missionId")
  @RequirePermissions("agents:run:create")
  async get(@Req() req: { headers?: Record<string, unknown> }, @Param("missionId") missionId: string) {
    const actor = resolveRequestContext(req);
    const data = await this.missions.get(actor.tenantId, missionId);
    return ok(resolveRequestId(req.headers ?? {}), data);
  }

  @Post(":missionId/approve")
  @RequirePermissions("agents:run:create")
  async approve(@Req() req: { headers?: Record<string, unknown> }, @Param("missionId") missionId: string) {
    const actor = resolveRequestContext(req);
    const data = await this.missions.approve(actor, missionId);
    return ok(resolveRequestId(req.headers ?? {}), data);
  }

  @Post(":missionId/reject")
  @RequirePermissions("agents:run:create")
  async reject(@Req() req: { headers?: Record<string, unknown> }, @Param("missionId") missionId: string) {
    const actor = resolveRequestContext(req);
    const data = await this.missions.reject(actor, missionId);
    return ok(resolveRequestId(req.headers ?? {}), data);
  }

  @Post(":missionId/cancel")
  @RequirePermissions("agents:run:create")
  async cancel(@Req() req: { headers?: Record<string, unknown> }, @Param("missionId") missionId: string) {
    const actor = resolveRequestContext(req);
    const data = await this.missions.cancel(actor, missionId);
    return ok(resolveRequestId(req.headers ?? {}), data);
  }

  @Post(":missionId/steps/:stepId/checkpoint")
  @RequirePermissions("agents:run:create")
  async checkpoint(
    @Req() req: { headers?: Record<string, unknown> },
    @Param("missionId") missionId: string,
    @Param("stepId") stepId: string,
    @Body() body: unknown,
  ) {
    const parsed = prometeoMissionCheckpointSchema.safeParse(body);
    if (!parsed.success) throw new BadRequestException(parsed.error.flatten());
    const actor = resolveRequestContext(req);
    const data = await this.missions.checkpoint(actor, missionId, stepId, parsed.data);
    return ok(resolveRequestId(req.headers ?? {}), data);
  }
}
