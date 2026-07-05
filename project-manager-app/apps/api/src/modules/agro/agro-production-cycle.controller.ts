import {
  Body, Controller, Get, Param, Patch, Post, Query, Req,
} from "@nestjs/common";
import { z } from "zod";
import { ok } from "../../common/api-response.js";
import { resolveRequestId } from "../../common/request-id.js";
import { RequirePermissions } from "../../common/permissions.decorator.js";
import { resolveRequestContext } from "../../common/request-context.js";
import { AgroProductionCycleService } from "./agro-production-cycle.service.js";

const cycleTypeEnum = z.enum(["CATTLE_ROUND", "CROP_SEASON", "MIXED"]);
const inputTypeEnum = z.enum(["FERTILIZER", "PESTICIDE", "HERBICIDE", "WATER", "SEED", "OTHER"]);
const gradeEnum     = z.enum(["A", "B", "C", "REJECT"]);
const destTypeEnum  = z.enum(["SALE", "SELF_CONSUMPTION", "SEED", "LOSS"]);

const createCycleSchema = z.object({
  name:      z.string().min(1),
  cycleType: cycleTypeEnum,
  startDate: z.string(),
  endDate:   z.string().optional(),
  notes:     z.string().optional(),
});

const updateCycleSchema = z.object({
  name:    z.string().min(1).optional(),
  status:  z.string().optional(),
  endDate: z.string().nullable().optional(),
  notes:   z.string().nullable().optional(),
});

const createCropSchema = z.object({
  cropName:             z.string().min(1),
  cropVariety:          z.string().optional(),
  productionCycleId:    z.string().optional(),
  fieldUnitId:          z.string().optional(),
  sowingDate:           z.string().optional(),
  expectedHarvestDate:  z.string().optional(),
  areaHectares:         z.number().positive().optional(),
  seedQuantityKg:       z.number().positive().optional(),
  notes:                z.string().optional(),
});

const inputApplicationSchema = z.object({
  inputType:   inputTypeEnum,
  productName: z.string().min(1),
  quantity:    z.number().positive(),
  unit:        z.enum(["KG", "L", "GRAM", "ML", "DOSE"]),
  appliedAt:   z.string(),
  fieldUnitId: z.string().optional(),
  notes:       z.string().optional(),
});

const harvestSchema = z.object({
  harvestedAt:     z.string(),
  quantityKg:      z.number().positive(),
  qualityGrade:    gradeEnum.optional(),
  storageLocation: z.string().optional(),
  destinationType: destTypeEnum.optional(),
  notes:           z.string().optional(),
});

@Controller("v1/agro")
export class AgroProductionCycleController {
  constructor(private readonly service: AgroProductionCycleService) {}

  // ── Production Cycles ──────────────────────────────────────────────────────

  @Get("farms/:farmId/cycles")
  @RequirePermissions("agro:read")
  async listCycles(@Param("farmId") farmId: string, @Req() req: any) {
    const ctx = resolveRequestContext(req);
    const cycles = await this.service.listCycles(farmId, ctx.userId);
    return ok(resolveRequestId(req.headers ?? {}), { cycles });
  }

  @Post("farms/:farmId/cycles")
  @RequirePermissions("agro:write")
  async createCycle(
    @Param("farmId") farmId: string,
    @Body() body: unknown,
    @Req() req: any,
  ) {
    const ctx = resolveRequestContext(req);
    const parsed = createCycleSchema.parse(body);
    const cycle = await this.service.createCycle(farmId, ctx.userId, parsed);
    return ok(resolveRequestId(req.headers ?? {}), { cycle });
  }

  @Get("cycles/:cycleId")
  @RequirePermissions("agro:read")
  async getCycle(@Param("cycleId") cycleId: string, @Req() req: any) {
    const ctx = resolveRequestContext(req);
    const cycle = await this.service.getCycle(cycleId, ctx.userId);
    return ok(resolveRequestId(req.headers ?? {}), { cycle });
  }

  @Patch("cycles/:cycleId")
  @RequirePermissions("agro:write")
  async updateCycle(
    @Param("cycleId") cycleId: string,
    @Body() body: unknown,
    @Req() req: any,
  ) {
    const ctx = resolveRequestContext(req);
    const parsed = updateCycleSchema.parse(body);
    const cycle = await this.service.updateCycle(cycleId, ctx.userId, parsed);
    return ok(resolveRequestId(req.headers ?? {}), { cycle });
  }

  // ── Crop Cycles ────────────────────────────────────────────────────────────

  @Get("farms/:farmId/crop-cycles")
  @RequirePermissions("agro:read")
  async listCropCycles(
    @Param("farmId") farmId: string,
    @Query("productionCycleId") productionCycleId: string | undefined,
    @Req() req: any,
  ) {
    const ctx = resolveRequestContext(req);
    const cropCycles = await this.service.listCropCycles(farmId, ctx.userId, productionCycleId);
    return ok(resolveRequestId(req.headers ?? {}), { cropCycles });
  }

  @Post("farms/:farmId/crop-cycles")
  @RequirePermissions("agro:write")
  async createCropCycle(
    @Param("farmId") farmId: string,
    @Body() body: unknown,
    @Req() req: any,
  ) {
    const ctx = resolveRequestContext(req);
    const parsed = createCropSchema.parse(body);
    const cropCycle = await this.service.createCropCycle(farmId, ctx.userId, parsed);
    return ok(resolveRequestId(req.headers ?? {}), { cropCycle });
  }

  // ── Input Applications ─────────────────────────────────────────────────────

  @Post("crop-cycles/:cropCycleId/inputs")
  @RequirePermissions("agro:write")
  async addInputApplication(
    @Param("cropCycleId") cropCycleId: string,
    @Body() body: unknown,
    @Req() req: any,
  ) {
    const ctx = resolveRequestContext(req);
    const parsed = inputApplicationSchema.parse(body);
    const input = await this.service.addInputApplication(cropCycleId, ctx.userId, parsed);
    return ok(resolveRequestId(req.headers ?? {}), { input });
  }

  // ── Harvest Records ────────────────────────────────────────────────────────

  @Post("crop-cycles/:cropCycleId/harvests")
  @RequirePermissions("agro:write")
  async recordHarvest(
    @Param("cropCycleId") cropCycleId: string,
    @Body() body: unknown,
    @Req() req: any,
  ) {
    const ctx = resolveRequestContext(req);
    const parsed = harvestSchema.parse(body);
    const harvest = await this.service.recordHarvest(cropCycleId, ctx.userId, parsed);
    return ok(resolveRequestId(req.headers ?? {}), { harvest });
  }
}
