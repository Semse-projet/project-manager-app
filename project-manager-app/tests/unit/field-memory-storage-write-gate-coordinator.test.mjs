import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import {
  StorageWriteGateCoordinator,
} from "../../apps/api/src/infrastructure/storage/storage-write-gate-coordinator.service.ts";
import {
  StorageWriteGateBlockedError,
} from "../../apps/api/src/infrastructure/storage/storage-write-gate-state.ts";

function fakePrisma(overrides = {}) {
  const gate = {
    id: "gate_0001",
    environmentKey: "production",
    storageRoot: "/data/semse-storage",
    phase: "OPEN",
    writerCoverageComplete: false,
    version: 0,
    lastTransitionTicket: null,
    frozenAt: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  };
  const operations = [];
  const logs = [];
  let seq = 0;

  const tx = {
    storageWriteGate: {
      async findUnique({ where }) {
        if (where.id) return where.id === gate.id ? { ...gate } : null;
        const key = where.environmentKey_storageRoot;
        if (key && key.environmentKey === gate.environmentKey && key.storageRoot === gate.storageRoot) {
          return { ...gate };
        }
        return null;
      },
      async update({ where, data }) {
        assert.equal(where.id, gate.id);
        if (data.phase !== undefined) gate.phase = data.phase;
        if (data.writerCoverageComplete !== undefined) gate.writerCoverageComplete = data.writerCoverageComplete;
        if (data.lastTransitionTicket !== undefined) gate.lastTransitionTicket = data.lastTransitionTicket;
        if (data.frozenAt !== undefined) gate.frozenAt = data.frozenAt;
        if (data.version?.increment) gate.version += data.version.increment;
        gate.updatedAt = new Date();
        return { ...gate };
      },
    },
    storageWriteOperation: {
      async findUnique({ where }) {
        if (where.id) return operations.find(o => o.id === where.id) ?? null;
        const key = where.gateId_operationKey;
        if (key) {
          return operations.find(o =>
            o.gateId === key.gateId && o.operationKey === key.operationKey) ?? null;
        }
        return null;
      },
      async count({ where }) {
        return operations.filter(o =>
          o.gateId === where.gateId && o.status === where.status).length;
      },
      async create({ data }) {
        const row = {
          id: `operation_${String(++seq).padStart(4, "0")}`,
          admittedAt: new Date(),
          completedAt: null,
          ambiguityReason: null,
          ...data,
        };
        operations.push(row);
        return { ...row };
      },
      async update({ where, data }) {
        const row = operations.find(o => o.id === where.id);
        assert.ok(row);
        Object.assign(row, data);
        return { ...row };
      },
    },
    storageWriteGateTransitionLog: {
      async create({ data }) {
        const row = { id: `log_${logs.length + 1}`, createdAt: new Date(), ...data };
        logs.push(row);
        return { ...row };
      },
    },
    async $queryRaw() {
      return [{ id: gate.id }];
    },
  };

  const prisma = {
    async $transaction(fn) {
      if (overrides.transactionError) throw overrides.transactionError;
      return fn(tx);
    },
  };

  return { prisma, gate, operations, logs };
}

const scope = { environmentKey: "production", storageRoot: "/data/semse-storage" };
const admin = (action, extra = {}) => ({
  action,
  administratorAuthorized: true,
  ticket: "RECOVERY:954:001",
  ...extra,
});

async function blocked(promise, reason) {
  await assert.rejects(promise, error =>
    error instanceof StorageWriteGateBlockedError && error.reason === reason);
}

test("admission is idempotent and BEGIN_DRAIN serializes away new writers", async () => {
  const h = fakePrisma();
  const service = new StorageWriteGateCoordinator(h.prisma);

  const first = await service.admitOperation({
    scope, operationKey: "upload:0001", writerKind: "uploads.put",
  });
  const retry = await service.admitOperation({
    scope, operationKey: "upload:0001", writerKind: "uploads.put",
  });
  assert.equal(retry.id, first.id);
  assert.equal(h.operations.length, 1);

  const draining = await service.transition(scope, admin("BEGIN_DRAIN"));
  assert.equal(draining.phase, "DRAINING");
  assert.equal(draining.activeOperations, 1);

  // A retry of the already-admitted operation remains resolvable during drain.
  const retryDuringDrain = await service.admitOperation({
    scope, operationKey: "upload:0001", writerKind: "uploads.put",
  });
  assert.equal(retryDuringDrain.id, first.id);

  await blocked(service.admitOperation({
    scope, operationKey: "upload:0002", writerKind: "uploads.put",
  }), "not_open");
});

test("FROZEN is impossible until writer coverage is complete and ACTIVE reaches zero", async () => {
  const h = fakePrisma();
  const service = new StorageWriteGateCoordinator(h.prisma);

  const operation = await service.admitOperation({
    scope, operationKey: "evidence:0001", writerKind: "evidence.register",
  });
  await service.transition(scope, admin("BEGIN_DRAIN"));
  await service.setWriterCoverage(scope, {
    complete: true,
    administratorAuthorized: true,
    ticket: "RECOVERY:954:COVERAGE",
  });

  await blocked(service.transition(scope, admin("MARK_FROZEN")), "active_operations");

  const completed = await service.completeOperation(operation.id);
  assert.equal(completed.status, "COMPLETED");

  const frozen = await service.transition(scope, admin("MARK_FROZEN"));
  assert.equal(frozen.phase, "FROZEN");
  assert.equal(frozen.activeOperations, 0);
  assert.equal(frozen.ambiguousOperations, 0);
  assert.equal(frozen.writerCoverageComplete, true);
  assert.ok(h.logs.some(l => l.action === "MARK_FROZEN"));
});

test("an ambiguous writer blocks freeze and cannot be cleared by an idempotent retry", async () => {
  const h = fakePrisma();
  const service = new StorageWriteGateCoordinator(h.prisma);

  const operation = await service.admitOperation({
    scope, operationKey: "multipart:0001", writerKind: "evidence.multipart",
  });
  await service.transition(scope, admin("BEGIN_DRAIN"));
  await service.setWriterCoverage(scope, {
    complete: true,
    administratorAuthorized: true,
    ticket: "RECOVERY:954:COVERAGE",
  });
  const ambiguous = await service.markOperationAmbiguous(operation.id, "worker exited during publication");
  assert.equal(ambiguous.status, "AMBIGUOUS");

  await blocked(service.transition(scope, admin("MARK_FROZEN")), "ambiguous_operations");
  await blocked(service.admitOperation({
    scope, operationKey: "multipart:0001", writerKind: "evidence.multipart",
  }), "operation_ambiguous");
});

test("publication requires the persisted ACTIVE ticket and is allowed during drain only for that ticket", async () => {
  const h = fakePrisma();
  const service = new StorageWriteGateCoordinator(h.prisma);

  const operation = await service.admitOperation({
    scope, operationKey: "browser:0001", writerKind: "browser-agent.evidence",
  });
  await service.transition(scope, admin("BEGIN_DRAIN"));
  await assert.doesNotReject(service.assertPublication(operation.id));

  await service.abortOperation(operation.id);
  await blocked(service.assertPublication(operation.id), "missing_active_ticket");
});

test("thaw remains explicit and requires a closed recovery window", async () => {
  const h = fakePrisma();
  const service = new StorageWriteGateCoordinator(h.prisma);

  await service.setWriterCoverage(scope, {
    complete: true,
    administratorAuthorized: true,
    ticket: "RECOVERY:954:COVERAGE",
  });
  await service.transition(scope, admin("BEGIN_DRAIN"));
  await service.transition(scope, admin("MARK_FROZEN"));

  await blocked(service.transition(scope, admin("THAW")), "recovery_window_not_closed");
  const open = await service.transition(scope, admin("THAW", { recoveryWindowClosed: true }));
  assert.equal(open.phase, "OPEN");
});

test("authority failure has no in-memory or permissive fallback", async () => {
  const h = fakePrisma({ transactionError: new Error("database unavailable") });
  const service = new StorageWriteGateCoordinator(h.prisma);
  await assert.rejects(
    service.admitOperation({
      scope, operationKey: "upload:0001", writerKind: "uploads.put",
    }),
    /database unavailable/,
  );
});

test("scope is canonical and tied to the Railway /data filesystem", async () => {
  const h = fakePrisma();
  const service = new StorageWriteGateCoordinator(h.prisma);
  await blocked(service.getSnapshot({
    environmentKey: "production",
    storageRoot: "/data/semse-storage/../tmp",
  }), "invalid_scope");
  await blocked(service.getSnapshot({
    environmentKey: "production",
    storageRoot: "C:\\semse-storage",
  }), "invalid_scope");
});

test("S2 does not activate the coordinator in production writers", async () => {
  const files = [
    "apps/api/src/infrastructure/storage/storage.service.ts",
    "apps/api/src/modules/evidence/evidence.controller.ts",
    "apps/api/src/modules/browser-agent/browser-agent.service.ts",
  ];
  for (const file of files) {
    const source = await readFile(file, "utf8");
    assert.doesNotMatch(source, /StorageWriteGateCoordinator/);
  }
});
