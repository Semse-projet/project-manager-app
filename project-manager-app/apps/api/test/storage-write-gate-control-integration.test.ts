/**
 * T-008 staging control-plane acceptance against disposable PostgreSQL only.
 * Never runs against production and never touches original bytes.
 */
import "reflect-metadata";
import test from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { ServiceUnavailableException } from "@nestjs/common";
import { PrismaClient } from "@prisma/client";
import { StorageWriteGateControlService } from "../dist/infrastructure/storage/storage-write-gate-control.service.js";
import { StorageWriteGateTransitionService } from "../dist/infrastructure/storage/storage-write-gate-transition.service.js";
import { StorageWriteGateCoordinator } from "../dist/infrastructure/storage/storage-write-gate-coordinator.js";
import { StorageWriteGateBlockedError } from "../dist/infrastructure/storage/storage-write-gate-state.js";

const isCiDb = (() => {
  try {
    const url = new URL(process.env.DATABASE_URL ?? "");
    return process.env.CI === "true" &&
      url.protocol === "postgresql:" &&
      url.hostname === "127.0.0.1" &&
      url.port === "5433" &&
      url.pathname === "/semse" &&
      url.username === "semse";
  } catch {
    return false;
  }
})();
const dbTest = isCiDb ? test : test.skip;
const rejectReason = (reason: string) => (error: unknown) =>
  error instanceof StorageWriteGateBlockedError && error.reason === reason;

function meta(token: string, suffix: string) {
  return {
    actorUserId: "synthetic-ops-admin",
    ticket: "t008-" + suffix + "-" + token,
    reason: "synthetic staging control-plane acceptance",
    idempotencyKey: "idem-" + suffix + "-" + token,
  };
}

test("control plane is unavailable when any production marker is active", async () => {
  const previousMode = process.env.SEMSE_STORAGE_WRITE_GATE_MODE;
  const previousNodeEnv = process.env.NODE_ENV;
  process.env.SEMSE_STORAGE_WRITE_GATE_MODE = "staging";
  process.env.NODE_ENV = "production";
  try {
    const service = new StorageWriteGateControlService({} as never, {} as never, {} as never);
    await assert.rejects(
      () => service.status(),
      (error) => error instanceof ServiceUnavailableException,
    );
  } finally {
    if (previousMode === undefined) delete process.env.SEMSE_STORAGE_WRITE_GATE_MODE;
    else process.env.SEMSE_STORAGE_WRITE_GATE_MODE = previousMode;
    if (previousNodeEnv === undefined) delete process.env.NODE_ENV;
    else process.env.NODE_ENV = previousNodeEnv;
  }
});

dbTest("T-008 control plane: provision, drain, recovery fence, freeze and thaw are durable", async () => {
  const db = new PrismaClient();
  const token = randomUUID();
  const root = "/tmp/semse-control-" + token;
  const scope = "storage:" + root;
  const previous = {
    mode: process.env.SEMSE_STORAGE_WRITE_GATE_MODE,
    nodeEnv: process.env.NODE_ENV,
    railwayEnv: process.env.RAILWAY_ENVIRONMENT,
    railwayName: process.env.RAILWAY_ENVIRONMENT_NAME,
    root: process.env.SEMSE_STORAGE_ROOT,
  };
  process.env.SEMSE_STORAGE_WRITE_GATE_MODE = "staging";
  process.env.NODE_ENV = "test";
  delete process.env.RAILWAY_ENVIRONMENT;
  delete process.env.RAILWAY_ENVIRONMENT_NAME;
  process.env.SEMSE_STORAGE_ROOT = root;

  const coordinator = new StorageWriteGateCoordinator(db as never);
  const transitions = new StorageWriteGateTransitionService(db as never);
  const control = new StorageWriteGateControlService(
    db as never,
    coordinator,
    transitions,
  );

  try {
    assert.deepEqual(await control.status(), {
      provisioned: false,
      scopeDigest: (await import("node:crypto"))
        .createHash("sha256").update(scope).digest("hex"),
    });

    const provisionMeta = meta(token, "provision");
    const provisioned = await Promise.all([
      control.provision(provisionMeta),
      control.provision(provisionMeta),
    ]);
    assert.deepEqual(provisioned, [
      {created: true, phase: "OPEN", epoch: "1"},
      {created: true, phase: "OPEN", epoch: "1"},
    ]);
    assert.equal(
      await db.storageWriteGateAudit.count({where:{scope,action:"PROVISION"}}),
      1,
      "concurrent exact provision retries must have one durable effect",
    );

    const ticket = await coordinator.admitWrite({
      scope,
      kind: "ORIGINAL_STORE",
      writerInstanceId: "synthetic-dead-writer-" + token,
    });

    const drainInput = {
      ...meta(token, "drain"),
      expectedEpoch: 1n,
      action: "BEGIN_DRAIN" as const,
    };
    const drainedRetries = await Promise.all([
      control.transition(drainInput),
      control.transition(drainInput),
    ]);
    assert.deepEqual(drainedRetries, [
      {phase: "DRAINING", epoch: "1"},
      {phase: "DRAINING", epoch: "1"},
    ]);
    assert.equal(
      await db.storageWriteGateAudit.count({where:{scope,action:"BEGIN_DRAIN"}}),
      1,
      "concurrent exact transition retries must have one durable effect",
    );

    const drained = await db.storageWriteGate.findUniqueOrThrow({where:{scope}});
    assert.equal(drained.coverageDigest, null);
    assert.equal(drained.recoveryWindowDigest, null);

    await control.attestCoverage({
      ...meta(token, "coverage"),
      expectedEpoch: 1n,
      coverageDigest: "a".repeat(64),
    });

    await assert.rejects(
      () => control.transition({
        ...meta(token, "early-freeze"),
        expectedEpoch: 1n,
        action: "MARK_FROZEN",
      }),
      rejectReason("active_operations"),
    );

    assert.deepEqual(await control.recoverOperation({
      ...meta(token, "recover"),
      expectedEpoch: 1n,
      operationId: ticket.id,
      writerInstanceId: ticket.writerInstanceId,
      terminationEvidenceDigest: "b".repeat(64),
    }), {phase: "DRAINING", epoch: "1", state: "RECOVERED_FENCED"});

    const recovered = await db.storageWriteOperation.findUniqueOrThrow({
      where: {id: ticket.id},
    });
    assert.equal(recovered.state, "RECOVERED_FENCED");
    assert.ok(recovered.finishedAt);
    await assert.rejects(
      () => coordinator.assertActive(ticket),
      rejectReason("invalid_active_ticket"),
    );

    // A drain-abort attestation is intentionally NOT sufficient for a later
    // thaw. MARK_FROZEN must invalidate it so post-freeze evidence is fresh.
    await control.attestWindowClosed({
      ...meta(token, "abort-window"),
      expectedEpoch: 1n,
      windowEvidenceDigest: "e".repeat(64),
    });

    assert.deepEqual(await control.transition({
      ...meta(token, "freeze"),
      expectedEpoch: 1n,
      action: "MARK_FROZEN",
    }), {phase: "FROZEN", epoch: "1"});
    assert.equal(
      (await db.storageWriteGate.findUniqueOrThrow({where:{scope}})).recoveryWindowDigest,
      null,
    );

    await assert.rejects(
      () => control.transition({
        ...meta(token, "thaw-without-window"),
        expectedEpoch: 1n,
        action: "THAW",
      }),
      rejectReason("recovery_window_not_closed"),
    );

    await control.attestWindowClosed({
      ...meta(token, "window"),
      expectedEpoch: 1n,
      windowEvidenceDigest: "c".repeat(64),
    });

    const thawMeta = meta(token, "thaw");
    assert.deepEqual(await control.transition({
      ...thawMeta,
      expectedEpoch: 1n,
      action: "THAW",
    }), {phase: "OPEN", epoch: "2"});

    // Exact retry returns the recorded result even though the gate epoch moved.
    assert.deepEqual(await control.transition({
      ...thawMeta,
      expectedEpoch: 1n,
      action: "THAW",
    }), {phase: "OPEN", epoch: "2"});

    const reopened = await db.storageWriteGate.findUniqueOrThrow({where:{scope}});
    assert.equal(reopened.coverageDigest, null);
    assert.equal(reopened.recoveryWindowDigest, null);

    assert.equal(
      await db.storageWriteGateAudit.count({where:{scope}}),
      8,
      "failed transition attempts are not audited as successful control actions",
    );

    await assert.rejects(
      () => control.attestCoverage({
        ...meta(token, "coverage"),
        expectedEpoch: 2n,
        coverageDigest: "d".repeat(64),
      }),
      rejectReason("idempotency_conflict"),
    );
  } finally {
    await db.storageWriteGateAudit.deleteMany({where:{scope}}).catch(()=>undefined);
    await db.storageWriteOperation.deleteMany({where:{scope}}).catch(()=>undefined);
    await db.storageWriteGate.deleteMany({where:{scope}}).catch(()=>undefined);
    await db.$disconnect();
    if (previous.mode === undefined) delete process.env.SEMSE_STORAGE_WRITE_GATE_MODE;
    else process.env.SEMSE_STORAGE_WRITE_GATE_MODE = previous.mode;
    if (previous.nodeEnv === undefined) delete process.env.NODE_ENV;
    else process.env.NODE_ENV = previous.nodeEnv;
    if (previous.railwayEnv === undefined) delete process.env.RAILWAY_ENVIRONMENT;
    else process.env.RAILWAY_ENVIRONMENT = previous.railwayEnv;
    if (previous.railwayName === undefined) delete process.env.RAILWAY_ENVIRONMENT_NAME;
    else process.env.RAILWAY_ENVIRONMENT_NAME = previous.railwayName;
    if (previous.root === undefined) delete process.env.SEMSE_STORAGE_ROOT;
    else process.env.SEMSE_STORAGE_ROOT = previous.root;
  }
});
