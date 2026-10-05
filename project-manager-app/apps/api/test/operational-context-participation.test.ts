import test from "node:test";
import assert from "node:assert/strict";
import { ForbiddenException, NotFoundException } from "@nestjs/common";

import { OperationalContextService } from "../dist/modules/ai-models/context/operational-context.service.js";

// Audit finding 1.11b follow-up: a `projectId` must only open the project blocks (finance, risk, 5D project
// view) for the client org, the assigned professional org or OPS_ADMIN of the same tenant, and the tenant-wide
// 5D lens must only reach OPS_ADMIN. Contract = IntelligenceController.assertProjectAccess / resource-scope.

type ProjectRow = { tenantId: string; assignedProOrgId: string | null; job: { clientOrgId: string | null } | null };

function makePrisma(projects: Record<string, ProjectRow> = {}, snapshots: Array<Record<string, unknown>> = []) {
  const projectLookups: Array<{ id: string; tenantId: string }> = [];
  // buildContext reads the project summary, milestones, escrow, evidence and disputes by `projectId` alone
  // (no tenant filter), so none of those queries may run before the participation check passes.
  const projectKeyedReads = { project: 0, escrow: 0 };
  return {
    projectLookups,
    projectKeyedReads,
    prisma: {
      job: { findMany: async () => [], count: async () => 0 },
      jobsBidsProjection: { findMany: async () => [] },
      notification: { findMany: async () => [] },
      userProfile: { findUnique: async () => null },
      paymentEscrow: {
        findMany: async () => [],
        findUnique: async () => {
          projectKeyedReads.escrow += 1;
          return null;
        },
      },
      milestone: { findMany: async () => [] },
      dispute: { findMany: async () => [] },
      evidence: { findMany: async () => [] },
      workspaceMemoryEntry: { findFirst: async () => null },
      project: {
        findUnique: async () => {
          projectKeyedReads.project += 1;
          return null;
        },
        // Same query ResourceScopeResolver issues: always filtered by the actor's tenant.
        findFirst: async ({ where }: { where: { id: string; tenantId: string } }) => {
          projectLookups.push({ id: where.id, tenantId: where.tenantId });
          const row = projects[where.id];
          return row && row.tenantId === where.tenantId ? row : null;
        },
      },
      operationalContextSnapshot: {
        create: async () => ({}),
        deleteMany: async () => ({ count: 0 }),
        findFirst: async () => snapshots[0] ?? null,
      },
    },
  };
}

function makeProjectServices() {
  const calls = { finance: [] as string[], risk: [] as string[], eco: [] as Array<{ tenantId: string; projectId?: string }> };
  return {
    calls,
    finance: {
      getProjectSummary: async (_t: string, projectId: string) => {
        calls.finance.push(projectId);
        return { totalInvoiced: 1000, totalPaid: 400, totalPending: 600, totalExpenses: 300, invoiceCount: 2, expenseCount: 1, margin: 70, expensesByCategory: { materials: 300 } };
      },
      listInvoices: async () => [],
    },
    risk: {
      calculateProjectRisk: async (_t: string, projectId: string) => {
        calls.risk.push(projectId);
        return { overallScore: 20, level: "low", disputeRisk: 0, budgetOverrunRisk: 0, scheduleRisk: 0, recommendations: [] };
      },
    },
    eco: {
      buildView: async (input: { tenantId: string; projectId?: string }) => {
        calls.eco.push(input);
        return { score: 80, status: "strong", dimensions: [], alerts: [] };
      },
    },
  };
}

function makeService(projects: Record<string, ProjectRow>, snapshots: Array<Record<string, unknown>> = []) {
  const { prisma, projectLookups, projectKeyedReads } = makePrisma(projects, snapshots);
  const svc = makeProjectServices();
  const service = new OperationalContextService(prisma as never, undefined, undefined, svc.finance as never, svc.eco as never, svc.risk as never);
  return { service, svc, projectLookups, projectKeyedReads };
}

const T = "tenant_1";
const PROJECTS: Record<string, ProjectRow> = {
  p1: { tenantId: T, assignedProOrgId: "org_pro", job: { clientOrgId: "org_client" } },
  p_other_tenant: { tenantId: "tenant_2", assignedProOrgId: "org_pro", job: { clientOrgId: "org_client" } },
  p_no_job: { tenantId: T, assignedProOrgId: null, job: null },
};
const client = { tenantId: T, orgId: "org_client", userId: "u_client", role: "CLIENT", roles: ["CLIENT"] };
const pro = { tenantId: T, orgId: "org_pro", userId: "u_pro", role: "PRO", roles: ["PRO"] };
const outsider = { tenantId: T, orgId: "org_outsider", userId: "u_out", role: "CLIENT", roles: ["CLIENT"] };
const admin = { tenantId: T, orgId: "org_ops", userId: "u_admin", role: "OPS_ADMIN", roles: ["OPS_ADMIN"] };

test("the client org of the project gets the finance, risk and 5D project blocks", async () => {
  const { service, svc } = makeService(PROJECTS);
  const ctx = await service.buildContext({ ...client, projectId: "p1" });
  assert.deepEqual(svc.calls.finance, ["p1"]);
  assert.deepEqual(svc.calls.risk, ["p1"]);
  assert.deepEqual(svc.calls.eco, [{ tenantId: T, projectId: "p1" }]);
  assert.ok(ctx.finance && ctx.risk && ctx.ecosystem5d);
});

test("the assigned professional gets operational blocks, without project financials", async () => {
  const { service, svc } = makeService(PROJECTS);
  const ctx = await service.buildContext({ ...pro, projectId: "p1" });
  assert.equal(ctx.finance, null);
  assert.ok(ctx.risk && ctx.ecosystem5d);
  assert.deepEqual(svc.calls.finance, []);
});

test("another org of the same tenant is refused with 403 and no project block is computed", async () => {
  const { service, svc, projectKeyedReads } = makeService(PROJECTS);
  await assert.rejects(() => service.buildContext({ ...outsider, projectId: "p1" }), ForbiddenException);
  assert.deepEqual(svc.calls.finance, []);
  assert.deepEqual(svc.calls.risk, []);
  assert.deepEqual(svc.calls.eco, []);
  assert.deepEqual(projectKeyedReads, { project: 0, escrow: 0 }, "no project-keyed read may run before the check");
});

test("the project summary, escrow and milestone reads only run for an allowed actor", async () => {
  const { service, projectKeyedReads } = makeService(PROJECTS);
  await service.buildContext({ ...client, projectId: "p1" });
  assert.deepEqual(projectKeyedReads, { project: 1, escrow: 1 });
});

test("a project of another tenant or one that does not exist is a 404 for everybody, OPS_ADMIN included", async () => {
  for (const actor of [client, admin]) {
    const { service, svc, projectLookups, projectKeyedReads } = makeService(PROJECTS);
    await assert.rejects(() => service.buildContext({ ...actor, projectId: "p_other_tenant" }), NotFoundException);
    await assert.rejects(() => service.buildContext({ ...actor, projectId: "does_not_exist" }), NotFoundException);
    assert.deepEqual(projectKeyedReads, { project: 0, escrow: 0 });
    assert.deepEqual(svc.calls.finance, []);
    // the lookup is always filtered by the actor's own tenant
    assert.ok(projectLookups.every((lookup) => lookup.tenantId === T));
  }
});

test("a project with no client org and no assigned pro is closed to non-admins (an empty org never matches)", async () => {
  const { service } = makeService(PROJECTS);
  await assert.rejects(() => service.buildContext({ ...client, orgId: "", projectId: "p_no_job" }), ForbiddenException);
  await assert.rejects(() => service.buildContext({ ...client, projectId: "p_no_job" }), ForbiddenException);
});

test("OPS_ADMIN reaches any project of its own tenant", async () => {
  const { service, svc } = makeService(PROJECTS);
  const ctx = await service.buildContext({ ...admin, projectId: "p1" });
  assert.ok(ctx.finance && ctx.risk && ctx.ecosystem5d);
  assert.deepEqual(svc.calls.finance, ["p1"]);
});

test("without a projectId the tenant-wide 5D lens is only built for OPS_ADMIN", async () => {
  for (const actor of [client, pro, outsider]) {
    const { service, svc } = makeService(PROJECTS);
    const ctx = await service.buildContext({ ...actor });
    assert.equal(ctx.ecosystem5d, null, `${actor.role} must not receive the tenant lens`);
    assert.deepEqual(svc.calls.eco, []);
  }
  const { service, svc } = makeService(PROJECTS);
  const ctx = await service.buildContext({ ...admin });
  assert.ok(ctx.ecosystem5d);
  assert.deepEqual(svc.calls.eco, [{ tenantId: T, projectId: undefined }]);
});

test("OPS_ADMIN is recognised from the full roles list, not only the first role", async () => {
  const { service } = makeService(PROJECTS);
  const ctx = await service.buildContext({ ...admin, role: "CLIENT", roles: ["CLIENT", "OPS_ADMIN"] });
  assert.ok(ctx.ecosystem5d);
});

test("a caller that only knows the role never gets admin by accident", async () => {
  const { service } = makeService(PROJECTS);
  const ctx = await service.buildContext({ tenantId: T, orgId: "org_client", userId: "u_x", role: "CLIENT" });
  assert.equal(ctx.ecosystem5d, null);
});

test("the cache never serves an admin context to a non-admin of the same user id", async () => {
  const { service } = makeService(PROJECTS);
  const adminCtx = await service.buildContext({ ...admin });
  assert.ok(adminCtx.ecosystem5d);
  const downgraded = await service.buildContext({ ...admin, role: "CLIENT", roles: ["CLIENT"] });
  assert.equal(downgraded.ecosystem5d, null);
});

test("a cached project context is not served once the actor stopped participating in the project", async () => {
  const projects: Record<string, ProjectRow> = { p1: { tenantId: T, assignedProOrgId: "org_pro", job: { clientOrgId: "org_client" } } };
  const { service } = makeService(projects);
  assert.ok((await service.buildContext({ ...pro, projectId: "p1" })).risk);
  projects.p1.assignedProOrgId = "org_someone_else"; // the pro was replaced inside the 60 s cache window
  await assert.rejects(() => service.buildContext({ ...pro, projectId: "p1" }), ForbiddenException);
});

const SNAPSHOT_BODY = {
  user: { id: "u", role: "CLIENT", tenantId: T, orgId: "org_client" },
  jobs: { active: 0 },
  ecosystem5d: { score: 26, status: "critical", dimensions: [], alerts: [] },
  finance: { totalInvoiced: 1000 },
  risk: { overallScore: 20 },
};

test("latest snapshot: an old tenant-level snapshot is scrubbed of 5D, finance and risk for non-admins", async () => {
  const { service } = makeService(PROJECTS, [{ snapshotJson: SNAPSHOT_BODY, projectId: null }]);
  const ctx = await service.getLatestSnapshot({ tenantId: T, userId: "u_client", orgId: "org_client", roles: ["CLIENT"] });
  assert.ok(ctx);
  assert.equal(ctx.ecosystem5d, null);
  assert.equal(ctx.finance, null);
  assert.equal(ctx.risk, null);
});

test("latest snapshot: OPS_ADMIN keeps the tenant-level snapshot untouched", async () => {
  const { service } = makeService(PROJECTS, [{ snapshotJson: SNAPSHOT_BODY, projectId: null }]);
  const ctx = await service.getLatestSnapshot({ tenantId: T, userId: "u_admin", orgId: "org_ops", roles: ["OPS_ADMIN"] });
  assert.deepEqual(ctx?.ecosystem5d, SNAPSHOT_BODY.ecosystem5d);
});

test("latest snapshot: without orgId or roles the actor is the narrowest one", async () => {
  const { service } = makeService(PROJECTS, [{ snapshotJson: SNAPSHOT_BODY, projectId: null }]);
  const ctx = await service.getLatestSnapshot({ tenantId: T, userId: "u_x" });
  assert.equal(ctx?.ecosystem5d, null);
});

test("latest snapshot: a project snapshot is returned to a participant and withheld from an outsider", async () => {
  const snapshots = [{ snapshotJson: SNAPSHOT_BODY, projectId: "p1" }];
  const { service } = makeService(PROJECTS, snapshots);
  assert.ok(await service.getLatestSnapshot({ tenantId: T, userId: "u_client", orgId: "org_client", roles: ["CLIENT"] }));
  assert.equal(await service.getLatestSnapshot({ tenantId: T, userId: "u_out", orgId: "org_outsider", roles: ["CLIENT"] }), null);
});

test("latest snapshot: asking for a project the actor cannot access fails instead of reading its snapshot", async () => {
  const { service } = makeService(PROJECTS, [{ snapshotJson: SNAPSHOT_BODY, projectId: "p1" }]);
  await assert.rejects(
    () => service.getLatestSnapshot({ tenantId: T, userId: "u_out", orgId: "org_outsider", roles: ["CLIENT"], projectId: "p1" }),
    ForbiddenException,
  );
  await assert.rejects(
    () => service.getLatestSnapshot({ tenantId: T, userId: "u_client", orgId: "org_client", roles: ["CLIENT"], projectId: "p_other_tenant" }),
    NotFoundException,
  );
});

test("C51 finance: cached project context drops financials after client ownership is lost, even if still a participant", async () => {
  const projects: Record<string, ProjectRow> = { p1: { tenantId: T, assignedProOrgId: "org_pro", job: { clientOrgId: "org_client" } } };
  const { service } = makeService(projects);
  assert.ok((await service.buildContext({ ...client, projectId: "p1" })).finance);
  projects.p1.job.clientOrgId = "org_new_client";
  projects.p1.assignedProOrgId = "org_client";
  assert.equal((await service.buildContext({ ...client, projectId: "p1" })).finance, null);
});

test("C51 finance: project snapshots and low-permission context cannot expose financials", async () => {
  const { service } = makeService(PROJECTS, [{ snapshotJson: SNAPSHOT_BODY, projectId: "p1" }]);
  const snapshot = await service.getLatestSnapshot({ tenantId: T, userId: "u_pro", orgId: "org_pro", roles: ["PRO"], projectId: "p1" });
  assert.equal(snapshot?.finance, null);
  const ctx = await service.buildContext({ ...client, role: "UNKNOWN_ROLE", roles: ["UNKNOWN_ROLE"], projectId: "p1" });
  assert.equal(ctx.finance, null);
});
