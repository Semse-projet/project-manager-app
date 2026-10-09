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
