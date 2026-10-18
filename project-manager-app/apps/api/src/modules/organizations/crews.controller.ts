import { Body, Controller, Get, HttpCode, Param, Post, Req } from "@nestjs/common";
import { Throttle } from "@nestjs/throttler";
import { z } from "zod";
import { ok } from "../../common/api-response.js";
import { AuthenticatedAccess, RequirePermissions } from "../../common/permissions.decorator.js";
import { resolveRequestContext } from "../../common/request-context.js";
import { resolveRequestId } from "../../common/request-id.js";
import { parseWithSchema } from "../../common/zod-validation.js";
import { CrewsService } from "./crews.service.js";

type Req_ = { headers?: Record<string, unknown> };

const idSchema = z.string().trim().min(1).max(64);
const worksiteSchema = z.object({ name: z.string().trim().min(2).max(120), address: z.string().trim().max(300).optional() });
const crewSchema = z.object({
  name: z.string().trim().min(2).max(120),
  supervisorUserId: idSchema,
  worksiteId: idSchema.optional()
});
const memberSchema = z.object({ userId: idSchema });

/** BO-07: gestión de obras y cuadrillas de una Org. Spec: docs/specs/core/crews-worksites.spec.md */
@Controller("v1/organizations/:orgId")
export class OrgCrewsController {
  constructor(private readonly crews: CrewsService) {}

  @Post("worksites")
  @RequirePermissions("org:crews:manage")
  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  async createWorksite(@Req() req: Req_, @Param("orgId") orgId: string, @Body() body: unknown) {
    const actor = resolveRequestContext(req);
    const requestId = resolveRequestId(req.headers ?? {});
    const data = await this.crews.createWorksite(actor, parseWithSchema(idSchema, orgId), requestId, parseWithSchema(worksiteSchema, body));
    return ok(requestId, data);
  }

  @Get("worksites")
  @RequirePermissions("org:crews:manage")
  async listWorksites(@Req() req: Req_, @Param("orgId") orgId: string) {
    const actor = resolveRequestContext(req);
    const data = await this.crews.listWorksites(actor, parseWithSchema(idSchema, orgId));
    return ok(resolveRequestId(req.headers ?? {}), data);
  }

  @Post("crews")
  @RequirePermissions("org:crews:manage")
  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  async createCrew(@Req() req: Req_, @Param("orgId") orgId: string, @Body() body: unknown) {
    const actor = resolveRequestContext(req);
    const requestId = resolveRequestId(req.headers ?? {});
    const data = await this.crews.createCrew(actor, parseWithSchema(idSchema, orgId), requestId, parseWithSchema(crewSchema, body));
    return ok(requestId, data);
  }

  @Get("crews")
  @RequirePermissions("org:crews:manage")
  async listCrews(@Req() req: Req_, @Param("orgId") orgId: string) {
    const actor = resolveRequestContext(req);
    const data = await this.crews.listCrews(actor, parseWithSchema(idSchema, orgId));
    return ok(resolveRequestId(req.headers ?? {}), data);
  }

  @Post("crews/:crewId/members")
  @HttpCode(200)
  @RequirePermissions("org:crews:manage")
  async addMember(@Req() req: Req_, @Param("orgId") orgId: string, @Param("crewId") crewId: string, @Body() body: unknown) {
    const actor = resolveRequestContext(req);
    const { userId } = parseWithSchema(memberSchema, body);
    const requestId = resolveRequestId(req.headers ?? {});
    const data = await this.crews.addMember(actor, parseWithSchema(idSchema, orgId), parseWithSchema(idSchema, crewId), userId, requestId);
    return ok(requestId, data);
  }

  @Post("crews/:crewId/members/remove")
  @HttpCode(200)
  @RequirePermissions("org:crews:manage")
  async removeMember(@Req() req: Req_, @Param("orgId") orgId: string, @Param("crewId") crewId: string, @Body() body: unknown) {
    const actor = resolveRequestContext(req);
    const { userId } = parseWithSchema(memberSchema, body);
    const requestId = resolveRequestId(req.headers ?? {});
    const data = await this.crews.removeMember(actor, parseWithSchema(idSchema, orgId), parseWithSchema(idSchema, crewId), userId, requestId);
    return ok(requestId, data);
  }

  @Post("crews/:crewId/archive")
  @HttpCode(200)
  @RequirePermissions("org:crews:manage")
  async archive(@Req() req: Req_, @Param("orgId") orgId: string, @Param("crewId") crewId: string) {
    const actor = resolveRequestContext(req);
    const requestId = resolveRequestId(req.headers ?? {});
    const data = await this.crews.archiveCrew(actor, parseWithSchema(idSchema, orgId), parseWithSchema(idSchema, crewId), requestId);
    return ok(requestId, data);
  }
}

/** BO-07: la persona ve sus cuadrillas y el supervisor vigente ve el roster de la suya. */
@Controller("v1/crews")
export class MyCrewsController {
  constructor(private readonly crews: CrewsService) {}

  @Get("mine")
  @AuthenticatedAccess("La persona lee únicamente las cuadrillas donde es miembro o supervisor, revalidadas contra su Membership ACTIVE")
  async mine(@Req() req: Req_) {
    const actor = resolveRequestContext(req);
    const data = await this.crews.listMine({ userId: actor.userId });
    return ok(resolveRequestId(req.headers ?? {}), data);
  }

  @Get(":crewId/roster")
  @AuthenticatedAccess("Solo el supervisor vigente de esa cuadrilla lee su lista de miembros")
  async roster(@Req() req: Req_, @Param("crewId") crewId: string) {
    const actor = resolveRequestContext(req);
    const data = await this.crews.rosterForSupervisor({ userId: actor.userId }, parseWithSchema(idSchema, crewId));
    return ok(resolveRequestId(req.headers ?? {}), data);
  }
}
