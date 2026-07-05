import {
  Body, Controller, Get, Param, Patch, Post, Query, Req,
} from "@nestjs/common";
import { z } from "zod";
import { ok } from "../../common/api-response.js";
import { resolveRequestId } from "../../common/request-id.js";
import { RequirePermissions } from "../../common/permissions.decorator.js";
import { resolveRequestContext } from "../../common/request-context.js";
import { AgroTraceabilityService } from "./agro-traceability.service.js";

const eventTypeEnum = z.enum(["ORIGIN", "TRANSFER", "TREATMENT", "HARVEST", "PROCESSING", "SALE"]);
const checkTypeEnum = z.enum(["VACCINATION_RECORD", "PESTICIDE_WITHDRAWAL", "WATER_QUALITY", "SANITARY_CERT", "CUSTOM"]);

const createEventSchema = z.object({
  entityType:         z.string().min(1),
  entityId:           z.string().min(1),
  eventType:          eventTypeEnum,
  description:        z.string().min(1),
  occurredAt:         z.string(),
  productionCycleId:  z.string().optional(),
  latitude:           z.number().optional(),
  longitude:          z.number().optional(),
  evidenceUrls:       z.array(z.string()).optional(),
  verifiedBy:         z.string().optional(),
});

const createCheckSchema = z.object({
  checkType:   checkTypeEnum,
  entityType:  z.string().optional(),
  entityId:    z.string().optional(),
  dueDate:     z.string().optional(),
  notes:       z.string().optional(),
});

const resolveCheckSchema = z.object({
  status:       z.enum(["COMPLIANT", "NON_COMPLIANT", "WAIVED"]),
  notes:        z.string().optional(),
  evidenceUrls: z.array(z.string()).optional(),
  reviewedBy:   z.string().optional(),
});

@Controller("v1/agro")
export class AgroTraceabilityController {
  constructor(private readonly service: AgroTraceabilityService) {}

  // ── Traceability Events ────────────────────────────────────────────────────

  @Get("farms/:farmId/traceability")
  @RequirePermissions("agro:read")
  async listEvents(
    @Param("farmId") farmId: string,
    @Query("entityType") entityType: string | undefined,
    @Query("entityId") entityId: string | undefined,
    @Query("productionCycleId") productionCycleId: string | undefined,
    @Req() req: any,
  ) {
    const ctx = resolveRequestContext(req);
    const events = await this.service.listTraceabilityEvents(farmId, ctx.userId, {
      entityType, entityId, productionCycleId,
    });
    return ok(resolveRequestId(req.headers ?? {}), { events });
  }

  @Post("farms/:farmId/traceability")
  @RequirePermissions("agro:write")
  async createEvent(
    @Param("farmId") farmId: string,
    @Body() body: unknown,
    @Req() req: any,
  ) {
    const ctx = resolveRequestContext(req);
    const parsed = createEventSchema.parse(body);
    const event = await this.service.createTraceabilityEvent(farmId, ctx.userId, parsed);
    return ok(resolveRequestId(req.headers ?? {}), { event });
  }

  @Get("farms/:farmId/traceability/:entityType/:entityId/timeline")
  @RequirePermissions("agro:read")
  async getTimeline(
    @Param("farmId") farmId: string,
    @Param("entityType") entityType: string,
    @Param("entityId") entityId: string,
    @Req() req: any,
  ) {
    const ctx = resolveRequestContext(req);
    const timeline = await this.service.getEntityTimeline(farmId, ctx.userId, entityType, entityId);
    return ok(resolveRequestId(req.headers ?? {}), { timeline });
  }

  // ── Compliance Checks ──────────────────────────────────────────────────────

  @Get("farms/:farmId/compliance")
  @RequirePermissions("agro:read")
  async listChecks(
    @Param("farmId") farmId: string,
    @Query("status") status: string | undefined,
    @Req() req: any,
  ) {
    const ctx = resolveRequestContext(req);
    const checks = await this.service.listComplianceChecks(farmId, ctx.userId, status);
    return ok(resolveRequestId(req.headers ?? {}), { checks });
  }

  @Get("farms/:farmId/compliance/summary")
  @RequirePermissions("agro:read")
  async getComplianceSummary(@Param("farmId") farmId: string, @Req() req: any) {
    const ctx = resolveRequestContext(req);
    const summary = await this.service.getComplianceSummary(farmId, ctx.userId);
    return ok(resolveRequestId(req.headers ?? {}), { summary });
  }

  @Post("farms/:farmId/compliance")
  @RequirePermissions("agro:write")
  async createCheck(
    @Param("farmId") farmId: string,
    @Body() body: unknown,
    @Req() req: any,
  ) {
    const ctx = resolveRequestContext(req);
    const parsed = createCheckSchema.parse(body);
    const check = await this.service.createComplianceCheck(farmId, ctx.userId, parsed);
    return ok(resolveRequestId(req.headers ?? {}), { check });
  }

  @Patch("compliance/:checkId/resolve")
  @RequirePermissions("agro:write")
  async resolveCheck(
    @Param("checkId") checkId: string,
    @Body() body: unknown,
    @Req() req: any,
  ) {
    const ctx = resolveRequestContext(req);
    const parsed = resolveCheckSchema.parse(body);
    const check = await this.service.resolveComplianceCheck(checkId, ctx.userId, parsed);
    return ok(resolveRequestId(req.headers ?? {}), { check });
  }
}
