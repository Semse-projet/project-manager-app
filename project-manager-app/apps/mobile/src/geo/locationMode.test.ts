import { proximityModeFromLocationPreference as map } from "./locationMode";

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
