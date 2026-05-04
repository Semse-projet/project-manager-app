import { Injectable } from "@nestjs/common";
import {
  type CreateFundingIntentInput,
  type CreatePayoutIntentInput,
  type PaymentProviderPort
} from "./payment-provider.port.js";

@Injectable()
export class MockPaymentProvider implements PaymentProviderPort {
  readonly key = "mock" as const;

  async createFundingIntent(input: CreateFundingIntentInput) {
    return {
      id: `fin_${Date.now()}`,
      tenantId: input.tenantId,
      projectId: input.projectId,
      provider: input.provider,
      methodType: input.methodType,
      money: input.money,
      status: "captured" as const,
      providerRef: `mock_funding_${Date.now()}`,
      externalRef: input.externalRef,
      metadata: input.metadata,
      createdAt: new Date().toISOString()
    };
  }

  async createPayoutIntent(input: CreatePayoutIntentInput) {
    return {
      id: `poi_${Date.now()}`,
      tenantId: input.tenantId,
      projectId: input.projectId,
      milestoneId: input.milestoneId,
      provider: input.provider,
      methodType: input.methodType,
      money: input.money,
      status: "paid" as const,
      providerRef: `mock_payout_${Date.now()}`,
      externalRef: input.externalRef,
      metadata: input.metadata,
      createdAt: new Date().toISOString()
    };
  }
}
