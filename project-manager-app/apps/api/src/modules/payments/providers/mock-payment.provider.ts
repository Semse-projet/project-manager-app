import { Injectable } from "@nestjs/common";
import { randomUUID } from "node:crypto";
import {
  type CreateFundingIntentInput,
  type CreatePayoutIntentInput,
  type CreateRefundIntentInput,
  type PaymentProviderPort
} from "./payment-provider.port.js";

@Injectable()
export class MockPaymentProvider implements PaymentProviderPort {
  readonly key = "mock" as const;

  async createFundingIntent(input: CreateFundingIntentInput) {
    const id = randomUUID();
    return {
      id: `fin_${id}`,
      tenantId: input.tenantId,
      projectId: input.projectId,
      provider: input.provider,
      methodType: input.methodType,
      money: input.money,
      status: "captured" as const,
      providerRef: `mock_funding_${id}`,
      externalRef: input.externalRef,
      metadata: input.metadata,
      createdAt: new Date().toISOString()
    };
  }

  async createPayoutIntent(input: CreatePayoutIntentInput) {
    const id = randomUUID();
    return {
      id: `poi_${id}`,
      tenantId: input.tenantId,
      projectId: input.projectId,
      milestoneId: input.milestoneId,
      provider: input.provider,
      methodType: input.methodType,
      money: input.money,
      status: "paid" as const,
      providerRef: `mock_payout_${id}`,
      externalRef: input.externalRef,
      metadata: input.metadata,
      createdAt: new Date().toISOString()
    };
  }

  async createRefundIntent(input: CreateRefundIntentInput) {
    const id = randomUUID();
    return {
      id: `rei_${id}`,
      tenantId: input.tenantId,
      projectId: input.projectId,
      provider: input.provider,
      methodType: input.methodType,
      money: input.money,
      status: "succeeded" as const,
      providerRef: `mock_refund_${id}`,
      externalRef: input.externalRef,
      originalProviderRef: input.originalProviderRef,
      metadata: input.metadata,
      createdAt: new Date().toISOString()
    };
  }
}
