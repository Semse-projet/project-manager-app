import assert from "node:assert/strict";
import test from "node:test";

import { calculateBathroomRemodel } from "../dist/index.js";

test("bathroom rejects invalid enums without corrupting costs", () => {
  const result = calculateBathroomRemodel({
    scope: "bad-scope",
    bathroomSqFt: "bad-size",
    plumbingWork: "bad-plumbing",
    materialQuality: "bad-quality",
    includesShower: true,
    includesTub: true,
    demoRequired: true,
    clientProvidesMaterials: false,
    mode: "bad-mode",
  } as Parameters<typeof calculateBathroomRemodel>[0]);

  assert.equal(result.isValid, false);
  assert.ok(result.validationIssues.some((issue) => issue.field === "scope"));
  assert.ok(result.validationIssues.some((issue) => issue.field === "bathroomSqFt"));
  assert.ok(result.validationIssues.some((issue) => issue.field === "plumbingWork"));
  assert.ok(result.validationIssues.some((issue) => issue.field === "materialQuality"));
  assert.ok(Number.isFinite(result.costs.total));
  assert.ok(Number.isFinite(result.labor.totalCost));
  assert.ok(result.materials.every((item) => Number.isFinite(item.totalCost)));
});
