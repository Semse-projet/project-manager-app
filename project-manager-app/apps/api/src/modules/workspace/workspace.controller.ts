import { BadRequestException, Body, Controller, Get, Post, Req } from "@nestjs/common";
import type { FastifyRequest } from "fastify";
import {
  loadMissionRequestSchema,
  unloadMissionRequestSchema,
  updateNavigationRequestSchema,
} from "@semse/schemas";
import { ok } from "../../common/api-response.js";
import { AuthenticatedAccess } from "../../common/permissions.decorator.js";
import { resolveRequestContext } from "../../common/request-context.js";
import { resolveRequestId } from "../../common/request-id.js";
import { WorkspaceService, type WorkspaceActor } from "./workspace.service.js";

function actorOf(req: FastifyRequest): WorkspaceActor {
  const c = resolveRequestContext(req as Parameters<typeof resolveRequestContext>[0]);
  return { userId: c.userId, tenantId: c.tenantId, orgId: c.orgId, roles: c.roles };
}

@Controller("v1/workspace")
export class WorkspaceController {
  constructor(private readonly workspace: WorkspaceService) {}

  @Get("context")
  @AuthenticatedAccess("SEMSE Workspace exposes only the caller's own UI shell state")
  getContext(@Req() req: FastifyRequest) {
    const rid = resolveRequestId(req.headers ?? {});
    return ok(rid, this.workspace.getContext(actorOf(req)));
  }

  @Post("navigation")
  @AuthenticatedAccess("SEMSE Workspace navigation only mutates the caller's own UI shell state")
  updateNavigation(@Req() req: FastifyRequest, @Body() body: unknown) {
    const rid = resolveRequestId(req.headers ?? {});
    const parsed = updateNavigationRequestSchema.safeParse(body);
    if (!parsed.success) {
      throw new BadRequestException(parsed.error.issues.map((i) => i.message).join("; "));
    }
    return ok(rid, this.workspace.updateNavigation(actorOf(req), parsed.data));
  }

  @Post("mission/load")
  @AuthenticatedAccess("SEMSE Workspace mission load only affects the caller's own UI shell state")
  loadMission(@Req() req: FastifyRequest, @Body() body: unknown) {
    const rid = resolveRequestId(req.headers ?? {});
    const parsed = loadMissionRequestSchema.safeParse(body);
    if (!parsed.success) {
      throw new BadRequestException(parsed.error.issues.map((i) => i.message).join("; "));
    }
    return ok(rid, this.workspace.loadMission(actorOf(req), parsed.data));
  }

  @Post("mission/unload")
  @AuthenticatedAccess("SEMSE Workspace mission unload only affects the caller's own UI shell state")
  unloadMission(@Req() req: FastifyRequest, @Body() body: unknown) {
    const rid = resolveRequestId(req.headers ?? {});
    const parsed = unloadMissionRequestSchema.safeParse(body);
    if (!parsed.success) {
      throw new BadRequestException(parsed.error.issues.map((i) => i.message).join("; "));
    }
    return ok(rid, this.workspace.unloadMission(actorOf(req), parsed.data.missionId));
  }
}
