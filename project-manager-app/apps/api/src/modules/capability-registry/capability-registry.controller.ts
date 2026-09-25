import { Controller, Get, Param, Req } from "@nestjs/common";
import { AuthGuard } from "@nestjs/passport";
import { UseGuards } from "@nestjs/common";
import type { FastifyRequest } from "fastify";
import { ok } from "../../common/api-response.js";
import { resolveRequestId } from "../../common/request-id.js";
import { AuthenticatedAccess } from "../../common/permissions.decorator.js";
import { CapabilityRegistryService } from "./capability-registry.service.js";

/**
 * Read-only Capability Reality Registry endpoints (Phase 1). Authenticated
 * but not yet resource-scoped — this is engineering/platform metadata, not
 * tenant business data, so any authenticated actor may read it.
 */
@Controller("v1/capabilities")
@UseGuards(AuthGuard("jwt"))
@AuthenticatedAccess("Capability registry is platform engineering metadata; any authenticated actor may read it.")
export class CapabilityRegistryController {
  constructor(private readonly registry: CapabilityRegistryService) {}

  @Get()
  async list(@Req() req: FastifyRequest) {
    const capabilities = await this.registry.list();
    return ok(resolveRequestId(req.headers ?? {}), { capabilities });
  }

  @Get("golden-regressions")
  async goldenRegressions(@Req() req: FastifyRequest) {
    const regressions = await this.registry.listGoldenRegressions();
    return ok(resolveRequestId(req.headers ?? {}), { regressions });
  }

  @Get(":key")
  async getByKey(@Req() req: FastifyRequest, @Param("key") key: string) {
    const capability = await this.registry.getByKey(key);
    return ok(resolveRequestId(req.headers ?? {}), { capability });
  }
}
