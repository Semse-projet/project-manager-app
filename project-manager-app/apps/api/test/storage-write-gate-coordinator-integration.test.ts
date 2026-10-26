/**
 * T-008: real PostgreSQL concurrency test. Safety gate: this test will only
 * execute in GitHub Actions against the repo's disposable 127.0.0.1:5433
 * service. Never run against a Railway/production DATABASE_URL.
 */
import "reflect-metadata";
import test from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { PrismaClient } from "@prisma/client";
import { StorageWriteGateCoordinator } from "../dist/infrastructure/storage/storage-write-gate-coordinator.js";
import { StorageWriteGateBlockedError } from "../dist/infrastructure/storage/storage-write-gate-state.js";

const dbUrl = process.env.DATABASE_URL;
const disposableCiDb = process.env.CI === "true" && !!dbUrl && (() => {
  try {
    const u = new URL(dbUrl);
    return u.protocol === "postgresql:" && u.hostname === "127.0.0.1" &&
      u.port === "5433" && u.pathname === "/semse" && u.username === "semse";
  } catch { return false; }
})();
const dbTest = disposableCiDb ? test : test.skip;

dbTest("Postgres row-lock serializes admission against DRAINING, active ledger survives", async () => {
  const p1 = new PrismaClient();
  const p2 = new PrismaClient();
  const scope = "test:/storage-gate-" + randomUUID();
  let lockRelease: (() => void) | undefined;
  let lockAcquired: (() => void) | undefined;
  const releasePromise = new Promise<void>(resolve => { lockRelease = resolve; });
  const acquiredPromise = new Promise<void>(resolve => { lockAcquired = resolve; });
  let lockedTransaction: Promise<void> | undefined;

  try {
    await p1.storageWriteGate.create({data: {scope, phase: "OPEN", epoch: 1n}});
    const coordinatorA = new StorageWriteGateCoordinator(p1 as never);
    const coordinatorB = new StorageWriteGateCoordinator(p2 as never);
    const first = await coordinatorA.admitWrite({
      scope, kind: "ORIGINAL_STORE", writerInstanceId: "instance-A-ci",
    });
    assert.equal((await p2.storageWriteOperation.count({where: {scope, state:"ACTIVE"}})), 1);

    // Connection B wins the row lock. Connection A must wait and then observe
    // DRAINING, not return a late ACTIVE ticket after the phase transition.
    lockedTransaction = p2.$transaction(async tx => {
      const rows = await tx.$queryRaw<Array<{phase: string}>>`
        SELECT "phase" FROM "StorageWriteGate" WHERE "scope" = ${scope} FOR UPDATE
      `;
      assert.equal(rows[0]?.phase, "OPEN");
      lockAcquired?.();
      await releasePromise;
      await tx.$executeRaw`
        UPDATE "StorageWriteGate" SET "phase"='DRAINING', "updatedAt"=CURRENT_TIMESTAMP
        WHERE "scope"=${scope}
      `;
    }, {timeout: 10000});
    await acquiredPromise;

    const racingAdmission = coordinatorB.admitWrite({
      scope, kind: "ORIGINAL_STORE", writerInstanceId: "instance-B-ci",
    });
    // Give connection B's waiting statement a chance to enter its lock wait.
    await new Promise(resolve => setTimeout(resolve, 80));
    lockRelease?.();
    await lockedTransaction;
    await assert.rejects(racingAdmission, (e: unknown) =>
      e instanceof StorageWriteGateBlockedError && e.reason === "not_open");

    assert.equal(await p1.storageWriteOperation.count({where: {scope, state:"ACTIVE"}}), 1);
    await coordinatorA.assertActive(first); // pre-admitted writer may finish during drain
    await coordinatorA.settleWrite(first, "COMPLETED");
    assert.equal(await p2.storageWriteOperation.count({where: {scope, state:"ACTIVE"}}), 0);

    const snapshot = await coordinatorB.inspect(scope);
    assert.equal(snapshot.phase, "DRAINING");
    assert.equal(snapshot.activeOperations, 0);
    assert.equal(snapshot.epoch, 1n);
  } finally {
    lockRelease?.();
    if (lockedTransaction) await lockedTransaction.catch(() => undefined);
    await p1.storageWriteOperation.deleteMany({where: {scope}}).catch(() => undefined);
    await p1.storageWriteGate.deleteMany({where: {scope}}).catch(() => undefined);
    await Promise.all([p1.$disconnect(), p2.$disconnect()]);
  }
});
