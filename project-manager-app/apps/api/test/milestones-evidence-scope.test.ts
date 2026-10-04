import test from "node:test";
import assert from "node:assert/strict";
import { MilestonesController } from "../dist/modules/milestones/milestones.controller.js";
import { ResourceScopeResolver } from "../dist/common/resource-scope.resolver.js";

process.env.DATABASE_URL = process.env.DATABASE_URL || "postgresql://stub:stub@127.0.0.1:1/stub";

// C51 etapa 3 (migración gradual): todas las rutas por `milestoneId` de evidencia, preparación de pago, visión y gobernanza
// exigen tenant + participación en el hito. Antes llamaban al repositorio directamente: `listEvidenceItems` y
// `seedEvidenceItems` ni filtraban por tenant (lectura/escritura entre tenants) y las demás no comprobaban la org.

const MILESTONES = [
  { id: "m1", tenantId: "t1", clientOrgId: "org_client", assignedProOrgId: "org_pro" },
  { id: "m_t2", tenantId: "t2", clientOrgId: "org_client_t2", assignedProOrgId: "org_pro_t2" },
  { id: "m1b", tenantId: "t1", clientOrgId: "org_client", assignedProOrgId: "org_pro" },
];
const ITEMS = [
  { id: "i1", milestoneId: "m1", tenantId: "t1" },
  { id: "i_other_ms", milestoneId: "m1b", tenantId: "t1" },
  { id: "i_t2", milestoneId: "m_t2", tenantId: "t2" },
];
const calls: string[] = [];
// Resultados mínimos válidos para que, superada la guarda, cada ruta responda 200 (no solo "llegó al repositorio").
const RESULTS: Record<string, unknown> = {
  computePaymentReadiness: { status: "not_ready", reasons: [], blockers: [], nextAction: "x", milestone: { status: "draft", paymentReadiness: "x", evidenceReadiness: "x" } },
  getEvidenceItemDetail: { id: "i1" },
  getEvidenceItemHistory: { events: [], pageInfo: { hasMore: false } },
  listEvidenceItems: [],
  replaceEvidenceItem: { previousStatus: "missing", updated: { id: "i1", status: "submitted" } },
  archiveEvidenceItem: { previousStatus: "missing" },
};
const repo = new Proxy(
  {
    async evidenceItemBelongsToMilestone({ tenantId, milestoneId, itemId }: { tenantId: string; milestoneId: string; itemId: string }) {
      return ITEMS.some((i) => i.id === itemId && i.milestoneId === milestoneId && i.tenantId === tenantId);
    },
  } as Record<string, unknown>,
  {
    get(target, prop: string) {
      if (prop in target) return target[prop];
      return async () => {
        calls.push(`repo.${prop}`);
        return RESULTS[prop] ?? {};
      };
    },
  },
);
const governance = { evaluate: async () => (calls.push("governance.evaluate"), {}) };
const review = {
  runReview: async () => (calls.push("review.runReview"), {}),
  getLastReview: async () => (calls.push("review.getLastReview"), null),
};
const prisma = {
  milestone: {
    findFirst: async ({ where }: { where: { id: string; project: { tenantId: string } } }) => {
      const m = MILESTONES.find((x) => x.id === where.id && x.tenantId === where.project.tenantId);
      return m ? { project: { tenantId: m.tenantId, assignedProOrgId: m.assignedProOrgId, job: { clientOrgId: m.clientOrgId } } } : null;
    },
  },
};
const controller = new (MilestonesController as any)({}, repo, new ResourceScopeResolver(prisma as never), undefined, governance, review, undefined);

const req = (orgId: string, tenantId = "t1", roles: string[] = []) => ({ headers: {}, authContext: { tenantId, orgId, userId: "u1", roles } });
const outcome = async (p: Promise<unknown>) => {
  try {
    await p;
    return 200;
  } catch (e) {
    return (e as { getStatus?: () => number }).getStatus?.() ?? 500;
  }
};

type R = ReturnType<typeof req>;
const ROUTES: Array<[string, (r: R, m: string, i: string) => Promise<unknown>, string]> = [
  ["listEvidenceItems", (r, m) => controller.listEvidenceItems(r, m), "repo.listEvidenceItems"],
  ["seedEvidenceItems", (r, m) => controller.seedEvidenceItems(r, m, { items: [] }), "repo.seedEvidenceItems"],
  ["updateEvidenceItem", (r, m, i) => controller.updateEvidenceItem(r, m, i, { status: "approved" }), "repo.updateEvidenceItemStatus"],
  ["getPaymentReadiness", (r, m) => controller.getPaymentReadiness(r, m), "repo.computePaymentReadiness"],
  ["getReadiness", (r, m) => controller.getReadiness(r, m), "repo.computePaymentReadiness"],
  ["getVisionSummary", (r, m) => controller.getVisionSummary(r, m), "repo.getVisionSummary"],
  ["getEvidenceItemDetail", (r, m, i) => controller.getEvidenceItemDetail(r, m, i), "repo.getEvidenceItemDetail"],
  ["getEvidenceItemHistory", (r, m, i) => controller.getEvidenceItemHistory(r, m, i), "repo.getEvidenceItemHistory"],
  ["archiveEvidenceItem", (r, m, i) => controller.archiveEvidenceItem(r, m, i, { archiveReason: "x" }), "repo.archiveEvidenceItem"],
  ["replaceEvidenceItem", (r, m, i) => controller.replaceEvidenceItem(r, m, i, { evidenceId: "e1", replacedReason: "x" }), "repo.replaceEvidenceItem"],
  ["runEvidenceReviewAgent", (r, m, i) => controller.runEvidenceReviewAgent(r, m, i, {}), "review.runReview"],
  ["getEvidenceReview", (r, m, i) => controller.getEvidenceReview(r, m, i), "review.getLastReview"],
  ["getPaymentGovernance", (r, m) => controller.getPaymentGovernance(r, m), "governance.evaluate"],
];

test("otro tenant / hito inexistente ⇒ 404 (también OPS_ADMIN) en TODAS las rutas y no se toca el repositorio", async () => {
  for (const [name, run] of ROUTES) {
    calls.length = 0;
    for (const roles of [[], ["OPS_ADMIN"]]) {
      assert.equal(await outcome(run(req("org_client", "t2", roles), "m1", "i1")), 404, `${name} cross-tenant roles=${roles}`);
    }
    assert.equal(await outcome(run(req("org_client"), "m_t2", "i_t2")), 404, `${name} hito de otro tenant`);
    assert.equal(await outcome(run(req("org_client"), "no_existe", "i1")), 404, `${name} inexistente`);
    assert.deepEqual(calls, [], `${name} no debe tocar datos`);
  }
});

test("otra org del mismo tenant ⇒ 403 y org vacía nunca concede, en TODAS las rutas; no se toca el repositorio", async () => {
  for (const [name, run] of ROUTES) {
    calls.length = 0;
    for (const orgId of ["org_other", ""]) {
      assert.equal(await outcome(run(req(orgId), "m1", "i1")), 403, `${name} org=${orgId}`);
    }
    assert.deepEqual(calls, [], `${name} no debe tocar datos`);
  }
});

test("cliente, profesional asignado y OPS_ADMIN del tenant superan la guarda en TODAS las rutas", async () => {
  for (const [name, run, expected] of ROUTES) {
    // seed está reservado a la org cliente (u OPS_ADMIN del tenant): el profesional asignado NO lo supera.
    const actors = name === "seedEvidenceItems" ? [req("org_client"), req("", "t1", ["OPS_ADMIN"])] : [req("org_client"), req("org_pro"), req("", "t1", ["OPS_ADMIN"])];
    for (const r of actors) {
      calls.length = 0;
      const status = await outcome(run(r, "m1", "i1"));
      assert.equal(status, 200, `${name}: debe responder 200 tras superar la guarda (calls=${calls.join(",")})`);
      assert.ok(calls.includes(expected), `${name}: ${expected} no se llamó (calls=${calls.join(",")})`);
    }
  }
});

test("seed: el profesional asignado ⇒ 403 y no se escribe; las demás rutas siguen abiertas al profesional", async () => {
  calls.length = 0;
  assert.equal(await outcome(controller.seedEvidenceItems(req("org_pro"), "m1", { items: [] })), 403);
  assert.deepEqual(calls, []);
  assert.equal(await outcome(controller.listEvidenceItems(req("org_pro"), "m1")), 200);
});

test("un item que pertenece a OTRO hito (aunque del mismo tenant y org) ⇒ 404 en las rutas con itemId", async () => {
  const withItem = ROUTES.filter(([name]) => !["listEvidenceItems", "seedEvidenceItems", "getPaymentReadiness", "getReadiness", "getVisionSummary", "getPaymentGovernance"].includes(name));
  assert.equal(withItem.length, 7);
  for (const [name, run] of withItem) {
    calls.length = 0;
    assert.equal(await outcome(run(req("org_client"), "m1", "i_other_ms")), 404, `${name} item de otro hito`);
    assert.equal(await outcome(run(req("org_client"), "m1", "i_t2")), 404, `${name} item de otro tenant`);
    assert.deepEqual(calls, [], `${name} no debe tocar datos`);
  }
});

// ── Defensa en profundidad: el repositorio también filtra por tenant (listar / sembrar) ──────────────────────────────
import { MilestonesRepository } from "../dist/modules/milestones/milestones.repository.js";

test("repositorio: listEvidenceItems filtra por tenant y seedEvidenceItems no escribe si el hito no es del tenant", async () => {
  const seen: { where?: unknown; createMany: number } = { createMany: 0 };
  const prisma = {
    milestone: { findFirst: async ({ where }: { where: { id: string; project: { tenantId: string } } }) => (where.id === "m1" && where.project.tenantId === "t1" ? { id: "m1" } : null), findUnique: async () => null },
    milestoneEvidenceItem: {
      findMany: async ({ where }: { where: unknown }) => ((seen.where = where), []),
      count: async () => 0,
      createMany: async () => void (seen.createMany += 1),
    },
  };
  const repository = new (MilestonesRepository as any)(prisma, {}, undefined);

  await repository.listEvidenceItems("m1", "t1");
  assert.deepEqual(seen.where, { milestoneId: "m1", milestone: { project: { tenantId: "t1" } } });

  await assert.rejects(repository.seedEvidenceItems("m1", [{ label: "x" }], "t2"), (e: { getStatus?: () => number }) => e.getStatus?.() === 404);
  assert.equal(seen.createMany, 0, "no debe escribir en un hito de otro tenant");
  await repository.seedEvidenceItems("m1", [{ label: "x" }], "t1");
  assert.equal(seen.createMany, 1);
});
