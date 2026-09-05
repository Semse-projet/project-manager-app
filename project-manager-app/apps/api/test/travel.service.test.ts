import test from "node:test";
import assert from "node:assert/strict";
import { TravelService } from "../dist/modules/travel/travel.service.js";

// listAssignmentsWithSummary branches on databaseEnabled() (reads
// process.env.DATABASE_URL live, at call time) to pick the real-Prisma-batch
// path vs. the in-memory mock path used when no database is configured. This
// suite exercises the real-Prisma-batch path against a stub, so it needs
// DATABASE_URL set before the tests below run.
process.env.DATABASE_URL ??= "postgresql://unit-test-stub/db";

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
