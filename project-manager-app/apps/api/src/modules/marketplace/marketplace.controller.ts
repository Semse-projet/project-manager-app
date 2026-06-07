import { Controller, Get, Query, Req } from "@nestjs/common";
import { ok } from "../../common/api-response.js";
import { RequirePermissions } from "../../common/permissions.decorator.js";
import { resolveRequestContext } from "../../common/request-context.js";
import { resolveRequestId } from "../../common/request-id.js";
import { MarketplaceService } from "./marketplace.service.js";

@Controller("v1/marketplace")
export class MarketplaceController {
  constructor(private readonly svc: MarketplaceService) {}

  @Get("listings")
  @RequirePermissions("projects:read")
  async listOpenJobs(
    @Req() req: { headers?: Record<string, unknown> },
    @Query("category") category?: string,
    @Query("location") location?: string,
    @Query("urgency")  urgency?: string,
    @Query("limit")    limit?: string,
    @Query("offset")   offset?: string,
  ) {
    const ctx = resolveRequestContext(req);
    const rid = resolveRequestId(req.headers ?? {});
    const result = await this.svc.listOpenJobs({
      tenantId: ctx.tenantId,
      category, location, urgency,
      limit:  limit  ? parseInt(limit, 10)  : 20,
      offset: offset ? parseInt(offset, 10) : 0,
    });
    return ok(rid, result);
  }

  @Get("stats")
  @RequirePermissions("projects:read")
  async getStats(@Req() req: { headers?: Record<string, unknown> }) {
    const ctx = resolveRequestContext(req);
    const rid = resolveRequestId(req.headers ?? {});
    return ok(rid, await this.svc.getStats(ctx.tenantId));
  }

  @Get("professionals")
  @RequirePermissions("projects:read")
  async listProfessionals(
    @Req() req: { headers?: Record<string, unknown> },
    @Query("limit") limit?: string,
  ) {
    const ctx = resolveRequestContext(req);
    const rid = resolveRequestId(req.headers ?? {});
    return ok(rid, await this.svc.listProfessionals({
      tenantId: ctx.tenantId,
      limit: limit ? parseInt(limit, 10) : 20,
    }));
  }
}
