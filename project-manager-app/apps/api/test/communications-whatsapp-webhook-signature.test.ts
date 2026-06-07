import test from "node:test";
import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import { tsImport } from "tsx/esm/api";

const {
  verifyWhatsAppWebhookSignature,
  WhatsAppCloudAdapter,
} = await tsImport(
  "../src/modules/communications/providers/whatsapp-cloud.adapter.ts",
  import.meta.url,
) as typeof import("../src/modules/communications/providers/whatsapp-cloud.adapter.ts");

function signature(payload: Buffer | string, secret: string): string {
  return `sha256=${createHmac("sha256", secret).update(payload).digest("hex")}`;
}

function adapter(config: Record<string, string | undefined>): WhatsAppCloudAdapter {
  return new WhatsAppCloudAdapter({
    get: <T = string>(key: string): T | undefined => config[key] as T | undefined,
  } as never);
}

test("WhatsApp webhook signature accepts a valid x-hub-signature-256 header", () => {
  const payload = Buffer.from(JSON.stringify({ object: "whatsapp_business_account" }));
  const appSecret = "whatsapp_app_secret";

  assert.equal(
    verifyWhatsAppWebhookSignature({
      payload,
      signatureHeader: signature(payload, appSecret),
      appSecret,
    }),
    true,
  );
});

test("WhatsApp webhook signature rejects missing, malformed and invalid headers", () => {
  const payload = Buffer.from("{}");
  const appSecret = "whatsapp_app_secret";

  assert.equal(verifyWhatsAppWebhookSignature({ payload, appSecret }), false);
  assert.equal(verifyWhatsAppWebhookSignature({ payload, signatureHeader: "not-a-signature", appSecret }), false);
  assert.equal(verifyWhatsAppWebhookSignature({ payload, signatureHeader: "sha256=abc", appSecret }), false);
  assert.equal(
    verifyWhatsAppWebhookSignature({
      payload,
      signatureHeader: signature(Buffer.from("{\"tampered\":true}"), appSecret),
      appSecret,
    }),
    false,
  );
});

test("WhatsApp adapter requires a webhook app secret in live mode", () => {
  const whatsapp = adapter({ SEMSE_COMMUNICATIONS_MODE: "live" });

  assert.equal(whatsapp.requiresWebhookSignature, true);
  assert.equal(whatsapp.validateWebhookSignature({ payload: Buffer.from("{}") }), false);
});

test("WhatsApp adapter allows unsigned local webhooks only when signature validation is not required", () => {
  const whatsapp = adapter({ SEMSE_COMMUNICATIONS_MODE: "mock" });

  assert.equal(whatsapp.requiresWebhookSignature, false);
  assert.equal(whatsapp.validateWebhookSignature({ payload: Buffer.from("{}") }), true);
});

test("WhatsApp adapter accepts valid signed webhook payloads when app secret is configured", () => {
  const appSecret = "whatsapp_app_secret";
  const payload = Buffer.from(JSON.stringify({ entry: [] }));
  const whatsapp = adapter({ WHATSAPP_APP_SECRET: appSecret });

  assert.equal(whatsapp.validateWebhookSignature({
    payload,
    signatureHeader: signature(payload, appSecret),
  }), true);
});
