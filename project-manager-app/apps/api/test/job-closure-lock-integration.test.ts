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
import { ReservationsRepository } from "../dist/modules/reservations/reservations.repository.js";
import { DisputesRepository } from "../dist/modules/disputes/disputes.repository.js";
import { MilestonesRepository } from "../dist/modules/milestones/milestones.repository.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
loadEnv({ path: path.resolve(__dirname, "..", "..", "..", "packages/db/.env") });

const dbTest = process.env.DATABASE_URL ? test : test.skip;
const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
const noActor = { async ensureActorContext() { return undefined; } };

async function seed(prisma: PrismaClient, status: "ACCEPTED" | "CANCELLED" | "REVIEW" | "POSTED") {
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

dbTest("two transitions validated from the same status cannot both apply: a stale rework cannot reopen a completed job", async () => {
  const prisma = new PrismaClient();
  const ids = await seed(prisma, "REVIEW");
  try {
    const jobs = new JobsRepository(prisma as never, noActor as never, new OutboxRepository(prisma as never));
    let releaseCompletion!: () => void;
    const completionHolding = new Promise<void>((resolve) => { releaseCompletion = resolve; });
    // Completion validated from review takes the lock and stalls before writing.
    const completion = jobs.updateStatus({
      tenantId: ids.tenantId, jobId: ids.jobId, status: "completed", orgId: ids.orgId, actorType: "user", actorId: "usr_client",
      expectedFrom: "review", beforeWrite: async () => { await completionHolding; },
    });
    await sleep(200);
    // Rework was also validated from review; it must not overwrite the completion.
    const rework = jobs.updateStatus({
      tenantId: ids.tenantId, jobId: ids.jobId, status: "in_progress", orgId: ids.orgId, actorType: "user", actorId: "usr_client",
      expectedFrom: "review",
    }).then(() => "applied", (error: Error) => error.message);
    await sleep(300);
    releaseCompletion();
    await completion;
    assert.match(await rework, /changed from 'review' to 'completed'/);
    assert.equal((await prisma.job.findUnique({ where: { id: ids.jobId } }))?.status, "COMPLETED");
  } finally {
    await cleanup(prisma, ids.tenantId);
    await prisma.$disconnect();
  }
});

dbTest("a reservation that starts while the job is being cancelled cannot reopen it", async () => {
  const prisma = new PrismaClient();
  const ids = await seed(prisma, "POSTED");
  try {
    const proOrg = await prisma.org.create({ data: { tenantId: ids.tenantId, type: "PRO", name: `TEST_pro_${ids.tenantId}` } });
    const pro = await prisma.user.create({ data: { email: `e2e-${ids.tenantId}@example.test` } });
    const jobs = new JobsRepository(prisma as never, noActor as never, new OutboxRepository(prisma as never));
    let releaseCancel!: () => void;
    const cancelHolding = new Promise<void>((resolve) => { releaseCancel = resolve; });
    // The owner's cancellation (posted -> cancelled) takes the row lock and stalls.
    const cancel = jobs.updateStatus({
      tenantId: ids.tenantId, jobId: ids.jobId, status: "cancelled", orgId: ids.orgId, actorType: "user", actorId: "usr_client",
      expectedFrom: "posted", beforeWrite: async () => { await cancelHolding; },
    });
    await sleep(200);
    const reservations = new ReservationsRepository(prisma as never, noActor as never);
    const reserving = reservations.create({
      tenantId: ids.tenantId, orgId: proOrg.id, userId: pro.id, roles: ["PRO"], jobId: ids.jobId, expiresInMinutes: 30,
    }).then(() => "reserved", (error: Error) => error.message);
    await sleep(300);
    releaseCancel();
    await cancel;
    assert.match(await reserving, /not eligible for reservation/);
    assert.equal((await prisma.job.findUnique({ where: { id: ids.jobId } }))?.status, "CANCELLED");
    assert.equal(await prisma.jobReservation.count({ where: { jobId: ids.jobId } }), 0);
  } finally {
    await prisma.membership.deleteMany({ where: { org: { tenantId: ids.tenantId } } }).catch(() => undefined);
    await prisma.user.deleteMany({ where: { email: `e2e-${ids.tenantId}@example.test` } }).catch(() => undefined);
    await cleanup(prisma, ids.tenantId);
    await prisma.$disconnect();
  }
});

dbTest("a dispute cannot be opened on a closed job, nor slip in while it is being completed", async () => {
  const prisma = new PrismaClient();
  const ids = await seed(prisma, "REVIEW");
  try {
    const disputes = new DisputesRepository(prisma as never, noActor as never);
    const open = () => disputes.create({
      tenantId: ids.tenantId, orgId: ids.orgId, userId: "usr_client", roles: ["CLIENT"], projectId: ids.projectId, reason: "Disputa sintética de prueba",
    }).then(() => "opened", (error: Error) => error.message);

    const jobs = new JobsRepository(prisma as never, noActor as never, new OutboxRepository(prisma as never));
    let releaseCompletion!: () => void;
    const completionHolding = new Promise<void>((resolve) => { releaseCompletion = resolve; });
    // Completion takes the lock, sees no active dispute, then stalls before writing.
    const completion = jobs.updateStatus({
      tenantId: ids.tenantId, jobId: ids.jobId, status: "completed", orgId: ids.orgId, actorType: "user", actorId: "usr_client",
      expectedFrom: "review",
      beforeWrite: async (tx) => {
        assert.equal(await tx.dispute.count({ where: { projectId: ids.projectId, status: { in: ["OPEN", "ASSIGNED", "UNDER_REVIEW"] } } }), 0);
        await completionHolding;
      },
    });
    await sleep(200);
    const racingDispute = open();
    await sleep(300);
    releaseCompletion();
    await completion;
    assert.match(await racingDispute, /cannot open a dispute: job is completed/);
    assert.match(await open(), /cannot open a dispute: job is completed/);
    assert.equal(await prisma.dispute.count({ where: { projectId: ids.projectId } }), 0);
  } finally {
    await cleanup(prisma, ids.tenantId);
    await prisma.$disconnect();
  }
});

dbTest("a milestone submitted while the job is being cancelled cannot move once it is cancelled", async () => {
  const prisma = new PrismaClient();
  const ids = await seed(prisma, "ACCEPTED");
  try {
    const milestone = await prisma.milestone.create({ data: { projectId: ids.projectId, title: "Hito sintético", amount: 100, sequence: 1 } });
    const jobs = new JobsRepository(prisma as never, noActor as never, new OutboxRepository(prisma as never));
    let releaseCancel!: () => void;
    const cancelHolding = new Promise<void>((resolve) => { releaseCancel = resolve; });
    // Cancellation takes the lock, sees only DRAFT milestones, then stalls before writing.
    const cancel = jobs.updateStatus({
      tenantId: ids.tenantId, jobId: ids.jobId, status: "cancelled", orgId: ids.orgId, actorType: "user", actorId: "usr_client",
      expectedFrom: "accepted",
      beforeWrite: async (tx) => {
        assert.equal(await tx.milestone.count({ where: { projectId: ids.projectId, status: { notIn: ["DRAFT", "REJECTED"] } } }), 0);
        await cancelHolding;
      },
    });
    await sleep(200);
    // Same step MilestonesRepository.submit ends with (a guarded DRAFT -> SUBMITTED write).
    const milestones = new MilestonesRepository(prisma as never, noActor as never) as unknown as {
      transitionStatus(snapshot: { milestoneId: string; currentStatus: string }, to: string): Promise<unknown>;
    };
    const submitting = milestones.transitionStatus({ milestoneId: milestone.id, currentStatus: "draft" }, "SUBMITTED")
      .then(() => "submitted", (error: Error) => error.message);
    await sleep(300);
    releaseCancel();
    await cancel;
    assert.match(await submitting, /cannot change a milestone: job is cancelled/);
    assert.equal((await prisma.milestone.findUnique({ where: { id: milestone.id } }))?.status, "DRAFT");
    assert.equal((await prisma.job.findUnique({ where: { id: ids.jobId } }))?.status, "CANCELLED");
  } finally {
    await cleanup(prisma, ids.tenantId);
    await prisma.$disconnect();
  }
});
