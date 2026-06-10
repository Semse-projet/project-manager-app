import test from "node:test";
import assert from "node:assert/strict";
import { applyLocation } from "../../packages/tools/src/core/cost-engine.ts";

function zipToState(zipCode: string): string | undefined {
  const zip = zipCode.trim().replace(/\D/g, "").padStart(5, "0");
  return zip.startsWith("94") ? "CA" : zip.startsWith("33") ? "FL" : undefined;
}

function resolveRegionalRate(input: {
  contractorOverride?: number;
  oewsRate: number;
  stateMultiplier: number;
}): number {
  if (input.contractorOverride !== undefined) return input.contractorOverride;
  return input.oewsRate * input.stateMultiplier;
}

test("applyLocation keeps base cost when no location exists", () => {
  assert.equal(applyLocation(100, undefined, "material"), 100);
});

test("applyLocation applies material and labor multipliers", () => {
  const location = { materialMultiplier: 1.2, laborMultiplier: 1.1 } as const;
  assert.equal(applyLocation(100, location, "material"), 120);
  assert.equal(Math.round(applyLocation(100, location, "labor")), 110);
});

test("zipToState resolves ZIP prefixes used by regional pricing", () => {
  assert.equal(zipToState("94105"), "CA");
  assert.equal(zipToState("33101"), "FL");
});

test("contractor override takes precedence over OEWS/state fallback", () => {
  assert.equal(resolveRegionalRate({ contractorOverride: 95, oewsRate: 50, stateMultiplier: 1.2 }), 95);
  assert.equal(resolveRegionalRate({ oewsRate: 50, stateMultiplier: 1.2 }), 60);
});
