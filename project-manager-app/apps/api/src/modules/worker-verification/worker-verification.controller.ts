import { Body, Controller, Get, Param, Post, Req } from "@nestjs/common";
import type { FastifyRequest } from "fastify";
import { WorkerVerificationService } from "./worker-verification.service.js";
import { ok } from "../../common/api-response.js";
import { resolveRequestContext } from "../../common/request-context.js";
import { resolveRequestId } from "../../common/request-id.js";
import { RequirePermissions } from "../../common/permissions.decorator.js";

function actor(req: FastifyRequest) {
  return resolveRequestContext(req as Parameters<typeof resolveRequestContext>[0]);
}

@Controller("v1/workers")
export class WorkerVerificationController {
  constructor(private readonly service: WorkerVerificationService) {}

  @Post(":workerId/verify")
  @RequirePermissions("worker:write")
  async initiateVerification(
    @Req() req: FastifyRequest,
    @Param("workerId") workerId: string,
  ) {
    const rid = resolveRequestId(req.headers ?? {});
    const ctx = actor(req);

    const state = await this.service.initiateVerification({
      workerId,
      tenantId: ctx.tenantId,
      verificationType: "DID_SIGNATURE",
    });

    return ok(rid, state);
  }

  @Post(":workerId/sign")
  @RequirePermissions("worker:write")
  async submitDidSignature(
    @Req() req: FastifyRequest,
    @Param("workerId") workerId: string,
    @Body() body: Record<string, unknown>,
  ) {
    const rid = resolveRequestId(req.headers ?? {});
    const ctx = actor(req);

    const state = await this.service.submitDidSignature(
      workerId,
      ctx.tenantId,
      String(body.didSignature ?? ""),
      String(body.didPublicKey ?? ""),
    );

    return ok(rid, state);
  }

  @Get(":workerId/status")
  @RequirePermissions("worker:read")
  async getVerificationStatus(
    @Req() req: FastifyRequest,
    @Param("workerId") workerId: string,
  ) {
    const rid = resolveRequestId(req.headers ?? {});

    const state = await this.service.getVerificationStatus(workerId);

    return ok(rid, state);
  }

  @Get(":workerId/history")
  @RequirePermissions("worker:read")
  async getVerificationHistory(
    @Req() req: FastifyRequest,
    @Param("workerId") workerId: string,
  ) {
    const rid = resolveRequestId(req.headers ?? {});

    const history = await this.service.getVerificationHistory(workerId);

    return ok(rid, history);
  }

  @Get("unverified/list")
  @RequirePermissions("worker:read")
  async listUnverifiedWorkers(@Req() req: FastifyRequest) {
    const rid = resolveRequestId(req.headers ?? {});
    const ctx = actor(req);

    const workers = await this.service.listUnverifiedWorkers(ctx.tenantId);

    return ok(rid, { count: workers.length, workers });
  }

  @Get("verification/stats")
  @RequirePermissions("worker:read")
  async getVerificationStats(@Req() req: FastifyRequest) {
    const rid = resolveRequestId(req.headers ?? {});
    const ctx = actor(req);

    const stats = await this.service.getVerificationStats(ctx.tenantId);

    return ok(rid, stats);
  }
}
