import { createHmac, timingSafeEqual } from "node:crypto";
import { Injectable, Logger } from "@nestjs/common";
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

export type WhatsAppWebhookSignatureInput = {
  payload: Buffer | string;
  signatureHeader?: string;
  appSecret: string;
};

export function verifyWhatsAppWebhookSignature(input: WhatsAppWebhookSignatureInput): boolean {
  const appSecret = input.appSecret.trim();
  if (!appSecret) return false;

  const signatureHeader = input.signatureHeader?.trim();
  if (!signatureHeader?.startsWith("sha256=")) return false;

  const receivedHex = signatureHeader.slice("sha256=".length);
  if (!/^[a-f0-9]{64}$/i.test(receivedHex)) return false;

  const payload = Buffer.isBuffer(input.payload) ? input.payload : Buffer.from(input.payload);
  const expected = createHmac("sha256", appSecret).update(payload).digest();
  const received = Buffer.from(receivedHex, "hex");

  return received.length === expected.length && timingSafeEqual(received, expected);
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
    const configured = this.config.get<string>("WHATSAPP_APP_SECRET") ?? this.config.get<string>("META_APP_SECRET");
    const trimmed = configured?.trim();
    return trimmed ? trimmed : undefined;
  }

  get requiresWebhookSignature(): boolean {
    const communicationsMode = this.config.get<string>("SEMSE_COMMUNICATIONS_MODE") ?? "mock";
    const nodeEnv = this.config.get<string>("NODE_ENV") ?? process.env.NODE_ENV;
    const railwayEnvironment = this.config.get<string>("RAILWAY_ENVIRONMENT_NAME") ?? process.env.RAILWAY_ENVIRONMENT_NAME;
    return communicationsMode === "live" || nodeEnv === "production" || railwayEnvironment === "production";
  }

  validateWebhookSignature(input: { payload?: Buffer; signatureHeader?: string }): boolean {
    const appSecret = this.appSecret;
    if (!appSecret) return !this.requiresWebhookSignature;
    if (!input.payload) return false;
    return verifyWhatsAppWebhookSignature({
      payload: input.payload,
      signatureHeader: input.signatureHeader,
      appSecret,
    });
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
      throw new Error(`WhatsApp Cloud API error ${response.status}: ${JSON.stringify(payload)}`);
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
