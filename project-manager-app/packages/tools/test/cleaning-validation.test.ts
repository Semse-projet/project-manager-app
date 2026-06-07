import assert from "node:assert/strict";
import test from "node:test";

import { calculateCleaning } from "../dist/index.js";

test("cleaning rejects invalid enums and non-finite inputs without corrupting costs", () => {
  const result = calculateCleaning({
    serviceType: "bad-service",
    squareFt: Number.NaN,
    bedrooms: Number.POSITIVE_INFINITY,
    bathrooms: Number.NEGATIVE_INFINITY,
    condition: "bad-condition",
    addOns: ["windows", "bad-addon"],
    frequency: "bad-frequency",
    suppliesIncluded: true,
    mode: "bad-mode",
  } as Parameters<typeof calculateCleaning>[0]);

  assert.equal(result.isValid, false);
  assert.ok(result.validationIssues.some((issue) => issue.field === "serviceType"));
  assert.ok(result.validationIssues.some((issue) => issue.field === "squareFt"));
  assert.ok(result.validationIssues.some((issue) => issue.field === "bedrooms"));
  assert.ok(result.validationIssues.some((issue) => issue.field === "bathrooms"));
  assert.ok(result.validationIssues.some((issue) => issue.field === "addOns.1"));
  assert.ok(Number.isFinite(result.costs.total));
  assert.ok(Number.isFinite(result.labor.totalCost));
  assert.ok(result.materials.every((item) => Number.isFinite(item.totalCost)));
});
