/**
 * Unit tests for apps/api/src/common/auth-token.ts
 * Run: node --test tests/unit/auth-token.test.mjs
 */
import test from "node:test";
import assert from "node:assert/strict";

import {
  signToken,
  verifyToken,
} from "../../apps/api/src/common/auth-token.ts";

const SECRET = "test-secret-that-is-definitely-32-chars-long";

const BASE_CLAIMS = {
  userId: "user-abc",
  tenantId: "tenant-xyz",
  orgId: "org-001",
  roles: ["CLIENT"],
};

// ── signToken ─────────────────────────────────────────────────────────────────

test("signToken produces a non-empty string with one dot", () => {
  const token = signToken(BASE_CLAIMS, SECRET);
  assert.equal(typeof token, "string");
  assert.ok(token.length > 20);
  assert.equal(token.split(".").length, 2, "Token must have exactly one dot");
});

test("signToken encodes all provided claims", () => {
  const token = signToken(BASE_CLAIMS, SECRET, 3600);
  const claims = verifyToken(token, SECRET);
  assert.equal(claims.userId, BASE_CLAIMS.userId);
  assert.equal(claims.tenantId, BASE_CLAIMS.tenantId);
  assert.equal(claims.orgId, BASE_CLAIMS.orgId);
  assert.deepEqual(claims.roles, BASE_CLAIMS.roles);
});

test("signToken sets iat and exp correctly", () => {
  const before = Math.floor(Date.now() / 1000);
  const token = signToken(BASE_CLAIMS, SECRET, 60);
  const after  = Math.floor(Date.now() / 1000);
  const claims = verifyToken(token, SECRET);

  assert.ok(claims.iat >= before, "iat should be >= now");
  assert.ok(claims.iat <= after,  "iat should be <= now");
  assert.ok(claims.exp > claims.iat, "exp must be after iat");
  assert.ok(claims.exp <= after + 61, "exp within ttl");
});

test("signToken includes a non-empty jti", () => {
  const token = signToken(BASE_CLAIMS, SECRET);
  const claims = verifyToken(token, SECRET);
  assert.ok(typeof claims.jti === "string" && claims.jti.length > 0);
});

test("signToken produces different tokens for same claims (jti randomness)", () => {
  const t1 = signToken(BASE_CLAIMS, SECRET);
  const t2 = signToken(BASE_CLAIMS, SECRET);
  assert.notEqual(t1, t2);
});

// ── verifyToken ───────────────────────────────────────────────────────────────

test("verifyToken returns correct claims for a valid token", () => {
  const token = signToken({ ...BASE_CLAIMS, roles: ["OPS_ADMIN"] }, SECRET);
  const claims = verifyToken(token, SECRET);
  assert.equal(claims.userId, BASE_CLAIMS.userId);
  assert.deepEqual(claims.roles, ["OPS_ADMIN"]);
});

test("verifyToken throws when secret is wrong", () => {
  const token = signToken(BASE_CLAIMS, SECRET);
  assert.throws(
    () => verifyToken(token, "wrong-secret-completely-different"),
    /invalid token signature/i
  );
});

test("verifyToken throws when token is malformed (no dot)", () => {
  assert.throws(
    () => verifyToken("nodothere", SECRET),
    /invalid token format/i
  );
});

test("verifyToken throws when token is tampered", () => {
  const token = signToken(BASE_CLAIMS, SECRET);
  const [payload] = token.split(".");
  const tampered = `${payload}.badsignature`;
  assert.throws(
    () => verifyToken(tampered, SECRET),
    /invalid token signature/i
  );
});

test("verifyToken throws when token is expired", async () => {
  // Sign with 1 second TTL then wait for it to expire
  const token = signToken(BASE_CLAIMS, SECRET, -1); // negative TTL → already expired
  assert.throws(
    () => verifyToken(token, SECRET),
    /token expired/i
  );
});

test("verifyToken accepts optional sid and typ fields", () => {
  const claims = { ...BASE_CLAIMS, sid: "session-id", typ: "access" as const };
  const token = signToken(claims, SECRET);
  const result = verifyToken(token, SECRET);
  assert.equal(result.sid, "session-id");
  assert.equal(result.typ, "access");
});
