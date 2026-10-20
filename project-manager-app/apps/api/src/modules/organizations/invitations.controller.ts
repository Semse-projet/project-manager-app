import { Body, Controller, Get, HttpCode, Param, Post, Query, Req } from "@nestjs/common";
import { Throttle } from "@nestjs/throttler";
import { z } from "zod";
import { ok } from "../../common/api-response.js";
import { AuthenticatedAccess, RequirePermissions } from "../../common/permissions.decorator.js";
import { Public } from "../../common/public.decorator.js";
import { resolveRequestContext } from "../../common/request-context.js";
import { resolveRequestId } from "../../common/request-id.js";
import { parseWithSchema } from "../../common/zod-validation.js";
import { InvitationsService } from "./invitations.service.js";

type Req_ = { headers?: Record<string, unknown> };

const idSchema = z.string().trim().min(1).max(64);
const createSchema = z.object({
  email: z.string().trim().email().max(254),
  role: z.string().trim().min(1).max(32),
  expiresInDays: z.number().int().min(1).max(30).optional()
});
const cancelSchema = z.object({ reason: z.string().trim().min(1).max(500) });
const listQuerySchema = z.object({
  status: z.enum(["PENDING", "ACCEPTED", "DECLINED", "CANCELED", "EXPIRED"]).optional()
});
const tokenSchema = z.object({ token: z.string().trim().min(10).max(200) });
const registerInvitedSchema = z.object({
  token: z.string().trim().min(10).max(200),
  name: z.string().trim().min(2).max(120),
  password: z.string().min(15).max(128)
});

/** BO-01: gestión privada de invitaciones de una Org. Spec: docs/specs/core/org-invitations.spec.md */
@Controller("v1/organizations/:orgId/invitations")
export class OrgInvitationsController {
  constructor(private readonly invitations: InvitationsService) {}

  @Post()
  @RequirePermissions("org:members:invite")
  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  async create(@Req() req: Req_, @Param("orgId") orgId: string, @Body() body: unknown) {
    const actor = resolveRequestContext(req);
    const input = parseWithSchema(createSchema, body);
    const data = await this.invitations.create(actor, parseWithSchema(idSchema, orgId), input);
    return ok(resolveRequestId(req.headers ?? {}), data);
  }

  @Get()
  @RequirePermissions("org:invitations:read")
  async list(@Req() req: Req_, @Param("orgId") orgId: string, @Query() query: unknown) {
    const actor = resolveRequestContext(req);
    const { status } = parseWithSchema(listQuerySchema, query ?? {});
    const data = await this.invitations.list(actor, parseWithSchema(idSchema, orgId), status);
    return ok(resolveRequestId(req.headers ?? {}), data);
  }

  @Post(":invitationId/cancel")
  @HttpCode(200)
  @RequirePermissions("org:invitations:cancel")
  async cancel(
    @Req() req: Req_,
    @Param("orgId") orgId: string,
    @Param("invitationId") invitationId: string,
    @Body() body: unknown
  ) {
    const actor = resolveRequestContext(req);
    const { reason } = parseWithSchema(cancelSchema, body);
    const data = await this.invitations.cancel(
      actor,
      parseWithSchema(idSchema, orgId),
      parseWithSchema(idSchema, invitationId),
      reason
    );
    return ok(resolveRequestId(req.headers ?? {}), data);
  }

  @Post(":invitationId/resend")
  @HttpCode(200)
  @RequirePermissions("org:members:invite")
  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  async resend(@Req() req: Req_, @Param("orgId") orgId: string, @Param("invitationId") invitationId: string) {
    const actor = resolveRequestContext(req);
    const data = await this.invitations.resend(
      actor,
      parseWithSchema(idSchema, orgId),
      parseWithSchema(idSchema, invitationId)
    );
    return ok(resolveRequestId(req.headers ?? {}), data);
  }
}

/** BO-01: vista previa (token) y aceptación (sesión del destinatario). */
@Controller("v1/invitations")
export class InvitationsController {
  constructor(private readonly invitations: InvitationsService) {}

  @Post("preview")
  @Public()
  @HttpCode(200)
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  async preview(@Req() req: Req_, @Body() body: unknown) {
    const { token } = parseWithSchema(tokenSchema, body);
    const data = await this.invitations.preview(token);
    return ok(resolveRequestId(req.headers ?? {}), data);
  }

  @Post("register")
  @Public()
  @HttpCode(200)
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  async registerInvited(@Req() req: Req_, @Body() body: unknown) {
    const input = parseWithSchema(registerInvitedSchema, body);
    const requestId = resolveRequestId(req.headers ?? {});
    const data = await this.invitations.registerInvited({ ...input, requestId });
    return ok(requestId, data);
  }

  @Post("accept")
  @HttpCode(200)
  @AuthenticatedAccess("El destinatario acepta su propia invitación; la autorización es el token y su email verificado")
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  async accept(@Req() req: Req_, @Body() body: unknown) {
    const actor = resolveRequestContext(req);
    const { token } = parseWithSchema(tokenSchema, body);
    const requestId = resolveRequestId(req.headers ?? {});
    const data = await this.invitations.accept({ userId: actor.userId }, { token, requestId });
    return ok(requestId, data);
  }
}

