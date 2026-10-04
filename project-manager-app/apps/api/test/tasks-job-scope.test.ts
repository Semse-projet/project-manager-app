import test from "node:test";
import assert from "node:assert/strict";
import { TasksService } from "../dist/modules/tasks/tasks.service.js";
import { ResourceScopeResolver } from "../dist/common/resource-scope.resolver.js";

// C51 etapa 3 (migración gradual del resolver): las tareas por trabajo exigen tenant + participación en el job.
// Antes `by-job/:jobId`, `POST /tasks` y `PATCH /tasks/:id/status` solo filtraban por tenant: cualquier usuario con
// jobs:read/create/update leía, creaba o cambiaba tareas de trabajos de otras organizaciones.

process.env.DATABASE_URL = process.env.DATABASE_URL || "postgresql://stub:stub@127.0.0.1:1/stub";

const JOBS = [
  { id: "job1", tenantId: "t1", clientOrgId: "org_client", project: { assignedProOrgId: "org_pro" } },
  { id: "job_t2", tenantId: "t2", clientOrgId: "org_client_t2", project: { assignedProOrgId: "org_pro_t2" } },
];
const base = { createdAt: new Date(), updatedAt: new Date(), dueDate: null, createdBy: "x" };
const TASKS = [
  { ...base, id: "task_free", tenantId: "t1", jobId: "job1", assignedTo: null, status: "pending" },
  { ...base, id: "task_mine", tenantId: "t1", jobId: "job1", assignedTo: "u_worker", status: "pending" },
  { ...base, id: "task_other_t2", tenantId: "t2", jobId: "job_t2", assignedTo: null, status: "pending" },
];
const writes: string[] = [];
const prisma = {
  job: {
    findFirst: async ({ where }: { where: { id: string; tenantId: string } }) =>
      JOBS.find((j) => j.id === where.id && j.tenantId === where.tenantId) ?? null,
  },
  jobTask: {
    findMany: async ({ where }: { where: { tenantId: string; jobId: string } }) =>
      TASKS.filter((t) => t.tenantId === where.tenantId && t.jobId === where.jobId),
    findFirst: async ({ where }: { where: { id: string; tenantId: string } }) =>
      TASKS.find((t) => t.id === where.id && t.tenantId === where.tenantId) ?? null,
    create: async ({ data }: { data: Record<string, unknown> }) => (writes.push(`create:${data.jobId}`), { id: "new", createdAt: new Date(), updatedAt: new Date(), dueDate: null, ...data }),
    update: async ({ where, data }: { where: { id: string }; data: { status: string } }) => (writes.push(`update:${where.id}`), { ...TASKS.find((t) => t.id === where.id)!, ...data }),
  },
};
const service = new (TasksService as any)(prisma, new ResourceScopeResolver(prisma as never));

const status = async (p: Promise<unknown>) => {
  try {
    await p;
    return 200;
  } catch (e) {
    return (e as { getStatus?: () => number }).getStatus?.() ?? 500;
  }
};
const actor = (orgId: string, tenantId = "t1", roles: string[] = [], userId = "u1") => ({ tenantId, orgId, roles, userId });
const list = (a: ReturnType<typeof actor>, jobId: string) => service.listByJob({ tenantId: a.tenantId, jobId, orgId: a.orgId, roles: a.roles });
const create = (a: ReturnType<typeof actor>, jobId: string) =>
  service.create({ tenantId: a.tenantId, jobId, milestone: "m", title: "t", createdBy: a.userId, orgId: a.orgId, roles: a.roles });
const update = (a: ReturnType<typeof actor>, taskId: string) =>
  service.updateStatus({ tenantId: a.tenantId, taskId, status: "done", actorUserId: a.userId, roles: a.roles, orgId: a.orgId });

test("otro tenant ⇒ 404 (también OPS_ADMIN) en by-job, crear y cambiar estado; sin escrituras", async () => {
  writes.length = 0;
  for (const roles of [[], ["OPS_ADMIN"]]) {
    assert.equal(await status(list(actor("org_client", "t2", roles), "job1")), 404);
    assert.equal(await status(create(actor("org_client", "t2", roles), "job1")), 404);
    assert.equal(await status(update(actor("org_client", "t2", roles), "task_free")), 404);
  }
  assert.equal(await status(list(actor("org_client"), "job_t2")), 404); // existe, pero en otro tenant
  assert.equal(await status(update(actor("org_client"), "task_other_t2")), 404);
  assert.equal(await status(list(actor("org_client"), "no_existe")), 404);
  assert.deepEqual(writes, []);
});

test("otra org del mismo tenant ⇒ 403 y org vacía nunca concede; sin escrituras", async () => {
  writes.length = 0;
  for (const orgId of ["org_other", ""]) {
    assert.equal(await status(list(actor(orgId), "job1")), 403, `list org=${orgId}`);
    assert.equal(await status(create(actor(orgId), "job1")), 403, `create org=${orgId}`);
    assert.equal(await status(update(actor(orgId), "task_free")), 403, `update org=${orgId}`);
  }
  assert.deepEqual(writes, []);
});

test("cliente, profesional asignado y OPS_ADMIN del tenant sí pueden", async () => {
  writes.length = 0;
  for (const a of [actor("org_client"), actor("org_pro"), actor("", "t1", ["OPS_ADMIN"])]) {
    assert.equal(await status(list(a, "job1")), 200);
    assert.equal(await status(create(a, "job1")), 200);
    assert.equal(await status(update(a, "task_free")), 200);
  }
  assert.equal(writes.length, 6);
});

test("el asignado explícito cambia su tarea aunque su org no figure en el trabajo; otro no asignado sigue sin poder", async () => {
  writes.length = 0;
  assert.equal(await status(update(actor("org_other", "t1", [], "u_worker"), "task_mine")), 200);
  // Participante del job pero NO el asignado: la regla previa (solo el asignado u OPS_ADMIN) se conserva.
  assert.equal(await status(update(actor("org_client", "t1", [], "u_other"), "task_mine")), 403);
  assert.deepEqual(writes, ["update:task_mine"]);
});
