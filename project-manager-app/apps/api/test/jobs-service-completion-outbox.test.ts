import test from "node:test";
import assert from "node:assert/strict";

import { JobsService } from "../dist/modules/jobs/jobs.service.js";

function makeService(overrides: { outboxRepository?: unknown; notifications?: unknown; jobsRepository?: unknown; domainEventBus?: unknown } = {}) {
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
    (overrides.jobsRepository ?? jobsRepository) as never,
    auditService as never,
    (overrides.domainEventBus ?? domainEventBus) as never,
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

test("stale automatic completion cannot emit a second completion, rating or webhook", async () => {
  let expectedFrom: unknown;
  let notifications = 0;
  let events = 0;
  let outbox = 0;
  const svc = makeService({
    jobsRepository: {
      async updateStatus(input: Record<string, unknown>) {
        expectedFrom = input.expectedFrom;
        // Simulate a concurrent completion that committed after the first read.
        if (input.expectedFrom === "review") {
          const { ConflictException } = await import("@nestjs/common");
          throw new ConflictException("job changed from 'review' to 'completed' while this transition was in flight");
        }
        throw new Error("missing optimistic lock");
      },
    },
    domainEventBus: { async emit() { events++; } },
    notifications: { async handleEvent() { notifications++; } },
    outboxRepository: { async create() { outbox++; } },
  });

  await svc.systemCompleteJob({ tenantId: "tenant_1", jobId: "job_1", requestId: "req_stale" });
  await new Promise((resolve) => setImmediate(resolve));

  assert.equal(expectedFrom, "review", "systemCompleteJob must supply its observed source status");
  assert.equal(events, 0, "no second status-changed event after stale completion");
  assert.equal(notifications, 0, "no duplicated completion/rating notifications");
  assert.equal(outbox, 0, "no duplicate satellite webhook outbox records");
});
