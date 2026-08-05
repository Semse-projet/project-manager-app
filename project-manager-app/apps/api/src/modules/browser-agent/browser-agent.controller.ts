import { Controller, Post, Get, Body, Param, Req, Patch, BadRequestException } from "@nestjs/common";
import { SkipThrottle } from "@nestjs/throttler";
import { BrowserAgentService } from "./browser-agent.service.js";
import { InspectUrlDto } from "./dto/inspect-url.dto.js";
import { ok } from "../../common/api-response.js";
import { resolveRequestContext } from "../../common/request-context.js";
import { resolveRequestId } from "../../common/request-id.js";
import { RequirePermissions } from "../../common/permissions.decorator.js";
import type { FastifyRequest } from "fastify";

@Controller("v1/browser-agent")
@SkipThrottle()
export class BrowserAgentController {
  constructor(private readonly service: BrowserAgentService) {}

  @Post("inspect")
  @RequirePermissions("agents:run:create")
  async inspect(@Req() req: FastifyRequest, @Body() body: InspectUrlDto) {
    const rid = resolveRequestId(req.headers ?? {});
    const ctx = resolveRequestContext(req as any);

    const result = await this.service.createInspection(body, {
      tenantId: ctx.tenantId,
      orgId: ctx.orgId,
      userId: ctx.userId,
      roles: ctx.roles,
      requestId: rid,
    });

    return ok(rid, result);
  }

  @Get("inspect/:runId")
  @RequirePermissions("agents:run:create")
  async getResult(@Req() req: FastifyRequest, @Param("runId") runId: string) {
    if (typeof runId !== "string" || !/^[a-zA-Z0-9_\-]+$/.test(runId)) {
      throw new BadRequestException("Invalid runId format");
    }
    const rid = resolveRequestId(req.headers ?? {});
    const ctx = resolveRequestContext(req as any);

    const result = await this.service.getInspectionResult(runId, {
      tenantId: ctx.tenantId,
      orgId: ctx.orgId,
      userId: ctx.userId,
    });

    return ok(rid, result);
  }

  @Post("missions")
  @RequirePermissions("agents:run:create")
  async createMission(@Req() req: FastifyRequest, @Body() body: any) {
    const rid = resolveRequestId(req.headers ?? {});
    const ctx = resolveRequestContext(req as any);
    const result = await this.service.createMission({
      tenantId: ctx.tenantId,
      actorId: ctx.userId,
      goal: body.goal,
      steps: body.steps || []
    });
    return ok(rid, result);
  }

  @Get("missions/:id")
  @RequirePermissions("agents:run:create")
  async getMission(@Req() req: FastifyRequest, @Param("id") id: string) {
    if (typeof id !== "string" || !/^[a-zA-Z0-9_\-]+$/.test(id)) {
      throw new BadRequestException("Invalid id format");
    }
    const rid = resolveRequestId(req.headers ?? {});
    const result = await this.service.getMission(id);
    return ok(rid, result);
  }

  @Patch("missions/:id")
  @RequirePermissions("agents:run:create")
  async updateMission(@Req() req: FastifyRequest, @Param("id") id: string, @Body() body: any) {
    if (typeof id !== "string" || !/^[a-zA-Z0-9_\-]+$/.test(id)) {
      throw new BadRequestException("Invalid id format");
    }
    const rid = resolveRequestId(req.headers ?? {});
    const result = await this.service.updateMission(id, body);
    return ok(rid, result);
  }

  @Patch("missions/:id/steps/:stepId")
  @RequirePermissions("agents:run:create")
  async updateStep(@Req() req: FastifyRequest, @Param("id") id: string, @Param("stepId") stepId: string, @Body() body: any) {
    if (typeof id !== "string" || !/^[a-zA-Z0-9_\-]+$/.test(id)) {
      throw new BadRequestException("Invalid id format");
    }
    if (typeof stepId !== "string" || !/^[a-zA-Z0-9_\-]+$/.test(stepId)) {
      throw new BadRequestException("Invalid stepId format");
    }
    const rid = resolveRequestId(req.headers ?? {});
    const result = await this.service.updateStep(stepId, body);
    return ok(rid, result);
  }
}
