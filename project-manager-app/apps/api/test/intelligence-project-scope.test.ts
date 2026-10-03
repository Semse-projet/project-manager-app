import test from "node:test";
import assert from "node:assert/strict";
import { IntelligenceController } from "../dist/modules/intelligence/intelligence.controller.js";
import { ResourceScopeResolver } from "../dist/common/resource-scope.resolver.js";

// C51 etapa 3 (migración gradual del resolver): archive (POST/GET) y risk por proyecto exigen
// tenant + ProjectScope. Antes los servicios cargaban el proyecto solo por id (sin tenant ni org) y
// `buildArchive` escribía un ProjectArchive con el tenant del actor sobre un proyecto ajeno.

const PROJECTS = [
  { id: "p1", tenantId: "t1", assignedProOrgId: "org_pro", job: { clientOrgId: "org_client" } },
  { id: "p_t2", tenantId: "t2", assignedProOrgId: "org_pro_t2", job: { clientOrgId: "org_client_t2" } },
];
const prisma = {
  project: {
    findFirst: async ({ where }: { where: { id: string; tenantId: string } }) =>
      PROJECTS.find((p) => p.id === where.id && p.tenantId === where.tenantId) ?? null,
  },
};
const calls: string[] = [];
const twin = {
  buildArchive: async (i: { projectId: string }) => (calls.push(`build:${i.projectId}`), { id: "arch1" }),
  getArchive: async (id: string) => (calls.push(`get:${id}`), { id: "arch1" }),
};
const risk = { calculateProjectRisk: async (_t: string, id: string) => (calls.push(`risk:${id}`), { score: 10 }) };
const controller = new (IntelligenceController as any)(twin, risk, {}, {}, {}, {}, {}, new ResourceScopeResolver(prisma as never));
const req = (orgId: string, tenantId = "t1", roles: string[] = []) => ({ headers: {}, authContext: { tenantId, orgId, userId: "u1", roles } });
const status = async (p: Promise<unknown>) => {
  try {
    await p;
    return 200;
  } catch (e) {
    return (e as { getStatus?: () => number }).getStatus?.() ?? 500;
  }
};
const routes = (r: ReturnType<typeof req>, projectId: string) => [
  status(controller.archiveProject(r, projectId)),
  status(controller.getArchive(r, projectId)),
  status(controller.projectRisk(r, projectId)),
];

test("otro tenant ⇒ 404 (también OPS_ADMIN) y el servicio NO se llama; proyecto inexistente ⇒ 404", async () => {
  calls.length = 0;
  for (const roles of [[], ["OPS_ADMIN"]]) {
    assert.deepEqual(await Promise.all(routes(req("org_client", "t2", roles), "p1")), [404, 404, 404]);
  }
  assert.deepEqual(await Promise.all(routes(req("org_client"), "p_t2")), [404, 404, 404]); // existe, pero en otro tenant
  assert.deepEqual(await Promise.all(routes(req("org_client"), "no_existe")), [404, 404, 404]);
  assert.deepEqual(calls, []);
});

test("otra org del mismo tenant ⇒ 403 y org vacía nunca concede; el servicio NO se llama", async () => {
  calls.length = 0;
  for (const orgId of ["org_other", ""]) {
    assert.deepEqual(await Promise.all(routes(req(orgId), "p1")), [403, 403, 403], `org=${orgId}`);
  }
  assert.deepEqual(calls, []);
});

test("cliente, profesional asignado y OPS_ADMIN del tenant sí pueden", async () => {
  calls.length = 0;
  for (const r of [req("org_client"), req("org_pro"), req("", "t1", ["OPS_ADMIN"])]) {
    assert.deepEqual(await Promise.all(routes(r, "p1")), [200, 200, 200]);
  }
  assert.equal(calls.length, 9);
});
