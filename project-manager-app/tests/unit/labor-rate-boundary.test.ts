import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";

const controllerSource = readFileSync(
  "apps/api/src/modules/labor-engine/labor-engine.controller.ts",
  "utf8",
);
const adminSource = readFileSync(
  "apps/web/app/(app)/admin/labor-engine/page.tsx",
  "utf8",
);
const recordsSource = readFileSync(
  "apps/web/app/(app)/worker/tracker/sections/RegistrosTab.tsx",
  "utf8",
);

test("manual Labor Engine boundary never extracts client rate or currency", () => {
  const manualHandler = controllerSource.slice(
    controllerSource.indexOf("async createManual("),
    controllerSource.indexOf('@Get("entries")'),
  );

  assert.doesNotMatch(manualHandler, /body\["hourlyRate"\]/);
  assert.doesNotMatch(manualHandler, /body\["currency"\]/);
});

test("admin fallback never applies the current admin override to team costs", () => {
  const baselineBlock = adminSource.slice(
    adminSource.indexOf("const baselineRate"),
    adminSource.indexOf("const teamWithCost"),
  );

  assert.match(baselineBlock, /rates\.nationalBaselineHourlyRate/);
  assert.doesNotMatch(baselineBlock, /rates\.override/);
});

test("manual records UI does not offer client-controlled rate or currency inputs", () => {
  assert.doesNotMatch(recordsSource, /formRate|setFormRate|formCurrency|setFormCurrency/);
  assert.match(recordsSource, /tarifa base BLS en USD/);
});
