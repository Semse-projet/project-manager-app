import test from "node:test";
import assert from "node:assert/strict";
import { ResourceScopeResolver } from "../dist/common/resource-scope.resolver.js";
import { hasScopeAccess } from "../dist/common/resource-scope.js";

// C51 etapa 3 — el resolver canónico: SIEMPRE filtrado por tenant; otro tenant / inexistente ⇒ null (404 en el llamador).

type Q = { where: { id: string; tenantId: string } };
const seenWhere: Array<Record<string, unknown>> = [];
const ROWS = {
  project: [{ id: "p1", tenantId: "t1", assignedProOrgId: "org_pro", job: { clientOrgId: "org_client" } }],
  job: [
    { id: "j1", tenantId: "t1", clientOrgId: "org_client", project: { assignedProOrgId: "org_pro" } },
    { id: "j_nopro", tenantId: "t1", clientOrgId: "org_client", project: null },
  ],
  dispute: [{ id: "d1", tenantId: "t1", project: { assignedProOrgId: "org_pro", job: { clientOrgId: "org_client" } } }],
};
const find = (rows: Array<{ id: string; tenantId: string }>) => async ({ where }: Q) => {
  seenWhere.push(where);
  return rows.find((r) => r.id === where.id && r.tenantId === where.tenantId) ?? null;
};
const prisma = {
  project: { findFirst: find(ROWS.project) },
  job: { findFirst: find(ROWS.job) },
  dispute: { findFirst: find(ROWS.dispute) },
};
const resolver = new ResourceScopeResolver(prisma as never);

test("resolveProjectScope: tenant del actor ⇒ alcance con org cliente y profesional; otro tenant/inexistente ⇒ null", async () => {
  assert.deepEqual(await resolver.resolveProjectScope("t1", "p1"), { tenantId: "t1", clientOrgId: "org_client", assignedProOrgId: "org_pro" });
  assert.equal(await resolver.resolveProjectScope("t2", "p1"), null);
  assert.equal(await resolver.resolveProjectScope("t1", "no_existe"), null);
  assert.equal(await resolver.resolveProjectScope("", "p1"), null);
  assert.equal(await resolver.resolveProjectScope("t1", ""), null);
});

test("resolveJobScope: job sin Project ⇒ sin profesional asignado (undefined, nunca '' )", async () => {
  const withPro = await resolver.resolveJobScope("t1", "j1");
  assert.deepEqual(withPro, { tenantId: "t1", clientOrgId: "org_client", assignedProOrgId: "org_pro" });
  const noPro = await resolver.resolveJobScope("t1", "j_nopro");
  assert.equal(noPro?.assignedProOrgId, undefined);
  assert.equal(await resolver.resolveJobScope("t2", "j1"), null);
});

test("resolveDisputeScope: hereda el alcance del proyecto; otro tenant ⇒ null", async () => {
  assert.deepEqual(await resolver.resolveDisputeScope("t1", "d1"), { tenantId: "t1", clientOrgId: "org_client", assignedProOrgId: "org_pro" });
  assert.equal(await resolver.resolveDisputeScope("t2", "d1"), null);
});

test("requireProjectScope: 404 si no existe en el tenant", async () => {
  await assert.rejects(resolver.requireProjectScope("t2", "p1"), (e: any) => e.getStatus() === 404);
  assert.equal((await resolver.requireProjectScope("t1", "p1")).clientOrgId, "org_client");
});

test("toda consulta del resolver lleva el filtro de tenant del actor", async () => {
  seenWhere.length = 0;
  await resolver.resolveProjectScope("t1", "p1");
  await resolver.resolveJobScope("t1", "j1");
  await resolver.resolveDisputeScope("t1", "d1");
  assert.equal(seenWhere.length, 3);
  for (const w of seenWhere) assert.equal(w.tenantId, "t1");
});

test("el alcance del resolver compone con hasScopeAccess: org vacía nunca concede, otro tenant no cruza (ni OPS_ADMIN)", async () => {
  const scope = (await resolver.resolveProjectScope("t1", "p1"))!;
  const actor = (orgId: string, tenantId = "t1", roles: string[] = []) => ({ tenantId, orgId, roles });
  assert.equal(hasScopeAccess(actor("org_client"), scope, "read"), true);
  assert.equal(hasScopeAccess(actor("org_pro"), scope, "read"), true);
  assert.equal(hasScopeAccess(actor("org_other"), scope, "read"), false);
  assert.equal(hasScopeAccess(actor(""), scope, "read"), false);
  assert.equal(hasScopeAccess(actor("", "t2", ["OPS_ADMIN"]), scope, "read"), false);
});
