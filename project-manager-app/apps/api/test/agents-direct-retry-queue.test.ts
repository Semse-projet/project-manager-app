import "reflect-metadata";
import assert from "node:assert/strict";
import test from "node:test";

import { AgentsService } from "../dist/modules/agents/agents.service.js";

// The direct /v1/agents/runs/:runId/retry route must reuse the same durable
// BullMQ retry mode already used by Mission Control, not the create mode that
// silently ignores a retained failed/completed job with the same jobId.

const actor = {
  tenantId: "tenant_a",
  orgId: "org_a",
  userId: "operator_a",
  runId: "run_1",
  requestId: "req_1",
};

function makeService(enqueueResult: { enqueued: boolean; reason?: "JOB_ACTIVE" | "QUEUE_UNAVAILABLE" | "QUEUE_ERROR" }) {
  const queueCalls: Array<{ input: Record<string, unknown>; options?: { mode?: string } }> = [];
  const auditCalls: Array<Record<string, unknown>> = [];
  const svc = Object.create(AgentsService.prototype) as Record<string, unknown>;
  svc.agentsRepository = {
    async retry(input: Record<string, unknown>) {
      assert.equal(input.tenantId, actor.tenantId);
      return { id: actor.runId, tenantId: actor.tenantId, agentType: "browser-agent", correlationId: "corr_1", status: "queued" };
    },
  };
  svc.auditService = { async append(input: Record<string, unknown>) { auditCalls.push(input); } };
  svc.agentQueueService = {
    async enqueueRun(input: Record<string, unknown>, options?: { mode?: string }) {
      queueCalls.push({ input, options });
      return enqueueResult;
    },
  };
  return { svc: svc as unknown as AgentsService, queueCalls, auditCalls };
}

test("direct retry uses durable queue retry mode and tenant-scoped run id", async () => {
  const h = makeService({ enqueued: true });
  const response = await h.svc.retry(actor);
  assert.equal(response.enqueued, true);
  assert.equal(response.status, "queued");
  assert.equal(h.queueCalls.length, 1);
  assert.deepEqual(h.queueCalls[0], {
    input: { runId: "run_1", tenantId: "tenant_a", agentType: "browser-agent", correlationId: "corr_1" },
    options: { mode: "retry" },
  });
  assert.equal(h.auditCalls[0]?.action, "agent.run.retry");
  assert.equal(h.auditCalls[0]?.tenantId, "tenant_a");
});

test("direct retry never disguises unavailable Redis as successful enqueue", async () => {
  const h = makeService({ enqueued: false, reason: "QUEUE_UNAVAILABLE" });
  const response = await h.svc.retry(actor);
  assert.equal(response.status, "queued"); // DB transition is preserved
  assert.equal(response.enqueued, false);
  assert.equal(response.reason, "QUEUE_UNAVAILABLE");
});

test("direct retry reports a retained active job and a queue error", async () => {
  for (const reason of ["JOB_ACTIVE", "QUEUE_ERROR"] as const) {
    const h = makeService({ enqueued: false, reason });
    const result = await h.svc.retry(actor);
    assert.equal(result.enqueued, false);
    assert.equal(result.reason, reason);
    assert.equal(h.queueCalls[0]?.options?.mode, "retry");
  }
});
