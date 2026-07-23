import crypto from "node:crypto";
import { BadRequestException, Body, Controller, ForbiddenException, Get, Post, Req } from "@nestjs/common";
import { Throttle } from "@nestjs/throttler";
import {
  authPasswordResetConfirmSchema,
  authPasswordResetRequestSchema,
  authRefreshBodySchema,
  authRegisterBodySchema,
  authTokenBodySchema
} from "@semse/schemas";
import { SEMSE_BOOTSTRAP_HEADER_NAME } from "@semse/shared";
import { ok } from "../../common/api-response.js";
import { AuthenticatedAccess } from "../../common/permissions.decorator.js";
import { Public } from "../../common/public.decorator.js";
import { resolveRequestContext } from "../../common/request-context.js";
import { resolveRequestId } from "../../common/request-id.js";
import { parseWithSchema } from "../../common/zod-validation.js";
import { AuthService } from "./auth.service.js";

type AuthenticatedRequest = {
  headers?: Record<string, unknown>;
  authContext?: {
    userId: string;
    tenantId: string;
    orgId: string;
    roles: string[];
    sessionId?: string;
  };
};

function requireBootstrapToken(headers: Record<string, unknown> | undefined): void {
  const expected = process.env.SEMSE_BOOTSTRAP_TOKEN?.trim();
  if (!expected) {
    if (process.env.NODE_ENV === "production") {
      // Fail closed, not open: an unset token used to mean "mint a session
      // for any userId/tenantId/orgId/roles the caller asks for" in prod.
      throw new ForbiddenException("Server misconfiguration: bootstrap token is not set");
    }
    return;
  }

  const provided = headers?.[SEMSE_BOOTSTRAP_HEADER_NAME];
  if (typeof provided !== "string") {
    throw new ForbiddenException("Bootstrap token required");
  }

  // Hash both sides so timingSafeEqual always receives equal-length buffers,
  // preventing the length short-circuit from leaking information.
  const expectedHash = crypto.createHash("sha256").update(expected).digest();
  const providedHash = crypto.createHash("sha256").update(provided.trim()).digest();

  if (!crypto.timingSafeEqual(expectedHash, providedHash)) {
    throw new ForbiddenException("Bootstrap token required");
  }
}

@Controller("v1/auth")
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Get("me")
  @AuthenticatedAccess("Authenticated users may read their own auth session context.")
  me(@Req() req: { headers?: Record<string, unknown> }) {
    const actor = resolveRequestContext(req);

    return ok(resolveRequestId(req.headers ?? {}), {
      userId: actor.userId,
      tenantId: actor.tenantId,
      orgId: actor.orgId,
      roles: actor.roles
    });
  }

  @Post("token")
  @Public()
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  async issueToken(
    @Req() req: { headers?: Record<string, unknown> },
    @Body() body: unknown
  ) {
    requireBootstrapToken(req.headers);
    const parsed = parseWithSchema(authTokenBodySchema, body);
    const requestId = resolveRequestId(req.headers ?? {});
    const data = await this.authService.issueSession({
      userId: parsed.userId,
      tenantId: parsed.tenantId,
      orgId: parsed.orgId,
      roles: parsed.roles ?? [],
      ttlSeconds: parsed.ttlSeconds,
      requestId
    });
    return ok(requestId, data);
  }

  @Post("refresh")
  @Public()
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  async refresh(@Req() req: { headers?: Record<string, unknown> }, @Body() body: unknown) {
    const parsed = parseWithSchema(authRefreshBodySchema, body);
    const requestId = resolveRequestId(req.headers ?? {});
    const data = await this.authService.refreshSession({
      refreshToken: parsed.refreshToken,
      requestId
    });
    return ok(requestId, data);
  }

  @Post("register")
  @Public()
  @Throttle({ default: { limit: 3, ttl: 60_000 } })
  async register(
    @Req() req: { headers?: Record<string, unknown> },
    @Body() body: unknown
  ) {
    const parsed = parseWithSchema(authRegisterBodySchema, body);
    const requestId = resolveRequestId(req.headers ?? {});
    const data = await this.authService.register({
      email: parsed.email,
      password: parsed.password,
      name: parsed.name,
      role: parsed.role ?? "CLIENT",
      requestId,
    });
    return ok(requestId, data);
  }

  @Post("login")
  @Public()
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  async login(
    @Req() req: { headers?: Record<string, unknown> },
    @Body() body: unknown
  ) {
    // validate body
    const parsed = body as { email?: string; password?: string };
    if (!parsed.email || !parsed.password) {
      throw new BadRequestException("email and password are required");
    }
    const requestId = resolveRequestId(req.headers ?? {});
    const data = await this.authService.loginWithPassword({
      email: parsed.email,
      password: parsed.password,
      requestId,
    });
    return ok(requestId, data);
  }

  @Post("logout")
  @AuthenticatedAccess("Authenticated users may terminate their own session.")
  async logout(@Req() req: AuthenticatedRequest) {
    const actor = resolveRequestContext(req);
    const requestId = resolveRequestId(req.headers ?? {});
    const data = await this.authService.logout({
      ...actor,
      requestId
    });
    return ok(requestId, data);
  }

  @Post("password-reset/request")
  @Public()
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  async requestPasswordReset(@Req() req: { headers?: Record<string, unknown> }, @Body() body: unknown) {
    const parsed = parseWithSchema(authPasswordResetRequestSchema, body);
    const requestId = resolveRequestId(req.headers ?? {});
    const data = await this.authService.requestPasswordReset({
      email: parsed.email,
      requestId
    });
    return ok(requestId, data);
  }

  @Post("password-reset/confirm")
  @Public()
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  async confirmPasswordReset(@Req() req: { headers?: Record<string, unknown> }, @Body() body: unknown) {
    const parsed = parseWithSchema(authPasswordResetConfirmSchema, body);
    const requestId = resolveRequestId(req.headers ?? {});
    const data = await this.authService.confirmPasswordReset({
      token: parsed.token,
      newPassword: parsed.newPassword,
      requestId
    });
    return ok(requestId, data);
  }
}
