import {
  Body, Controller, Get, Param, Patch, Post, Query, Req,
} from "@nestjs/common";
import { z } from "zod";
import { ok } from "../../common/api-response.js";
import { resolveRequestId } from "../../common/request-id.js";
import { RequirePermissions } from "../../common/permissions.decorator.js";
import { resolveRequestContext } from "../../common/request-context.js";
import { AgroEvidenceService } from "./agro-evidence.service.js";
import { parsePositiveInt } from "../../common/parse-query.js";

const entityTypeEnum = z.enum(["FARM","FARM_UNIT","ANIMAL","ANIMAL_GROUP","FARM_TASK","INVENTORY_ITEM","INVENTORY_MOVEMENT","COST_ENTRY","GENERAL"]);
const mediaTypeEnum  = z.enum(["NOTE","PHOTO","VIDEO","DOCUMENT","EXTERNAL_URL","OTHER"]);

const createEvidenceSchema = z.object({
  entityType: entityTypeEnum,
  entityId:   z.string().optional(),
  mediaType:  mediaTypeEnum,
  title:      z.string().optional(),
  note:       z.string().optional(),
  fileUrl:    z.string().url().optional(),
  capturedAt: z.coerce.date().optional(),
  latitude:   z.number().optional(),
  longitude:  z.number().optional(),
});

const updateEvidenceSchema = z.object({
  title:   z.string().optional(),
  note:    z.string().optional(),
  fileUrl: z.string().url().optional(),
});

@Controller("v1/agro")
export class AgroEvidenceController {
  constructor(private readonly service: AgroEvidenceService) {}

  @Get("farms/:farmId/evidence")
  @RequirePermissions("agro:read")
  async listEvidence(
    @Param("farmId") farmId: string,
    @Query("entityType") entityType: string | undefined,
    @Query("entityId") entityId: string | undefined,
    @Req() req: any,
  ) {
    const ctx = resolveRequestContext(req);
    const evidence = await this.service.listEvidence(farmId, ctx.userId, { entityType, entityId });
    return ok(resolveRequestId(req.headers ?? {}), { evidence });
  }

  @Post("farms/:farmId/evidence")
  @RequirePermissions("agro:write")
  async createEvidence(@Param("farmId") farmId: string, @Body() body: unknown, @Req() req: any) {
    const ctx = resolveRequestContext(req);
    const input = createEvidenceSchema.parse(body);
    const evidence = await this.service.createEvidence(farmId, ctx.userId, input);
    return ok(resolveRequestId(req.headers ?? {}), { evidence });
  }

  @Get("evidence/:evidenceId")
  @RequirePermissions("agro:read")
  async getEvidence(@Param("evidenceId") evidenceId: string, @Req() req: any) {
    const evidence = await this.service.getEvidence(evidenceId);
    return ok(resolveRequestId(req.headers ?? {}), { evidence });
  }

  @Patch("evidence/:evidenceId")
  @RequirePermissions("agro:write")
  async updateEvidence(@Param("evidenceId") evidenceId: string, @Body() body: unknown, @Req() req: any) {
    const ctx = resolveRequestContext(req);
    const input = updateEvidenceSchema.parse(body);
    const evidence = await this.service.updateEvidence(evidenceId, ctx.userId, input);
    return ok(resolveRequestId(req.headers ?? {}), { evidence });
  }

  @Get("entities/:entityType/:entityId/evidence")
  @RequirePermissions("agro:read")
  async getEntityEvidence(
    @Param("entityType") entityType: string,
    @Param("entityId") entityId: string,
    @Query("farmId") farmId: string,
    @Req() req: any,
  ) {
    const ctx = resolveRequestContext(req);
    const evidence = await this.service.getEntityEvidence(farmId, ctx.userId, entityType, entityId);
    return ok(resolveRequestId(req.headers ?? {}), { evidence });
  }

  @Get("farms/:farmId/evidence/recent")
  @RequirePermissions("agro:read")
  async getRecentEvidence(
    @Param("farmId") farmId: string,
    @Query("limit") limit: string | undefined,
    @Req() req: any,
  ) {
    const ctx = resolveRequestContext(req);
    const evidence = await this.service.getRecentEvidence(farmId, ctx.userId, parsePositiveInt(limit, 10));
    return ok(resolveRequestId(req.headers ?? {}), { evidence });
  }
}
