import { BadRequestException, Body, Controller, Get, Param, Post, Query, Req } from "@nestjs/common";
import { z } from "zod";
import { ok } from "../../common/api-response.js";
import { RequirePermissions } from "../../common/permissions.decorator.js";
import { resolveRequestContext } from "../../common/request-context.js";
import { resolveRequestId } from "../../common/request-id.js";
import { MaterialsService } from "./materials.service.js";

const createMaterialSchema = z.object({
  jobId:         z.string().min(1),
  milestone:     z.string().optional(),
  item:          z.string().min(1).max(300),
  quantity:      z.number().positive(),
  unit:          z.string().min(1).max(50),
  estimatedCost: z.number().nonnegative().optional(),
  notes:         z.string().max(1000).optional(),
});

@Controller("v1/materials")
export class MaterialsController {
  constructor(private readonly materialsService: MaterialsService) {}

  @Get()
  @RequirePermissions("jobs:read")
  async listByWorker(
    @Req() req: { headers?: Record<string, unknown> },
    @Query("status") status?: string
  ) {
    const actor = resolveRequestContext(req);
    const data = await this.materialsService.listByWorker({ tenantId: actor.tenantId, userId: actor.userId, status });
    return ok(resolveRequestId(req.headers ?? {}), data);
  }

  @Get("by-job/:jobId")
  @RequirePermissions("jobs:read")
  async listByJob(
    @Req() req: { headers?: Record<string, unknown> },
    @Param("jobId") jobId: string
  ) {
    const actor = resolveRequestContext(req);
    const data = await this.materialsService.listByJob({ tenantId: actor.tenantId, jobId });
    return ok(resolveRequestId(req.headers ?? {}), data);
  }

  @Get("all")
  @RequirePermissions("ops:read")
  async listAll(
    @Req() req: { headers?: Record<string, unknown> },
    @Query("status") status?: string
  ) {
    const actor = resolveRequestContext(req);
    const data = await this.materialsService.listAll({ tenantId: actor.tenantId, status });
    return ok(resolveRequestId(req.headers ?? {}), data);
  }

  @Post()
  @RequirePermissions("jobs:create")
  async create(
    @Req() req: { headers?: Record<string, unknown> },
    @Body() body: unknown
  ) {
    const parsed = createMaterialSchema.safeParse(body);
    if (!parsed.success) throw new BadRequestException(parsed.error.flatten());
    const actor = resolveRequestContext(req);
    const data = await this.materialsService.create({ ...parsed.data, tenantId: actor.tenantId, requestedBy: actor.userId });
    return ok(resolveRequestId(req.headers ?? {}), data);
  }

  @Post(":requestId/approve")
  @RequirePermissions("ops:write")
  async approve(
    @Req() req: { headers?: Record<string, unknown> },
    @Param("requestId") requestId: string
  ) {
    const actor = resolveRequestContext(req);
    const data = await this.materialsService.approve({ tenantId: actor.tenantId, requestId, approvedBy: actor.userId });
    return ok(resolveRequestId(req.headers ?? {}), data);
  }
}
