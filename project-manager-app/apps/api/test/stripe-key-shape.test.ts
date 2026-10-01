import test from "node:test";
import assert from "node:assert/strict";
import { classifyStripeKey } from "../dist/modules/payments/stripe-key.js";
import { PaymentsService } from "../dist/modules/payments/payments.service.js";

// Incidente 2026-10-01: STRIPE_SECRET_KEY contenía el ID de una API key (mk_…) y el readiness decía
// ready:true; Stripe devolvía "Invalid API key" recién al crear la cuenta Connect. El readiness debe
// detectar la forma de la clave (sin imprimirla) y NO declarar la rail lista.

test("classifyStripeKey: forma de la clave sin exponer su valor", () => {
  assert.deepEqual(classifyStripeKey(undefined), { shape: "missing", usable: false });
  assert.deepEqual(classifyStripeKey("   "), { shape: "missing", usable: false });
  assert.equal(classifyStripeKey("sk_test_abc123").shape, "secret");
  assert.equal(classifyStripeKey("sk_live_abc123").usable, true);
  assert.equal(classifyStripeKey("rk_live_abc123").shape, "restricted");
  assert.equal(classifyStripeKey("rk_live_abc123").usable, true);
  assert.equal(classifyStripeKey("pk_live_abc123").shape, "publishable");
  assert.equal(classifyStripeKey("pk_live_abc123").usable, false);
  assert.equal(classifyStripeKey("mk_1U9uuXXXXXXXXXX").shape, "key_id"); // el caso del incidente
  assert.equal(classifyStripeKey("mk_1U9uuXXXXXXXXXX").usable, false);
  assert.equal(classifyStripeKey("whsec_abc").shape, "unrecognized");
  assert.equal(classifyStripeKey("  sk_test_abc  ").usable, true); // se recorta como el resto del código
  // el resultado nunca incluye el valor de la clave
  assert.equal(JSON.stringify(classifyStripeKey("sk_live_SECRETVALUE")).includes("SECRETVALUE"), false);
});

function readiness(env: Record<string, string | undefined>) {
  const saved: Record<string, string | undefined> = {};
  for (const k of Object.keys(env)) { saved[k] = process.env[k]; if (env[k] === undefined) delete process.env[k]; else process.env[k] = env[k]; }
  try {
    const fake = {
      resolveConfiguredDefaultProvider: () => "stripe",
      paymentProviderRegistry: { availableKeys: () => ["stripe", "mock"] },
    };
    return (PaymentsService.prototype as any).paymentProviderReadiness.call(fake);
  } finally { for (const k of Object.keys(env)) { if (saved[k] === undefined) delete process.env[k]; else process.env[k] = saved[k]; } }
}
const base = { STRIPE_WEBHOOK_SECRET: "whsec_x", NODE_ENV: "production" };

test("readiness: clave mk_ (ID de API key) ⇒ stripe NO ready y advertencia que no revela la clave", () => {
  const r = readiness({ ...base, STRIPE_SECRET_KEY: "mk_1U9uuSECRETISH" });
  assert.equal(r.stripe.ready, false);
  assert.equal(r.rails.find((x: any) => x.key === "stripe").ready, false);
  assert.equal(r.stripe.keyShape, "key_id");
  const w = r.warnings.find((x: string) => x.includes("STRIPE_SECRET_KEY"));
  assert.ok(w && /key_id|ID de API key|mk_/.test(w));
  assert.equal(JSON.stringify(r).includes("SECRETISH"), false);
});

test("readiness: clave sk_/rk_ válida ⇒ ready y sin advertencia de forma", () => {
  for (const key of ["sk_live_abc", "rk_live_abc"]) {
    const r = readiness({ ...base, STRIPE_SECRET_KEY: key });
    assert.equal(r.stripe.ready, true);
    assert.equal(r.rails.find((x: any) => x.key === "stripe").ready, true);
    assert.equal(r.warnings.some((x: string) => x.includes("STRIPE_SECRET_KEY")), false);
  }
});

import { StripeConnectService } from "../dist/modules/payments/stripe-connect.service.js";
test("Connect: un StripeAuthenticationError no filtra al cliente el texto de Stripe ni el prefijo de la clave", () => {
  const err = Object.assign(new Error("Invalid API key provided: mk_1U9uu***************3bS2"), { type: "StripeAuthenticationError" });
  const msg = (StripeConnectService.prototype as any).publicStripeDiagnostic.call({ errorMessage: (e: Error) => e.message }, err);
  assert.equal(msg.includes("mk_"), false);
  assert.equal(msg.includes("Invalid API key"), false);
  assert.match(msg, /no está configurada correctamente/);
  // otros errores de Stripe siguen mostrando el diagnóstico existente
  const other = Object.assign(new Error("Your account cannot be created"), { type: "StripeInvalidRequestError", code: "x" });
  assert.match((StripeConnectService.prototype as any).publicStripeDiagnostic.call({ errorMessage: (e: Error) => e.message }, other), /Stripe respondió/);
});
