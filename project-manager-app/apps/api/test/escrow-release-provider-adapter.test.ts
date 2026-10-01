import test from "node:test";
import assert from "node:assert/strict";
import { BadRequestException, InternalServerErrorException } from "@nestjs/common";
import {
  classifyProviderError,
  normalizePayoutIntent,
  normalizeProviderError,
} from "../dist/modules/payments/escrow-release.provider-adapter.js";
import { PayoutFailureError, classifyHttpStatus, payoutErrorFromHttp } from "../dist/modules/payments/providers/provider-errors.js";

test("payout intent -> paid | processing | definitive_failure", () => {
  assert.deepEqual(normalizePayoutIntent({ status: "paid", providerRef: "po1" }), { kind: "paid", providerRef: "po1" });
  assert.equal(normalizePayoutIntent({ status: "processing", providerRef: "po1" }).kind, "processing");
  assert.equal(normalizePayoutIntent({ status: "pending" }).kind, "processing");
  assert.equal(normalizePayoutIntent({ status: "failed" }).kind, "definitive_failure");
  assert.equal(normalizePayoutIntent({ status: "cancelled" }).kind, "definitive_failure");
});

test("clasificacion: senal explicita del proveedor manda", () => {
  assert.equal(classifyProviderError(new PayoutFailureError("no connect account", "definitive")), "definitive");
  assert.equal(classifyProviderError(new PayoutFailureError("socket reset", "ambiguous")), "ambiguous");
  assert.equal(classifyProviderError(payoutErrorFromHttp("bad request", 422)), "definitive");
  assert.equal(classifyProviderError(payoutErrorFromHttp("upstream", 503)), "ambiguous");
});

test("clasificacion por estado HTTP sin depender de Nest: statusCode (SDKs), status, getStatus()", () => {
  assert.equal(classifyProviderError({ statusCode: 402 }), "definitive"); // Stripe card/invalid request
  assert.equal(classifyProviderError({ statusCode: 429 }), "definitive");
  assert.equal(classifyProviderError({ statusCode: 500 }), "ambiguous");
  assert.equal(classifyProviderError({ statusCode: 409 }), "ambiguous"); // conflicto: pudo ejecutarse
  assert.equal(classifyProviderError({ status: 408 }), "ambiguous");
  assert.equal(classifyProviderError(new BadRequestException("x")), "definitive"); // por getStatus(), sin importar HttpException en el adaptador
  assert.equal(classifyProviderError(new InternalServerErrorException("x")), "ambiguous");
});

test("Error sin senal (red, timeout, 'did not include id') => AMBIGUO (seguro para el dinero)", () => {
  assert.equal(classifyProviderError(new Error("ETIMEDOUT")), "ambiguous");
  assert.equal(classifyProviderError(new Error("PayPal payout response did not include a payout_batch_id")), "ambiguous");
  assert.equal(classifyProviderError("string raro"), "ambiguous");
  assert.equal(classifyProviderError(null), "ambiguous");
});

test("normalizeProviderError conserva el error original (para relanzarlo con su semantica HTTP)", () => {
  const cause = new BadRequestException("PayPal payout requires the professional payout email");
  const r = normalizeProviderError(cause);
  assert.equal(r.kind, "definitive_failure");
  assert.equal((r as any).cause, cause);
  assert.equal(normalizeProviderError(new Error("boom")).kind, "ambiguous_failure");
});

test("classifyHttpStatus", () => {
  assert.equal(classifyHttpStatus(400), "definitive");
  assert.equal(classifyHttpStatus(404), "definitive");
  assert.equal(classifyHttpStatus(408), "ambiguous");
  assert.equal(classifyHttpStatus(409), "ambiguous");
  assert.equal(classifyHttpStatus(502), "ambiguous");
});
