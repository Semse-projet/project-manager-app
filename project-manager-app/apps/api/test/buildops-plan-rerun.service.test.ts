import test from "node:test";
import assert from "node:assert/strict";
import { Prisma } from "@prisma/client";
import { BuildOpsPlanRerunService } from "../dist/modules/buildops/buildops-plan-rerun.service.js";

function createFakeBridge(input?: {
  shouldFail?: boolean;
}) {
  return {
    computeBridgePlan: async () => {
      if (input?.shouldFail) {
        throw new Error("bridge failed for requested changes");
      }

      return {
        jobId: "job_rerun_1",
        projectIntakeId: "intake_rerun_1",
        projectPatch: {
          title: "Updated rerun plan",
          description: "Updated scope after client requested changes.",
          trade: "painting",
          projectType: "interior-painting",
          clientName: "Client Org",
          location: "Miami, FL",
          budgetEstimate: 1800,
          status: "estimating",
          riskScore: 32,
          riskLevel: "medium",
          sourceTool: "intake_operations_bridge",
          completion: 15,
        },
        sourceToolInput: {
          sourceKind: "smart_intake",
          jobId: "job_rerun_1",
          projectIntakeId: "intake_rerun_1",
          trade: "painting",
          rerunContext: {
            runReason: "client_changes_requested",
          },
        },
        sourceToolResult: {
          schemaVersion: "1.0",
          bridgeVersion: 1,
          estimate: {
            status: "ready",
            scopeSummary: "Updated scope after client requested changes.",
            missingInputs: [],
            tool: "painting",
            quoteSummary: {
              total: 1800,
              recommendedDeposit: 540,
              recommendedEscrow: 1800,
              currency: "USD",
            },
          },
          milestonePlan: {
            trade: "painting",
            totalAmount: 1800,
            riskLevel: "medium",
            milestones: [],
            fundingSchedule: [],
          },
          evidenceChecklist: {
            trade: "painting",
            riskLevel: "medium",
            requiredCount: 0,
            items: [],
            notes: [],
          },
          paymentReadiness: {
            status: "draft",
            ready: false,
            checks: {
              acceptedReservation: false,
            },
            reasons: ["Contract pending"],
            reservationId: null,
            contractId: null,
          },
          warnings: [],
          recommendations: [],
        },
        taskTemplates: [
          {
            templateKey: "review_client_request",
            title: "Review updated client request",
            description: "Re-check updated scope before approval.",
            priority: "medium",
            evidenceRequired: { checklist: ["summary"] },
          },
        ],
        estimate: {
          status: "ready",
          scopeSummary: "Updated scope after client requested changes.",
          missingInputs: [],
          tool: "painting",
          quoteTotal: 1800,
        },
        matching: {
          status: "ready",
          candidatesEvaluated: 1,
          candidateCount: 1,
          topCandidates: [],
          preferredCandidateStatus: null,
          algorithmVersion: null,
          computedAt: null,
        },
        milestones: {
          count: 0,
          items: [],
        },
        evidenceRequirements: {
          count: 0,
          items: [],
        },
        paymentReadiness: {
          status: "draft",
          ready: false,
          reason: "Contract pending",
          suggestedDeposit: 540,
          suggestedEscrow: 1800,
          checks: {
            acceptedReservation: false,
          },
        },
      };
    },
    syncProjectedBuildOpsTasks: async () => ({
      taskIds: ["bot_rerun_1"],
      tasksCreated: 1,
      tasksReused: 0,
    }),
  };
}

function createFakePrisma(initial?: {
  approvalStatus?: string;
  legacyPromotionStatus?: string;
  versions?: Array<{
    id: string;
    versionNumber: number;
    status: string;
    completedAt?: Date | null;
    sourceToolInputJson?: Record<string, unknown> | null;
    sourceToolResultJson?: Record<string, unknown> | null;
  }>;
  promotedCounts?: {
    project?: number;
    milestone?: number;
    task?: number;
    evidence?: number;
  };
}) {
  const state = {
    plan: {
      id: "bop_rerun_1",
      tenantId: "tenant_default",
      orgId: "org_client_001",
      jobId: "job_rerun_1",
      createdBy: "usr_client_001",
      sourceToolInput: {
        sourceKind: "smart_intake",
      },
      sourceToolResult: {
        estimate: {
          status: "ready",
          scopeSummary: "Original scope",
        },
      },
      clientPlanApprovalStatus: initial?.approvalStatus ?? "changes_requested",
      clientPlanReviewedAt: new Date("2026-05-12T15:00:00.000Z"),
      clientPlanReviewComment: "Need to reduce prep work and adjust estimate.",
      legacyPromotionStatus: initial?.legacyPromotionStatus ?? "pending",
      updatedAt: new Date("2026-05-12T16:00:00.000Z"),
    },
    versions:
      initial?.versions?.map((version) => ({
        id: version.id,
        tenantId: "tenant_default",
        buildOpsProjectId: "bop_rerun_1",
        versionNumber: version.versionNumber,
        status: version.status,
        sourceToolInputJson: version.sourceToolInputJson ?? { sourceKind: "smart_intake" },
        sourceToolResultJson: version.sourceToolResultJson ?? { estimate: { status: "ready" } },
        inputSnapshotJson: null,
        clientPlanReviewCommentSnapshot: null,
        runReason: "seed",
        triggeredByUserId: "usr_client_001",
        triggeredAt: new Date("2026-05-12T14:00:00.000Z"),
        completedAt: version.completedAt ?? new Date("2026-05-12T14:05:00.000Z"),
        previousVersionId: null,
        errorMessage: null,
        createdAt: new Date("2026-05-12T14:00:00.000Z"),
        updatedAt: new Date("2026-05-12T14:05:00.000Z"),
      })) ?? [],
    promotedCounts: {
      project: initial?.promotedCounts?.project ?? 0,
      milestone: initial?.promotedCounts?.milestone ?? 0,
      task: initial?.promotedCounts?.task ?? 0,
      evidence: initial?.promotedCounts?.evidence ?? 0,
    },
    transactionOptions: [] as Array<Prisma.PrismaPromiseTransactionOptions | null>,
  };

  let counter = 1;
  const nextId = () => `ver_${counter++}`;

  const prisma = {
    buildOpsProject: {
      findFirst: async () => ({ ...state.plan }),
      update: async ({ data }: { data: Record<string, unknown> }) => {
        state.plan = { ...state.plan, ...data };
        return { ...state.plan };
      },
    },
    buildOpsPlanVersion: {
      findFirst: async ({ where, orderBy }: { where: Record<string, unknown>; orderBy?: { versionNumber: "asc" | "desc" } }) => {
        let versions = state.versions.filter((version) => {
          if (where["tenantId"] && version.tenantId !== where["tenantId"]) return false;
          if (where["buildOpsProjectId"] && version.buildOpsProjectId !== where["buildOpsProjectId"]) return false;
          if (where["status"] && version.status !== where["status"]) return false;
          if (where["id"] && version.id !== where["id"]) return false;
          return true;
        });
        if (orderBy?.versionNumber === "desc") {
          versions = versions.sort((left, right) => right.versionNumber - left.versionNumber);
        } else if (orderBy?.versionNumber === "asc") {
          versions = versions.sort((left, right) => left.versionNumber - right.versionNumber);
        }
        return versions[0] ? { ...versions[0] } : null;
      },
      create: async ({ data }: { data: Record<string, unknown> }) => {
        const created = {
          id: typeof data.id === "string" ? data.id : nextId(),
          tenantId: String(data.tenantId),
          buildOpsProjectId: String(data.buildOpsProjectId),
          versionNumber: Number(data.versionNumber),
          sourceToolInputJson: (data.sourceToolInputJson as Record<string, unknown> | null) ?? null,
          sourceToolResultJson: (data.sourceToolResultJson as Record<string, unknown> | null) ?? null,
          inputSnapshotJson: (data.inputSnapshotJson as Record<string, unknown> | null) ?? null,
          clientPlanReviewCommentSnapshot: (data.clientPlanReviewCommentSnapshot as string | null) ?? null,
          runReason: String(data.runReason),
          triggeredByUserId: String(data.triggeredByUserId),
          triggeredAt: (data.triggeredAt as Date | undefined) ?? new Date(),
          completedAt: (data.completedAt as Date | null | undefined) ?? null,
          previousVersionId: (data.previousVersionId as string | null | undefined) ?? null,
          status: String(data.status),
          errorMessage: (data.errorMessage as string | null | undefined) ?? null,
          createdAt: new Date(),
          updatedAt: new Date(),
        };
        state.versions.push(created);
        return { ...created };
      },
      update: async ({ where, data }: { where: Record<string, unknown>; data: Record<string, unknown> }) => {
        const version = state.versions.find((item) => item.id === where["id"]);
        if (!version) throw new Error("version not found");
        Object.assign(version, data, { updatedAt: new Date() });
        return { ...version };
      },
      updateMany: async ({ where, data }: { where: Record<string, unknown>; data: Record<string, unknown> }) => {
        let count = 0;
        for (const version of state.versions) {
          if (where["id"] && version.id !== where["id"]) continue;
          if (where["tenantId"] && version.tenantId !== where["tenantId"]) continue;
          if (where["buildOpsProjectId"] && version.buildOpsProjectId !== where["buildOpsProjectId"]) continue;
          if (where["status"] && version.status !== where["status"]) continue;
          Object.assign(version, data, { updatedAt: new Date() });
          count += 1;
        }
        return { count };
      },
    },
    project: {
      count: async () => state.promotedCounts.project,
    },
    milestone: {
      count: async () => state.promotedCounts.milestone,
    },
    jobTask: {
      count: async () => state.promotedCounts.task,
    },
    evidence: {
      count: async () => state.promotedCounts.evidence,
    },
    job: {
      findFirst: async () => ({
        id: "job_rerun_1",
        tenantId: "tenant_default",
        clientOrgId: "org_client_001",
        title: "Rerun fixture job",
        category: "Pintura interior",
        scope: "Paint the living room.",
        status: "PUBLISHED",
        location: "Miami, FL",
        urgency: "medium",
        budgetMin: new Prisma.Decimal(1200),
        budgetMax: new Prisma.Decimal(1800),
        updatedAt: new Date("2026-05-12T16:00:00.000Z"),
      }),
    },
    projectIntake: {
      findFirst: async () => ({
        id: "intake_rerun_1",
        publishedJobId: "job_rerun_1",
        rawDescription: "Original intake description",
        normalizedTitle: "Paint the living room",
        detectedCategory: "interior_painting",
        missingFields: [],
        uploadedImagesJson: [],
        projectScopeJson: {},
        generatedEstimateJson: null,
        generatedMilestonesJson: [],
        activeWarningsJson: [],
        updatedAt: new Date("2026-05-12T15:30:00.000Z"),
      }),
    },
    $transaction: async <T>(
      work: (tx: typeof prisma) => Promise<T>,
      options?: Prisma.PrismaPromiseTransactionOptions,
    ) => {
      state.transactionOptions.push(options ?? null);
      return work(prisma);
    },
  };

  return { prisma, state };
}

test("rerunBridge bootstraps version history, creates a new active version, and resets approval to pending", async () => {
  const { prisma, state } = createFakePrisma();
  const service = new BuildOpsPlanRerunService(prisma as never, createFakeBridge() as never);

  const result = await service.rerunBridge({
    tenantId: "tenant_default",
    orgId: "org_admin_001",
    userId: "usr_admin_001",
    roles: ["OPS_ADMIN"],
    buildOpsProjectId: state.plan.id,
  });

  assert.equal(result.status, "rerun_completed");
  assert.equal(result.activeVersionNumber, 2);
  assert.equal(result.previousVersionNumber, 1);
  assert.equal(result.approvalStatus, "pending");
  assert.equal(state.plan.clientPlanApprovalStatus, "pending");
  assert.equal(state.plan.clientPlanApprovedAt, null);
  assert.equal(state.plan.title, "Updated rerun plan");
  assert.equal((state.plan.sourceToolResult as Record<string, unknown>)["estimate"] != null, true);
  assert.equal(state.versions.length, 2);
  assert.deepEqual(
    state.versions.map((version) => ({ versionNumber: version.versionNumber, status: version.status })),
    [
      { versionNumber: 1, status: "superseded" },
      { versionNumber: 2, status: "active" },
    ],
  );
  assert.equal(state.versions[1]?.clientPlanReviewCommentSnapshot, "Need to reduce prep work and adjust estimate.");
  assert.equal(
    state.transactionOptions.every((options) => options?.isolationLevel === Prisma.TransactionIsolationLevel.Serializable),
    true,
  );
});

for (const blockedStatus of ["approved", "pending", "rejected"] as const) {
  test(`rerunBridge blocks ${blockedStatus} plans`, async () => {
    const { prisma, state } = createFakePrisma({
      approvalStatus: blockedStatus,
      versions: [
        {
          id: "ver_active",
          versionNumber: 1,
          status: "active",
        },
      ],
    });
    const service = new BuildOpsPlanRerunService(prisma as never, createFakeBridge() as never);

    await assert.rejects(
      () =>
        service.rerunBridge({
          tenantId: "tenant_default",
          orgId: "org_admin_001",
          userId: "usr_admin_001",
          roles: ["OPS_ADMIN"],
          buildOpsProjectId: state.plan.id,
        }),
      /must be in changes_requested/,
    );
  });
}

test("rerunBridge blocks plans that already have promoted legacy artifacts", async () => {
  const { prisma, state } = createFakePrisma({
    versions: [
      {
        id: "ver_active",
        versionNumber: 1,
        status: "active",
      },
    ],
    promotedCounts: {
      milestone: 1,
    },
  });
  const service = new BuildOpsPlanRerunService(prisma as never, createFakeBridge() as never);

  await assert.rejects(
    () =>
      service.rerunBridge({
        tenantId: "tenant_default",
        orgId: "org_admin_001",
        userId: "usr_admin_001",
        roles: ["OPS_ADMIN"],
        buildOpsProjectId: state.plan.id,
      }),
    /already has promoted legacy artifacts/,
  );
});

test("rerunBridge marks the new version as failed when bridge computation fails and preserves the active mirror", async () => {
  const { prisma, state } = createFakePrisma();
  const originalSourceToolResult = structuredClone(state.plan.sourceToolResult);
  const service = new BuildOpsPlanRerunService(prisma as never, createFakeBridge({ shouldFail: true }) as never);

  await assert.rejects(
    () =>
      service.rerunBridge({
        tenantId: "tenant_default",
        orgId: "org_admin_001",
        userId: "usr_admin_001",
        roles: ["OPS_ADMIN"],
        buildOpsProjectId: state.plan.id,
      }),
    /bridge failed/,
  );

  assert.equal(state.plan.clientPlanApprovalStatus, "changes_requested");
  assert.deepEqual(state.plan.sourceToolResult, originalSourceToolResult);
  assert.equal(state.versions.length, 2);
  assert.deepEqual(
    state.versions.map((version) => ({ versionNumber: version.versionNumber, status: version.status })),
    [
      { versionNumber: 1, status: "active" },
      { versionNumber: 2, status: "failed" },
    ],
  );
  assert.match(state.versions[1]?.errorMessage ?? "", /bridge failed/);
});

test("rerunBridge blocks when another rerun is already running", async () => {
  const { prisma, state } = createFakePrisma({
    versions: [
      {
        id: "ver_active",
        versionNumber: 1,
        status: "active",
      },
      {
        id: "ver_running",
        versionNumber: 2,
        status: "running",
        completedAt: null,
      },
    ],
  });
  const service = new BuildOpsPlanRerunService(prisma as never, createFakeBridge() as never);

  await assert.rejects(
    () =>
      service.rerunBridge({
        tenantId: "tenant_default",
        orgId: "org_admin_001",
        userId: "usr_admin_001",
        roles: ["OPS_ADMIN"],
        buildOpsProjectId: state.plan.id,
      }),
    /already in progress/,
  );
});
