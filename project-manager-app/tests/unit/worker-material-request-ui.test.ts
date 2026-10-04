import assert from "node:assert/strict";
import test from "node:test";

import {
  MATERIAL_REQUEST_STATUS_META,
  parsePositiveMaterialQuantity,
} from "../../apps/web/lib/material-request-ui.ts";

test("material quantity accepts only finite values greater than zero", () => {
  assert.equal(parsePositiveMaterialQuantity("1"), 1);
  assert.equal(parsePositiveMaterialQuantity("0.25"), 0.25);
  assert.equal(parsePositiveMaterialQuantity(""), null);
  assert.equal(parsePositiveMaterialQuantity("   "), null);
  assert.equal(parsePositiveMaterialQuantity("0"), null);
  assert.equal(parsePositiveMaterialQuantity("-2"), null);
  assert.equal(parsePositiveMaterialQuantity("not-a-number"), null);
  assert.equal(parsePositiveMaterialQuantity("Infinity"), null);
});

test("rejected material requests use the error status treatment", () => {
  assert.deepEqual(MATERIAL_REQUEST_STATUS_META.rejected, {
    variant: "error",
    label: "Rechazado",
  });
});
