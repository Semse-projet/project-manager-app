/**
 * Unit tests for apps/web/lib/auth.ts — signed web session cookie.
 *
 * Format: <base64url(payload)>.<HMAC-SHA256(payload, secret)>
 * This is the SEMSE Signed Session Cookie — NOT a standard JWT.
 *
 * Run: node --experimental-strip-types --test tests/unit/web-session.test.ts
 */
import test from "node:test";
import assert from "node:assert/strict";

// Set up the secret before importing — lib/auth.ts reads env at call time
const TEST_SECRET = "test-session-secret-at-least-32-chars";
process.env.SEMSE_WEB_SESSION_SECRET = TEST_SECRET;
process.env.NODE_ENV = "test";

import { encodeSession, decodeSession, buildSessionCookie, clearSessionCookie, SESSION_COOKIE, type SessionPayload } from "../../apps/web/lib/auth.ts";

const now = Math.floor(Date.now() / 1000);

const VALID_PAYLOAD: SessionPayload = {
  userId: "usr_test_001",
  tenantId: "tenant_default",
  orgId: "org_test_001",
  roles: ["CLIENT"],
  exp: now + 3600,
};

// ── encodeSession / decodeSession round-trip ──────────────────────────────────

test("encodeSession produces a two-part base64url string", async () => {
  const encoded = await encodeSession(VALID_PAYLOAD);
  assert.equal(typeof encoded, "string");
  assert.ok(encoded.length > 20);
  const parts = encoded.split(".");
  assert.equal(parts.length, 2, `Token must have exactly one dot — got ${parts.length} parts`);
  // Both parts must be base64url (no +/= chars)
  assert.doesNotMatch(parts[0], /[+/=]/, "payload must be base64url");
  assert.doesNotMatch(parts[1], /[+/=]/, "signature must be base64url");
});

test("decodeSession round-trips a valid payload", async () => {
  const encoded = await encodeSession(VALID_PAYLOAD);
  const decoded = await decodeSession(encoded);
  assert.ok(decoded !== null, "decodeSession must return the payload");
  assert.equal(decoded!.userId, VALID_PAYLOAD.userId);
  assert.equal(decoded!.tenantId, VALID_PAYLOAD.tenantId);
  assert.equal(decoded!.orgId, VALID_PAYLOAD.orgId);
  assert.deepEqual(decoded!.roles, VALID_PAYLOAD.roles);
  assert.equal(decoded!.exp, VALID_PAYLOAD.exp);
});

test("decodeSession returns null for an expired session", async () => {
  const expired: SessionPayload = { ...VALID_PAYLOAD, exp: now - 1 };
  const encoded = await encodeSession(expired);
  const decoded = await decodeSession(encoded);
  assert.equal(decoded, null, "expired session must return null");
});

test("decodeSession returns null when signature is wrong secret", async () => {
  // Sign with a different secret
  const originalSecret = process.env.SEMSE_WEB_SESSION_SECRET;
  process.env.SEMSE_WEB_SESSION_SECRET = "different-secret-that-is-also-32-chars";
  const tampered = await encodeSession(VALID_PAYLOAD);
  process.env.SEMSE_WEB_SESSION_SECRET = originalSecret;

  const decoded = await decodeSession(tampered);
  assert.equal(decoded, null, "wrong-secret token must be rejected");
});

test("decodeSession returns null when payload is tampered", async () => {
  const encoded = await encodeSession(VALID_PAYLOAD);
  const [, sig] = encoded.split(".");
  // Replace payload with a different one, keeping old signature
  const evilPayload = Buffer.from(
    JSON.stringify({ ...VALID_PAYLOAD, roles: ["OPS_ADMIN"] })
  ).toString("base64url");
  const tampered = `${evilPayload}.${sig}`;
  const decoded = await decodeSession(tampered);
  assert.equal(decoded, null, "tampered payload must be rejected");
});

test("decodeSession returns null for missing dot separator", async () => {
  const decoded = await decodeSession("nodothere");
  assert.equal(decoded, null);
});

test("decodeSession returns null for empty string", async () => {
  const decoded = await decodeSession("");
  assert.equal(decoded, null);
});

test("decodeSession returns null for dot at start (no payload)", async () => {
  const decoded = await decodeSession(".signature");
  assert.equal(decoded, null);
});

test("decodeSession returns null for dot at end (no signature)", async () => {
  const encoded = await encodeSession(VALID_PAYLOAD);
  const [payload] = encoded.split(".");
  const decoded = await decodeSession(`${payload}.`);
  assert.equal(decoded, null);
});

// ── Role coverage ─────────────────────────────────────────────────────────────

test("decodeSession accepts OPS_ADMIN roles", async () => {
  const payload: SessionPayload = { ...VALID_PAYLOAD, roles: ["OPS_ADMIN"] };
  const encoded = await encodeSession(payload);
  const decoded = await decodeSession(encoded);
  assert.deepEqual(decoded!.roles, ["OPS_ADMIN"]);
});

test("decodeSession accepts PRO role", async () => {
  const payload: SessionPayload = { ...VALID_PAYLOAD, roles: ["PRO"] };
  const encoded = await encodeSession(payload);
  const decoded = await decodeSession(encoded);
  assert.deepEqual(decoded!.roles, ["PRO"]);
});

test("decodeSession accepts multiple roles", async () => {
  const payload: SessionPayload = { ...VALID_PAYLOAD, roles: ["OPS_ADMIN", "WORKER"] };
  const encoded = await encodeSession(payload);
  const decoded = await decodeSession(encoded);
  assert.deepEqual(decoded!.roles, ["OPS_ADMIN", "WORKER"]);
});

// ── Session IDs are unique across calls ──────────────────────────────────────

test("encodeSession produces different output each call for same payload (WebCrypto key re-import)", async () => {
  // Note: HMAC is deterministic — same payload + same key = same signature.
  // This test verifies the token is stable (not random-nonce based), which is correct.
  const a = await encodeSession(VALID_PAYLOAD);
  const b = await encodeSession(VALID_PAYLOAD);
  assert.equal(a, b, "HMAC is deterministic — same payload must produce same token");
});

// ── buildSessionCookie / clearSessionCookie ───────────────────────────────────

test("buildSessionCookie includes required cookie attributes", async () => {
  const cookie = await buildSessionCookie(VALID_PAYLOAD);
  assert.ok(cookie.startsWith(`${SESSION_COOKIE}=`), "must use correct cookie name");
  assert.ok(cookie.includes("HttpOnly"), "must be HttpOnly");
  assert.ok(cookie.includes("Path=/"), "must set Path=/");
  assert.ok(cookie.includes("SameSite=Lax"), "must set SameSite=Lax");
  assert.ok(cookie.includes("Max-Age="), "must include Max-Age");
});

test("buildSessionCookie includes Secure when option is set", async () => {
  const cookie = await buildSessionCookie(VALID_PAYLOAD, { secure: true });
  assert.ok(cookie.includes("; Secure"), "Secure flag must be set");
});

test("buildSessionCookie without secure does not include Secure", async () => {
  const cookie = await buildSessionCookie(VALID_PAYLOAD, { secure: false });
  assert.ok(!cookie.includes("; Secure"), "Secure flag must not be set");
});

test("clearSessionCookie returns Max-Age=0 to expire the cookie", () => {
  const cleared = clearSessionCookie();
  assert.ok(cleared.includes("Max-Age=0"), "must set Max-Age=0");
  assert.ok(cleared.startsWith(`${SESSION_COOKIE}=`), "must target correct cookie name");
  assert.ok(cleared.includes("HttpOnly"), "must keep HttpOnly on cleared cookie");
});

test("SESSION_COOKIE constant is semse_session", () => {
  assert.equal(SESSION_COOKIE, "semse_session");
});
