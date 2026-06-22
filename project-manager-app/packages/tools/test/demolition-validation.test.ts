import assert from "node:assert/strict";
import test from "node:test";

import { calculateDemolition } from "../dist/index.js";

test("demolition rejects invalid enums and non-finite inputs without corrupting costs", () => {
  const result = calculateDemolition({
    areaSqft: Number.POSITIVE_INFINITY,
    demolitionType: "bad-demo",
    difficulty: "bad-difficulty",
    hazardousMaterialSuspected: true,
    utilitiesPresent: true,
    structuralElementsPresent: true,
    asbestosTestRequired: false,
    crewSize: Number.NaN,
    mode: "bad-mode",
  } as Parameters<typeof calculateDemolition>[0]);

  assert.equal(result.isValid, false);
  assert.ok(result.validationIssues.some((issue) => issue.field === "areaSqft"));
  assert.ok(result.validationIssues.some((issue) => issue.field === "demolitionType"));
  assert.ok(result.validationIssues.some((issue) => issue.field === "difficulty"));
  assert.ok(result.validationIssues.some((issue) => issue.field === "crewSize"));
  assert.ok(Number.isFinite(result.costs.total));
  assert.ok(Number.isFinite(result.labor.totalCost));
  assert.ok(result.materials.every((item) => Number.isFinite(item.totalCost)));
});
