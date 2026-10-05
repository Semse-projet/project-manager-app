import "reflect-metadata";
import test from "node:test";
import assert from "node:assert/strict";
import { VisionController } from "../dist/modules/vision/vision.controller.js";
import { VisionAccessPolicy } from "../dist/modules/vision/vision-access.policy.js";
import { ResourceScopeResolver } from "../dist/common/resource-scope.resolver.js";

// C51 etapa 3 (migración gradual del resolver): vision exige tenant + participación en el recurso.
// Antes las rutas por evidenceId/jobId/milestoneId leían y escribían análisis de cualquier tenant u organización.

process.env.DATABASE_URL = process.env.DATABASE_URL || "postgresql://stub:stub@127.0.0.1:1/stub";

const PROJECTS = [
  { id: "p1", tenantId: "t1", assignedProOrgId: "org_pro", job: { clientOrgId: "org_client" } },
  { id: "p_t2", tenantId: "t2", assignedProOrgId: "org_pro_t2", job: { clientOrgId: "org_client_t2" } },
];
const JOBS = [
  { id: "job1", tenantId: "t1", clientOrgId: "org_client", project: { assignedProOrgId: "org_pro" } },
  { id: "job_t2", tenantId: "t2", clientOrgId: "org_client_t2", project: { assignedProOrgId: "org_pro_t2" } },
];
const MILESTONES = [
  { id: "m1", projectId: "p1", project: { tenantId: "t1" } },
  { id: "m_t2", projectId: "p_t2", project: { tenantId: "t2" } },
];
const EVIDENCE = [
  { id: "e1", tenantId: "t1", projectId: "p1" },
  { id: "e2", tenantId: "t1", projectId: "p1" },
  { id: "e_t2", tenantId: "t2", projectId: "p_t2" },
];
const prisma = {
  project: { findFirst: async ({ where }: any) => PROJECTS.find((p) => p.id === where.id && p.tenantId === where.tenantId) ?? null },
  job: { findFirst: async ({ where }: any) => JOBS.find((j) => j.id === where.id && j.tenantId === where.tenantId) ?? null },
  milestone: {
    findFirst: async ({ where }: any) => MILESTONES.find((m) => m.id === where.id && m.project.tenantId === where.project.tenantId) ?? null,
  },
  evidence: {
    findMany: async ({ where }: any) => EVIDENCE.filter((e) => where.id.in.includes(e.id) && e.tenantId === where.tenantId),
  },
};

const calls: string[] = [];
const record = (name: string) => async () => (calls.push(name), { ok: name });
const service = new Proxy({}, { get: (_t, name: string) => record(name) });
const controller = new (VisionController as any)(service, new VisionAccessPolicy(prisma as never, new ResourceScopeResolver(prisma as never)));

const req = (orgId: string, tenantId = "t1", roles: string[] = []) => ({
  headers: { "x-request-id": "r1" },
  authContext: { tenantId, orgId, userId: "u1", roles },
});
const outcome = async (p: Promise<unknown>) => {
  try {
    await p;
    return 200;
  } catch (e) {
    return (e as { getStatus?: () => number }).getStatus?.() ?? 500;
  }
};

type Run = (r: ReturnType<typeof req>, ids: { ev: string; job: string; ms: string }) => Promise<unknown>;
const ROUTES: Record<string, Run> = {
  "GET evidence/:id": (r, i) => controller.getAnalysis(r, i.ev),
  "GET job/:id": (r, i) => controller.getByJob(r, i.job),
  "GET milestone/:id": (r, i) => controller.getByMilestone(r, i.ms),
  "GET job/:id/timeline": (r, i) => controller.jobTimeline(r, i.job),
  "POST analyze-by-evidence/:id": (r, i) => controller.analyzeByEvidenceId(r, i.ev),
  "POST analyze": (r, i) => controller.analyze(r, { evidenceId: i.ev, imageUrl: "u", jobId: i.job, milestoneId: i.ms }),
  "POST consistency-by-ids": (r, i) => controller.consistencyByIds(r, { evidenceIds: [i.ev, "e2"] }),
  "POST batch": (r, i) => controller.batch(r, { items: [{ evidenceId: i.ev, imageUrl: "u" }], jobId: i.job, milestoneId: i.ms }),
  "POST batch-by-ids": (r, i) => controller.batchByIds(r, { evidenceIds: [i.ev, "e2"], jobId: i.job, milestoneId: i.ms }),
};
const OWN = { ev: "e1", job: "job1", ms: "m1" };

test("otro tenant o inexistente ⇒ 404 en todas las rutas (también OPS_ADMIN); el servicio no se toca", async () => {
  for (const [name, run] of Object.entries(ROUTES)) {
    for (const roles of [[], ["OPS_ADMIN"]]) {
      calls.length = 0;
      assert.equal(await outcome(run(req("org_client", "t2", roles), OWN)), 404, `${name} cross-tenant ${roles}`);
      assert.deepEqual(calls, [], name);
    }
    calls.length = 0;
    assert.equal(await outcome(run(req("org_client"), { ev: "e_t2", job: "job_t2", ms: "m_t2" })), 404, `${name} recursos de otro tenant`);
    assert.equal(await outcome(run(req("org_client"), { ev: "nope", job: "nope", ms: "nope" })), 404, `${name} inexistentes`);
    assert.deepEqual(calls, [], name);
  }
});

test("otra org u org vacía del mismo tenant ⇒ 403; el servicio no se toca", async () => {
  for (const [name, run] of Object.entries(ROUTES)) {
    for (const orgId of ["org_other", ""]) {
      calls.length = 0;
      assert.equal(await outcome(run(req(orgId), OWN)), 403, `${name} org=${orgId}`);
      assert.deepEqual(calls, [], name);
    }
  }
});

test("cliente, profesional asignado y OPS_ADMIN del tenant pasan", async () => {
  for (const [name, run] of Object.entries(ROUTES)) {
    for (const r of [req("org_client"), req("org_pro"), req("", "t1", ["OPS_ADMIN"])]) {
      calls.length = 0;
      assert.equal(await outcome(run(r, OWN)), 200, `${name} org=${r.authContext.orgId}`);
      assert.equal(calls.length, 1, name);
    }
  }
});

test("una evidencia ajena mezclada con las propias bloquea toda la petición", async () => {
  calls.length = 0;
  assert.equal(await outcome(controller.batchByIds(req("org_client"), { evidenceIds: ["e1", "e_t2"] })), 404);
  assert.equal(await outcome(controller.consistencyByIds(req("org_client"), { evidenceIds: ["e1", "e_t2"] })), 404);
  assert.deepEqual(calls, []);
});

test("jobId o milestoneId declarados que no son del actor bloquean aunque la evidencia sea suya", async () => {
  calls.length = 0;
  assert.equal(await outcome(controller.analyze(req("org_client"), { evidenceId: "e1", imageUrl: "u", jobId: "job_t2" })), 404);
  assert.equal(await outcome(controller.batch(req("org_client"), { items: [{ evidenceId: "e1", imageUrl: "u", milestoneId: "m_t2" }] })), 404);
  assert.deepEqual(calls, []);
});
