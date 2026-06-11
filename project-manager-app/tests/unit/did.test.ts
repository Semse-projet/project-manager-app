/**
 * Unit tests for did:semse method — pure functions only (no DB, no NestJS).
 * Run: node --experimental-strip-types --test tests/unit/did.test.ts
 */
import test from "node:test";
import assert from "node:assert/strict";

// ── inline pure functions (same logic as did.service.ts) ──────────────────────

function toDid(userId: string): string {
  return `did:semse:${userId}`;
}

function fromDid(did: string): string | null {
  const match = /^did:semse:(.+)$/.exec(did);
  return match?.[1] ?? null;
}

function buildDidDocument(
  userId: string,
  verificationStatus: string,
  reputationTier: string,
  apiBase: string,
) {
  const did = toDid(userId);
  const now = new Date().toISOString();
  return {
    "@context": [
      "https://www.w3.org/ns/did/v1",
      "https://w3id.org/security/suites/ed25519-2020/v1",
    ],
    id: did,
    controller: did,
    verificationMethod: [] as unknown[],
    authentication: [] as unknown[],
    service: [
      { id: `${did}#trust-passport`, type: "TrustPassportService", serviceEndpoint: `${apiBase}/v1/trust-passport/verify` },
      { id: `${did}#reputation`, type: "ReputationService", serviceEndpoint: `${apiBase}/v1/users/${userId}/reputation` },
      { id: `${did}#identity`, type: "SemseIdentityService", serviceEndpoint: `${apiBase}/v1/did/${userId}` },
    ],
    "semse:metadata": { verificationStatus, reputationTier, createdAt: now, resolvedAt: now },
  };
}

// ── toDid / fromDid ───────────────────────────────────────────────────────────

test("toDid produces correct did:semse URI", () => {
  assert.equal(toDid("user-abc123"), "did:semse:user-abc123");
});

test("toDid preserves CUID-style userId", () => {
  const userId = "clxyz1234567890abcdef";
  assert.equal(toDid(userId), `did:semse:${userId}`);
});

test("fromDid extracts userId from valid DID", () => {
  assert.equal(fromDid("did:semse:user-abc123"), "user-abc123");
});

test("fromDid returns null for wrong method", () => {
  assert.equal(fromDid("did:ethr:0xabc"), null);
});

test("fromDid returns null for malformed input", () => {
  assert.equal(fromDid("notadid"), null);
  assert.equal(fromDid(""), null);
  assert.equal(fromDid("did:semse:"), null);
});

test("toDid / fromDid round-trip", () => {
  const userId = "user-test-roundtrip";
  assert.equal(fromDid(toDid(userId)), userId);
});

// ── DID Document structure ────────────────────────────────────────────────────

const BASE = "http://localhost:4000";
const DOC = buildDidDocument("user-123", "verified", "trusted", BASE);

test("DID Document has correct @context", () => {
  assert.ok(DOC["@context"].includes("https://www.w3.org/ns/did/v1"));
});

test("DID Document id matches did:semse format", () => {
  assert.equal(DOC.id, "did:semse:user-123");
});

test("DID Document controller equals id (self-controlled)", () => {
  assert.equal(DOC.controller, DOC.id);
});

test("DID Document has exactly 3 service endpoints", () => {
  assert.equal(DOC.service.length, 3);
});

test("service endpoints include trust-passport, reputation, identity", () => {
  const types = DOC.service.map((s) => s.type);
  assert.ok(types.includes("TrustPassportService"));
  assert.ok(types.includes("ReputationService"));
  assert.ok(types.includes("SemseIdentityService"));
});

test("trust-passport service endpoint points to verify route", () => {
  const svc = DOC.service.find((s) => s.type === "TrustPassportService");
  assert.equal(new URL(svc?.serviceEndpoint ?? "").pathname, "/v1/trust-passport/verify");
});

test("reputation service endpoint includes userId", () => {
  const svc = DOC.service.find((s) => s.type === "ReputationService");
  assert.equal(new URL(svc?.serviceEndpoint ?? "").pathname, "/v1/users/user-123/reputation");
});

test("semse:metadata has verificationStatus and reputationTier", () => {
  const meta = DOC["semse:metadata"];
  assert.equal(meta.verificationStatus, "verified");
  assert.equal(meta.reputationTier, "trusted");
});

test("verificationMethod is empty array (no key yet)", () => {
  assert.deepEqual(DOC.verificationMethod, []);
});

test("service endpoint ids are namespaced under the DID", () => {
  for (const svc of DOC.service) {
    assert.ok(svc.id.startsWith("did:semse:user-123#"), `unexpected id: ${svc.id}`);
  }
});

// ── resolution result wrapper ─────────────────────────────────────────────────

test("resolution result has correct @context", () => {
  const result = {
    "@context": "https://w3id.org/did-resolution/v1" as const,
    didDocument: DOC,
    didResolutionMetadata: { contentType: "application/did+ld+json" as const, retrieved: new Date().toISOString() },
    didDocumentMetadata: { created: new Date().toISOString(), method: "semse" as const },
  };
  assert.equal(result["@context"], "https://w3id.org/did-resolution/v1");
  assert.equal(result.didResolutionMetadata.contentType, "application/did+ld+json");
  assert.equal(result.didDocumentMetadata.method, "semse");
});
