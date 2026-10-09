import test from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { CanonicalContractOriginalSealer } from "../dist/modules/contracts/canonical-contract-original.sealer.js";
import { renderCanonicalContractPdf } from "../dist/modules/contracts/canonical-contract-pdf.js";

const bytes = Buffer.from("%PDF-1.7\nserver-controlled-original\n%%EOF");
const sha = createHash("sha256").update(bytes).digest("hex");
const terms = {
  trade: "electrical", templateVersion: "1.4.0",
  parties: {
    clientName: "Client A", clientEmail: "client@example.com",
    proName: "Pro B", proEmail: "professional@example.com",
    projectTitle: "Safe panel work", totalAmount: 800, currency: "USD",
    startDate: "2026-10-09",
  },
  scope: "Safe and code-compliant panel installation", materials: ["panel", "breakers"],
  milestones: [{ title: "Inspection", amount: 800, description: "Electrical inspection" }],
  totalAmount: 800, warranty: "One year", permits: "Client approval required",
  disputeClause: "Written mediation", changeOrders: "Written change approval",
  generatedAt: "2026-10-09T12:00:00Z",
};
const scope = { tenantId: "tenant_a", contractId: "contract_a", actorUserId: "client_a" };
const dbRow = {
  id: "contract_a", jobId: "job_a", updatedAt: new Date("2026-10-09T12:00:00Z"),
  termsJson: terms, signedClientAt: null, signedProAt: null,
  canonicalPdfSha256: null, canonicalPdfRef: null,
  clientUserId: "client_a", professionalUserId: "pro_a",
  clientUser: { email: "client@example.com" },
  professionalUser: { email: "professional@example.com" },
  job: { tenantId: "tenant_a" },
};
function harness(options = {}) {
  const calls = [];
  const updates = [];
  const audits = [];
  const initial = options.initial === undefined ? dbRow : options.initial;
  const fresh = options.fresh === undefined ? initial : options.fresh;
  const tx = {
    async $queryRaw() { calls.push("lock"); return options.noLock ? [] : [{ id: scope.contractId }]; },
    contract: {
      async findFirst() { calls.push("reread"); return fresh; },
      async updateMany(q) {
        calls.push("cas"); updates.push(q);
        return { count: options.casFail ? 0 : 1 };
      },
    },
    signatureDispatchOutbox: {
      async findFirst() { calls.push("outbox"); return options.hasDispatch ? { id: "dispatch_1" } : null; },
    },
    auditLog: {
      async create(q) { calls.push("audit"); audits.push(q);
        if (options.failAudit) throw Error("audit unavailable");
        return { id: "audit_1" }; },
    },
  };
  const prisma = {
    contract: { async findFirst() { calls.push("initial"); return initial; } },
    async $transaction(fn, opts) {
      calls.push("transaction"); assert.equal(opts.isolationLevel, "Serializable");
      return fn(tx);
    },
  };
  const artifacts = {
    async putImmutable(q) {
      calls.push("private_write");
      assert.equal(q.kind, "ORIGINAL_PDF");
      assert.equal(q.sha256, sha);
      return `private-signatures/${"f".repeat(64)}/${"e".repeat(64)}/ORIGINAL_PDF/${sha}`;
    },
  };
  const renderer = async (source) => {
    calls.push("render");
    assert.equal(source.tenantId, scope.tenantId);
    assert.equal(source.clientUserId, "client_a");
    assert.deepEqual(source.termsJson, terms);
    return bytes;
  };
  return {
    svc: new CanonicalContractOriginalSealer(prisma, artifacts, renderer),
    calls, updates, audits,
  };
}

test("server-owned original is sealed once with CAS, private PDF bytes and atomic audit", async () => {
  const h = harness();
  const result = await h.svc.seal(scope);
  assert.equal(result.contractId, "contract_a");
  assert.equal(result.sha256, sha);
  assert.match(result.privateRef, /ORIGINAL_PDF/);
  assert.deepEqual(h.calls, ["initial", "render", "private_write",
    "transaction", "lock", "reread", "outbox", "cas", "audit"]);
  assert.equal(h.updates[0].where.canonicalPdfSha256, null);
  assert.equal(h.updates[0].where.signedClientAt, null);
  assert.equal(h.updates[0].data.canonicalPdfSha256, sha);
  assert.equal(h.audits[0].data.afterJson.providerVerified, false);
});

test("existing legacy timestamps or seal cannot be upgraded to trusted original", async () => {
  for (const patch of [
    { signedClientAt: new Date() }, { signedProAt: new Date() },
    { canonicalPdfSha256: "f".repeat(64) },
    { canonicalPdfRef: "private/old.pdf" },
  ]) {
    const h = harness({ initial: { ...dbRow, ...patch } });
    await assert.rejects(h.svc.seal(scope), /legacy-signed or already sealed/);
    assert.deepEqual(h.calls, ["initial"]);
  }
});

test("provider dispatch and contract edits racing with sealing abort DB commit", async () => {
  for (const option of [
    { hasDispatch: true },
    { fresh: { ...dbRow, updatedAt: new Date("2026-10-09T13:00:00Z") } },
    { fresh: { ...dbRow, professionalUserId: "attacker" } },
    { noLock: true },
    { casFail: true },
  ]) {
    const h = harness(option);
    await assert.rejects(h.svc.seal(scope), /dispatch|changed|lock|concurrent/);
    assert.equal(h.audits.length, 0);
  }
});

test("audit failure propagates and cannot signal that document was sealed", async () => {
  const h = harness({ failAudit: true });
  await assert.rejects(h.svc.seal(scope), /audit unavailable/);
  assert.equal(h.audits.length, 1);
});

test("server renderer rejects malformed signed PDF and cross-tenant callers", async () => {
  const h = harness();
  await assert.rejects(h.svc.seal({ ...scope, tenantId: "" }), /authenticated/);
  const invalid = new CanonicalContractOriginalSealer({
    contract: { findFirst: async () => dbRow },
  }, { putImmutable: async () => "private" }, async () => Buffer.from("FRAUD"));
  await assert.rejects(invalid.seal(scope), /did not produce a canonical PDF/);
});

test("real PDF renderer produces bytes only for structured, canonical matching parties", async () => {
  const input = {
    tenantId: "tenant_a", contractId: "contract_a", jobId: "job_a",
    clientUserId: "client_a", professionalUserId: "pro_a",
    clientEmail: "client@example.com", professionalEmail: "professional@example.com",
    termsJson: terms,
  };
  const pdf = await renderCanonicalContractPdf(input);
  assert.equal(Buffer.from(pdf.subarray(0, 5)).toString(), "%PDF-");
  assert.ok(pdf.length > 200);
  await assert.rejects(renderCanonicalContractPdf({ ...input,
    professionalEmail: "attacker@example.com" }), /does not match/);
  await assert.rejects(renderCanonicalContractPdf({ ...input,
    termsJson: { ...terms, scope: "" } }), /too_small|String must contain at least 1 character|invalid/i);
  await assert.rejects(renderCanonicalContractPdf({ ...input,
    termsJson: { ...terms, materials: Array(101).fill("material") } }), /too_big|Array must contain at most 100 element|invalid/i);
});
