import assert from "node:assert/strict";
import test from "node:test";

import { calculatePlumbing } from "../dist/index.js";

test("plumbing rejects invalid enum and non-finite inputs without corrupting costs", () => {
  const result = calculatePlumbing({
    scope: "bad-scope",
    fixtureCount: Number.NaN,
    pipeType: "bad-pipe",
    supplyLineFeet: Number.POSITIVE_INFINITY,
    drainLineFeet: Number.NaN,
    waterHeaterReplace: true,
    waterHeaterType: "bad-heater",
    waterHeaterGallons: Number.NaN,
    slabAccess: true,
    crawlspaceAccess: false,
    gasWork: false,
    outdoorWork: false,
    backflowPreventer: false,
    existingPipeCondition: "bad-condition",
    mode: "bad-mode",
  } as Parameters<typeof calculatePlumbing>[0]);

  assert.equal(result.isValid, false);
  assert.ok(result.validationIssues.some((issue) => issue.field === "scope"));
  assert.ok(result.validationIssues.some((issue) => issue.field === "pipeType"));
  assert.ok(result.validationIssues.some((issue) => issue.field === "fixtureCount"));
  assert.ok(Number.isFinite(result.costs.total));
  assert.ok(Number.isFinite(result.labor.totalCost));
  assert.ok(result.materials.every((item) => Number.isFinite(item.totalCost)));
});
