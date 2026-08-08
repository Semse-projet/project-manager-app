import { z } from "zod";

export const paymentProviderSchema = z.enum(["mock", "stripe", "paypal", "adyen", "bank-transfer"]);

export const paymentMethodTypeSchema = z.enum([
  "card",
  "bank_transfer",
  "ach",
  "sepa",
  "wallet",
  "payout_bank"
]);

export const depositEscrowSchema = z.object({
  amount: z.number().positive(),
  currency: z.string().min(3).max(3).optional(),
  provider: paymentProviderSchema.optional(),
  methodType: paymentMethodTypeSchema.optional()
});

export const releaseEscrowSchema = z.object({
  amount: z.number().positive().optional(),
  provider: paymentProviderSchema.optional(),
  methodType: paymentMethodTypeSchema.optional()
});

export const refundEscrowSchema = z.object({
  projectId: z.string().min(1).optional(),
  escrowId: z.string().min(1).optional(),
  amount: z.number().positive(),
  reason: z.string().trim().min(3).max(500),
  provider: paymentProviderSchema.optional(),
  methodType: paymentMethodTypeSchema.optional()
}).refine((value) => Boolean(value.projectId || value.escrowId), {
  message: "projectId or escrowId is required",
  path: ["projectId"]
});

export const paymentsWebhookSchema = z.object({
  // Legacy/simple shape (mock provider, existing tests).
  event: z.string().min(1).optional(),
  providerRef: z.string().min(1).optional(),
  // Real Stripe webhook envelope shape: { type, data: { object: { id, status } } }.
  type: z.string().min(1).optional(),
  data: z.object({
    object: z.object({
      id: z.string().min(1).optional(),
      status: z.string().min(1).optional()
    }).passthrough().optional()
  }).passthrough().optional()
}).passthrough();

export type PaymentProvider = z.infer<typeof paymentProviderSchema>;
export type PaymentMethodType = z.infer<typeof paymentMethodTypeSchema>;
export type DepositEscrowInput = z.infer<typeof depositEscrowSchema>;
export type ReleaseEscrowInput = z.infer<typeof releaseEscrowSchema>;
export type RefundEscrowInput = z.infer<typeof refundEscrowSchema>;
export type PaymentsWebhookInput = z.infer<typeof paymentsWebhookSchema>;

// Matches PaymentTxnRecord in apps/api/src/common/domain-store.ts, as returned
// by GET /v1/jobs/:jobId/payments after toVisiblePaymentTxn() — type/status are
// uppercased display strings, typeRaw/statusRaw keep the original lowercase value.
export const paymentTxnRecordSchema = z.object({
  id: z.string().min(1),
  tenantId: z.string().min(1),
  escrowId: z.string().min(1),
  projectId: z.string().min(1),
  jobId: z.string().min(1).optional(),
  contractId: z.string().min(1).optional(),
  milestoneId: z.string().min(1).optional(),
  type: z.string().min(1),
  typeRaw: z.string().min(1).optional(),
  amount: z.number(),
  status: z.string().min(1),
  statusRaw: z.string().min(1).optional(),
  createdAt: z.string().min(1)
});

export type PaymentTxnRecordView = z.infer<typeof paymentTxnRecordSchema>;

export const payoutMethodTypeSchema = z.enum(["bank_account", "debit_card", "paypal", "zelle", "cashapp"]);

// Matches the body accepted by POST /v1/workers/me/payout-method
// (workerPayoutMethodSchema, apps/api/src/modules/payments/payments.controller.ts).
// The raw routing/account/card number never reaches this — stripeToken and
// last4 both come from client-side Stripe tokenization. See AUDIT_REMEDIATION_PLAN.md 2.44.
export const saveWorkerPayoutMethodSchema = z.object({
  type: payoutMethodTypeSchema,
  bankName: z.string().trim().min(1).optional(),
  stripeToken: z.string().trim().min(1).optional(),
  last4: z.string().trim().optional(),
  email: z.string().trim().optional()
});

// Matches GET/POST /v1/workers/me/payout-method's response shape.
export const workerPayoutMethodViewSchema = z.object({
  type: payoutMethodTypeSchema,
  label: z.string().min(1),
  bankName: z.string().optional(),
  last4: z.string().optional(),
  email: z.string().optional(),
  verified: z.boolean()
});

export type PayoutMethodType = z.infer<typeof payoutMethodTypeSchema>;
export type SaveWorkerPayoutMethodInput = z.infer<typeof saveWorkerPayoutMethodSchema>;
export type WorkerPayoutMethodView = z.infer<typeof workerPayoutMethodViewSchema>;
