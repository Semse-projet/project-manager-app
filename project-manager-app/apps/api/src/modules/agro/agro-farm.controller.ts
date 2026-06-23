import {
  Body, Controller, Get,
  Param, Patch, Post, Query, Req,
} from "@nestjs/common";
import { z } from "zod";
import { ok } from "../../common/api-response.js";
import { resolveRequestId } from "../../common/request-id.js";
import { RequirePermissions } from "../../common/permissions.decorator.js";
import { resolveRequestContext } from "../../common/request-context.js";
import { AgroFarmService } from "./agro-farm.service.js";

const createFarmSchema = z.object({
  name:          z.string().min(1),
  operationType: z.enum(["LIVESTOCK", "MIXED", "CROP"]).optional(),
  locationLabel: z.string().optional(),
  notes:         z.string().optional(),
});

const updateFarmSchema = z.object({
  name:          z.string().min(1).optional(),
  operationType: z.enum(["LIVESTOCK", "MIXED", "CROP"]).optional(),
  locationLabel: z.string().optional(),
  notes:         z.string().optional(),
});

const createUnitSchema = z.object({
  name:      z.string().min(1),
  type:      z.enum(["PASTURE", "CORRAL", "BARN", "STORAGE", "WATER_SOURCE", "WORK_AREA", "FIELD", "GREENHOUSE", "OTHER"]).optional(),
  areaValue: z.number().positive().optional(),
  areaUnit:  z.enum(["SQFT", "ACRE", "HECTARE", "MANZANA", "OTHER"]).optional(),
  notes:     z.string().optional(),
});

const updateUnitSchema = createUnitSchema.partial();

@Controller("v1/agro")
export class AgroFarmController {
  constructor(private readonly service: AgroFarmService) {}

  // ── Farms ──────────────────────────────────────────────────────────────────

  @Get("farms")
  @RequirePermissions("agro:read")
  async listFarms(@Req() req: any) {
    const ctx = resolveRequestContext(req);
    const farms = await this.service.listFarms(ctx.userId);
    return ok(resolveRequestId(req.headers ?? {}), { farms });
  }

  @Post("farms")
  @RequirePermissions("agro:write")
  async createFarm(@Body() body: unknown, @Req() req: any) {
    const ctx = resolveRequestContext(req);
    const input = createFarmSchema.parse(body);
    const farm = await this.service.createFarm({ ownerId: ctx.userId, ...input });
    return ok(resolveRequestId(req.headers ?? {}), { farm });
  }

  @Get("farms/:farmId")
  @RequirePermissions("agro:read")
  async getFarm(@Param("farmId") farmId: string, @Req() req: any) {
    const ctx = resolveRequestContext(req);
    const farm = await this.service.getFarm(farmId, ctx.userId);
    return ok(resolveRequestId(req.headers ?? {}), { farm });
  }

  @Patch("farms/:farmId")
  @RequirePermissions("agro:write")
  async updateFarm(
    @Param("farmId") farmId: string,
    @Body() body: unknown,
    @Req() req: any,
  ) {
    const ctx = resolveRequestContext(req);
    const input = updateFarmSchema.parse(body);
    const farm = await this.service.updateFarm(farmId, ctx.userId, input);
    return ok(resolveRequestId(req.headers ?? {}), { farm });
  }

  // ── Farm Units ─────────────────────────────────────────────────────────────

  @Get("farms/:farmId/units")
  @RequirePermissions("agro:read")
  async listUnits(@Param("farmId") farmId: string, @Req() req: any) {
    const ctx = resolveRequestContext(req);
    const units = await this.service.listUnits(farmId, ctx.userId);
    return ok(resolveRequestId(req.headers ?? {}), { units });
  }

  @Post("farms/:farmId/units")
  @RequirePermissions("agro:write")
  async createUnit(
    @Param("farmId") farmId: string,
    @Body() body: unknown,
    @Req() req: any,
  ) {
    const ctx = resolveRequestContext(req);
    const input = createUnitSchema.parse(body);
    const unit = await this.service.createUnit(farmId, ctx.userId, input);
    return ok(resolveRequestId(req.headers ?? {}), { unit });
  }

  @Get("farm-units/:unitId")
  @RequirePermissions("agro:read")
  async getUnit(@Param("unitId") unitId: string, @Req() req: any) {
    const unit = await this.service.getUnit(unitId);
    return ok(resolveRequestId(req.headers ?? {}), { unit });
  }

  @Patch("farm-units/:unitId")
  @RequirePermissions("agro:write")
  async updateUnit(
    @Param("unitId") unitId: string,
    @Body() body: unknown,
    @Req() req: any,
  ) {
    const ctx = resolveRequestContext(req);
    const input = updateUnitSchema.parse(body);
    const unit = await this.service.updateUnit(unitId, ctx.userId, input);
    return ok(resolveRequestId(req.headers ?? {}), { unit });
  }

  // ── Audit Events ───────────────────────────────────────────────────────────

  @Get("farms/:farmId/audit-events")
  @RequirePermissions("agro:read")
  async getAuditEvents(
    @Param("farmId") farmId: string,
    @Query("limit") limit: string | undefined,
    @Req() req: any,
  ) {
    const ctx = resolveRequestContext(req);
    const events = await this.service.getAuditEvents(
      farmId,
      ctx.userId,
      limit ? Math.min(parseInt(limit, 10), 200) : 50,
    );
    return ok(resolveRequestId(req.headers ?? {}), { events });
  }
}
