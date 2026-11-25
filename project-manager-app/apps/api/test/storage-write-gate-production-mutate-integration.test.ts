/**
 * Production-control slice against disposable PostgreSQL only.
 * Never targets Railway and never touches original bytes.
 */
import "reflect-metadata";
import test from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { ForbiddenException, ServiceUnavailableException } from "@nestjs/common";
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
    ticket: "t008-" + suffix + "-" + token.slice(0, 8),
    reason: "synthetic production control acceptance",
    idempotencyKey: "idem-" + suffix + "-" + token.slice(0, 8),
  };
}

dbTest("production mutate is opt-in, fail-closed, TTL-bounded and idempotent to thaw", async () => {
  const db = new PrismaClient();
  const token = randomUUID();
  const root = "/data/semse-storage-ci-" + token.slice(0, 8);
  const projectId = randomUUID();
  const environmentId = randomUUID();
  const scope = `storage:${projectId}:${environmentId}:${root}`;
  const previous = {
    mode: process.env.SEMSE_STORAGE_WRITE_GATE_MODE,
    controlMode: process.env.SEMSE_STORAGE_WRITE_GATE_PRODUCTION_CONTROL_MODE,
    nodeEnv: process.env.NODE_ENV,
    railwayEnv: process.env.RAILWAY_ENVIRONMENT,
    railwayName: process.env.RAILWAY_ENVIRONMENT_NAME,
    projectId: process.env.RAILWAY_PROJECT_ID,
    environmentId: process.env.RAILWAY_ENVIRONMENT_ID,
    root: process.env.SEMSE_STORAGE_ROOT,
  };

  process.env.NODE_ENV = "production";
  process.env.RAILWAY_ENVIRONMENT = "production";
  process.env.RAILWAY_ENVIRONMENT_NAME = "production";
  process.env.RAILWAY_PROJECT_ID = projectId;
  process.env.RAILWAY_ENVIRONMENT_ID = environmentId;
  process.env.SEMSE_STORAGE_ROOT = root;
  process.env.SEMSE_STORAGE_WRITE_GATE_MODE = "production";
  process.env.SEMSE_STORAGE_WRITE_GATE_PRODUCTION_CONTROL_MODE = "mutate";

  const coordinator = new StorageWriteGateCoordinator(db as never);
  const transitions = new StorageWriteGateTransitionService(db as never);
  const control = new StorageWriteGateControlService(db as never, coordinator, transitions);
  const grant = {productionMutateAuthorized: true as const};

  try {
    await control.provision(meta(token, "provision"));

    await assert.rejects(
      () => control.transition({
        ...meta(token, "no-grant"),
        expectedEpoch: 1n,
        action: "BEGIN_DRAIN",
      }),
      (error) => error instanceof ForbiddenException,
    );
    await assert.rejects(
      () => transitions.transition({
        scope,
        expectedEpoch: 1n,
        action: "BEGIN_DRAIN",
        authority: {
          actorUserId: "synthetic-ops-admin",
          actorAuthorized: true,
          auditTicket: "t008-direct-" + token.slice(0, 8),
          productionMutateAuthorized: false,
        },
      }),
      (error) => error instanceof ServiceUnavailableException,
    );

    const writer = "synthetic-mutate-" + token.slice(0, 8);
    const ticket = await coordinator.admitWrite({
      scope,
      kind: "ORIGINAL_STORE",
      writerInstanceId: writer,
    });
    await coordinator.settleWrite(ticket, "COMPLETED");

    assert.deepEqual(await control.transition({
      ...meta(token, "drain"),
      ...grant,
      expectedEpoch: 1n,
      action: "BEGIN_DRAIN",
    }), {phase: "DRAINING", epoch: "1"});

    await control.attestCoverage({
      ...meta(token, "coverage"),
      ...grant,
      expectedEpoch: 1n,
      coverageDigest: "a".repeat(64),
    });

    await assert.rejects(
      () => control.transition({
        ...meta(token, "freeze-open"),
        ...grant,
        expectedEpoch: 1n,
        action: "MARK_FROZEN",
      }),
      rejectReason("freeze_ttl_required"),
    );

    const beforeFreeze = Date.now();
    assert.deepEqual(await control.transition({
      ...meta(token, "freeze"),
      ...grant,
      expectedEpoch: 1n,
      action: "MARK_FROZEN",
      freezeTtlSeconds: 300,
    }), {phase: "FROZEN", epoch: "1"});
    const frozen = await db.storageWriteGate.findUniqueOrThrow({where: {scope}});
    assert.ok(frozen.freezeExpiresAt);
    const ttlMs = frozen.freezeExpiresAt.getTime() - beforeFreeze;
    assert.ok(ttlMs >= 290_000 && ttlMs <= 320_000);

    await assert.rejects(
      () => coordinator.admitWrite({
        scope,
        kind: "MULTIPART_PART",
        writerInstanceId: writer,
      }),
      rejectReason("not_open"),
    );

    await db.$executeRaw`
      UPDATE "StorageWriteGate"
      SET "freezeExpiresAt" = CURRENT_TIMESTAMP - INTERVAL '1 minute'
      WHERE "scope" = ${scope}
    `;
    const overdue = await control.status();
    assert.equal(overdue.phase, "FROZEN");
    assert.equal(overdue.freezeExpired, true);
    assert.equal(overdue.explicitThawRequired, true);
    await assert.rejects(
      () => coordinator.admitWrite({
        scope,
        kind: "ORIGINAL_STORE",
        writerInstanceId: writer,
      }),
      rejectReason("not_open"),
      "an elapsed freeze TTL must not reopen writes",
    );

    await assert.rejects(
      () => control.transition({
        ...meta(token, "thaw-early"),
        ...grant,
        expectedEpoch: 1n,
        action: "THAW",
      }),
      rejectReason("recovery_window_not_closed"),
    );
    await control.attestWindowClosed({
      ...meta(token, "window"),
      ...grant,
      expectedEpoch: 1n,
      windowEvidenceDigest: "c".repeat(64),
    });
    assert.deepEqual(await control.transition({
      ...meta(token, "thaw"),
      ...grant,
      expectedEpoch: 1n,
      action: "THAW",
    }), {phase: "OPEN", epoch: "2"});
    assert.deepEqual(await control.transition({
      ...meta(token, "thaw-again"),
      ...grant,
      expectedEpoch: 2n,
      action: "THAW",
    }), {phase: "OPEN", epoch: "2"});
    assert.equal(await db.storageWriteGateAudit.count({where: {scope, action: "THAW"}}), 2);
    const reopened = await db.storageWriteGate.findUniqueOrThrow({where: {scope}});
    assert.equal(reopened.phase, "OPEN");
    assert.equal(reopened.freezeExpiresAt, null);

    process.env.SEMSE_STORAGE_WRITE_GATE_MODE = "off";
    await assert.rejects(
      () => control.transition({
        ...meta(token, "runtime-off"),
        ...grant,
        expectedEpoch: 2n,
        action: "BEGIN_DRAIN",
      }),
      (error) => error instanceof ServiceUnavailableException,
    );

    delete process.env.SEMSE_STORAGE_WRITE_GATE_PRODUCTION_CONTROL_MODE;
    process.env.SEMSE_STORAGE_WRITE_GATE_MODE = "production";
    await assert.rejects(
      () => control.transition({
        ...meta(token, "default-control"),
        ...grant,
        expectedEpoch: 2n,
        action: "BEGIN_DRAIN",
      }),
      (error) => error instanceof ServiceUnavailableException,
    );
  } finally {
    await db.storageWriteGateAudit.deleteMany({where: {scope}}).catch(() => undefined);
    await db.storageWriteOperation.deleteMany({where: {scope}}).catch(() => undefined);
    await db.storageWriteGate.deleteMany({where: {scope}}).catch(() => undefined);
    await db.$disconnect();
    if (previous.mode === undefined) delete process.env.SEMSE_STORAGE_WRITE_GATE_MODE;
    else process.env.SEMSE_STORAGE_WRITE_GATE_MODE = previous.mode;
    if (previous.controlMode === undefined) delete process.env.SEMSE_STORAGE_WRITE_GATE_PRODUCTION_CONTROL_MODE;
    else process.env.SEMSE_STORAGE_WRITE_GATE_PRODUCTION_CONTROL_MODE = previous.controlMode;
    if (previous.nodeEnv === undefined) delete process.env.NODE_ENV;
    else process.env.NODE_ENV = previous.nodeEnv;
    if (previous.railwayEnv === undefined) delete process.env.RAILWAY_ENVIRONMENT;
    else process.env.RAILWAY_ENVIRONMENT = previous.railwayEnv;
    if (previous.railwayName === undefined) delete process.env.RAILWAY_ENVIRONMENT_NAME;
    else process.env.RAILWAY_ENVIRONMENT_NAME = previous.railwayName;
    if (previous.projectId === undefined) delete process.env.RAILWAY_PROJECT_ID;
    else process.env.RAILWAY_PROJECT_ID = previous.projectId;
    if (previous.environmentId === undefined) delete process.env.RAILWAY_ENVIRONMENT_ID;
    else process.env.RAILWAY_ENVIRONMENT_ID = previous.environmentId;
    if (previous.root === undefined) delete process.env.SEMSE_STORAGE_ROOT;
    else process.env.SEMSE_STORAGE_ROOT = previous.root;
  }
});
