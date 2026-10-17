import test from "node:test";
import assert from "node:assert/strict";
import {
  StorageWriteGateCoordinator,
} from "../dist/infrastructure/storage/storage-write-gate-coordinator.service.js";
import {
  StorageWriteGateBlockedError,
} from "../dist/infrastructure/storage/storage-write-gate-state.js";

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
        if (
          key &&
          key.environmentKey === gate.environmentKey &&
          key.storageRoot === gate.storageRoot
        ) {
          return { ...gate };
        }
        return null;
      },
      async update({ where, data }) {
        assert.equal(where.id, gate.id);
        if (data.phase !== undefined) gate.phase = data.phase;
        if (data.writerCoverageComplete !== undefined) {
          gate.writerCoverageComplete = data.writerCoverageComplete;
        }
        if (data.lastTransitionTicket !== undefined) {
          gate.lastTransitionTicket = data.lastTransitionTicket;
        }
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
          return operations.find(
            o => o.gateId === key.gateId && o.operationKey === key.operationKey,
          ) ?? null;
        }
        return null;
      },
      async count({ where }) {
        return operations.filter(
          o => o.gateId === where.gateId && o.status === where.status,
        ).length;
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
      async findUnique({ where }) {
        const key = where.gateId_idempotencyKey;
        if (!key) return null;
        return logs.find(
          log => log.gateId === key.gateId &&
            log.idempotencyKey === key.idempotencyKey,
        ) ?? null;
      },
      async create({ data }) {
        const row = {
          id: `log_${logs.length + 1}`,
          createdAt: new Date(),
          ...data,
        };
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

const scope = {
  environmentKey: "production",
  storageRoot: "/data/semse-storage",
};

const admin = (action, extra = {}) => ({
  action,
  administratorAuthorized: true,
  ticket: "RECOVERY:954:001",
  idempotencyKey: `idem:${String(action).toLowerCase()}:001`,
  actorId: "ops:admin:001",
  reason: "field-memory recovery window",
  ...extra,
});

const coverage = (extra = {}) => ({
  complete: true,
  administratorAuthorized: true,
  ticket: "RECOVERY:954:COVERAGE",
  idempotencyKey: "idem:coverage:001",
  actorId: "ops:admin:001",
  reason: "verified writer inventory",
  ...extra,
});

async function blocked(promise, reason) {
  await assert.rejects(
    promise,
    error =>
      error instanceof StorageWriteGateBlockedError &&
      error.reason === reason,
  );
}

test("admission is idempotent and BEGIN_DRAIN serializes away new writers", async () => {
  const h = fakePrisma();
  const service = new StorageWriteGateCoordinator(h.prisma);

  const first = await service.admitOperation({
    scope,
    operationKey: "upload:0001",
    writerKind: "uploads.put",
  });
  const retry = await service.admitOperation({
    scope,
    operationKey: "upload:0001",
    writerKind: "uploads.put",
  });
  assert.equal(retry.id, first.id);
  assert.equal(h.operations.length, 1);

  const draining = await service.transition(scope, admin("BEGIN_DRAIN"));
  assert.equal(draining.phase, "DRAINING");
  assert.equal(draining.activeOperations, 1);

  const retryDuringDrain = await service.admitOperation({
    scope,
    operationKey: "upload:0001",
    writerKind: "uploads.put",
  });
  assert.equal(retryDuringDrain.id, first.id);

  await blocked(
    service.admitOperation({
      scope,
      operationKey: "upload:0002",
      writerKind: "uploads.put",
    }),
    "not_open",
  );
});

test("FROZEN requires complete writer coverage and zero ACTIVE operations", async () => {
  const h = fakePrisma();
  const service = new StorageWriteGateCoordinator(h.prisma);

  const operation = await service.admitOperation({
    scope,
    operationKey: "evidence:0001",
    writerKind: "evidence.register",
  });
  await service.transition(scope, admin("BEGIN_DRAIN"));
  await service.setWriterCoverage(scope, coverage());

  await blocked(
    service.transition(scope, admin("MARK_FROZEN")),
    "active_operations",
  );

  const completed = await service.completeOperation(operation.id);
  assert.equal(completed.status, "COMPLETED");

  const frozen = await service.transition(scope, admin("MARK_FROZEN"));
  assert.equal(frozen.phase, "FROZEN");
  assert.equal(frozen.activeOperations, 0);
  assert.equal(frozen.ambiguousOperations, 0);
  assert.equal(frozen.writerCoverageComplete, true);
  assert.ok(h.logs.some(log => log.action === "MARK_FROZEN"));
});

test("AMBIGUOUS operations fail closed and cannot be cleared by retry", async () => {
  const h = fakePrisma();
  const service = new StorageWriteGateCoordinator(h.prisma);

  const operation = await service.admitOperation({
    scope,
    operationKey: "multipart:0001",
    writerKind: "evidence.multipart",
  });
  await service.transition(scope, admin("BEGIN_DRAIN"));
  await service.setWriterCoverage(scope, coverage());

  const ambiguous = await service.markOperationAmbiguous(
    operation.id,
    "worker exited during publication",
  );
  assert.equal(ambiguous.status, "AMBIGUOUS");

  await blocked(
    service.transition(scope, admin("MARK_FROZEN")),
    "ambiguous_operations",
  );
  await blocked(
    service.admitOperation({
      scope,
      operationKey: "multipart:0001",
      writerKind: "evidence.multipart",
    }),
    "operation_ambiguous",
  );
});

test("publication requires a persisted ACTIVE ticket and remains fenced during drain", async () => {
  const h = fakePrisma();
  const service = new StorageWriteGateCoordinator(h.prisma);

  const operation = await service.admitOperation({
    scope,
    operationKey: "browser:0001",
    writerKind: "browser-agent.evidence",
  });
  await service.transition(scope, admin("BEGIN_DRAIN"));
  await assert.doesNotReject(service.assertPublication(operation.id));

  await service.abortOperation(operation.id);
  await blocked(
    service.assertPublication(operation.id),
    "missing_active_ticket",
  );
});

test("thaw remains explicit and requires a closed recovery window", async () => {
  const h = fakePrisma();
  const service = new StorageWriteGateCoordinator(h.prisma);

  await service.transition(scope, admin("BEGIN_DRAIN"));
  await service.setWriterCoverage(scope, coverage());
  await service.transition(scope, admin("MARK_FROZEN"));

  await blocked(
    service.transition(scope, admin("THAW")),
    "recovery_window_not_closed",
  );

  const open = await service.transition(
    scope,
    admin("THAW", { recoveryWindowClosed: true }),
  );
  assert.equal(open.phase, "OPEN");
});

test("writer coverage is fresh for every recovery window", async () => {
  const h = fakePrisma();
  h.gate.writerCoverageComplete = true;
  const service = new StorageWriteGateCoordinator(h.prisma);

  const draining = await service.transition(scope, admin("BEGIN_DRAIN"));
  assert.equal(draining.phase, "DRAINING");
  assert.equal(draining.writerCoverageComplete, false);

  const covered = await service.setWriterCoverage(scope, coverage());
  assert.equal(covered.writerCoverageComplete, true);

  const frozen = await service.transition(scope, admin("MARK_FROZEN"));
  assert.equal(frozen.phase, "FROZEN");
  assert.equal(frozen.writerCoverageComplete, true);

  const thawed = await service.transition(
    scope,
    admin("THAW", { recoveryWindowClosed: true }),
  );
  assert.equal(thawed.phase, "OPEN");
  assert.equal(thawed.writerCoverageComplete, false);

  await blocked(
    service.setWriterCoverage(
      scope,
      coverage({ idempotencyKey: "idem:coverage:002" }),
    ),
    "coverage_requires_draining",
  );
});

test("administrative booleans reject truthy string coercion", async () => {
  const h = fakePrisma();
  const service = new StorageWriteGateCoordinator(h.prisma);

  await blocked(
    service.transition(
      scope,
      { ...admin("BEGIN_DRAIN"), administratorAuthorized: "true" },
    ),
    "administrator_required",
  );

  await service.transition(scope, admin("BEGIN_DRAIN"));
  await blocked(
    service.setWriterCoverage(
      scope,
      coverage({
        idempotencyKey: "idem:coverage:coercion",
        complete: "true",
      }),
    ),
    "invalid_coverage_value",
  );
});

test("runtime-invalid missing tokens fail closed instead of string coercion", async () => {
  const h = fakePrisma();
  const service = new StorageWriteGateCoordinator(h.prisma);

  await blocked(
    service.transition(
      scope,
      { ...admin("BEGIN_DRAIN"), idempotencyKey: undefined },
    ),
    "invalid_idempotency_key",
  );

  await blocked(
    service.admitOperation({
      scope,
      operationKey: "upload:0001",
      writerKind: undefined,
    }),
    "invalid_writer_kind",
  );
});

test("administrative command replay is durable and has no second effect", async () => {
  const h = fakePrisma();
  const service = new StorageWriteGateCoordinator(h.prisma);

  const request = admin("BEGIN_DRAIN");
  const first = await service.transition(scope, request);
  assert.equal(first.phase, "DRAINING");
  assert.equal(first.replayed, false);
  assert.equal(h.logs.length, 1);

  const replay = await service.transition(scope, request);
  assert.equal(replay.phase, "DRAINING");
  assert.equal(replay.replayed, true);
  assert.equal(h.logs.length, 1);
  assert.equal(h.gate.version, 1);
});

test("reusing an idempotency key with different semantics fails closed", async () => {
  const h = fakePrisma();
  const service = new StorageWriteGateCoordinator(h.prisma);

  const request = admin("BEGIN_DRAIN");
  await service.transition(scope, request);

  await blocked(
    service.transition(
      scope,
      admin("BEGIN_DRAIN", {
        idempotencyKey: request.idempotencyKey,
        reason: "different recovery window",
      }),
    ),
    "idempotency_conflict",
  );
  assert.equal(h.logs.length, 1);
  assert.equal(h.gate.version, 1);
});

test("idempotent replay never bypasses administrator authorization", async () => {
  const h = fakePrisma();
  const service = new StorageWriteGateCoordinator(h.prisma);

  const request = admin("BEGIN_DRAIN");
  await service.transition(scope, request);

  await blocked(
    service.transition(
      scope,
      { ...request, administratorAuthorized: false },
    ),
    "administrator_required",
  );
  assert.equal(h.logs.length, 1);
  assert.equal(h.gate.version, 1);
});

test("administrative audit identity and reason are mandatory", async () => {
  const h = fakePrisma();
  const service = new StorageWriteGateCoordinator(h.prisma);

  await blocked(
    service.transition(scope, admin("BEGIN_DRAIN", { actorId: "" })),
    "invalid_actor_id",
  );
  await blocked(
    service.transition(scope, admin("BEGIN_DRAIN", { reason: "" })),
    "invalid_reason",
  );
});

test("database authority failure has no permissive in-memory fallback", async () => {
  const h = fakePrisma({
    transactionError: new Error("database unavailable"),
  });
  const service = new StorageWriteGateCoordinator(h.prisma);

  await assert.rejects(
    service.admitOperation({
      scope,
      operationKey: "upload:0001",
      writerKind: "uploads.put",
    }),
    /database unavailable/,
  );
});

test("scope must be a canonical Railway /data path", async () => {
  const h = fakePrisma();
  const service = new StorageWriteGateCoordinator(h.prisma);

  await blocked(
    service.getSnapshot({
      environmentKey: "production",
      storageRoot: "/data/semse-storage/../tmp",
    }),
    "invalid_scope",
  );
  await blocked(
    service.getSnapshot({
      environmentKey: "production",
      storageRoot: "C:\\semse-storage",
    }),
    "invalid_scope",
  );
});
