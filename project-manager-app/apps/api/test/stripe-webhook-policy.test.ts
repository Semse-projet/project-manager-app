import "reflect-metadata";
import test from "node:test";
import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import { BadRequestException, ServiceUnavailableException } from "@nestjs/common";
import { resolveStripeWebhookMode } from "../dist/modules/payments/stripe-webhook-signature.js";
import { PaymentsController } from "../dist/modules/payments/payments.controller.js";

// C26 — the public Stripe webhook changes payment state and is authenticated
// only by its signature. An unset STRIPE_WEBHOOK_SECRET used to disable the
// check in any runtime that was not literally "production" (staging/previews).

test("mode: secret set => verify (regardless of flags/env)", () => {
  assert.equal(resolveStripeWebhookMode({ STRIPE_WEBHOOK_SECRET: "whsec_x" } as never), "verify");
  assert.equal(resolveStripeWebhookMode({ STRIPE_WEBHOOK_SECRET: "whsec_x", STRIPE_WEBHOOK_ALLOW_UNSIGNED: "true", NODE_ENV: "production" } as never), "verify");
});

test("mode: no secret => reject by default, including staging-like runtimes", () => {
  for (const env of [
    {},
    { NODE_ENV: "staging" },
    { NODE_ENV: "development" },
    { RAILWAY_ENVIRONMENT_NAME: "staging" },
    { NODE_ENV: "production" },
    { STRIPE_WEBHOOK_SECRET: "   " },
  ]) {
    assert.equal(resolveStripeWebhookMode(env as never), "reject", JSON.stringify(env));
  }
});

test("mode: unsigned accepted only with explicit opt-in and never in production", () => {
  assert.equal(resolveStripeWebhookMode({ STRIPE_WEBHOOK_ALLOW_UNSIGNED: "true", NODE_ENV: "development" } as never), "skip_unsigned");
  assert.equal(resolveStripeWebhookMode({ STRIPE_WEBHOOK_ALLOW_UNSIGNED: "true", NODE_ENV: "production" } as never), "reject");
  assert.equal(resolveStripeWebhookMode({ STRIPE_WEBHOOK_ALLOW_UNSIGNED: "true", RAILWAY_ENVIRONMENT_NAME: "production" } as never), "reject");
  assert.equal(resolveStripeWebhookMode({ STRIPE_WEBHOOK_ALLOW_UNSIGNED: "1" } as never), "reject");
});

async function withEnv<T>(env: Record<string, string | undefined>, fn: () => Promise<T>): Promise<T> {
  const saved: Record<string, string | undefined> = {};
  for (const [k, v] of Object.entries(env)) {
    saved[k] = process.env[k];
    if (v === undefined) delete process.env[k]; else process.env[k] = v;
  }
  try { return await fn(); } finally {
    for (const [k, v] of Object.entries(saved)) { if (v === undefined) delete process.env[k]; else process.env[k] = v; }
  }
}

function build() {
  let processed = 0;
  const controller = new PaymentsController({ async webhook() { processed++; return { ok: true }; } } as never);
  return { controller, processed: () => processed };
}

const body = { event: "payment.succeeded", providerRef: "pi_1" };
const reqWith = (headers: Record<string, unknown> = {}) => ({ headers }) as never;

test("controller: no secret in a non-production runtime rejects and never reaches the payments service", async () => {
  await withEnv({ STRIPE_WEBHOOK_SECRET: undefined, STRIPE_WEBHOOK_ALLOW_UNSIGNED: undefined, NODE_ENV: "staging", RAILWAY_ENVIRONMENT_NAME: undefined }, async () => {
    const { controller, processed } = build();
    await assert.rejects(controller.webhook(reqWith(), body, Buffer.from(JSON.stringify(body))), ServiceUnavailableException);
    assert.equal(processed(), 0);
  });
});

test("controller: opt-in unsigned works outside production only", async () => {
  await withEnv({ STRIPE_WEBHOOK_SECRET: undefined, STRIPE_WEBHOOK_ALLOW_UNSIGNED: "true", NODE_ENV: "development", RAILWAY_ENVIRONMENT_NAME: undefined }, async () => {
    const { controller, processed } = build();
    await controller.webhook(reqWith(), body, Buffer.from(JSON.stringify(body)));
    assert.equal(processed(), 1);
  });
  await withEnv({ STRIPE_WEBHOOK_SECRET: undefined, STRIPE_WEBHOOK_ALLOW_UNSIGNED: "true", NODE_ENV: "production" }, async () => {
    const { controller, processed } = build();
    await assert.rejects(controller.webhook(reqWith(), body, Buffer.from("{}")), ServiceUnavailableException);
    assert.equal(processed(), 0);
  });
});

test("controller: with secret, missing/invalid signature is rejected and a valid one is processed", async () => {
  await withEnv({ STRIPE_WEBHOOK_SECRET: "whsec_test", NODE_ENV: "staging" }, async () => {
    const { controller, processed } = build();
    const raw = Buffer.from(JSON.stringify(body));
    await assert.rejects(controller.webhook(reqWith(), body, raw), BadRequestException);
    await assert.rejects(controller.webhook(reqWith({ "stripe-signature": "t=1,v1=deadbeef" }), body, raw), BadRequestException);
    assert.equal(processed(), 0);

    const t = Math.floor(Date.now() / 1000);
    const sig = createHmac("sha256", "whsec_test").update(Buffer.concat([Buffer.from(`${t}.`), raw])).digest("hex");
    await controller.webhook(reqWith({ "stripe-signature": `t=${t},v1=${sig}` }), body, raw);
    assert.equal(processed(), 1);
  });
});
