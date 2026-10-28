import { Body, Controller, Get, HttpCode, Param, Post, Req } from "@nestjs/common";
import { Throttle } from "@nestjs/throttler";
import { z } from "zod";
import { ok } from "../../common/api-response.js";
import { AuthenticatedAccess } from "../../common/permissions.decorator.js";
import { resolveRequestContext } from "../../common/request-context.js";
import { resolveRequestId } from "../../common/request-id.js";
import { parseWithSchema } from "../../common/zod-validation.js";
import { DailyReportsService } from "./daily-reports.service.js";

type Req_ = { headers?: Record<string, unknown> };

const idSchema = z.string().trim().min(1).max(64);
const dateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
const generateSchema = z.object({
  reportDate: dateSchema,
  tzOffsetMinutes: z.number().int().min(-840).max(840).optional(),
  notes: z.string().trim().max(2000).optional()
});
const reviewSchema = z.object({
  decision: z.enum(["APPROVE", "RETURN"]),
  note: z.string().trim().max(500).optional()
});

const CREW_SCOPE =
  "La autorización es ser el supervisor vigente de esa cuadrilla (o gestor de cuadrillas de la Org); se revalida la membresía en cada llamada";
const REVIEW_SCOPE =
  "Solo un gestor de cuadrillas vigente de la Org del reporte, distinto de quien lo generó; se revalida la membresía en cada llamada";

/** BO-11: reportes diarios de una cuadrilla. Spec: docs/specs/core/daily-reports.spec.md */
@Controller("v1/crews/:crewId/daily-reports")
export class CrewDailyReportsController {
  constructor(private readonly reports: DailyReportsService) {}

  @Post()
  @AuthenticatedAccess(CREW_SCOPE)
  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  async generate(@Req() req: Req_, @Param("crewId") crewId: string, @Body() body: unknown) {
    const actor = resolveRequestContext(req);
    const requestId = resolveRequestId(req.headers ?? {});
    const data = await this.reports.generate(actor, parseWithSchema(idSchema, crewId), requestId, parseWithSchema(generateSchema, body));
    return ok(requestId, data);
  }

  @Get()
  @AuthenticatedAccess(CREW_SCOPE)
  async list(@Req() req: Req_, @Param("crewId") crewId: string) {
    const actor = resolveRequestContext(req);
    const data = await this.reports.listForCrew(actor, parseWithSchema(idSchema, crewId));
    return ok(resolveRequestId(req.headers ?? {}), data);
  }

  @Get(":reportDate")
  @AuthenticatedAccess(CREW_SCOPE)
  async get(@Req() req: Req_, @Param("crewId") crewId: string, @Param("reportDate") reportDate: string) {
    const actor = resolveRequestContext(req);
    const data = await this.reports.getForCrew(actor, parseWithSchema(idSchema, crewId), parseWithSchema(dateSchema, reportDate));
    return ok(resolveRequestId(req.headers ?? {}), data);
  }
}

/** BO-11: revisión y publicación por un humano distinto del generador. */
@Controller("v1/daily-reports")
export class DailyReportReviewController {
  constructor(private readonly reports: DailyReportsService) {}

  @Post(":reportId/review")
  @HttpCode(200)
  @AuthenticatedAccess(REVIEW_SCOPE)
  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  async review(@Req() req: Req_, @Param("reportId") reportId: string, @Body() body: unknown) {
    const actor = resolveRequestContext(req);
    const requestId = resolveRequestId(req.headers ?? {});
    const { decision, note } = parseWithSchema(reviewSchema, body);
    const data = await this.reports.review(actor, parseWithSchema(idSchema, reportId), decision, note, requestId);
    return ok(requestId, data);
  }

  @Post(":reportId/publish")
  @HttpCode(200)
  @AuthenticatedAccess(REVIEW_SCOPE)
  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  async publish(@Req() req: Req_, @Param("reportId") reportId: string) {
    const actor = resolveRequestContext(req);
    const requestId = resolveRequestId(req.headers ?? {});
    const data = await this.reports.publish(actor, parseWithSchema(idSchema, reportId), requestId);
    return ok(requestId, data);
  }
}
