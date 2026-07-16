/**
 * Tests de regresión del contrato de privacidad pública (@semse/schemas).
 *
 * Incidente P0 2026-07-13: la landing de producción mostró la dirección
 * exacta de un cliente ("4064 Hal's circle Tallahassee Florida"). Estos
 * tests fijan el contrato: superficies públicas solo pueden mostrar
 * ciudad/estado, nunca direcciones de calle, unidades, emails ni teléfonos.
 *
 * Run: node --experimental-strip-types --test tests/unit/public-sanitizer.test.ts
 */
import test from "node:test";
import assert from "node:assert/strict";

import {
  generalizePublicLocation,
  publicDisplayName,
  redactPublicText,
} from "../../packages/schemas/src/public-sanitizer.ts";
import {
  PUBLIC_MARKET_CURRENCY,
  formatPublicMoney,
  formatPublicMoneyRange,
} from "../../packages/schemas/src/public-market.ts";

// ── generalizePublicLocation ──────────────────────────────────────────────────

test("dirección exacta del incidente queda en ciudad/estado", () => {
  assert.equal(
    generalizePublicLocation("4064 Hal's circle Tallahassee Florida"),
    "Tallahassee Florida",
  );
});

test("dirección con coma conserva solo la cola segura", () => {
  assert.equal(
    generalizePublicLocation("1200 Main Street, Apt 4B, Miami, Florida"),
    "Miami, Florida",
  );
});

test("unidad interior sin número de calle también se descarta", () => {
  const result = generalizePublicLocation("Unit 12, Pensacola, FL");
  assert.equal(result, "Pensacola, FL");
});

test("ciudad/estado permitidos pasan intactos", () => {
  assert.equal(generalizePublicLocation("Tallahassee Florida"), "Tallahassee Florida");
  assert.equal(generalizePublicLocation("Pensacola fl"), "Pensacola fl");
  assert.equal(generalizePublicLocation("Remote"), "Remote");
});

test("ubicación vacía o nula devuelve null", () => {
  assert.equal(generalizePublicLocation(null), null);
  assert.equal(generalizePublicLocation("   "), null);
});

// ── redactPublicText ──────────────────────────────────────────────────────────

test("dirección estadounidense dentro de una descripción se redacta", () => {
  const out = redactPublicText("Pintar la casa en 4064 Hal's circle antes del viernes");
  assert.ok(!out.includes("4064"), `no debe contener el número: ${out}`);
  assert.ok(out.includes("[dirección retirada]"));
});

test("teléfono se redacta", () => {
  const out = redactPublicText("Llámame al 850-555-0123 para coordinar");
  assert.ok(!out.includes("850-555-0123"), out);
  assert.ok(out.includes("[contacto retirado]"));
});

test("email se redacta", () => {
  const out = redactPublicText("Escríbeme a cliente@example.com hoy");
  assert.ok(!out.includes("cliente@example.com"), out);
  assert.ok(out.includes("[contacto retirado]"));
});

test("apartment/unit se redacta", () => {
  const out = redactPublicText("Remodelar baño, Apt 4B, torre norte");
  assert.ok(!/Apt\s*4B/i.test(out), out);
});

test("rangos de presupuesto NO se confunden con teléfonos", () => {
  const out = redactPublicText("Presupuesto entre 3500 - 5000 dólares");
  assert.ok(out.includes("3500 - 5000"), out);
});

test("texto sin PII pasa intacto", () => {
  assert.equal(
    redactPublicText("Instalar dos lámparas de techo en la sala"),
    "Instalar dos lámparas de techo en la sala",
  );
});

// ── publicDisplayName ─────────────────────────────────────────────────────────

test("displayName normal pasa intacto", () => {
  assert.equal(publicDisplayName("María López"), "María López");
});

test("email como displayName cae al fallback (nunca se publica)", () => {
  assert.equal(publicDisplayName("cliente@example.com", "Profesional SEMSE"), "Profesional SEMSE");
});

test("teléfono como displayName cae al fallback", () => {
  assert.equal(publicDisplayName("+1 850 555 0123", "Profesional SEMSE"), "Profesional SEMSE");
});

test("displayName vacío o nulo cae al fallback", () => {
  assert.equal(publicDisplayName(null), "Usuario verificado");
  assert.equal(publicDisplayName("  "), "Usuario verificado");
});

// ── formato de dinero del mercado público ─────────────────────────────────────

test("el mercado público es USD", () => {
  assert.equal(PUBLIC_MARKET_CURRENCY, "USD");
});

test("formatPublicMoney usa en-US/USD sin decimales", () => {
  assert.equal(formatPublicMoney(1500), "$1,500");
});

test("formatPublicMoneyRange colapsa min=max y omite max nulo", () => {
  assert.equal(formatPublicMoneyRange(1500, 2200), "$1,500 - $2,200");
  assert.equal(formatPublicMoneyRange(1500, 1500), "$1,500");
  assert.equal(formatPublicMoneyRange(1500, null), "$1,500");
});
