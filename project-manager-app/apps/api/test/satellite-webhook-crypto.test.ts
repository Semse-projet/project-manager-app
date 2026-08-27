import test from "node:test";
import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";

import {
  decryptWebhookSecret,
  encryptWebhookSecret,
  generateWebhookSecret,
  isSecretStrengthValid,
  signWebhookPayload,
  verifyWebhookSignature,
} from "../dist/modules/satellites/satellite-webhook-crypto.js";

const testKeyHex = randomBytes(32).toString("hex");

test("generateWebhookSecret produces a strong, unique secret each time", () => {
  const a = generateWebhookSecret();
  const b = generateWebhookSecret();
  assert.notEqual(a, b);
  assert.equal(isSecretStrengthValid(a), true);
  assert.match(a, /^[0-9a-f]{64}$/);
});

test("encryptWebhookSecret/decryptWebhookSecret roundtrip exactly", () => {
  const secret = generateWebhookSecret();
  const encrypted = encryptWebhookSecret(secret, testKeyHex);
  assert.notEqual(encrypted.ciphertext, secret);
  assert.equal(decryptWebhookSecret(encrypted, testKeyHex), secret);
});

test("decryptWebhookSecret fails closed (throws) when the auth tag doesn't match — tampered ciphertext", () => {
  const secret = generateWebhookSecret();
  const encrypted = encryptWebhookSecret(secret, testKeyHex);
  const tampered = { ...encrypted, ciphertext: encrypted.ciphertext.replace(/^../, "ff") };
  assert.throws(() => decryptWebhookSecret(tampered, testKeyHex));
});

test("decryptWebhookSecret fails with the wrong key", () => {
  const secret = generateWebhookSecret();
  const encrypted = encryptWebhookSecret(secret, testKeyHex);
  const wrongKey = randomBytes(32).toString("hex");
  assert.throws(() => decryptWebhookSecret(encrypted, wrongKey));
});

test("encryptWebhookSecret rejects a key that isn't exactly 32 bytes", () => {
  assert.throws(() => encryptWebhookSecret("secret", "deadbeef"));
});

test("signWebhookPayload produces a stable HMAC-SHA256 for a fixed vector", () => {
  // Fixed vector, independently reproducible: HMAC-SHA256("hello", "secret").
  const signature = signWebhookPayload("hello", "secret");
  assert.equal(
    signature,
    "sha256=88aab3ede8d3adf94d26ab90d3bafd4a2083070c3bcce9c014ee04a443847c0b",
  );
});

test("verifyWebhookSignature accepts a matching signature and rejects a tampered body or wrong secret", () => {
  const secret = "correct-horse-battery-staple-correct-horse";
  const body = JSON.stringify({ event: "job.matched", occurredAt: "2026-08-27T00:00:00.000Z" });
  const signature = signWebhookPayload(body, secret);

  assert.equal(verifyWebhookSignature(body, secret, signature), true);
  assert.equal(verifyWebhookSignature(body + "x", secret, signature), false);
  assert.equal(verifyWebhookSignature(body, "wrong-secret", signature), false);
  assert.equal(verifyWebhookSignature(body, secret, "sha256=deadbeef"), false);
});

test("isSecretStrengthValid rejects a secret shorter than 32 characters", () => {
  assert.equal(isSecretStrengthValid("too-short"), false);
  assert.equal(isSecretStrengthValid("a".repeat(32)), true);
});
