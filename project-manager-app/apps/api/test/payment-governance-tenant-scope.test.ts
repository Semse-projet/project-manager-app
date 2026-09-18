import test from "node:test";
import assert from "node:assert/strict";
import { ForbiddenException, NotFoundException } from "@nestjs/common";
import { PaymentGovernanceService } from "../dist/modules/payment-governance/payment-governance.service.js";

// F02a (SEMSEproject_Auditoria_2026-09-11.md): PaymentGovernanceRepository.getEscrow
// used to be `where: { id }` only — any tenant could read/release/block another
// tenant's escrow by guessing its id. getEscrow now requires tenantId and is
// scoped via `project: { tenantId }`; these tests exercise that boundary
// through the service, using a stub repository that mirrors the real
// tenant-scoped query.
//
// WS-01C G1 (2026-09-18): tenantId scoping alone was not enough — a `Tenant`
// can own several `Org`s (e.g. a client org and a pro org sharing one
// tenant), and getEscrow never checked which org an escrow's project
// actually belongs to. An actor with finance:* permission in one org of a
// tenant could act on another org's escrow in the same tenant. getEscrow now
// also selects the project's `assignedProOrgId`/`job.clientOrgId`, and the
// service asserts the actor's orgId is one of the two before proceeding
// (same resource-derived-authorization rule as milestones.policy.ts's
// assertMilestoneReadable — see ADR-040).

const ESCROW = {
  id: "escrow_1",
  projectId: "proj_1",
  status: "PENDING_SETTLEMENT",
  tenantId: "tnt_owner", // stub-only field, not on the real Prisma row — used by makeRepo to scope
  clientOrgId: "org_client",
  assignedProOrgId: "org_pro",
};

function actor(orgId: string, roles: string[] = []) {
  return { tenantId: "tnt_owner", orgId, userId: "usr_test", roles };
}

function makeRepo() {
  const calls = { updateEscrowStatus: [] as string[], createPaymentTransaction: [] as unknown[] };
  return {
    calls,
    async getEscrow(escrowId: string, tenantId: string) {
      if (escrowId !== ESCROW.id || tenantId !== ESCROW.tenantId) return null;
      return {
        id: ESCROW.id,
        projectId: ESCROW.projectId,
        status: ESCROW.status,
        transactions: [],
        project: {
          id: ESCROW.projectId,
          tenantId,
          assignedProOrgId: ESCROW.assignedProOrgId,
          job: { clientOrgId: ESCROW.clientOrgId },
        },
      };
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
    () => service.blockPayment("escrow_1", "suspected fraud", "usr_attacker", "tnt_other", actor("org_client")),
    NotFoundException,
  );
  assert.equal((repo as unknown as { calls: { updateEscrowStatus: string[] } }).calls.updateEscrowStatus.length, 0);
});

test("blockPayment from a different org in the SAME tenant is denied and never mutates the escrow", async () => {
  const { service, repo } = makeService();

  await assert.rejects(
    () => service.blockPayment("escrow_1", "suspected fraud", "usr_attacker", "tnt_owner", actor("org_other")),
    ForbiddenException,
  );
  assert.equal((repo as unknown as { calls: { updateEscrowStatus: string[] } }).calls.updateEscrowStatus.length, 0);
});

test("blockPayment on the owning tenant's escrow succeeds for the client org", async () => {
  const { service } = makeService();

  const result = await service.blockPayment("escrow_1", "suspected fraud", "usr_admin", "tnt_owner", actor("org_client"));

  assert.equal(result.success, true);
});

test("blockPayment succeeds for the assigned pro org too", async () => {
  const { service } = makeService();

  const result = await service.blockPayment("escrow_1", "suspected fraud", "usr_pro", "tnt_owner", actor("org_pro"));

  assert.equal(result.success, true);
});

test("blockPayment succeeds for OPS_ADMIN regardless of org", async () => {
  const { service } = makeService();

  const result = await service.blockPayment("escrow_1", "suspected fraud", "usr_admin", "tnt_owner", actor("org_other", ["OPS_ADMIN"]));

  assert.equal(result.success, true);
});

test("releasePayment on another tenant's escrow throws NotFoundException and never creates a transaction", async () => {
  const { service, repo } = makeService();

  await assert.rejects(
    () => service.releasePayment({
      escrowId: "escrow_1", milestoneId: "ms_1", amount: 1000, reason: "milestone complete",
      releasedBy: "usr_attacker", tenantId: "tnt_other",
    }, actor("org_client")),
    NotFoundException,
  );
  assert.equal((repo as unknown as { calls: { createPaymentTransaction: unknown[] } }).calls.createPaymentTransaction.length, 0);
});

test("releasePayment from a different org in the same tenant is denied before the disabled-release check", async () => {
  const { service, repo } = makeService();

  await assert.rejects(
    () => service.releasePayment({
      escrowId: "escrow_1", milestoneId: "ms_1", amount: 1000, reason: "milestone complete",
      releasedBy: "usr_attacker", tenantId: "tnt_owner",
    }, actor("org_other")),
    ForbiddenException,
  );
  assert.equal((repo as unknown as { calls: { createPaymentTransaction: unknown[] } }).calls.createPaymentTransaction.length, 0);
});

test("getPaymentHistory returns nothing for another tenant's escrow", async () => {
  const { service } = makeService();

  const result = await service.getPaymentHistory("escrow_1", "tnt_other", actor("org_client"));

  assert.equal(result, null);
});

test("getPaymentHistory denies a different org in the same tenant", async () => {
  const { service } = makeService();

  await assert.rejects(
    () => service.getPaymentHistory("escrow_1", "tnt_owner", actor("org_other")),
    ForbiddenException,
  );
});

test("getPaymentHistory returns the escrow for its own org", async () => {
  const { service } = makeService();

  const result = await service.getPaymentHistory("escrow_1", "tnt_owner", actor("org_client"));

  assert.equal(result?.id, "escrow_1");
});

test("calculatePaymentScore degrades to the not-found score for another tenant's escrow", async () => {
  const { service } = makeService();

  const score = await service.calculatePaymentScore("escrow_1", "ms_1", "tnt_other", actor("org_client"));

  assert.equal(score.riskLevel, "high");
});

test("calculatePaymentScore denies a different org in the same tenant instead of returning a score", async () => {
  const { service } = makeService();

  await assert.rejects(
    () => service.calculatePaymentScore("escrow_1", "ms_1", "tnt_owner", actor("org_other")),
    ForbiddenException,
  );
});
