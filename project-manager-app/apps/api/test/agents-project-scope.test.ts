import assert from "node:assert/strict";
import test from "node:test";
import { ForbiddenException, NotFoundException } from "@nestjs/common";
import { AgentsController } from "../dist/modules/agents/agents.controller.js";
import { ProjectAccessService } from "../dist/modules/agents/project-access.service.js";
import { ProjectCopilotHarness } from "../dist/modules/agents/harnesses/project-copilot.harness.js";

// Hallazgo 0.37: copiloto de proyecto, planes de trabajo y rutas del coordinador exigen participación.
const TENANT = "tenant_a";
const PROJECTS: Record<string, { tenantId: string; clientOrgId: string; assignedProOrgId: string }> = {
  p_mine: { tenantId: TENANT, clientOrgId: "org_client", assignedProOrgId: "org_pro" },
  p_other_org: { tenantId: TENANT, clientOrgId: "org_x", assignedProOrgId: "org_y" },
  p_other_tenant: { tenantId: "tenant_b", clientOrgId: "org_client", assignedProOrgId: "org_pro" },
};
const resolver = {
  async resolveProjectScope(tenantId: string, projectId: string) {
    const p = PROJECTS[projectId];
    return p && p.tenantId === tenantId ? p : null;
  },
};
const access = new ProjectAccessService(resolver as never);
const client = { tenantId: TENANT, orgId: "org_client", userId: "u_client", roles: ["CLIENT"] };
const pro = { tenantId: TENANT, orgId: "org_pro", userId: "u_pro", roles: ["PRO"] };
const admin = { tenantId: TENANT, orgId: "org_admin", userId: "u_admin", roles: ["OPS_ADMIN"] };
const stranger = { tenantId: TENANT, orgId: "org_z", userId: "u_z", roles: ["CLIENT"] };

async function code(p: Promise<unknown>): Promise<number | "ok"> {
  try { await p; return "ok"; } catch (e) {
    if (e instanceof NotFoundException) return 404;
    if (e instanceof ForbiddenException) return 403;
    throw e;
  }
}

test("ProjectAccessService: participantes y OPS_ADMIN pasan; otra org 403; otro tenant/inexistente 404", async () => {
  assert.equal(await code(access.assertProjectAccess(client, "p_mine")), "ok");
  assert.equal(await code(access.assertProjectAccess(pro, "p_mine")), "ok");
  assert.equal(await code(access.assertProjectAccess(admin, "p_mine")), "ok");
  assert.equal(await code(access.assertProjectAccess(stranger, "p_mine")), 403);
  assert.equal(await code(access.assertProjectAccess(client, "p_other_org")), 403);
  assert.equal(await code(access.assertProjectAccess(client, "p_other_tenant")), 404);
  assert.equal(await code(access.assertProjectAccess(admin, "p_other_tenant")), 404);
  assert.equal(await code(access.assertProjectAccess(client, "nope")), 404);
  assert.equal(await code(access.assertProjectAccess(client, "")), 404);
});

test("assertPlanAccess: hereda el proyecto; sin proyecto solo creador u OPS_ADMIN", async () => {
  assert.equal(await code(access.assertPlanAccess(client, { projectId: "p_mine", createdBy: "x" })), "ok");
  assert.equal(await code(access.assertPlanAccess(stranger, { projectId: "p_mine", createdBy: "x" })), 403);
  assert.equal(await code(access.assertPlanAccess(client, { createdBy: "u_client" })), "ok");
  assert.equal(await code(access.assertPlanAccess(admin, { createdBy: "u_client" })), "ok");
  assert.equal(await code(access.assertPlanAccess(stranger, { createdBy: "u_client" })), 403);
});

const untouchable = new Proxy({}, { get() { throw new Error("dependencia tocada antes del guard"); } });

test("copiloto: run() deniega antes de tocar workspace/memoria/plan/acciones", async () => {
  const deps = Array.from({ length: 22 }, () => untouchable);
  const harness = new (ProjectCopilotHarness as unknown as new (...a: unknown[]) => InstanceType<typeof ProjectCopilotHarness>)(...deps, access);
  for (const kind of ["chat", "search", "action", "refresh"] as const) {
    const input = { kind, projectId: "p_other_org", message: "hola", query: "q", actionType: "READ_CONTEXT", payload: {} };
    assert.equal(await code(harness.run(client, "req", input as never)), 403, kind);
    assert.equal(await code(harness.run(client, "req", { ...input, projectId: "p_other_tenant" } as never)), 404, kind);
  }
});

test("copiloto: executeFromApproval vuelve a comprobar el proyecto del contexto aprobado", async () => {
  const deps = Array.from({ length: 22 }, () => untouchable);
  const harness = new (ProjectCopilotHarness as unknown as new (...a: unknown[]) => InstanceType<typeof ProjectCopilotHarness>)(...deps, access);
  const approval = { id: "a1", correlationId: "copilot:x", contextSummary: JSON.stringify({ projectId: "p_other_tenant", actionType: "RUN_COMMAND", payload: {} }) };
  assert.equal(await code(harness.executeFromApproval(admin, "req", approval)), 404);
});

function controller(planOwnership: { projectId?: string; createdBy: string }) {
  const calls: string[] = [];
  const planMode = {
    async getPlanOwnership() { return planOwnership; },
    async getPlanById() { calls.push("getPlanById"); return { id: "plan" }; },
    async listByProject() { calls.push("listByProject"); return []; },
    async approvePlan() { calls.push("approvePlan"); return {}; },
    async startStep() { calls.push("startStep"); return {}; },
  };
  const coordinator = {
    async listByProject() { calls.push("listByProject"); return []; },
    async collectProjectSnapshot() { calls.push("snapshot"); return {}; },
  };
  const c = new AgentsController(untouchable as never, untouchable as never, planMode as never, coordinator as never, untouchable as never, access);
  return { c, calls };
}
const req = (actor: typeof client, projectId?: string) => ({
  headers: { ...(projectId ? { "x-project-id": projectId } : {}), "x-tenant-id": actor.tenantId, "x-org-id": actor.orgId, "x-user-id": actor.userId, "x-roles": actor.roles.join(",") },
  authContext: { ...actor, requestId: "r" },
});

test("planes: leer/aprobar/mutar pasos de un plan de proyecto ajeno ⇒ 403 y no llega al servicio", async () => {
  const { c, calls } = controller({ projectId: "p_other_org", createdBy: "someone" });
  const r = req(client) as never;
  assert.equal(await code(c.getPlan(r, "plan")), 403);
  assert.equal(await code(c.approvePlan(r, "plan")), 403);
  assert.equal(await code(c.startPlanStep(r, "plan", "step", {})), 403);
  assert.deepEqual(calls, []);
});

test("planes: participante sí accede", async () => {
  const { c, calls } = controller({ projectId: "p_mine", createdBy: "someone" });
  assert.equal(await code(c.getPlan(req(client) as never, "plan")), "ok");
  assert.deepEqual(calls, ["getPlanById"]);
});

test("listPlans / delegations / coordinator snapshot con x-project-id ajeno ⇒ 403/404", async () => {
  const { c, calls } = controller({ projectId: "p_mine", createdBy: "x" });
  assert.equal(await code(c.listPlans(req(client, "p_other_org") as never)), 403);
  assert.equal(await code(c.listDelegations(req(client, "p_other_tenant") as never)), 404);
  assert.equal(await code(c.coordinatorSnapshot(req(client, "p_other_org") as never)), 403);
  assert.deepEqual(calls, []);
  assert.equal(await code(c.listDelegations(req(admin, "p_mine") as never)), "ok");
});
