import test from "node:test";
import assert from "node:assert/strict";
import { PaymentsRepository } from "../dist/modules/payments/payments.repository.js";

/**
 * #827: fail-closed regression at the real reservation repository boundary.
 *
 * These tests deliberately use no provider, live money or real signatures.
 * They prove that missing, revoked, mismatched or unavailable contract
 * evidence prevents a PENDING reservation before either financial path can
 * reach provider-side effects. They do NOT certify an end-to-end payment.
 */

const canonicalPdfSha256 = "a".repeat(64);
const canonicalProject = {
  tenantId: "tenant_a",
  job: {
    tenantId: "tenant_a",
    deletedAt: null,
    contract: {
      id: "contract_a",
      deletedAt: null,
      clientUserId: "client_a",
      professionalUserId: "pro_a",
      canonicalPdfSha256,
    },
  },
};

const validProof = {
  id: "verified_1",
  tenantId: "tenant_a",
  contractId: "contract_a",
  connectionId: "connection_a",
  documentVersionSha256: canonicalPdfSha256,
  clientUserId: "client_a",
  professionalUserId: "pro_a",
  providerId: "documenso",
  externalRequestId: "envelope_1",
  signedPdfSha256: "b".repeat(64),
  certificateSha256: "c".repeat(64),
  auditLogSha256: "d".repeat(64),
  signedPdfRef: "private/pdf",
  certificateRef: "private/certificate",
  auditLogRef: "private/audit",
  authorizedPolicyDecisionId: "policy_1",
  consentVerifiedAt: new Date("2026-10-01T12:00:00Z"),
  cryptographicVerifiedAt: new Date("2026-10-01T12:05:00Z"),
  verifiedAt: new Date("2026-10-01T12:06:00Z"),
  status: "VERIFIED_EXECUTED",
};

type Scenario = {
  label: string;
  lockIds?: Array<{ id: string }>;
  proof?: unknown;
  projectError?: boolean;
  lockError?: boolean;
  expectedGateCalls: string[];
};

const cases: Scenario[] = [
  {
    label: "no verified row is locked",
    lockIds: [],
    expectedGateCalls: ["project", "row_lock"],
  },
  {
    label: "locked row disappears before verified proof read",
    lockIds: [{ id: "verified_1" }],
    proof: null,
    expectedGateCalls: ["project", "row_lock", "proof_read"],
  },
  {
    label: "a revoked proof cannot authorize money",
    lockIds: [{ id: "verified_1" }],
    proof: { ...validProof, status: "REVOKED" },
    expectedGateCalls: ["project", "row_lock", "proof_read"],
  },
  {
    label: "cross-tenant proof cannot authorize money",
    lockIds: [{ id: "verified_1" }],
    proof: { ...validProof, tenantId: "another_tenant" },
    expectedGateCalls: ["project", "row_lock", "proof_read"],
  },
  {
    label: "different original PDF version cannot authorize money",
    lockIds: [{ id: "verified_1" }],
    proof: { ...validProof, documentVersionSha256: "f".repeat(64) },
    expectedGateCalls: ["project", "row_lock", "proof_read"],
  },
  {
    label: "contract database lookup is unavailable",
    projectError: true,
    expectedGateCalls: ["project"],
  },
  {
    label: "verified-row lock query fails",
    lockError: true,
    expectedGateCalls: ["project", "row_lock"],
  },
];

function setup(scenario: Scenario) {
  const calls: string[] = [];
  const afterGate: string[] = [];
  const tx = {
    project: {
      async findUnique() {
        calls.push("project");
        if (scenario.projectError) throw new Error("contract database unavailable");
        return canonicalProject;
      },
    },
    async $queryRaw() {
      calls.push("row_lock");
      if (scenario.lockError) throw new Error("verified-row lock unavailable");
      return scenario.lockIds ?? [];
    },
    verifiedContractExecution: {
      async findFirst() {
        calls.push("proof_read");
        return scenario.proof === undefined ? validProof : scenario.proof;
      },
    },
    paymentEscrow: {
      async findUnique() {
        calls.push("escrow_lookup");
        return { id: "escrow_a", projectId: "project_a", deletedAt: null };
      },
      async findFirst() {
        afterGate.push("escrow_find");
        return null;
      },
      async create() {
        afterGate.push("escrow_create");
        throw new Error("money reservation must be blocked");
      },
      async update() {
        afterGate.push("escrow_update");
        throw new Error("money reservation must be blocked");
      },
    },
    paymentTxn: {
      async aggregate() {
        afterGate.push("balance_check");
        return { _sum: { amount: null } };
      },
      async findFirst() {
        afterGate.push("active_release_check");
        return null;
      },
      async create() {
        afterGate.push("payment_transaction_create");
        throw new Error("money reservation must be blocked");
      },
    },
  };
  const prisma = {
    async $transaction(
      fn: (client: unknown) => Promise<unknown>,
      options: { isolationLevel?: string },
    ) {
      assert.equal(options.isolationLevel, "Serializable");
      return fn(tx);
    },
  };
  return {
    repository: new PaymentsRepository(prisma as never, {} as never),
    calls,
    afterGate,
  };
}

for (const flow of ["deposit", "release"] as const) {
  for (const scenario of cases) {
    test(`enforce ${flow} rejects ${scenario.label} before money reservation`, async () => {
      const previous = process.env.SEMSE_VERIFIED_ESCROW_MODE;
      process.env.SEMSE_VERIFIED_ESCROW_MODE = "enforce";
      try {
        const { repository, calls, afterGate } = setup(scenario);
        const operation = flow === "deposit"
          ? repository.depositFunds({
              projectId: "project_a",
              contractId: "contract_a",
              jobId: "job_a",
              currency: "USD",
              amount: 100,
              providerRef: "pending_deposit_a",
            })
          : repository.releaseFunds({
              escrowId: "escrow_a",
              milestoneId: "milestone_a",
              amount: 100,
              providerRef: "pending_release_a",
            });
        await assert.rejects(operation);
        assert.deepEqual(
          calls,
          flow === "release"
            ? ["escrow_lookup", ...scenario.expectedGateCalls]
            : scenario.expectedGateCalls,
        );
        assert.deepEqual(afterGate, [], "financial reads/writes must not run after rejected proof");
      } finally {
        if (previous === undefined) delete process.env.SEMSE_VERIFIED_ESCROW_MODE;
        else process.env.SEMSE_VERIFIED_ESCROW_MODE = previous;
      }
    });
  }
}
