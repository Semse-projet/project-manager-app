/**
 * DOMAIN_INVARIANTS.md: a Job must not reach COMPLETED while its operational and
 * financial closure is open (STATE_MACHINES.md: milestones resolved, no funds held
 * in escrow). Once jobs:transition let clients reach the transition route, a client
 * could complete a job in review with milestones pending or money still in escrow,
 * which also unlocked ratings early.
 */
import test from "node:test";
import assert from "node:assert/strict";
import { ConflictException } from "@nestjs/common";
import { JobsService, jobCompletionBlockers } from "../dist/modules/jobs/jobs.service.js";

type Txn = { type: string; status: string; amount: number };

function service(state: { from: string; milestones: string[]; transactions: Txn[] }) {
  const updates: Array<{ status: string }> = [];
  const seen: Array<Record<string, unknown>> = [];
  const repository = {
    async findById(input: { jobId: string }) {
      return { id: input.jobId, tenantId: "tenant_1", status: state.from, title: "Trabajo", scope: "Alcance", category: "general" };
    },
    async getTransitionAccess() {
      return { clientOrgId: "org_client_1", professionalOrgId: "org_pro_1" };
    },
    async updateStatus(input: { jobId: string; status: string }) {
      updates.push(input);
      return { id: input.jobId, tenantId: "tenant_1", status: input.status, title: "Trabajo", scope: "Alcance", category: "general" };
    },
  };
  const prisma = {
    milestone: {
      async findMany(args: Record<string, unknown>) {
        seen.push(args);
        return state.milestones.map((status) => ({ status }));
      },
    },
    paymentEscrow: {
      async findMany(args: Record<string, unknown>) {
        seen.push(args);
        return state.transactions.length ? [{ transactions: state.transactions.map((t) => ({ ...t, amount: { toString: () => String(t.amount), valueOf: () => t.amount } })) }] : [];
      },
    },
    workspaceMemoryEntry: { async findMany() { return []; } },
  };
  const noop = { async append() { return undefined; }, async emit() { return undefined; } };
  const svc = new JobsService(repository as never, noop as never, noop as never, noop as never, prisma as never, undefined);
  const transition = (targetStatus: string, roles = ["CLIENT"], orgId = "org_client_1") =>
    svc.transitionJob({ tenantId: "tenant_1", orgId, userId: "usr_1", roles, jobId: "job_1", targetStatus: targetStatus as never, requestId: "req_1" });
  return { transition, updates, seen };
}

const deposit = (amount: number): Txn => ({ type: "DEPOSIT", status: "SUCCEEDED", amount });
const release = (amount: number): Txn => ({ type: "RELEASE", status: "SUCCEEDED", amount });
const refund = (amount: number): Txn => ({ type: "REFUND", status: "SUCCEEDED", amount });

test("jobCompletionBlockers: resolved milestones and a settled escrow have no blockers", () => {
  assert.deepEqual(jobCompletionBlockers({ milestoneStatuses: ["APPROVED", "PAID"], escrowTransactions: [deposit(500), release(300), refund(200)] }), []);
  assert.deepEqual(jobCompletionBlockers({ milestoneStatuses: [], escrowTransactions: [] }), []);
});

test("jobCompletionBlockers: open milestones and held funds are reported", () => {
  assert.deepEqual(
    jobCompletionBlockers({ milestoneStatuses: ["APPROVED", "SUBMITTED", "DRAFT"], escrowTransactions: [deposit(500), release(100)] }),
    ["2 milestone(s) not approved", "escrow still holds 400"],
  );
  // Pending or failed transactions do not count as settled money.
  assert.deepEqual(
    jobCompletionBlockers({ milestoneStatuses: [], escrowTransactions: [deposit(500), { type: "RELEASE", status: "PENDING", amount: 500 }] }),
    ["escrow still holds 500"],
  );
  assert.deepEqual(
    jobCompletionBlockers({ milestoneStatuses: [], escrowTransactions: [{ type: "DEPOSIT", status: "FAILED", amount: 500 }] }),
    [],
  );
});

test("a client cannot complete a job in review while a milestone is pending", async () => {
  const { transition, updates } = service({ from: "review", milestones: ["APPROVED", "SUBMITTED"], transactions: [] });
  await assert.rejects(transition("completed"), (error: unknown) => error instanceof ConflictException && /milestone/.test((error as Error).message));
  assert.equal(updates.length, 0);
});

test("a client cannot complete a job while escrow still holds funds", async () => {
  const { transition, updates } = service({ from: "review", milestones: ["APPROVED"], transactions: [deposit(500), release(200)] });
  await assert.rejects(transition("completed"), /escrow still holds 300/);
  assert.equal(updates.length, 0);
});

test("ops admins are held to the same closure rule", async () => {
  const { transition } = service({ from: "dispute", milestones: ["REJECTED"], transactions: [] });
  await assert.rejects(transition("completed", ["OPS_ADMIN"], "org_ops_1"), ConflictException);
});

test("completion goes through once milestones are resolved and the escrow is settled", async () => {
  const { transition, updates, seen } = service({ from: "review", milestones: ["APPROVED", "PAID"], transactions: [deposit(500), release(500)] });
  const updated = await transition("completed");
  assert.equal(updated.status, "completed");
  assert.deepEqual(updates.map((u) => u.status), ["completed"]);
  // Both lookups are scoped to the job's projects in the actor's tenant.
  for (const args of seen) assert.deepEqual((args as { where: { project: unknown } }).where.project, { jobId: "job_1", tenantId: "tenant_1" });
});

test("other transitions do not run the closure check", async () => {
  const { transition, seen } = service({ from: "in_progress", milestones: ["DRAFT"], transactions: [deposit(500)] });
  await transition("review", ["PRO"], "org_pro_1");
  assert.equal(seen.length, 0);
});
