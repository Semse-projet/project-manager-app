import test from "node:test";
import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import { assertIndependentSignerConsents } from "../dist/modules/contracts/verified-signer-consent.js";

const key = Buffer.alloc(32, 27);
const common = {
  tenantId: "tenant_a", contractId: "contract_a", connectionId: "conn_a",
  providerId: "documenso", externalRequestId: "envelope_123",
  documentVersionSha256: "a".repeat(64),
};
const signer = [
  { ...common, role: "client" as const, userId: "user_a",
    email: "client@example.com", providerRecipientId: "101", providerSignedAt: "2026-10-09T13:05:00Z" },
  { ...common, role: "professional" as const, userId: "user_b",
    email: "pro@example.com", providerRecipientId: "202", providerSignedAt: "2026-10-09T13:06:00Z" },
];
function issueReceipt(s: typeof signer[number], id: string) {
  const x = {
    version: 1,
    ...common, role: s.role, userId: s.userId, email: s.email,
    providerRecipientId: s.providerRecipientId, authChallengeId: id,
    stepUpMethod: "webauthn" as const,
    identityVerifiedAt: "2026-10-09T13:00:00Z",
    consentedAt: "2026-10-09T13:01:00Z",
    challengeExpiresAt: "2026-10-09T13:10:00Z",
  };
  const mac = createHmac("sha256", key).update(JSON.stringify([
    "SEMSE_SIGNER_CONSENT_V1",
    x.version, x.tenantId, x.contractId, x.connectionId, x.providerId,
    x.externalRequestId, x.documentVersionSha256, x.userId, x.role,
    x.email, x.providerRecipientId, x.authChallengeId,
    x.stepUpMethod, x.identityVerifiedAt, x.consentedAt, x.challengeExpiresAt,
  ])).digest("hex");
  return { ...x, mac };
}
function fixture() {
  return [issueReceipt(signer[0]!, "challenge_a"), issueReceipt(signer[1]!, "challenge_b")];
}

test("two independent canonical signer consents pass only with valid server MAC", () => {
  assert.doesNotThrow(() => assertIndependentSignerConsents(signer, fixture(), key));
});

test("cannot convert Documenso SIGNED status alone into signer consent", () => {
  assert.throws(() => assertIndependentSignerConsents(signer, [], key), /two independent/);
});

test("client-supplied scope, document hash, recipient and user substitutions fail closed", () => {
  const fields = [
    ["tenantId", "tenant_other"], ["contractId", "contract_other"],
    ["connectionId", "conn_other"], ["providerId", "other"],
    ["externalRequestId", "envelope_other"],
    ["documentVersionSha256", "b".repeat(64)],
    ["userId", "attacker"], ["role", "professional"],
    ["email", "attacker@example.com"], ["providerRecipientId", "999"],
  ] as const;
  for (const [field, value] of fields) {
    const changed = fixture().map(x => ({ ...x }));
    changed[0] = { ...changed[0]!, [field]: value } as never;
    assert.throws(() => assertIndependentSignerConsents(signer, changed, key),
      /mismatch|independent|receipt shape/);
  }
});

test("MAC tampering and signing-key mismatch invalidate independent consent", () => {
  const receipts = fixture();
  assert.throws(() => assertIndependentSignerConsents(signer,
    [{ ...receipts[0]!, mac: "a".repeat(64) }, receipts[1]!], key), /MAC invalid/);
  assert.throws(() => assertIndependentSignerConsents(signer, receipts,
    Buffer.alloc(32, 17)), /MAC invalid/);
  assert.throws(() => assertIndependentSignerConsents(signer, receipts,
    Buffer.from("short")), /verification key unavailable/);
});

test("replayed same identity or challenge cannot sign both roles", () => {
  const receipts = fixture();
  assert.throws(() => assertIndependentSignerConsents(signer,
    [{ ...receipts[0]! }, { ...receipts[1]!, authChallengeId: "challenge_a" }], key),
    /two independent/);
  assert.throws(() => assertIndependentSignerConsents([
    signer[0]!, { ...signer[1]!, userId: "user_a" },
  ], receipts, key), /two independent/);
});

test("step-up verification must precede consent and provider signing within short challenge TTL", () => {
  for (const fieldChange of [
    { identityVerifiedAt: "2026-10-09T13:06:00Z" },
    { consentedAt: "2026-10-09T13:07:00Z" },
    { challengeExpiresAt: "2026-10-09T13:04:00Z" },
    { challengeExpiresAt: "2026-10-09T14:00:00Z" },
    { consentedAt: "2026-10-09" },
  ]) {
    // Independently re-issue a correctly authenticated receipt whose
    // claims nevertheless fail the chronology/expiration constraint.
    const base = { ...signer[0]!, providerSignedAt: signer[0]!.providerSignedAt };
    const orig = issueReceipt(base, "challenge_a");
    const modified = { ...orig, ...fieldChange };
    const payload = [
      "SEMSE_SIGNER_CONSENT_V1", modified.version, modified.tenantId,
      modified.contractId, modified.connectionId, modified.providerId,
      modified.externalRequestId, modified.documentVersionSha256,
      modified.userId, modified.role, modified.email,
      modified.providerRecipientId, modified.authChallengeId,
      modified.stepUpMethod, modified.identityVerifiedAt,
      modified.consentedAt, modified.challengeExpiresAt,
    ];
    modified.mac = createHmac("sha256", key).update(JSON.stringify(payload)).digest("hex");
    assert.throws(() => assertIndependentSignerConsents(signer,
      [modified, issueReceipt(signer[1]!, "challenge_b")], key),
      /chronology|ISO8601/);
  }
});
