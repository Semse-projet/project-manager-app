import test from "node:test";
import assert from "node:assert/strict";
import { proximityModeFromLocationPreference as map } from "../../apps/web/lib/location-mode.ts";

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
