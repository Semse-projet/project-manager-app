import test from "node:test";
import assert from "node:assert/strict";
import { ForbiddenException, NotFoundException } from "@nestjs/common";
import {
  assertScopeAccess,
  hasScopeAccess,
  sameOrg,
  type ProjectScope,
  type ScopeAccess,
  type ScopeActor,
} from "../dist/common/resource-scope.js";
import { assertEvidenceReadable, assertEvidenceWritable } from "../dist/modules/evidence/evidence.policy.js";
import { assertMilestoneReadable } from "../dist/modules/milestones/milestones.policy.js";
import { assertDisputeReadable } from "../dist/modules/disputes/disputes.policy.js";
import { canReadProject, canReadProjectFinancials } from "../dist/modules/projects/projects.policy.js";
import { assertLienAccess } from "../dist/modules/liens/lien-access.service.js";

// C51 — contrato comun ResourceScope: matriz tenant x org x rol, paridad con las
// politicas existentes (que ahora delegan en el) y los casos negativos.

const scope: ProjectScope = { tenantId: "t1", clientOrgId: "org_client", assignedProOrgId: "org_pro" };
const actor = (over: Partial<ScopeActor> = {}): ScopeActor => ({ tenantId: "t1", orgId: "org_other", userId: "u", roles: [], ...over });

test("sameOrg: nunca coincide con vacio/ausente, tampoco vacio con vacio", () => {
  assert.equal(sameOrg("a", "a"), true);
  assert.equal(sameOrg("a", "b"), false);
  assert.equal(sameOrg("", ""), false);
  assert.equal(sameOrg(undefined, undefined), false);
  assert.equal(sameOrg(null, "a"), false);
});

test("matriz de acceso por relacion", () => {
  const cases: Array<[string, ScopeActor, Record<ScopeAccess, boolean>]> = [
    ["cliente", actor({ orgId: "org_client" }), { read: true, client: true, pro: false, ops: false }],
    ["profesional", actor({ orgId: "org_pro" }), { read: true, client: false, pro: true, ops: false }],
    ["otro org del mismo tenant", actor({ orgId: "org_x" }), { read: false, client: false, pro: false, ops: false }],
    ["OPS_ADMIN", actor({ orgId: "org_ops", roles: ["OPS_ADMIN"] }), { read: true, client: true, pro: true, ops: true }],
  ];
  for (const [name, a, expected] of cases) {
    for (const access of ["read", "client", "pro", "ops"] as ScopeAccess[]) {
      assert.equal(hasScopeAccess(a, scope, access), expected[access], `${name} / ${access}`);
    }
  }
});

test("cross-tenant: nadie cruza tenants, ni el cliente dueño ni OPS_ADMIN => 404 sin oraculo", () => {
  for (const a of [actor({ tenantId: "t2", orgId: "org_client" }), actor({ tenantId: "t2", orgId: "org_ops", roles: ["OPS_ADMIN"] })]) {
    for (const access of ["read", "client", "pro", "ops"] as ScopeAccess[]) {
      assert.equal(hasScopeAccess(a, scope, access), false);
      assert.throws(() => assertScopeAccess(a, scope, access, "denied"), NotFoundException);
    }
  }
});

test("cross-org: otro org del tenant => 403", () => {
  assert.throws(() => assertScopeAccess(actor(), scope, "read", "denied"), ForbiddenException);
});

test("org vacia: un actor sin org NO accede a un proyecto sin profesional asignado (antes coincidian '' === '')", () => {
  const unassigned: ProjectScope = { tenantId: "t1", clientOrgId: "org_client", assignedProOrgId: "" };
  assert.equal(hasScopeAccess(actor({ orgId: "" }), unassigned, "read"), false);
  assert.equal(hasScopeAccess(actor({ orgId: "" }), unassigned, "pro"), false);
  const nullAssigned: ProjectScope = { tenantId: "t1", clientOrgId: null, assignedProOrgId: null };
  assert.equal(hasScopeAccess(actor({ orgId: "" }), nullAssigned, "read"), false);
});

// ── paridad con las politicas de dominio (ahora delegan en el contrato) ──────
const ownership = { clientOrgId: "org_client", assignedProOrgId: "org_pro" };
const actors: Array<[string, ScopeActor]> = [
  ["cliente", actor({ orgId: "org_client" })],
  ["profesional", actor({ orgId: "org_pro" })],
  ["otro", actor({ orgId: "org_x" })],
  ["ops", actor({ orgId: "org_ops", roles: ["OPS_ADMIN"] })],
];
const passes = (fn: () => void) => { try { fn(); return true; } catch { return false; } };

test("paridad: evidence / milestones / disputes / projects / liens == contrato", () => {
  for (const [name, a] of actors) {
    const readExpected = hasScopeAccess(a, scope, "read");
    assert.equal(passes(() => assertEvidenceReadable(a, ownership)), readExpected, `evidence read ${name}`);
    assert.equal(passes(() => assertEvidenceWritable(a, ownership)), readExpected, `evidence write ${name}`);
    assert.equal(passes(() => assertMilestoneReadable(a, ownership)), readExpected, `milestone read ${name}`);
    assert.equal(passes(() => assertDisputeReadable(a, ownership)), readExpected, `dispute read ${name}`);
    assert.equal(canReadProject(a, ownership), readExpected, `project read ${name}`);
    assert.equal(canReadProjectFinancials(a, ownership), hasScopeAccess(a, scope, "client"), `project financials ${name}`);
    assert.equal(passes(() => assertLienAccess(a, ownership, "read")), readExpected, `lien read ${name}`);
    assert.equal(passes(() => assertLienAccess(a, ownership, "pro")), hasScopeAccess(a, scope, "pro"), `lien pro ${name}`);
    assert.equal(passes(() => assertLienAccess(a, ownership, "ops")), hasScopeAccess(a, scope, "ops"), `lien ops ${name}`);
  }
});

test("las politicas de dominio tambien cierran el caso de org vacia", () => {
  const emptyOwnership = { clientOrgId: "org_client", assignedProOrgId: "" };
  const noOrg = actor({ orgId: "" });
  assert.equal(passes(() => assertEvidenceReadable(noOrg, emptyOwnership)), false);
  assert.equal(passes(() => assertMilestoneReadable(noOrg, emptyOwnership)), false);
  assert.equal(passes(() => assertDisputeReadable(noOrg, emptyOwnership)), false);
  assert.equal(canReadProject(noOrg, emptyOwnership), false);
});

test("politicas migradas: ownership de otro tenant se niega para todos (incl. OPS_ADMIN)", () => {
  const foreign = { ...ownership, tenantId: "t2" };
  for (const [name, a] of actors) {
    assert.equal(passes(() => assertEvidenceReadable(a, foreign)), false, `evidence ${name}`);
    assert.equal(passes(() => assertEvidenceWritable(a, foreign)), false, `evidence write ${name}`);
    assert.equal(passes(() => assertMilestoneReadable(a, foreign)), false, `milestone ${name}`);
    assert.equal(passes(() => assertDisputeReadable(a, foreign)), false, `dispute ${name}`);
    assert.equal(canReadProject(a, foreign), false, `project ${name}`);
    assert.equal(canReadProjectFinancials(a, foreign), false, `project financials ${name}`);
    assert.equal(passes(() => assertLienAccess(a, foreign, "read")), false, `lien ${name}`);
  }
});
