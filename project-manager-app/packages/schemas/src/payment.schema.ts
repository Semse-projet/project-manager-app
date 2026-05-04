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

export const paymentsWebhookSchema = z.object({
  event: z.string().min(1).optional(),
  providerRef: z.string().min(1).optional()
});

export type PaymentProvider = z.infer<typeof paymentProviderSchema>;
export type PaymentMethodType = z.infer<typeof paymentMethodTypeSchema>;
export type DepositEscrowInput = z.infer<typeof depositEscrowSchema>;
export type ReleaseEscrowInput = z.infer<typeof releaseEscrowSchema>;
export type PaymentsWebhookInput = z.infer<typeof paymentsWebhookSchema>;
