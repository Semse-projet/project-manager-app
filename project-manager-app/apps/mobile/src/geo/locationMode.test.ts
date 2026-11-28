import { proximityModeFromLocationPreference as map, resolveProximityMode } from "./locationMode";

describe("proximityModeFromLocationPreference", () => {
  it("OFF apaga la detección", () => {
    expect(map({ effectiveMode: "OFF", autoStartConsent: false })).toBe("off");
  });
  it("ASK pregunta", () => {
    expect(map({ effectiveMode: "ASK", autoStartConsent: false })).toBe("ask");
  });
  it("AUTO solo auto-inicia con consentimiento vigente", () => {
    expect(map({ effectiveMode: "AUTO", autoStartConsent: true })).toBe("auto");
    expect(map({ effectiveMode: "AUTO", autoStartConsent: false })).toBe("ask");
  });
});

describe("resolveProximityMode", () => {
  const pref = (effectiveMode: "ASK" | "AUTO" | "OFF", autoStartConsent = false) =>
    ({ kind: "ok" as const, pref: { mode: effectiveMode, effectiveMode, autoStartConsent, policyVersion: 1 } });
  it("solo un 404 recupera el modo del perfil anterior", () => {
    expect(resolveProximityMode({ kind: "disabled" }, "auto")).toBe("auto");
    expect(resolveProximityMode({ kind: "disabled" }, null)).toBeNull();
  });
  it("un error de lectura falla cerrado a off aunque el perfil anterior sea auto", () => {
    expect(resolveProximityMode({ kind: "error", message: "503" }, "auto")).toBe("off");
  });
  it("con BO-09 disponible manda su modo efectivo", () => {
    expect(resolveProximityMode(pref("ASK"), "auto")).toBe("ask");
    expect(resolveProximityMode(pref("AUTO", true), "off")).toBe("auto");
  });
});
