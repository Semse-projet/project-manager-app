import { Body, Controller, Get, Param, Post, Query, Req } from "@nestjs/common";
import { ok } from "../../common/api-response.js";
import { RequirePermissions } from "../../common/permissions.decorator.js";
import { resolveRequestContext } from "../../common/request-context.js";
import { resolveRequestId } from "../../common/request-id.js";
import { ChangeOrdersService } from "./change-orders.service.js";

@Controller("v1/change-orders")
export class ChangeOrdersController {
  constructor(private readonly changeOrdersService: ChangeOrdersService) {}

  @Get()
  @RequirePermissions("change-orders:read")
  async list(
    @Req() req: { headers?: Record<string, unknown> },
    @Query() query: Record<string, string | undefined>,
  ) {
    const actor = resolveRequestContext(req);
    const requestId = resolveRequestId(req.headers ?? {});
    const data = await this.changeOrdersService.list(actor, {
      jobId: query.jobId,
      buildOpsProjectId: query.buildOpsProjectId,
      milestoneId: query.milestoneId,
      status: query.status,
      limit: query.limit ? Number(query.limit) : undefined,
    });
    return ok(requestId, data);
  }

  @Post()
  @RequirePermissions("change-orders:create")
  async create(@Req() req: { headers?: Record<string, unknown> }, @Body() body: Record<string, unknown>) {
    const actor = resolveRequestContext(req);
    const requestId = resolveRequestId(req.headers ?? {});
    const data = await this.changeOrdersService.create(actor, {
      buildOpsProjectId: typeof body.buildOpsProjectId === "string" ? body.buildOpsProjectId : undefined,
      jobId: typeof body.jobId === "string" ? body.jobId : undefined,
      milestoneId: typeof body.milestoneId === "string" ? body.milestoneId : undefined,
      algorithmRunId: typeof body.algorithmRunId === "string" ? body.algorithmRunId : undefined,
      title: typeof body.title === "string" ? body.title : undefined,
      description: typeof body.description === "string" ? body.description : undefined,
      trigger: typeof body.trigger === "string" ? body.trigger : undefined,
      pricingMode: typeof body.pricingMode === "string" ? body.pricingMode : undefined,
      estimatedMin: typeof body.estimatedMin === "number" ? body.estimatedMin : undefined,
      estimatedMax: typeof body.estimatedMax === "number" ? body.estimatedMax : undefined,
      probability: typeof body.probability === "number" ? body.probability : undefined,
      evidenceJson: body.evidenceJson,
    });
    return ok(requestId, data);
  }

  @Post(":id/submit")
  @RequirePermissions("change-orders:create")
  async submit(@Req() req: { headers?: Record<string, unknown> }, @Param("id") id: string) {
    const actor = resolveRequestContext(req);
    const requestId = resolveRequestId(req.headers ?? {});
    const data = await this.changeOrdersService.submit(actor, id);
    return ok(requestId, data);
  }

  @Post(":id/approve")
  @RequirePermissions("change-orders:approve")
  async approve(@Req() req: { headers?: Record<string, unknown> }, @Param("id") id: string, @Body() body: { clientNote?: string }) {
    const actor = resolveRequestContext(req);
    const requestId = resolveRequestId(req.headers ?? {});
    const data = await this.changeOrdersService.approve(actor, id, body.clientNote);
    return ok(requestId, data);
  }

  @Post(":id/reject")
  @RequirePermissions("change-orders:approve")
  async reject(@Req() req: { headers?: Record<string, unknown> }, @Param("id") id: string, @Body() body: { clientNote?: string; reason?: string }) {
    const actor = resolveRequestContext(req);
    const requestId = resolveRequestId(req.headers ?? {});
    const data = await this.changeOrdersService.reject(actor, id, body.clientNote ?? body.reason);
    return ok(requestId, data);
  }
}
