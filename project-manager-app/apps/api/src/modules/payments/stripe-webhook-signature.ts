import { createHmac, timingSafeEqual } from "node:crypto";

const DEFAULT_TOLERANCE_SECONDS = 300;

export type StripeWebhookSignatureInput = {
  payload: Buffer | string;
  signatureHeader: string;
  secret: string;
  toleranceSeconds?: number;
  now?: Date;
};

function parseStripeSignatureHeader(header: string): { timestamp?: number; signatures: string[] } {
  const parts = header.split(",").map((part) => part.trim()).filter(Boolean);
  const signatures: string[] = [];
  let timestamp: number | undefined;

  for (const part of parts) {
    const [key, ...valueParts] = part.split("=");
    const value = valueParts.join("=");
    if (key === "t") {
      const parsed = Number(value);
      if (Number.isFinite(parsed)) timestamp = parsed;
    }
    if (key === "v1" && value) {
      signatures.push(value);
    }
  }

  return { timestamp, signatures };
}

export type StripeWebhookMode = "verify" | "skip_unsigned" | "reject";

function isProductionEnv(env: NodeJS.ProcessEnv): boolean {
  return env.NODE_ENV === "production" || env.RAILWAY_ENVIRONMENT_NAME === "production";
}

/**
 * Fail-closed webhook policy (C26). Signature verification is the only thing
 * authenticating this public endpoint, and the handler changes payment state,
 * so an unset secret must never silently disable it just because the runtime
 * is not literally "production" (staging/preview deployments handle real
 * Stripe events too). Unsigned payloads are accepted only with an explicit
 * opt-in flag, and never in production.
 */
export function resolveStripeWebhookMode(env: NodeJS.ProcessEnv): StripeWebhookMode {
  if (env.STRIPE_WEBHOOK_SECRET?.trim()) return "verify";
  if (env.STRIPE_WEBHOOK_ALLOW_UNSIGNED === "true" && !isProductionEnv(env)) return "skip_unsigned";
  return "reject";
}

export function verifyStripeWebhookSignature(input: StripeWebhookSignatureInput): boolean {
  const secret = input.secret.trim();
  if (!secret) return false;

  const { timestamp, signatures } = parseStripeSignatureHeader(input.signatureHeader);
  if (!timestamp || signatures.length === 0) return false;

  const nowSeconds = Math.floor((input.now?.getTime() ?? Date.now()) / 1000);
  const tolerance = input.toleranceSeconds ?? DEFAULT_TOLERANCE_SECONDS;
  if (Math.abs(nowSeconds - timestamp) > tolerance) return false;

  const payload = Buffer.isBuffer(input.payload) ? input.payload : Buffer.from(input.payload);
  const signedPayload = Buffer.concat([
    Buffer.from(`${timestamp}.`),
    payload,
  ]);
  const expected = createHmac("sha256", secret).update(signedPayload).digest();

  return signatures.some((signature) => {
    const candidate = Buffer.from(signature, "hex");
    return candidate.length === expected.length && timingSafeEqual(candidate, expected);
  });
}
