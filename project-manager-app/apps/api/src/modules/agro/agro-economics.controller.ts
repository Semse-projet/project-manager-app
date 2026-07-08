import {
  Body, Controller, Delete, Get, Param, Post, Query, Req,
} from "@nestjs/common";
import { z } from "zod";
import { ok } from "../../common/api-response.js";
import { resolveRequestId } from "../../common/request-id.js";
import { RequirePermissions } from "../../common/permissions.decorator.js";
import { resolveRequestContext } from "../../common/request-context.js";
import { AgroProductionService } from "./agro-production.service.js";
import { AgroProfitabilityService } from "./agro-profitability.service.js";
import { AgroSaleService } from "./agro-sale.service.js";
import { AgroSimulatorService } from "./agro-simulator.service.js";

const createProductionSchema = z.object({
  targetType: z.enum(["ANIMAL", "ANIMAL_GROUP", "FARM"]),
  targetId:   z.string().optional(),
  type:       z.enum(["MILK", "EGGS", "WEIGHT_GAIN", "BIRTH", "WOOL", "HONEY", "BREEDING_SERVICE", "OTHER"]),
  quantity:   z.number().positive(),
  unit:       z.enum(["LITER", "UNIT", "DOZEN", "LB", "KG", "HEAD", "OTHER"]),
  unitPrice:  z.number().nonnegative().optional(),
  occurredAt: z.coerce.date().optional(),
  notes:      z.string().optional(),
});

const saleSchema = z.object({
  buyerName:     z.string().optional(),
  quantity:      z.number().int().positive().optional(),
  saleWeight:    z.number().positive().optional(),
  salePrice:     z.number().positive(),
  freightCost:   z.number().nonnegative().optional(),
  commission:    z.number().nonnegative().optional(),
  paymentMethod: z.enum(["CASH", "TRANSFER", "CHECK", "CREDIT", "OTHER"]).optional(),
  occurredAt:    z.coerce.date().optional(),
  notes:         z.string().optional(),
});

const simulatePurchaseSchema = z.object({
  species:                   z.string().optional(),
  purpose:                   z.string().optional(),
  quantity:                  z.number().int().positive().optional(),
  purchasePrice:             z.number().positive(),
  freightCost:               z.number().nonnegative().optional(),
  feedCostProjected:         z.number().nonnegative().optional(),
  medicineCost:              z.number().nonnegative().optional(),
  laborCost:                 z.number().nonnegative().optional(),
  otherCosts:                z.number().nonnegative().optional(),
  expectedSalePrice:         z.number().positive(),
  expectedProductionIncome:  z.number().nonnegative().optional(),
  holdingDays:               z.number().int().positive().optional(),
  expectedMortalityPercent:  z.number().min(0).max(99).optional(),
});

@Controller("v1/agro")
export class AgroEconomicsController {
  constructor(
    private readonly production: AgroProductionService,
    private readonly profitability: AgroProfitabilityService,
    private readonly sales: AgroSaleService,
    private readonly simulator: AgroSimulatorService,
  ) {}

  // ── Production ────────────────────────────────────────────────────────────

  @Get("farms/:farmId/production")
  @RequirePermissions("agro:read")
  async listProduction(
    @Param("farmId") farmId: string,
    @Query("type") type: string | undefined,
    @Query("targetType") targetType: string | undefined,
    @Query("targetId") targetId: string | undefined,
    @Req() req: any,
  ) {
    const ctx = resolveRequestContext(req);
    const records = await this.production.listRecords(farmId, ctx.userId, { type, targetType, targetId });
    return ok(resolveRequestId(req.headers ?? {}), { records });
  }

  @Post("farms/:farmId/production")
  @RequirePermissions("agro:write")
  async createProduction(@Param("farmId") farmId: string, @Body() body: unknown, @Req() req: any) {
    const ctx = resolveRequestContext(req);
    const input = createProductionSchema.parse(body);
    const record = await this.production.createRecord(farmId, ctx.userId, input);
    return ok(resolveRequestId(req.headers ?? {}), { record });
  }

  @Get("farms/:farmId/production/summary")
  @RequirePermissions("agro:read")
  async productionSummary(@Param("farmId") farmId: string, @Query("days") days: string | undefined, @Req() req: any) {
    const ctx = resolveRequestContext(req);
    const summary = await this.production.getSummary(farmId, ctx.userId, days ? Number(days) : 30);
    return ok(resolveRequestId(req.headers ?? {}), { summary });
  }

  @Delete("production/:recordId")
  @RequirePermissions("agro:write")
  async deleteProduction(@Param("recordId") recordId: string, @Req() req: any) {
    const ctx = resolveRequestContext(req);
    const result = await this.production.deleteRecord(recordId, ctx.userId);
    return ok(resolveRequestId(req.headers ?? {}), result);
  }

  // ── Profitability ─────────────────────────────────────────────────────────

  @Get("farms/:farmId/profitability")
  @RequirePermissions("agro:read")
  async farmProfitability(@Param("farmId") farmId: string, @Req() req: any) {
    const ctx = resolveRequestContext(req);
    const result = await this.profitability.getFarmProfitability(farmId, ctx.userId);
    return ok(resolveRequestId(req.headers ?? {}), result);
  }

  @Get("animals/:animalId/profitability")
  @RequirePermissions("agro:read")
  async animalProfitability(@Param("animalId") animalId: string, @Req() req: any) {
    const ctx = resolveRequestContext(req);
    const profitability = await this.profitability.getAnimalProfitability(animalId, ctx.userId);
    return ok(resolveRequestId(req.headers ?? {}), { profitability });
  }

  @Get("animal-groups/:groupId/profitability")
  @RequirePermissions("agro:read")
  async groupProfitability(@Param("groupId") groupId: string, @Req() req: any) {
    const ctx = resolveRequestContext(req);
    const profitability = await this.profitability.getGroupProfitability(groupId, ctx.userId);
    return ok(resolveRequestId(req.headers ?? {}), { profitability });
  }

  // ── Sales ─────────────────────────────────────────────────────────────────

  @Get("farms/:farmId/sales")
  @RequirePermissions("agro:read")
  async listSales(@Param("farmId") farmId: string, @Req() req: any) {
    const ctx = resolveRequestContext(req);
    const sales = await this.sales.listSales(farmId, ctx.userId);
    return ok(resolveRequestId(req.headers ?? {}), { sales });
  }

  @Get("farms/:farmId/sales/summary")
  @RequirePermissions("agro:read")
  async salesSummary(@Param("farmId") farmId: string, @Query("days") days: string | undefined, @Req() req: any) {
    const ctx = resolveRequestContext(req);
    const summary = await this.sales.getSummary(farmId, ctx.userId, days ? Number(days) : 30);
    return ok(resolveRequestId(req.headers ?? {}), { summary });
  }

  @Post("animals/:animalId/sell")
  @RequirePermissions("agro:write")
  async sellAnimal(@Param("animalId") animalId: string, @Body() body: unknown, @Req() req: any) {
    const ctx = resolveRequestContext(req);
    const input = saleSchema.parse(body);
    const result = await this.sales.sellAnimal(animalId, ctx.userId, input);
    return ok(resolveRequestId(req.headers ?? {}), result);
  }

  @Post("animal-groups/:groupId/sell")
  @RequirePermissions("agro:write")
  async sellGroup(@Param("groupId") groupId: string, @Body() body: unknown, @Req() req: any) {
    const ctx = resolveRequestContext(req);
    const input = saleSchema.parse(body);
    const result = await this.sales.sellGroup(groupId, ctx.userId, input);
    return ok(resolveRequestId(req.headers ?? {}), result);
  }

  // ── Purchase simulator ────────────────────────────────────────────────────

  @Post("simulator/purchase")
  @RequirePermissions("agro:read")
  async simulatePurchase(@Body() body: unknown, @Req() req: any) {
    const input = simulatePurchaseSchema.parse(body);
    const simulation = this.simulator.simulatePurchase(input);
    return ok(resolveRequestId(req.headers ?? {}), { simulation });
  }
}
