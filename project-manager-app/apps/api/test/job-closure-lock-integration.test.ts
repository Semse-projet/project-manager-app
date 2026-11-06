/**
 * Codex review on #1111: a job's terminal transition and a deposit into its
 * escrow must not interleave. Without a shared lock, the closure check could read
 * an empty escrow, a deposit could then reserve a PENDING payment, and the job
 * would still be cancelled with money about to be captured into it.
 *
 * Both sides now take the job row lock (common/job-lock.ts) inside their own
 * transaction. This drives the real repositories against real Postgres, holding
 * one side's lock open while the other side runs. Skipped without DATABASE_URL.
 */
import "reflect-metadata";

import test from "node:test";
import assert from "node:assert/strict";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { fileURLToPath } from "node:url";
import { config as loadEnv } from "dotenv";
import { PrismaClient } from "@prisma/client";
import { JobsRepository } from "../dist/modules/jobs/jobs.repository.js";
import { OutboxRepository } from "../dist/modules/domain-events/outbox.repository.js";
import { PaymentsRepository } from "../dist/modules/payments/payments.repository.js";
import { lockJobRow } from "../dist/common/job-lock.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
loadEnv({ path: path.resolve(__dirname, "..", "..", "..", "packages/db/.env") });

const dbTest = process.env.DATABASE_URL ? test : test.skip;
const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
const noActor = { async ensureActorContext() { return undefined; } };

async function seed(prisma: PrismaClient, status: "ACCEPTED" | "CANCELLED") {
  const id = randomUUID().slice(0, 8);
  const tenantId = `tenant_lock_${id}`;
  await prisma.tenant.create({ data: { id: tenantId, slug: tenantId, name: `TEST_${id}` } });
  const org = await prisma.org.create({ data: { tenantId, type: "CLIENT", name: `TEST_${id}` } });
  const job = await prisma.job.create({
    data: { tenantId, clientOrgId: org.id, title: `TEST_${id} lock`, scope: "Trabajo sintético del test de bloqueo", category: "general", status },
  });
  const project = await prisma.project.create({ data: { tenantId, jobId: job.id, assignedProOrgId: org.id } });
  return { tenantId, orgId: org.id, jobId: job.id, projectId: project.id };
}

async function cleanup(prisma: PrismaClient, tenantId: string) {
  await prisma.tenant.delete({ where: { id: tenantId } }).catch(() => undefined);
}

function cancelWithClosureCheck(prisma: PrismaClient, ids: { tenantId: string; orgId: string; jobId: string }) {
  const jobs = new JobsRepository(prisma as never, noActor as never, new OutboxRepository(prisma as never));
  return jobs.updateStatus({
    tenantId: ids.tenantId, jobId: ids.jobId, status: "cancelled", orgId: ids.orgId, actorType: "user", actorId: "usr_test",
    // Same shape as JobsService.assertClosure: a pending payment blocks the close.
    beforeWrite: async (tx) => {
      const pending = await tx.paymentTxn.count({ where: { status: "PENDING", escrow: { project: { jobId: ids.jobId } } } });
      if (pending > 0) throw new Error(`job cannot be cancelled: ${pending} payment(s) still pending`);
    },
  });
}

const deposit = (prisma: PrismaClient, projectId: string, jobId: string) =>
  new PaymentsRepository(prisma as never, noActor as never).depositFunds({
    projectId, jobId, currency: "USD", amount: 100, providerRef: `test_ref_${randomUUID()}`,
  });

dbTest("a deposit into a cancelled job is refused", async () => {
  const prisma = new PrismaClient();
  const ids = await seed(prisma, "CANCELLED");
  try {
    await assert.rejects(deposit(prisma, ids.projectId, ids.jobId), /job is cancelled/);
    assert.equal(await prisma.paymentTxn.count({ where: { escrow: { projectId: ids.projectId } } }), 0);
  } finally {
    await cleanup(prisma, ids.tenantId);
    await prisma.$disconnect();
  }
});

dbTest("a deposit that starts while the job is being cancelled waits for it and is then refused", async () => {
  const prisma = new PrismaClient();
  const ids = await seed(prisma, "ACCEPTED");
  try {
    let releaseCancel!: () => void;
    const cancelHolding = new Promise<void>((resolve) => { releaseCancel = resolve; });
    const jobs = new JobsRepository(prisma as never, noActor as never, new OutboxRepository(prisma as never));
    // Cancellation takes the lock, passes its closure check, then stalls before writing.
    const cancel = jobs.updateStatus({
      tenantId: ids.tenantId, jobId: ids.jobId, status: "cancelled", orgId: ids.orgId, actorType: "user", actorId: "usr_test",
      beforeWrite: async () => { await cancelHolding; },
    });
    await sleep(200);
    const racingDeposit = deposit(prisma, ids.projectId, ids.jobId).then(() => "deposited", (error: Error) => error.message);
    await sleep(300);
    releaseCancel();
    await cancel;
    const outcome = await racingDeposit;
    assert.notEqual(outcome, "deposited", "the deposit must not land in a cancelled job");
    assert.equal(await prisma.paymentTxn.count({ where: { escrow: { projectId: ids.projectId } } }), 0);
    assert.equal((await prisma.job.findUnique({ where: { id: ids.jobId } }))?.status, "CANCELLED");
  } finally {
    await cleanup(prisma, ids.tenantId);
    await prisma.$disconnect();
  }
});

dbTest("a cancellation that starts while a deposit is being reserved waits for it and is then refused", async () => {
  const prisma = new PrismaClient();
  const ids = await seed(prisma, "ACCEPTED");
  try {
    let releaseDeposit!: () => void;
    const depositHolding = new Promise<void>((resolve) => { releaseDeposit = resolve; });
    // Same steps as PaymentsRepository.depositFunds: lock the job, then reserve a PENDING deposit.
    const reserving = prisma.$transaction(async (tx) => {
      await lockJobRow(tx, ids.jobId);
      const escrow = await tx.paymentEscrow.create({
        data: { projectId: ids.projectId, jobId: ids.jobId, providerRef: `test_ref_${randomUUID()}`, currency: "USD", totalAmount: 100 },
      });
      await tx.paymentTxn.create({ data: { escrowId: escrow.id, type: "DEPOSIT", amount: 100, providerRef: `test_txn_${randomUUID()}`, status: "PENDING" } });
      await depositHolding;
    }, { timeout: 10_000 });
    await sleep(200);
    const racingCancel = cancelWithClosureCheck(prisma, ids).then(() => "cancelled", (error: Error) => error.message);
    await sleep(300);
    releaseDeposit();
    await reserving;
    assert.match(await racingCancel, /payment\(s\) still pending/);
    assert.equal((await prisma.job.findUnique({ where: { id: ids.jobId } }))?.status, "ACCEPTED");
  } finally {
    await cleanup(prisma, ids.tenantId);
    await prisma.$disconnect();
  }
});
