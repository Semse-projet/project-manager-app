import test from "node:test";
import assert from "node:assert/strict";
import { Prisma } from "@prisma/client";
import { BuildOpsLegacyPromotionService } from "../dist/modules/buildops/buildops-legacy-promotion.service.js";

function createFakePrisma(initial?: {
  approvalStatus?: string;
  legacyPromotionStatus?: string;
}) {
  const state = {
    plan: {
      id: "bop_promote_1",
      tenantId: "tenant_default",
      orgId: "org_client_001",
      jobId: "job_promote_1",
      createdBy: "usr_client_001",
      sourceToolResult: {
        estimate: {
          status: "ready",
          quoteSummary: {
            total: 1200,
            recommendedDeposit: 360,
            recommendedEscrow: 1200,
            currency: "USD",
          },
        },
        milestonePlan: {
          totalAmount: 1200,
          riskLevel: "medium",
          milestones: [
            {
              sequence: 1,
              title: "Scope confirmation",
              description: "Confirm rooms and protection.",
              percentage: 40,
              amount: 480,
              evidenceRequired: ["before_photos", "measurements"],
              releaseTrigger: "client_scope_signoff",
            },
          ],
        },
        evidenceChecklist: {
          requiredCount: 1,
          items: [
            {
              type: "photo",
              description: "Before photos",
              required: true,
              milestone: 1,
            },
          ],
          notes: [],
        },
        paymentReadiness: {
          status: "draft",
          ready: false,
        },
      },
      clientPlanApprovalStatus: initial?.approvalStatus ?? "approved",
      clientPlanApprovedAt: new Date("2026-05-12T12:00:00.000Z"),
      legacyPromotionStatus: initial?.legacyPromotionStatus ?? "pending",
      legacyPromotedAt: null,
      job: {
        clientOrgId: "org_client_001",
      },
    },
    project: {
      id: "prj_legacy_1",
      tenantId: "tenant_default",
      assignedProOrgId: "org_pro_001",
      promotedFromBuildOpsProjectId: null as string | null,
      promotedAt: null as Date | null,
      promotedByUserId: null as string | null,
    },
    reservation: {
      id: "res_accepted_1",
      professionalOrgId: "org_pro_001",
    },
    buildOpsTasks: [
      {
        id: "bot_1",
        templateKey: "review_client_request",
        title: "Review client request",
        description: "Review the intake data.",
        dueDate: null,
        priority: "medium",
        assigneeUserId: null,
      },
    ],
    intake: {
      id: "intake_1",
      userId: "usr_client_001",
      uploadedImagesJson: [
        {
          id: "img_1",
          key: "tenant_default/intake/img_1.jpg",
          url: "https://cdn.example.com/img_1.jpg",
          thumbnailUrl: "https://cdn.example.com/thumb_1.jpg",
          originalName: "img_1.jpg",
          contentType: "image/jpeg",
          sizeBytes: 1024,
          uploadedAt: "2026-05-12T12:00:00.000Z",
          imageType: "before",
          evidenceStatus: "attached_to_job",
        },
      ],
    },
    milestones: [] as Array<{
      id: string;
      sequence: number;
      promotedFromBuildOpsProjectId: string | null;
      deletedAt: Date | null;
    }>,
    jobTasks: [] as Array<{
      id: string;
      promotedFromBuildOpsTaskId: string | null;
      deletedAt: Date | null;
    }>,
    evidence: [] as Array<{
      id: string;
      bucketKey: string;
    }>,
    transactionOptions: null as Prisma.PrismaPromiseTransactionOptions | null,
  };

  let sequence = 0;
  const nextId = (prefix: string) => `${prefix}_${++sequence}`;

  const prisma = {
    buildOpsProject: {
      findFirst: async () => ({
        ...state.plan,
        job: state.plan.job ? { ...state.plan.job } : null,
      }),
      updateMany: async ({ where, data }: { where: Record<string, unknown>; data: Record<string, unknown> }) => {
        const expectedStatuses = where["legacyPromotionStatus"] as { in?: string[] } | undefined;
        const allowedLegacyStatuses = expectedStatuses?.in ?? [];
        if (allowedLegacyStatuses.length > 0 && !allowedLegacyStatuses.includes(state.plan.legacyPromotionStatus)) {
          return { count: 0 };
        }
        if (where["clientPlanApprovalStatus"] && where["clientPlanApprovalStatus"] !== state.plan.clientPlanApprovalStatus) {
          return { count: 0 };
        }
        state.plan = { ...state.plan, ...data };
        return { count: 1 };
      },
      update: async ({ data }: { data: Record<string, unknown> }) => {
        state.plan = { ...state.plan, ...data };
        return { ...state.plan };
      },
    },
    project: {
      findFirst: async () => ({ ...state.project }),
      update: async ({ data }: { data: Record<string, unknown> }) => {
        state.project = { ...state.project, ...data };
        return { ...state.project };
      },
    },
    milestone: {
      findMany: async () => state.milestones.map((milestone) => ({ ...milestone })),
      create: async ({ data }: { data: Record<string, unknown> }) => {
        state.milestones.push({
          id: nextId("milestone"),
          sequence: Number(data.sequence),
          promotedFromBuildOpsProjectId: (data.promotedFromBuildOpsProjectId as string | null) ?? null,
          deletedAt: null,
        });
        return state.milestones.at(-1);
      },
    },
    jobTask: {
      findMany: async () => state.jobTasks.map((task) => ({ ...task })),
      create: async ({ data }: { data: Record<string, unknown> }) => {
        state.jobTasks.push({
          id: nextId("job_task"),
          promotedFromBuildOpsTaskId: (data.promotedFromBuildOpsTaskId as string | null) ?? null,
          deletedAt: null,
        });
        return state.jobTasks.at(-1);
      },
    },
    buildOpsTask: {
      findMany: async () => state.buildOpsTasks.map((task) => ({ ...task })),
    },
    projectIntake: {
      findFirst: async () => ({ ...state.intake }),
    },
    jobReservation: {
      findFirst: async () => ({ ...state.reservation }),
    },
    evidence: {
      findMany: async () => state.evidence.map((item) => ({ ...item })),
      create: async ({ data }: { data: Record<string, unknown> }) => {
        state.evidence.push({
          id: nextId("evidence"),
          bucketKey: String(data.bucketKey),
        });
        return state.evidence.at(-1);
      },
    },
    $transaction: async <T>(
      work: (tx: typeof prisma) => Promise<T>,
      options?: Prisma.PrismaPromiseTransactionOptions,
    ) => {
      state.transactionOptions = options ?? null;
      return work(prisma);
    },
  };

  return { prisma, state };
}

test("promoteApprovedPlanToLegacy promotes approved buildops plan and records traceability", async () => {
  const { prisma, state } = createFakePrisma();
  const service = new BuildOpsLegacyPromotionService(prisma as never);

  const result = await service.promoteApprovedPlanToLegacy({
    tenantId: "tenant_default",
    orgId: "org_client_001",
    userId: "usr_client_001",
    roles: ["CLIENT"],
    buildOpsProjectId: state.plan.id,
  });

  assert.equal(result.status, "promoted");
  assert.equal(result.alreadyPromoted, false);
  assert.equal(result.milestonesCreated, 1);
  assert.equal(result.tasksCreated, 1);
  assert.equal(result.evidenceCreated, 1);
  assert.equal(state.project.promotedFromBuildOpsProjectId, state.plan.id);
  assert.equal(state.milestones[0]?.promotedFromBuildOpsProjectId, state.plan.id);
  assert.equal(state.jobTasks[0]?.promotedFromBuildOpsTaskId, "bot_1");
  assert.equal(state.evidence[0]?.bucketKey, "tenant_default/intake/img_1.jpg");
  assert.equal(state.plan.legacyPromotionStatus, "promoted");
  assert.equal(state.transactionOptions?.isolationLevel, Prisma.TransactionIsolationLevel.Serializable);
});

test("promoteApprovedPlanToLegacy is idempotent after the first promotion", async () => {
  const { prisma, state } = createFakePrisma();
  const service = new BuildOpsLegacyPromotionService(prisma as never);

  const first = await service.promoteApprovedPlanToLegacy({
    tenantId: "tenant_default",
    orgId: "org_client_001",
    userId: "usr_client_001",
    roles: ["CLIENT"],
    buildOpsProjectId: state.plan.id,
  });

  const second = await service.promoteApprovedPlanToLegacy({
    tenantId: "tenant_default",
    orgId: "org_client_001",
    userId: "usr_client_001",
    roles: ["CLIENT"],
    buildOpsProjectId: state.plan.id,
  });

  assert.equal(first.status, "promoted");
  assert.equal(second.status, "already_promoted");
  assert.equal(second.alreadyPromoted, true);
  assert.equal(second.milestonesCreated, 0);
  assert.equal(state.milestones.length, 1);
  assert.equal(state.jobTasks.length, 1);
});

for (const approvalStatus of ["pending", "rejected", "changes_requested"] as const) {
  test(`promoteApprovedPlanToLegacy blocks ${approvalStatus} plans`, async () => {
    const { prisma, state } = createFakePrisma({ approvalStatus });
    const service = new BuildOpsLegacyPromotionService(prisma as never);

    await assert.rejects(
      () =>
        service.promoteApprovedPlanToLegacy({
          tenantId: "tenant_default",
          orgId: "org_client_001",
          userId: "usr_client_001",
          roles: ["CLIENT"],
          buildOpsProjectId: state.plan.id,
        }),
      /BuildOps plan must be approved before legacy promotion/,
    );
  });
}
