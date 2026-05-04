import test from "node:test";
import assert from "node:assert/strict";
import { hashPassword, sha256, verifyPassword } from "../src/common/auth-password.ts";

test("hashPassword and verifyPassword round-trip", () => {
  const hashed = hashPassword("VeryStrongPass123!");

  assert.equal(typeof hashed, "string");
  assert.equal(verifyPassword("VeryStrongPass123!", hashed), true);
  assert.equal(verifyPassword("wrong-password", hashed), false);
});

test("verifyPassword accepts legacy sha256 hashes", () => {
  const legacyHash = sha256("demo1234");

  assert.equal(verifyPassword("demo1234", legacyHash), true);
  assert.equal(verifyPassword("wrong-password", legacyHash), false);
});
