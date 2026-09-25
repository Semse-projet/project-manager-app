import test from "node:test";
import assert from "node:assert/strict";
import { OperationalRagContextService } from "../dist/modules/prometeo/operational-rag-context.service.js";

// WS-01C G1 finding: build() used to run every sub-query (milestone,
// evidence, change orders, signals, payment governance) scoped only by
// tenantId — reachable via POST /v1/buildops/projects/:id/rag-query
// (projects:read, held by CLIENT/PRO). Fixed with a single ownership gate on
// projectId up front (org-derived, OPS_ADMIN bypass); this test covers that
// gate — the primary attack surface, since every other sub-query only runs
// after it passes.

function makeService(projectOrgId: string | null) {
  const prisma = {
    buildOpsProject: {
      findFirst: async ({ where }: { where: Record<string, unknown> }) => {
        if (projectOrgId === null) return null;
        if (where.orgId && where.orgId !== projectOrgId) return null;
        return { id: "bop_1" };
      },
    },
    changeOrderCandidate: { findMany: async () => [] },
    operationalSignal: { findMany: async () => [] },
  };
  const governance = {};
  const buildops = { getProjectHealth: async () => ({ status: "healthy" }) };
  return new OperationalRagContextService(prisma as never, governance as never, buildops as never);
}

test("build() returns forbidden and touches nothing else when the project belongs to a different org", async () => {
  const service = makeService("org_owner");
  const ctx = await service.build({
    projectId: "bop_1",
    tenantId: "tnt_1",
    orgId: "org_attacker",
    roles: [],
  });

  assert.deepEqual(ctx.missingSources, ["forbidden"]);
  assert.equal(ctx.project, null);
  assert.equal(ctx.milestone, null);
  assert.equal(ctx.paymentGovernance, null);
  assert.equal(ctx.evidenceItems.length, 0);
  assert.equal(ctx.changeOrders.length, 0);
});

test("build() proceeds past the gate for the owning org", async () => {
  const service = makeService("org_owner");
  const ctx = await service.build({
    projectId: "bop_1",
    tenantId: "tnt_1",
    orgId: "org_owner",
    roles: [],
  });

  assert.notDeepEqual(ctx.missingSources, ["forbidden"]);
});

test("build() proceeds past the gate for OPS_ADMIN regardless of org", async () => {
  const service = makeService("org_owner");
  const ctx = await service.build({
    projectId: "bop_1",
    tenantId: "tnt_1",
    orgId: "org_attacker",
    roles: ["OPS_ADMIN"],
  });

  assert.notDeepEqual(ctx.missingSources, ["forbidden"]);
});
