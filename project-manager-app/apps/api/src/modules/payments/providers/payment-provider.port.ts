import type {
  FundingIntentRecord,
  Money,
  PayoutIntentRecord,
  RefundIntentRecord,
  PaymentMethodType,
  PaymentProviderKey
} from "../payments.types.js";

export type CreateFundingIntentInput = {
  tenantId: string;
  projectId: string;
  provider: PaymentProviderKey;
  methodType: PaymentMethodType;
  money: Money;
  externalRef: string;
  metadata?: Record<string, unknown>;
};

export type CreatePayoutIntentInput = {
  tenantId: string;
  projectId: string;
  milestoneId?: string;
  recipientUserId?: string;  // contractor's userId for per-account payout with platform fee
  provider: PaymentProviderKey;
  methodType: PaymentMethodType;
  money: Money;
  externalRef: string;
  metadata?: Record<string, unknown>;
};

export type CreateRefundIntentInput = {
  tenantId: string;
  projectId: string;
  provider: PaymentProviderKey;
  methodType: PaymentMethodType;
  money: Money;
  externalRef: string;
  originalProviderRef?: string;
  metadata?: Record<string, unknown>;
};

export interface PaymentProviderPort {
  readonly key: PaymentProviderKey;
  createFundingIntent(input: CreateFundingIntentInput): Promise<FundingIntentRecord>;
  createPayoutIntent(input: CreatePayoutIntentInput): Promise<PayoutIntentRecord>;
  createRefundIntent(input: CreateRefundIntentInput): Promise<RefundIntentRecord>;
}
