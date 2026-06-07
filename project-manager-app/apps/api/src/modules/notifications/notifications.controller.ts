import { Body, Controller, Get, Param, Patch, Post, Query, Req } from "@nestjs/common";
import { ok } from "../../common/api-response.js";
import { RequirePermissions } from "../../common/permissions.decorator.js";
import { resolveRequestContext } from "../../common/request-context.js";
import { resolveRequestId } from "../../common/request-id.js";
import { NotificationsService } from "./notifications.service.js";

@Controller("v1/notifications")
export class NotificationsController {
  constructor(private readonly notificationsService: NotificationsService) {}

  @Get()
  @RequirePermissions("notifications:read")
  async list(
    @Req() req: { headers?: Record<string, unknown> },
    @Query("unreadOnly") unreadOnly?: string,
    @Query("limit") limit?: string,
    @Query("offset") offset?: string,
  ) {
    const actor = resolveRequestContext(req);
    const requestId = resolveRequestId(req.headers ?? {});

    const result = await this.notificationsService.listForUser({
      tenantId: actor.tenantId,
      userId: actor.userId,
      unreadOnly: unreadOnly === "true",
      limit: limit ? Math.min(Number(limit), 100) : 50,
      offset: offset ? Number(offset) : 0,
    });

    return ok(requestId, result);
  }

  @Post(":notificationId/read")
  @Patch(":notificationId/read")
  @RequirePermissions("notifications:read")
  async markRead(
    @Req() req: { headers?: Record<string, unknown> },
    @Param("notificationId") notificationId: string,
  ) {
    const actor = resolveRequestContext(req);
    const requestId = resolveRequestId(req.headers ?? {});

    const notification = await this.notificationsService.markRead({
      tenantId: actor.tenantId,
      userId: actor.userId,
      notificationId,
    });

    return ok(requestId, notification);
  }

  @Patch("read-all")
  @RequirePermissions("notifications:read")
  async markAllRead(
    @Req() req: { headers?: Record<string, unknown> },
    @Body() _body: unknown,
  ) {
    const actor = resolveRequestContext(req);
    const requestId = resolveRequestId(req.headers ?? {});

    const result = await this.notificationsService.markAllRead({
      tenantId: actor.tenantId,
      userId: actor.userId,
    });

    return ok(requestId, result);
  }

  @Post("push-subscribe")
  @RequirePermissions("notifications:read")
  async pushSubscribe(
    @Req() req: { headers?: Record<string, unknown> },
    @Body() body: Record<string, unknown>,
  ) {
    const actor = resolveRequestContext(req);
    const requestId = resolveRequestId(req.headers ?? {});
    const result = await this.notificationsService.savePushSubscription({
      tenantId: actor.tenantId,
      userId: actor.userId,
      endpoint: typeof body.endpoint === "string" ? body.endpoint : "",
      keys: (body.keys ?? {}) as Record<string, string>,
    });
    return ok(requestId, result);
  }
}
