import test from "node:test";
import assert from "node:assert/strict";
import { assertVerifiedEscrowReservation, resolveVerifiedEscrowMode } from "../dist/modules/payments/verified-escrow-reservation.gate.js";

const v = "a".repeat(64);
const proof = {
  id: "verified_1", tenantId: "tenant_a", contractId: "contract_a",
  connectionId: "conn_a", documentVersionSha256: v,
  clientUserId: "client_a", professionalUserId: "pro_a",
  providerId: "documenso", externalRequestId: "envelope_123",
  signedPdfSha256: "b".repeat(64), certificateSha256: "c".repeat(64),
  auditLogSha256: "d".repeat(64),
  signedPdfRef: "private/tenant_a/pdf",
  certificateRef: "private/tenant_a/cert",
  auditLogRef: "private/tenant_a/audit",
  authorizedPolicyDecisionId: "policy_1",
  consentVerifiedAt: new Date("2026-10-01T12:00:00Z"),
  cryptographicVerifiedAt: new Date("2026-10-01T12:05:00Z"),
  verifiedAt: new Date("2026-10-01T12:06:00Z"),
  status: "VERIFIED_EXECUTED",
};
const project = {
  tenantId: "tenant_a",
  job: {
    tenantId: "tenant_a", deletedAt: null,
    contract: {
      id: "contract_a", deletedAt: null, clientUserId: "client_a",
      professionalUserId: "pro_a", canonicalPdfSha256: v,
    },
  },
};
function harness(options: {
  project?: unknown;
  proof?: unknown;
  lockId?: string | null;
  throwProject?: boolean;
} = {}) {
  const calls: string[] = [];
  const db = {
    project: {
      async findUnique() {
        calls.push("project");
        if (options.throwProject) throw Error("DB offline");
        return options.project === undefined ? project : options.project;
      },
    },
    async $queryRaw() {
      calls.push("row_lock");
      const id = options.lockId === undefined ? "verified_1" : options.lockId;
      return id ? [{ id }] : [];
    },
    verifiedContractExecution: {
      async findFirst() { calls.push("verified_proof"); return options.proof === undefined ? proof : options.proof; },
    },
  };
  return { db, calls };
}

test("mode defaults to shadow for migration, permits only shadow/enforce", () => {
  assert.equal(resolveVerifiedEscrowMode({}), "shadow");
  assert.equal(resolveVerifiedEscrowMode({ SEMSE_VERIFIED_ESCROW_MODE: "enforce" }), "enforce");
  assert.throws(() => resolveVerifiedEscrowMode({ SEMSE_VERIFIED_ESCROW_MODE: "off" }), /must be shadow or enforce/);
});

test("enforce allows deposit and release only for an independently promoted scoped proof", async () => {
  for (const operation of ["deposit", "release"] as const) {
    const h = harness();
    await assert.doesNotReject(() => assertVerifiedEscrowReservation(h.db as never, "project_a", operation,
      { SEMSE_VERIFIED_ESCROW_MODE: "enforce" }));
    assert.deepEqual(h.calls, ["project", "row_lock", "verified_proof"]);
  }
});

test("enforce blocks missing or legacy-only contract before any funding or release", async () => {
  for (const projectOverride of [
    null,
    { ...project, job: { ...project.job, contract: null } },
    { ...project, job: { ...project.job, contract: { ...project.job.contract, canonicalPdfSha256: null,
      signedClientAt: new Date(), signedProAt: new Date() } } },
    { ...project, job: { ...project.job, deletedAt: new Date() } },
  ]) {
    const h = harness({ project: projectOverride });
    await assert.rejects(() => assertVerifiedEscrowReservation(h.db as never, "project_a", "release",
      { SEMSE_VERIFIED_ESCROW_MODE: "enforce" }), /non-legacy|immutable original/);
    assert.ok(!h.calls.includes("verified_proof"));
  }
});

test("enforce refuses revoked, quarantined, mismatched identity and incomplete certificates", async () => {
  for (const altered of [
    { status: "REVOKED" }, { status: "QUARANTINED" },
    { tenantId: "other_tenant" }, { clientUserId: "fake" },
    { documentVersionSha256: "f".repeat(64) },
    { signedPdfSha256: "not-a-hash" }, { auditLogSha256: "" },
    { authorizedPolicyDecisionId: "" }, { consentVerifiedAt: new Date("invalid") },
    { cryptographicVerifiedAt: new Date("2026-10-02T00:00:00Z") },
  ]) {
    const h = harness({ proof: { ...proof, ...altered } });
    await assert.rejects(() => assertVerifiedEscrowReservation(h.db as never, "project_a", "release",
      { SEMSE_VERIFIED_ESCROW_MODE: "enforce" }), /escrow requires/);
  }
});

test("enforce refuses a missing row lock even if proof lookup would be valid", async () => {
  const h = harness({ lockId: null });
  await assert.rejects(() => assertVerifiedEscrowReservation(h.db as never, "project_a", "deposit",
    { SEMSE_VERIFIED_ESCROW_MODE: "enforce" }), /currently verified/);
  assert.ok(!h.calls.includes("verified_proof"));
});

test("shadow observes but cannot claim enforce mode; DB errors block enforce", async () => {
  const broken = harness({ throwProject: true });
  await assert.doesNotReject(() => assertVerifiedEscrowReservation(broken.db as never, "project_a", "deposit",
    { SEMSE_VERIFIED_ESCROW_MODE: "shadow" }));
  await assert.rejects(() => assertVerifiedEscrowReservation(broken.db as never, "project_a", "release",
    { SEMSE_VERIFIED_ESCROW_MODE: "enforce" }), /DB offline/);
});
