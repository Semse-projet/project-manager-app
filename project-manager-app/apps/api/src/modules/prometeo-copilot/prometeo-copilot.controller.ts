import { BadRequestException, Body, Controller, Post, Req } from "@nestjs/common";
import type { FastifyRequest } from "fastify";
import {
  copilotContextRequestSchema,
  copilotMessageRequestSchema,
  createMissionFromCopilotRequestSchema,
  executeCopilotActionRequestSchema,
} from "@semse/schemas";
import { ok } from "../../common/api-response.js";
import { RequirePermissions } from "../../common/permissions.decorator.js";
import { resolveRequestContext } from "../../common/request-context.js";
import { resolveRequestId } from "../../common/request-id.js";
import { PrometeoCopilotService, type CopilotActor } from "./prometeo-copilot.service.js";

function actorOf(req: FastifyRequest): CopilotActor {
  const c = resolveRequestContext(req as Parameters<typeof resolveRequestContext>[0]);
  return {
    userId: c.userId,
    tenantId: c.tenantId,
    orgId: c.orgId,
    roles: c.roles,
    requestId: resolveRequestId(req.headers ?? {}),
  };
}

@Controller("v1/prometeo/copilot")
export class PrometeoCopilotController {
  constructor(private readonly copilot: PrometeoCopilotService) {}

  @Post("context")
  @RequirePermissions("agents:run:create")
  detectContext(@Req() req: FastifyRequest, @Body() body: unknown) {
    const rid = resolveRequestId(req.headers ?? {});
    const parsed = copilotContextRequestSchema.safeParse(body);
    if (!parsed.success) {
      throw new BadRequestException(parsed.error.issues.map((i) => i.message).join("; "));
    }
    return ok(rid, this.copilot.detectContext(actorOf(req), parsed.data));
  }

  @Post("message")
  @RequirePermissions("agents:run:create")
  async message(@Req() req: FastifyRequest, @Body() body: unknown) {
    const rid = resolveRequestId(req.headers ?? {});
    const parsed = copilotMessageRequestSchema.safeParse(body);
    if (!parsed.success) {
      throw new BadRequestException(parsed.error.issues.map((i) => i.message).join("; "));
    }
    return ok(rid, await this.copilot.processMessage(actorOf(req), parsed.data));
  }

  @Post("mission/create")
  @RequirePermissions("agents:run:create")
  async createMission(@Req() req: FastifyRequest, @Body() body: unknown) {
    const rid = resolveRequestId(req.headers ?? {});
    const parsed = createMissionFromCopilotRequestSchema.safeParse(body);
    if (!parsed.success) {
      throw new BadRequestException(parsed.error.issues.map((i) => i.message).join("; "));
    }
    return ok(rid, await this.copilot.createMission(actorOf(req), parsed.data));
  }

  @Post("action/execute")
  @RequirePermissions("agents:run:create")
  executeAction(@Req() req: FastifyRequest, @Body() body: unknown) {
    const rid = resolveRequestId(req.headers ?? {});
    const parsed = executeCopilotActionRequestSchema.safeParse(body);
    if (!parsed.success) {
      throw new BadRequestException(parsed.error.issues.map((i) => i.message).join("; "));
    }
    return ok(rid, this.copilot.executeAction(actorOf(req), parsed.data));
  }
}
