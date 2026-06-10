import { Body, Controller, Get, Param, Post, Req } from "@nestjs/common";
import type { FastifyRequest } from "fastify";
import { PaymentGovernanceService } from "./payment-governance.service.js";
import { ok } from "../../common/api-response.js";
import { resolveRequestContext } from "../../common/request-context.js";
import { resolveRequestId } from "../../common/request-id.js";
import { RequirePermissions } from "../../common/permissions.decorator.js";

function actor(req: FastifyRequest) {
  return resolveRequestContext(req as Parameters<typeof resolveRequestContext>[0]);
}

@Controller("v1/payments")
export class PaymentGovernanceController {
  constructor(private readonly service: PaymentGovernanceService) {}

  @Post("release")
  @RequirePermissions("finance:write")
  async releasePayment(
    @Req() req: FastifyRequest,
    @Body() body: Record<string, unknown>,
  ) {
    const rid = resolveRequestId(req.headers ?? {});
    const ctx = actor(req);

    const result = await this.service.releasePayment({
      escrowId: String(body.escrowId ?? ""),
      milestoneId: String(body.milestoneId ?? ""),
      amount: Number(body.amount ?? 0),
      reason: String(body.reason ?? ""),
      releasedBy: ctx.userId,
    });

    return ok(rid, result);
  }

  @Post("block")
  @RequirePermissions("finance:write")
  async blockPayment(
    @Req() req: FastifyRequest,
    @Body() body: Record<string, unknown>,
  ) {
    const rid = resolveRequestId(req.headers ?? {});
    const ctx = actor(req);

    const result = await this.service.blockPayment(
      String(body.escrowId ?? ""),
      String(body.reason ?? ""),
      ctx.userId,
    );

    return ok(rid, result);
  }

  @Get("escrow/:escrowId/history")
  @RequirePermissions("finance:read")
  async getPaymentHistory(
    @Req() req: FastifyRequest,
    @Param("escrowId") escrowId: string,
  ) {
    const rid = resolveRequestId(req.headers ?? {});
    const result = await this.service.getPaymentHistory(escrowId);
    return ok(rid, result);
  }

  @Get("escrow/:escrowId/score")
  @RequirePermissions("finance:read")
  async getPaymentScore(
    @Req() req: FastifyRequest,
    @Param("escrowId") escrowId: string,
    @Param("milestoneId") milestoneId: string,
  ) {
    const rid = resolveRequestId(req.headers ?? {});
    const score = await this.service.calculatePaymentScore(
      escrowId,
      milestoneId,
    );
    return ok(rid, score);
  }

  @Get("diagnostics")
  @RequirePermissions("finance:read")
  async getDiagnostics(@Req() req: FastifyRequest) {
    const rid = resolveRequestId(req.headers ?? {});
    const ctx = actor(req);
    const diagnostics = await this.service.getDiagnostics(ctx.tenantId);
    return ok(rid, diagnostics);
  }
}
