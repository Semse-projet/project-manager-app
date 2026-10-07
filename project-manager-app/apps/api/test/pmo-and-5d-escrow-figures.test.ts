import "reflect-metadata";
import assert from "node:assert/strict";
import test from "node:test";
import { PmoService } from "../dist/modules/intelligence/pmo.service.js";
import { Ecosystem5DService } from "../dist/modules/intelligence/ecosystem-5d.service.js";

// 0.46 — PMO y el lente 5D calculaban lo "liberado" con `status === "COMPLETED"`, un estado que NO existe
// (`PaymentTxnStatus` = PENDING/SUCCEEDED/FAILED/REVERSED): lo liberado era siempre 0, "por liberar" era el escrow completo
// y "fondeado" era `totalAmount` (optimista). En 5D, con una disputa abierta, eso restaba 15 puntos a Finance sobre TODO el
// escrow. Ahora todo sale de transacciones confirmadas (`SUCCEEDED`), igual que finanzas y el contexto de Prometeo.

const T = "t1";
const dep = (amount: number, status = "SUCCEEDED") => ({ type: "DEPOSIT", amount, status });
const rel = (amount: number, status = "SUCCEEDED") => ({ type: "RELEASE", amount, status });

// ── PMO ─────────────────────────────────────────────────────────────────────

function makePmo(opts: { totalAmount?: number; txns: Array<{ type: string; amount: number; status: string }>; openDispute?: boolean; depositSum?: number }) {
  const aggregateCalls: Array<Record<string, any>> = [];
  const project = {
    id: "p1", status: "IN_PROGRESS", updatedAt: new Date(),
    job: { title: "Obra A", category: "x" }, assignedProOrg: { name: "Pro SA" },
    milestones: [], evidence: [], disputes: opts.openDispute ? [{ status: "OPEN" }] : [],
    escrow: { totalAmount: opts.totalAmount ?? 0, status: "ACTIVE", transactions: opts.txns },
  };
  const prisma = {
    project: { findMany: async () => [project] },
    dispute: { count: async () => (opts.openDispute ? 1 : 0) },
    paymentTxn: { aggregate: async (args: any) => (aggregateCalls.push(args), { _sum: { amount: opts.depositSum ?? 0 } }) },
  };
  const risk = { calculateProjectRisk: async () => ({ overallScore: 10, level: "low" }) };
  return { service: new PmoService(prisma as never, risk as never), aggregateCalls };
}

test("0.46 · PMO: liberado y retenido salen de transacciones SUCCEEDED, no de `totalAmount` ni de `COMPLETED`", async () => {
  const { service } = makePmo({
    totalAmount: 1500, // optimista: el código anterior lo usaba como "fondeado"
    txns: [dep(1000), dep(500, "FAILED"), rel(300), rel(400, "PENDING"), rel(999, "COMPLETED")],
    depositSum: 1000,
  });
  const dashboard = await service.getDashboard(T);
  const card = dashboard.projects[0]!;
  assert.equal(card.escrowFunded, 1000, "solo depósitos confirmados");
  assert.equal(card.pendingRelease, 700, "1000 − 300 liberado; el RELEASE 'COMPLETED' (estado inexistente) y el PENDING no cuentan");
  assert.equal(dashboard.summary.pendingRelease, 700);
});

test("0.46 · PMO: un escrow con `totalAmount` pero sin transacciones confirmadas no es dinero retenido ni genera alerta", async () => {
  const { service } = makePmo({ totalAmount: 4600, txns: [] });
  const dashboard = await service.getDashboard(T);
  assert.equal(dashboard.projects[0]!.escrowFunded, 0);
  assert.equal(dashboard.projects[0]!.pendingRelease, 0);
  assert.equal(dashboard.projects[0]!.alerts.some((a) => a.category === "escrow"), false, "antes: '$4,600 listos para liberar'");
});

test("0.46 · PMO: la alerta dice 'retenidos en escrow' y ya no afirma que estén 'listos para liberar'", async () => {
  const { service } = makePmo({ txns: [dep(1000), rel(250)], depositSum: 1000 });
  const alert = (await service.getDashboard(T)).projects[0]!.alerts.find((a) => a.category === "escrow")!;
  assert.match(alert.message, /\$750 retenidos en escrow/);
  assert.equal(/listos para liberar/.test(alert.message), false);
  assert.match(alert.action, /hitos aprobados listos para liberar/);
});

test("0.46 · PMO: con una disputa abierta no se sugiere liberar", async () => {
  const { service } = makePmo({ txns: [dep(1000)], openDispute: true, depositSum: 1000 });
  assert.equal((await service.getDashboard(T)).projects[0]!.alerts.some((a) => a.category === "escrow"), false);
});

test("0.46 · PMO: el total fondeado del resumen son los depósitos confirmados de SU tenant (no `totalAmount`)", async () => {
  const { service, aggregateCalls } = makePmo({ totalAmount: 99999, txns: [dep(1000)], depositSum: 1000 });
  const dashboard = await service.getDashboard(T);
  assert.equal(dashboard.summary.totalEscrow, 1000);
  assert.equal(aggregateCalls.length, 1);
  assert.deepEqual(aggregateCalls[0]!.where, { type: "DEPOSIT", status: "SUCCEEDED", escrow: { project: { tenantId: T } } });
});

// ── lente 5D (vista de tenant) ──────────────────────────────────────────────

function make5d(opts: { escrows: Array<{ totalAmount?: number; transactions: Array<{ type: string; amount: number; status: string }> }>; openDispute: boolean }) {
  const prisma = {
    project: { findMany: async () => [{ id: "p1", tenantId: T, status: "in_progress", updatedAt: new Date(), assignedProOrgId: "org_pro" }] },
    milestone: { findMany: async () => [] },
    evidence: { findMany: async () => [] },
    dispute: { findMany: async () => (opts.openDispute ? [{ status: "OPEN" }] : []) },
    invoice: { findMany: async () => [] },
    projectExpense: { findMany: async () => [] },
    paymentEscrow: { findMany: async () => opts.escrows },
    professionalCredential: { findMany: async () => [] },
    agentDelegation: { findMany: async () => [] },
    projectRiskScore: { findMany: async () => [] },
  };
  return new Ecosystem5DService(prisma as never, {} as never);
}

const financeScore = async (service: Ecosystem5DService) =>
  (await service.buildView({ tenantId: T })).dimensions.find((d) => d.key === "finance")!.score;

test("0.46 · 5D: con una disputa abierta, la penalización de Finance usa lo realmente retenido, no todo el escrow", async () => {
  // fondeado 1000, liberado 300 ⇒ retenido 700 ⇒ penalización 0,7 × 15 = 10,5 ⇒ 90 (antes: 100% del escrow ⇒ 85)
  const score = await financeScore(make5d({ escrows: [{ transactions: [dep(1000), rel(300)] }], openDispute: true }));
  assert.equal(score, 90);
});

test("0.46 · 5D: sin depósitos confirmados no hay dinero retenido que penalizar aunque exista un escrow con importe", async () => {
  // el código anterior tomaba `totalAmount` como fondeado y 0 como liberado: ratio 1 ⇒ −15 ⇒ 85
  const score = await financeScore(make5d({ escrows: [{ totalAmount: 4600, transactions: [] }], openDispute: true }));
  assert.equal(score, 100);
});

test("0.46 · 5D: lo liberado cuenta SOLO con SUCCEEDED (el 'COMPLETED' inexistente no libera nada)", async () => {
  const score = await financeScore(make5d({ escrows: [{ transactions: [dep(1000), rel(1000, "COMPLETED")] }], openDispute: true }));
  assert.equal(score, 85, "1000 retenidos de 1000 fondeados: penalización completa de 15");
  const fullyReleased = await financeScore(make5d({ escrows: [{ transactions: [dep(1000), rel(1000)] }], openDispute: true }));
  assert.equal(fullyReleased, 100, "todo liberado: no queda nada retenido");
});

test("0.46 · 5D: sin disputas abiertas el escrow no penaliza", async () => {
  assert.equal(await financeScore(make5d({ escrows: [{ transactions: [dep(1000)] }], openDispute: false })), 100);
});
