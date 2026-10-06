import "reflect-metadata";
import assert from "node:assert/strict";
import test from "node:test";
import { PrometeoToolExecutionService } from "../dist/modules/prometeo/prometeo-tool-execution.service.js";
import { VisionAccessPolicy } from "../dist/modules/vision/vision-access.policy.js";
import { ResourceScopeResolver } from "../dist/common/resource-scope.resolver.js";

// 0.44 — Las herramientas de visión por id (`vision.get_analysis`, `get_job_analyses`, `get_milestone_analyses`,
// `analyze_image`) solo comprobaban el permiso `vision:*` y llamaban a VisionService con el id crudo: `VisionAnalysis` no
// guarda tenant, así que cualquier CLIENT/PRO/WORKER podía leer —y con `analyze_image` SOBRESCRIBIR— el análisis de otro
// tenant u organización por el camino de Prometeo, aunque `VisionController` ya lo bloqueaba (C51 etapa 3).
// Contrato (el mismo del REST): otro tenant o inexistente ⇒ 404; otra organización ⇒ 403; OPS_ADMIN nunca cruza tenants.

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
  { id: "e_t2", tenantId: "t2", projectId: "p_t2" },
];
const prisma = {
  project: { findFirst: async ({ where }: any) => PROJECTS.find((p) => p.id === where.id && p.tenantId === where.tenantId) ?? null },
  job: { findFirst: async ({ where }: any) => JOBS.find((j) => j.id === where.id && j.tenantId === where.tenantId) ?? null },
  milestone: { findFirst: async ({ where }: any) => MILESTONES.find((m) => m.id === where.id && m.project.tenantId === where.project.tenantId) ?? null },
  evidence: { findMany: async ({ where }: any) => EVIDENCE.filter((e) => where.id.in.includes(e.id) && e.tenantId === where.tenantId) },
};

function setup(withPolicy = true) {
  const visionCalls: string[] = [];
  const vision = {
    getAnalysis: async (id: string) => (visionCalls.push(`getAnalysis:${id}`), { evidenceId: id, secret: "analisis-ajeno" }),
    getByJob: async (id: string) => (visionCalls.push(`getByJob:${id}`), [{ jobId: id }]),
    getByMilestone: async (id: string) => (visionCalls.push(`getByMilestone:${id}`), [{ milestoneId: id }]),
    runAnalysis: async (input: Record<string, unknown>) => (visionCalls.push(`runAnalysis:${String(input.evidenceId)}`), { evidenceId: input.evidenceId, status: "completed" }),
  };
  const policy = new (VisionAccessPolicy as any)(prisma, new ResourceScopeResolver(prisma as never));
  const service = new PrometeoToolExecutionService(
    {} as never, {} as never, {} as never, {} as never, {} as never, {} as never,
    vision as never,
    undefined as never, undefined as never, undefined as never, undefined as never,
    (withPolicy ? policy : undefined) as never,
  );
  return { service, visionCalls };
}

const actor = (orgId: string, tenantId = "t1", roles = ["CLIENT"]) => ({ tenantId, orgId, userId: "u1", roles });

const TOOLS: Record<string, { name: string; input: (ids: { ev: string; job: string; ms: string }) => Record<string, unknown>; call: string }> = {
  get_analysis: { name: "get_analysis", input: (i) => ({ evidenceId: i.ev }), call: "getAnalysis" },
  get_job_analyses: { name: "get_job_analyses", input: (i) => ({ jobId: i.job }), call: "getByJob" },
  get_milestone_analyses: { name: "get_milestone_analyses", input: (i) => ({ milestoneId: i.ms }), call: "getByMilestone" },
  analyze_image: { name: "analyze_image", input: (i) => ({ evidenceId: i.ev, imageUrl: "https://example.com/a.jpg", jobId: i.job, milestoneId: i.ms }), call: "runAnalysis" },
};
const MINE = { ev: "e1", job: "job1", ms: "m1" };
const OTHER_TENANT = { ev: "e_t2", job: "job_t2", ms: "m_t2" };

async function outcome(run: () => Promise<unknown>): Promise<number> {
  try {
    await run();
    return 200;
  } catch (error) {
    return (error as { getStatus?: () => number }).getStatus?.() ?? 500;
  }
}

for (const tool of Object.values(TOOLS)) {
  const invoke = (service: PrometeoToolExecutionService, who: ReturnType<typeof actor>, ids: typeof MINE) =>
    service.invokeReadTool(who as never, "req_1", { namespace: "vision", name: tool.name, input: tool.input(ids) });

  test(`0.44 · vision.${tool.name}: el cliente dueño del recurso sí lo alcanza`, async () => {
    const { service, visionCalls } = setup();
    assert.equal(await outcome(() => invoke(service, actor("org_client"), MINE)), 200);
    assert.equal(visionCalls.length, 1);
  });

  test(`0.44 · vision.${tool.name}: el profesional asignado y el OPS_ADMIN del tenant sí lo alcanzan`, async () => {
    const { service } = setup();
    assert.equal(await outcome(() => invoke(service, actor("org_pro", "t1", ["PRO"]), MINE)), 200);
    assert.equal(await outcome(() => invoke(service, actor("org_ops", "t1", ["OPS_ADMIN"]), MINE)), 200);
  });

  test(`0.44 · vision.${tool.name}: un recurso de OTRO TENANT da 404 y VisionService nunca se llama`, async () => {
    const { service, visionCalls } = setup();
    assert.equal(await outcome(() => invoke(service, actor("org_client"), OTHER_TENANT)), 404);
    assert.equal(visionCalls.length, 0, "ni leer ni escribir antes de autorizar");
  });

  test(`0.44 · vision.${tool.name}: OPS_ADMIN de otro tenant tampoco cruza (404)`, async () => {
    const { service, visionCalls } = setup();
    assert.equal(await outcome(() => invoke(service, actor("org_ops_t2", "t2", ["OPS_ADMIN"]), MINE)), 404);
    assert.equal(visionCalls.length, 0);
  });

  test(`0.44 · vision.${tool.name}: otra organización del mismo tenant da 403`, async () => {
    const { service, visionCalls } = setup();
    assert.equal(await outcome(() => invoke(service, actor("org_intruso"), MINE)), 403);
    assert.equal(visionCalls.length, 0);
  });

  test(`0.44 · vision.${tool.name}: un recurso inexistente da 404 (sin oráculo de existencia)`, async () => {
    const { service, visionCalls } = setup();
    assert.equal(await outcome(() => invoke(service, actor("org_client"), { ev: "nope", job: "nope", ms: "nope" })), 404);
    assert.equal(visionCalls.length, 0);
  });

  test(`0.44 · vision.${tool.name}: sin la política de pertenencia falla CERRADO (403), no abierto`, async () => {
    const { service, visionCalls } = setup(false);
    assert.equal(await outcome(() => invoke(service, actor("org_client"), MINE)), 403);
    assert.equal(visionCalls.length, 0);
  });
}

test("0.44 · analyze_image no puede sobrescribir el análisis de otro tenant ni declarar un trabajo/hito ajeno", async () => {
  const { service, visionCalls } = setup();
  const analyze = (input: Record<string, unknown>) =>
    service.invokeReadTool(actor("org_client") as never, "req_1", { namespace: "vision", name: "analyze_image", input: { imageUrl: "https://example.com/a.jpg", ...input } });

  // evidencia propia pero con un trabajo o un hito de OTRO tenant declarados como contexto
  assert.equal(await outcome(() => analyze({ evidenceId: "e1", jobId: "job_t2" })), 404);
  assert.equal(await outcome(() => analyze({ evidenceId: "e1", milestoneId: "m_t2" })), 404);
  // evidencia de otro tenant
  assert.equal(await outcome(() => analyze({ evidenceId: "e_t2" })), 404);
  assert.equal(visionCalls.length, 0, "ningún upsert de VisionAnalysis ocurrió");
});

test("0.44 · la validación de entrada sigue siendo anterior: sin evidenceId es un 400, no un 403 ni un 404", async () => {
  const { service } = setup();
  const status = await outcome(() => service.invokeReadTool(actor("org_client") as never, "req_1", { namespace: "vision", name: "analyze_image", input: { imageUrl: "x" } }));
  assert.equal(status, 400);
});
