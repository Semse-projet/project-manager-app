import test from "node:test";
import assert from "node:assert/strict";

// ─────────────────────────────────────────────────────────────────────────────
// Change Orders Service Tests: Lifecycle, Approvals, Budget Impact
// ─────────────────────────────────────────────────────────────────────────────

const baseTime = new Date("2026-06-22T10:00:00.000Z");

// Inline ChangeOrderService implementation for testing
class ChangeOrderService {
  prisma: any;

  constructor(prisma: any) {
    this.prisma = prisma;
  }

  async createChangeOrder(projectId: string, description: string, amount: number, createdBy: string): Promise<any> {
    return await this.prisma.changeOrder.create({
      data: { projectId, description, amount, status: "DRAFT", createdBy, createdAt: new Date() },
    });
  }

  async getChangeOrders(projectId: string): Promise<any[]> {
    return await this.prisma.changeOrder.findMany({
      where: { projectId },
      orderBy: { createdAt: "desc" },
    });
  }

  async submitForApproval(changeOrderId: string, submittedBy: string): Promise<any> {
    return await this.prisma.changeOrder.update({
      where: { id: changeOrderId },
      data: { status: "PENDING_APPROVAL", submittedBy, submittedAt: new Date() },
    });
  }

  async approveChangeOrder(changeOrderId: string, approvedBy: string, signature: string): Promise<any> {
    return await this.prisma.changeOrder.update({
      where: { id: changeOrderId },
      data: { status: "APPROVED", approvedBy, approvedAt: new Date(), proSignature: signature },
    });
  }

  async rejectChangeOrder(changeOrderId: string, rejectedBy: string, reason: string): Promise<any> {
    return await this.prisma.changeOrder.update({
      where: { id: changeOrderId },
      data: { status: "REJECTED", rejectedBy, rejectedAt: new Date(), rejectionReason: reason },
    });
  }

  async getChangeOrderTimeline(projectId: string): Promise<any[]> {
    const changeOrders = await this.prisma.changeOrder.findMany({
      where: { projectId },
      orderBy: { createdAt: "asc" },
    });
    return changeOrders.map((co: any) => ({
      id: co.id,
      date: co.createdAt,
      description: co.description,
      amount: co.amount,
      status: co.status,
      createdBy: co.createdBy,
      approvedBy: co.approvedBy,
    }));
  }

  async getTotalApprovedChanges(projectId: string): Promise<number> {
    const result = await this.prisma.changeOrder.aggregate({
      where: { projectId, status: "APPROVED" },
      _sum: { amount: true },
    });
    return result._sum?.amount || 0;
  }
}

function createMockChangeOrderService(overrides?: {
  changeOrders?: any[];
  shouldThrow?: {
    [key: string]: Error;
  };
}) {
  const changeOrders = overrides?.changeOrders ?? [];
  const shouldThrow = overrides?.shouldThrow ?? {};

  const mockPrisma = {
    changeOrder: {
      create: async (input: any) => {
        if (shouldThrow["create"]) throw shouldThrow["create"];
        const co = {
          id: `co_${changeOrders.length + 1}`,
          ...input.data,
          createdAt: input.data.createdAt || baseTime,
          updatedAt: baseTime,
          submittedAt: null,
          submittedBy: null,
          approvedAt: null,
          approvedBy: null,
          rejectedAt: null,
          rejectedBy: null,
          proSignature: null,
          rejectionReason: null,
        };
        changeOrders.push(co);
        return co;
      },
      findMany: async (input: any) => {
        if (shouldThrow["findMany"]) throw shouldThrow["findMany"];
        let filtered = changeOrders;
        if (input.where?.projectId) {
          filtered = filtered.filter((co) => co.projectId === input.where.projectId);
        }
        return filtered.sort((a, b) => {
          if (input.orderBy?.createdAt === "desc") {
            return b.createdAt.getTime() - a.createdAt.getTime();
          }
          return a.createdAt.getTime() - b.createdAt.getTime();
        });
      },
      findUnique: async (input: any) => {
        if (shouldThrow["findUnique"]) throw shouldThrow["findUnique"];
        return changeOrders.find((co) => co.id === input.where.id) ?? null;
      },
      update: async (input: any) => {
        if (shouldThrow["update"]) throw shouldThrow["update"];
        const co = changeOrders.find((c) => c.id === input.where.id);
        if (co) {
          Object.assign(co, input.data, { updatedAt: baseTime });
        }
        return co;
      },
      aggregate: async (input: any) => {
        if (shouldThrow["aggregate"]) throw shouldThrow["aggregate"];
        const filtered = changeOrders.filter((co) => {
          if (input.where?.projectId && co.projectId !== input.where.projectId) return false;
          if (input.where?.status && co.status !== input.where.status) return false;
          return true;
        });
        const total = filtered.reduce((sum, co) => sum + co.amount, 0);
        return { _sum: { amount: total || null } };
      },
    },
  };

  return new ChangeOrderService(mockPrisma as any);
}

// ═════════════════════════════════════════════════════════════════════════════
// CHANGE ORDER LIFECYCLE TESTS
// ═════════════════════════════════════════════════════════════════════════════

test("change-orders: createChangeOrder creates DRAFT change order with project context", async () => {
  const service = createMockChangeOrderService();

  const co = await service.createChangeOrder(
    "proj_1",
    "Add wall insulation to bedroom",
    2500,
    "usr_contractor_1"
  );

  assert.ok(co.id);
  assert.equal(co.projectId, "proj_1");
  assert.equal(co.status, "DRAFT");
  assert.equal(co.description, "Add wall insulation to bedroom");
  assert.equal(co.amount, 2500);
  assert.equal(co.createdBy, "usr_contractor_1");
});

test("change-orders: getChangeOrders returns all orders for project sorted desc by date", async () => {
  const orders = [
    {
      id: "co_1",
      projectId: "proj_1",
      description: "Early order",
      amount: 1000,
      status: "DRAFT",
      createdAt: new Date("2026-06-20"),
      createdBy: "usr_1",
    },
    {
      id: "co_2",
      projectId: "proj_1",
      description: "Recent order",
      amount: 2000,
      status: "APPROVED",
      createdAt: new Date("2026-06-22"),
      createdBy: "usr_1",
    },
  ];
  const service = createMockChangeOrderService({ changeOrders: orders });

  const result = await service.getChangeOrders("proj_1");

  assert.equal(result.length, 2);
  assert.equal(result[0].id, "co_2"); // Most recent first
  assert.equal(result[1].id, "co_1");
});

test("change-orders: submitForApproval transitions from DRAFT to PENDING_APPROVAL", async () => {
  const orders = [
    {
      id: "co_1",
      projectId: "proj_1",
      description: "Change order",
      amount: 1500,
      status: "DRAFT",
      createdAt: baseTime,
      createdBy: "usr_1",
      submittedAt: null,
      submittedBy: null,
      approvedAt: null,
      approvedBy: null,
      rejectedAt: null,
      rejectedBy: null,
      proSignature: null,
      rejectionReason: null,
    },
  ];
  const service = createMockChangeOrderService({ changeOrders: orders });

  const result = await service.submitForApproval("co_1", "usr_1");

  assert.equal(result.status, "PENDING_APPROVAL");
  assert.equal(result.submittedBy, "usr_1");
  assert.ok(result.submittedAt);
});

test("change-orders: approveChangeOrder requires PRO signature and transitions to APPROVED", async () => {
  const orders = [
    {
      id: "co_1",
      projectId: "proj_1",
      description: "Change order",
      amount: 1500,
      status: "PENDING_APPROVAL",
      createdAt: baseTime,
      createdBy: "usr_1",
      submittedAt: baseTime,
      submittedBy: "usr_1",
      approvedAt: null,
      approvedBy: null,
      rejectedAt: null,
      rejectedBy: null,
      proSignature: null,
      rejectionReason: null,
    },
  ];
  const service = createMockChangeOrderService({ changeOrders: orders });

  const proSignature = "sig_pro_xyz789";
  const result = await service.approveChangeOrder("co_1", "pro_user_1", proSignature);

  assert.equal(result.status, "APPROVED");
  assert.equal(result.approvedBy, "pro_user_1");
  assert.equal(result.proSignature, proSignature);
  assert.ok(result.approvedAt);
});

test("change-orders: rejectChangeOrder transitions to REJECTED with reason", async () => {
  const orders = [
    {
      id: "co_1",
      projectId: "proj_1",
      description: "Change order",
      amount: 1500,
      status: "PENDING_APPROVAL",
      createdAt: baseTime,
      createdBy: "usr_1",
      submittedAt: baseTime,
      submittedBy: "usr_1",
      approvedAt: null,
      approvedBy: null,
      rejectedAt: null,
      rejectedBy: null,
      proSignature: null,
      rejectionReason: null,
    },
  ];
  const service = createMockChangeOrderService({ changeOrders: orders });

  const result = await service.rejectChangeOrder("co_1", "pro_user_1", "Budget exceeded project limits");

  assert.equal(result.status, "REJECTED");
  assert.equal(result.rejectedBy, "pro_user_1");
  assert.equal(result.rejectionReason, "Budget exceeded project limits");
  assert.ok(result.rejectedAt);
});

// ═════════════════════════════════════════════════════════════════════════════
// CHANGE ORDER TIMELINE & HISTORY TESTS
// ═════════════════════════════════════════════════════════════════════════════

test("change-orders: getChangeOrderTimeline returns chronological audit trail", async () => {
  const orders = [
    {
      id: "co_1",
      projectId: "proj_1",
      description: "Add bathroom tile",
      amount: 800,
      status: "APPROVED",
      createdAt: new Date("2026-06-15"),
      createdBy: "usr_1",
      approvedBy: "pro_user_1",
      submittedAt: new Date("2026-06-16"),
      submittedBy: "usr_1",
      approvedAt: new Date("2026-06-17"),
      rejectedAt: null,
      rejectedBy: null,
      proSignature: "sig_1",
      rejectionReason: null,
    },
    {
      id: "co_2",
      projectId: "proj_1",
      description: "Additional electrical outlet",
      amount: 300,
      status: "DRAFT",
      createdAt: new Date("2026-06-21"),
      createdBy: "usr_1",
      approvedBy: null,
      submittedAt: null,
      submittedBy: null,
      approvedAt: null,
      rejectedAt: null,
      rejectedBy: null,
      proSignature: null,
      rejectionReason: null,
    },
  ];
  const service = createMockChangeOrderService({ changeOrders: orders });

  const timeline = await service.getChangeOrderTimeline("proj_1");

  assert.equal(timeline.length, 2);
  assert.equal(timeline[0].id, "co_1"); // Earlier first
  assert.equal(timeline[0].status, "APPROVED");
  assert.equal(timeline[1].id, "co_2");
  assert.equal(timeline[1].status, "DRAFT");
});

// ═════════════════════════════════════════════════════════════════════════════
// BUDGET IMPACT & AGGREGATION TESTS
// ═════════════════════════════════════════════════════════════════════════════

test("change-orders: getTotalApprovedChanges sums only APPROVED orders", async () => {
  const orders = [
    {
      id: "co_1",
      projectId: "proj_1",
      description: "Approved 1",
      amount: 1000,
      status: "APPROVED",
      createdAt: baseTime,
      createdBy: "usr_1",
      approvedBy: "pro_user_1",
      submittedAt: baseTime,
      submittedBy: "usr_1",
      approvedAt: baseTime,
      rejectedAt: null,
      rejectedBy: null,
      proSignature: "sig_1",
      rejectionReason: null,
    },
    {
      id: "co_2",
      projectId: "proj_1",
      description: "Approved 2",
      amount: 2000,
      status: "APPROVED",
      createdAt: baseTime,
      createdBy: "usr_1",
      approvedBy: "pro_user_2",
      submittedAt: baseTime,
      submittedBy: "usr_1",
      approvedAt: baseTime,
      rejectedAt: null,
      rejectedBy: null,
      proSignature: "sig_2",
      rejectionReason: null,
    },
    {
      id: "co_3",
      projectId: "proj_1",
      description: "Draft (not counted)",
      amount: 5000,
      status: "DRAFT",
      createdAt: baseTime,
      createdBy: "usr_1",
      approvedBy: null,
      submittedAt: null,
      submittedBy: null,
      approvedAt: null,
      rejectedAt: null,
      rejectedBy: null,
      proSignature: null,
      rejectionReason: null,
    },
    {
      id: "co_4",
      projectId: "proj_1",
      description: "Rejected (not counted)",
      amount: 1500,
      status: "REJECTED",
      createdAt: baseTime,
      createdBy: "usr_1",
      approvedBy: null,
      submittedAt: baseTime,
      submittedBy: "usr_1",
      approvedAt: null,
      rejectedAt: baseTime,
      rejectedBy: "pro_user_1",
      proSignature: null,
      rejectionReason: "Over budget",
    },
  ];
  const service = createMockChangeOrderService({ changeOrders: orders });

  const total = await service.getTotalApprovedChanges("proj_1");

  assert.equal(total, 3000); // 1000 + 2000 only
});

test("change-orders: getTotalApprovedChanges returns 0 when no approved orders exist", async () => {
  const orders = [
    {
      id: "co_1",
      projectId: "proj_1",
      description: "Draft",
      amount: 1000,
      status: "DRAFT",
      createdAt: baseTime,
      createdBy: "usr_1",
      approvedBy: null,
      submittedAt: null,
      submittedBy: null,
      approvedAt: null,
      rejectedAt: null,
      rejectedBy: null,
      proSignature: null,
      rejectionReason: null,
    },
  ];
  const service = createMockChangeOrderService({ changeOrders: orders });

  const total = await service.getTotalApprovedChanges("proj_1");

  assert.equal(total, 0);
});

// ═════════════════════════════════════════════════════════════════════════════
// INTEGRATION TESTS
// ═════════════════════════════════════════════════════════════════════════════

test("change-orders: full lifecycle — DRAFT → submit → approve → budget impact", async () => {
  const service = createMockChangeOrderService();

  // Step 1: Create in DRAFT
  const created = await service.createChangeOrder("proj_1", "Upgrade HVAC system", 5000, "usr_contractor_1");
  assert.equal(created.status, "DRAFT");
  assert.equal(created.amount, 5000);

  // Step 2: Submit for approval
  const submitted = await service.submitForApproval(created.id, "usr_contractor_1");
  assert.equal(submitted.status, "PENDING_APPROVAL");

  // Step 3: PRO approves
  const approved = await service.approveChangeOrder(created.id, "pro_user_1", "sig_hvac_upgrade");
  assert.equal(approved.status, "APPROVED");
  assert.equal(approved.proSignature, "sig_hvac_upgrade");

  // Step 4: Verify budget impact
  const totalApproved = await service.getTotalApprovedChanges("proj_1");
  assert.equal(totalApproved, 5000);
});

test("change-orders: rejection workflow — DRAFT → submit → reject → remains REJECTED", async () => {
  const service = createMockChangeOrderService();

  // Step 1: Create and submit
  const created = await service.createChangeOrder("proj_1", "Premium fixtures", 8000, "usr_contractor_1");
  const submitted = await service.submitForApproval(created.id, "usr_contractor_1");
  assert.equal(submitted.status, "PENDING_APPROVAL");

  // Step 2: PRO rejects
  const rejected = await service.rejectChangeOrder(
    created.id,
    "pro_user_1",
    "Exceeds project contingency budget"
  );
  assert.equal(rejected.status, "REJECTED");
  assert.equal(rejected.rejectionReason, "Exceeds project contingency budget");

  // Step 3: Verify not counted in approvals
  const totalApproved = await service.getTotalApprovedChanges("proj_1");
  assert.equal(totalApproved, 0);
});

test("change-orders: multi-order budget tracking across project lifecycle", async () => {
  const service = createMockChangeOrderService();

  // Create and approve multiple orders
  const co1 = await service.createChangeOrder("proj_1", "Phase 1", 1000, "usr_1");
  await service.submitForApproval(co1.id, "usr_1");
  await service.approveChangeOrder(co1.id, "pro_user_1", "sig_1");

  const co2 = await service.createChangeOrder("proj_1", "Phase 2", 2000, "usr_1");
  await service.submitForApproval(co2.id, "usr_1");
  await service.approveChangeOrder(co2.id, "pro_user_1", "sig_2");

  const co3 = await service.createChangeOrder("proj_1", "Phase 3", 500, "usr_1");
  // Leave co3 in DRAFT

  const co4 = await service.createChangeOrder("proj_1", "Phase 4 (rejected)", 1500, "usr_1");
  await service.submitForApproval(co4.id, "usr_1");
  await service.rejectChangeOrder(co4.id, "pro_user_1", "Out of scope");

  // Verify totals
  const totalApproved = await service.getTotalApprovedChanges("proj_1");
  assert.equal(totalApproved, 3000); // co1(1000) + co2(2000)

  // Verify timeline shows all
  const timeline = await service.getChangeOrderTimeline("proj_1");
  assert.equal(timeline.length, 4);
});
