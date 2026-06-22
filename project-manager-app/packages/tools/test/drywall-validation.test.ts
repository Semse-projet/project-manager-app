import assert from "node:assert/strict";
import test from "node:test";

import { calculateDrywall } from "../dist/index.js";

test("drywall rejects invalid enum and non-finite inputs without corrupting costs", () => {
  const result = calculateDrywall({
    wallAreaSqft: Number.NaN,
    ceilingAreaSqft: Number.POSITIVE_INFINITY,
    panelType: "bad-panel",
    panelSize: "bad-size",
    finishLevel: Number.NaN,
    includeCeiling: true,
    repairMode: true,
    textureMatch: true,
    mode: "bad-mode",
  } as Parameters<typeof calculateDrywall>[0]);

  assert.equal(result.isValid, false);
  assert.ok(result.validationIssues.some((issue) => issue.field === "panelType"));
  assert.ok(result.validationIssues.some((issue) => issue.field === "panelSize"));
  assert.ok(result.validationIssues.some((issue) => issue.field === "finishLevel"));
  assert.ok(result.validationIssues.some((issue) => issue.field === "wallAreaSqft"));
  assert.ok(Number.isFinite(result.costs.total));
  assert.ok(Number.isFinite(result.labor.totalCost));
  assert.ok(result.materials.every((item) => Number.isFinite(item.totalCost)));
});
