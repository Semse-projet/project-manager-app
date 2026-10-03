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

// ── Batch summaries (2.36), kept from main ───────────────────────────────────
// Minimal Prisma stub — only the calls listAssignmentsWithSummary actually
// makes. Counts invocations so we can assert the batch is 1 query per table
// regardless of how many travel assignments are in play (see
// AUDIT_REMEDIATION_PLAN.md 2.36: this used to be 3 HTTP calls PER travel).
function createPrismaStub(data: {
  assignments: Array<Record<string, unknown>>;
  expenses: Array<Record<string, unknown>>;
  advances: Array<Record<string, unknown>>;
  lodgings: Array<Record<string, unknown>>;
}) {
  const callCounts = { travelAssignment: 0, travelExpense: 0, travelAdvance: 0, lodgingBooking: 0 };
  return {
    callCounts,
    travelAssignment: {
      async findMany() {
        callCounts.travelAssignment++;
        return data.assignments;
      },
    },
    travelExpense: {
      async findMany({ where }: { where: { travelId: { in: string[] } } }) {
        callCounts.travelExpense++;
        return data.expenses.filter((e) => where.travelId.in.includes(e.travelId as string));
      },
    },
    travelAdvance: {
      async findMany({ where }: { where: { travelId: { in: string[] } } }) {
        callCounts.travelAdvance++;
        return data.advances.filter((a) => where.travelId.in.includes(a.travelId as string));
      },
    },
    lodgingBooking: {
      async findMany({ where }: { where: { travelId: { in: string[] } } }) {
        callCounts.lodgingBooking++;
        return data.lodgings.filter((l) => where.travelId.in.includes(l.travelId as string));
      },
    },
  };
}

function baseExpense(id: string, travelId: string, overrides: Record<string, unknown> = {}) {
  return {
    id, tenantId: "tnt", travelId, submittedBy: "usr_1",
    category: "other", subcategory: null, description: null,
    amount: 0, currency: "MXN", expenseDate: new Date("2026-07-02"),
    city: null, origin: null, destination: null, vendor: null,
    odometer: null, gallons: null, receiptUrl: null,
    status: "PENDING", approvedBy: null, approvedAt: null, notes: null,
    createdAt: new Date("2026-07-02"), updatedAt: new Date("2026-07-02"),
    ...overrides,
  };
}

function baseAdvance(id: string, travelId: string, overrides: Record<string, unknown> = {}) {
  return {
    id, tenantId: "tnt", travelId, issuedTo: "usr_1",
    amount: 0, currency: "MXN", method: null, issuedAt: new Date("2026-07-01"),
    approvedBy: null, purpose: null, status: "ISSUED",
    createdAt: new Date("2026-07-01"), updatedAt: new Date("2026-07-01"),
    ...overrides,
  };
}

function baseLodging(id: string, travelId: string, overrides: Record<string, unknown> = {}) {
  return {
    id, tenantId: "tnt", travelId, type: "hotel", name: "Hotel",
    address: null, placeId: null, googleMapsUri: null, latitude: null, longitude: null,
    checkIn: new Date("2026-07-01"), checkOut: new Date("2026-07-02"),
    costPerNight: null, estimatedTotal: null, actualTotal: null,
    confirmationCode: null, paidBy: null, status: "BOOKED", receiptUrl: null, notes: null,
    createdAt: new Date("2026-07-01"), updatedAt: new Date("2026-07-01"),
    ...overrides,
  };
}

function baseAssignment(id: string) {
  return {
    id, tenantId: "tnt", jobId: "job_1", assignedTo: "usr_1",
    destinationCity: "Monterrey", departureDate: new Date("2026-07-01"), returnDate: null,
    estimatedDays: 3, requiresLodging: true, headcount: 1, mainTransportMode: "flight",
    approvedBudget: null, approvedBy: null, status: "ACTIVE", notes: null,
    createdAt: new Date("2026-07-01"), updatedAt: new Date("2026-07-01"),
  };
}

void test("listAssignmentsWithSummary batches expense/advance/lodging lookups into a single query each, not one per travel", async () => {
  const prisma = createPrismaStub({
    assignments: [baseAssignment("trv_1"), baseAssignment("trv_2"), baseAssignment("trv_3")],
    expenses: [
      baseExpense("e1", "trv_1", { category: "meal", amount: 100, receiptUrl: "r1" }),
      baseExpense("e2", "trv_2", { category: "transport", amount: 200, receiptUrl: null }),
    ],
    advances: [
      baseAdvance("a1", "trv_1", { amount: 50 }),
    ],
    lodgings: [
      baseLodging("l1", "trv_2", { estimatedTotal: 300, actualTotal: null, receiptUrl: null }),
    ],
  });
  const service = new TravelService(prisma as never);

  const result = await service.listAssignmentsWithSummary({
    tenantId: "tnt", userId: "usr_1", roles: ["PRO"],
  });

  assert.equal(prisma.callCounts.travelExpense, 1, "expenses should be fetched once for all travels, not once per travel");
  assert.equal(prisma.callCounts.travelAdvance, 1);
  assert.equal(prisma.callCounts.lodgingBooking, 1);

  assert.equal(result.length, 3);
  const byId = Object.fromEntries(result.map((r) => [r.id, r]));

  // trv_1: 100 meal expense (has receipt) + 50 advance, no lodging.
  assert.equal(byId.trv_1.totalSpent, 100);
  assert.equal(byId.trv_1.expectedBalance, 50 - 100);
  assert.equal(byId.trv_1.missingReceipts, 0);
  assert.equal(byId.trv_1.expenseCount, 1);
  assert.equal(byId.trv_1.advanceCount, 1);

  // trv_2: 200 transport expense (no receipt) + 300 lodging (no receipt), no advance.
  assert.equal(byId.trv_2.totalSpent, 500);
  assert.equal(byId.trv_2.expectedBalance, 0 - 500);
  assert.equal(byId.trv_2.missingReceipts, 2);
  assert.equal(byId.trv_2.missingExpenseReceipts, 1);
  assert.equal(byId.trv_2.missingLodgingReceipts, 1);
  assert.equal(byId.trv_2.advanceCount, 0);

  // trv_3: nothing at all — should fall back to the zeroed-out summary shape.
  assert.equal(byId.trv_3.totalSpent, null);
  assert.equal(byId.trv_3.expectedBalance, null);
  assert.equal(byId.trv_3.missingReceipts, 0);
  assert.equal(byId.trv_3.expenseCount, 0);
});

void test("listAssignmentsWithSummary returns [] and skips the 3 batch queries when there are no assignments", async () => {
  const prisma = createPrismaStub({ assignments: [], expenses: [], advances: [], lodgings: [] });
  const service = new TravelService(prisma as never);

  const result = await service.listAssignmentsWithSummary({ tenantId: "tnt", userId: "usr_1", roles: ["PRO"] });

  assert.deepEqual(result, []);
  assert.equal(prisma.callCounts.travelExpense, 0);
  assert.equal(prisma.callCounts.travelAdvance, 0);
  assert.equal(prisma.callCounts.lodgingBooking, 0);
});
