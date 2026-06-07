import assert from "node:assert/strict";
import test from "node:test";

import { calculateDeck } from "../dist/index.js";

test("deck rejects invalid enums and non-finite inputs without corrupting costs", () => {
  const result = calculateDeck({
    deckLengthFt: Number.POSITIVE_INFINITY,
    deckWidthFt: Number.NaN,
    materialType: "bad-material",
    joistSpacingIn: 18,
    postCount: Number.NEGATIVE_INFINITY,
    railingLinearFt: Number.POSITIVE_INFINITY,
    stairsCount: Number.NaN,
    demoExisting: true,
    stainSeal: true,
    pergola: true,
    attachedToHouse: true,
    mode: "bad-mode",
  } as Parameters<typeof calculateDeck>[0]);

  assert.equal(result.isValid, false);
  assert.ok(result.validationIssues.some((issue) => issue.field === "materialType"));
  assert.ok(result.validationIssues.some((issue) => issue.field === "joistSpacingIn"));
  assert.ok(result.validationIssues.some((issue) => issue.field === "deckLengthFt"));
  assert.ok(result.validationIssues.some((issue) => issue.field === "deckWidthFt"));
  assert.ok(result.validationIssues.some((issue) => issue.field === "postCount"));
  assert.ok(Number.isFinite(result.costs.total));
  assert.ok(Number.isFinite(result.labor.totalCost));
  assert.ok(result.materials.every((item) => Number.isFinite(item.totalCost)));
});
