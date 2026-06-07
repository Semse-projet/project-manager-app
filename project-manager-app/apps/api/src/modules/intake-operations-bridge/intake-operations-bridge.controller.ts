import { Controller, Param, Post, Req } from "@nestjs/common";
import type { FastifyRequest } from "fastify";
import { ok } from "../../common/api-response.js";
import { RequirePermissions } from "../../common/permissions.decorator.js";
import { resolveRequestContext } from "../../common/request-context.js";
import { resolveRequestId } from "../../common/request-id.js";
import { IntakeOperationsBridgeService } from "./intake-operations-bridge.service.js";

@Controller("v1/jobs")
export class IntakeOperationsBridgeController {
  constructor(private readonly bridgeService: IntakeOperationsBridgeService) {}

  @Post(":jobId/operations/bridge")
  @RequirePermissions("jobs:create")
  async bridge(@Req() req: FastifyRequest, @Param("jobId") jobId: string) {
    const actor = resolveRequestContext(req as Parameters<typeof resolveRequestContext>[0]);
    const requestId = resolveRequestId(req.headers ?? {});
    const data = await this.bridgeService.bridgePublishedJobToOperations({
      jobId,
      tenantId: actor.tenantId,
      orgId: actor.orgId,
      userId: actor.userId,
      roles: actor.roles,
    });
    return ok(requestId, data);
  }
}
