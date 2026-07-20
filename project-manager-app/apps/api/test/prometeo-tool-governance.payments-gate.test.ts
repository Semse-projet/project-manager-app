import test from "node:test";
import assert from "node:assert/strict";
import { ConflictException } from "@nestjs/common";
import { PrometeoToolExecutionService } from "../dist/modules/prometeo/prometeo-tool-execution.service.js";

// F2-D: the hybrid payments gate. Gate 1 (this file) is "can this actor/session
// propose and get this approved at all" — PrometeoProposedAction. Gate 2 is
// PaymentsService.release()'s own invariants (contract signed, milestone
// APPROVED, no open dispute, sufficient balance), which these tests fake as a
// black box on purpose: F2 must never re-implement or bypass those checks,
// only call through to them under the approver's identity.

type FakeProposal = {
  id: string;
  tenantId: string;
  orgId: string;
  actorId: string;
  actorRoles: string[];
  namespace: string;
  name: string;
  approvalPolicy: string;
  status: "AWAITING_APPROVAL" | "APPROVED" | "REJECTED" | "BLOCKED" | "EXECUTED";
  inputJson: unknown;
  resultJson: unknown;
};

function makePaymentsProposal(overrides: Partial<FakeProposal> = {}): FakeProposal {
  return {
    id: "action_1",
    tenantId: "tenant_1",
    orgId: "org_1",
    actorId: "proposer_1",
    actorRoles: ["CLIENT"],
    namespace: "payments",
    name: "propose_release",
    approvalPolicy: "human_required",
    status: "AWAITING_APPROVAL",
    inputJson: { milestoneId: "milestone_1", amount: 500 },
    resultJson: null,
    ...overrides,
  };
}

function makeFakeGovernance(initial: FakeProposal) {
  const store = new Map<string, FakeProposal>([[initial.id, { ...initial }]]);
  return {
    async findProposedAction({ id }: { id: string }) {
      const found = store.get(id);
      return found ? { ...found } : null;
    },
    // Mirrors ToolGovernanceRepository.claimForApproval's atomic
    // check-and-set: only succeeds from AWAITING_APPROVAL, and — because
    // this runs with no `await` in the critical section — two calls racing
    // in the same Node tick can't both win, same as the real
    // `updateMany({ where: { status: "AWAITING_APPROVAL" } })`.
    async claimForApproval({ id, approvedBy }: { id: string; approvedBy: string }) {
      const proposal = store.get(id);
      if (!proposal || proposal.status !== "AWAITING_APPROVAL") return false;
      proposal.status = "APPROVED";
      void approvedBy;
      return true;
    },
    async markExecuted({ id, resultJson }: { id: string; resultJson: unknown }) {
      const proposal = store.get(id)!;
      proposal.status = "EXECUTED";
      proposal.resultJson = resultJson;
    },
    async markBlocked({ id, reason }: { id: string; reason: string }) {
      const proposal = store.get(id)!;
      proposal.status = "BLOCKED";
      proposal.resultJson = { error: reason };
    },
    async reject({ id, reason }: { id: string; rejectedBy: string; reason: string }) {
      const proposal = store.get(id);
      if (!proposal || proposal.status !== "AWAITING_APPROVAL") return false;
      proposal.status = "REJECTED";
      void reason;
      return true;
    },
    _store: store,
  };
}

function makePayments(release: (input: Record<string, unknown>) => unknown) {
  const calls: Array<Record<string, unknown>> = [];
  return {
    payments: {
      async release(input: Record<string, unknown>) {
        calls.push(input);
        return release(input);
      },
    },
    calls,
  };
}

function makeService(governance: ReturnType<typeof makeFakeGovernance>, payments: unknown) {
  return new PrometeoToolExecutionService(
    {} as never,
    {} as never,
    {} as never,
    {} as never,
    {} as never,
    {} as never,
    {} as never,
    governance as never,
    { append: async () => {} } as never,
    payments as never,
  );
}

const approver = { tenantId: "tenant_1", orgId: "org_1", userId: "approver_1", roles: ["OPS_ADMIN"] };

test("T-041: approving a payments proposal executes under the approver's identity, not the proposer's", async () => {
  const governance = makeFakeGovernance(makePaymentsProposal());
  const { payments, calls } = makePayments(() => ({ transaction: { id: "txn_1" } }));
  const service = makeService(governance, payments);

  const result = await service.approveProposedAction(approver as never, "req_1", "action_1");

  assert.equal(calls.length, 1);
  assert.equal(calls[0]?.userId, "approver_1");
  assert.deepEqual(calls[0]?.roles, ["OPS_ADMIN"]);
  assert.equal(calls[0]?.milestoneId, "milestone_1");
  assert.equal(calls[0]?.amount, 500);
  assert.equal(result.status, "EXECUTED");
});

test("T-040: a payments proposal cannot be self-approved, even by an OPS_ADMIN proposer", async () => {
  const governance = makeFakeGovernance(makePaymentsProposal({ actorId: "same_user", actorRoles: ["OPS_ADMIN"] }));
  const { payments, calls } = makePayments(() => ({ transaction: { id: "txn_1" } }));
  const service = makeService(governance, payments);

  await assert.rejects(
    () => service.approveProposedAction({ tenantId: "tenant_1", orgId: "org_1", userId: "same_user", roles: ["OPS_ADMIN"] } as never, "req_1", "action_1"),
    /cannot be approved or rejected by its own proposer/,
  );
  assert.equal(calls.length, 0, "PaymentsService.release must never be called when self-approval is rejected");
});

test("T-042: rejecting a payments proposal never calls PaymentsService and leaves a clean terminal state", async () => {
  const governance = makeFakeGovernance(makePaymentsProposal());
  const { payments, calls } = makePayments(() => ({ transaction: { id: "txn_1" } }));
  const service = makeService(governance, payments);

  const result = await service.rejectProposedAction(approver as never, "req_1", "action_1", "budget not approved yet");

  assert.equal(calls.length, 0, "PaymentsService.release must never be called on reject");
  assert.equal(result.status, "REJECTED");
  assert.equal(governance._store.get("action_1")?.status, "REJECTED");
});

test("T-043: an invariant failure in PaymentsService.release() propagates and leaves the proposal BLOCKED, not silently EXECUTED", async () => {
  const governance = makeFakeGovernance(makePaymentsProposal());
  const financialError = new ConflictException("escrow release is blocked while an open dispute exists");
  const { payments, calls } = makePayments(() => {
    throw financialError;
  });
  const service = makeService(governance, payments);

  await assert.rejects(
    () => service.approveProposedAction(approver as never, "req_1", "action_1"),
    (error: unknown) => error === financialError,
  );

  assert.equal(calls.length, 1, "the real financial gate must still have been called, not skipped");
  const stored = governance._store.get("action_1");
  assert.equal(stored?.status, "BLOCKED");
  assert.match(String((stored?.resultJson as { error?: string } | null)?.error), /open dispute/);
});

test("T-044: two concurrent approvals of the same proposal execute the release exactly once", async () => {
  const governance = makeFakeGovernance(makePaymentsProposal());
  const { payments, calls } = makePayments(() => ({ transaction: { id: "txn_1" } }));
  const service = makeService(governance, payments);

  const [first, second] = await Promise.allSettled([
    service.approveProposedAction(approver as never, "req_1", "action_1"),
    service.approveProposedAction(approver as never, "req_2", "action_1"),
  ]);

  const outcomes = [first, second];
  const fulfilled = outcomes.filter((o) => o.status === "fulfilled");
  const rejected = outcomes.filter((o) => o.status === "rejected");

  assert.equal(fulfilled.length, 1, "exactly one concurrent approval should win the claim");
  assert.equal(rejected.length, 1, "the losing approval must fail, not silently no-op");
  assert.ok(
    rejected[0]?.status === "rejected" && rejected[0].reason instanceof ConflictException,
    "the losing approval must fail with the same 'not awaiting approval' conflict as any late double-approve",
  );
  assert.equal(calls.length, 1, "PaymentsService.release must execute exactly once, never twice, under a race");
});
