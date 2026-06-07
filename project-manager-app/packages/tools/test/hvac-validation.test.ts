import assert from "node:assert/strict";
import test from "node:test";

import { calculateHvac } from "../dist/index.js";

test("hvac rejects invalid enum and non-finite inputs without corrupting costs", () => {
  const result = calculateHvac({
    tonnage: Number.NaN,
    systemType: "bad-system",
    seerRating: Number.POSITIVE_INFINITY,
    ductworkScope: "bad-duct",
    ductRunFeet: Number.NaN,
    zoneCount: Number.POSITIVE_INFINITY,
    atticInstall: true,
    crawlspaceInstall: false,
    existingEquipmentAge: Number.NEGATIVE_INFINITY,
    refrigerantType: "bad-refrigerant",
    thermostatUpgrade: true,
    airQualityUpgrade: true,
    mode: "bad-mode",
  } as Parameters<typeof calculateHvac>[0]);

  assert.equal(result.isValid, false);
  assert.ok(result.validationIssues.some((issue) => issue.field === "systemType"));
  assert.ok(result.validationIssues.some((issue) => issue.field === "ductworkScope"));
  assert.ok(result.validationIssues.some((issue) => issue.field === "refrigerantType"));
  assert.ok(result.validationIssues.some((issue) => issue.field === "tonnage"));
  assert.ok(Number.isFinite(result.costs.total));
  assert.ok(Number.isFinite(result.labor.totalCost));
  assert.ok(result.materials.every((item) => Number.isFinite(item.totalCost)));
});
