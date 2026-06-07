import assert from "node:assert/strict";
import test from "node:test";

import { calculateKitchenRemodel } from "../dist/index.js";

test("kitchen rejects invalid enum and non-finite inputs without corrupting costs", () => {
  const result = calculateKitchenRemodel({
    scope: "bad-scope",
    kitchenSize: "bad-size",
    appliances: "bad-appliances",
    materialQuality: "bad-quality",
    plumbingElectrical: "bad-trades",
    cabinetLinearFt: Number.POSITIVE_INFINITY,
    clientProvidesMaterials: false,
    mode: "bad-mode",
  } as Parameters<typeof calculateKitchenRemodel>[0]);

  assert.equal(result.isValid, false);
  assert.ok(result.validationIssues.some((issue) => issue.field === "scope"));
  assert.ok(result.validationIssues.some((issue) => issue.field === "kitchenSize"));
  assert.ok(result.validationIssues.some((issue) => issue.field === "materialQuality"));
  assert.ok(result.validationIssues.some((issue) => issue.field === "cabinetLinearFt"));
  assert.ok(Number.isFinite(result.costs.total));
  assert.ok(Number.isFinite(result.labor.totalCost));
  assert.ok(result.materials.every((item) => Number.isFinite(item.totalCost)));
});
