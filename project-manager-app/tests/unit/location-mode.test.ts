import test from "node:test";
import assert from "node:assert/strict";
import { proximityModeFromLocationPreference as map, resolveProximityMode } from "../../apps/web/lib/location-mode.ts";

test("OFF apaga la detección por proximidad", () => {
  assert.equal(map({ effectiveMode: "OFF", autoStartConsent: false }), "off");
});

test("ASK pregunta", () => {
  assert.equal(map({ effectiveMode: "ASK", autoStartConsent: false }), "ask");
});

test("AUTO solo auto-inicia con consentimiento vigente", () => {
  assert.equal(map({ effectiveMode: "AUTO", autoStartConsent: true }), "auto");
  assert.equal(map({ effectiveMode: "AUTO", autoStartConsent: false }), "ask");
});

test("resolveProximityMode: solo un 404 recupera el modo del perfil anterior", () => {
  assert.equal(resolveProximityMode({ kind: "disabled" }, "auto"), "auto");
  assert.equal(resolveProximityMode({ kind: "disabled" }, null), null);
});

test("resolveProximityMode: un error de lectura de BO-09 falla cerrado a off, aunque el perfil anterior sea auto", () => {
  assert.equal(resolveProximityMode({ kind: "error" }, "auto"), "off");
  assert.equal(resolveProximityMode({ kind: "error" }, null), "off");
});

test("resolveProximityMode: con BO-09 disponible manda su modo efectivo, no el perfil", () => {
  assert.equal(resolveProximityMode({ kind: "ok", pref: { effectiveMode: "ASK", autoStartConsent: false } }, "auto"), "ask");
  assert.equal(resolveProximityMode({ kind: "ok", pref: { effectiveMode: "OFF", autoStartConsent: false } }, "auto"), "off");
});
