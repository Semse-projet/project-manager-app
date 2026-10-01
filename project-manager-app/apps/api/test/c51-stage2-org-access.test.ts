import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { assertTransitionAuthorized } from "../dist/modules/jobs/jobs.service.js";
import { ContractsRepository } from "../dist/modules/contracts/contracts.repository.js";
import { ReservationsRepository } from "../dist/modules/reservations/reservations.repository.js";

// C51 etapa 2 — comparaciones de orgId a mano migradas a `sameOrg` (una org vacía/ausente NUNCA coincide).
// Dirección importante: donde la igualdad CONCEDE acceso se aprieta; donde la igualdad PROHÍBE algo
// (p. ej. "el dueño no puede reservar su propio job") NO se toca, porque sameOrg lo aflojaría.

const throws = (fn: () => void) => { try { fn(); return false; } catch { return true; } };
const own = (professionalOrgId: string | null) => ({ clientOrgId: "org_client", professionalOrgId });

test("jobs: org vacía => denegada en las tres ramas (cliente, profesional, por defecto); antes '' !== '' la permitía en la por defecto", () => {
  // Estados reales (minúsculas): completed/cancelled = solo cliente; review/dispute = solo profesional; resto = por defecto.
  for (const status of ["completed", "cancelled", "review", "dispute", "in_progress", "accepted"] as const) {
    assert.equal(throws(() => assertTransitionAuthorized(status as never, "", [], own(null))), true, `${status} sin profesional`);
    assert.equal(throws(() => assertTransitionAuthorized(status as never, "", [], own(""))), true, `${status} profesional vacío`);
  }
});

test("jobs: transiciones autorizadas siguen funcionando en cada rama (no regresión)", () => {
  const ok = (status: string, org: string, roles: string[], pro: string | null) =>
    throws(() => assertTransitionAuthorized(status as never, org, roles, own(pro))) === false;
  assert.equal(ok("completed", "org_client", [], "org_pro"), true); // rama solo-cliente
  assert.equal(ok("review", "org_pro", [], "org_pro"), true); // rama solo-profesional
  assert.equal(ok("in_progress", "org_client", [], "org_pro"), true); // por defecto: cliente
  assert.equal(ok("in_progress", "org_pro", [], "org_pro"), true); // por defecto: profesional
  assert.equal(ok("completed", "", ["OPS_ADMIN"], null), true);
  assert.equal(ok("review", "", ["SYSTEM"], null), true);
});

test("jobs: restricciones por rama — el profesional no completa/cancela, el cliente no revisa/disputa; otra org denegada en todas", () => {
  const denied = (status: string, org: string) => throws(() => assertTransitionAuthorized(status as never, org, [], own("org_pro")));
  assert.equal(denied("completed", "org_pro"), true);
  assert.equal(denied("cancelled", "org_pro"), true);
  assert.equal(denied("review", "org_client"), true);
  assert.equal(denied("dispute", "org_client"), true);
  for (const status of ["completed", "cancelled", "review", "dispute", "in_progress", "accepted"]) {
    assert.equal(denied(status, "org_x"), true, status);
  }
});

const actor = (orgId: string, roles: string[] = []) => ({ tenantId: "t1", userId: "u1", orgId, roles });
const contract = (clientOrgId: string) => ({ job: { clientOrgId } });

test("contracts.canReadContract: org vacía nunca coincide (ni con cliente vacío ni con profesional nulo/vacío)", () => {
  const can = (a: any, row: any, pro: string | null) => (ContractsRepository.prototype as any).canReadContract.call({}, a, row, pro);
  assert.equal(can(actor(""), contract(""), null), false);
  assert.equal(can(actor(""), contract("org_client"), ""), false);
  assert.equal(can(actor("org_x"), contract("org_client"), "org_pro"), false); // cross-org
  assert.equal(can(actor("org_client"), contract("org_client"), "org_pro"), true);
  assert.equal(can(actor("org_pro"), contract("org_client"), "org_pro"), true);
  assert.equal(can(actor("", ["OPS_ADMIN"]), contract("org_client"), null), true);
});

test("reservations.canRead*: org vacía nunca coincide; cross-org denegado; partes legítimas permitidas", () => {
  const proto = ReservationsRepository.prototype as any;
  const row = (clientOrgId: string, professionalOrgId: string | null) => ({ job: { clientOrgId }, professionalOrgId });
  assert.equal(proto.canReadReservation.call({}, actor(""), row("", null)), false);
  assert.equal(proto.canReadReservation.call({}, actor(""), row("org_client", "")), false);
  assert.equal(proto.canReadReservation.call({}, actor("org_x"), row("org_client", "org_pro")), false);
  assert.equal(proto.canReadReservation.call({}, actor("org_client"), row("org_client", "org_pro")), true);
  assert.equal(proto.canReadReservation.call({}, actor("org_pro"), row("org_client", "org_pro")), true);
  assert.equal(proto.canReadJobReservations.call({}, actor(""), "", [row("", "")]), false);
  assert.equal(proto.canReadJobReservations.call({}, actor("org_x"), "org_client", [row("org_client", "org_pro")]), false);
  assert.equal(proto.canReadJobReservations.call({}, actor("org_pro"), "org_client", [row("org_client", "org_pro")]), true);
});

// Guarda ligera (informativa, solo estos archivos): ningún acceso por org vuelve a compararse a mano.
const SRC = (p: string) => readFileSync(new URL(`../src/modules/${p}`, import.meta.url), "utf8");
const MIGRATED: Array<[string, RegExp[]]> = [
  ["jobs/jobs.service.ts", [/actorOrgId\s*!==\s*ownership\./, /\?\?\s*""\)/]],
  ["jobs/jobs.repository.ts", [/job\.clientOrgId\s*!==\s*input\.orgId/]],
  ["materials/materials.service.ts", [/input\.orgId\s*!==\s*project\./]],
  ["incidents/incidents.service.ts", [/input\.orgId\s*!==\s*project\./]],
  ["change-orders/change-orders.service.ts", [/actor\.orgId\s*!==\s*project\./]],
  ["contracts/contracts.repository.ts", [/job\.clientOrgId\s*!==\s*input\.orgId/, /actor\.orgId\s*===\s*row\.job\.clientOrgId/, /professionalOrgId\s*===\s*input\.orgId/]],
  ["reservations/reservations.repository.ts", [/row\.job\.clientOrgId\s*!==\s*input\.orgId/, /actor\.orgId\s*===\s*row\.job\.clientOrgId/, /actor\.orgId\s*===\s*clientOrgId/, /row\.professionalOrgId\s*===\s*actor\.orgId/]],
];
test("guarda: los archivos migrados no vuelven a comparar orgId a mano en decisiones de acceso", () => {
  for (const [file, patterns] of MIGRATED) {
    const src = SRC(file);
    for (const p of patterns) assert.equal(p.test(src), false, `${file} contiene ${p}`);
    assert.match(src, /sameOrg/, `${file} debe usar sameOrg`);
  }
  // la PROHIBICIÓN (dueño no reserva su propio job) debe seguir siendo igualdad simple
  assert.match(SRC("reservations/reservations.repository.ts"), /job\.clientOrgId\s*===\s*input\.orgId\s*&&\s*!input\.roles\.includes\("OPS_ADMIN"\)/);
});
