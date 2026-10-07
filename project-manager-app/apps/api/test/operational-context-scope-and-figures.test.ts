import "reflect-metadata";
import assert from "node:assert/strict";
import test from "node:test";
import { OperationalContextService } from "../dist/modules/ai-models/context/operational-context.service.js";
import { computeEscrowFigures } from "../dist/common/escrow-figures.js";
import { PrometeoOrchestratorService } from "../dist/modules/ai-models/orchestrator/prometeo-orchestrator.service.js";

// 0.45 — Contexto operativo de Prometeo (el que recibe el modelo y ve el usuario en el chat):
//  (a) sin proyecto activo, escrow, hitos, evidencias y disputas se calculaban con TODO el tenant para cualquier rol;
//  (b) el dinero estaba inventado: `escrowReleased` siempre 0 y `pendingRelease` = 30 % del escrow total (o
//      `escrow × aprobados / hitos`), presentado como "elegibles para liberación".

process.env.DATABASE_URL = process.env.DATABASE_URL || "postgresql://stub:stub@127.0.0.1:1/stub";

// ── cifras de escrow ────────────────────────────────────────────────────────

test("0.45 · cifras: solo transacciones SUCCEEDED; fondeado − liberado − reembolsado, sin negativos", () => {
  const txns = [
    { type: "DEPOSIT", amount: "1000.50", status: "SUCCEEDED" },
    { type: "DEPOSIT", amount: 500, status: "FAILED" },
    { type: "DEPOSIT", amount: 200, status: "PENDING" },
    { type: "DEPOSIT", amount: 300, status: "REVERSED" },
    { type: "RELEASE", amount: 300, status: "SUCCEEDED" },
    { type: "RELEASE", amount: 999, status: "PENDING" },
    { type: "REFUND", amount: 100.5, status: "SUCCEEDED" },
    { type: "FEE", amount: 50, status: "SUCCEEDED" },
  ];
  assert.deepEqual(computeEscrowFigures(txns), { escrowFunded: 1000.5, escrowReleased: 300, pendingRelease: 550 });
  assert.equal(computeEscrowFigures([{ type: "DEPOSIT", amount: 100, status: "SUCCEEDED" }, { type: "FEE", amount: 25, status: "SUCCEEDED" }]).pendingRelease, 75, "FEE confirmado reduce lo retenido");
  assert.equal(computeEscrowFigures([{ type: "DEPOSIT", amount: 100, status: "SUCCEEDED" }, { type: "FEE", amount: 25, status: "PENDING" }, { type: "FEE", amount: 25, status: "FAILED" }, { type: "FEE", amount: 25, status: "REVERSED" }]).pendingRelease, 100, "fees no confirmados no reducen lo retenido");
  assert.equal(computeEscrowFigures([{ type: "DEPOSIT", amount: 10, status: "SUCCEEDED" }, { type: "FEE", amount: 25, status: "SUCCEEDED" }]).pendingRelease, 0, "fees nunca vuelven negativo el retenido");
  assert.deepEqual(computeEscrowFigures([]), { escrowFunded: 0, escrowReleased: 0, pendingRelease: 0 });
  assert.equal(computeEscrowFigures([{ type: "RELEASE", amount: 50, status: "SUCCEEDED" }]).pendingRelease, 0, "nunca negativo");
  assert.equal(computeEscrowFigures([{ type: "DEPOSIT", amount: "basura", status: "SUCCEEDED" }]).escrowFunded, 0, "un importe ilegible no rompe ni inventa");
});

// ── datos de dos organizaciones y dos tenants ──────────────────────────────

const PROJECTS = [
  { id: "p_a", tenantId: "t1", assignedProOrgId: "org_pro", job: { clientOrgId: "org_a" }, status: "ACTIVE", jobId: null },
  { id: "p_b", tenantId: "t1", assignedProOrgId: "org_pro2", job: { clientOrgId: "org_b" }, status: "ACTIVE", jobId: null },
  { id: "p_t2", tenantId: "t2", assignedProOrgId: null, job: { clientOrgId: "org_a" }, status: "ACTIVE", jobId: null },
];
const tenantOf = (projectId: string) => PROJECTS.find((p) => p.id === projectId)?.tenantId;
const ESCROWS = [
  { projectId: "p_a", transactions: [{ type: "DEPOSIT", amount: 1000, status: "SUCCEEDED" }, { type: "RELEASE", amount: 300, status: "SUCCEEDED" }, { type: "DEPOSIT", amount: 500, status: "FAILED" }] },
  { projectId: "p_b", transactions: [{ type: "DEPOSIT", amount: 9000, status: "SUCCEEDED" }] },
  { projectId: "p_t2", transactions: [{ type: "DEPOSIT", amount: 111, status: "SUCCEEDED" }] },
];
const MILESTONES = [
  { projectId: "p_a", status: "AWAITING_REVIEW" }, { projectId: "p_a", status: "APPROVED" },
  { projectId: "p_b", status: "AWAITING_REVIEW" }, { projectId: "p_b", status: "SUBMITTED" },
  { projectId: "p_t2", status: "AWAITING_REVIEW" },
];
const EVIDENCE = [
  { projectId: "p_a", validationStatus: "pending" }, { projectId: "p_a", validationStatus: "passed" },
  { projectId: "p_b", validationStatus: "pending" }, { projectId: "p_b", validationStatus: "pending" },
  { projectId: "p_t2", validationStatus: "pending" },
];
const DISPUTES = [
  { tenantId: "t1", projectId: "p_a", status: "OPEN" },
  { tenantId: "t1", projectId: "p_b", status: "UNDER_REVIEW" },
  { tenantId: "t2", projectId: "p_t2", status: "OPEN" },
];

/** Evalúa solo las formas de `where` que usa el servicio. Cualquier forma desconocida falla la prueba en vez de aprobarse en silencio. */
function matchesProjectKeyed(row: { projectId: string }, where: any): boolean {
  if (where.projectId?.in && !where.projectId.in.includes(row.projectId)) return false;
  if (where.project?.tenantId && tenantOf(row.projectId) !== where.project.tenantId) return false;
  const known = new Set(["projectId", "project"]);
  for (const key of Object.keys(where)) assert.ok(known.has(key), `forma de where inesperada: ${key}`);
  return true;
}

function makeService(opts: { failProjectListing?: boolean } = {}) {
  const prisma = {
    job: { findMany: async () => [], count: async () => 0 },
    jobsBidsProjection: { findMany: async () => [] },
    notification: { findMany: async () => [] },
    userProfile: { findUnique: async () => null },
    workspaceMemoryEntry: { findFirst: async () => null },
    operationalContextSnapshot: { create: async () => ({}), deleteMany: async () => ({ count: 0 }), findFirst: async () => null },
    project: {
      // misma consulta que ResourceScopeResolver.listAccessibleProjectIds
      findMany: async ({ where }: any) => {
        if (opts.failProjectListing) throw new Error("Too many associated projects or jobs to list; filter by projectId");
        const orgId = where.OR?.[0]?.assignedProOrgId;
        return PROJECTS.filter((p) => p.tenantId === where.tenantId && (p.assignedProOrgId === orgId || p.job.clientOrgId === orgId)).map((p) => ({ id: p.id }));
      },
      findFirst: async ({ where }: any) => PROJECTS.find((p) => p.id === where.id && p.tenantId === where.tenantId) ?? null,
      findUnique: async ({ where }: any) => {
        const p = PROJECTS.find((x) => x.id === where.id);
        return p ? { id: p.id, status: p.status, jobId: p.jobId, job: { title: `Proyecto ${p.id}` } } : null;
      },
    },
    paymentEscrow: {
      findMany: async ({ where }: any) => ESCROWS.filter((e) => matchesProjectKeyed(e, where)),
      findUnique: async ({ where }: any) => ESCROWS.find((e) => e.projectId === where.projectId) ?? null,
    },
    milestone: { findMany: async ({ where }: any) => MILESTONES.filter((m) => (where.projectId?.in || where.project || !where.projectId ? matchesProjectKeyed(m, where) : m.projectId === where.projectId)) },
    evidence: { findMany: async ({ where }: any) => EVIDENCE.filter((e) => (where.projectId?.in || where.project || !where.projectId ? matchesProjectKeyed(e, where) : e.projectId === where.projectId)) },
    dispute: {
      findMany: async ({ where }: any) =>
        DISPUTES.filter((d) => {
          if (typeof where.projectId === "string") return d.projectId === where.projectId;
          if (where.tenantId && d.tenantId !== where.tenantId) return false;
          if (where.project?.id?.in && !where.project.id.in.includes(d.projectId)) return false;
          return true;
        }),
    },
  };
  return new OperationalContextService(prisma as never);
}

const ctxFor = (tenantId: string, orgId: string, roles: string[], projectId?: string) =>
  makeService().buildContext({ tenantId, orgId, userId: "u1", role: roles[0]!, roles, projectId });

// ── (a) alcance ─────────────────────────────────────────────────────────────

test("0.45 · un cliente solo ve las cifras de SUS proyectos, no las de otra organización del tenant", async () => {
  const ctx = await ctxFor("t1", "org_a", ["CLIENT"]);
  assert.deepEqual(ctx.payments, { escrowFunded: 1000, escrowReleased: 300, pendingRelease: 700 }, "no suma los 9.000 de org_b");
  assert.deepEqual(ctx.milestones, { active: 1, pendingApproval: 1, submitted: 0 });
  assert.deepEqual(ctx.evidences, { total: 2, pendingReview: 1, approved: 1 }, "no suma las 2 pendientes de org_b");
  assert.deepEqual(ctx.disputes, { open: 1, urgent: 0 }, "no cuenta la disputa en revisión de org_b");
});

test("0.45 · el profesional asignado ve lo del proyecto en el que participa, y solo eso", async () => {
  const ctx = await ctxFor("t1", "org_pro", ["PRO"]);
  assert.deepEqual(ctx.payments, { escrowFunded: 1000, escrowReleased: 300, pendingRelease: 700 });
  assert.equal(ctx.evidences.total, 2);
});

test("0.45 · una organización sin proyectos, o un actor sin organización, ve todo en cero (nunca el tenant)", async () => {
  for (const orgId of ["org_x", ""]) {
    const ctx = await ctxFor("t1", orgId, ["CLIENT"]);
    assert.deepEqual(ctx.payments, { escrowFunded: 0, escrowReleased: 0, pendingRelease: 0 }, `org '${orgId}'`);
    assert.deepEqual(ctx.evidences, { total: 0, pendingReview: 0, approved: 0 });
    assert.deepEqual(ctx.milestones, { active: 0, pendingApproval: 0, submitted: 0 });
    assert.deepEqual(ctx.disputes, { open: 0, urgent: 0 });
  }
});

test("0.45 · el mismo id de organización en OTRO tenant no hereda los datos del primero", async () => {
  const ctx = await ctxFor("t2", "org_a", ["CLIENT"]);
  assert.deepEqual(ctx.payments, { escrowFunded: 111, escrowReleased: 0, pendingRelease: 111 }, "solo p_t2");
  assert.equal(ctx.evidences.total, 1);
});

test("0.45 · OPS_ADMIN conserva la vista de todo SU tenant (intencional) y nunca la de otro", async () => {
  const ctx = await ctxFor("t1", "org_ops", ["OPS_ADMIN"]);
  assert.deepEqual(ctx.payments, { escrowFunded: 10000, escrowReleased: 300, pendingRelease: 9700 });
  assert.deepEqual(ctx.evidences, { total: 4, pendingReview: 3, approved: 1 });
  assert.deepEqual(ctx.disputes, { open: 2, urgent: 1 }, "OPEN + UNDER_REVIEW cuentan como abiertas; UNDER_REVIEW como urgente");
});

test("0.45 · si no se puede acotar por participación, el chat no se rompe y NO vuelve al tenant completo", async () => {
  const ctx = await makeService({ failProjectListing: true }).buildContext({ tenantId: "t1", orgId: "org_a", userId: "u1", role: "CLIENT", roles: ["CLIENT"] });
  assert.deepEqual(ctx.payments, { escrowFunded: 0, escrowReleased: 0, pendingRelease: 0 });
  assert.equal(ctx.evidences.total, 0);
});

// ── (b) cifras ──────────────────────────────────────────────────────────────

test("0.45 · el 30 % inventado desaparece: con un hito aprobado y escrow pero sin transacciones, lo retenido es 0", () => {
  assert.deepEqual(computeEscrowFigures([]), { escrowFunded: 0, escrowReleased: 0, pendingRelease: 0 });
  // el caso real de la evidencia: 4.600 × 0,3 = 1.380 "elegibles" salía de aquí
  assert.notEqual(computeEscrowFigures([]).pendingRelease, Math.round(4600 * 0.3));
});

test("0.45 · con proyecto, las cifras salen de las transacciones y no de `escrow × aprobados / hitos`", async () => {
  const ctx = await ctxFor("t1", "org_a", ["CLIENT"], "p_a");
  // p_a tiene 1 hito aprobado de 2: la fórmula anterior daba otra cifra y escrowReleased siempre 0
  assert.deepEqual(ctx.payments, { escrowFunded: 1000, escrowReleased: 300, pendingRelease: 700 });
});

// ── lo que ve el modelo y el usuario ────────────────────────────────────────

test("0.45 · el texto ya no llama \"elegible para liberación\" al dinero retenido", async () => {
  const service = makeService();
  const ctx = await service.buildContext({ tenantId: "t1", orgId: "org_a", userId: "u1", role: "CLIENT", roles: ["CLIENT"] });
  const block = service.formatContextBlock(ctx);
  assert.match(block, /Escrow: \$1,000 fondeado \| \$300 liberado \| \$700 retenido/);
  assert.equal(/elegible/i.test(block), false);

  const report = new PrometeoOrchestratorService().buildOperationalReport(ctx);
  assert.match(report, /Retenido en escrow \(sin liberar\): \*\*\$700 USD\*\*/);
  assert.equal(/elegible/i.test(report), false, "ni el informe operativo");
  assert.equal(/Liberar \$/.test(report), false, "no recomienda liberar un importe a partir del dinero retenido");
});
