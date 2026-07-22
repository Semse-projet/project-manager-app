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
