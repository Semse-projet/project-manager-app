import { Body, Controller, Get, HttpCode, Param, Post, Req } from "@nestjs/common";
import { Throttle } from "@nestjs/throttler";
import { z } from "zod";
import { ok } from "../../common/api-response.js";
import { AuthenticatedAccess } from "../../common/permissions.decorator.js";
import { resolveRequestContext } from "../../common/request-context.js";
import { resolveRequestId } from "../../common/request-id.js";
import { parseWithSchema } from "../../common/zod-validation.js";
import { SkillsService } from "./skills.service.js";

type Req_ = { headers?: Record<string, unknown> };

const idSchema = z.string().trim().min(1).max(64);
const reviewSchema = z.object({
  decision: z.enum(["CONFIRM", "REJECT"]),
  trade: z.string().trim().min(2).max(40).optional(),
  note: z.string().trim().max(500).optional()
});
const attestSchema = z.object({
  consent: z.literal(true),
  trades: z.array(z.string().trim().min(2).max(40)).min(1).max(20).optional(),
  expiresInDays: z.number().int().min(1).max(90).optional()
});
const redeemSchema = z.object({ token: z.string().trim().min(16).max(128) });

const REVIEW_SCOPE =
  "Solo el supervisor vigente de la cuadrilla de la asignación o un gestor de cuadrillas de su Org, distinto de la persona revisada; se revalida la membresía en cada llamada";
const SELF_SCOPE = "La persona gestiona únicamente su propia experiencia y atestaciones";
const REDEEM_SCOPE = "Solo un gestor vigente de la Org que canjea; la autorización real es el token que la persona le entregó";

/** BO-12: el responsable confirma o rechaza el trabajo terminado. Spec: docs/specs/core/skills.spec.md */
@Controller("v1/task-allocations")
export class SkillReviewController {
  constructor(private readonly skills: SkillsService) {}

  @Post(":allocationId/skill-review")
  @HttpCode(200)
  @AuthenticatedAccess(REVIEW_SCOPE)
  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  async review(@Req() req: Req_, @Param("allocationId") allocationId: string, @Body() body: unknown) {
    const actor = resolveRequestContext(req);
    const requestId = resolveRequestId(req.headers ?? {});
    const data = await this.skills.reviewAllocation(actor, parseWithSchema(idSchema, allocationId), requestId, parseWithSchema(reviewSchema, body));
    return ok(requestId, data);
  }
}

/** BO-12: mi experiencia y mis atestaciones portables. */
@Controller("v1/me/skills")
export class MySkillsController {
  constructor(private readonly skills: SkillsService) {}

  @Get()
  @AuthenticatedAccess(SELF_SCOPE)
  async mine(@Req() req: Req_) {
    const actor = resolveRequestContext(req);
    const data = await this.skills.mySkills({ userId: actor.userId });
    return ok(resolveRequestId(req.headers ?? {}), data);
  }

  @Post("attestations")
  @AuthenticatedAccess(SELF_SCOPE)
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  async create(@Req() req: Req_, @Body() body: unknown) {
    const actor = resolveRequestContext(req);
    const requestId = resolveRequestId(req.headers ?? {});
    const data = await this.skills.createAttestation(actor, requestId, parseWithSchema(attestSchema, body));
    return ok(requestId, data);
  }

  @Get("attestations")
  @AuthenticatedAccess(SELF_SCOPE)
  async list(@Req() req: Req_) {
    const actor = resolveRequestContext(req);
    const data = await this.skills.listAttestations({ userId: actor.userId });
    return ok(resolveRequestId(req.headers ?? {}), data);
  }

  @Post("attestations/:attestationId/revoke")
  @HttpCode(200)
  @AuthenticatedAccess(SELF_SCOPE)
  async revoke(@Req() req: Req_, @Param("attestationId") id: string) {
    const actor = resolveRequestContext(req);
    const requestId = resolveRequestId(req.headers ?? {});
    const data = await this.skills.revokeAttestation(actor, parseWithSchema(idSchema, id), requestId);
    return ok(requestId, data);
  }
}

/** BO-12: un gestor de otra empresa canjea el token que la persona le dio. */
@Controller("v1/organizations/:orgId/skill-attestations")
export class SkillRedeemController {
  constructor(private readonly skills: SkillsService) {}

  @Post("redeem")
  @HttpCode(200)
  @AuthenticatedAccess(REDEEM_SCOPE)
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  async redeem(@Req() req: Req_, @Param("orgId") orgId: string, @Body() body: unknown) {
    const actor = resolveRequestContext(req);
    const requestId = resolveRequestId(req.headers ?? {});
    const { token } = parseWithSchema(redeemSchema, body);
    const data = await this.skills.redeem(actor, parseWithSchema(idSchema, orgId), token, requestId);
    return ok(requestId, data);
  }
}
