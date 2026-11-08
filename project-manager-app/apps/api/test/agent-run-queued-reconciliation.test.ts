import "reflect-metadata";
import test from "node:test";
import assert from "node:assert/strict";
import { AgentsService } from "../dist/modules/agents/agents.service.js";
import { AgentsRepository } from "../dist/modules/agents/agents.repository.js";

const base = { tenantId: "tenant_A", orgId: "org_ops", userId: "user_ops",
  staleAfterMs: 30000, maxItems: 2, requestId: "req_reconcile" };
const fake = (id: string, tenantId = "tenant_A", attempts = 1) => ({
  id, tenantId, agentType: "pricing", correlationId: "cor_" + id,
  status: "queued", deadLettered: false, attempts, maxAttempts: 3,
});
function makeService(queued: ReturnType<typeof fake>[]) {
  const calls: { afterRunId?: string; tenantId: string; maxItems: number }[] = [];
  const enqueues: { id: string; tenant: string; mode: string }[] = [];
  const repository = {
    async reclaimStale() { return []; },
    async listQueuedForDelivery(input: { afterRunId?: string; tenantId: string; maxItems: number }) {
      calls.push({ afterRunId: input.afterRunId, tenantId: input.tenantId, maxItems: input.maxItems });
      return queued.filter(q => q.tenantId === input.tenantId && (!input.afterRunId || q.id > input.afterRunId))
        .slice(0, input.maxItems);
    },
  };
  const queue = {
    async enqueueRun(run: { runId: string; tenantId: string }, opts: { mode: string }) {
      enqueues.push({ id: run.runId, tenant: run.tenantId, mode: opts.mode });
      return { enqueued: true };
    },
  };
  const service = new AgentsService(
    repository as never,
    { async append() { /* no reclaimed audit */ } } as never,
    queue as never,
    {} as never, {} as never, {} as never, {} as never, {} as never,
  );
  return { service, calls, enqueues };
}

test("reconciliation scans existing QUEUED runs even when no stale RUNNING was changed", async () => {
  const { service, calls, enqueues } = makeService([fake("run_1"), fake("run_2"), fake("run_3")]);
  const first = await service.reclaimStale(base);
  assert.equal(first.reclaimedCount, 0);
  assert.equal(first.queuedDeliveryReconciled, 2);
  assert.deepEqual(enqueues.map(x=>x.id), ["run_1", "run_2"]);
  assert.ok(enqueues.every(x=>x.mode === "retry" && x.tenant === "tenant_A"));
  const second = await service.reclaimStale(base);
  assert.equal(second.queuedDeliveryReconciled, 1);
  assert.deepEqual(enqueues.map(x=>x.id), ["run_1", "run_2", "run_3"]);
  const third = await service.reclaimStale(base);
  assert.equal(third.queuedDeliveryReconciled, 2, "cursor wraps to revisit earlier queued runs");
  assert.deepEqual(calls.map(x=>x.afterRunId), [undefined, "run_2", "run_3", undefined]);
});

test("queue outages do not falsely report delivery; scanning continues on later sweeps", async () => {
  const { service } = makeService([fake("run_1")]);
  (service as any).agentQueueService.enqueueRun = async () => ({
    enqueued: false, reason: "QUEUE_UNAVAILABLE",
  });
  const result = await service.reclaimStale(base);
  assert.equal(result.queuedDeliveryScanned, 1);
  assert.equal(result.queuedDeliveryReconciled, 0);
  assert.equal(result.queuedDeliveryBlocked, 1);
});

test("queued projection is tenant-filtered and bounded by 20", async () => {
  const seen: any[] = [];
  const repo = new AgentsRepository({
    agentRun: {
      async findMany(query: unknown) { seen.push(query); return []; },
    },
  } as never, { async ensureActorContext() {} } as never);
  await repo.listQueuedForDelivery({
    tenantId: "tenant_A", orgId: "org_A", userId: "user_A", maxItems: 100,
    afterRunId: "run_2",
  });
  assert.equal(seen.length, 1);
  assert.equal(seen[0].where.tenantId, "tenant_A");
  assert.equal(seen[0].where.status, "QUEUED");
  assert.equal(seen[0].where.deadLettered, false);
  assert.deepEqual(seen[0].where.id, { gt: "run_2" });
  assert.equal(seen[0].take, 20);
});
