import { BadRequestException, Body, Controller, Get, Param, Post, RawBody, Req } from "@nestjs/common";
import { depositEscrowSchema, paymentsWebhookSchema, releaseEscrowSchema } from "@semse/schemas";
import { z } from "zod";
import { ok } from "../../common/api-response.js";
import { toVisibleContract, toVisibleEscrow, toVisiblePaymentTxn } from "../../common/visible-response.js";
import { RequirePermissions } from "../../common/permissions.decorator.js";
import { Public } from "../../common/public.decorator.js";
import { resolveRequestContext } from "../../common/request-context.js";
import { resolveRequestId } from "../../common/request-id.js";
import { PaymentsService } from "./payments.service.js";
import { verifyStripeWebhookSignature } from "./stripe-webhook-signature.js";

const workerPayoutMethodSchema = z.object({
  type: z.enum(["bank_account", "debit_card", "paypal", "zelle", "cashapp"]),
  bankName: z.string().trim().min(1).optional(),
  routingNumber: z.string().trim().optional(),
  accountNumber: z.string().trim().optional(),
  last4: z.string().trim().optional(),
  email: z.string().trim().optional()
});

@Controller()
export class PaymentsController {
  constructor(private readonly paymentsService: PaymentsService) {}

  @Get("v1/workers/me/payout-method")
  @RequirePermissions("workers:read")
  async workerPayoutMethod(@Req() req: { headers?: Record<string, unknown> }) {
    const actor = resolveRequestContext(req);
    const result = await this.paymentsService.getWorkerPayoutMethod({
      tenantId: actor.tenantId,
      orgId: actor.orgId,
      userId: actor.userId
    });
    return ok(resolveRequestId(req.headers ?? {}), result);
  }

  @Post("v1/workers/me/payout-method")
  @RequirePermissions("workers:write")
  async saveWorkerPayoutMethod(
    @Req() req: { headers?: Record<string, unknown> },
    @Body() body: Record<string, unknown>
  ) {
    const parsed = workerPayoutMethodSchema.safeParse(body);
    if (!parsed.success) {
      throw new BadRequestException(parsed.error.flatten());
    }

    const actor = resolveRequestContext(req);
    const requestId = resolveRequestId(req.headers ?? {});
    const result = await this.paymentsService.saveWorkerPayoutMethod({
      tenantId: actor.tenantId,
      orgId: actor.orgId,
      userId: actor.userId,
      requestId,
      ...parsed.data
    });
    return ok(requestId, result);
  }

  @Post("v1/projects/:projectId/escrow/deposit")
  @RequirePermissions("projects:financials:write")
  async deposit(
    @Req() req: { headers?: Record<string, unknown> },
    @Param("projectId") projectId: string,
    @Body() body: Record<string, unknown>
  ) {
    const parsed = depositEscrowSchema.safeParse(body);
    if (!parsed.success) {
      throw new BadRequestException(parsed.error.flatten());
    }

    const actor = resolveRequestContext(req);
    const requestId = resolveRequestId(req.headers ?? {});
    const result = await this.paymentsService.deposit({
      tenantId: actor.tenantId,
      orgId: actor.orgId,
      userId: actor.userId,
      roles: actor.roles,
      projectId,
      amount: parsed.data.amount,
      currency: parsed.data.currency,
      provider: parsed.data.provider,
      methodType: parsed.data.methodType,
      requestId
    });

    return ok(requestId, {
      ...result,
      escrow: toVisibleEscrow(result.escrow),
      transaction: toVisiblePaymentTxn(result.transaction)
    });
  }

  @Post("v1/jobs/:jobId/escrow/fund")
  @RequirePermissions("projects:financials:write")
  async fundByJob(
    @Req() req: { headers?: Record<string, unknown> },
    @Param("jobId") jobId: string,
    @Body() body: Record<string, unknown>
  ) {
    const parsed = depositEscrowSchema.safeParse(body);
    if (!parsed.success) {
      throw new BadRequestException(parsed.error.flatten());
    }

    const actor = resolveRequestContext(req);
    const requestId = resolveRequestId(req.headers ?? {});
    const result = await this.paymentsService.depositByJob({
      tenantId: actor.tenantId,
      orgId: actor.orgId,
      userId: actor.userId,
      roles: actor.roles,
      jobId,
      amount: parsed.data.amount,
      currency: parsed.data.currency,
      provider: parsed.data.provider,
      methodType: parsed.data.methodType,
      requestId
    });

    return ok(requestId, {
      ...result,
      escrow: toVisibleEscrow(result.escrow),
      transaction: toVisiblePaymentTxn(result.transaction),
      contract: toVisibleContract(result.contract)
    });
  }

  @Get("v1/jobs/:jobId/payments")
  @RequirePermissions("jobs:read")
  async listByJob(@Req() req: { headers?: Record<string, unknown> }, @Param("jobId") jobId: string) {
    const actor = resolveRequestContext(req);
    const result = await this.paymentsService.paymentsByJob({
      tenantId: actor.tenantId,
      orgId: actor.orgId,
      userId: actor.userId,
      roles: actor.roles,
      jobId
    });

    return ok(resolveRequestId(req.headers ?? {}), result.map((item) => toVisiblePaymentTxn(item)));
  }

  @Get("v1/jobs/:jobId/payment-readiness")
  @RequirePermissions("jobs:read")
  async paymentReadinessByJob(@Req() req: { headers?: Record<string, unknown> }, @Param("jobId") jobId: string) {
    const actor = resolveRequestContext(req);
    const result = await this.paymentsService.paymentReadinessByJob({
      tenantId: actor.tenantId,
      orgId: actor.orgId,
      userId: actor.userId,
      roles: actor.roles,
      jobId
    });

    return ok(resolveRequestId(req.headers ?? {}), result);
  }

  @Get("v1/jobs/:jobId/escrow")
  @RequirePermissions("projects:financials:read")
  async escrowByJob(@Req() req: { headers?: Record<string, unknown> }, @Param("jobId") jobId: string) {
    const actor = resolveRequestContext(req);
    const result = await this.paymentsService.escrowByJob({
      tenantId: actor.tenantId,
      orgId: actor.orgId,
      userId: actor.userId,
      roles: actor.roles,
      jobId
    });

    if (!result) {
      return ok(resolveRequestId(req.headers ?? {}), null);
    }

    return ok(resolveRequestId(req.headers ?? {}), {
      ...result,
      escrow: toVisibleEscrow(result.escrow),
      contract: toVisibleContract(result.contract)
    });
  }

  @Post("v1/milestones/:milestoneId/escrow/release")
  @RequirePermissions("projects:financials:write")
  async release(
    @Req() req: { headers?: Record<string, unknown> },
    @Param("milestoneId") milestoneId: string,
    @Body() body: Record<string, unknown>
  ) {
    const parsed = releaseEscrowSchema.safeParse(body);
    if (!parsed.success) {
      throw new BadRequestException(parsed.error.flatten());
    }

    const actor = resolveRequestContext(req);
    const requestId = resolveRequestId(req.headers ?? {});
    const result = await this.paymentsService.release({
      tenantId: actor.tenantId,
      orgId: actor.orgId,
      userId: actor.userId,
      roles: actor.roles,
      milestoneId,
      amount: parsed.data.amount,
      provider: parsed.data.provider,
      methodType: parsed.data.methodType,
      requestId
    });

    return ok(requestId, {
      ...result,
      transaction: toVisiblePaymentTxn(result.transaction)
    });
  }

  @Post("v1/payments/webhook")
  @Public()
  webhook(
    @Req() req: { headers?: Record<string, unknown> },
    @Body() body: Record<string, unknown>,
    @RawBody() rawBody?: Buffer,
  ) {
    const requestId = resolveRequestId(req.headers ?? {});

    const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
    if (webhookSecret) {
      const signature = req.headers?.["stripe-signature"];
      const signatureHeader = Array.isArray(signature)
        ? signature.join(",")
        : typeof signature === "string"
          ? signature
          : undefined;
      if (!signatureHeader) {
        throw new BadRequestException("Missing Stripe-Signature header");
      }
      if (!rawBody) {
        throw new BadRequestException("Raw request body required for Stripe webhook signature verification");
      }
      const validSignature = verifyStripeWebhookSignature({
        payload: rawBody,
        signatureHeader,
        secret: webhookSecret,
      });
      if (!validSignature) {
        throw new BadRequestException("Invalid Stripe-Signature header");
      }
    }

    const parsed = paymentsWebhookSchema.safeParse(body);
    if (!parsed.success) {
      throw new BadRequestException(parsed.error.flatten());
    }

    return ok(requestId, this.paymentsService.webhook({ ...parsed.data, requestId }));
  }
}
