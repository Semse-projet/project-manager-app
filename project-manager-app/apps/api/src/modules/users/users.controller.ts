import { Body, Controller, Get, Param, Patch, Post, Req } from "@nestjs/common";
import { z } from "zod";
import { userIdParamSchema, userProfileUpdateBodySchema, userStatusUpdateBodySchema, userVerificationBodySchema } from "@semse/schemas";
import { ok } from "../../common/api-response.js";
import { AuthenticatedAccess, RequirePermissions } from "../../common/permissions.decorator.js";
import { resolveRequestContext } from "../../common/request-context.js";
import { resolveRequestId } from "../../common/request-id.js";
import { parseWithSchema } from "../../common/zod-validation.js";
import { UsersService } from "./users.service.js";

const verificationReviewBodySchema = z.object({
  decision: z.enum(["approved", "rejected"]),
  note: z.string().trim().max(500).optional()
});

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
  @AuthenticatedAccess("Authenticated users may read their own user record.")
  async getMe(@Req() req: { headers?: Record<string, unknown> }) {
    const actor = resolveRequestContext(req);
    const data = await this.usersService.getUser(
      { tenantId: actor.tenantId, orgId: actor.orgId, userId: actor.userId, roles: actor.roles },
      actor.userId
    );
    return ok(resolveRequestId(req.headers ?? {}), data);
  }

  @Get("me/profile")
  @AuthenticatedAccess("Authenticated users may read their own profile.")
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
  @AuthenticatedAccess("Authenticated users may update their own profile.")
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

  // Must stay registered before @Get(":userId") below — Nest matches routes
  // in declaration order and ":userId" would otherwise swallow
  // "verify-requests" as a param value.
  @Get("verify-requests")
  @RequirePermissions("users:verify")
  async listVerificationRequests(@Req() req: { headers?: Record<string, unknown> }) {
    const actor = resolveRequestContext(req);
    const data = await this.usersService.listVerificationRequests({
      tenantId: actor.tenantId,
      orgId: actor.orgId,
      userId: actor.userId,
      roles: actor.roles
    });
    return ok(resolveRequestId(req.headers ?? {}), data);
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

  @Post(":userId/verify-request")
  @RequirePermissions("users:verify:request")
  async requestVerification(
    @Req() req: { headers?: Record<string, unknown> },
    @Param("userId") userId: string,
    @Body() body: unknown
  ) {
    const parsedParams = parseWithSchema(userIdParamSchema, { userId });
    const parsedBody = parseWithSchema(userVerificationBodySchema, body);
    const actor = resolveRequestContext(req);
    const data = await this.usersService.requestVerification({
      tenantId: actor.tenantId,
      orgId: actor.orgId,
      userId: actor.userId,
      roles: actor.roles,
      targetUserId: parsedParams.userId,
      verificationType: parsedBody.verificationType ?? "email"
    });
    return ok(resolveRequestId(req.headers ?? {}), data);
  }

  @Post(":userId/verify-request/:verificationType/review")
  @RequirePermissions("users:verify")
  async reviewVerificationRequest(
    @Req() req: { headers?: Record<string, unknown> },
    @Param("userId") userId: string,
    @Param("verificationType") verificationType: string,
    @Body() body: unknown
  ) {
    const parsedParams = parseWithSchema(userIdParamSchema, { userId });
    const parsedType = parseWithSchema(userVerificationBodySchema, { verificationType });
    const parsedBody = parseWithSchema(verificationReviewBodySchema, body);
    const actor = resolveRequestContext(req);
    const requestId = resolveRequestId(req.headers ?? {});
    const data = await this.usersService.reviewVerificationRequest({
      tenantId: actor.tenantId,
      orgId: actor.orgId,
      userId: actor.userId,
      roles: actor.roles,
      targetUserId: parsedParams.userId,
      verificationType: parsedType.verificationType ?? "email",
      decision: parsedBody.decision,
      note: parsedBody.note,
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
