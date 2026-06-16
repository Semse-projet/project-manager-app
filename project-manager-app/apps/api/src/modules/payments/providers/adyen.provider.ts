import { BadRequestException, Injectable, Logger } from "@nestjs/common";
import type {
  CreateFundingIntentInput,
  CreatePayoutIntentInput,
  CreateRefundIntentInput,
  PaymentProviderPort
} from "./payment-provider.port.js";
import type { FundingIntentRecord, PayoutIntentRecord, RefundIntentRecord } from "../payments.types.js";

type AdyenPaymentResponse = {
  pspReference?: string;
  resultCode?: string;
  action?: unknown;
};

type AdyenTransferResponse = {
  id?: string;
  status?: string;
};

@Injectable()
export class AdyenPaymentProvider implements PaymentProviderPort {
  readonly key = "adyen" as const;

  private readonly logger = new Logger(AdyenPaymentProvider.name);
  private readonly checkoutBaseUrl = process.env.ADYEN_CHECKOUT_BASE_URL?.trim()
    || (process.env.ADYEN_ENVIRONMENT === "live" ? "https://checkout-live.adyen.com" : "https://checkout-test.adyen.com");
  private readonly balanceBaseUrl = process.env.ADYEN_BALANCE_BASE_URL?.trim()
    || (process.env.ADYEN_ENVIRONMENT === "live" ? "https://balanceplatform-api-live.adyen.com" : "https://balanceplatform-api-test.adyen.com");

  async createFundingIntent(input: CreateFundingIntentInput): Promise<FundingIntentRecord> {
    const merchantAccount = this.requireEnv("ADYEN_MERCHANT_ACCOUNT");
    const response = await this.adyenFetch<AdyenPaymentResponse>(
      `${this.checkoutBaseUrl}/v71/payments`,
      {
        merchantAccount,
        reference: input.externalRef,
        amount: {
          currency: input.money.currency.toUpperCase(),
          value: Math.round(input.money.amount * 100)
        },
        paymentMethod: { type: input.methodType === "wallet" ? "scheme" : input.methodType },
        returnUrl: process.env.ADYEN_RETURN_URL?.trim() || process.env.SEMSE_WEB_BASE_URL || "https://semseproject.com/payments/return",
        metadata: {
          semse_tenant_id: input.tenantId,
          semse_project_id: input.projectId
        }
      }
    );

    const providerRef = response.pspReference;
    if (!providerRef) {
      throw new Error("Adyen payment response did not include pspReference");
    }

    this.logger.log({ pspReference: providerRef, projectId: input.projectId }, "Adyen payment created");
    return {
      id: `fin_${providerRef}`,
      tenantId: input.tenantId,
      projectId: input.projectId,
      provider: this.key,
      methodType: input.methodType,
      money: input.money,
      status: adyenFundingStatus(response.resultCode),
      providerRef,
      externalRef: input.externalRef,
      metadata: { action: response.action, ...(input.metadata ?? {}) },
      createdAt: new Date().toISOString()
    };
  }

  async createPayoutIntent(input: CreatePayoutIntentInput): Promise<PayoutIntentRecord> {
    const sourceAccount = this.requireEnv("ADYEN_SOURCE_BALANCE_ACCOUNT_ID");
    const targetAccount = String(input.metadata?.adyenBalanceAccountId ?? process.env.ADYEN_DEFAULT_TARGET_BALANCE_ACCOUNT_ID ?? "").trim();
    if (!targetAccount) {
      throw new BadRequestException("Adyen payout requires a target balance account id");
    }

    const response = await this.adyenFetch<AdyenTransferResponse>(
      `${this.balanceBaseUrl}/btl/v4/transfers`,
      {
        amount: {
          currency: input.money.currency.toUpperCase(),
          value: Math.round(input.money.amount * 100)
        },
        reference: input.externalRef,
        sourceAccount: { accountHolderId: sourceAccount },
        destination: { accountHolderId: targetAccount },
        description: `SEMSE milestone payout ${input.milestoneId ?? input.projectId}`
      }
    );

    const providerRef = response.id;
    if (!providerRef) {
      throw new Error("Adyen transfer response did not include id");
    }

    return {
      id: `poi_${providerRef}`,
      tenantId: input.tenantId,
      projectId: input.projectId,
      milestoneId: input.milestoneId,
      provider: this.key,
      methodType: input.methodType,
      money: input.money,
      status: adyenPayoutStatus(response.status),
      providerRef,
      externalRef: input.externalRef,
      metadata: {
        recipientUserId: input.recipientUserId,
        adyenBalanceAccountId: targetAccount,
        ...(input.metadata ?? {})
      },
      createdAt: new Date().toISOString()
    };
  }

  async createRefundIntent(input: CreateRefundIntentInput): Promise<RefundIntentRecord> {
    const merchantAccount = this.requireEnv("ADYEN_MERCHANT_ACCOUNT");
    if (!input.originalProviderRef) {
      throw new BadRequestException("Adyen refund requires original pspReference");
    }

    const response = await this.adyenFetch<AdyenPaymentResponse>(
      `${this.checkoutBaseUrl}/v71/payments/${encodeURIComponent(input.originalProviderRef)}/refunds`,
      {
        merchantAccount,
        reference: input.externalRef,
        amount: {
          currency: input.money.currency.toUpperCase(),
          value: Math.round(input.money.amount * 100)
        }
      }
    );

    const providerRef = response.pspReference;
    if (!providerRef) {
      throw new Error("Adyen refund response did not include pspReference");
    }

    return {
      id: `rei_${providerRef}`,
      tenantId: input.tenantId,
      projectId: input.projectId,
      provider: this.key,
      methodType: input.methodType,
      money: input.money,
      status: adyenRefundStatus(response.resultCode),
      providerRef,
      externalRef: input.externalRef,
      originalProviderRef: input.originalProviderRef,
      metadata: { ...(input.metadata ?? {}) },
      createdAt: new Date().toISOString()
    };
  }

  private requireEnv(name: string): string {
    const value = process.env[name]?.trim();
    if (!value) {
      throw new Error(`Adyen provider requires ${name}`);
    }
    return value;
  }

  private async adyenFetch<T>(url: string, body: Record<string, unknown>): Promise<T> {
    const apiKey = this.requireEnv("ADYEN_API_KEY");
    const response = await fetch(url, {
      method: "POST",
      headers: {
        "x-api-key": apiKey,
        "content-type": "application/json"
      },
      body: JSON.stringify(body)
    });
    const payload = await response.json().catch(() => ({})) as T & { message?: string; errorCode?: string };
    if (!response.ok) {
      throw new Error(payload.message || payload.errorCode || `Adyen request failed with ${response.status}`);
    }
    return payload;
  }
}

function adyenFundingStatus(resultCode?: string): FundingIntentRecord["status"] {
  switch (resultCode) {
    case "Authorised": return "authorized";
    case "Received":
    case "Pending": return "pending";
    case "Refused":
    case "Error": return "failed";
    case "Cancelled": return "cancelled";
    default: return "pending";
  }
}

function adyenPayoutStatus(status?: string): PayoutIntentRecord["status"] {
  switch (status) {
    case "booked":
    case "received": return "paid";
    case "failed": return "failed";
    case "cancelled": return "cancelled";
    default: return "processing";
  }
}

function adyenRefundStatus(resultCode?: string): RefundIntentRecord["status"] {
  switch (resultCode) {
    case "Received": return "pending";
    case "Authorised": return "succeeded";
    case "Refused":
    case "Error": return "failed";
    case "Cancelled": return "cancelled";
    default: return "pending";
  }
}
