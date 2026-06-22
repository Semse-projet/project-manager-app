import "reflect-metadata";

import test from "node:test";
import assert from "node:assert/strict";
import { Ecosystem5DService } from "../../apps/api/dist/modules/intelligence/ecosystem-5d.service.js";

const STUB_VIEW = {
  scope: "tenant" as const,
  tenantId: "tenant_1",
  projectId: null,
  score: 75,
  status: "stable" as const,
  dimensions: [
    {
      key: "execution" as const,
      label: "Execution",
      score: 80,
      status: "strong" as const,
      summary: "Milestones progressing well",
      signals: [
        { label: "Active Projects", value: "5", impact: "positive" as const },
        { label: "Stale Projects", value: "1", impact: "negative" as const },
      ],
    },
    {
      key: "finance" as const,
      label: "Finance",
      score: 70,
      status: "stable" as const,
      summary: "Cash flow stable",
      signals: [
        { label: "Pending Invoices", value: "3", impact: "negative" as const },
      ],
    },
    {
      key: "evidence" as const,
      label: "Evidence",
      score: 85,
      status: "strong" as const,
      summary: "Evidence validation passing",
      signals: [],
    },
    {
      key: "trust" as const,
      label: "Trust",
      score: 65,
      status: "stable" as const,
      summary: "Credential verification needed",
      signals: [],
    },
    {
      key: "operations" as const,
      label: "Operations",
      score: 75,
      status: "stable" as const,
      summary: "Operational efficiency on track",
      signals: [],
    },
  ],
  alerts: [
    {
      level: "medium" as const,
      dimension: "finance" as const,
      message: "3 pending invoices need review",
      action: "Review pending invoices in Finance module",
    },
  ],
  generatedAt: new Date().toISOString(),
};

test("ecosystem-5d service: buildView returns view with all 5 dimensions", async () => {
  const buildCalls: unknown[] = [];
  const service = new Ecosystem5DService(
    {
      project: {
        findUnique: async () => null,
        findMany: async () => [],
      },
      milestone: { findMany: async () => [] },
      evidence: { findMany: async () => [] },
      dispute: { findMany: async () => [] },
      invoice: { findMany: async () => [] },
      projectExpense: { findMany: async () => [] },
      paymentEscrow: { findMany: async () => [] },
      professionalCredential: { findMany: async () => [] },
      agentDelegation: { findMany: async () => [] },
      projectRiskScore: { findMany: async () => [] },
    } as never,
    {
      calculateRiskScore: async () => ({ overallScore: 45 }),
    } as never,
    undefined
  );

  // This will call buildTenantView since no projectId is provided
  // and will return a view with all dimensions
  const result = await service.buildView({ tenantId: "tenant_1" });

  assert.ok(result);
  assert.equal(result.tenantId, "tenant_1");
  assert.equal(result.scope, "tenant");
  assert.ok(Array.isArray(result.dimensions));
  assert.equal(result.dimensions.length, 5);
  assert.ok(result.dimensions.find((d) => d.key === "execution"));
  assert.ok(result.dimensions.find((d) => d.key === "finance"));
  assert.ok(result.dimensions.find((d) => d.key === "evidence"));
  assert.ok(result.dimensions.find((d) => d.key === "trust"));
  assert.ok(result.dimensions.find((d) => d.key === "operations"));
});

test("ecosystem-5d service: buildView handles projectId parameter", async () => {
  const findUniqueCalls: unknown[] = [];
  const service = new Ecosystem5DService(
    {
      project: {
        findUnique: async (input: unknown) => {
          findUniqueCalls.push(input);
          return null; // Project not found or doesn't match tenant
        },
        findMany: async () => [],
      },
      milestone: { findMany: async () => [] },
      evidence: { findMany: async () => [] },
      dispute: { findMany: async () => [] },
      invoice: { findMany: async () => [] },
      projectExpense: { findMany: async () => [] },
      paymentEscrow: { findMany: async () => [] },
      professionalCredential: { findMany: async () => [] },
      agentDelegation: { findMany: async () => [] },
      projectRiskScore: { findMany: async () => [] },
    } as never,
    {
      calculateRiskScore: async () => ({ overallScore: 45 }),
    } as never,
    undefined
  );

  await service.buildView({ tenantId: "tenant_1", projectId: "proj_1" });

  // Verify it attempted to fetch the project
  assert.ok(findUniqueCalls.length > 0);
  assert.ok((findUniqueCalls[0] as any)?.where?.id === "proj_1");
});

test("ecosystem-5d service: buildView assigns status strong/stable/watch/critical per score", async () => {
  const service = new Ecosystem5DService(
    {
      project: {
        findUnique: async () => null,
        findMany: async () => [],
      },
      milestone: { findMany: async () => [] },
      evidence: { findMany: async () => [] },
      dispute: { findMany: async () => [] },
      invoice: { findMany: async () => [] },
      projectExpense: { findMany: async () => [] },
      paymentEscrow: { findMany: async () => [] },
      professionalCredential: { findMany: async () => [] },
      agentDelegation: { findMany: async () => [] },
      projectRiskScore: { findMany: async () => [] },
    } as never,
    {
      calculateRiskScore: async () => ({ overallScore: 45 }),
    } as never,
    undefined
  );

  const result = await service.buildView({ tenantId: "tenant_1" });

  assert.ok(result.status);
  // Status should be one of: strong (>=80), stable (>=60), watch (>=40), critical (<40)
  assert.ok(
    ["strong", "stable", "watch", "critical"].includes(result.status)
  );
});

test("ecosystem-5d service: buildView returns alerts array", async () => {
  const service = new Ecosystem5DService(
    {
      project: {
        findUnique: async () => null,
        findMany: async () => [],
      },
      milestone: { findMany: async () => [] },
      evidence: { findMany: async () => [] },
      dispute: { findMany: async () => [] },
      invoice: { findMany: async () => [] },
      projectExpense: { findMany: async () => [] },
      paymentEscrow: { findMany: async () => [] },
      professionalCredential: { findMany: async () => [] },
      agentDelegation: { findMany: async () => [] },
      projectRiskScore: { findMany: async () => [] },
    } as never,
    {
      calculateRiskScore: async () => ({ overallScore: 45 }),
    } as never,
    undefined
  );

  const result = await service.buildView({ tenantId: "tenant_1" });

  assert.ok(Array.isArray(result.alerts));
  // Alerts may be empty, but the field must exist
});

test("ecosystem-5d service: buildView includes generatedAt timestamp", async () => {
  const service = new Ecosystem5DService(
    {
      project: {
        findUnique: async () => null,
        findMany: async () => [],
      },
      milestone: { findMany: async () => [] },
      evidence: { findMany: async () => [] },
      dispute: { findMany: async () => [] },
      invoice: { findMany: async () => [] },
      projectExpense: { findMany: async () => [] },
      paymentEscrow: { findMany: async () => [] },
      professionalCredential: { findMany: async () => [] },
      agentDelegation: { findMany: async () => [] },
      projectRiskScore: { findMany: async () => [] },
    } as never,
    {
      calculateRiskScore: async () => ({ overallScore: 45 }),
    } as never,
    undefined
  );

  const result = await service.buildView({ tenantId: "tenant_1" });

  assert.ok(result.generatedAt);
  // Should be ISO format timestamp
  assert.ok(new Date(result.generatedAt).getTime() > 0);
});

test("ecosystem-5d service: buildView queries data by tenantId", async () => {
  const queries: unknown[] = [];

  const trackingMock = () => {
    return async (input: unknown) => {
      queries.push(input);
      return [];
    };
  };

  const service = new Ecosystem5DService(
    {
      project: {
        findUnique: async () => null,
        findMany: trackingMock(),
      },
      milestone: { findMany: trackingMock() },
      evidence: { findMany: trackingMock() },
      dispute: { findMany: trackingMock() },
      invoice: { findMany: trackingMock() },
      projectExpense: { findMany: trackingMock() },
      paymentEscrow: { findMany: trackingMock() },
      professionalCredential: { findMany: trackingMock() },
      agentDelegation: { findMany: trackingMock() },
      projectRiskScore: { findMany: trackingMock() },
    } as never,
    {
      calculateRiskScore: async () => ({ overallScore: 45 }),
    } as never,
    undefined
  );

  await service.buildView({ tenantId: "tenant_test" });

  // Verify that queries were made with the correct tenantId
  const tenantQueries = queries.filter(
    (q: any) => q?.where?.tenantId === "tenant_test" || q?.where?.project?.tenantId === "tenant_test"
  );
  assert.ok(tenantQueries.length > 0);
});
