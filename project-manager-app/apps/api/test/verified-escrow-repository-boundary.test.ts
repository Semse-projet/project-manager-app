import test from "node:test";
import assert from "node:assert/strict";
import { PaymentsRepository } from "../dist/modules/payments/payments.repository.js";

/**
 * Exercises the ACTUAL transactional money reservation methods rather than a
 * unit-only helper. With enforce on, no PENDING txn / provider ref can exist
 * unless the canonical contract has independent evidence.
 */
test("enforce blocks direct/project escrow deposit BEFORE any financial rows are written", async () => {
  const previous = process.env.SEMSE_VERIFIED_ESCROW_MODE;
  process.env.SEMSE_VERIFIED_ESCROW_MODE = "enforce";
  try {
    const writes: string[] = [];
    const tx = {
      project: { async findUnique() { return null; } },
      paymentEscrow: {
        async findFirst() { writes.push("escrow_find"); return null; },
        async create() { writes.push("escrow_create"); return {}; },
        async update() { writes.push("escrow_update"); return {}; },
      },
      paymentTxn: {
        async create() { writes.push("deposit_reservation"); return {}; },
      },
    };
    const prisma = { async $transaction(fn: (tx: unknown) => Promise<unknown>, options: unknown) {
      assert.equal((options as any)?.isolationLevel, "Serializable");
      return fn(tx);
    } };
    const subject = new PaymentsRepository(prisma as never, {} as never);
    await assert.rejects(subject.depositFunds({
      projectId: "project_a", contractId: "legacy_contract", jobId: "job_a",
      currency: "USD", amount: 20, providerRef: "pending_provider_ref",
    }), /immutable original/);
    assert.deepEqual(writes, []);
  } finally {
    if (previous === undefined) delete process.env.SEMSE_VERIFIED_ESCROW_MODE;
    else process.env.SEMSE_VERIFIED_ESCROW_MODE = previous;
  }
});

test("enforce blocks automatic AND manual escrow release before reserving money", async () => {
  const previous = process.env.SEMSE_VERIFIED_ESCROW_MODE;
  process.env.SEMSE_VERIFIED_ESCROW_MODE = "enforce";
  try {
    const calls: string[] = [];
    const tx = {
      project: { async findUnique() { calls.push("proof_project"); return null; } },
      paymentEscrow: { async findUnique() {
        calls.push("escrow_lookup"); return { id: "escrow_1", projectId: "project_a", deletedAt: null };
      } },
      paymentTxn: {
        async aggregate() { calls.push("money_check"); return { _sum: { amount: null } }; },
        async create() { calls.push("release_reservation"); return {}; },
      },
    };
    const prisma = { async $transaction(fn: (tx: unknown) => Promise<unknown>, options: unknown) {
      assert.equal((options as any)?.isolationLevel, "Serializable");
      return fn(tx);
    } };
    const subject = new PaymentsRepository(prisma as never, {} as never);
    await assert.rejects(subject.releaseFunds({
      escrowId: "escrow_1", milestoneId: "m1", amount: 10,
      providerRef: "pending_auto_release",
    }), /immutable original/);
    assert.deepEqual(calls, ["escrow_lookup", "proof_project"]);
  } finally {
    if (previous === undefined) delete process.env.SEMSE_VERIFIED_ESCROW_MODE;
    else process.env.SEMSE_VERIFIED_ESCROW_MODE = previous;
  }
});


test("deposit conflict retries a bounded Serializable reservation and surfaces closed job as 409", async () => {
  let attempts = 0;
  const prisma = {
    async $transaction() {
      attempts++;
      if (attempts === 1) throw Object.assign(new Error("serialization failure"), { code: "P2034" });
      // The retried transaction sees the cancellation through lockOpenJobForFunding.
      const { ConflictException } = await import("@nestjs/common");
      throw new ConflictException("cannot fund escrow: job is cancelled");
    },
  };
  const repository = new PaymentsRepository(prisma as never, {} as never);
  await assert.rejects(repository.depositFunds({
    projectId: "project_1", jobId: "job_1", currency: "USD", amount: 200, providerRef: "local_test",
  }), (error: unknown) =>
    typeof (error as any)?.getStatus === "function" && (error as any).getStatus() === 409
      && /job is cancelled/.test((error as Error).message));
  assert.equal(attempts, 2);
});

test("deposit serialization conflicts are bounded to three attempts, then fail with 409", async () => {
  let attempts = 0;
  const repository = new PaymentsRepository({
    async $transaction() {
      attempts++;
      throw Object.assign(new Error("serialization failure"), { code: "P2034" });
    },
  } as never, {} as never);
  await assert.rejects(repository.depositFunds({
    projectId: "project_1", jobId: "job_1", currency: "USD", amount: 200, providerRef: "local_test",
  }), (error: unknown) =>
    typeof (error as any)?.getStatus === "function" && (error as any).getStatus() === 409
      && /concurrent transition/.test((error as Error).message));
  assert.equal(attempts, 3, "never spin indefinitely or invoke an external provider");
});

test("the job row lock's own serialization failure (raw query: P2010 / 40001) is retried too", async () => {
  // lockOpenJobForFunding is a raw SELECT ... FOR UPDATE: when it waited behind a
  // committed cancellation, Prisma reports P2010 carrying SQLSTATE 40001, not P2034.
  let attempts = 0;
  const repository = new PaymentsRepository({
    async $transaction() {
      attempts++;
      if (attempts === 1) {
        throw Object.assign(new Error("Raw query failed. Code: `40001`"), { code: "P2010", meta: { code: "40001" } });
      }
      const { ConflictException } = await import("@nestjs/common");
      throw new ConflictException("cannot fund escrow: job is cancelled");
    },
  } as never, {} as never);
  await assert.rejects(repository.depositFunds({
    projectId: "project_1", jobId: "job_1", currency: "USD", amount: 200, providerRef: "local_test",
  }), /job is cancelled/);
  assert.equal(attempts, 2);
  // Any other raw-query failure is not retried.
  let other = 0;
  const failing = new PaymentsRepository({
    async $transaction() { other++; throw Object.assign(new Error("syntax"), { code: "P2010", meta: { code: "42601" } }); },
  } as never, {} as never);
  await assert.rejects(failing.depositFunds({
    projectId: "project_1", jobId: "job_1", currency: "USD", amount: 200, providerRef: "local_test",
  }), /syntax/);
  assert.equal(other, 1);
});
