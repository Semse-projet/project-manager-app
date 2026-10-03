import test from "node:test";
import assert from "node:assert/strict";
import { WeatherController } from "../dist/modules/weather/weather.controller.js";
import { ResourceScopeResolver } from "../dist/common/resource-scope.resolver.js";

// C51 etapa 3 (migración gradual del resolver): las rutas de clima por proyecto exigen tenant + ProjectScope.
// Antes leían alertas / disparaban consultas por `projectId` sin comprobar tenant ni organización.

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
const weather = {
  listActiveAlerts: async (id: string) => (calls.push(`alerts:${id}`), [{ id: "a1" }]),
  checkProjectWeather: async (id: string) => (calls.push(`check:${id}`), []),
};
const controller = new (WeatherController as any)(weather, new ResourceScopeResolver(prisma as never));
const req = (orgId: string, tenantId = "t1", roles: string[] = []) => ({ headers: {}, authContext: { tenantId, orgId, userId: "u1", roles } });
const status = async (p: Promise<unknown>) => {
  try {
    await p;
    return 200;
  } catch (e) {
    return (e as { getStatus?: () => number }).getStatus?.() ?? 500;
  }
};

test("otro tenant ⇒ 404 (también OPS_ADMIN) y el servicio NO se llama; proyecto inexistente ⇒ 404", async () => {
  calls.length = 0;
  for (const roles of [[], ["OPS_ADMIN"]]) {
    assert.equal(await status(controller.getActiveAlerts(req("org_client", "t2", roles), "p1")), 404);
    assert.equal(await status(controller.checkProject(req("org_client", "t2", roles), "p1")), 404);
  }
  assert.equal(await status(controller.getActiveAlerts(req("org_client"), "p_t2")), 404); // existe, pero en otro tenant
  assert.equal(await status(controller.getActiveAlerts(req("org_client"), "no_existe")), 404);
  assert.deepEqual(calls, []);
});

test("otra org del mismo tenant ⇒ 403 y org vacía nunca concede; el servicio NO se llama", async () => {
  calls.length = 0;
  for (const orgId of ["org_other", ""]) {
    assert.equal(await status(controller.getActiveAlerts(req(orgId), "p1")), 403, `alerts org=${orgId}`);
    assert.equal(await status(controller.checkProject(req(orgId), "p1")), 403, `check org=${orgId}`);
  }
  assert.deepEqual(calls, []);
});

test("cliente, profesional asignado y OPS_ADMIN del tenant sí pueden", async () => {
  calls.length = 0;
  for (const r of [req("org_client"), req("org_pro"), req("", "t1", ["OPS_ADMIN"])]) {
    assert.equal(await status(controller.getActiveAlerts(r, "p1")), 200);
    assert.equal(await status(controller.checkProject(r, "p1")), 200);
  }
  assert.equal(calls.length, 6);
});
