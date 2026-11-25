import { Body, Controller, Get, HttpCode, Param, Post, Put, Req } from "@nestjs/common";
import { Throttle } from "@nestjs/throttler";
import { worksiteBindingInputSchema, worksiteLocationInputSchema } from "@semse/schemas";
import { z } from "zod";
import { ok } from "../../common/api-response.js";
import { RequirePermissions } from "../../common/permissions.decorator.js";
import { resolveRequestContext } from "../../common/request-context.js";
import { resolveRequestId } from "../../common/request-id.js";
import { parseWithSchema } from "../../common/zod-validation.js";
import { WorksiteLocationService } from "./worksite-location.service.js";

type Req_ = { headers?: Record<string, unknown> };

const idSchema = z.string().trim().min(1).max(64);
// Contratos compartidos (packages/schemas): Q2 radio 50–1000 m; 150 m si no se indica.
const locationSchema = worksiteLocationInputSchema;
const bindingSchema = worksiteBindingInputSchema;

/** OPEN-18: ubicación de la obra y vínculos con Job/proyecto libre. Spec: docs/specs/core/worksite-location-binding.spec.md */
@Controller("v1/organizations/:orgId/worksites/:worksiteId")
export class OrgWorksiteLocationController {
  constructor(private readonly locations: WorksiteLocationService) {}

  @Put("location")
  @HttpCode(200)
  @RequirePermissions("org:crews:manage")
  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  async setLocation(@Req() req: Req_, @Param("orgId") orgId: string, @Param("worksiteId") worksiteId: string, @Body() body: unknown) {
    const actor = resolveRequestContext(req);
    const requestId = resolveRequestId(req.headers ?? {});
    const data = await this.locations.setLocation(
      actor,
      parseWithSchema(idSchema, orgId),
      parseWithSchema(idSchema, worksiteId),
      requestId,
      parseWithSchema(locationSchema, body)
    );
    return ok(requestId, data);
  }

  @Post("bindings")
  @RequirePermissions("org:crews:manage")
  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  async createBinding(@Req() req: Req_, @Param("orgId") orgId: string, @Param("worksiteId") worksiteId: string, @Body() body: unknown) {
    const actor = resolveRequestContext(req);
    const requestId = resolveRequestId(req.headers ?? {});
    const data = await this.locations.createBinding(
      actor,
      parseWithSchema(idSchema, orgId),
      parseWithSchema(idSchema, worksiteId),
      requestId,
      parseWithSchema(bindingSchema, body)
    );
    return ok(requestId, data);
  }

  @Get("bindings")
  @RequirePermissions("org:crews:manage")
  async listBindings(@Req() req: Req_, @Param("orgId") orgId: string, @Param("worksiteId") worksiteId: string) {
    const actor = resolveRequestContext(req);
    const data = await this.locations.listBindings(actor, parseWithSchema(idSchema, orgId), parseWithSchema(idSchema, worksiteId));
    return ok(resolveRequestId(req.headers ?? {}), data);
  }

  @Post("bindings/:bindingId/end")
  @HttpCode(200)
  @RequirePermissions("org:crews:manage")
  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  async endBinding(
    @Req() req: Req_,
    @Param("orgId") orgId: string,
    @Param("worksiteId") worksiteId: string,
    @Param("bindingId") bindingId: string
  ) {
    const actor = resolveRequestContext(req);
    const requestId = resolveRequestId(req.headers ?? {});
    const data = await this.locations.endBinding(
      actor,
      parseWithSchema(idSchema, orgId),
      parseWithSchema(idSchema, worksiteId),
      parseWithSchema(idSchema, bindingId),
      requestId
    );
    return ok(requestId, data);
  }
}
