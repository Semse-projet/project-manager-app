import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const ratesSource = readFileSync(
  "apps/web/app/(app)/worker/rates/page.tsx",
  "utf8",
);

test("worker rates are presented as a saved reference, not an active estimate override", () => {
  assert.match(
    ratesSource,
    /hoy no cambian estimados ni cotizaciones automáticamente/i,
  );
  assert.match(ratesSource, /Referencia guardada/);
  assert.match(
    ratesSource,
    /Aún no modifican estimados ni cotizaciones/i,
  );
  assert.match(ratesSource, /Comparación con BLS/);
  assert.match(ratesSource, /Equivalencia de referencia/);
});

test("worker rates page no longer promises behavior that is not connected", () => {
  assert.doesNotMatch(
    ratesSource,
    /reemplazan los promedios BLS en cada estimado/i,
  );
  assert.doesNotMatch(ratesSource, /Se usarán en todos los estimados futuros/i);
  assert.doesNotMatch(ratesSource, /Multiplicador aplicado/i);
  assert.doesNotMatch(ratesSource, /Factor aplicado/i);
  assert.doesNotMatch(ratesSource, /Usar BLS/);
});

test("the mitigation preserves reference persistence without inventing estimate wiring", () => {
  assert.match(ratesSource, /saveMyLaborRates/);
  assert.match(ratesSource, /deleteMyLaborRates/);
  assert.doesNotMatch(ratesSource, /protools\/estimate/);
  assert.doesNotMatch(ratesSource, /suggestBudget/);
});
