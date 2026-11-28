// Regresión del incidente 9e2f87f1 (2026-11-26): el CI de main no puede
// compartir un grupo de concurrencia por rama, porque GitHub cancela el run
// pendiente anterior aunque cancel-in-progress sea false.
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const ciPath = fileURLToPath(new URL("../../../.github/workflows/ci.yml", import.meta.url));
const ci = readFileSync(ciPath, "utf8");

function concurrencyBlock(src) {
  const m = src.match(/^concurrency:\n((?:[ ]{2}.*\n)+)/m);
  assert.ok(m, "ci.yml debe declarar concurrency a nivel de workflow");
  return m[1];
}

test("los push a main usan un grupo por SHA, no por rama", () => {
  const block = concurrencyBlock(ci);
  const group = block.match(/group:\s*(.+)/)[1];
  assert.match(group, /github\.sha/, "el grupo debe incluir github.sha para push/dispatch");
  assert.doesNotMatch(group, /\|\|\s*github\.ref\s*}}/, "no debe caer en github.ref para main");
});

test("cancel-in-progress solo aplica a pull_request", () => {
  const block = concurrencyBlock(ci);
  assert.match(block, /cancel-in-progress:\s*\$\{\{\s*github\.event_name == 'pull_request'\s*}}/);
});
