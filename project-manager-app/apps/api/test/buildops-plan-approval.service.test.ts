import test from "node:test";
import assert from "node:assert/strict";
import { BuildOpsPlanApprovalService } from "../dist/modules/buildops/buildops-plan-approval.service.js";

function createFakePrisma(initial?: {
  status?: string;
  legacyPromotionStatus?: string;
  approvedAt?: Date | null;
}) {
  const state = {
    plan: {
      id: "bop_approval_1",
      tenantId: "tenant_default",
      jobId: "job_approval_1",
      clientPlanApprovalStatus: initial?.status ?? "pending",
      clientPlanApprovedAt: initial?.approvedAt ?? null,
      clientPlanApprovedById: initial?.approvedAt ? "usr_client_001" : null,
      clientPlanApprovalSource: initial?.approvedAt ? "client" : null,
      clientPlanApprovalReason: null,
      clientPlanReviewedAt: initial?.approvedAt ?? null,
      clientPlanReviewComment: null,
      clientPlanUnapprovedAt: null,
      clientPlanUnapprovedById: null,
      clientPlanUnapprovalReason: null,
      legacyPromotionStatus: initial?.legacyPromotionStatus ?? "pending",
      job: {
        clientOrgId: "org_client_001",
      },
    },
    acceptedReservation: null as null | { id: string },
    milestones: [] as Array<{ checklistSchema: Record<string, unknown> | null }>,
  };

  const prisma = {
    buildOpsProject: {
      findFirst: async () => ({ ...state.plan, job: state.plan.job ? { ...state.plan.job } : null }),
      updateMany: async ({ where, data }: { where: Record<string, unknown>; data: Record<string, unknown> }) => {
        const expectedStatus = where["clientPlanApprovalStatus"];
        const currentStatus = state.plan.clientPlanApprovalStatus;
        const statusMatches =
          typeof expectedStatus === "string"
            ? currentStatus === expectedStatus
            : Array.isArray((expectedStatus as { in?: string[] })?.["in"])
              ? ((expectedStatus as { in: string[] }).in).includes(currentStatus)
              : true;

        if (where["id"] !== state.plan.id || where["tenantId"] !== state.plan.tenantId) {
          return { count: 0 };
        }
        if (where["legacyPromotionStatus"] && state.plan.legacyPromotionStatus === "promoted") {
          return { count: 0 };
        }
        if (!statusMatches) {
          return { count: 0 };
        }

        Object.assign(state.plan, data);
        return { count: 1 };
      },
    },
    jobReservation: {
      findFirst: async () => state.acceptedReservation,
    },
    milestone: {
      findMany: async () => state.milestones,
    },
    $transaction: async <T>(work: (tx: typeof prisma) => Promise<T>) => work(prisma),
  };

  return { prisma, state };
}

test("approveClientPlan approves client-owned plan and is idempotent on second call", async () => {
  const { prisma, state } = createFakePrisma();
  const service = new BuildOpsPlanApprovalService(prisma as never);

  const first = await service.approveClientPlan({
    tenantId: "tenant_default",
    orgId: "org_client_001",
    userId: "usr_client_001",
    roles: ["CLIENT"],
    buildOpsProjectId: state.plan.id,
    source: "client",
  });

  assert.equal(first.clientPlanApprovalStatus, "approved");
  assert.equal(first.clientPlanApprovalSource, "client");
  assert.equal(first.clientPlanApprovedById, "usr_client_001");
  assert.ok(first.clientPlanApprovedAt);

  const second = await service.approveClientPlan({
    tenantId: "tenant_default",
    orgId: "org_client_001",
    userId: "usr_client_001",
    roles: ["CLIENT"],
    buildOpsProjectId: state.plan.id,
    source: "client",
  });

  assert.equal(second.clientPlanApprovalStatus, "approved");
  assert.equal(second.clientPlanApprovedAt, first.clientPlanApprovedAt);
});

test("approveClientPlan rejects admin override without reason", async () => {
  const { prisma, state } = createFakePrisma();
  const service = new BuildOpsPlanApprovalService(prisma as never);

  await assert.rejects(
    () =>
      service.approveClientPlan({
        tenantId: "tenant_default",
        orgId: "org_admin_001",
        userId: "usr_admin_001",
        roles: ["OPS_ADMIN"],
        buildOpsProjectId: state.plan.id,
        source: "admin_override",
      }),
    /admin override requires reason/,
  );
});

test("requestChanges blocks when an approved plan already has an accepted reservation", async () => {
  const { prisma, state } = createFakePrisma({
    status: "approved",
    approvedAt: new Date("2026-05-11T12:00:00.000Z"),
  });
  state.acceptedReservation = { id: "res_accepted_1" };
  const service = new BuildOpsPlanApprovalService(prisma as never);

  await assert.rejects(
    () =>
      service.requestChanges({
        tenantId: "tenant_default",
        orgId: "org_client_001",
        userId: "usr_client_001",
        roles: ["CLIENT"],
        buildOpsProjectId: state.plan.id,
        comment: "Necesito cambiar el alcance antes del assignment.",
      }),
    /reservation already accepted/,
  );
});

test("unapprove blocks if milestones promoted from this plan already exist", async () => {
  const { prisma, state } = createFakePrisma({
    status: "approved",
    approvedAt: new Date("2026-05-11T12:00:00.000Z"),
  });
  state.milestones.push({
    checklistSchema: {
      items: [],
      meta: {
        source: "buildops_legacy_promotion",
        buildOpsProjectId: state.plan.id,
      },
    },
  });
  const service = new BuildOpsPlanApprovalService(prisma as never);

  await assert.rejects(
    () =>
      service.unapproveClientPlan({
        tenantId: "tenant_default",
        orgId: "org_client_001",
        userId: "usr_client_001",
        roles: ["CLIENT"],
        buildOpsProjectId: state.plan.id,
        reason: "Quiero volver a revisar el plan.",
      }),
    /milestones already promoted from this plan exist/,
  );
});
