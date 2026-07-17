import {
  Body, Controller, Get, Param, Patch, Post, Query, Req,
} from "@nestjs/common";
import { z } from "zod";
import { ok } from "../../common/api-response.js";
import { resolveRequestId } from "../../common/request-id.js";
import { RequirePermissions } from "../../common/permissions.decorator.js";
import { resolveRequestContext } from "../../common/request-context.js";
import { AgroInventoryService } from "./agro-inventory.service.js";
import { parsePositiveInt } from "../../common/parse-query.js";

const categoryEnum    = z.enum(["FEED","MEDICINE","VACCINE","FERTILIZER","SEED","FUEL","TOOL","MATERIAL","EQUIPMENT","OTHER"]);
const unitEnum        = z.enum(["UNIT","LB","KG","TON","LITER","GALLON","BAG","BOX","DOSE","BOTTLE","OTHER"]);
const movementEnum    = z.enum(["IN","OUT","ADJUSTMENT"]);
const costCatEnum     = z.enum(["FEED","VETERINARY","LABOR","EQUIPMENT","TRANSPORT","INFRASTRUCTURE","SEED","FERTILIZER","FUEL","OTHER"]);

const createItemSchema = z.object({
  name:         z.string().min(1),
  category:     categoryEnum,
  unit:         unitEnum,
  minimumStock: z.number().nonnegative().optional(),
  notes:        z.string().optional(),
});

const updateItemSchema = z.object({
  name:         z.string().min(1).optional(),
  minimumStock: z.number().nonnegative().nullable().optional(),
  notes:        z.string().optional(),
});

const movementSchema = z.object({
  itemId:         z.string(),
  movementType:   movementEnum,
  quantity:       z.number().positive().optional(),
  adjustmentDelta:z.number().optional(),
  unitCost:       z.number().nonnegative().optional(),
  relatedTaskId:  z.string().optional(),
  targetType:     z.string().optional(),
  targetId:       z.string().optional(),
  occurredAt:     z.coerce.date().optional(),
  notes:          z.string().optional(),
});

const consumeSchema = z.object({
  itemId:        z.string(),
  quantity:      z.number().positive(),
  unitCost:      z.number().nonnegative().optional(),
  relatedTaskId: z.string().optional(),
  targetType:    z.string().optional(),
  targetId:      z.string().optional(),
  notes:         z.string().optional(),
});

const manualCostSchema = z.object({
  targetType:  z.string().min(1),
  targetId:    z.string().optional(),
  category:    costCatEnum,
  amount:      z.number().positive(),
  currency:    z.string().optional(),
  description: z.string().optional(),
  occurredAt:  z.coerce.date().optional(),
});

@Controller("v1/agro")
export class AgroInventoryController {
  constructor(private readonly service: AgroInventoryService) {}

  // ── Items ─────────────────────────────────────────────────────────────────

  @Get("farms/:farmId/inventory/items")
  @RequirePermissions("agro:read")
  async listItems(@Param("farmId") farmId: string, @Req() req: any) {
    const ctx = resolveRequestContext(req);
    const items = await this.service.listItems(farmId, ctx.userId);
    return ok(resolveRequestId(req.headers ?? {}), { items });
  }

  @Post("farms/:farmId/inventory/items")
  @RequirePermissions("agro:write")
  async createItem(@Param("farmId") farmId: string, @Body() body: unknown, @Req() req: any) {
    const ctx = resolveRequestContext(req);
    const input = createItemSchema.parse(body);
    const item = await this.service.createItem(farmId, ctx.userId, input);
    return ok(resolveRequestId(req.headers ?? {}), { item });
  }

  @Get("inventory/items/:itemId")
  @RequirePermissions("agro:read")
  async getItem(@Param("itemId") itemId: string, @Req() req: any) {
    const item = await this.service.getItem(itemId);
    return ok(resolveRequestId(req.headers ?? {}), { item });
  }

  @Patch("inventory/items/:itemId")
  @RequirePermissions("agro:write")
  async updateItem(@Param("itemId") itemId: string, @Body() body: unknown, @Req() req: any) {
    const ctx = resolveRequestContext(req);
    const input = updateItemSchema.parse(body);
    const item = await this.service.updateItem(itemId, ctx.userId, input);
    return ok(resolveRequestId(req.headers ?? {}), { item });
  }

  @Get("inventory/items/:itemId/stock")
  @RequirePermissions("agro:read")
  async getItemStock(@Param("itemId") itemId: string, @Req() req: any) {
    const ctx = resolveRequestContext(req);
    const result = await this.service.getItemStock(itemId, ctx.userId);
    return ok(resolveRequestId(req.headers ?? {}), result);
  }

  @Get("inventory/items/:itemId/movements")
  @RequirePermissions("agro:read")
  async getItemMovements(@Param("itemId") itemId: string, @Req() req: any) {
    const item = await this.service.getItem(itemId);
    const ctx = resolveRequestContext(req);
    const movements = await this.service.listMovements(item.farmId, ctx.userId, itemId);
    return ok(resolveRequestId(req.headers ?? {}), { movements });
  }

  // ── Movements ─────────────────────────────────────────────────────────────

  @Get("farms/:farmId/inventory/movements")
  @RequirePermissions("agro:read")
  async listMovements(@Param("farmId") farmId: string, @Req() req: any) {
    const ctx = resolveRequestContext(req);
    const movements = await this.service.listMovements(farmId, ctx.userId);
    return ok(resolveRequestId(req.headers ?? {}), { movements });
  }

  @Post("farms/:farmId/inventory/movements")
  @RequirePermissions("agro:write")
  async recordMovement(@Param("farmId") farmId: string, @Body() body: unknown, @Req() req: any) {
    const ctx = resolveRequestContext(req);
    const input = movementSchema.parse(body);
    const movement = await this.service.recordMovement(farmId, ctx.userId, input as any);
    return ok(resolveRequestId(req.headers ?? {}), { movement });
  }

  @Post("farms/:farmId/inventory/consume")
  @RequirePermissions("agro:write")
  async consumeInventory(@Param("farmId") farmId: string, @Body() body: unknown, @Req() req: any) {
    const ctx = resolveRequestContext(req);
    const input = consumeSchema.parse(body);
    const movement = await this.service.consumeInventory(farmId, ctx.userId, input);
    return ok(resolveRequestId(req.headers ?? {}), { movement });
  }

  // ── Cost Entries ──────────────────────────────────────────────────────────

  @Get("farms/:farmId/costs")
  @RequirePermissions("agro:read")
  async listCosts(
    @Param("farmId") farmId: string,
    @Query("targetType") targetType: string | undefined,
    @Query("targetId") targetId: string | undefined,
    @Req() req: any,
  ) {
    const ctx = resolveRequestContext(req);
    const costs = await this.service.listCosts(farmId, ctx.userId, { targetType, targetId });
    return ok(resolveRequestId(req.headers ?? {}), { costs });
  }

  @Post("farms/:farmId/costs")
  @RequirePermissions("agro:write")
  async createCost(@Param("farmId") farmId: string, @Body() body: unknown, @Req() req: any) {
    const ctx = resolveRequestContext(req);
    const input = manualCostSchema.parse(body);
    const cost = await this.service.createManualCost(farmId, ctx.userId, input);
    return ok(resolveRequestId(req.headers ?? {}), { cost });
  }

  @Get("farms/:farmId/costs/summary")
  @RequirePermissions("agro:read")
  async getCostSummary(
    @Param("farmId") farmId: string,
    @Query("days") days: string | undefined,
    @Req() req: any,
  ) {
    const ctx = resolveRequestContext(req);
    const summary = await this.service.getCostSummary(
      farmId, ctx.userId,
      parsePositiveInt(days, 30),
    );
    return ok(resolveRequestId(req.headers ?? {}), { summary });
  }

  @Get("entities/:targetType/:targetId/costs")
  @RequirePermissions("agro:read")
  async getEntityCosts(
    @Param("targetType") targetType: string,
    @Param("targetId") targetId: string,
    @Query("farmId") farmId: string,
    @Req() req: any,
  ) {
    const ctx = resolveRequestContext(req);
    const costs = await this.service.listCosts(farmId, ctx.userId, { targetType, targetId });
    return ok(resolveRequestId(req.headers ?? {}), { costs });
  }
}
