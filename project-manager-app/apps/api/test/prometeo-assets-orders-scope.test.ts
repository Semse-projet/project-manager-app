import "reflect-metadata";
import test from "node:test";
import assert from "node:assert/strict";
import { PrometeoController } from "../dist/modules/prometeo/prometeo.controller.js";
import { PrometeoService } from "../dist/modules/prometeo/prometeo.service.js";
import { PrometeoRepository } from "../dist/modules/prometeo/prometeo.repository.js";
import { PrometeoAccessPolicy } from "../dist/modules/prometeo/prometeo-access.policy.js";
import { ResourceScopeResolver } from "../dist/common/resource-scope.resolver.js";

// C51 (decisión del dueño): activos y órdenes de trabajo de Prometeo tienen propietario explícito validado por el servidor.
// Con proyecto/job ⇒ permisos de ese proyecto/job; sin asociación ⇒ solo la org propietaria u OPS_ADMIN; mismo tenant NO basta.
// Antes: listar devolvía todo el tenant, cambiar estado era libre en el tenant y create aceptaba cualquier projectId/jobId.

process.env.DATABASE_URL = process.env.DATABASE_URL || "postgresql://stub:stub@127.0.0.1:1/stub";

const PROJECTS = [
  { id: "p1", tenantId: "t1", assignedProOrgId: "org_pro", job: { clientOrgId: "org_client" } },
  { id: "p_other", tenantId: "t1", assignedProOrgId: "org_pro2", job: { clientOrgId: "org_client2" } },
  { id: "p_t2", tenantId: "t2", assignedProOrgId: "org_pro_t2", job: { clientOrgId: "org_client_t2" } },
];
const JOBS = [
  { id: "job1", tenantId: "t1", clientOrgId: "org_client", project: { assignedProOrgId: "org_pro" } },
  { id: "job_other", tenantId: "t1", clientOrgId: "org_client2", project: { assignedProOrgId: "org_pro2" } },
];
const mk = (id: string, o: Record<string, unknown>) => ({ id, tenantId: "t1", projectId: null, jobId: null, category: "tool", status: "open", createdAt: new Date(), ...o });
const ASSETS = [
  mk("a_org", { orgId: "org_pro" }), // sin proyecto, de org_pro
  mk("a_p1", { orgId: "org_other_creator", projectId: "p1" }),
  mk("a_other_proj", { orgId: "org_pro2", projectId: "p_other" }),
  mk("a_other_org", { orgId: "org_zzz" }),
  mk("a_dangling", { orgId: "org_pro", projectId: "no_existe" }),
  mk("a_t2", { orgId: "org_pro_t2", tenantId: "t2", projectId: "p_t2" }),
];
const ORDERS = [
  mk("w_org", { orgId: "org_pro" }),
  mk("w_p1", { orgId: "org_x", projectId: "p1" }),
  mk("w_job1", { orgId: "org_x", jobId: "job1" }),
  mk("w_job_other", { orgId: "org_x", jobId: "job_other" }),
  mk("w_other_org", { orgId: "org_zzz" }),
];

// Evaluador mínimo del `where` que genera el repositorio (prueba la consulta real, no un doble de ella).
type Where = Record<string, unknown>;
const matches = (row: Record<string, unknown>, where: Where): boolean =>
  Object.entries(where).every(([k, v]) => {
    if (k === "OR") return (v as Where[]).some((w) => matches(row, w));
    if (v && typeof v === "object" && "in" in (v as object)) return (v as { in: unknown[] }).in.includes(row[k]);
    return row[k] === v;
  });
const writes: string[] = [];
const prisma = {
  project: {
    findFirst: async ({ where }: any) => PROJECTS.find((p) => p.id === where.id && p.tenantId === where.tenantId) ?? null,
    findMany: async ({ where }: any) =>
      PROJECTS.filter((p) => p.tenantId === where.tenantId && (p.assignedProOrgId === where.OR[0].assignedProOrgId || p.job.clientOrgId === where.OR[1].job.clientOrgId)).map((p) => ({ id: p.id })),
  },
  job: {
    findFirst: async ({ where }: any) => JOBS.find((j) => j.id === where.id && j.tenantId === where.tenantId) ?? null,
    findMany: async ({ where }: any) =>
      JOBS.filter((j) => j.tenantId === where.tenantId && (j.clientOrgId === where.OR[0].clientOrgId || j.project.assignedProOrgId === where.OR[1].project.assignedProOrgId)).map((j) => ({ id: j.id })),
  },
  prometeoAsset: {
    findFirst: async ({ where }: any) => ASSETS.find((r) => matches(r, where)) ?? null,
    findMany: async ({ where }: any) => ASSETS.filter((r) => matches(r, where)),
    create: async ({ data }: any) => (writes.push(`asset:${data.orgId}:${data.projectId}`), { id: "new", ...data }),
    updateMany: async ({ where }: any) => (writes.push(`asset-status:${where.id}`), { count: 1 }),
  },
  workOrder: {
    findFirst: async ({ where }: any) => ORDERS.find((r) => matches(r, where)) ?? null,
    findMany: async ({ where }: any) => ORDERS.filter((r) => matches(r, where)),
    create: async ({ data }: any) => (writes.push(`wo:${data.orgId}:${data.projectId}:${data.jobId}`), { id: "new", ...data }),
    updateMany: async ({ where }: any) => (writes.push(`wo-status:${where.id}`), { count: 1 }),
  },
};
const svc = new (PrometeoService as any)(new (PrometeoRepository as any)(prisma));
const controller = new (PrometeoController as any)(svc, new PrometeoAccessPolicy(new ResourceScopeResolver(prisma as never)));

const req = (orgId: string, tenantId = "t1", roles: string[] = []) => ({ headers: {}, authContext: { tenantId, orgId, userId: "u1", roles } });
const status = async (p: Promise<unknown>) => {
  try {
    await p;
    return 200;
  } catch (e) {
    return (e as { getStatus?: () => number }).getStatus?.() ?? 500;
  }
};
const ids = async (p: Promise<{ data: Array<{ id: string }> }>) => (await p).data.map((r) => r.id).sort();

test("listar: cada actor ve solo filas de su org sin asociación y de proyectos/jobs donde participa; mismo tenant no basta", async () => {
  assert.deepEqual(await ids(controller.listAssets(req("org_pro"))), ["a_org", "a_p1"]);
  assert.deepEqual(await ids(controller.listAssets(req("org_client"))), ["a_p1"]);
  assert.deepEqual(await ids(controller.listAssets(req("org_stranger"))), []);
  assert.deepEqual(await ids(controller.listAssets(req(""))), []);
  assert.deepEqual(await ids(controller.listWorkOrders(req("org_pro"))), ["w_job1", "w_org", "w_p1"]);
  assert.deepEqual(await ids(controller.listWorkOrders(req("org_client"))), ["w_job1", "w_p1"]);
  assert.deepEqual(await ids(controller.listWorkOrders(req("org_stranger"))), []);
  assert.deepEqual(await ids(controller.listWorkOrders(req(""))), []);
});

test("OPS_ADMIN ve todo su tenant y nunca otro tenant", async () => {
  const ops = req("", "t1", ["OPS_ADMIN"]);
  assert.equal((await ids(controller.listAssets(ops))).includes("a_t2"), false);
  assert.equal((await ids(controller.listAssets(ops))).length, 5);
  assert.deepEqual(await ids(controller.listAssets(req("", "t2", ["OPS_ADMIN"]))), ["a_t2"]);
});

test("listar con projectId: proyecto de otro tenant/inexistente ⇒ 404; sin participación ⇒ 403; participante ⇒ solo ese proyecto", async () => {
  for (const list of [(r: any, p: string) => controller.listAssets(r, p), (r: any, p: string) => controller.listWorkOrders(r, p)]) {
    assert.equal(await status(list(req("org_client", "t2"), "p1")), 404);
    assert.equal(await status(list(req("org_client"), "p_t2")), 404);
    assert.equal(await status(list(req("org_client"), "no_existe")), 404);
    assert.equal(await status(list(req("org_stranger"), "p1")), 403);
    assert.equal(await status(list(req(""), "p1")), 403);
    assert.equal(await status(list(req("org_client"), "p1")), 200);
  }
  assert.deepEqual(await ids(controller.listAssets(req("org_client"), "p1")), ["a_p1"]);
});

test("cambiar estado: otro tenant/inexistente ⇒ 404; sin relación ⇒ 403 (no se escribe); propietario/participante/OPS_ADMIN ⇒ 200", async () => {
  writes.length = 0;
  const upd = [
    (r: any, id: string) => controller.updateAssetStatus(r, id, { status: "retired" }),
    (r: any, id: string) => controller.updateWorkOrderStatus(r, id, { status: "closed" }),
  ];
  const [a, w] = upd;
  for (const roles of [[], ["OPS_ADMIN"]]) assert.equal(await status(a(req("org_pro", "t2", roles), "a_org")), 404);
  assert.equal(await status(a(req("org_pro"), "a_t2")), 404);
  assert.equal(await status(a(req("org_pro"), "no_existe")), 404);
  assert.equal(await status(w(req("org_pro", "t2"), "w_org")), 404);
  assert.deepEqual(writes, []);
  for (const [fn, id] of [[a, "a_org"], [a, "a_p1"], [a, "a_other_proj"], [a, "a_other_org"], [a, "a_dangling"], [w, "w_org"], [w, "w_job_other"], [w, "w_other_org"]] as const) {
    assert.equal(await status(fn(req("org_stranger"), id)), 403, `org ajena sobre ${id}`);
    assert.equal(await status(fn(req(""), id)), 403, `org vacía sobre ${id}`);
  }
  assert.equal(await status(a(req("org_client"), "a_org")), 403);
  assert.deepEqual(writes, []);
  assert.equal(await status(a(req("org_pro"), "a_org")), 200); // propietario
  assert.equal(await status(a(req("org_client"), "a_p1")), 200); // participante del proyecto
  assert.equal(await status(a(req("org_pro"), "a_p1")), 200);
  assert.equal(await status(w(req("org_client"), "w_job1")), 200); // por job
  assert.equal(await status(a(req("", "t1", ["OPS_ADMIN"]), "a_dangling")), 200); // asociación rota: solo OPS_ADMIN
  assert.equal(await status(a(req("org_pro"), "a_dangling")), 403);
});

test("crear: sin org no hay propietario; proyecto/job ajeno o de otro tenant bloquea; el orgId sale del actor, no del cuerpo", async () => {
  writes.length = 0;
  const createA = (r: any, b: Record<string, unknown>) => controller.createAsset(r, b);
  const createW = (r: any, b: Record<string, unknown>) => controller.createWorkOrder(r, b);
  assert.equal(await status(createA(req(""), { name: "x" })), 403);
  assert.equal(await status(createA(req("org_pro"), { name: "x", projectId: "p_t2" })), 404);
  assert.equal(await status(createA(req("org_stranger"), { name: "x", projectId: "p1" })), 403);
  assert.equal(await status(createW(req("org_stranger"), { title: "x", jobId: "job1" })), 403);
  assert.equal(await status(createW(req("org_pro"), { title: "x", jobId: "job_other" })), 403);
  assert.equal(await status(createW(req("org_pro", "t2"), { title: "x", jobId: "job1" })), 404);
  assert.deepEqual(writes, []);
  assert.equal(await status(createA(req("org_pro"), { name: "x", projectId: "p1", orgId: "org_zzz" })), 200);
  assert.equal(await status(createW(req("org_client"), { title: "x", projectId: "p1", jobId: "job1" })), 200);
  assert.equal(await status(createA(req("org_pro"), { name: "libre" })), 200);
  assert.deepEqual(writes, ["asset:org_pro:p1", "wo:org_client:p1:job1", "asset:org_pro:undefined"]);
});
