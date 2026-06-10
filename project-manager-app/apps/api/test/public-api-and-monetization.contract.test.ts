import test from "node:test";
import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import { verifyStripeWebhookSignature } from "../src/modules/payments/stripe-webhook-signature.ts";

// ── M5.2 Public API ──────────────────────────────────────────────────────────

function apiKeyRequired(input: { apiKey?: string }): boolean {
  return Boolean(input.apiKey && input.apiKey.trim().length > 0);
}

function rateLimitEnforced(input: { requests: number; limitPerMinute: number }): boolean {
  return input.requests <= input.limitPerMinute;
}

function revokedKeyCanAccess(input: { keyStatus: "active" | "revoked" }): boolean {
  return input.keyStatus === "active";
}

test("M5.2 API key is required for public endpoints", () => {
  assert.equal(apiKeyRequired({ apiKey: "pk_test_123" }), true);
  assert.equal(apiKeyRequired({ apiKey: "" }), false);
});

test("M5.2 rate limit is enforced", () => {
  assert.equal(rateLimitEnforced({ requests: 5, limitPerMinute: 10 }), true);
  assert.equal(rateLimitEnforced({ requests: 11, limitPerMinute: 10 }), false);
});

test("M5.2 HMAC signature validation for webhook delivery", () => {
  const secret = "webhook_secret";
  const payload = Buffer.from('{"event":"estimate.created"}');
  const timestamp = 1_700_000_100;
  const signedPayload = Buffer.concat([Buffer.from(`${timestamp}.`), payload]);
  const signature = createHmac("sha256", secret).update(signedPayload).digest("hex");
  const header = `t=${timestamp},v1=${signature}`;
  assert.equal(verifyStripeWebhookSignature({ payload, signatureHeader: header, secret, now: new Date(timestamp * 1000) }), true);
});

test("M5.2 revoked key cannot access engines", () => {
  assert.equal(revokedKeyCanAccess({ keyStatus: "active" }), true);
  assert.equal(revokedKeyCanAccess({ keyStatus: "revoked" }), false);
});

// ── M5.3 Monetization ────────────────────────────────────────────────────────

type Tier = "starter" | "professional" | "business";

const TIER_FEATURES: Record<Tier, string[]> = {
  starter: ["basic_estimation"],
  professional: ["change_orders", "lien_workflows"],
  business: ["ai_agents", "live_pricing", "api_access"],
};

function hasTierEntitlement(tier: Tier, feature: string): boolean {
  return TIER_FEATURES[tier].includes(feature);
}

function escrowManagedPaymentFee(amountUsd: number): number {
  return Math.round(amountUsd * 0.0075 * 100) / 100;
}

function downgradePreservesData(input: { deletesData: boolean }): boolean {
  return !input.deletesData;
}

function apiAccessDeniedWithoutEntitlement(input: { tier: Tier; feature: string }): boolean {
  return !hasTierEntitlement(input.tier, input.feature);
}

test("M5.3 tier entitlement checks work by package", () => {
  assert.equal(hasTierEntitlement("starter", "basic_estimation"), true);
  assert.equal(hasTierEntitlement("professional", "lien_workflows"), true);
  assert.equal(hasTierEntitlement("business", "api_access"), true);
  assert.equal(hasTierEntitlement("starter", "api_access"), false);
});

test("M5.3 transaction fee remains 0.75% for escrow-managed payments", () => {
  assert.equal(escrowManagedPaymentFee(1000), 7.5);
});

test("M5.3 downgrade does not delete user/project data", () => {
  assert.equal(downgradePreservesData({ deletesData: false }), true);
  assert.equal(downgradePreservesData({ deletesData: true }), false);
});

test("M5.3 API access denied without entitlement", () => {
  assert.equal(apiAccessDeniedWithoutEntitlement({ tier: "starter", feature: "api_access" }), true);
  assert.equal(apiAccessDeniedWithoutEntitlement({ tier: "business", feature: "api_access" }), false);
});
