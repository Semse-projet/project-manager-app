import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { PrismaLiveSessionResourceAccess } from "../dist/modules/live-sessions/live-sessions.resource-access.js";
import { BuildOpsPlanApprovalService } from "../dist/modules/buildops/buildops-plan-approval.service.js";
import { BuildOpsLegacyPromotionService } from "../dist/modules/buildops/buildops-legacy-promotion.service.js";
import { IntakeOperationsBridgeService } from "../dist/modules/intake-operations-bridge/intake-operations-bridge.service.js";
import { BidsRepository } from "../dist/modules/bids/bids.repository.js";

// C51 etapa 2b — comparaciones manuales de orgId migradas a `sameOrg`: una org vacía/ausente NUNCA coincide.
// Cada igualdad migrada CONCEDE acceso (o su negación lo deniega); ninguna prohibición se tocó.

const throws = (fn: () => void) => { try { fn(); return false; } catch { return true; } };

// El simulador respeta el filtro de tenant de la consulta, como la BD real (job del tenant "t1").
const jobPrisma = (clientOrgId: string) =>
  ({ job: { findFirst: async (q: { where: { tenantId: string } }) => (q.where.tenantId === "t1" ? { clientOrgId } : null) } }) as never;
const sessionActor = (orgId: string, roles: string[] = [], tenantId = "t1") => ({ tenantId, userId: "u1", orgId, roles }) as never;

test("live-sessions: org vacía no abre sesión de un job con org de cliente vacía; cross-org denegado; cliente y OPS_ADMIN permitidos", async () => {
  const open = (clientOrgId: string, orgId: string, roles: string[] = []) =>
    new PrismaLiveSessionResourceAccess(jobPrisma(clientOrgId)).canOpenSession(sessionActor(orgId, roles), "job" as never, "j1");
  assert.equal(await open("", ""), false);
  assert.equal(await open("org_client", ""), false);
  assert.equal(await open("org_client", "org_x"), false);
  assert.equal(await open("org_client", "org_client"), true);
  assert.equal(await open("org_client", "", ["OPS_ADMIN"]), true);
  // cross-tenant: ni la org correcta ni OPS_ADMIN cruzan tenants (el job no se encuentra)
  const crossTenant = (orgId: string, roles: string[] = []) =>
    new PrismaLiveSessionResourceAccess(jobPrisma("org_client")).canOpenSession(sessionActor(orgId, roles, "t2"), "job" as never, "j1");
  assert.equal(await crossTenant("org_client"), false);
  assert.equal(await crossTenant("", ["OPS_ADMIN"]), false);
});

test("buildops-plan-approval: aprobar/gestionar un plan exige misma org no vacía; OPS_ADMIN gestiona", () => {
  const proto = BuildOpsPlanApprovalService.prototype as any;
  const plan = (clientOrgId: string) => ({ jobId: "j1", job: { clientOrgId } });
  const act = (orgId: string, roles: string[] = []) => ({ actorUserId: "u1", orgId, roles });
  assert.equal(throws(() => proto.assertApprovePermission.call({}, plan(""), act(""), "client", null)), true);
  assert.equal(throws(() => proto.assertApprovePermission.call({}, plan("org_client"), act("org_x"), "client", null)), true);
  assert.equal(throws(() => proto.assertApprovePermission.call({}, plan("org_client"), act("org_client"), "client", null)), false);
  assert.equal(throws(() => proto.assertManagementPermission.call({}, plan(""), act(""))), true);
  assert.equal(throws(() => proto.assertManagementPermission.call({}, plan("org_client"), act("org_x"))), true);
  assert.equal(throws(() => proto.assertManagementPermission.call({}, plan("org_client"), act("org_client"))), false);
  assert.equal(throws(() => proto.assertManagementPermission.call({}, plan("org_client"), act("", ["OPS_ADMIN"]))), false);
});

test("intake-operations-bridge / legacy-promotion: org vacía y cross-org denegadas; cliente y OPS_ADMIN permitidos", () => {
  const job = (clientOrgId: string) => ({ clientOrgId, jobId: "j1", job: { clientOrgId } });
  const cases: Array<[string, (org: string, roles: string[], client: string) => void]> = [
    ["intake.assertAccess", (org, roles, client) => (IntakeOperationsBridgeService.prototype as any).assertAccess.call({}, { orgId: org, roles }, job(client))],
    ["promotion.assertPromotionPermission", (org, roles, client) =>
      (BuildOpsLegacyPromotionService.prototype as any).assertPromotionPermission.call({}, job(client), { actorUserId: "u1", orgId: org, roles })],
  ];
  for (const [name, run] of cases) {
    assert.equal(throws(() => run("", [], "")), true, `${name}: vacía vs vacía`);
    assert.equal(throws(() => run("org_x", [], "org_client")), true, `${name}: cross-org`);
    assert.equal(throws(() => run("org_client", [], "org_client")), false, `${name}: cliente`);
    assert.equal(throws(() => run("", ["OPS_ADMIN"], "org_client")), false, `${name}: OPS_ADMIN`);
  }
});

test("bids.ensureProfessionalMembership: org vacía no coincide con proOrg vacía; cross-org denegada; misma org y OPS_ADMIN pasan", async () => {
  const prisma = { role: { findUnique: async () => ({ id: "r1" }) }, membership: { findFirst: async () => ({ id: "m1" }) } };
  const run = (proOrgId: string, orgId: string, roles: string[] = []) =>
    (BidsRepository.prototype as any).ensureProfessionalMembership.call({ prisma }, { proOrgId, orgId, userId: "u1", roles });
  await assert.rejects(run("", ""));
  await assert.rejects(run("org_pro", "org_x"));
  await assert.doesNotReject(run("org_pro", "org_pro"));
  await assert.doesNotReject(run("org_pro", "", ["OPS_ADMIN"]));
});

// Guarda ligera (solo estos archivos): ningún acceso por org vuelve a compararse a mano.
const SRC = (p: string) => readFileSync(new URL(`../src/modules/${p}`, import.meta.url), "utf8");
const MIGRATED: Array<[string, RegExp[]]> = [
  ["live-sessions/live-sessions.resource-access.ts", [/job\.clientOrgId\s*===\s*actor\.orgId/]],
  ["intelligence/budget-intelligence.service.ts", [/job\.clientOrgId\s*===\s*input\.orgId/]],
  ["buildops/buildops-plan-approval.service.ts", [/clientOrgId\s*!==\s*actor\.orgId/]],
  ["buildops/buildops-legacy-promotion.service.ts", [/clientOrgId\s*!==\s*actor\.orgId/]],
  ["intake-operations-bridge/intake-operations-bridge.service.ts", [/job\.clientOrgId\s*!==\s*actor\.orgId/]],
  ["travel/travel.service.ts", [/actor\.orgId\s*===\s*job\.clientOrgId/]],
  ["bids/bids.repository.ts", [/job\.clientOrgId\s*!==\s*input\.orgId/, /input\.proOrgId\s*!==\s*input\.orgId/]],
  ["ratings/ratings.repository.ts", [/input\.orgId\s*===\s*job\.clientOrgId/, /input\.orgId\s*===\s*professionalOrgId/]],
];
test("guarda: los archivos migrados no vuelven a comparar orgId a mano en decisiones de acceso", () => {
  for (const [file, patterns] of MIGRATED) {
    const src = SRC(file);
    for (const p of patterns) assert.equal(p.test(src), false, `${file} contiene ${p}`);
    assert.match(src, /sameOrg/, `${file} debe usar sameOrg`);
  }
});
