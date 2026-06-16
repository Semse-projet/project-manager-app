import { Injectable } from "@nestjs/common";
import { randomUUID } from "node:crypto";
import type {
  CreateFundingIntentInput,
  CreatePayoutIntentInput,
  CreateRefundIntentInput,
  PaymentProviderPort
} from "./payment-provider.port.js";

@Injectable()
export class BankTransferPaymentProvider implements PaymentProviderPort {
  readonly key = "bank-transfer" as const;

  async createFundingIntent(input: CreateFundingIntentInput) {
    const id = randomUUID();
    return {
      id: `fin_bank_${id}`,
      tenantId: input.tenantId,
      projectId: input.projectId,
      provider: this.key,
      methodType: input.methodType,
      money: input.money,
      status: "pending" as const,
      providerRef: `bank_funding_${id}`,
      externalRef: input.externalRef,
      metadata: {
        rail: "manual_bank_transfer",
        instructions: "Await incoming bank/ACH transfer confirmation before treating funds as settled.",
        ...(input.metadata ?? {})
      },
      createdAt: new Date().toISOString()
    };
  }

  async createPayoutIntent(input: CreatePayoutIntentInput) {
    const id = randomUUID();
    return {
      id: `poi_bank_${id}`,
      tenantId: input.tenantId,
      projectId: input.projectId,
      milestoneId: input.milestoneId,
      provider: this.key,
      methodType: input.methodType,
      money: input.money,
      status: "processing" as const,
      providerRef: `bank_payout_${id}`,
      externalRef: input.externalRef,
      metadata: {
        rail: "manual_bank_transfer",
        recipientUserId: input.recipientUserId,
        ...(input.metadata ?? {})
      },
      createdAt: new Date().toISOString()
    };
  }

  async createRefundIntent(input: CreateRefundIntentInput) {
    const id = randomUUID();
    return {
      id: `rei_bank_${id}`,
      tenantId: input.tenantId,
      projectId: input.projectId,
      provider: this.key,
      methodType: input.methodType,
      money: input.money,
      status: "pending" as const,
      providerRef: `bank_refund_${id}`,
      externalRef: input.externalRef,
      originalProviderRef: input.originalProviderRef,
      metadata: {
        rail: "manual_bank_transfer",
        ...(input.metadata ?? {})
      },
      createdAt: new Date().toISOString()
    };
  }
}
