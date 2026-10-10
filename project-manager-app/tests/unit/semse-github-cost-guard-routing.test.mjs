// Regression checks for the SEMSE GitHub Cost Guard skill and Spanish
// billing classification. Exercise the live skill directory / real router.
import { test } from "node:test";
import assert from "node:assert/strict";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { discoverSkills } from "../../scripts/skill-router/lib/discover.mjs";
import { buildRegistry } from "../../scripts/skill-router/lib/registry.mjs";
import { classifyTask } from "../../scripts/skill-router/lib/classify.mjs";
import { route } from "../../scripts/skill-router/lib/router.mjs";

const root = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const registry = buildRegistry(discoverSkills([join(root, ".claude", "skills")]));
const guardId = "semse-github-operations-cost-guard";

test("GitHub Cost Guard is installed, scoped, and has parseable routing metadata", () => {
  const guard = registry.skills.find((skill) => skill.id === guardId);
  assert.ok(guard, "GitHub Cost Guard must be discovered in the actual skill directory");
  assert.equal(guard.hasRoutingMetadata, true);
  assert.equal(guard.routing.status, "active");
  assert.equal(guard.routing.category, "domain");
  assert.deepEqual(guard.routing.phases, [], "phase-only matches must not hijack unrelated tasks");
  assert.ok(guard.routing.precedence.subordinate_to.includes("semseproject"));
  assert.ok(!registry.warnings.some((w) => w.code === "INVALID_METADATA" && w.message.includes(guardId)));
});

for (const task of [
  "Investiga el presupuesto GitHub Actions agotado; CI no arranca",
  "Revisa la facturación de GitHub porque la tarjeta fue rechazada",
  "Analiza los costos de Code Quality de GitHub",
  "Diagnostica startup_failure en GitHub Actions para el PR",
]) {
  test(`GitHub costs route to Cost Guard + SEMSE governance: ${task}`, () => {
    const d = route(task, registry);
    assert.equal(d.primary, guardId, `wrong primary for: ${task}`);
    assert.ok(d.governance.includes("semseproject"), `missing approval policy for: ${task}`);
  });
}

test("unrelated CI troubleshooting does not select the billing skill", () => {
  const d = route("Fix the pull request CI TypeScript compilation failure and rerun E2E tests", registry);
  assert.notEqual(d.primary, guardId);
  assert.ok(!d.supporting.includes(guardId));
});

test("customer escrow and debt are financial but not GitHub Operations", () => {
  const d = route("Resolver cobros de clientes de SEMSE y escrow de trabajos", registry);
  assert.ok(d.governance.includes("semseproject"));
  assert.notEqual(d.primary, guardId);
  assert.ok(!d.supporting.includes(guardId));
});

test("Spanish finance keywords trigger policy, but an unrelated color fix does not", () => {
  for (const task of ["Revisar facturación", "Subir el presupuesto", "Examinar la tarjeta rechazada", "Auditar costos"]) {
    assert.equal(classifyTask(task).needsSemseproject, true, task);
  }
  assert.equal(classifyTask("Arreglar el color del botón en CSS").needsSemseproject, false);
});
