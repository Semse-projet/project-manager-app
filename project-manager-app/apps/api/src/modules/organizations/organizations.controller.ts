import { Controller, Get, Param, Req } from "@nestjs/common";
import { orgIdParamSchema } from "@semse/schemas";
import { ok } from "../../common/api-response.js";
import { RequirePermissions } from "../../common/permissions.decorator.js";
import { resolveRequestContext } from "../../common/request-context.js";
import { resolveRequestId } from "../../common/request-id.js";
import { parseWithSchema } from "../../common/zod-validation.js";
import { OrganizationsService } from "./organizations.service.js";

@Controller("v1/organizations")
export class OrganizationsController {
  constructor(private readonly organizationsService: OrganizationsService) {}

  @Get()
  @RequirePermissions("org:read")
  async list(@Req() req: { headers?: Record<string, unknown> }) {
    const actor = resolveRequestContext(req);
    const data = await this.organizationsService.listOrgs({
      tenantId: actor.tenantId,
      orgId: actor.orgId,
      userId: actor.userId
    });
    return ok(resolveRequestId(req.headers ?? {}), data);
  }

  @Get(":orgId")
  @RequirePermissions("org:read")
  async detail(@Req() req: { headers?: Record<string, unknown> }, @Param("orgId") orgId: string) {
    const parsedParams = parseWithSchema(orgIdParamSchema, { orgId });
    const actor = resolveRequestContext(req);
    const data = await this.organizationsService.getOrg(
      {
        tenantId: actor.tenantId,
        orgId: actor.orgId,
        userId: actor.userId
      },
      parsedParams.orgId
    );
    return ok(resolveRequestId(req.headers ?? {}), data);
  }

  @Get(":orgId/members")
  @RequirePermissions("org:members:read")
  async members(@Req() req: { headers?: Record<string, unknown> }, @Param("orgId") orgId: string) {
    const parsedParams = parseWithSchema(orgIdParamSchema, { orgId });
    const actor = resolveRequestContext(req);
    const data = await this.organizationsService.listMembers(
      {
        tenantId: actor.tenantId,
        orgId: actor.orgId,
        userId: actor.userId
      },
      parsedParams.orgId
    );
    return ok(resolveRequestId(req.headers ?? {}), data);
  }
}
