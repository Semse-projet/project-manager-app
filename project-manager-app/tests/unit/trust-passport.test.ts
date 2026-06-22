/**
 * Unit tests for the Trust Passport signing/verification logic.
 * Run: node --experimental-strip-types --test tests/unit/trust-passport.test.ts
 *
 * Tests the pure crypto layer only — no DB, no NestJS.
 */
import test from "node:test";
import assert from "node:assert/strict";
import crypto from "node:crypto";

// ── inline the pure signing functions (same logic as trust-passport.service.ts) ──

const PASSPORT_TTL_SECONDS = 30 * 24 * 60 * 60;

function b64url(input: string): string {
  return Buffer.from(input).toString("base64url");
}

function fromb64url(input: string): string {
  return Buffer.from(input, "base64url").toString("utf8");
}

function signPassport(claims: Record<string, unknown>, secret: string): string {
  const now = Math.floor(Date.now() / 1000);
  const full = { ...claims, jti: crypto.randomUUID(), iat: now, exp: now + PASSPORT_TTL_SECONDS };
  const encoded = b64url(JSON.stringify(full));
  const sig = crypto.createHmac("sha256", secret).update(encoded).digest("base64url");
  return `${encoded}.${sig}`;
}

function verifyPassport(token: string, secret: string): Record<string, unknown> {
  const dot = token.lastIndexOf(".");
  if (dot === -1) throw new Error("malformed token");

  const encoded = token.slice(0, dot);
  const sig = token.slice(dot + 1);
  const expected = crypto.createHmac("sha256", secret).update(encoded).digest("base64url");

  const sigBuf = Buffer.from(sig);
  const expBuf = Buffer.from(expected);
  if (sigBuf.length !== expBuf.length || !crypto.timingSafeEqual(sigBuf, expBuf)) {
    throw new Error("invalid signature");
  }

  const parsed = JSON.parse(fromb64url(encoded)) as Record<string, unknown>;
  if (parsed["typ"] !== "trust-passport") throw new Error("wrong token type");
  if ((parsed["exp"] as number) < Math.floor(Date.now() / 1000)) throw new Error("passport expired");
  return parsed;
}

const SECRET = "test-passport-secret-32chars-long!";

const sampleClaims = {
  sub: "user-123",
  iss: "semse",
  typ: "trust-passport",
  reputation: { score: 82, tier: "trusted", algorithmVersion: "v1.0", signals: {} },
  contributions: {
    jobsCompleted: 14,
    milestonesDelivered: 38,
    evidenceSubmitted: 72,
    disputeRate: 0.07,
    avgRating: 4.6,
    totalRatings: 11,
  },
  computedAt: new Date().toISOString(),
};

// ── structure ─────────────────────────────────────────────────────────────────

test("passport token has exactly two parts separated by a dot", () => {
  const token = signPassport(sampleClaims, SECRET);
  const parts = token.split(".");
  assert.equal(parts.length, 2, `expected 2 parts, got ${parts.length}`);
});

test("passport payload round-trips correctly", () => {
  const token = signPassport(sampleClaims, SECRET);
  const claims = verifyPassport(token, SECRET);
  assert.equal(claims["sub"], "user-123");
  assert.equal(claims["typ"], "trust-passport");
  assert.equal(claims["iss"], "semse");
  const contrib = claims["contributions"] as typeof sampleClaims.contributions;
  assert.equal(contrib.jobsCompleted, 14);
  assert.equal(contrib.disputeRate, 0.07);
});

test("passport includes iat, exp, jti injected automatically", () => {
  const before = Math.floor(Date.now() / 1000);
  const token = signPassport(sampleClaims, SECRET);
  const after = Math.floor(Date.now() / 1000);
  const claims = verifyPassport(token, SECRET);

  assert.ok(typeof claims["jti"] === "string" && (claims["jti"] as string).length > 0);
  assert.ok((claims["iat"] as number) >= before && (claims["iat"] as number) <= after);
  assert.ok((claims["exp"] as number) === (claims["iat"] as number) + PASSPORT_TTL_SECONDS);
});

test("passport TTL is 30 days", () => {
  const token = signPassport(sampleClaims, SECRET);
  const claims = verifyPassport(token, SECRET);
  const ttl = (claims["exp"] as number) - (claims["iat"] as number);
  assert.equal(ttl, 30 * 24 * 60 * 60);
});

test("two passports for same user have different jti", () => {
  const t1 = signPassport(sampleClaims, SECRET);
  const t2 = signPassport(sampleClaims, SECRET);
  const c1 = verifyPassport(t1, SECRET);
  const c2 = verifyPassport(t2, SECRET);
  assert.notEqual(c1["jti"], c2["jti"]);
});

// ── signature validation ──────────────────────────────────────────────────────

test("valid token verifies successfully", () => {
  const token = signPassport(sampleClaims, SECRET);
  assert.doesNotThrow(() => verifyPassport(token, SECRET));
});

test("tampered payload fails verification", () => {
  const token = signPassport(sampleClaims, SECRET);
  const [payload, sig] = [token.slice(0, token.lastIndexOf(".")), token.slice(token.lastIndexOf(".") + 1)];
  const tampered = b64url(JSON.stringify({ ...sampleClaims, sub: "attacker" }));
  assert.throws(() => verifyPassport(`${tampered}.${sig}`, SECRET), /invalid signature/);
});

test("wrong secret fails verification", () => {
  const token = signPassport(sampleClaims, SECRET);
  assert.throws(() => verifyPassport(token, "different-secret"), /invalid signature/);
});

test("malformed token (no dot) throws", () => {
  assert.throws(() => verifyPassport("nodothere", SECRET), /malformed token/);
});

test("wrong typ rejects", () => {
  const wrongType = { ...sampleClaims, typ: "session" };
  const token = signPassport(wrongType, SECRET);
  assert.throws(() => verifyPassport(token, SECRET), /wrong token type/);
});

test("expired token throws", () => {
  const now = Math.floor(Date.now() / 1000);
  const expired = { ...sampleClaims, jti: crypto.randomUUID(), iat: now - 100, exp: now - 1 };
  const encoded = b64url(JSON.stringify(expired));
  const sig = crypto.createHmac("sha256", SECRET).update(encoded).digest("base64url");
  const token = `${encoded}.${sig}`;
  assert.throws(() => verifyPassport(token, SECRET), /passport expired/);
});

// ── contributions shape ───────────────────────────────────────────────────────

test("contributions fields are all present", () => {
  const token = signPassport(sampleClaims, SECRET);
  const claims = verifyPassport(token, SECRET);
  const c = claims["contributions"] as typeof sampleClaims.contributions;
  assert.equal(typeof c.jobsCompleted, "number");
  assert.equal(typeof c.milestonesDelivered, "number");
  assert.equal(typeof c.evidenceSubmitted, "number");
  assert.equal(typeof c.disputeRate, "number");
  assert.equal(typeof c.avgRating, "number");
  assert.equal(typeof c.totalRatings, "number");
});

test("disputeRate is between 0 and 1", () => {
  const token = signPassport(sampleClaims, SECRET);
  const claims = verifyPassport(token, SECRET);
  const c = claims["contributions"] as typeof sampleClaims.contributions;
  assert.ok(c.disputeRate >= 0 && c.disputeRate <= 1);
});

// ── reputation shape ──────────────────────────────────────────────────────────

test("reputation tier and score are present", () => {
  const token = signPassport(sampleClaims, SECRET);
  const claims = verifyPassport(token, SECRET);
  const r = claims["reputation"] as typeof sampleClaims.reputation;
  assert.equal(typeof r.score, "number");
  assert.equal(typeof r.tier, "string");
  assert.equal(r.algorithmVersion, "v1.0");
});
