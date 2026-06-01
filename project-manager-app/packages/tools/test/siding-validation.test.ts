import assert from "node:assert/strict";
import test from "node:test";

import { calculateSiding } from "../dist/index.js";

test("siding rejects invalid enum and non-finite inputs without corrupting costs", () => {
  const result = calculateSiding({
    wallSqFt: Number.NaN,
    stories: 9,
    sidingType: "bad-siding",
    removeOldSiding: true,
    windowCount: Number.POSITIVE_INFINITY,
    doorCount: Number.NaN,
    corners: Number.NEGATIVE_INFINITY,
    visibleWaterDamage: true,
    houseWrapIncluded: true,
    flashingCondition: "bad-flashing",
    soffitFasciaIncluded: true,
    clientProvidesMaterials: false,
    mode: "bad-mode",
  } as Parameters<typeof calculateSiding>[0]);

  assert.equal(result.isValid, false);
  assert.ok(result.validationIssues.some((issue) => issue.field === "sidingType"));
  assert.ok(result.validationIssues.some((issue) => issue.field === "stories"));
  assert.ok(result.validationIssues.some((issue) => issue.field === "flashingCondition"));
  assert.ok(result.validationIssues.some((issue) => issue.field === "wallSqFt"));
  assert.ok(Number.isFinite(result.costs.total));
  assert.ok(Number.isFinite(result.labor.totalCost));
  assert.ok(result.materials.every((item) => Number.isFinite(item.totalCost)));
});
