import test from "node:test";
import assert from "node:assert/strict";
import { BadRequestException, ForbiddenException, NotFoundException } from "@nestjs/common";
import { PrometeoToolExecutionService } from "../dist/modules/prometeo/prometeo-tool-execution.service.js";
import { PaymentsService } from "../dist/modules/payments/payments.service.js";
import { PaymentsRepository } from "../dist/modules/payments/payments.repository.js";

// AUDIT_REMEDIATION_PLAN 0.48. `payments.propose_release` is human_required:
// on approval it runs as the approving OPS_ADMIN, so release()'s own
// participation checks never looked at the PROPOSER. Anyone holding
// finance:write (CLIENT, PRO) could queue a release on a project they take no
// part in. Uses the REAL PaymentsService/PaymentsRepository check and the real
// project-financials policy over a two-tenant, two-org fixture.

type Actor = { tenantId: string; orgId: string; userId: string; roles: string[] };
const actor = (orgId: string, roles: string[], tenantId = "tenant_a", userId = `usr_${orgId}`): Actor =>
  ({ tenantId, orgId, userId, roles });

function fakePrisma() {
  const projects: Record<string, { id: string; tenantId: string; jobId: string; assignedProOrgId: string; job: { clientOrgId: string } }> = {
    project_a: { id: "project_a", tenantId: "tenant_a", jobId: "job_a", assignedProOrgId: "org_pro", job: { clientOrgId: "org_client" } },
    project_b: { id: "project_b", tenantId: "tenant_a", jobId: "job_b", assignedProOrgId: "org_other_pro", job: { clientOrgId: "org_other_client" } },
    project_x: { id: "project_x", tenantId: "tenant_b", jobId: "job_x", assignedProOrgId: "org_pro", job: { clientOrgId: "org_client" } },
  };
  const milestones: Record<string, { projectId: string }> = {
    ms_a: { projectId: "project_a" },
    ms_b: { projectId: "project_b" },
    ms_x: { projectId: "project_x" },
  };
  return {
    milestone: {
      async findFirst({ where }: any) {
        const m = milestones[where.id];
        if (!m) return null;
        return projects[m.projectId].tenantId === where.project.tenantId ? { projectId: m.projectId } : null;
      },
    },
    project: {
      async findFirst({ where }: any) {
        const p = projects[where.id];
        return p && p.tenantId === where.tenantId ? p : null;
      },
    },
  };
}

function realPayments() {
  const repo = new PaymentsRepository(fakePrisma() as never, {
    async ensureActorContext() { throw new Error("proposal check must not upsert actor context"); },
  } as never);
  let releaseCalls = 0;
  const payments = {
    assertCanProposeRelease: (input: unknown) =>
      (PaymentsService.prototype as any).assertCanProposeRelease.call({ paymentsRepository: repo }, input),
    async release() { releaseCalls += 1; return { transaction: { id: "txn" } }; },
  };
  return { payments, releaseCalls: () => releaseCalls };
}

function makeGovernance() {
  const created: Array<Record<string, unknown>> = [];
  const recorded: Array<Record<string, unknown>> = [];
  return {
    created,
    recorded,
    async recordInvocation(input: Record<string, unknown>) { recorded.push(input); },
    async createProposedAction(input: Record<string, unknown>) {
      const row = { id: `action_${created.length + 1}`, status: "PROPOSED", ...input };
      created.push(row);
      return row;
    },
  };
}

function makeService(payments: unknown, governance = makeGovernance()) {
  const service = new PrometeoToolExecutionService(
    {} as never, {} as never, {} as never, {} as never, {} as never, {} as never, {} as never,
    governance as never,
    payments as never,
  );
  return { service, governance };
}

const propose = (service: PrometeoToolExecutionService, who: Actor, input: Record<string, unknown>) =>
  service.invokeWriteTool(who as never, "req_1", { namespace: "payments", name: "propose_release", input });

for (const [label, who] of [
  ["client org of the project", actor("org_client", ["CLIENT"])],
  ["assigned pro org", actor("org_pro", ["PRO"])],
  ["OPS_ADMIN of the same tenant", actor("org_ops", ["OPS_ADMIN"])],
] as const) {
  test(`propose_release: ${label} can queue a proposal`, async () => {
    const { payments } = realPayments();
    const { service, governance } = makeService(payments);
    const result = await propose(service, who, { milestoneId: "ms_a" });
    assert.equal(result.status, "queued");
    assert.equal(governance.created.length, 1);
  });
}

test("propose_release: PRO of another org in the same tenant → 403, nothing queued", async () => {
  const { payments, releaseCalls } = realPayments();
  const { service, governance } = makeService(payments);
  await assert.rejects(() => propose(service, actor("org_pro", ["PRO"]), { milestoneId: "ms_b" }), ForbiddenException);
  assert.equal(governance.created.length, 0);
  assert.equal(releaseCalls(), 0);
  assert.equal(governance.recorded.at(-1)?.status, "blocked");
});

test("propose_release: milestone of another tenant → 404, nothing queued (even for OPS_ADMIN)", async () => {
  const { payments } = realPayments();
  const { service, governance } = makeService(payments);
  await assert.rejects(() => propose(service, actor("org_client", ["CLIENT"]), { milestoneId: "ms_x" }), NotFoundException);
  await assert.rejects(() => propose(service, actor("org_ops", ["OPS_ADMIN"]), { milestoneId: "ms_x" }), NotFoundException);
  assert.equal(governance.created.length, 0);
});

test("propose_release: unknown milestone → 404; missing milestoneId → 400; nothing queued", async () => {
  const { payments } = realPayments();
  const { service, governance } = makeService(payments);
  await assert.rejects(() => propose(service, actor("org_client", ["CLIENT"]), { milestoneId: "nope" }), NotFoundException);
  await assert.rejects(() => propose(service, actor("org_client", ["CLIENT"]), {}), BadRequestException);
  assert.equal(governance.created.length, 0);
});

test("propose_release: without the payments service the proposal fails closed (403)", async () => {
  const { service, governance } = makeService(undefined);
  await assert.rejects(() => propose(service, actor("org_client", ["CLIENT"]), { milestoneId: "ms_a" }), ForbiddenException);
  assert.equal(governance.created.length, 0);
});

test("time_tracker writes are not routed through the payments scope check", async () => {
  let scopeCalls = 0;
  const payments = { async assertCanProposeRelease() { scopeCalls += 1; } };
  const { service, governance } = makeService(payments);
  const result = await service.invokeWriteTool(actor("org_pro", ["PRO"]) as never, "req_1", {
    namespace: "time_tracker", name: "start", input: { jobId: "job_a" },
  });
  assert.equal(scopeCalls, 0);
  assert.equal(result.status, "queued");
  assert.equal(governance.created.length, 1);
});
