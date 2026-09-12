import test from "node:test";
import assert from "node:assert/strict";
import { NotFoundException } from "@nestjs/common";
import { PaymentGovernanceService } from "../dist/modules/payment-governance/payment-governance.service.js";

// F02a (SEMSEproject_Auditoria_2026-09-11.md): PaymentGovernanceRepository.getEscrow
// used to be `where: { id }` only — any tenant could read/release/block another
// tenant's escrow by guessing its id. getEscrow now requires tenantId and is
// scoped via `project: { tenantId }`; these tests exercise that boundary
// through the service, using a stub repository that mirrors the real
// tenant-scoped query.

const ESCROW = {
  id: "escrow_1",
  projectId: "proj_1",
  status: "PENDING_SETTLEMENT",
  tenantId: "tnt_owner", // stub-only field, not on the real Prisma row — used by makeRepo to scope
};

function makeRepo() {
  const calls = { updateEscrowStatus: [] as string[], createPaymentTransaction: [] as unknown[] };
  return {
    calls,
    async getEscrow(escrowId: string, tenantId: string) {
      if (escrowId !== ESCROW.id || tenantId !== ESCROW.tenantId) return null;
      return { id: ESCROW.id, projectId: ESCROW.projectId, status: ESCROW.status, transactions: [], project: { id: ESCROW.projectId, tenantId } };
    },
    async updateEscrowStatus(escrowId: string) {
      this.calls.updateEscrowStatus.push(escrowId);
      return { id: escrowId };
    },
    async createPaymentTransaction(input: Record<string, unknown>) {
      this.calls.createPaymentTransaction.push(input);
      return { id: "txn_1" };
    },
    async getMilestoneEvidence() { return [{ id: "ev_1", kind: "photo", validationStatus: "passed", aiQualityScore: 0.9 }]; },
    async countPendingChangeOrders() { return 0; },
    async logPaymentDecision() { /* no-op */ },
  } as never;
}

function makeService() {
  const repo = makeRepo();
  const diagnostics = {} as never;
  return { service: new PaymentGovernanceService(repo, diagnostics), repo };
}

test("blockPayment on another tenant's escrow throws NotFoundException and never mutates it", async () => {
  const { service, repo } = makeService();

  await assert.rejects(
    () => service.blockPayment("escrow_1", "suspected fraud", "usr_attacker", "tnt_other"),
    NotFoundException,
  );
  assert.equal((repo as unknown as { calls: { updateEscrowStatus: string[] } }).calls.updateEscrowStatus.length, 0);
});

test("blockPayment on the owning tenant's escrow succeeds", async () => {
  const { service } = makeService();

  const result = await service.blockPayment("escrow_1", "suspected fraud", "usr_admin", "tnt_owner");

  assert.equal(result.success, true);
});

test("releasePayment on another tenant's escrow throws NotFoundException and never creates a transaction", async () => {
  const { service, repo } = makeService();

  await assert.rejects(
    () => service.releasePayment({
      escrowId: "escrow_1", milestoneId: "ms_1", amount: 1000, reason: "milestone complete",
      releasedBy: "usr_attacker", tenantId: "tnt_other",
    }),
    NotFoundException,
  );
  assert.equal((repo as unknown as { calls: { createPaymentTransaction: unknown[] } }).calls.createPaymentTransaction.length, 0);
});

test("getPaymentHistory returns nothing for another tenant's escrow", async () => {
  const { service } = makeService();

  const result = await service.getPaymentHistory("escrow_1", "tnt_other");

  assert.equal(result, null);
});

test("getPaymentHistory returns the escrow for its own tenant", async () => {
  const { service } = makeService();

  const result = await service.getPaymentHistory("escrow_1", "tnt_owner");

  assert.equal(result?.id, "escrow_1");
});

test("calculatePaymentScore degrades to the not-found score for another tenant's escrow", async () => {
  const { service } = makeService();

  const score = await service.calculatePaymentScore("escrow_1", "ms_1", "tnt_other");

  assert.equal(score.riskLevel, "high");
});
