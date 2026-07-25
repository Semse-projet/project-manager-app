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

function travelAssignmentRow(id: string, assignedTo = "worker_1") {
  const now = new Date("2026-07-25T00:00:00.000Z");
  return {
    id,
    tenantId: "tenant_1",
    jobId: `job_${id}`,
    assignedTo,
    destinationCity: "Monterrey",
    departureDate: new Date("2026-08-01T00:00:00.000Z"),
    returnDate: null,
    estimatedDays: null,
    requiresLodging: true,
    headcount: 1,
    mainTransportMode: null,
    approvedBudget: null,
    approvedBy: null,
    status: "ACTIVE",
    notes: null,
    createdAt: now,
    updatedAt: now,
  };
}

test("travel list returns batch summaries with a fixed four-query shape", async () => {
  const calls: Array<{ method: string; args: unknown }> = [];
  const prisma = {
    travelAssignment: {
      async findMany(args: unknown) {
        calls.push({ method: "travelAssignment.findMany", args });
        return [travelAssignmentRow("travel_1"), travelAssignmentRow("travel_2")];
      },
    },
    travelExpense: {
      async findMany(args: unknown) {
        calls.push({ method: "travelExpense.findMany", args });
        return [
          { travelId: "travel_1", amount: 100, category: "meal", receiptUrl: "receipt://meal", status: "PENDING" },
          { travelId: "travel_1", amount: 50, category: "transport", receiptUrl: null, status: "REJECTED" },
          { travelId: "travel_1", amount: 25, category: "other", receiptUrl: null, status: "APPROVED" },
        ];
      },
    },
    lodgingBooking: {
      async findMany(args: unknown) {
        calls.push({ method: "lodgingBooking.findMany", args });
        return [{
          travelId: "travel_1",
          actualTotal: null,
          estimatedTotal: 200,
          receiptUrl: "receipt://hotel",
        }];
      },
    },
    travelAdvance: {
      async findMany(args: unknown) {
        calls.push({ method: "travelAdvance.findMany", args });
        return [
          { travelId: "travel_1", amount: 150 },
          { travelId: "travel_1", amount: 100 },
        ];
      },
    },
  };
  const service = new TravelService(prisma as never);

  const result = await service.listAssignments({
    tenantId: "tenant_1",
    userId: "worker_1",
    roles: ["PRO"],
  });

  assert.equal(calls.length, 4);
  assert.deepEqual(calls.map((call) => call.method), [
    "travelAssignment.findMany",
    "travelExpense.findMany",
    "lodgingBooking.findMany",
    "travelAdvance.findMany",
  ]);
  assert.deepEqual(result[0] && {
    totalSpent: result[0].totalSpent,
    expectedBalance: result[0].expectedBalance,
    missingReceipts: result[0].missingReceipts,
    missingExpenseReceipts: result[0].missingExpenseReceipts,
    missingLodgingReceipts: result[0].missingLodgingReceipts,
    receiptCount: result[0].receiptCount,
    expenseCount: result[0].expenseCount,
    lodgingCount: result[0].lodgingCount,
    advanceCount: result[0].advanceCount,
  }, {
    totalSpent: 325,
    expectedBalance: -75,
    missingReceipts: 2,
    missingExpenseReceipts: 2,
    missingLodgingReceipts: 0,
    receiptCount: 2,
    expenseCount: 3,
    lodgingCount: 1,
    advanceCount: 2,
  });
  assert.deepEqual(result[1] && {
    totalSpent: result[1].totalSpent,
    expectedBalance: result[1].expectedBalance,
    expenseCount: result[1].expenseCount,
    lodgingCount: result[1].lodgingCount,
    advanceCount: result[1].advanceCount,
  }, {
    totalSpent: 0,
    expectedBalance: 0,
    expenseCount: 0,
    lodgingCount: 0,
    advanceCount: 0,
  });
  for (const call of calls.slice(1)) {
    assert.deepEqual(
      (call.args as { where: { tenantId: string; travelId: { in: string[] } } }).where,
      {
        tenantId: "tenant_1",
        travelId: { in: ["travel_1", "travel_2"] },
      },
    );
  }
});

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
