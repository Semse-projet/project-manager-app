import "reflect-metadata";

import assert from "node:assert/strict";
import test from "node:test";
import { AgentQueueService, prepareRetryJob } from "../dist/infrastructure/queue/agent-queue.service.js";
import { OpsService } from "../dist/modules/ops/ops.service.js";

const INPUT = { runId: "run1", tenantId: "tenant_default", agentType: "browser-agent", correlationId: "c1" };
const JOB_ID = "tenant_default__run1";

type FakeJob = { state: string; removed: boolean; removeThrows?: boolean };

function fakeQueue(job: FakeJob | null, opts: { goneAfterFailedRemove?: boolean } = {}) {
  const calls = { add: [] as Array<{ name: string; opts: { jobId: string } }>, getJob: 0 };
  const queue = {
    calls,
    async getJob(id: string) {
      calls.getJob += 1;
      assert.equal(id, JOB_ID);
      if (!job || job.removed) return null;
      return {
        getState: async () => job.state,
        remove: async () => {
          if (job.removeThrows) {
            if (opts.goneAfterFailedRemove) job.removed = true;
            throw new Error("job locked or missing");
          }
          job.removed = true;
        },
      };
    },
    async add(name: string, _data: unknown, o: { jobId: string }) {
      calls.add.push({ name, opts: o });
    },
  };
  return queue;
}

function serviceWith(queue: unknown) {
  const service = new AgentQueueService();
  (service as unknown as { queue: unknown }).queue = queue;
  return service;
}

test("P1: retry with a retained failed/completed job removes it and adds a new one", async () => {
  for (const state of ["failed", "completed"]) {
    const job: FakeJob = { state, removed: false };
    const queue = fakeQueue(job);
    const result = await serviceWith(queue).enqueueRun(INPUT, { mode: "retry" });
    assert.deepEqual(result, { enqueued: true });
    assert.equal(job.removed, true, `${state}: previous job must be removed`);
    assert.equal(queue.calls.add.length, 1, `${state}: new job must be added`);
    assert.equal(queue.calls.add[0].opts.jobId, JOB_ID);
  }
});

test("P2: retry keeps pending work and does not duplicate it", async () => {
  for (const state of ["waiting", "delayed", "prioritized"]) {
    const job: FakeJob = { state, removed: false };
    const queue = fakeQueue(job);
    const result = await serviceWith(queue).enqueueRun(INPUT, { mode: "retry" });
    assert.deepEqual(result, { enqueued: true });
    assert.equal(job.removed, false);
    assert.equal(queue.calls.add.length, 0);
  }
});

test("P3: retry never touches an active job and reports JOB_ACTIVE", async () => {
  const job: FakeJob = { state: "active", removed: false };
  const queue = fakeQueue(job);
  const result = await serviceWith(queue).enqueueRun(INPUT, { mode: "retry" });
  assert.deepEqual(result, { enqueued: false, reason: "JOB_ACTIVE" });
  assert.equal(job.removed, false);
  assert.equal(queue.calls.add.length, 0);
});

test("retry adds directly when no previous job exists", async () => {
  const queue = fakeQueue(null);
  assert.deepEqual(await serviceWith(queue).enqueueRun(INPUT, { mode: "retry" }), { enqueued: true });
  assert.equal(queue.calls.add.length, 1);
});

test("edge: job removed concurrently between getJob and remove does not break the retry", async () => {
  const job: FakeJob = { state: "failed", removed: false, removeThrows: true };
  const queue = fakeQueue(job, { goneAfterFailedRemove: true });
  assert.deepEqual(await serviceWith(queue).enqueueRun(INPUT, { mode: "retry" }), { enqueued: true });
  assert.equal(queue.calls.add.length, 1);
});

test("edge: a failed job that cannot be removed is reported, not silently dropped", async () => {
  const job: FakeJob = { state: "failed", removed: false, removeThrows: true };
  const queue = fakeQueue(job);
  assert.deepEqual(await serviceWith(queue).enqueueRun(INPUT, { mode: "retry" }), { enqueued: false, reason: "QUEUE_ERROR" });
  assert.equal(queue.calls.add.length, 0);
});

test("edge: only the id built from the actor's tenant is ever looked up", async () => {
  const seen: string[] = [];
  const queue = { getJob: async (id: string) => { seen.push(id); return null; }, add: async () => undefined };
  await serviceWith(queue).enqueueRun({ ...INPUT, tenantId: "tenant_b" }, { mode: "retry" });
  assert.deepEqual(seen, ["tenant_b__run1"]);
});

test("P4: retry with the queue unavailable reports QUEUE_UNAVAILABLE instead of succeeding", async () => {
  const service = new AgentQueueService();
  (service as unknown as { ensureQueueConnected: () => Promise<void> }).ensureQueueConnected = async () => undefined;
  assert.deepEqual(await service.enqueueRun(INPUT, { mode: "retry" }), { enqueued: false, reason: "QUEUE_UNAVAILABLE" });
});

test("P5: create mode is unchanged (idempotent add, no getJob lookup, errors propagate)", async () => {
  const queue = fakeQueue({ state: "failed", removed: false });
  assert.deepEqual(await serviceWith(queue).enqueueRun(INPUT), { enqueued: true });
  assert.equal(queue.calls.getJob, 0);
  assert.equal(queue.calls.add.length, 1);

  const failing = { add: async () => { throw new Error("redis down"); } };
  await assert.rejects(serviceWith(failing).enqueueRun(INPUT), /redis down/);
});

test("prepareRetryJob: unrecognised state is not guessed", async () => {
  const q = { getJob: async () => ({ getState: async () => "unknown", remove: async () => undefined }) };
  assert.equal((await prepareRetryJob(q, JOB_ID)).decision, "error");
});

test("OpsService.retryAgentRun/requeueAgentRun use retry mode and propagate enqueued/reason", async () => {
  const run = { id: "run1", agentType: "browser-agent", correlationId: "c1", status: "QUEUED", deadLettered: false };
  const modes: string[] = [];
  const service = Object.create(OpsService.prototype) as Record<string, unknown>;
  service.actorContextService = { ensureActorContext: async () => undefined };
  service.opsRepository = { retryAgentRun: async () => run, requeueAgentRun: async () => run };
  service.auditService = { append: async () => undefined };
  service.agentQueueService = {
    enqueueRun: async (_i: unknown, o?: { mode?: string }) => {
      modes.push(o?.mode ?? "create");
      return { enqueued: false, reason: "JOB_ACTIVE" };
    },
  };
  const args = { tenantId: "tenant_default", orgId: "o", userId: "u", runId: "run1", requestId: "r" };
  const svc = service as unknown as OpsService;
  const retry = await svc.retryAgentRun(args);
  const requeue = await svc.requeueAgentRun(args);
  assert.deepEqual(modes, ["retry", "retry"]);
  for (const r of [retry, requeue]) {
    assert.equal(r.enqueued, false);
    assert.equal(r.reason, "JOB_ACTIVE");
  }
});
