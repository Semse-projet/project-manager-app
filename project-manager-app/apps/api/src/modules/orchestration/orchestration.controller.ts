import { BadRequestException, Body, Controller, Get, Param, Post, Req } from "@nestjs/common";
import type { FastifyRequest } from "fastify";
import {
  agentConsultationRequestSchema,
  prometeoAgentIdSchema,
  prometeoOrchestrationRequestSchema,
} from "@semse/schemas";
import { ok } from "../../common/api-response.js";
import { RequirePermissions } from "../../common/permissions.decorator.js";
import { resolveRequestContext } from "../../common/request-context.js";
import { resolveRequestId } from "../../common/request-id.js";
import { OrchestrationService, type OrchestrationActor } from "./orchestration.service.js";

function actorOf(req: FastifyRequest): OrchestrationActor {
  const c = resolveRequestContext(req as Parameters<typeof resolveRequestContext>[0]);
  return {
    userId: c.userId,
    tenantId: c.tenantId,
    orgId: c.orgId,
    roles: c.roles,
    requestId: resolveRequestId(req.headers ?? {}),
  };
}

@Controller("v1/prometeo")
export class OrchestrationController {
  constructor(private readonly orchestration: OrchestrationService) {}

  @Post("orchestrate")
  @RequirePermissions("agents:run:create")
  async orchestrate(@Req() req: FastifyRequest, @Body() body: unknown) {
    const rid = resolveRequestId(req.headers ?? {});
    const parsed = prometeoOrchestrationRequestSchema.safeParse(body);
    if (!parsed.success) {
      throw new BadRequestException(parsed.error.issues.map((i) => i.message).join("; "));
    }
    return ok(rid, await this.orchestration.orchestrate(actorOf(req), parsed.data));
  }

  @Post("agents/:agentId/consult")
  @RequirePermissions("agents:run:create")
  consult(@Req() req: FastifyRequest, @Param("agentId") agentId: string, @Body() body: unknown) {
    const rid = resolveRequestId(req.headers ?? {});
    const agent = prometeoAgentIdSchema.safeParse(agentId);
    if (!agent.success) {
      throw new BadRequestException(`Unknown agent '${agentId}'`);
    }
    const parsed = agentConsultationRequestSchema.safeParse(body);
    if (!parsed.success) {
      throw new BadRequestException(parsed.error.issues.map((i) => i.message).join("; "));
    }
    return ok(rid, this.orchestration.consultAgent(actorOf(req), agent.data, parsed.data));
  }

  @Get("orchestration/:orchestrationId")
  @RequirePermissions("agents:run:create")
  async getOrchestration(
    @Req() req: FastifyRequest,
    @Param("orchestrationId") orchestrationId: string,
  ) {
    const rid = resolveRequestId(req.headers ?? {});
    return ok(rid, await this.orchestration.getOrchestration(actorOf(req), orchestrationId));
  }
}
