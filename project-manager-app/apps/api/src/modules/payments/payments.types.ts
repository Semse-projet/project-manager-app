export const paymentProviderKeys = ["mock", "stripe", "paypal", "adyen", "bank-transfer"] as const;
export type PaymentProviderKey = (typeof paymentProviderKeys)[number];

export const paymentMethodTypes = [
  "card",
  "bank_transfer",
  "ach",
  "sepa",
  "wallet",
  "payout_bank"
] as const;
export type PaymentMethodType = (typeof paymentMethodTypes)[number];

export const fundingIntentStatuses = [
  "draft",
  "pending",
  "authorized",
  "captured",
  "failed",
  "cancelled",
  "reversed"
] as const;
export type FundingIntentStatus = (typeof fundingIntentStatuses)[number];

export const payoutIntentStatuses = [
  "draft",
  "pending",
  "processing",
  "paid",
  "failed",
  "cancelled",
  "reversed"
] as const;
export type PayoutIntentStatus = (typeof payoutIntentStatuses)[number];

export type Money = {
  amount: number;
  currency: string;
};

export type FundingIntentRecord = {
  id: string;
  tenantId: string;
  projectId: string;
  provider: PaymentProviderKey;
  methodType: PaymentMethodType;
  money: Money;
  status: FundingIntentStatus;
  providerRef: string;
  externalRef: string;
  metadata?: Record<string, unknown>;
  createdAt: string;
};

export type PayoutIntentRecord = {
  id: string;
  tenantId: string;
  projectId: string;
  milestoneId?: string;
  provider: PaymentProviderKey;
  methodType: PaymentMethodType;
  money: Money;
  status: PayoutIntentStatus;
  providerRef: string;
  externalRef: string;
  metadata?: Record<string, unknown>;
  createdAt: string;
};
