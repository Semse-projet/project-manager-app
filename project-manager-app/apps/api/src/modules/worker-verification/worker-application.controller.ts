import {
  BadRequestException, Body, Controller, Get,
  Headers, Param, Patch, Post, Query, Req,
} from "@nestjs/common";
import type { FastifyRequest } from "fastify";
import { z } from "zod";
import { ok } from "../../common/api-response.js";
import { Public } from "../../common/public.decorator.js";
import { RequirePermissions } from "../../common/permissions.decorator.js";
import { resolveRequestContext } from "../../common/request-context.js";
import { resolveRequestId } from "../../common/request-id.js";
import { WorkerApplicationService } from "./worker-application.service.js";

const submitSchema = z.object({
  fullName: z.string().trim().min(2).max(120),
  email: z.string().trim().email().max(160),
  phone: z.string().trim().min(7).max(30).optional(),
  city: z.string().trim().min(2).max(80).optional(),
  trade: z.string().trim().min(2).max(60),
  yearsExperience: z.number().int().min(0).max(60).optional(),
  message: z.string().trim().max(2000).optional(),
  proposedRate: z.number().min(0).max(1_000_000).optional(),
  jobId: z.string().regex(/^[A-Za-z0-9_-]{1,128}$/).optional(),
  sessionToken: z.string().trim().max(128).optional(),
});

const reviewSchema = z.object({
  status: z.enum(["reviewing", "approved", "rejected"]),
  reviewNotes: z.string().trim().max(2000).optional(),
  createdUserId: z.string().regex(/^[A-Za-z0-9_-]{1,128}$/).optional(),
});

function actor(req: FastifyRequest) {
  return resolveRequestContext(req as Parameters<typeof resolveRequestContext>[0]);
}

@Controller("v1/workers")
export class WorkerApplicationController {
  constructor(private readonly service: WorkerApplicationService) {}

  @Post("applications")
  @Public()
  async submitApplication(
    @Req() req: FastifyRequest,
    @Headers("x-tenant-id") tenantIdHeader: string | undefined,
    @Headers("x-session-token") sessionTokenHeader: string | undefined,
    @Body() body: Record<string, unknown>,
  ) {
    const rid = resolveRequestId(req.headers ?? {});
    const parsed = submitSchema.safeParse(body);
    if (!parsed.success) {
      throw new BadRequestException(parsed.error.flatten());
    }

    const tenantId = tenantIdHeader?.trim() || "tenant_default";
    const sessionToken = sessionTokenHeader?.trim() || parsed.data.sessionToken;

    const record = await this.service.submitApplication({
      tenantId,
      fullName: parsed.data.fullName,
      email: parsed.data.email,
      phone: parsed.data.phone,
      city: parsed.data.city,
      trade: parsed.data.trade,
      yearsExperience: parsed.data.yearsExperience,
      message: parsed.data.message,
      proposedRate: parsed.data.proposedRate,
      jobId: parsed.data.jobId,
      sessionToken,
      sourceChannel: "web",
    });

    // Público: no exponer campos internos de revisión.
    return ok(rid, {
      applicationId: record.id,
      status: record.status,
      trade: record.trade,
      jobId: record.jobId,
      createdAt: record.createdAt,
    });
  }

  @Get("applications")
  @RequirePermissions("worker:read")
  async listApplications(
    @Req() req: FastifyRequest,
    @Query("status") status?: string,
    @Query("limit") limit?: string,
    @Query("offset") offset?: string,
  ) {
    const rid = resolveRequestId(req.headers ?? {});
    const ctx = actor(req);
    const data = await this.service.listApplications({
      tenantId: ctx.tenantId,
      status: status?.trim() || undefined,
      limit: limit ? Number.parseInt(limit, 10) : 50,
      offset: offset ? Number.parseInt(offset, 10) : 0,
    });
    return ok(rid, data);
  }

  @Get("applications/stats")
  @RequirePermissions("worker:read")
  async applicationStats(@Req() req: FastifyRequest) {
    const rid = resolveRequestId(req.headers ?? {});
    const ctx = actor(req);
    return ok(rid, await this.service.getStats(ctx.tenantId));
  }

  @Patch("applications/:id/review")
  @RequirePermissions("worker:write")
  async reviewApplication(
    @Req() req: FastifyRequest,
    @Param("id") id: string,
    @Body() body: Record<string, unknown>,
  ) {
    const rid = resolveRequestId(req.headers ?? {});
    const ctx = actor(req);
    const parsed = reviewSchema.safeParse(body);
    if (!parsed.success) {
      throw new BadRequestException(parsed.error.flatten());
    }

    const record = await this.service.reviewApplication({
      id,
      tenantId: ctx.tenantId,
      reviewedBy: ctx.userId,
      status: parsed.data.status,
      reviewNotes: parsed.data.reviewNotes,
      createdUserId: parsed.data.createdUserId,
    });
    return ok(rid, record);
  }
}
