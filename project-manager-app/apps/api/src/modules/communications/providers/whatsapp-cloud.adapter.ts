import { createHmac, timingSafeEqual } from "node:crypto";
import { BadRequestException, Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";

export type WhatsAppCloudSendResult = {
  providerMessageId: string;
  raw: Record<string, unknown>;
};

export type WhatsAppInboundMessage = {
  externalMessageId: string;
  contactPhone: string;
  contactName?: string;
  body?: string;
  media?: Record<string, unknown>[];
  rawPayload: Record<string, unknown>;
};

export type WhatsAppStatusUpdate = {
  providerMessageId: string;
  status: string;
  recipientPhone?: string;
  rawPayload: Record<string, unknown>;
};

export function verifyWhatsAppWebhookSignature(input: {
  payload: Buffer;
  signatureHeader?: string;
  appSecret?: string;
}): boolean {
  if (!input.appSecret || !input.signatureHeader?.startsWith("sha256=")) {
    return false;
  }

  const expected = createHmac("sha256", input.appSecret)
    .update(input.payload)
    .digest("hex");
  const expectedBuf = Buffer.from(`sha256=${expected}`, "utf8");
  const receivedBuf = Buffer.from(input.signatureHeader, "utf8");

  return expectedBuf.length === receivedBuf.length && timingSafeEqual(expectedBuf, receivedBuf);
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
}

function asArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

function pickText(message: Record<string, unknown>): string | undefined {
  const type = typeof message.type === "string" ? message.type : "";
  const typedPayload = asRecord(message[type]);

  if (type === "text") {
    const text = asRecord(message.text).body;
    return typeof text === "string" ? text : undefined;
  }

  if (type === "button") {
    const text = asRecord(message.button).text;
    return typeof text === "string" ? text : undefined;
  }

  if (type === "interactive") {
    const interactive = asRecord(message.interactive);
    const buttonTitle = asRecord(interactive.button_reply).title;
    const listTitle = asRecord(interactive.list_reply).title;
    return typeof buttonTitle === "string"
      ? buttonTitle
      : typeof listTitle === "string"
        ? listTitle
        : undefined;
  }

  const caption = typedPayload.caption;
  return typeof caption === "string" ? caption : undefined;
}

function pickMedia(message: Record<string, unknown>): Record<string, unknown>[] | undefined {
  const mediaTypes = ["image", "video", "audio", "document", "sticker"];
  const media = mediaTypes.flatMap((type) => {
    const payload = asRecord(message[type]);
    if (Object.keys(payload).length === 0) return [];
    return [{
      type,
      id: payload.id,
      mimeType: payload.mime_type,
      sha256: payload.sha256,
      caption: payload.caption,
      filename: payload.filename,
    }];
  });

  return media.length > 0 ? media : undefined;
}

@Injectable()
export class WhatsAppCloudAdapter {
  private readonly logger = new Logger(WhatsAppCloudAdapter.name);

  constructor(private readonly config: ConfigService) {}

  get verifyToken(): string | undefined {
    return this.config.get<string>("WHATSAPP_CLOUD_VERIFY_TOKEN");
  }

  get appSecret(): string | undefined {
    return this.config.get<string>("WHATSAPP_APP_SECRET");
  }

  get isLiveMode(): boolean {
    return (this.config.get<string>("SEMSE_COMMUNICATIONS_MODE") ?? "mock") === "live";
  }

  get requiresWebhookSignature(): boolean {
    return this.isLiveMode || Boolean(this.appSecret);
  }

  /**
   * Validates the X-Hub-Signature-256 header sent by Meta.
   * Enforced in live mode, or whenever WHATSAPP_APP_SECRET is configured.
   * Returns true when validation passes or is not required.
   */
  validateWebhookSignature(input: { payload: Buffer; signatureHeader?: string }): boolean {
    if (!this.requiresWebhookSignature) {
      return true;
    }

    if (!this.appSecret) {
      return false;
    }

    return verifyWhatsAppWebhookSignature({
      payload: input.payload,
      signatureHeader: input.signatureHeader,
      appSecret: this.appSecret,
    });
  }

  validateSignature(rawBody: Buffer, signatureHeader: string | undefined): boolean {
    return this.validateWebhookSignature({ payload: rawBody, signatureHeader });
  }

  async sendText(input: { to: string; body: string }): Promise<WhatsAppCloudSendResult> {
    const mode = this.config.get<string>("SEMSE_COMMUNICATIONS_MODE") ?? "mock";
    const accessToken = this.config.get<string>("WHATSAPP_CLOUD_ACCESS_TOKEN");
    const phoneNumberId = this.config.get<string>("WHATSAPP_CLOUD_PHONE_NUMBER_ID");
    const version = this.config.get<string>("WHATSAPP_CLOUD_API_VERSION") ?? "v20.0";

    if (mode !== "live" || !accessToken || !phoneNumberId) {
      const providerMessageId = `mock_wa_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
      this.logger.log({ providerMessageId, to: input.to }, "WhatsApp mock delivery queued");
      return {
        providerMessageId,
        raw: { mode: "mock", providerMessageId, to: input.to },
      };
    }

    const response = await fetch(`https://graph.facebook.com/${version}/${phoneNumberId}/messages`, {
      method: "POST",
      headers: {
        authorization: `Bearer ${accessToken}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({
        messaging_product: "whatsapp",
        recipient_type: "individual",
        to: input.to,
        type: "text",
        text: {
          preview_url: false,
          body: input.body,
        },
      }),
    });

    const payload = await response.json().catch(() => ({})) as Record<string, unknown>;
    if (!response.ok) {
      const metaError = (payload.error ?? {}) as Record<string, unknown>;
      const metaCode = typeof metaError.code === "number" ? metaError.code : null;
      const metaSubcode = typeof metaError.error_subcode === "number" ? metaError.error_subcode : null;
      const metaMessage = typeof metaError.message === "string" ? metaError.message : "Unknown provider error";

      // Map common Meta errors to actionable codes
      let clientCode = "PROVIDER_FAILED";
      let clientMessage = "WhatsApp message delivery failed.";
      let retryable = false;

      if (response.status === 401 || metaCode === 190) {
        clientCode = "PROVIDER_AUTH_FAILED";
        clientMessage = "WhatsApp Cloud access token is expired or invalid. Please update WHATSAPP_CLOUD_ACCESS_TOKEN in Railway.";
      } else if (metaCode === 131047 || metaSubcode === 131047) {
        clientCode = "PROVIDER_24H_WINDOW_EXPIRED";
        clientMessage = "The WhatsApp 24-hour messaging window has expired. Use an approved template message to re-engage the customer.";
      } else if (metaCode === 100 && metaSubcode === 33) {
        clientCode = "PROVIDER_INVALID_PHONE";
        clientMessage = "The recipient phone number is invalid or not registered on WhatsApp.";
      } else if (response.status === 429) {
        clientCode = "PROVIDER_RATE_LIMITED";
        clientMessage = "WhatsApp Cloud rate limit reached. Retry later.";
        retryable = true;
      } else if (response.status >= 500) {
        clientCode = "PROVIDER_UNAVAILABLE";
        clientMessage = "WhatsApp Cloud is temporarily unavailable. Retry later.";
        retryable = true;
      }

      this.logger.warn({
        clientCode,
        httpStatus: response.status,
        metaCode,
        metaSubcode,
        metaMessage: metaMessage.slice(0, 200),
      }, "WhatsApp Cloud send failed");

      throw new BadRequestException({ code: clientCode, message: clientMessage, retryable });
    }

    const firstMessage = asRecord(asArray(payload.messages)[0]);
    const providerMessageId = typeof firstMessage.id === "string"
      ? firstMessage.id
      : `wa_${Date.now()}`;

    return { providerMessageId, raw: payload };
  }

  parseWebhook(body: unknown): {
    messages: WhatsAppInboundMessage[];
    statuses: WhatsAppStatusUpdate[];
  } {
    const messages: WhatsAppInboundMessage[] = [];
    const statuses: WhatsAppStatusUpdate[] = [];
    const root = asRecord(body);

    for (const entry of asArray(root.entry)) {
      for (const change of asArray(asRecord(entry).changes)) {
        const value = asRecord(asRecord(change).value);
        const contacts = asArray(value.contacts).map(asRecord);

        for (const rawMessage of asArray(value.messages).map(asRecord)) {
          const from = rawMessage.from;
          const externalMessageId = rawMessage.id;
          if (typeof from !== "string" || typeof externalMessageId !== "string") continue;

          const contact = contacts.find((candidate) => candidate.wa_id === from);
          const profile = asRecord(contact?.profile);
          const contactName = typeof profile.name === "string" ? profile.name : undefined;

          messages.push({
            externalMessageId,
            contactPhone: from,
            contactName,
            body: pickText(rawMessage),
            media: pickMedia(rawMessage),
            rawPayload: rawMessage,
          });
        }

        for (const rawStatus of asArray(value.statuses).map(asRecord)) {
          const id = rawStatus.id;
          if (typeof id !== "string") continue;
          statuses.push({
            providerMessageId: id,
            status: typeof rawStatus.status === "string" ? rawStatus.status : "unknown",
            recipientPhone: typeof rawStatus.recipient_id === "string" ? rawStatus.recipient_id : undefined,
            rawPayload: rawStatus,
          });
        }
      }
    }

    return { messages, statuses };
  }
}
