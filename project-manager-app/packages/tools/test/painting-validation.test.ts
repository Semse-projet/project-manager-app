import assert from "node:assert/strict";
import test from "node:test";

import { calculatePainting } from "../dist/index.js";

test("painting rejects invalid enum and non-finite inputs without corrupting costs", () => {
  const result = calculatePainting({
    roomLengthFt: Number.NaN,
    roomWidthFt: Number.POSITIVE_INFINITY,
    wallHeightFt: Number.NEGATIVE_INFINITY,
    doors: Number.NaN,
    windows: Number.POSITIVE_INFINITY,
    coats: Number.NaN,
    surfaceType: "bad-surface",
    includeCeiling: true,
    includePrimer: true,
    paintQuality: "bad-quality",
    mode: "bad-mode",
  } as Parameters<typeof calculatePainting>[0]);

  assert.equal(result.isValid, false);
  assert.ok(result.validationIssues.some((issue) => issue.field === "surfaceType"));
  assert.ok(result.validationIssues.some((issue) => issue.field === "paintQuality"));
  assert.ok(result.validationIssues.some((issue) => issue.field === "roomLengthFt"));
  assert.ok(Number.isFinite(result.costs.total));
  assert.ok(Number.isFinite(result.labor.totalCost));
  assert.ok(result.materials.every((item) => Number.isFinite(item.totalCost)));
});
