import { Body, Controller, Get, Post, Req } from "@nestjs/common";
import { ok } from "../../../common/api-response.js";
import { RequirePermissions } from "../../../common/permissions.decorator.js";
import { resolveRequestContext } from "../../../common/request-context.js";
import { resolveRequestId } from "../../../common/request-id.js";
import {
  parseMissionControlAction,
  parseMissionControlExceptionsQuery,
} from "./mission-control.policy.js";
import { MissionControlService } from "./mission-control.service.js";

type MissionControlRequest = {
  headers?: Record<string, unknown>;
  query?: Record<string, string | string[] | undefined>;
  authContext?: {
    tenantId: string;
    orgId: string;
    userId: string;
    roles: string[];
  };
};

@Controller("v1/ops/mission-control")
export class MissionControlController {
  constructor(private readonly missionControl: MissionControlService) {}

  @Get("exceptions")
  @RequirePermissions("ops:dashboard:read")
  async listExceptions(@Req() req: MissionControlRequest) {
    const context = resolveRequestContext(req);
    const requestId = resolveRequestId(req.headers ?? {});
    const query = parseMissionControlExceptionsQuery(req.query ?? {});
    const data = await this.missionControl.listExceptions({
      tenantId: context.tenantId,
      orgId: context.orgId,
      userId: context.userId,
      roles: context.roles,
      requestId,
    }, query);
    return ok(requestId, data);
  }

  @Get("runbooks")
  @RequirePermissions("ops:dashboard:read")
  listRunbooks(@Req() req: MissionControlRequest) {
    const context = resolveRequestContext(req);
    return ok(
      resolveRequestId(req.headers ?? {}),
      this.missionControl.listRunbooks(context.tenantId),
    );
  }

  @Post("actions")
  @RequirePermissions("ops:dashboard:write")
  async executeAction(
    @Req() req: MissionControlRequest,
    @Body() body: unknown,
  ) {
    const context = resolveRequestContext(req);
    const requestId = resolveRequestId(req.headers ?? {});
    const data = await this.missionControl.executeAction({
      tenantId: context.tenantId,
      orgId: context.orgId,
      userId: context.userId,
      roles: context.roles,
      requestId,
    }, parseMissionControlAction(body));
    return ok(requestId, data);
  }
}
