/**
 * Real PostgreSQL safety tests for T-008 S2a. Only enabled on disposable CI DB.
 * No production URL is accepted.
 */
import "reflect-metadata";
import test from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { PrismaClient } from "@prisma/client";
import { StorageWriteGateTransitionService } from "../dist/infrastructure/storage/storage-write-gate-transition.service.js";
import { StorageWriteGateCoordinator } from "../dist/infrastructure/storage/storage-write-gate-coordinator.js";
import { StorageWriteGateBlockedError } from "../dist/infrastructure/storage/storage-write-gate-state.js";

const isCiDb = (() => {
  try {
    const url = new URL(process.env.DATABASE_URL ?? "");
    return process.env.CI === "true" && url.protocol === "postgresql:" &&
      url.hostname === "127.0.0.1" && url.port === "5433" &&
      url.pathname === "/semse" && url.username === "semse";
  } catch { return false; }
})();
const dbTest = isCiDb ? test : test.skip;
const authority = (ticket: string) => ({
  actorUserId: "synthetic-operator", actorAuthorized: true,
  auditTicket: ticket, recoveryWindowClosed: true,
});
const rejectReason = (reason: string) => (error: unknown) =>
  error instanceof StorageWriteGateBlockedError && error.reason === reason;

dbTest("T-008 PG: drain, active ticket, freeze, thaw, epoch and audit are coherent", async () => {
  const db = new PrismaClient();
  const scope = "test:/transition-" + randomUUID();
  try {
    await db.storageWriteGate.create({data: {
      scope, phase: "OPEN", epoch: 1n, coverageDigest: "synthetic-only-not-production",
    }});
    const writer = new StorageWriteGateCoordinator(db as never);
    const transition = new StorageWriteGateTransitionService(db as never);
    const ticket = await writer.admitWrite({
      scope, kind: "ORIGINAL_STORE", writerInstanceId: "synthetic-writer-1",
    });
    const drained = await transition.transition({
      scope, expectedEpoch: 1n, action: "BEGIN_DRAIN", authority: authority("audit-t008-drain"),
    });
    assert.deepEqual(drained, {phase:"DRAINING", epoch:1n});
    await assert.rejects(
      () => transition.transition({
        scope, expectedEpoch:1n, action:"MARK_FROZEN", authority:authority("audit-t008-early"),
      }), rejectReason("active_operations"));
    assert.equal(await db.storageWriteGateAudit.count({where:{scope}}), 1);
    await writer.assertActive(ticket);
    await writer.settleWrite(ticket,"COMPLETED");
    const frozen = await transition.transition({
      scope, expectedEpoch:1n, action:"MARK_FROZEN", authority:authority("audit-t008-freeze"),
    });
    assert.deepEqual(frozen,{phase:"FROZEN",epoch:1n});
    await assert.rejects(() => writer.admitWrite({
      scope, kind:"ORIGINAL_STORE",writerInstanceId:"synthetic-writer-2",
    }),rejectReason("not_open"));
    const thawed = await transition.transition({
      scope,expectedEpoch:1n,action:"THAW",authority:authority("audit-t008-thaw"),
    });
    assert.deepEqual(thawed,{phase:"OPEN",epoch:2n});
    assert.equal(await db.storageWriteGateAudit.count({where:{scope}}),3);
    assert.equal((await writer.inspect(scope)).epoch,2n);
  } finally {
    await db.storageWriteGateAudit.deleteMany({where:{scope}}).catch(()=>undefined);
    await db.storageWriteOperation.deleteMany({where:{scope}}).catch(()=>undefined);
    await db.storageWriteGate.deleteMany({where:{scope}}).catch(()=>undefined);
    await db.$disconnect();
  }
});

dbTest("T-008 PG: failed audit write rolls back phase transition", async () => {
  const db = new PrismaClient();
  const scope = "test:/auditrollback-" + randomUUID();
  try {
    await db.storageWriteGate.create({data:{
      scope,phase:"OPEN",epoch:1n,coverageDigest:"synthetic-only",
    }});
    const service = new StorageWriteGateTransitionService(db as never);
    // PostgreSQL cannot encode NUL in text. The service validates only that
    // actorUserId is nonempty; the audit insert is rejected AFTER the phase
    // UPDATE within the same transaction.
    await assert.rejects(() => service.transition({
      scope,expectedEpoch:1n,action:"BEGIN_DRAIN",
      authority:{...authority("audit-t008-rollback"),actorUserId:"operator\\u0000invalid"},
    }));
    const gate = await db.storageWriteGate.findUniqueOrThrow({where:{scope}});
    assert.equal(gate.phase,"OPEN");
    assert.equal(gate.epoch,1n);
    assert.equal(await db.storageWriteGateAudit.count({where:{scope}}),0);
  } finally {
    await db.storageWriteGateAudit.deleteMany({where:{scope}}).catch(()=>undefined);
    await db.storageWriteGate.deleteMany({where:{scope}}).catch(()=>undefined);
    await db.$disconnect();
  }
});
