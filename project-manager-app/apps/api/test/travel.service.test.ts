import assert from "node:assert/strict";
import test from "node:test";
import {
  ForbiddenException,
  NotFoundException,
  ServiceUnavailableException,
} from "@nestjs/common";

import { TravelService } from "../dist/modules/travel/travel.service.js";

const previousDatabaseUrl = process.env.DATABASE_URL;
process.env.DATABASE_URL = "postgresql://unit-test.invalid/travel";
test.after(() => {
  if (previousDatabaseUrl === undefined) {
    delete process.env.DATABASE_URL;
  } else {
    process.env.DATABASE_URL = previousDatabaseUrl;
  }
});

type JobOwnership = {
  clientOrgId: string;
  project: { assignedProOrgId: string } | null;
};

function assignmentInput(overrides: Record<string, unknown> = {}) {
  return {
    tenantId: "tenant_1",
    jobId: "job_1",
    actorUserId: "worker_1",
    orgId: "pro_org_1",
    roles: ["PRO"],
    destinationCity: "Monterrey",
    departureDate: "2026-08-01",
    ...overrides,
  };
}

function createHarness(options: {
  job?: JobOwnership | null;
  updateCount?: number;
} = {}) {
  const calls: Array<{ method: string; args: unknown }> = [];
  const job = options.job === undefined
    ? { clientOrgId: "client_org_1", project: { assignedProOrgId: "pro_org_1" } }
    : options.job;
  const tx = {
    job: {
      async findFirst(args: unknown) {
        calls.push({ method: "job.findFirst", args });
        return job;
      },
      async updateMany(args: unknown) {
        calls.push({ method: "job.updateMany", args });
        return { count: options.updateCount ?? 1 };
      },
    },
    travelAssignment: {
      async create(args: { data: Record<string, unknown> }) {
        calls.push({ method: "travelAssignment.create", args });
        const now = new Date("2026-07-25T00:00:00.000Z");
        return {
          id: "travel_1",
          ...args.data,
          returnDate: args.data.returnDate ?? null,
          estimatedDays: args.data.estimatedDays ?? null,
          mainTransportMode: args.data.mainTransportMode ?? null,
          approvedBudget: args.data.approvedBudget ?? null,
          approvedBy: args.data.approvedBy ?? null,
          notes: args.data.notes ?? null,
          status: "DRAFT",
          createdAt: now,
          updatedAt: now,
        };
      },
    },
  };
  const prisma = {
    async $transaction<T>(callback: (client: typeof tx) => Promise<T>) {
      calls.push({ method: "$transaction", args: null });
      return callback(tx);
    },
  };
  return {
    service: new TravelService(prisma as never),
    calls,
  };
}

test("travel creation rejects an absent or cross-tenant job before any write", async () => {
  const { service, calls } = createHarness({ job: null });

  await assert.rejects(
    service.createAssignment(assignmentInput()),
    NotFoundException,
  );
  assert.equal(calls.some((call) => call.method === "job.updateMany"), false);
  assert.equal(calls.some((call) => call.method === "travelAssignment.create"), false);
  assert.deepEqual(calls.find((call) => call.method === "job.findFirst")?.args, {
    where: { id: "job_1", tenantId: "tenant_1", deletedAt: null },
    select: {
      clientOrgId: true,
      project: { select: { assignedProOrgId: true } },
    },
  });
});

test("travel creation rejects a PRO whose org is not assigned to the job", async () => {
  const { service, calls } = createHarness({
    job: {
      clientOrgId: "client_org_1",
      project: { assignedProOrgId: "another_pro_org" },
    },
  });

  await assert.rejects(
    service.createAssignment(assignmentInput()),
    ForbiddenException,
  );
  assert.equal(calls.some((call) => call.method === "job.updateMany"), false);
  assert.equal(calls.some((call) => call.method === "travelAssignment.create"), false);
});

test("travel creation permits only the owning CLIENT org", async () => {
  const denied = createHarness();
  await assert.rejects(
    denied.service.createAssignment(assignmentInput({
      actorUserId: "client_2",
      orgId: "client_org_2",
      roles: ["CLIENT"],
    })),
    ForbiddenException,
  );

  const allowed = createHarness();
  const result = await allowed.service.createAssignment(assignmentInput({
    actorUserId: "client_1",
    orgId: "client_org_1",
    roles: ["CLIENT"],
  }));
  assert.equal(result.id, "travel_1");
});

test("travel creation permits assigned WORKER/PRO and tenant-wide OPS_ADMIN", async () => {
  const worker = createHarness();
  const workerResult = await worker.service.createAssignment(assignmentInput({
    roles: ["WORKER"],
  }));
  assert.equal(workerResult.assignedTo, "worker_1");

  const admin = createHarness({
    job: { clientOrgId: "client_org_1", project: null },
  });
  const adminResult = await admin.service.createAssignment(assignmentInput({
    actorUserId: "admin_1",
    orgId: "ops_org",
    roles: ["OPS_ADMIN"],
  }));
  assert.equal(adminResult.id, "travel_1");
});

test("travel creation treats updateMany count=0 as rejection", async () => {
  const { service, calls } = createHarness({ updateCount: 0 });

  await assert.rejects(
    service.createAssignment(assignmentInput()),
    NotFoundException,
  );
  assert.equal(calls.some((call) => call.method === "travelAssignment.create"), false);
});

test("travel creation fails closed when persistence cannot validate the job", async () => {
  delete process.env.DATABASE_URL;
  const { service, calls } = createHarness();
  try {
    await assert.rejects(
      service.createAssignment(assignmentInput()),
      ServiceUnavailableException,
    );
    assert.equal(calls.length, 0);
  } finally {
    process.env.DATABASE_URL = "postgresql://unit-test.invalid/travel";
  }
});
