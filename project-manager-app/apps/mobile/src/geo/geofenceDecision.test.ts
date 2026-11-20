import { proximityActionForDecision as act } from "./geofenceDecision";

describe("OPEN-18 server decision → app action", () => {
  it("only AUTO_START_ALLOWED auto-starts", () => expect(act("AUTO_START_ALLOWED")).toBe("auto"));
  it("PROMPT and MANUAL_ONLY ask the person", () => {
    expect(act("PROMPT")).toBe("ask");
    expect(act("MANUAL_ONLY")).toBe("ask");
  });
  it.each(["IGNORE", "EXCEPTION", "LEAVE_PROMPT", "unknown", null, undefined])("%s does nothing", (d) => expect(act(d)).toBe("none"));
});
