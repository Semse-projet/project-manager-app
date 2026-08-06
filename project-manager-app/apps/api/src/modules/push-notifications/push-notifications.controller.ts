import { Body, Controller, Delete, Param, Post, Req } from "@nestjs/common";
import { registerPushTokenSchema } from "@semse/schemas";
import { ok } from "../../common/api-response.js";
import { AuthenticatedAccess } from "../../common/permissions.decorator.js";
import { resolveRequestContext } from "../../common/request-context.js";
import { resolveRequestId } from "../../common/request-id.js";
import { parseWithSchema } from "../../common/zod-validation.js";
import { PushNotificationsService } from "./push-notifications.service.js";

@Controller("v1/push")
export class PushNotificationsController {
  constructor(private readonly service: PushNotificationsService) {}

  @Post("register")
  @AuthenticatedAccess("Authenticated users may register a push token for their own device.")
  async register(@Req() req: { headers?: Record<string, unknown> }, @Body() body: unknown) {
    const input = parseWithSchema(registerPushTokenSchema, body);
    const actor = resolveRequestContext(req);
    const data = await this.service.registerToken(
      { tenantId: actor.tenantId, userId: actor.userId },
      input,
    );
    return ok(resolveRequestId(req.headers ?? {}), data);
  }

  @Delete("register/:deviceId")
  @AuthenticatedAccess("Authenticated users may unregister a push token for their own device.")
  async unregister(
    @Req() req: { headers?: Record<string, unknown> },
    @Param("deviceId") deviceId: string,
  ) {
    const actor = resolveRequestContext(req);
    await this.service.unregisterToken({ userId: actor.userId }, deviceId);
    return ok(resolveRequestId(req.headers ?? {}), { deviceId, revoked: true });
  }
}
