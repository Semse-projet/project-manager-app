import "reflect-metadata";
import assert from "node:assert/strict";
import test from "node:test";
import { AgentsRepository } from "../dist/modules/agents/agents.repository.js";

// Two workers may both read the same queued row before either attempts the
// claim. Only a conditional update is sufficient to prevent both proceeding.
const now = new Date();
const row = {
  id: "run_1",
  tenantId: "tenant_a",
  agentType: "pricing",
  triggerType: "manual",
  inputJson: {},
  status: "QUEUED",
  correlationId: "corr_1",
  workerId: null as string | null,
  attempts: 0,
  maxAttempts: 3,
  deadLettered: false,
  outputJson: null,
  error: null,
  startedAt: null as Date | null,
  heartbeatAt: null as Date | null,
  endedAt: null as Date | null,
  durationMs: null,
  toolCallCount: 0,
  createdAt: now,
  updatedAt: now,
};
type Row = typeof row;

function makeRepo(opts: { changedBeforeClaim?: boolean; exhausted?: boolean } = {}) {
  const persisted: Row = { ...row, attempts: opts.exhausted ? 3 : 0 };
  const whereClauses: Record<string, unknown>[] = [];
  let successfulClaims = 0;
  const tx = {
    agentRun: {
      async findFirst({ where }: { where: Record<string, unknown> }) {
        // The first read intentionally returns the stale QUEUED snapshot to
        // mimic two workers observing the same row concurrently.
        if (where.status === "QUEUED") return { ...row, attempts: persisted.attempts };
        if (where.status === "RUNNING") {
          return persisted.status === "RUNNING" && persisted.workerId === where.workerId
            ? { ...persisted }
            : null;
        }
        throw new Error("unexpected findFirst call");
      },
      async updateMany({ where, data }: {
        where: Record<string, unknown>;
        data: Record<string, unknown>;
      }) {
        whereClauses.push(where);
        if (opts.changedBeforeClaim || persisted.status !== "QUEUED" ||
            persisted.deadLettered || persisted.attempts >= persisted.maxAttempts) {
          return { count: 0 };
        }
        persisted.status = String(data.status);
        persisted.workerId = String(data.workerId);
        persisted.attempts += 1;
        persisted.startedAt = data.startedAt as Date;
        persisted.heartbeatAt = data.heartbeatAt as Date;
        successfulClaims++;
        return { count: 1 };
      },
    },
  };
  const repository = new AgentsRepository(
    { async $transaction(fn: (trx: typeof tx) => unknown) { return fn(tx); } } as never,
    { async ensureActorContext() { /* isolated authorized actor */ } } as never,
  );
  return { repository, whereClauses, getSuccessfulClaims: () => successfulClaims };
}

const actor = {
  tenantId: "tenant_a",
  orgId: "org_a",
  userId: "user_a",
  agentType: "pricing" as const,
};

test("only one worker can claim a run after both selected the same queued row", async () => {
  const h = makeRepo();
  const first = await h.repository.claimNext({ ...actor, workerId: "worker_1" });
  const second = await h.repository.claimNext({ ...actor, workerId: "worker_2" });
  assert.equal(first?.status, "running");
  assert.equal(first?.workerId, "worker_1");
  assert.equal(first?.attempts, 1);
  assert.equal(second, null);
  assert.equal(h.getSuccessfulClaims(), 1);
  assert.equal(h.whereClauses[0]?.tenantId, "tenant_a");
  assert.equal(h.whereClauses[0]?.status, "QUEUED");
  assert.equal(h.whereClauses[0]?.deadLettered, false);
  assert.deepEqual(h.whereClauses[0]?.attempts, { lt: 3 });
  assert.equal(h.whereClauses[0]?.agentType, "pricing");
});

test("failed compare-and-set does not return an unclaimed run", async () => {
  const h = makeRepo({ changedBeforeClaim: true });
  const result = await h.repository.claimNext({ ...actor, workerId: "worker_1" });
  assert.equal(result, null);
  assert.equal(h.getSuccessfulClaims(), 0);
});

test("exhausted runs are never claimed", async () => {
  const h = makeRepo({ exhausted: true });
  const result = await h.repository.claimNext({ ...actor, workerId: "worker_1" });
  assert.equal(result, null);
  assert.equal(h.getSuccessfulClaims(), 0);
});
