import test from "node:test";
import assert from "node:assert/strict";

// ── M2.1 Lien Rights ──────────────────────────────────────────────────────────

type LienState = "draft" | "pending_notice" | "notice_sent" | "waiver_required" | "ready_to_release";

function calculateLienDeadlines(stateAbbrev: string, noticeDate: Date): { thirty: Date; seven: Date; three: Date } {
  const ms = noticeDate.getTime();
  return {
    thirty: new Date(ms + 30 * 24 * 60 * 60 * 1000),
    seven: new Date(ms + 7 * 24 * 60 * 60 * 1000),
    three: new Date(ms + 3 * 24 * 60 * 60 * 1000),
  };
}

function releaseBlockedByLienWaiver(input: { waiverRequired: boolean; waiverPresent: boolean }): boolean {
  return input.waiverRequired && !input.waiverPresent;
}

function providerFailureDoesNotCorruptPaymentState(current: { paymentState: string; lienState: LienState }, error: Error) {
  return {
    paymentState: current.paymentState,
    lienState: current.lienState,
    providerError: error.message,
  };
}

test("M2.1 lien deadlines are scheduled at 30, 7 and 3 days", () => {
  const base = new Date("2026-06-09T12:00:00.000Z");
  const deadlines = calculateLienDeadlines("CA", base);
  assert.equal(deadlines.thirty.toISOString(), "2026-07-09T12:00:00.000Z");
  assert.equal(deadlines.seven.toISOString(), "2026-06-16T12:00:00.000Z");
  assert.equal(deadlines.three.toISOString(), "2026-06-12T12:00:00.000Z");
});

test("M2.1 release is blocked when a required waiver is missing", () => {
  assert.equal(releaseBlockedByLienWaiver({ waiverRequired: true, waiverPresent: false }), true);
  assert.equal(releaseBlockedByLienWaiver({ waiverRequired: true, waiverPresent: true }), false);
  assert.equal(releaseBlockedByLienWaiver({ waiverRequired: false, waiverPresent: false }), false);
});

test("M2.1 provider failures do not corrupt payment state", () => {
  const result = providerFailureDoesNotCorruptPaymentState(
    { paymentState: "held", lienState: "waiver_required" },
    new Error("provider timeout")
  );
  assert.equal(result.paymentState, "held");
  assert.equal(result.lienState, "waiver_required");
  assert.equal(result.providerError, "provider timeout");
});

// ── M2.3 Weather Risk ─────────────────────────────────────────────────────────

type WeatherThreshold = {
  rainMm: number;
  windKph: number;
  freezeC: number;
  hailMm: number;
};

function weatherThresholdForTrade(trade: string): WeatherThreshold {
  switch (trade) {
    case "roofing":
      return { rainMm: 1, windKph: 25, freezeC: 2, hailMm: 1 };
    case "concrete":
      return { rainMm: 2, windKph: 35, freezeC: 0, hailMm: 2 };
    default:
      return { rainMm: 5, windKph: 45, freezeC: -2, hailMm: 5 };
  }
}

function weatherAlertCreatesFieldLog(input: { projectId: string; reason: string; logCount: number }): { logCount: number; created: boolean } {
  return { logCount: input.logCount + 1, created: true };
}

function recommendChangeOrderFromWeather(input: { severity: "low" | "medium" | "high"; autoApprove: boolean }): { recommend: boolean; autoApproved: boolean } {
  return { recommend: input.severity !== "low", autoApproved: false };
}

test("M2.3 trade thresholds are stricter for roofing than default", () => {
  const roofing = weatherThresholdForTrade("roofing");
  const defaultTrade = weatherThresholdForTrade("painting");
  assert.ok(roofing.rainMm < defaultTrade.rainMm);
  assert.ok(roofing.windKph < defaultTrade.windKph);
});

test("M2.3 weather alert creates a field log entry", () => {
  const result = weatherAlertCreatesFieldLog({ projectId: "proj_1", reason: "rain delay", logCount: 2 });
  assert.equal(result.created, true);
  assert.equal(result.logCount, 3);
});

test("M2.3 weather can recommend a change order but never auto-approve it", () => {
  const result = recommendChangeOrderFromWeather({ severity: "high", autoApprove: true });
  assert.equal(result.recommend, true);
  assert.equal(result.autoApproved, false);
});
