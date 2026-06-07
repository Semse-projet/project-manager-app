import assert from "node:assert/strict";
import test from "node:test";

import { calculateRoofing } from "../dist/index.js";

test("roofing rejects invalid enum and non-finite inputs without corrupting costs", () => {
  const result = calculateRoofing({
    roofAreaSqFt: Number.NaN,
    pitch: Number.POSITIVE_INFINITY,
    shingleType: "bad-shingle",
    removeOldRoof: true,
    layers: Number.NaN,
    underlayment: true,
    iceBarrier: true,
    vents: Number.POSITIVE_INFINITY,
    skylightCount: Number.NaN,
    flashingReplace: true,
    deckCondition: "bad-deck",
    guttersIncluded: true,
    warrantyYears: 99,
    mode: "bad-mode",
  } as Parameters<typeof calculateRoofing>[0]);

  assert.equal(result.isValid, false);
  assert.ok(result.validationIssues.some((issue) => issue.field === "shingleType"));
  assert.ok(result.validationIssues.some((issue) => issue.field === "deckCondition"));
  assert.ok(result.validationIssues.some((issue) => issue.field === "warrantyYears"));
  assert.ok(result.validationIssues.some((issue) => issue.field === "roofAreaSqFt"));
  assert.ok(Number.isFinite(result.costs.total));
  assert.ok(Number.isFinite(result.labor.totalCost));
  assert.ok(result.materials.every((item) => Number.isFinite(item.totalCost)));
});
