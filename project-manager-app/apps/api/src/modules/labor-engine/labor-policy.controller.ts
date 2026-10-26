import { Body, Controller, Get, HttpCode, Param, Post, Query, Req } from "@nestjs/common";
import { Throttle } from "@nestjs/throttler";
import { z } from "zod";
import { ok } from "../../common/api-response.js";
import { AuthenticatedAccess, RequirePermissions } from "../../common/permissions.decorator.js";
import { resolveRequestContext } from "../../common/request-context.js";
import { resolveRequestId } from "../../common/request-id.js";
import { parseWithSchema } from "../../common/zod-validation.js";
import { LaborPolicyService } from "./labor-policy.service.js";

type Req_ = { headers?: Record<string, unknown> };

const idSchema = z.string().trim().min(1).max(64);
const minuteOfDay = z.number().int().min(0).max(1439);
const policySchema = z.object({
  name: z.string().trim().min(2).max(120),
  worksiteId: idSchema.optional(),
  weekdays: z.array(z.number().int().min(0).max(6)).min(1).max(7),
  scheduledStartMinute: minuteOfDay,
  scheduledEndMinute: minuteOfDay,
  expectedBreakMinutes: z.number().int().min(0).max(480).optional(),
  overtimeAfterMinutesPerDay: z.number().int().min(60).max(1440).optional()
});
const correctionSchema = z.object({
  timeEntryId: idSchema,
  startedAt: z.coerce.date().optional(),
  endedAt: z.coerce.date().optional(),
  breakMinutes: z.number().int().min(0).max(1440).optional(),
  reason: z.string().trim().min(5).max(500)
});
const statusQuery = z.object({ status: z.enum(["PENDING", "APPROVED", "REJECTED", "CANCELED"]).optional() });
const reviewSchema = z.object({ note: z.string().trim().max(500).optional() });

/** BO-08: política de horario y revisión de correcciones de una Org. Spec: docs/specs/core/labor-policy.spec.md */
@Controller("v1/organizations/:orgId/labor")
export class OrgLaborController {
  constructor(private readonly labor: LaborPolicyService) {}

  @Post("policies")
  @RequirePermissions("org:labor:manage")
  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  async createPolicy(@Req() req: Req_, @Param("orgId") orgId: string, @Body() body: unknown) {
    const actor = resolveRequestContext(req);
    const data = await this.labor.createPolicy(
      actor,
      parseWithSchema(idSchema, orgId),
      resolveRequestId(req.headers ?? {}),
      parseWithSchema(policySchema, body)
    );
    return ok(resolveRequestId(req.headers ?? {}), data);
  }

  @Get("policies")
  @RequirePermissions("org:labor:manage")
  async listPolicies(@Req() req: Req_, @Param("orgId") orgId: string) {
    const actor = resolveRequestContext(req);
    const data = await this.labor.listPolicies(actor, parseWithSchema(idSchema, orgId));
    return ok(resolveRequestId(req.headers ?? {}), data);
  }

  @Get("corrections")
  @RequirePermissions("org:labor:manage")
  async listCorrections(@Req() req: Req_, @Param("orgId") orgId: string, @Query() query: unknown) {
    const actor = resolveRequestContext(req);
    const { status } = parseWithSchema(statusQuery, query ?? {});
    const data = await this.labor.listForOrg(actor, parseWithSchema(idSchema, orgId), status);
    return ok(resolveRequestId(req.headers ?? {}), data);
  }

  @Post("corrections/:correctionId/approve")
  @HttpCode(200)
  @RequirePermissions("org:labor:manage")
  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  async approve(@Req() req: Req_, @Param("orgId") orgId: string, @Param("correctionId") id: string, @Body() body: unknown) {
    return this.review(req, orgId, id, body, "APPROVE");
  }

  @Post("corrections/:correctionId/reject")
  @HttpCode(200)
  @RequirePermissions("org:labor:manage")
  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  async reject(@Req() req: Req_, @Param("orgId") orgId: string, @Param("correctionId") id: string, @Body() body: unknown) {
    return this.review(req, orgId, id, body, "REJECT");
  }

  private async review(req: Req_, orgId: string, id: string, body: unknown, decision: "APPROVE" | "REJECT") {
    const actor = resolveRequestContext(req);
    const requestId = resolveRequestId(req.headers ?? {});
    const { note } = parseWithSchema(reviewSchema, body ?? {});
    const data = await this.labor.review(
      actor,
      parseWithSchema(idSchema, orgId),
      parseWithSchema(idSchema, id),
      decision,
      note,
      requestId
    );
    return ok(requestId, data);
  }
}

/** BO-08: el trabajador solicita corrección de sus propias horas. */
@Controller("v1/labor/corrections")
export class MyLaborCorrectionsController {
  constructor(private readonly labor: LaborPolicyService) {}

  @Post()
  @AuthenticatedAccess("La persona solicita corregir únicamente sus propios registros de tiempo")
  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  async request(@Req() req: Req_, @Body() body: unknown) {
    const actor = resolveRequestContext(req);
    const requestId = resolveRequestId(req.headers ?? {});
    const data = await this.labor.requestCorrection(
      { tenantId: actor.tenantId, userId: actor.userId },
      requestId,
      parseWithSchema(correctionSchema, body)
    );
    return ok(requestId, data);
  }

  @Get("mine")
  @AuthenticatedAccess("La persona lee únicamente sus propias solicitudes de corrección")
  async mine(@Req() req: Req_) {
    const actor = resolveRequestContext(req);
    const data = await this.labor.listMine({ tenantId: actor.tenantId, userId: actor.userId });
    return ok(resolveRequestId(req.headers ?? {}), data);
  }
}
