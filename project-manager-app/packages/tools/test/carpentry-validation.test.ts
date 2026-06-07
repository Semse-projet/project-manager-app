import assert from "node:assert/strict";
import test from "node:test";

import { calculateCarpentry } from "../dist/index.js";

test("carpentry rejects invalid enums and non-finite inputs without corrupting costs", () => {
  const result = calculateCarpentry({
    projectType: "bad-project",
    material: "bad-material",
    lengthIn: Number.POSITIVE_INFINITY,
    widthIn: Number.NaN,
    thicknessIn: Number.NEGATIVE_INFINITY,
    quantity: Number.NaN,
    finishType: "bad-finish",
    complexity: "bad-complexity",
    hardwareCount: Number.POSITIVE_INFINITY,
    paintedCabinets: true,
    softClose: true,
    mode: "bad-mode",
  } as Parameters<typeof calculateCarpentry>[0]);

  assert.equal(result.isValid, false);
  assert.ok(result.validationIssues.some((issue) => issue.field === "projectType"));
  assert.ok(result.validationIssues.some((issue) => issue.field === "material"));
  assert.ok(result.validationIssues.some((issue) => issue.field === "lengthIn"));
  assert.ok(result.validationIssues.some((issue) => issue.field === "widthIn"));
  assert.ok(result.validationIssues.some((issue) => issue.field === "hardwareCount"));
  assert.ok(Number.isFinite(result.costs.total));
  assert.ok(Number.isFinite(result.labor.totalCost));
  assert.ok(result.materials.every((item) => Number.isFinite(item.totalCost)));
});
