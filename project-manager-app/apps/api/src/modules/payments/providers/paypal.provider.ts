import { BadRequestException, Injectable, Logger } from "@nestjs/common";
import type {
  CreateFundingIntentInput,
  CreatePayoutIntentInput,
  CreateRefundIntentInput,
  PaymentProviderPort
} from "./payment-provider.port.js";
import type { FundingIntentRecord, PayoutIntentRecord, RefundIntentRecord } from "../payments.types.js";

type PaypalTokenResponse = {
  access_token?: string;
  token_type?: string;
  expires_in?: number;
};

type PaypalOrderResponse = {
  id?: string;
  status?: string;
};

type PaypalPayoutResponse = {
  batch_header?: {
    payout_batch_id?: string;
    batch_status?: string;
  };
};

type PaypalRefundResponse = {
  id?: string;
  status?: string;
};

@Injectable()
export class PaypalPaymentProvider implements PaymentProviderPort {
  readonly key = "paypal" as const;

  private readonly logger = new Logger(PaypalPaymentProvider.name);
  private readonly baseUrl = process.env.PAYPAL_BASE_URL?.trim()
    || (process.env.PAYPAL_ENVIRONMENT === "live" ? "https://api-m.paypal.com" : "https://api-m.sandbox.paypal.com");
  private cachedToken: { value: string; expiresAt: number } | null = null;

  async createFundingIntent(input: CreateFundingIntentInput): Promise<FundingIntentRecord> {
    const accessToken = await this.accessToken();
    const response = await this.paypalFetch<PaypalOrderResponse>("/v2/checkout/orders", accessToken, {
      intent: "CAPTURE",
      purchase_units: [
        {
          reference_id: input.externalRef,
          amount: {
            currency_code: input.money.currency.toUpperCase(),
            value: input.money.amount.toFixed(2)
          },
          custom_id: input.projectId
        }
      ]
    });

    const providerRef = response.id;
    if (!providerRef) {
      throw new Error("PayPal order response did not include an id");
    }

    this.logger.log({ orderId: providerRef, projectId: input.projectId }, "PayPal order created");
    return {
      id: `fin_${providerRef}`,
      tenantId: input.tenantId,
      projectId: input.projectId,
      provider: this.key,
      methodType: input.methodType,
      money: input.money,
      status: paypalOrderStatus(response.status),
      providerRef,
      externalRef: input.externalRef,
      metadata: { ...(input.metadata ?? {}) },
      createdAt: new Date().toISOString()
    };
  }

  async createPayoutIntent(input: CreatePayoutIntentInput): Promise<PayoutIntentRecord> {
    const recipientEmail = String(input.metadata?.paypalEmail ?? "").trim();
    if (!recipientEmail) {
      throw new BadRequestException("PayPal payout requires the professional payout email");
    }

    const accessToken = await this.accessToken();
    const response = await this.paypalFetch<PaypalPayoutResponse>("/v1/payments/payouts", accessToken, {
      sender_batch_header: {
        sender_batch_id: input.externalRef,
        email_subject: "SEMSE Project payout released",
        email_message: "Your SEMSE Project milestone payout has been released."
      },
      items: [
        {
          recipient_type: "EMAIL",
          receiver: recipientEmail,
          amount: {
            value: input.money.amount.toFixed(2),
            currency: input.money.currency.toUpperCase()
          },
          note: `SEMSE milestone payout ${input.milestoneId ?? input.projectId}`,
          sender_item_id: `${input.externalRef}_item`
        }
      ]
    });

    const providerRef = response.batch_header?.payout_batch_id;
    if (!providerRef) {
      throw new Error("PayPal payout response did not include a payout_batch_id");
    }

    return {
      id: `poi_${providerRef}`,
      tenantId: input.tenantId,
      projectId: input.projectId,
      milestoneId: input.milestoneId,
      provider: this.key,
      methodType: input.methodType,
      money: input.money,
      status: paypalPayoutStatus(response.batch_header?.batch_status),
      providerRef,
      externalRef: input.externalRef,
      metadata: {
        recipientUserId: input.recipientUserId,
        paypalEmail: recipientEmail,
        ...(input.metadata ?? {})
      },
      createdAt: new Date().toISOString()
    };
  }

  async createRefundIntent(input: CreateRefundIntentInput): Promise<RefundIntentRecord> {
    if (!input.originalProviderRef) {
      throw new BadRequestException("PayPal refund requires the original capture providerRef");
    }

    const accessToken = await this.accessToken();
    const response = await this.paypalFetch<PaypalRefundResponse>(
      `/v2/payments/captures/${encodeURIComponent(input.originalProviderRef)}/refund`,
      accessToken,
      {
        amount: {
          value: input.money.amount.toFixed(2),
          currency_code: input.money.currency.toUpperCase()
        },
        note_to_payer: String(input.metadata?.reason ?? "SEMSE escrow refund")
      }
    );

    const providerRef = response.id;
    if (!providerRef) {
      throw new Error("PayPal refund response did not include an id");
    }

    return {
      id: `rei_${providerRef}`,
      tenantId: input.tenantId,
      projectId: input.projectId,
      provider: this.key,
      methodType: input.methodType,
      money: input.money,
      status: paypalRefundStatus(response.status),
      providerRef,
      externalRef: input.externalRef,
      originalProviderRef: input.originalProviderRef,
      metadata: { ...(input.metadata ?? {}) },
      createdAt: new Date().toISOString()
    };
  }

  private async accessToken(): Promise<string> {
    if (this.cachedToken && this.cachedToken.expiresAt > Date.now() + 30_000) {
      return this.cachedToken.value;
    }

    const clientId = process.env.PAYPAL_CLIENT_ID?.trim();
    const clientSecret = process.env.PAYPAL_CLIENT_SECRET?.trim();
    if (!clientId || !clientSecret) {
      throw new Error("PayPal provider requires PAYPAL_CLIENT_ID and PAYPAL_CLIENT_SECRET");
    }

    const credentials = Buffer.from(`${clientId}:${clientSecret}`).toString("base64");
    const response = await fetch(`${this.baseUrl}/v1/oauth2/token`, {
      method: "POST",
      headers: {
        authorization: `Basic ${credentials}`,
        "content-type": "application/x-www-form-urlencoded"
      },
      body: "grant_type=client_credentials"
    });
    const payload = await response.json().catch(() => ({})) as PaypalTokenResponse & { error_description?: string };
    if (!response.ok || !payload.access_token) {
      throw new Error(payload.error_description || `PayPal auth failed with ${response.status}`);
    }

    this.cachedToken = {
      value: payload.access_token,
      expiresAt: Date.now() + Math.max(60, payload.expires_in ?? 300) * 1000
    };
    return payload.access_token;
  }

  private async paypalFetch<T>(path: string, accessToken: string, body: Record<string, unknown>): Promise<T> {
    const response = await fetch(`${this.baseUrl}${path}`, {
      method: "POST",
      headers: {
        authorization: `Bearer ${accessToken}`,
        "content-type": "application/json"
      },
      body: JSON.stringify(body)
    });
    const payload = await response.json().catch(() => ({})) as T & { message?: string; name?: string };
    if (!response.ok) {
      throw new Error(payload.message || payload.name || `PayPal request failed with ${response.status}`);
    }
    return payload;
  }
}

function paypalOrderStatus(status?: string): FundingIntentRecord["status"] {
  switch (status) {
    case "COMPLETED": return "captured";
    case "APPROVED": return "authorized";
    case "VOIDED": return "cancelled";
    default: return "pending";
  }
}

function paypalPayoutStatus(status?: string): PayoutIntentRecord["status"] {
  switch (status) {
    case "SUCCESS":
    case "SUCCESSFUL": return "paid";
    case "DENIED":
    case "FAILED": return "failed";
    case "CANCELED": return "cancelled";
    default: return "processing";
  }
}

function paypalRefundStatus(status?: string): RefundIntentRecord["status"] {
  switch (status) {
    case "COMPLETED": return "succeeded";
    case "CANCELLED": return "cancelled";
    case "FAILED": return "failed";
    default: return "pending";
  }
}
