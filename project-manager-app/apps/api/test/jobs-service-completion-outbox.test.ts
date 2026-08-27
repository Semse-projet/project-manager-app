import test from "node:test";
import assert from "node:assert/strict";

import { JobsService } from "../dist/modules/jobs/jobs.service.js";

function makeService(overrides: { outboxRepository?: unknown; notifications?: unknown } = {}) {
  const prisma = {
    job: {
      findFirst: async () => ({
        id: "job_1",
        status: "REVIEW",
        clientOrgId: "org_client_1",
        reservations: [{ professionalId: "usr_pro_1" }],
      }),
    },
    membership: {
      findFirst: async () => ({ userId: "usr_client_1" }),
    },
  };
  const jobsRepository = {
    updateStatus: async () => ({ id: "job_1", status: "completed" }),
  };
  const auditService = { append: async () => undefined };
  const domainEventBus = { emit: async () => undefined };
  const workspaceMemoryRepository = { append: async () => undefined };

  const service = new JobsService(
    jobsRepository as never,
    auditService as never,
    domainEventBus as never,
    workspaceMemoryRepository as never,
    prisma as never,
    undefined,
    undefined,
    (overrides.notifications ?? { handleEvent: async () => undefined }) as never,
    overrides.outboxRepository as never,
  );
  return service;
}

test("systemCompleteJob writes job.completed.v1 and rating.requested.v1 best-effort outbox events", async () => {
  const outboxRows: Array<Record<string, unknown>> = [];
  const outboxRepository = {
    async create(_tx: unknown, event: unknown) {
      outboxRows.push(event as Record<string, unknown>);
    },
  };
  const service = makeService({ outboxRepository });

  await service.systemCompleteJob({ tenantId: "tenant_1", jobId: "job_1", requestId: "req_1" });
  // outbox writes are fire-and-forget (void) — flush the microtask queue.
  await new Promise((resolve) => setImmediate(resolve));

  assert.equal(outboxRows.length, 2);
  const eventTypes = outboxRows.map((row) => row.eventType).sort();
  assert.deepEqual(eventTypes, ["job.completed.v1", "rating.requested.v1"]);
  for (const row of outboxRows) {
    assert.equal(row.tenantId, "tenant_1");
    assert.equal(row.orgId, "org_client_1");
    assert.deepEqual(row.payload, { jobId: "job_1", proUserId: "usr_pro_1", clientUserId: "usr_client_1" });
  }
});

test("systemCompleteJob still completes the job and notifies even when outboxRepository is absent", async () => {
  const service = makeService({ outboxRepository: undefined });
  await assert.doesNotReject(() =>
    service.systemCompleteJob({ tenantId: "tenant_1", jobId: "job_1", requestId: "req_1" }),
  );
});
