/**
 * DOMAIN_INVARIANTS.md: a Job must not reach COMPLETED while its operational and
 * financial closure is open (STATE_MACHINES.md: milestones resolved, no funds held
 * in escrow), nor CANCELLED with escrow it has no closing policy for, and an open
 * dispute blocks the final close. Once jobs:transition let clients reach the
 * transition route, both terminal states had to be guarded (Codex review on #1111).
 */
import test from "node:test";
import assert from "node:assert/strict";
import { ConflictException } from "@nestjs/common";
import { JobsService, jobClosureBlockers } from "../dist/modules/jobs/jobs.service.js";

type Txn = { type: string; status: string; amount: number };

function service(state: { from: string; milestones?: string[]; transactions?: Txn[]; activeDisputes?: number }) {
  const updates: Array<{ status: string }> = [];
  const seen: Array<{ model: string; where: Record<string, unknown> }> = [];
  const job = (status: string) => ({ id: "job_1", tenantId: "tenant_1", status, title: "Trabajo", scope: "Alcance", category: "general" });
  const repository = {
    async findById() { return job(state.from); },
    async getTransitionAccess() { return { clientOrgId: "org_client_1", professionalOrgId: "org_pro_1" }; },
    async updateStatus(input: { status: string }) { updates.push(input); return job(input.status); },
  };
  const prisma = {
    milestone: {
      async findMany(args: { where: Record<string, unknown> }) {
        seen.push({ model: "milestone", where: args.where });
        return (state.milestones ?? []).map((status) => ({ status }));
      },
    },
    paymentEscrow: {
      async findMany(args: { where: Record<string, unknown> }) {
        seen.push({ model: "paymentEscrow", where: args.where });
        const transactions = state.transactions ?? [];
        return transactions.length ? [{ transactions }] : [];
      },
    },
    dispute: {
      async count(args: { where: Record<string, unknown> }) {
        seen.push({ model: "dispute", where: args.where });
        return state.activeDisputes ?? 0;
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
const clear = { milestoneStatuses: [] as string[], escrowTransactions: [] as Txn[], activeDisputes: 0 };

test("jobClosureBlockers: resolved milestones, a settled escrow and no open dispute have no blockers", () => {
  assert.deepEqual(jobClosureBlockers("completed", { ...clear, milestoneStatuses: ["APPROVED", "PAID"], escrowTransactions: [deposit(500), release(300), refund(200)] }), []);
  assert.deepEqual(jobClosureBlockers("completed", clear), []);
  assert.deepEqual(jobClosureBlockers("cancelled", { ...clear, escrowTransactions: [deposit(500), refund(500)] }), []);
});

test("jobClosureBlockers: open milestones, held funds and open disputes are reported", () => {
  assert.deepEqual(
    jobClosureBlockers("completed", { milestoneStatuses: ["APPROVED", "SUBMITTED", "DRAFT"], escrowTransactions: [deposit(500), release(100)], activeDisputes: 1 }),
    ["2 milestone(s) not approved", "escrow still holds 400", "1 dispute(s) still open"],
  );
  // Pending or failed transactions are not settled money.
  assert.deepEqual(jobClosureBlockers("completed", { ...clear, escrowTransactions: [deposit(500), { type: "RELEASE", status: "PENDING", amount: 500 }] }), ["escrow still holds 500"]);
  assert.deepEqual(jobClosureBlockers("completed", { ...clear, escrowTransactions: [{ type: "DEPOSIT", status: "FAILED", amount: 500 }] }), []);
  // Cancelling does not require approved milestones, only no held funds and no open dispute.
  assert.deepEqual(jobClosureBlockers("cancelled", { milestoneStatuses: ["DRAFT"], escrowTransactions: [deposit(300)], activeDisputes: 2 }), ["escrow still holds 300", "2 dispute(s) still open"]);
});

test("a client cannot complete a job in review while a milestone is pending", async () => {
  const { transition, updates } = service({ from: "review", milestones: ["APPROVED", "SUBMITTED"] });
  await assert.rejects(transition("completed"), (error: unknown) => error instanceof ConflictException && /milestone/.test((error as Error).message));
  assert.equal(updates.length, 0);
});

test("a client cannot complete a job while escrow still holds funds", async () => {
  const { transition, updates } = service({ from: "review", milestones: ["APPROVED"], transactions: [deposit(500), release(200)] });
  await assert.rejects(transition("completed"), /escrow still holds 300/);
  assert.equal(updates.length, 0);
});

test("a client cannot complete a job while its project has an open dispute", async () => {
  const { transition, updates } = service({ from: "review", milestones: ["APPROVED"], transactions: [deposit(500), release(500)], activeDisputes: 1 });
  await assert.rejects(transition("completed"), /dispute\(s\) still open/);
  assert.equal(updates.length, 0);
});

test("a client cannot cancel an accepted job while escrow still holds funds", async () => {
  const { transition, updates } = service({ from: "accepted", transactions: [deposit(400)] });
  await assert.rejects(transition("cancelled"), /job cannot be cancelled: escrow still holds 400/);
  assert.equal(updates.length, 0);
});

test("ops admins are held to the same closure rules", async () => {
  await assert.rejects(service({ from: "dispute", milestones: ["REJECTED"] }).transition("completed", ["OPS_ADMIN"], "org_ops_1"), ConflictException);
  await assert.rejects(service({ from: "dispute", activeDisputes: 1 }).transition("cancelled", ["OPS_ADMIN"], "org_ops_1"), ConflictException);
});

test("completion and cancellation go through once the closure allows them", async () => {
  const done = service({ from: "review", milestones: ["APPROVED", "PAID"], transactions: [deposit(500), release(500)] });
  assert.equal((await done.transition("completed")).status, "completed");
  assert.deepEqual(done.updates.map((u) => u.status), ["completed"]);
  // Every lookup is scoped to the job's projects in the actor's tenant.
  for (const { where } of done.seen) assert.deepEqual(where.project, { jobId: "job_1", tenantId: "tenant_1" });
  assert.deepEqual(done.seen.find((s) => s.model === "dispute")?.where.status, { in: ["OPEN", "ASSIGNED", "UNDER_REVIEW"] });

  const cancelled = service({ from: "accepted", milestones: ["DRAFT"], transactions: [deposit(400), refund(400)] });
  assert.equal((await cancelled.transition("cancelled")).status, "cancelled");
  assert.equal(cancelled.seen.some((s) => s.model === "milestone"), false);
});

test("other transitions do not run the closure check", async () => {
  const { transition, seen } = service({ from: "in_progress", milestones: ["DRAFT"], transactions: [deposit(500)], activeDisputes: 1 });
  await transition("review", ["PRO"], "org_pro_1");
  assert.equal(seen.length, 0);
});
