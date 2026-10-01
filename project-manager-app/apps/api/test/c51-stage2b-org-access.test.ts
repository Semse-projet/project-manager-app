import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { PrismaLiveSessionResourceAccess } from "../dist/modules/live-sessions/live-sessions.resource-access.js";
import { BuildOpsPlanApprovalService } from "../dist/modules/buildops/buildops-plan-approval.service.js";

// C51 etapa 2b — comparaciones manuales de orgId migradas a `sameOrg`: una org vacía/ausente NUNCA coincide.
// Cada igualdad migrada CONCEDE acceso (o su negación lo deniega); ninguna prohibición se tocó.

const throws = (fn: () => void) => { try { fn(); return false; } catch { return true; } };

const jobPrisma = (clientOrgId: string) => ({ job: { findFirst: async () => ({ clientOrgId }) } }) as never;
const sessionActor = (orgId: string, roles: string[] = []) => ({ tenantId: "t1", userId: "u1", orgId, roles }) as never;

test("live-sessions: org vacía no abre sesión de un job con org de cliente vacía; cross-org denegado; cliente y OPS_ADMIN permitidos", async () => {
  const open = (clientOrgId: string, orgId: string, roles: string[] = []) =>
    new PrismaLiveSessionResourceAccess(jobPrisma(clientOrgId)).canOpenSession(sessionActor(orgId, roles), "job" as never, "j1");
  assert.equal(await open("", ""), false);
  assert.equal(await open("org_client", ""), false);
  assert.equal(await open("org_client", "org_x"), false);
  assert.equal(await open("org_client", "org_client"), true);
  assert.equal(await open("org_client", "", ["OPS_ADMIN"]), true);
});

test("buildops-plan-approval: aprobar/gestionar un plan exige misma org no vacía; OPS_ADMIN aprueba con motivo", () => {
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
