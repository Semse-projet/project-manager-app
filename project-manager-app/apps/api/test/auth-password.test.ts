import test from "node:test";
import assert from "node:assert/strict";
import { generateOpaqueToken, hashPassword, sha256, verifyPassword } from "../src/common/auth-password.ts";

test("hashPassword and verifyPassword round-trip", () => {
  const hashed = hashPassword("VeryStrongPass123!");

  assert.equal(typeof hashed, "string");
  assert.equal(verifyPassword("VeryStrongPass123!", hashed), true);
  assert.equal(verifyPassword("wrong-password", hashed), false);
});

test("verifyPassword rejects legacy sha256 hashes (must re-hash with scrypt)", () => {
  const legacyHash = sha256("demo1234");

  assert.equal(verifyPassword("demo1234", legacyHash), false);
  assert.equal(verifyPassword("wrong-password", legacyHash), false);
});

test("verifyPassword rejects malformed scrypt hash", () => {
  assert.equal(verifyPassword("password", "s1$badsalt"), false);
  assert.equal(verifyPassword("password", "s2$abc$def"), false);
});

test("generateOpaqueToken returns unique base64url strings", () => {
  const t1 = generateOpaqueToken();
  const t2 = generateOpaqueToken();
  assert.equal(typeof t1, "string");
  assert.ok(t1.length > 0);
  assert.notEqual(t1, t2);
});
