import test from "node:test";
import assert from "node:assert/strict";
import { NotFoundException } from "@nestjs/common";
import { MilestonesController } from "../dist/modules/milestones/milestones.controller.js";

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
const repo = new Proxy(
  {
    async getMilestoneOwnership({ tenantId, milestoneId }: { tenantId: string; milestoneId: string }) {
      const m = MILESTONES.find((x) => x.id === milestoneId && x.tenantId === tenantId);
      if (!m) throw new NotFoundException(`Milestone '${milestoneId}' not found`);
      return { clientOrgId: m.clientOrgId, assignedProOrgId: m.assignedProOrgId };
    },
    async evidenceItemBelongsToMilestone({ tenantId, milestoneId, itemId }: { tenantId: string; milestoneId: string; itemId: string }) {
      return ITEMS.some((i) => i.id === itemId && i.milestoneId === milestoneId && i.tenantId === tenantId);
    },
  } as Record<string, unknown>,
  {
    get(target, prop: string) {
      if (prop in target) return target[prop];
      return async () => {
        calls.push(`repo.${prop}`);
        return {};
      };
    },
  },
);
const governance = { evaluate: async () => (calls.push("governance.evaluate"), {}) };
const review = {
  runReview: async () => (calls.push("review.runReview"), {}),
  getLastReview: async () => (calls.push("review.getLastReview"), null),
};
const controller = new (MilestonesController as any)({}, repo, undefined, governance, review, undefined);

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
    for (const r of [req("org_client"), req("org_pro"), req("", "t1", ["OPS_ADMIN"])]) {
      calls.length = 0;
      await outcome(run(r, "m1", "i1"));
      assert.ok(calls.includes(expected), `${name}: ${expected} no se llamó (calls=${calls.join(",")})`);
    }
  }
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
