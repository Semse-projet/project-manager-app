import "reflect-metadata";

import test from "node:test";
import assert from "node:assert/strict";
import { NotFoundException } from "@nestjs/common";
import { DidService, toDid, fromDid } from "../dist/modules/did/did.service.js";

// ── Pure helpers ──────────────────────────────────────────────────────────────

test("did: toDid produces well-formed DID", () => {
  assert.equal(toDid("usr_abc123"), "did:semse:usr_abc123");
  assert.equal(toDid("user-xyz"), "did:semse:user-xyz");
});

test("did: fromDid extracts user ID from valid DID", () => {
  assert.equal(fromDid("did:semse:usr_abc123"), "usr_abc123");
  assert.equal(fromDid("did:semse:user-xyz"), "user-xyz");
});

test("did: fromDid returns null for non-semse DIDs", () => {
  assert.equal(fromDid("did:web:example.com"), null);
  assert.equal(fromDid("not-a-did"), null);
  assert.equal(fromDid(""), null);
});

test("did: toDid/fromDid round-trips correctly", () => {
  const userId = "usr_roundtrip_42";
  assert.equal(fromDid(toDid(userId)), userId);
});

// ── DidService.resolve ────────────────────────────────────────────────────────

function makePrisma(user: any | null) {
  return {
    user: {
      findFirst: async () => user,
    },
  } as never;
}

function makeReputationService(tier = "SILVER") {
  return {
    computeForUser: async () => ({ tier, score: 75 }),
  } as never;
}

const STUB_USER = {
  id: "usr_1",
  verificationStatus: "VERIFIED",
  createdAt: new Date("2026-01-01T00:00:00Z"),
};

test("did: resolve returns valid DID resolution result", async () => {
  const service = new DidService(makePrisma(STUB_USER), makeReputationService());

  const result = await service.resolve("usr_1", "tenant_1");

  assert.ok(result.didDocument);
  assert.equal(result.didDocument.id, "did:semse:usr_1");
  assert.equal(result.didDocument.controller, "did:semse:usr_1");
  assert.ok(Array.isArray(result.didDocument.service));
  assert.ok(result.didDocument.service.length >= 3);
});

test("did: resolve includes trust-passport and reputation service endpoints", async () => {
  const service = new DidService(makePrisma(STUB_USER), makeReputationService("GOLD"));

  const result = await service.resolve("usr_1", "tenant_1");

  const serviceIds = result.didDocument.service.map((s: any) => s.type);
  assert.ok(serviceIds.includes("TrustPassportService"));
  assert.ok(serviceIds.includes("ReputationService"));
});

test("did: resolve embeds verificationStatus and reputationTier in metadata", async () => {
  const service = new DidService(makePrisma(STUB_USER), makeReputationService("PLATINUM"));

  const result = await service.resolve("usr_1", "tenant_1");

  const meta = result.didDocument["semse:metadata"];
  assert.equal(meta.verificationStatus, "VERIFIED");
  assert.equal(meta.reputationTier, "PLATINUM");
  assert.ok(meta.createdAt);
  assert.ok(meta.resolvedAt);
});

test("did: resolve DID resolution metadata has correct content type", async () => {
  const service = new DidService(makePrisma(STUB_USER), makeReputationService());

  const result = await service.resolve("usr_1", "tenant_1");

  assert.equal(result.didResolutionMetadata.contentType, "application/did+ld+json");
  assert.ok(result.didResolutionMetadata.retrieved);
});

test("did: resolve throws NotFoundException for unknown user", async () => {
  const service = new DidService(makePrisma(null), makeReputationService());

  await assert.rejects(
    () => service.resolve("nonexistent_usr", "tenant_1"),
    NotFoundException
  );
});

test("did: resolve DID document has W3C DID context", async () => {
  const service = new DidService(makePrisma(STUB_USER), makeReputationService());

  const result = await service.resolve("usr_1", "tenant_1");

  const contexts = result.didDocument["@context"] as string[];
  assert.ok(contexts.some((c) => c.includes("w3.org/ns/did")));
});
