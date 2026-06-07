/**
 * Unit tests for Stripe webhook signature verification.
 * Run: node --experimental-strip-types --test tests/unit/stripe-webhook-signature.test.ts
 */
import test from "node:test";
import assert from "node:assert/strict";
import { createHmac, timingSafeEqual } from "node:crypto";

// ── Inline verifyStripeWebhookSignature ───────────────────────────────────────

const DEFAULT_TOLERANCE = 300;

type Input = { payload: Buffer | string; signatureHeader: string; secret: string; toleranceSeconds?: number; now?: Date };

function parseHeader(header: string): { timestamp?: number; signatures: string[] } {
  const signatures: string[] = [];
  let timestamp: number | undefined;
  for (const part of header.split(",").map(p => p.trim()).filter(Boolean)) {
    const [key, ...rest] = part.split("=");
    const value = rest.join("=");
    if (key === "t") { const n = Number(value); if (Number.isFinite(n)) timestamp = n; }
    if (key === "v1" && value) signatures.push(value);
  }
  return { timestamp, signatures };
}

function verifyStripeWebhookSignature(input: Input): boolean {
  const secret = input.secret.trim();
  if (!secret) return false;
  const { timestamp, signatures } = parseHeader(input.signatureHeader);
  if (!timestamp || signatures.length === 0) return false;
  const nowSec = Math.floor((input.now?.getTime() ?? Date.now()) / 1000);
  if (Math.abs(nowSec - timestamp) > (input.toleranceSeconds ?? DEFAULT_TOLERANCE)) return false;
  const payload = Buffer.isBuffer(input.payload) ? input.payload : Buffer.from(input.payload);
  const signed = Buffer.concat([Buffer.from(`${timestamp}.`), payload]);
  const expected = createHmac("sha256", secret).update(signed).digest();
  return signatures.some(sig => {
    const candidate = Buffer.from(sig, "hex");
    return candidate.length === expected.length && candidate.equals(expected);
  });
}

// Helper: generate a valid Stripe-style signature
function makeSignature(payload: string, secret: string, timestampSec: number): string {
  const signed = `${timestampSec}.${payload}`;
  return createHmac("sha256", secret).update(signed).digest("hex");
}

const SECRET = "whsec_test_secret_key_12345";
const PAYLOAD = '{"type":"payment_intent.succeeded","id":"pi_123"}';
const NOW = new Date("2026-01-01T12:00:00Z");
const TS = Math.floor(NOW.getTime() / 1000);

// ── Tests ──────────────────────────────────────────────────────────────────────

test("valid signature → returns true", () => {
  const sig = makeSignature(PAYLOAD, SECRET, TS);
  const result = verifyStripeWebhookSignature({
    payload: PAYLOAD, secret: SECRET,
    signatureHeader: `t=${TS},v1=${sig}`,
    now: NOW,
  });
  assert.equal(result, true);
});

test("wrong secret → returns false", () => {
  const sig = makeSignature(PAYLOAD, "wrong_secret", TS);
  const result = verifyStripeWebhookSignature({
    payload: PAYLOAD, secret: SECRET,
    signatureHeader: `t=${TS},v1=${sig}`, now: NOW,
  });
  assert.equal(result, false);
});

test("tampered payload → returns false", () => {
  const sig = makeSignature(PAYLOAD, SECRET, TS);
  const result = verifyStripeWebhookSignature({
    payload: PAYLOAD + "_tampered", secret: SECRET,
    signatureHeader: `t=${TS},v1=${sig}`, now: NOW,
  });
  assert.equal(result, false);
});

test("expired timestamp → returns false", () => {
  const oldTs = TS - 600; // 10 minutes ago > 5 min tolerance
  const sig = makeSignature(PAYLOAD, SECRET, oldTs);
  const result = verifyStripeWebhookSignature({
    payload: PAYLOAD, secret: SECRET,
    signatureHeader: `t=${oldTs},v1=${sig}`, now: NOW,
  });
  assert.equal(result, false);
});

test("custom tolerance allows older timestamp", () => {
  const oldTs = TS - 600;
  const sig = makeSignature(PAYLOAD, SECRET, oldTs);
  const result = verifyStripeWebhookSignature({
    payload: PAYLOAD, secret: SECRET,
    signatureHeader: `t=${oldTs},v1=${sig}`, now: NOW,
    toleranceSeconds: 900, // 15 min
  });
  assert.equal(result, true);
});

test("empty secret → returns false", () => {
  const sig = makeSignature(PAYLOAD, SECRET, TS);
  assert.equal(verifyStripeWebhookSignature({ payload: PAYLOAD, secret: "   ", signatureHeader: `t=${TS},v1=${sig}`, now: NOW }), false);
});

test("missing timestamp in header → returns false", () => {
  const sig = makeSignature(PAYLOAD, SECRET, TS);
  assert.equal(verifyStripeWebhookSignature({ payload: PAYLOAD, secret: SECRET, signatureHeader: `v1=${sig}`, now: NOW }), false);
});

test("missing v1 signature in header → returns false", () => {
  assert.equal(verifyStripeWebhookSignature({ payload: PAYLOAD, secret: SECRET, signatureHeader: `t=${TS}`, now: NOW }), false);
});

test("Buffer payload works same as string", () => {
  const sig = makeSignature(PAYLOAD, SECRET, TS);
  const header = `t=${TS},v1=${sig}`;
  const strResult = verifyStripeWebhookSignature({ payload: PAYLOAD, secret: SECRET, signatureHeader: header, now: NOW });
  const bufResult = verifyStripeWebhookSignature({ payload: Buffer.from(PAYLOAD), secret: SECRET, signatureHeader: header, now: NOW });
  assert.equal(strResult, bufResult);
  assert.equal(strResult, true);
});

test("multiple v1 signatures — accepts if any matches", () => {
  const goodSig = makeSignature(PAYLOAD, SECRET, TS);
  const badSig = "aabbccdd00112233aabbccdd00112233aabbccdd00112233aabbccdd00112233";
  assert.equal(verifyStripeWebhookSignature({
    payload: PAYLOAD, secret: SECRET,
    signatureHeader: `t=${TS},v1=${badSig},v1=${goodSig}`, now: NOW,
  }), true);
});
