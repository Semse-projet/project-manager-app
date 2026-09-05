import test from "node:test";
import assert from "node:assert/strict";
import {
  buildProjectLifecycleProjection,
  isProjectLifecyclePersistenceEnabled,
  isProjectLifecycleProjectionEnabled,
} from "../dist/modules/projects/project-lifecycle-projection.js";

const firstNow = new Date("2026-07-28T12:00:00.000Z");
const secondNow = new Date("2026-07-28T12:05:00.000Z");

const baseInput = {
  project: {
    id: "proj_1",
    tenantId: "tenant_1",
    jobId: "job_1",
    title: "Kitchen remodel",
    jobStatus: "IN_PROGRESS",
    status: "in_progress" as const,
    ownerOrgId: "org_pro_1",
    startAt: new Date("2026-07-20T12:00:00.000Z"),
    dueAt: new Date("2026-08-20T12:00:00.000Z"),
    deadline: null,
    acceptedBidCount: 1,
    contract: {
      signedClientAt: new Date("2026-07-20T09:00:00.000Z"),
      signedProAt: new Date("2026-07-20T10:00:00.000Z"),
      updatedAt: new Date("2026-07-20T10:00:00.000Z"),
    },
    jobUpdatedAt: new Date("2026-07-28T10:00:00.000Z"),
    createdAt: new Date("2026-07-19T12:00:00.000Z"),
    updatedAt: new Date("2026-07-28T11:00:00.000Z"),
  },
  milestones: [
    {
      id: "ms_1",
      amount: 3000,
      status: "PAID",
      updatedAt: new Date("2026-07-28T11:30:00.000Z"),
      evidenceItems: [
        {
          id: "req_1",
          required: true,
          status: "approved",
          updatedAt: new Date("2026-07-28T11:20:00.000Z"),
        },
      ],
    },
    {
      id: "ms_2",
      amount: 7000,
      status: "APPROVED",
      updatedAt: new Date("2026-07-28T11:40:00.000Z"),
      evidenceItems: [],
    },
  ],
  evidence: [
    {
      id: "ev_1",
      validationStatus: "passed",
      updatedAt: new Date("2026-07-28T11:25:00.000Z"),
    },
  ],
  disputes: [],
  escrow: {
    status: "ACTIVE",
    currency: "USD",
    updatedAt: new Date("2026-07-28T11:45:00.000Z"),
    transactions: [
      {
        id: "txn_1",
        type: "DEPOSIT",
        amount: 10000,
        status: "SUCCEEDED",
        createdAt: new Date("2026-07-25T00:00:00.000Z"),
      },
      {
        id: "txn_2",
        type: "RELEASE",
        amount: 3000,
        status: "SUCCEEDED",
        createdAt: new Date("2026-07-28T11:45:00.000Z"),
      },
      {
        id: "txn_3",
        type: "RELEASE",
        amount: 9000,
        status: "FAILED",
        createdAt: new Date("2026-07-28T11:46:00.000Z"),
      },
      {
        id: "txn_4",
        type: "FEE",
        amount: 100,
        status: "SUCCEEDED",
        createdAt: new Date("2026-07-28T11:47:00.000Z"),
      },
    ],
  },
  expenses: [
    {
      id: "exp_1",
      amount: 2200,
      currency: "USD",
      status: "approved",
      isDuplicate: false,
      updatedAt: new Date("2026-07-28T11:50:00.000Z"),
    },
    {
      id: "exp_2",
      amount: 999,
      currency: "USD",
      status: "rejected",
      isDuplicate: false,
      updatedAt: new Date("2026-07-28T11:51:00.000Z"),
    },
  ],
  risk: {
    overallScore: 25,
    disputeRisk: 0.1,
    budgetOverrunRisk: 0.2,
    scheduleRisk: 0.3,
    calculatedAt: new Date("2026-07-28T11:55:00.000Z"),
    updatedAt: new Date("2026-07-28T11:55:00.000Z"),
  },
};

test("projection separates work progress, expenses and successful payment movements", () => {
  const projection = buildProjectLifecycleProjection({ ...baseInput, now: firstNow });

  assert.equal(projection.project.commercialStage, "contract_signed");
  assert.equal(projection.progress.percentage, 100);
  assert.equal(projection.progress.milestones.paid, 1);
  assert.equal(projection.financial.planned, 10000);
  assert.equal(projection.financial.actualExpenses, 2200);
  assert.equal(projection.financial.released, 3000);
  assert.equal(projection.financial.fees, 100);
  assert.equal(projection.financial.available, 6900);
  assert.equal(projection.risk?.level, "low");
  assert.match(projection.revision, /^project-lifecycle\.v1:[a-f0-9]{64}$/);
  assert.equal(projection.sourceUpdatedAt, "2026-07-28T11:55:00.000Z");
});

test("revision is deterministic across generation time and source array order", () => {
  const first = buildProjectLifecycleProjection({ ...baseInput, now: firstNow });
  const second = buildProjectLifecycleProjection({
    ...baseInput,
    milestones: [...baseInput.milestones].reverse(),
    expenses: [...baseInput.expenses].reverse(),
    now: secondNow,
  });

  assert.equal(first.revision, second.revision);
  assert.notEqual(first.generatedAt, second.generatedAt);
});

test("projection prioritizes disputes, missing evidence and critical risk", () => {
  const projection = buildProjectLifecycleProjection({
    ...baseInput,
    project: {
      ...baseInput.project,
      status: "blocked",
      dueAt: new Date("2026-07-27T12:00:00.000Z"),
    },
    milestones: [
      {
        id: "ms_1",
        amount: 1000,
        status: "REJECTED",
        updatedAt: firstNow,
        evidenceItems: [
          {
            id: "req_1",
            required: true,
            status: "missing",
            updatedAt: firstNow,
          },
        ],
      },
    ],
    evidence: [
      {
        id: "ev_1",
        validationStatus: "failed",
        updatedAt: firstNow,
      },
    ],
    disputes: [
      {
        id: "dispute_1",
        status: "UNDER_REVIEW",
        reason: "quality",
        updatedAt: firstNow,
      },
    ],
    risk: {
      ...baseInput.risk,
      overallScore: 85,
    },
    now: firstNow,
  });

  assert.equal(projection.nextAction.code, "active_dispute");
  assert.equal(projection.blockers[0]?.severity, "critical");
  assert.ok(projection.blockers.some((blocker) => blocker.code === "missing_required_evidence"));
  assert.ok(projection.blockers.some((blocker) => blocker.code === "critical_risk"));
});

test("projection never mixes approved expenses from different currencies", () => {
  const projection = buildProjectLifecycleProjection({
    ...baseInput,
    project: {
      ...baseInput.project,
      contract: null,
    },
    milestones: [],
    escrow: null,
    expenses: [
      { ...baseInput.expenses[0], id: "usd", currency: "USD", status: "approved" },
      { ...baseInput.expenses[0], id: "mxn", currency: "MXN", status: "approved" },
    ],
    risk: null,
    now: firstNow,
  });

  assert.equal(projection.financial.currency, null);
  assert.equal(projection.financial.actualExpenses, 0);
  assert.deepEqual(
    projection.financial.expensesByCurrency.map((item) => item.currency),
    ["MXN", "USD"],
  );
  assert.deepEqual(projection.sources.missing.sort(), ["contract", "escrow", "risk"]);
});

test("feature flags require both global enablement and tenant allowlist", () => {
  assert.equal(isProjectLifecycleProjectionEnabled("tenant_1", {}), false);
  assert.equal(
    isProjectLifecycleProjectionEnabled("tenant_1", {
      SEMSE_PROJECT_LIFECYCLE_PROJECTION_ENABLED: "true",
      SEMSE_PROJECT_LIFECYCLE_CANARY_TENANT_IDS: "tenant_2",
    }),
    false,
  );
  assert.equal(
    isProjectLifecycleProjectionEnabled("tenant_1", {
      SEMSE_PROJECT_LIFECYCLE_PROJECTION_ENABLED: "true",
      SEMSE_PROJECT_LIFECYCLE_CANARY_TENANT_IDS: "tenant_1",
    }),
    true,
  );
  assert.equal(
    isProjectLifecycleProjectionEnabled("tenant_1", {
      SEMSE_PROJECT_LIFECYCLE_PROJECTION_ENABLED: "true",
      SEMSE_PROJECT_LIFECYCLE_CANARY_TENANT_IDS: "*",
    }),
    true,
  );
  assert.equal(
    isProjectLifecyclePersistenceEnabled({
      SEMSE_PROJECT_LIFECYCLE_PERSIST_ENABLED: "true",
    }),
    true,
  );
});
