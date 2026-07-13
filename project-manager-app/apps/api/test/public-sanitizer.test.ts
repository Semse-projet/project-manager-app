import test from "node:test";
import assert from "node:assert/strict";
import {
  generalizePublicLocation,
  publicDisplayName,
  redactPublicText,
} from "../src/modules/intelligence/public-sanitizer.ts";

test("generalizePublicLocation deja intactas ubicaciones a nivel ciudad", () => {
  assert.equal(generalizePublicLocation("Naucalpan, Mex."), "Naucalpan, Mex.");
  assert.equal(generalizePublicLocation("Benito Juárez, CDMX"), "Benito Juárez, CDMX");
  assert.equal(generalizePublicLocation("Mérida"), "Mérida");
});

test("generalizePublicLocation quita direcciones exactas sin comas", () => {
  assert.equal(
    generalizePublicLocation("4064 Hal's circle Tallahassee Florida"),
    "Tallahassee Florida",
  );
});

test("generalizePublicLocation quita segmentos con números en listas con comas", () => {
  assert.equal(
    generalizePublicLocation("Calle Hidalgo #23, Col. Centro, Mérida, Yuc."),
    "Mérida, Yuc.",
  );
});

test("generalizePublicLocation maneja null/vacío", () => {
  assert.equal(generalizePublicLocation(null), null);
  assert.equal(generalizePublicLocation("   "), null);
  assert.equal(generalizePublicLocation("123 456"), null);
});

test("redactPublicText quita emails y teléfonos", () => {
  const out = redactPublicText("Llámame al 555-123-4567 o escribe a juan.perez@gmail.com");
  assert.ok(!out.includes("555-123-4567"));
  assert.ok(!out.includes("juan.perez@gmail.com"));
  assert.ok(out.includes("[contacto retirado]"));
});

test("redactPublicText quita direcciones de calle en inglés y español", () => {
  const en = redactPublicText("Trabajo en 4064 Hals circle cerca del centro");
  assert.ok(!en.includes("4064"), en);
  const es = redactPublicText("Reparación en Av. Reforma 1200, interior 3");
  assert.ok(!es.includes("Reforma 1200"), es);
});

test("redactPublicText no toca rangos de presupuesto", () => {
  const out = redactPublicText("Presupuesto entre 3500 y 5000 pesos por 80m2");
  assert.ok(out.includes("3500"));
  assert.ok(out.includes("5000"));
});

test("redactPublicText acota el largo en un límite de palabra", () => {
  const long = "palabra ".repeat(100);
  const out = redactPublicText(long, 100);
  assert.ok(out.length <= 101);
  assert.ok(out.endsWith("…"));
});

test("publicDisplayName nunca devuelve vacío ni email", () => {
  assert.equal(publicDisplayName("María López"), "María López");
  assert.equal(publicDisplayName(null), "Usuario verificado");
  assert.equal(publicDisplayName("  ", "Cliente verificado"), "Cliente verificado");
});
