import test from "node:test";
import assert from "node:assert/strict";
import { PrismaSignatureEvidenceCandidateJournal } from "../dist/modules/contracts/prisma-signature-evidence-candidate-journal.js";

const valid = {
  tenantId: "tenant_a", connectionId: "conn_a",
  contractId: "contract_a", providerId: "documenso", externalRequestId: "envelope_123",
  documentVersionSha256: "a".repeat(64),
  signedPdfSha256: "b".repeat(64), certificateSha256: "c".repeat(64), auditLogSha256: "d".repeat(64),
  signedPdfRef: "private/tenant_a/signed.pdf",
  certificateRef: "private/tenant_a/certificate.json",
  auditLogRef: "private/tenant_a/audit.pdf",
  signers: [
    { role: "client", userId: "user_a" },
    { role: "professional", userId: "user_b" },
  ],
  status: "PENDING_VERIFICATION",
};
function journal({ dispatch = true, duplicate = false } = {}) {
  const queries: unknown[] = [];
  const writes: unknown[] = [];
  const db = {
    signatureDispatchOutbox: {
      async findFirst(q: unknown) { queries.push(q); return dispatch ? { id: "dispatch_a" } : null; },
    },
    contractSignatureEvidenceCandidate: {
      async create(q: unknown) {
        writes.push(q);
        if (duplicate) throw { code: "P2002" };
        return { id: "candidate_a" };
      },
    },
  };
  return { subject: new PrismaSignatureEvidenceCandidateJournal(db as never), queries, writes };
}

test("pending journal refuses evidence not connected to a dispatched envelope", async () => {
  const h = journal({ dispatch: false });
  await assert.rejects(h.subject.record(valid as never), /no scoped, sent provider request/);
  assert.equal(h.writes.length, 0);
  assert.deepEqual((h.queries[0] as any).where, {
    tenantId: "tenant_a", connectionId: "conn_a", contractId: "contract_a",
    providerId: "documenso", externalRequestId: "envelope_123", status: "SENT",
  });
});

test("pending journal writes scoped immutable hashes and NEVER a verified status", async () => {
  const h = journal();
  await h.subject.record(valid as never);
  assert.equal(h.writes.length, 1);
  const data = (h.writes[0] as any).data;
  assert.equal(data.status, "PENDING_VERIFICATION");
  assert.equal(data.signedPdfSha256, "b".repeat(64));
  assert.equal(data.certificateSha256, "c".repeat(64));
  assert.equal(data.tenantId, "tenant_a");
});

test("pending journal rejects externally hosted evidence refs and false VERIFIED claims", async () => {
  for (const patch of [
    { signedPdfRef: "https://attacker.example/signed.pdf" },
    { certificateRef: "//attacker.example/cert.json" },
    { status: "VERIFIED_EXECUTED" },
    { signedPdfSha256: "forged" },
    { signers: [] },
  ]) {
    const h = journal();
    await assert.rejects(h.subject.record({ ...valid, ...patch } as never), /invalid or externally-addressed/);
    assert.equal(h.queries.length, 0);
    assert.equal(h.writes.length, 0);
  }
});

test("duplicate envelope evidence cannot be silently overwritten", async () => {
  const h = journal({ duplicate: true });
  await assert.rejects(h.subject.record(valid as never), /already recorded; reconcile/);
  assert.equal(h.writes.length, 1);
});

test("non-unique database error is propagated for investigation", async () => {
  const db = {
    signatureDispatchOutbox: { findFirst: async () => ({ id: "dispatch_a" }) },
    contractSignatureEvidenceCandidate: {
      create: async () => { throw Error("database unavailable"); },
    },
  };
  const subject = new PrismaSignatureEvidenceCandidateJournal(db as never);
  await assert.rejects(subject.record(valid as never), /database unavailable/);
});
