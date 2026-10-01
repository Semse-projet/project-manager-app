import test from "node:test";
import assert from "node:assert/strict";
import { KnowledgeController } from "../dist/modules/knowledge/knowledge.controller.js";
import { WorkspaceMemoryAccessPolicy, parseWorkspaceId } from "../dist/modules/knowledge/workspace-memory.access-policy.js";
import { WorkspaceMemoryRepository } from "../dist/modules/knowledge/workspace-memory.repository.js";

// C51 — semántica aprobada de WorkspaceMemory (docs/specs/platform/resource-scope.spec.md §3.1):
// memoria COMPARTIDA del workspace; boundary tenant + ProjectScope; `orgId` es provenance, no ACL.

const T1 = "t1";
const T2 = "t2";
const CLIENT = "org_client";
const PRO = "org_pro";
const OTHER = "org_other";

type Row = { id: string; tenantId: string; assignedProOrgId: string; clientOrgId: string };
const PROJECTS: Row[] = [
  { id: "p1", tenantId: T1, assignedProOrgId: PRO, clientOrgId: CLIENT },
  { id: "p_empty", tenantId: T1, assignedProOrgId: "", clientOrgId: "" },
  { id: "p_t2", tenantId: T2, assignedProOrgId: "org_pro_t2", clientOrgId: "org_client_t2" },
];

// Prisma simulado que respeta el filtro `tenantId` de cada consulta, como la BD real.
const prisma = {
  project: {
    findFirst: async ({ where }: { where: { id: string; tenantId: string } }) => {
      const p = PROJECTS.find((x) => x.id === where.id && x.tenantId === where.tenantId);
      return p ? { tenantId: p.tenantId, assignedProOrgId: p.assignedProOrgId, job: { clientOrgId: p.clientOrgId } } : null;
    },
  },
  job: {
    findFirst: async ({ where }: { where: { id: string; tenantId: string } }) => {
      const p = PROJECTS.find((x) => `j_${x.id}` === where.id && x.tenantId === where.tenantId);
      return p ? { tenantId: p.tenantId, clientOrgId: p.clientOrgId, project: { assignedProOrgId: p.assignedProOrgId } } : null;
    },
  },
  dispute: {
    findFirst: async ({ where }: { where: { id: string; tenantId: string } }) => {
      const p = PROJECTS.find((x) => `d_${x.id}` === where.id && x.tenantId === where.tenantId);
      return p ? { tenantId: p.tenantId, project: { assignedProOrgId: p.assignedProOrgId, job: { clientOrgId: p.clientOrgId } } } : null;
    },
  },
};
const policy = new WorkspaceMemoryAccessPolicy(prisma as never);

const actor = (orgId: string, o: { tenantId?: string; userId?: string; roles?: string[] } = {}) => ({
  tenantId: o.tenantId ?? T1,
  userId: o.userId ?? "u1",
  orgId,
  roles: o.roles ?? [],
});
const status = async (p: Promise<unknown>): Promise<number> => {
  try {
    await p;
    return 200;
  } catch (e) {
    return (e as { getStatus?: () => number }).getStatus?.() ?? 500;
  }
};
const can = (a: ReturnType<typeof actor>, ws: string) => status(policy.assertCanRead(a, ws));

test("proyecto: otro tenant ⇒ 404 (también para OPS_ADMIN); proyecto inexistente ⇒ 404", async () => {
  assert.equal(await can(actor(CLIENT, { tenantId: T2 }), "project:p1"), 404);
  assert.equal(await can(actor("", { tenantId: T2, roles: ["OPS_ADMIN"] }), "project:p1"), 404);
  assert.equal(await can(actor(CLIENT), "project:p_t2"), 404); // existe, pero en otro tenant
  assert.equal(await can(actor(CLIENT), "project:no_existe"), 404);
});

test("proyecto: org del mismo tenant fuera de las participantes ⇒ 403", async () => {
  assert.equal(await can(actor(OTHER), "project:p1"), 403);
  assert.equal(await can(actor(OTHER, { userId: "creador_de_la_memoria" }), "project:p1"), 403);
});

test("proyecto: cliente y profesional asignado leen (la memoria es compartida); OPS_ADMIN del tenant también", async () => {
  assert.equal(await can(actor(CLIENT), "project:p1"), 200);
  assert.equal(await can(actor(PRO), "project:p1"), 200);
  assert.equal(await can(actor("", { roles: ["OPS_ADMIN"] }), "project:p1"), 200);
});

test("org vacía nunca concede acceso (ni siquiera contra un proyecto con orgs vacías)", async () => {
  assert.equal(await can(actor(""), "project:p1"), 403);
  assert.equal(await can(actor(""), "project:p_empty"), 403);
  assert.equal(await can(actor(""), "job:j_p_empty"), 403);
});

test("conocer o adivinar el workspaceId no basta: formas desconocidas/mal formadas ⇒ solo OPS_ADMIN", async () => {
  for (const ws of ["", "project:", "project:p1:extra", "p1", "tenant:t1", "project", ":p1", "org:org_client", "worker:u1", "worker:u1:"]) {
    assert.equal(await can(actor(CLIENT), ws), 403, `no-admin con ${JSON.stringify(ws)}`);
  }
  assert.equal(await can(actor("", { roles: ["OPS_ADMIN"] }), "tenant:t1"), 200);
});

test("job y dispute se resuelven al mismo ProjectScope", async () => {
  assert.equal(await can(actor(CLIENT), "job:j_p1"), 200);
  assert.equal(await can(actor(PRO), "job:j_p1"), 200);
  assert.equal(await can(actor(OTHER), "job:j_p1"), 403);
  assert.equal(await can(actor(CLIENT, { tenantId: T2 }), "job:j_p1"), 404);
  assert.equal(await can(actor(CLIENT), "dispute:d_p1"), 200);
  assert.equal(await can(actor(OTHER), "dispute:d_p1"), 403);
  assert.equal(await can(actor(CLIENT, { tenantId: T2 }), "dispute:d_p1"), 404);
});

test("worker:<userId>:*: el propio usuario u OPS_ADMIN; la org no interviene", async () => {
  assert.equal(await can(actor(CLIENT, { userId: "w1" }), "worker:w1:payments"), 200);
  assert.equal(await can(actor("", { userId: "w1" }), "worker:w1:verification"), 200);
  assert.equal(await can(actor(CLIENT, { userId: "w2" }), "worker:w1:payments"), 403);
  assert.equal(await can(actor(CLIENT, { userId: "" }), "worker:w1:payments"), 403);
  assert.equal(await can(actor("", { roles: ["OPS_ADMIN"] }), "worker:w1:verification"), 200);
});

test("parseWorkspaceId reconoce solo formas exactas", () => {
  assert.deepEqual(parseWorkspaceId("project:p1"), { kind: "project", projectId: "p1" });
  assert.deepEqual(parseWorkspaceId("job:j1"), { kind: "job", jobId: "j1" });
  assert.deepEqual(parseWorkspaceId("dispute:d1"), { kind: "dispute", disputeId: "d1" });
  assert.deepEqual(parseWorkspaceId("worker:u1:payments"), { kind: "worker", userId: "u1", facet: "payments" });
  for (const bad of ["", "project:", "project:a:b", "worker:u1", "x:y"]) assert.deepEqual(parseWorkspaceId(bad), { kind: "unknown" }, bad);
});

// ── Repositorio: `orgId` es provenance, no ACL ───────────────────────────────

const entry = (id: string, orgId: string) => ({
  id,
  tenantId: T1,
  orgId,
  createdBy: `u_${orgId}`,
  workspaceId: "project:p1",
  repoId: null,
  runId: null,
  taskId: null,
  kind: "decision",
  scope: "task",
  title: id,
  summary: id,
  body: null,
  tags: [],
  sourceRef: null,
  createdAt: new Date(),
  updatedAt: new Date(),
  sensitivity: "internal",
  epistemicStatus: "remembered_context",
  confidence: null,
  provenance: null,
  subjectType: null,
  subjectId: null,
  status: "active",
  supersedesId: null,
  supersededById: null,
  correctedFromId: null,
  conflictsWith: [],
  invalidatedAt: null,
  invalidatedBy: null,
  invalidationReason: null,
  retentionUntil: null,
});
const ENTRIES = [entry("by_pro", PRO), entry("by_client", CLIENT)];
const repoPrisma = { workspaceMemoryEntry: { findMany: async () => ENTRIES } };
const repo = new WorkspaceMemoryRepository(repoPrisma as never);

test("el cliente autorizado lee la memoria producida por la org profesional, y el profesional la del cliente", async () => {
  // 1) la política autoriza por relación con el proyecto
  assert.equal(await can(actor(CLIENT), "project:p1"), 200);
  assert.equal(await can(actor(PRO), "project:p1"), 200);
  // 2) el repositorio devuelve la memoria compartida de ambas orgs (query ya no filtra por orgId)
  const records = await repo.query({ tenantId: T1, workspaceId: "project:p1" });
  assert.deepEqual(records.map((r) => r.id).sort(), ["by_client", "by_pro"]);
  // 3) pasar un orgId (llamadas heredadas) NO restringe: orgId no es un ACL
  const legacy = await repo.query({ tenantId: T1, orgId: CLIENT, workspaceId: "project:p1" } as never);
  assert.deepEqual(legacy.map((r) => r.id).sort(), ["by_client", "by_pro"]);
});

test("queryAcrossTenant: solo OPS_ADMIN del mismo tenant; no es lectura general", async () => {
  const run = (a: { tenantId: string; roles: string[] }, tenantId = T1) =>
    status(repo.queryAcrossTenant({ actor: a, tenantId, tags: ["verification"] }));
  assert.equal(await run({ tenantId: T1, roles: [] }), 403);
  assert.equal(await run({ tenantId: T1, roles: ["PRO"] }), 403);
  assert.equal(await run({ tenantId: T2, roles: ["OPS_ADMIN"] }, T1), 403); // admin de otro tenant
  assert.equal(await run({ tenantId: "", roles: ["OPS_ADMIN"] }, ""), 403);
  assert.equal(await run({ tenantId: T1, roles: ["OPS_ADMIN"] }), 200);
});

// ── Controller: la política corre ANTES de tocar el servicio ─────────────────

function makeController() {
  const calls: string[] = [];
  const knowledge = {
    searchWorkspaceMemory: async (i: Record<string, unknown>) => (calls.push(`search:${JSON.stringify(i)}`), { items: [] }),
    listWorkspaceMemory: async (i: Record<string, unknown>) => (calls.push(`list:${JSON.stringify(i)}`), { items: [] }),
  };
  const controller = new (KnowledgeController as any)(knowledge, {}, {}, {}, policy);
  return { controller, calls };
}
const req = (a: ReturnType<typeof actor>) => ({ headers: {}, authContext: a });

test("controller: acceso denegado ⇒ el servicio no se llama (404 cross-tenant, 403 otra org)", async () => {
  const { controller, calls } = makeController();
  const list = (a: ReturnType<typeof actor>, workspaceId: string) => status(controller.workspaceMemory(req(a), { workspaceId }));
  const search = (a: ReturnType<typeof actor>, workspaceId: string) => status(controller.searchWorkspaceMemory(req(a), workspaceId, "decision"));

  assert.equal(await list(actor(CLIENT, { tenantId: T2 }), "project:p1"), 404);
  assert.equal(await search(actor(CLIENT, { tenantId: T2 }), "project:p1"), 404);
  assert.equal(await list(actor(OTHER), "project:p1"), 403);
  assert.equal(await search(actor(OTHER), "project:p1"), 403);
  assert.equal(await list(actor(""), "project:p1"), 403);
  assert.equal(await search(actor(""), "project:p1"), 403);
  assert.deepEqual(calls, []);
});

test("controller: acceso concedido ⇒ list y search se llaman por tenant+workspace, sin filtrar por orgId", async () => {
  const { controller, calls } = makeController();
  assert.equal(await status(controller.workspaceMemory(req(actor(PRO)), { workspaceId: "project:p1" })), 200);
  assert.equal(await status(controller.searchWorkspaceMemory(req(actor(CLIENT)), "project:p1", "techo")), 200);
  assert.equal(calls.length, 2);
  for (const c of calls) {
    assert.match(c, /"tenantId":"t1"/);
    assert.match(c, /"workspaceId":"project:p1"/);
    assert.doesNotMatch(c, /orgId/, "orgId no debe viajar como filtro");
  }
});
