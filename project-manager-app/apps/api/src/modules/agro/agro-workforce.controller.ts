import { Body, Controller, Get, Param, Patch, Post, Req } from "@nestjs/common";
import { z } from "zod";
import { ok } from "../../common/api-response.js";
import { resolveRequestId } from "../../common/request-id.js";
import { RequirePermissions } from "../../common/permissions.decorator.js";
import { resolveRequestContext } from "../../common/request-context.js";
import { AGRO_EVIDENCE_MEDIA_TYPES } from "./agro-evidence.service.js";
import { AgroFarmAccessService } from "./agro-farm-access.service.js";
import { AGRO_FARM_MEMBER_ROLES } from "./agro-farm-policy.js";
import { AgroWorkforceService } from "./agro-workforce.service.js";
import {
  AGRO_CAPABILITY_CATEGORIES, AGRO_CAPABILITY_LEVELS, AGRO_SECTORS,
  AGRO_VERIFICATION_METHODS, AGRO_VERIFICATION_RESULTS,
} from "./agro-workforce.domain.js";

const catalogBase = {
  key: z.string().min(2).max(63),
  name: z.string().min(1).max(120),
  description: z.string().max(2000).optional(),
};

const createRoleSchema = z.object({
  ...catalogBase,
  sector: z.enum(AGRO_SECTORS),
  species: z.string().max(40).optional(),
  specialtyKeys: z.array(z.string()).max(50).optional(),
});

const createSpecialtySchema = z.object({
  ...catalogBase,
  sector: z.enum(AGRO_SECTORS),
  species: z.string().max(40).optional(),
  roleKeys: z.array(z.string()).max(50).optional(),
});

const createCapabilitySchema = z.object({
  ...catalogBase,
  category: z.enum(AGRO_CAPABILITY_CATEGORIES),
  specialtyKey: z.string().optional(),
  parentKey: z.string().optional(),
  requiresProfessional: z.boolean().optional(),
  evidenceRequired: z.boolean().optional(),
  validityDays: z.number().int().positive().max(3650).optional(),
});

const addMemberSchema = z.object({
  userId: z.string().min(1),
  role: z.enum(AGRO_FARM_MEMBER_ROLES),
  displayName: z.string().max(120).optional(),
});

const updateMemberSchema = z.object({
  role: z.enum(AGRO_FARM_MEMBER_ROLES).optional(),
  status: z.enum(["ACTIVE", "SUSPENDED", "REVOKED"]).optional(),
  displayName: z.string().max(120).optional(),
});

const assignRoleSchema = z.object({
  role: z.string().min(1), // id o key del catálogo
  isPrimary: z.boolean().optional(),
});

const declareCapabilitySchema = z.object({
  capability: z.string().min(1), // id o key del catálogo
  level: z.enum(AGRO_CAPABILITY_LEVELS).optional(),
  acquiredAt: z.coerce.date().optional(),
  notes: z.string().max(2000).optional(),
});

const evidenceSchema = z.object({
  mediaType: z.enum(AGRO_EVIDENCE_MEDIA_TYPES),
  title: z.string().max(200).optional(),
  note: z.string().max(5000).optional(),
  fileUrl: z.string().url().optional(),
  capturedAt: z.coerce.date().optional(),
  latitude: z.number().optional(),
  longitude: z.number().optional(),
});

const verifySchema = z.object({
  result: z.enum(AGRO_VERIFICATION_RESULTS),
  method: z.enum(AGRO_VERIFICATION_METHODS),
  levelAssessed: z.enum(AGRO_CAPABILITY_LEVELS).optional(),
  evidenceIds: z.array(z.string()).max(20).optional(),
  notes: z.string().max(5000).optional(),
  expiresAt: z.coerce.date().optional(),
});

const revokeSchema = z.object({
  reason: z.string().min(1).max(5000),
  evidenceIds: z.array(z.string()).max(20).optional(),
});

/** `me` como alias del usuario autenticado en rutas de trabajador. */
function workerParam(workerId: string, userId: string) {
  return workerId === "me" ? userId : workerId;
}

@Controller("v1/agro")
export class AgroWorkforceController {
  constructor(
    private readonly service: AgroWorkforceService,
    private readonly access: AgroFarmAccessService,
  ) {}

  // ── Catálogo ────────────────────────────────────────────────────────────────

  @Get("workforce/catalog")
  @RequirePermissions("agro:read")
  async catalog(@Req() req: any) {
    const catalog = await this.service.getCatalog();
    return ok(resolveRequestId(req.headers ?? {}), catalog);
  }

  @Post("workforce/catalog/roles")
  @RequirePermissions("agro:workforce:admin")
  async createRole(@Body() body: unknown, @Req() req: any) {
    const role = await this.service.createCatalogRole(createRoleSchema.parse(body));
    return ok(resolveRequestId(req.headers ?? {}), { role });
  }

  @Post("workforce/catalog/specialties")
  @RequirePermissions("agro:workforce:admin")
  async createSpecialty(@Body() body: unknown, @Req() req: any) {
    const specialty = await this.service.createCatalogSpecialty(createSpecialtySchema.parse(body));
    return ok(resolveRequestId(req.headers ?? {}), { specialty });
  }

  @Post("workforce/catalog/capabilities")
  @RequirePermissions("agro:workforce:admin")
  async createCapability(@Body() body: unknown, @Req() req: any) {
    const capability = await this.service.createCatalogCapability(createCapabilitySchema.parse(body));
    return ok(resolveRequestId(req.headers ?? {}), { capability });
  }

  // ── Membresías ──────────────────────────────────────────────────────────────

  @Get("memberships")
  @RequirePermissions("agro:read")
  async myMemberships(@Req() req: any) {
    const ctx = resolveRequestContext(req);
    const memberships = await this.access.listMemberships(ctx.userId);
    return ok(resolveRequestId(req.headers ?? {}), { memberships });
  }

  @Get("farms/:farmId/members")
  @RequirePermissions("agro:read")
  async listMembers(@Param("farmId") farmId: string, @Req() req: any) {
    const ctx = resolveRequestContext(req);
    const data = await this.service.listMembers(farmId, ctx.userId);
    return ok(resolveRequestId(req.headers ?? {}), data);
  }

  @Post("farms/:farmId/members")
  @RequirePermissions("agro:write")
  async addMember(@Param("farmId") farmId: string, @Body() body: unknown, @Req() req: any) {
    const ctx = resolveRequestContext(req);
    const member = await this.service.addMember(farmId, ctx.userId, addMemberSchema.parse(body));
    return ok(resolveRequestId(req.headers ?? {}), { member });
  }

  @Patch("farms/:farmId/members/:memberId")
  @RequirePermissions("agro:write")
  async updateMember(
    @Param("farmId") farmId: string,
    @Param("memberId") memberId: string,
    @Body() body: unknown,
    @Req() req: any,
  ) {
    const ctx = resolveRequestContext(req);
    const member = await this.service.updateMember(farmId, ctx.userId, memberId, updateMemberSchema.parse(body));
    return ok(resolveRequestId(req.headers ?? {}), { member });
  }

  // ── Perfil y matriz ─────────────────────────────────────────────────────────

  @Get("farms/:farmId/workforce/matrix")
  @RequirePermissions("agro:read")
  async matrix(@Param("farmId") farmId: string, @Req() req: any) {
    const ctx = resolveRequestContext(req);
    const data = await this.service.getCapabilityMatrix(farmId, ctx.userId);
    return ok(resolveRequestId(req.headers ?? {}), data);
  }

  @Get("farms/:farmId/workers/:workerId")
  @RequirePermissions("agro:read")
  async profile(@Param("farmId") farmId: string, @Param("workerId") workerId: string, @Req() req: any) {
    const ctx = resolveRequestContext(req);
    const profile = await this.service.getWorkerProfile(farmId, ctx.userId, workerParam(workerId, ctx.userId));
    return ok(resolveRequestId(req.headers ?? {}), profile);
  }

  @Post("farms/:farmId/workers/:workerId/roles")
  @RequirePermissions("agro:report")
  async assignRole(@Param("farmId") farmId: string, @Param("workerId") workerId: string, @Body() body: unknown, @Req() req: any) {
    const ctx = resolveRequestContext(req);
    const workerRole = await this.service.assignWorkerRole(farmId, ctx.userId, workerParam(workerId, ctx.userId), assignRoleSchema.parse(body));
    return ok(resolveRequestId(req.headers ?? {}), { workerRole });
  }

  @Post("farms/:farmId/workers/:workerId/capabilities")
  @RequirePermissions("agro:report")
  async declare(@Param("farmId") farmId: string, @Param("workerId") workerId: string, @Body() body: unknown, @Req() req: any) {
    const ctx = resolveRequestContext(req);
    const workerCapability = await this.service.declareCapability(farmId, ctx.userId, workerParam(workerId, ctx.userId), declareCapabilitySchema.parse(body));
    return ok(resolveRequestId(req.headers ?? {}), { workerCapability });
  }

  @Post("farms/:farmId/worker-capabilities/:workerCapabilityId/request-review")
  @RequirePermissions("agro:report")
  async requestReview(@Param("farmId") farmId: string, @Param("workerCapabilityId") id: string, @Req() req: any) {
    const ctx = resolveRequestContext(req);
    const workerCapability = await this.service.requestReview(farmId, ctx.userId, id);
    return ok(resolveRequestId(req.headers ?? {}), { workerCapability });
  }

  @Post("farms/:farmId/worker-capabilities/:workerCapabilityId/evidence")
  @RequirePermissions("agro:report")
  async addEvidence(@Param("farmId") farmId: string, @Param("workerCapabilityId") id: string, @Body() body: unknown, @Req() req: any) {
    const ctx = resolveRequestContext(req);
    const evidence = await this.service.addCapabilityEvidence(farmId, ctx.userId, id, evidenceSchema.parse(body));
    return ok(resolveRequestId(req.headers ?? {}), { evidence });
  }

  @Post("farms/:farmId/worker-capabilities/:workerCapabilityId/verify")
  @RequirePermissions("agro:workforce:verify")
  async verify(@Param("farmId") farmId: string, @Param("workerCapabilityId") id: string, @Body() body: unknown, @Req() req: any) {
    const ctx = resolveRequestContext(req);
    const result = await this.service.verifyCapability(farmId, ctx.userId, id, verifySchema.parse(body));
    return ok(resolveRequestId(req.headers ?? {}), result);
  }

  @Post("farms/:farmId/worker-capabilities/:workerCapabilityId/revoke")
  @RequirePermissions("agro:workforce:verify")
  async revoke(@Param("farmId") farmId: string, @Param("workerCapabilityId") id: string, @Body() body: unknown, @Req() req: any) {
    const ctx = resolveRequestContext(req);
    const result = await this.service.revokeVerification(farmId, ctx.userId, id, revokeSchema.parse(body));
    return ok(resolveRequestId(req.headers ?? {}), result);
  }

  @Get("farms/:farmId/worker-capabilities/:workerCapabilityId/timeline")
  @RequirePermissions("agro:read")
  async timeline(@Param("farmId") farmId: string, @Param("workerCapabilityId") id: string, @Req() req: any) {
    const ctx = resolveRequestContext(req);
    const events = await this.service.getCapabilityTimeline(farmId, ctx.userId, id);
    return ok(resolveRequestId(req.headers ?? {}), { events });
  }
}
