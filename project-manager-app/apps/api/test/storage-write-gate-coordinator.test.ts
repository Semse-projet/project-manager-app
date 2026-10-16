import "reflect-metadata";
import test from "node:test";
import assert from "node:assert/strict";
import { StorageWriteGateCoordinator } from "../dist/infrastructure/storage/storage-write-gate-coordinator.js";
import { StorageWriteGateBlockedError } from "../dist/infrastructure/storage/storage-write-gate-state.js";

/**
 * Transaction-order simulation, NOT a replacement for a real PostgreSQL
 * two-connection concurrency test (required before enabling runtime).
 * The SQL DDL and row locking are checked separately in SDD tests.
 */
function fixture() {
  const scope = "production:/data/semse-storage";
  const gate = { scope, phase: "OPEN", epoch: 1n, coverageDigest: null };
  const operations = new Map<string, {
    id: string; scope: string; epoch: bigint; kind: string;
    writerInstanceId: string; state: string;
  }>();
  let dbDown = false;
  let hasGate = true;
  let serialized = Promise.resolve();
  const fakeTx = {
    async $queryRaw(strings: TemplateStringsArray, ...args: unknown[]) {
      const query = strings.join("?").replace(/\s+/g, " ");
      if (query.includes('FROM "StorageWriteGate"')) {
        return hasGate ? [{ ...gate }] : [];
      }
      if (query.includes("count(*)")) {
        return [{ active: BigInt([...operations.values()].filter(v => v.state === "ACTIVE").length) }];
      }
      if (query.includes('FROM "StorageWriteOperation"')) {
        const [id, requestedScope] = args;
        const operation = operations.get(String(id));
        return operation?.scope === requestedScope ? [{ ...operation }] : [];
      }
      throw new Error("Unexpected SQL read: " + query);
    },
    async $executeRaw(strings: TemplateStringsArray, ...args: unknown[]) {
      const query = strings.join("?").replace(/\s+/g, " ");
      if (query.includes('INSERT INTO "StorageWriteOperation"')) {
        const [id, itemScope, epoch, kind, instance] = args;
        operations.set(String(id), {
          id: String(id), scope: String(itemScope), epoch: BigInt(String(epoch)),
          kind: String(kind), writerInstanceId: String(instance), state: "ACTIVE",
        });
        return 1;
      }
      if (query.includes('UPDATE "StorageWriteOperation"')) {
        const [state, id, itemScope] = args;
        const op = operations.get(String(id));
        if (!op || op.scope !== itemScope || op.state !== "ACTIVE") return 0;
        op.state = String(state);
        return 1;
      }
      throw new Error("Unexpected SQL write: " + query);
    },
  };
  const prisma = {
    async $transaction<T>(fn: (transaction: typeof fakeTx) => Promise<T>) {
      if (dbDown) throw new Error("DB unavailable");
      const next = serialized.then(() => fn(fakeTx));
      serialized = next.then(() => undefined, () => undefined);
      return next;
    },
  };
  return {
    scope, gate, operations,
    coordinator: new StorageWriteGateCoordinator(prisma as never),
    setDbDown: (value: boolean) => { dbDown = value; },
    setGate: (value: boolean) => { hasGate = value; },
  };
}

const blocked = (reason: string) => (error: unknown) =>
  error instanceof StorageWriteGateBlockedError && error.reason === reason;

test("missing scope row fails closed rather than treating it as OPEN", async () => {
  const f = fixture(); f.setGate(false);
  await assert.rejects(() => f.coordinator.admitWrite({
    scope: f.scope, kind: "ORIGINAL_STORE", writerInstanceId: "api-instance-A",
  }), blocked("gate_not_provisioned"));
  assert.equal(f.operations.size, 0);
});

test("admission persists ACTIVE ticket and inspection shows exact count", async () => {
  const f = fixture();
  const ticket = await f.coordinator.admitWrite({
    scope: f.scope, kind: "ORIGINAL_STORE", writerInstanceId: "api-instance-A",
  });
  assert.match(ticket.id, /^[0-9a-f-]{36}$/);
  assert.equal(f.operations.get(ticket.id)?.state, "ACTIVE");
  assert.deepEqual(await f.coordinator.inspect(f.scope), {
    phase: "OPEN", epoch: 1n, activeOperations: 1, coverageDigestPresent: false,
  });
  await f.coordinator.assertActive(ticket);
  await f.coordinator.settleWrite(ticket, "COMPLETED");
  assert.equal((await f.coordinator.inspect(f.scope)).activeOperations, 0);
});

test("DRAINING rejects new work while an already admitted writer settles", async () => {
  const f = fixture();
  const ticket = await f.coordinator.admitWrite({
    scope: f.scope, kind: "MULTIPART_COMPLETE", writerInstanceId: "api-instance-A",
  });
  f.gate.phase = "DRAINING";
  await assert.rejects(() => f.coordinator.admitWrite({
    scope: f.scope, kind: "ORIGINAL_STORE", writerInstanceId: "api-instance-B",
  }), blocked("not_open"));
  await f.coordinator.assertActive(ticket);
  await f.coordinator.settleWrite(ticket, "COMPLETED");
  assert.equal((await f.coordinator.inspect(f.scope)).activeOperations, 0);
});

test("FROZEN blocks previously admitted ticket before publication", async () => {
  const f = fixture();
  const ticket = await f.coordinator.admitWrite({
    scope: f.scope, kind: "ORIGINAL_STORE", writerInstanceId: "api-instance-A",
  });
  // Such a state must be impossible for a compliant future freeze transition:
  // the pure guard correctly detects a contradictory frozen snapshot.
  f.gate.phase = "FROZEN";
  await assert.rejects(() => f.coordinator.assertActive(ticket), blocked("inconsistent_frozen_snapshot"));
  await assert.rejects(() => f.coordinator.settleWrite(ticket, "COMPLETED"), blocked("frozen_with_active_ticket"));
});

test("wrong instance, wrong epoch, and duplicate settlement cannot release tickets", async () => {
  const f = fixture();
  const ticket = await f.coordinator.admitWrite({
    scope: f.scope, kind: "ORIGINAL_STORE", writerInstanceId: "api-instance-A",
  });
  await assert.rejects(() => f.coordinator.assertActive({
    ...ticket, writerInstanceId: "api-instance-B",
  }), blocked("invalid_active_ticket"));
  await assert.rejects(() => f.coordinator.settleWrite({
    ...ticket, epoch: 2n,
  }, "COMPLETED"), blocked("invalid_active_ticket"));
  await f.coordinator.settleWrite(ticket, "FAILED_CLEAN");
  await assert.rejects(() => f.coordinator.settleWrite(ticket, "FAILED_CLEAN"), blocked("invalid_active_ticket"));
});

test("database outage does not admit or release writes", async () => {
  const f = fixture();
  const ticket = await f.coordinator.admitWrite({
    scope: f.scope, kind: "ORIGINAL_STORE", writerInstanceId: "api-instance-A",
  });
  f.setDbDown(true);
  await assert.rejects(() => f.coordinator.admitWrite({
    scope: f.scope, kind: "ORIGINAL_STORE", writerInstanceId: "api-instance-B",
  }), /DB unavailable/);
  await assert.rejects(() => f.coordinator.settleWrite(ticket, "COMPLETED"), /DB unavailable/);
  assert.equal(f.operations.get(ticket.id)?.state, "ACTIVE");
});

test("simulated concurrent admission cannot bypass DRAINING after serialized transition", async () => {
  const f = fixture();
  f.gate.phase = "DRAINING";
  const attempts = await Promise.allSettled(Array.from({length: 12}, (_, i) =>
    f.coordinator.admitWrite({
      scope: f.scope, kind: "ORIGINAL_STORE", writerInstanceId: "api-instance-" + i,
    })));
  assert.ok(attempts.every(result => result.status === "rejected"));
  assert.equal(f.operations.size, 0);
});
