import {
  Body, Controller, Get, Param, Patch, Post, Req,
} from "@nestjs/common";
import { z } from "zod";
import { ok } from "../../common/api-response.js";
import { resolveRequestId } from "../../common/request-id.js";
import { RequirePermissions } from "../../common/permissions.decorator.js";
import { resolveRequestContext } from "../../common/request-context.js";
import { AgroAnimalService } from "./agro-animal.service.js";

const speciesEnum = z.enum(["CATTLE", "PIG", "GOAT", "SHEEP", "HORSE", "CHICKEN", "OTHER"]);
const statusEnum  = z.enum(["ACTIVE", "SOLD", "DEAD", "LOST", "INACTIVE"]);

const createAnimalSchema = z.object({
  currentUnitId:       z.string().optional(),
  tagCode:             z.string().optional(),
  species:             speciesEnum,
  breed:               z.string().optional(),
  sex:                 z.enum(["MALE", "FEMALE", "UNKNOWN"]),
  birthDate:           z.coerce.date().optional(),
  estimatedAgeMonths:  z.number().int().nonnegative().optional(),
  initialWeight:       z.number().positive().optional(),
  acquisitionDate:     z.coerce.date().optional(),
  acquisitionCost:     z.number().nonnegative().optional(),
  notes:               z.string().optional(),
});

const updateAnimalSchema = z.object({
  tagCode:            z.string().optional(),
  breed:              z.string().optional(),
  birthDate:          z.coerce.date().optional(),
  estimatedAgeMonths: z.number().int().nonnegative().optional(),
  notes:              z.string().optional(),
});

const createGroupSchema = z.object({
  currentUnitId:   z.string().optional(),
  name:            z.string().min(1),
  species:         speciesEnum,
  count:           z.number().int().min(1),
  averageWeight:   z.number().positive().optional(),
  acquisitionDate: z.coerce.date().optional(),
  acquisitionCost: z.number().nonnegative().optional(),
  notes:           z.string().optional(),
});

const updateGroupSchema = z.object({
  name:          z.string().min(1).optional(),
  averageWeight: z.number().positive().optional(),
  notes:         z.string().optional(),
});

const moveSchema         = z.object({ targetUnitId: z.string().nullable(), notes: z.string().optional() });
const weighSchema        = z.object({ weight: z.number().positive(), notes: z.string().optional() });
const statusSchema       = z.object({ status: statusEnum, reason: z.string().optional() });
const adjustCountSchema  = z.object({ count: z.number().int().min(0), reason: z.string().optional() });

@Controller("v1/agro")
export class AgroAnimalController {
  constructor(private readonly service: AgroAnimalService) {}

  // ── Animals ───────────────────────────────────────────────────────────────

  @Get("farms/:farmId/animals")
  @RequirePermissions("agro:read")
  async listAnimals(@Param("farmId") farmId: string, @Req() req: any) {
    const ctx = resolveRequestContext(req);
    const animals = await this.service.listAnimals(farmId, ctx.userId);
    return ok(resolveRequestId(req.headers ?? {}), { animals });
  }

  @Post("farms/:farmId/animals")
  @RequirePermissions("agro:write")
  async createAnimal(@Param("farmId") farmId: string, @Body() body: unknown, @Req() req: any) {
    const ctx = resolveRequestContext(req);
    const input = createAnimalSchema.parse(body);
    const animal = await this.service.createAnimal(farmId, ctx.userId, input);
    return ok(resolveRequestId(req.headers ?? {}), { animal });
  }

  @Get("animals/:animalId")
  @RequirePermissions("agro:read")
  async getAnimal(@Param("animalId") animalId: string, @Req() req: any) {
    const animal = await this.service.getAnimal(animalId);
    return ok(resolveRequestId(req.headers ?? {}), { animal });
  }

  @Patch("animals/:animalId")
  @RequirePermissions("agro:write")
  async updateAnimal(@Param("animalId") animalId: string, @Body() body: unknown, @Req() req: any) {
    const ctx = resolveRequestContext(req);
    const input = updateAnimalSchema.parse(body);
    const animal = await this.service.updateAnimal(animalId, ctx.userId, input);
    return ok(resolveRequestId(req.headers ?? {}), { animal });
  }

  @Post("animals/:animalId/move")
  @RequirePermissions("agro:write")
  async moveAnimal(@Param("animalId") animalId: string, @Body() body: unknown, @Req() req: any) {
    const ctx = resolveRequestContext(req);
    const { targetUnitId, notes } = moveSchema.parse(body);
    const animal = await this.service.moveAnimal(animalId, ctx.userId, targetUnitId, notes);
    return ok(resolveRequestId(req.headers ?? {}), { animal });
  }

  @Post("animals/:animalId/weigh")
  @RequirePermissions("agro:write")
  async weighAnimal(@Param("animalId") animalId: string, @Body() body: unknown, @Req() req: any) {
    const ctx = resolveRequestContext(req);
    const { weight, notes } = weighSchema.parse(body);
    const animal = await this.service.weighAnimal(animalId, ctx.userId, weight, notes);
    return ok(resolveRequestId(req.headers ?? {}), { animal });
  }

  @Post("animals/:animalId/status")
  @RequirePermissions("agro:write")
  async changeAnimalStatus(@Param("animalId") animalId: string, @Body() body: unknown, @Req() req: any) {
    const ctx = resolveRequestContext(req);
    const { status, reason } = statusSchema.parse(body);
    const animal = await this.service.changeAnimalStatus(animalId, ctx.userId, status, reason);
    return ok(resolveRequestId(req.headers ?? {}), { animal });
  }

  @Get("animals/:animalId/timeline")
  @RequirePermissions("agro:read")
  async getAnimalTimeline(@Param("animalId") animalId: string, @Req() req: any) {
    const ctx = resolveRequestContext(req);
    const events = await this.service.getAnimalTimeline(animalId, ctx.userId);
    return ok(resolveRequestId(req.headers ?? {}), { events });
  }

  // ── Animal Groups ─────────────────────────────────────────────────────────

  @Get("farms/:farmId/animal-groups")
  @RequirePermissions("agro:read")
  async listGroups(@Param("farmId") farmId: string, @Req() req: any) {
    const ctx = resolveRequestContext(req);
    const groups = await this.service.listGroups(farmId, ctx.userId);
    return ok(resolveRequestId(req.headers ?? {}), { groups });
  }

  @Post("farms/:farmId/animal-groups")
  @RequirePermissions("agro:write")
  async createGroup(@Param("farmId") farmId: string, @Body() body: unknown, @Req() req: any) {
    const ctx = resolveRequestContext(req);
    const input = createGroupSchema.parse(body);
    const group = await this.service.createGroup(farmId, ctx.userId, input);
    return ok(resolveRequestId(req.headers ?? {}), { group });
  }

  @Get("animal-groups/:groupId")
  @RequirePermissions("agro:read")
  async getGroup(@Param("groupId") groupId: string, @Req() req: any) {
    const group = await this.service.getGroup(groupId);
    return ok(resolveRequestId(req.headers ?? {}), { group });
  }

  @Patch("animal-groups/:groupId")
  @RequirePermissions("agro:write")
  async updateGroup(@Param("groupId") groupId: string, @Body() body: unknown, @Req() req: any) {
    const ctx = resolveRequestContext(req);
    const input = updateGroupSchema.parse(body);
    const group = await this.service.updateGroup(groupId, ctx.userId, input);
    return ok(resolveRequestId(req.headers ?? {}), { group });
  }

  @Post("animal-groups/:groupId/move")
  @RequirePermissions("agro:write")
  async moveGroup(@Param("groupId") groupId: string, @Body() body: unknown, @Req() req: any) {
    const ctx = resolveRequestContext(req);
    const { targetUnitId, notes } = moveSchema.parse(body);
    const group = await this.service.moveGroup(groupId, ctx.userId, targetUnitId, notes);
    return ok(resolveRequestId(req.headers ?? {}), { group });
  }

  @Post("animal-groups/:groupId/adjust-count")
  @RequirePermissions("agro:write")
  async adjustGroupCount(@Param("groupId") groupId: string, @Body() body: unknown, @Req() req: any) {
    const ctx = resolveRequestContext(req);
    const { count, reason } = adjustCountSchema.parse(body);
    const group = await this.service.adjustGroupCount(groupId, ctx.userId, count, reason);
    return ok(resolveRequestId(req.headers ?? {}), { group });
  }

  @Post("animal-groups/:groupId/status")
  @RequirePermissions("agro:write")
  async changeGroupStatus(@Param("groupId") groupId: string, @Body() body: unknown, @Req() req: any) {
    const ctx = resolveRequestContext(req);
    const { status, reason } = statusSchema.parse(body);
    const group = await this.service.changeGroupStatus(groupId, ctx.userId, status, reason);
    return ok(resolveRequestId(req.headers ?? {}), { group });
  }

  @Get("animal-groups/:groupId/timeline")
  @RequirePermissions("agro:read")
  async getGroupTimeline(@Param("groupId") groupId: string, @Req() req: any) {
    const ctx = resolveRequestContext(req);
    const events = await this.service.getGroupTimeline(groupId, ctx.userId);
    return ok(resolveRequestId(req.headers ?? {}), { events });
  }
}
