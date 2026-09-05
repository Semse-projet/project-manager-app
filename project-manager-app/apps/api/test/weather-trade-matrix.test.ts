import test from "node:test";
import assert from "node:assert/strict";
import { classifyForecastEntry, classifyTradeImpact } from "../dist/modules/weather/weather-trade-matrix.js";

function entry(overrides: Partial<{ temperature: number; precipitation: number; precipitationType: string; windSpeed: number }> = {}) {
  return {
    temperature: 20,
    precipitation: 0,
    precipitationType: "none",
    windSpeed: 5,
    uvIndex: 3,
    weatherCode: "clear",
    timestamp: "2026-06-22T14:00:00.000Z",
    ...overrides,
  };
}

test("classifyForecastEntry returns no events for a clear, mild interval", () => {
  assert.deepEqual(classifyForecastEntry(entry() as never), []);
});

test("classifyForecastEntry detects RAIN only when precipitationType is rain and precipitation > 0", () => {
  const events = classifyForecastEntry(entry({ precipitation: 5, precipitationType: "rain" }) as never);
  assert.deepEqual(events, [{ eventType: "RAIN", severity: "MODERATE" }]);
});

test("classifyForecastEntry does not classify RAIN when precipitationType is snow", () => {
  const events = classifyForecastEntry(entry({ precipitation: 2, precipitationType: "snow" }) as never);
  assert.deepEqual(events, [{ eventType: "SNOW", severity: "MODERATE" }]);
});

test("classifyForecastEntry marks heavy rain as HIGH severity", () => {
  const events = classifyForecastEntry(entry({ precipitation: 15, precipitationType: "rain" }) as never);
  assert.deepEqual(events, [{ eventType: "RAIN", severity: "HIGH" }]);
});

test("classifyForecastEntry detects FROST at or below 0C, HIGH below -5C", () => {
  assert.deepEqual(classifyForecastEntry(entry({ temperature: 0 }) as never), [{ eventType: "FROST", severity: "MODERATE" }]);
  assert.deepEqual(classifyForecastEntry(entry({ temperature: -6 }) as never), [{ eventType: "FROST", severity: "HIGH" }]);
});

test("classifyForecastEntry detects HEAT at or above 35C, HIGH above 40C", () => {
  assert.deepEqual(classifyForecastEntry(entry({ temperature: 35 }) as never), [{ eventType: "HEAT", severity: "MODERATE" }]);
  assert.deepEqual(classifyForecastEntry(entry({ temperature: 41 }) as never), [{ eventType: "HEAT", severity: "HIGH" }]);
});

test("classifyForecastEntry detects WIND at or above 32km/h", () => {
  assert.deepEqual(classifyForecastEntry(entry({ windSpeed: 32 }) as never), [{ eventType: "WIND", severity: "MODERATE" }]);
});

test("classifyForecastEntry returns multiple concurrent events (windy rainstorm)", () => {
  const events = classifyForecastEntry(entry({ windSpeed: 40, precipitation: 20, precipitationType: "rain" }) as never);
  assert.equal(events.length, 2);
  assert.ok(events.some((e: { eventType: string }) => e.eventType === "WIND"));
  assert.ok(events.some((e: { eventType: string }) => e.eventType === "RAIN"));
});

test("classifyForecastEntry does not classify freezing_rain or ice_pellets into any eventType (documented gap, HAIL excluded)", () => {
  assert.deepEqual(classifyForecastEntry(entry({ precipitation: 5, precipitationType: "freezing_rain" }) as never), []);
  assert.deepEqual(classifyForecastEntry(entry({ precipitation: 5, precipitationType: "ice_pellets" }) as never), []);
});

test("classifyTradeImpact(RAIN) matches the spec's Trade-Weather Impact Matrix", () => {
  const { affectedTrades, notCriticalFor } = classifyTradeImpact("RAIN");
  assert.deepEqual(affectedTrades.sort(), ["concrete", "framing", "roofing", "siding"].sort());
  assert.deepEqual(notCriticalFor, []);
});

test("classifyTradeImpact(FROST) marks framing/siding SAFE, roofing/concrete CRITICAL", () => {
  const { affectedTrades, notCriticalFor } = classifyTradeImpact("FROST");
  assert.deepEqual(affectedTrades.sort(), ["concrete", "roofing"].sort());
  assert.deepEqual(notCriticalFor.sort(), ["framing", "siding"].sort());
});

test("classifyTradeImpact(WIND) marks concrete SAFE, everything else affected", () => {
  const { affectedTrades, notCriticalFor } = classifyTradeImpact("WIND");
  assert.deepEqual(affectedTrades.sort(), ["framing", "roofing", "siding"].sort());
  assert.deepEqual(notCriticalFor, ["concrete"]);
});

test("classifyTradeImpact(HEAT) marks only concrete as non-SAFE (PARTIAL)", () => {
  const { affectedTrades, notCriticalFor } = classifyTradeImpact("HEAT");
  assert.deepEqual(affectedTrades, ["concrete"]);
  assert.deepEqual(notCriticalFor.sort(), ["framing", "roofing", "siding"].sort());
});
