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

test("jobs: transición por defecto con org vacía y SIN profesional asignado => denegada (antes: '' !== '' la permitía)", () => {
  // Brecha real: actorOrgId "" vs (professionalOrgId ?? "") === "" => se concedía la transición.
  assert.equal(throws(() => assertTransitionAuthorized("COMPLETED" as never, "", [], own(null))), true);
  assert.equal(throws(() => assertTransitionAuthorized("CANCELLED" as never, "", [], own(null))), true);
});

test("jobs: transiciones autorizadas siguen funcionando (no regresión)", () => {
  // cliente, profesional asignado, OPS_ADMIN y SYSTEM
  assert.equal(throws(() => assertTransitionAuthorized("COMPLETED" as never, "org_client", [], own("org_pro"))), false);
  assert.equal(throws(() => assertTransitionAuthorized("COMPLETED" as never, "org_pro", [], own("org_pro"))), false);
  assert.equal(throws(() => assertTransitionAuthorized("COMPLETED" as never, "", ["OPS_ADMIN"], own(null))), false);
  assert.equal(throws(() => assertTransitionAuthorized("COMPLETED" as never, "", ["SYSTEM"], own(null))), false);
});

test("jobs: otra org => denegada en cualquier transición", () => {
  for (const status of ["COMPLETED", "CANCELLED", "IN_PROGRESS", "ACCEPTED"] as const) {
    assert.equal(throws(() => assertTransitionAuthorized(status as never, "org_x", [], own("org_pro"))), true, status);
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
