// G-R03 (unit): un CI antiguo que termina tarde no puede desplegar un SHA
// obsoleto sobre uno más reciente. Historia lineal simulada: A <- B <- C.
import test from "node:test";
import assert from "node:assert/strict";
import { decideRelease } from "../../scripts/release-forward-guard.mjs";

const A = "a".repeat(40);
const B = "b".repeat(40);
const C = "c".repeat(40);
const X = "e".repeat(40); // rama divergente
const order = [A, B, C];
const isAncestor = (x, y) => {
  const i = order.indexOf(x);
  const j = order.indexOf(y);
  return i !== -1 && j !== -1 && i <= j;
};

test("avance lineal: sirve A, candidato C -> deploy", () => {
  assert.equal(decideRelease({ candidate: C, served: A, isAncestor }).action, "deploy");
});

test("CI de B termina después de desplegar C -> superseded, nunca deploy", () => {
  assert.equal(decideRelease({ candidate: B, served: C, isAncestor }).action, "superseded");
});

test("producción ya sirve el candidato -> already_served", () => {
  assert.equal(decideRelease({ candidate: C, served: C, isAncestor }).action, "already_served");
});

test("SHA servido desconocido -> blocked (fail closed)", () => {
  for (const served of ["unknown", "", undefined, "abc1234"]) {
    assert.equal(decideRelease({ candidate: C, served, isAncestor }).action, "blocked");
  }
});

test("historias divergentes -> blocked", () => {
  assert.equal(decideRelease({ candidate: X, served: C, isAncestor }).action, "blocked");
});

test("candidato inválido -> blocked", () => {
  assert.equal(decideRelease({ candidate: "main", served: A, isAncestor }).action, "blocked");
});

test("mayúsculas se normalizan", () => {
  assert.equal(decideRelease({ candidate: C.toUpperCase(), served: A, isAncestor }).action, "deploy");
});
