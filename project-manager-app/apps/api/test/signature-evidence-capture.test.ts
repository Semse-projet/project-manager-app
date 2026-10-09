import test from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { SignatureEvidenceCapture } from "../dist/modules/contracts/signature-evidence-capture.js";

const unsignedVersion = "a".repeat(64);
const pdf = Buffer.from("%PDF-1.7\n1 0 obj\n<<>>\nendobj\n%%EOF");
const cert = Buffer.from('{"audit":"provider-certified-archive","signed":true}');
const auditLog = Buffer.from("%PDF-1.7\nAUDIT LOG\n%%EOF");

const agreement = {
  tenantId: "tenant_a", connectionId: "conn_a", contractId: "contract_a",
  providerId: "documenso", externalRequestId: "envelope_123",
  documentVersionSha256: unsignedVersion,
  parties: [
    { role: "client" as const, userId: "client_1", email: "CLIENT@example.com" },
    { role: "professional" as const, userId: "pro_1", email: "pro@example.com" },
  ],
};
const completion = {
  ...agreement, status: "COMPLETED" as const,
  signers: [
    { role: "client" as const, userId: "client_1", email: "client@example.com",
      providerSignerId: "provider_client", consentRecordedAt: "2026-10-01T12:00:00Z",
      signedAt: "2026-10-01T12:01:00Z", signedDocumentVersionSha256: unsignedVersion },
    { role: "professional" as const, userId: "pro_1", email: "pro@example.com",
      providerSignerId: "provider_pro", consentRecordedAt: "2026-10-01T13:00:00Z",
      signedAt: "2026-10-01T13:01:00Z", signedDocumentVersionSha256: unsignedVersion },
  ],
  signedPdf: pdf, certificate: cert, auditLog, certificateMimeType: "application/json" as const,
};

function harness(overrides: Record<string, unknown> = {}, failStore = false) {
  const stored: unknown[] = [];
  const journaled: unknown[] = [];
  let calls = 0;
  const capture = new SignatureEvidenceCapture(
    { async fetch() { calls++; return { ...completion, ...overrides }; } },
    { async putImmutable(arg: { kind: string; sha256: string }) {
      if (failStore && arg.kind === "PROVIDER_CERTIFICATE") throw Error("object storage down");
      stored.push(arg);
      return `private/tenant_a/${arg.kind}/${arg.sha256}`;
    } },
    { async record(value: unknown) { journaled.push(value); } },
  );
  return { capture, stored, journaled, calls: () => calls };
}

test("captures only PENDING_VERIFICATION and digests the *actual* PDF and certificate bytes", async () => {
  const h = harness();
  const candidate = await h.capture.capture(agreement);
  assert.equal(candidate.status, "PENDING_VERIFICATION");
  assert.equal(candidate.signedPdfSha256, createHash("sha256").update(pdf).digest("hex"));
  assert.equal(candidate.certificateSha256, createHash("sha256").update(cert).digest("hex"));
  assert.equal(candidate.auditLogSha256, createHash("sha256").update(auditLog).digest("hex"));
  assert.equal(candidate.signers.length, 2);
  assert.equal(h.stored.length, 3);
  assert.equal(h.journaled.length, 1);
  assert.equal(h.calls(), 1);
  assert.ok(!("fullyExecutedAt" in candidate));
});

test("does not trust provider COMPLETED without sealed artifacts", async () => {
  for (const value of [
    { signedPdf: new Uint8Array() },
    { signedPdf: Buffer.from("http://untrusted/signed.pdf") },
    { certificate: new Uint8Array() },
    { auditLog: new Uint8Array() },
    { certificateMimeType: "text/plain" },
  ]) {
    const h = harness(value);
    await assert.rejects(h.capture.capture(agreement), /signed PDF|provider certificate|audit log/);
    assert.equal(h.stored.length, 0);
    assert.equal(h.journaled.length, 0);
  }
});

test("rejects provider status that is only pending, partial or cancelled", async () => {
  for (const status of ["PENDING", "PARTIAL", "CANCELLED", "DECLINED"]) {
    const h = harness({ status });
    await assert.rejects(h.capture.capture(agreement), /has not completed/);
    assert.equal(h.journaled.length, 0);
  }
});

test("denies cross tenant, connection, contract, provider and envelope substitutions", async () => {
  for (const [key, value] of [
    ["tenantId", "tenant_b"], ["connectionId", "conn_b"],
    ["contractId", "other_contract"], ["providerId", "untrusted"],
    ["externalRequestId", "envelope_other"],
    ["documentVersionSha256", "b".repeat(64)],
  ] as const) {
    const h = harness({ [key]: value });
    await assert.rejects(h.capture.capture(agreement), /evidence mismatch/);
    assert.equal(h.stored.length, 0);
    assert.equal(h.journaled.length, 0);
  }
});

test("refuses forged identity, missing consent and mismatched immutable version", async () => {
  for (const wrong of [
    { ...completion.signers[0]!, userId: "attacker" },
    { ...completion.signers[0]!, email: "attacker@example.com" },
    { ...completion.signers[0]!, consentRecordedAt: "" },
    { ...completion.signers[0]!, consentRecordedAt: "2026-10-01T15:00:00Z" },
    { ...completion.signers[0]!, signedDocumentVersionSha256: "b".repeat(64) },
  ]) {
    const h = harness({ signers: [wrong, completion.signers[1]] });
    await assert.rejects(h.capture.capture(agreement), /identity mismatch|consent|canonical contract version/);
    assert.equal(h.journaled.length, 0);
  }
});

test("refuses duplicated signers and provider identity", async () => {
  for (const signers of [
    [completion.signers[0]],
    [completion.signers[0], completion.signers[0]],
    [completion.signers[0], { ...completion.signers[1], providerSignerId: "provider_client" }],
  ]) {
    const h = harness({ signers });
    await assert.rejects(h.capture.capture(agreement), /exactly two|duplicate provider signer/);
    assert.equal(h.journaled.length, 0);
  }
});

test("canonical data must have both parties and sha256 version before external call", async () => {
  const h = harness();
  await assert.rejects(h.capture.capture({ ...agreement, documentVersionSha256: "userhash" }), /invalid canonical/);
  await assert.rejects(h.capture.capture({ ...agreement, parties: [agreement.parties[0]!] }), /canonical parties/);
  assert.equal(h.calls(), 0);
});

test("object storage failure cannot create pending journal records or a verified status", async () => {
  const h = harness({}, true);
  await assert.rejects(h.capture.capture(agreement), /object storage down/);
  assert.equal(h.journaled.length, 0);
});

test("replay/multiple callbacks require journal-level uniqueness, never auto-promote candidates", async () => {
  const h = harness();
  const first = await h.capture.capture(agreement);
  const second = await h.capture.capture(agreement);
  assert.equal(first.status, "PENDING_VERIFICATION");
  assert.equal(second.status, "PENDING_VERIFICATION");
  assert.equal(first.signedPdfSha256, second.signedPdfSha256);
  // The persistent journal is responsible for deduplication before calling
  // an eventual provider-verification workflow, NOT this pure capture stage.
});
