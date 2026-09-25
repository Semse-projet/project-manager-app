import test from "node:test";
import assert from "node:assert/strict";

import { MilestonesService } from "../dist/modules/milestones/milestones.service.js";

const milestoneRecord = {
  id: "ms_1",
  tenantId: "tenant_1",
  projectId: "project_1",
  title: "Framing",
  amount: 5000,
  sequence: 1,
  status: "approved" as const,
};

function makeService(input: { outboxRepository?: unknown; prisma?: unknown } = {}) {
  const milestonesRepository = {
    approve: async () => milestoneRecord,
    reject: async () => ({ ...milestoneRecord, status: "rejected" as const }),
    getEventContext: async () => ({ projectId: "project_1", jobId: "job_1", proUserId: "usr_pro_1" }),
    checkAllMilestonesApproved: async () => false,
  };
  const auditService = { append: async () => undefined };
  const domainEventBus = { emit: async () => undefined };
  const workspaceMemory = { append: async () => undefined };

  return new MilestonesService(
    milestonesRepository as never,
    auditService as never,
    domainEventBus as never,
    workspaceMemory as never,
    undefined,
    undefined,
    undefined,
    undefined,
    undefined,
    (input.prisma ?? {}) as never,
    input.outboxRepository as never,
  );
}

const approveCommand = {
  tenantId: "tenant_1",
  milestoneId: "ms_1",
  userId: "usr_client_1",
  orgId: "org_client_1",
  roles: ["CLIENT"],
  requestId: "req_1",
};

test("approve writes a best-effort milestone.approved.v1 outbox event with the same payload as the legacy DomainEventBus event", async () => {
  const outboxRows: Array<Record<string, unknown>> = [];
  const outboxRepository = {
    async create(_tx: unknown, event: unknown) {
      outboxRows.push(event as Record<string, unknown>);
    },
  };
  const service = makeService({ outboxRepository, prisma: {} });

  await service.approve(approveCommand);

  assert.equal(outboxRows.length, 1);
  assert.equal(outboxRows[0]?.eventType, "milestone.approved.v1");
  assert.equal(outboxRows[0]?.entityId, "ms_1");
  assert.equal(outboxRows[0]?.orgId, "org_client_1");
  assert.deepEqual(outboxRows[0]?.payload, {
    milestoneId: "ms_1",
    projectId: "project_1",
    jobId: "job_1",
    reviewerId: "usr_client_1",
    amount: 5000,
  });
});

test("reject writes a best-effort milestone.rejected.v1 outbox event carrying the rejection reason", async () => {
  const outboxRows: Array<Record<string, unknown>> = [];
  const outboxRepository = {
    async create(_tx: unknown, event: unknown) {
      outboxRows.push(event as Record<string, unknown>);
    },
  };
  const service = makeService({ outboxRepository, prisma: {} });

  await service.reject({ ...approveCommand, reason: "Missing electrical permit photos" });

  assert.equal(outboxRows.length, 1);
  assert.equal(outboxRows[0]?.eventType, "milestone.rejected.v1");
  assert.deepEqual(outboxRows[0]?.payload, {
    milestoneId: "ms_1",
    projectId: "project_1",
    jobId: "job_1",
    reviewerId: "usr_client_1",
    rejectionReason: "Missing electrical permit photos",
  });
});

test("approve still succeeds and returns the milestone when prisma/outboxRepository are absent", async () => {
  const service = makeService({});
  const result = await service.approve(approveCommand);
  assert.equal(result.id, "ms_1");
});
