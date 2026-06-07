import { Body, Controller, Get, Param, Patch, Post, Req } from "@nestjs/common";
import { userIdParamSchema, userProfileUpdateBodySchema, userStatusUpdateBodySchema, userVerificationBodySchema } from "@semse/schemas";
import { ok } from "../../common/api-response.js";
import { RequirePermissions } from "../../common/permissions.decorator.js";
import { resolveRequestContext } from "../../common/request-context.js";
import { resolveRequestId } from "../../common/request-id.js";
import { parseWithSchema } from "../../common/zod-validation.js";
import { UsersService } from "./users.service.js";

@Controller("v1/users")
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get()
  @RequirePermissions("users:read")
  async list(@Req() req: { headers?: Record<string, unknown> }) {
    const actor = resolveRequestContext(req);
    const data = await this.usersService.listUsers({
      tenantId: actor.tenantId,
      orgId: actor.orgId,
      userId: actor.userId,
      roles: actor.roles
    });
    return ok(resolveRequestId(req.headers ?? {}), data);
  }

  @Get("me")
  async getMe(@Req() req: { headers?: Record<string, unknown> }) {
    const actor = resolveRequestContext(req);
    const data = await this.usersService.getUser(
      { tenantId: actor.tenantId, orgId: actor.orgId, userId: actor.userId, roles: actor.roles },
      actor.userId
    );
    return ok(resolveRequestId(req.headers ?? {}), data);
  }

  @Get("me/profile")
  async getMyProfile(@Req() req: { headers?: Record<string, unknown> }) {
    const actor = resolveRequestContext(req);
    const data = await this.usersService.getMyProfile({
      tenantId: actor.tenantId,
      orgId: actor.orgId,
      userId: actor.userId,
      roles: actor.roles
    });
    return ok(resolveRequestId(req.headers ?? {}), data);
  }

  @Patch("me/profile")
  async updateMyProfile(@Req() req: { headers?: Record<string, unknown> }, @Body() body: unknown) {
    const parsedBody = parseWithSchema(userProfileUpdateBodySchema, body);
    const actor = resolveRequestContext(req);
    const requestId = resolveRequestId(req.headers ?? {});
    const data = await this.usersService.updateMyProfile({
      tenantId: actor.tenantId,
      orgId: actor.orgId,
      userId: actor.userId,
      roles: actor.roles,
      data: parsedBody,
      requestId
    });
    return ok(requestId, data);
  }

  @Get(":userId")
  @RequirePermissions("users:read")
  async detail(@Req() req: { headers?: Record<string, unknown> }, @Param("userId") userId: string) {
    const parsedParams = parseWithSchema(userIdParamSchema, { userId });
    const actor = resolveRequestContext(req);
    const data = await this.usersService.getUser({
      tenantId: actor.tenantId,
      orgId: actor.orgId,
      userId: actor.userId,
      roles: actor.roles
    }, parsedParams.userId);
    return ok(resolveRequestId(req.headers ?? {}), data);
  }

  @Get(":userId/memberships")
  @RequirePermissions("users:memberships:read")
  async memberships(@Req() req: { headers?: Record<string, unknown> }, @Param("userId") userId: string) {
    const parsedParams = parseWithSchema(userIdParamSchema, { userId });
    const actor = resolveRequestContext(req);
    const data = await this.usersService.listMemberships({
      tenantId: actor.tenantId,
      orgId: actor.orgId,
      userId: actor.userId,
      roles: actor.roles
    }, parsedParams.userId);
    return ok(resolveRequestId(req.headers ?? {}), data);
  }

  @Post(":userId/verify")
  @RequirePermissions("users:verify")
  async verify(
    @Req() req: { headers?: Record<string, unknown> },
    @Param("userId") userId: string,
    @Body() body: unknown
  ) {
    const parsedParams = parseWithSchema(userIdParamSchema, { userId });
    const parsedBody = parseWithSchema(userVerificationBodySchema, body);
    const actor = resolveRequestContext(req);
    const requestId = resolveRequestId(req.headers ?? {});
    const data = await this.usersService.verifyUser({
      tenantId: actor.tenantId,
      orgId: actor.orgId,
      userId: actor.userId,
      roles: actor.roles,
      targetUserId: parsedParams.userId,
      verificationType: parsedBody.verificationType ?? "email",
      requestId
    });
    return ok(requestId, data);
  }

  @Patch(":userId/status")
  @RequirePermissions("users:status:update")
  async updateStatus(
    @Req() req: { headers?: Record<string, unknown> },
    @Param("userId") userId: string,
    @Body() body: unknown
  ) {
    const parsedParams = parseWithSchema(userIdParamSchema, { userId });
    const parsedBody = parseWithSchema(userStatusUpdateBodySchema, body);
    const actor = resolveRequestContext(req);
    const requestId = resolveRequestId(req.headers ?? {});
    const data = await this.usersService.updateUserStatus({
      tenantId: actor.tenantId,
      orgId: actor.orgId,
      userId: actor.userId,
      roles: actor.roles,
      targetUserId: parsedParams.userId,
      status: parsedBody.status,
      requestId
    });
    return ok(requestId, data);
  }
}
