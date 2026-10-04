import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync, mkdtempSync, mkdirSync, writeFileSync, copyFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { analyzeAuditCoverage } from "../../scripts/audit-plan-spec-coverage.mjs";
import { findSpecFiles, readSpec } from "../../scripts/spec-lib.mjs";

const plan = "- **3.12 TEST**\n- **3.13 TEST**\n- **3.14 TEST**\n";
const known = new Set(["ui.admin", "api.trust"]);
const header = "## 6. Routing canónico — Admin\n\n| Ítems | Spec primaria | Routing |\n|---|---|---|\n";
const row = "| `3.12`–`3.14` | `ui.admin` | CLOSED / regresión |\n";
const exception = "\nExcepciones con contrato adicional obligatorio:\n\n- `3.13`: `api.trust`.\n";
const analyze = (map, inputPlan = plan) => analyzeAuditCoverage(inputPlan, map, known);

function passes(result) {
  assert.deepEqual(result.missing, []);
  assert.deepEqual(result.extra, []);
  assert.deepEqual(result.errors, []);
}

test("primary ranges establish coverage and exceptions supplement them", () => {
  passes(analyze(header + row + exception));
});

test("an exception and prose cannot replace the removed primary route", () => {
  const result = analyze(header + row.replace("`3.12`–`3.14`", "`3.12`, `3.14`") + exception + "\nSummary: `3.13` is covered.\n");
  assert.deepEqual(result.missing, ["3.13"]);
  assert.ok(result.errors.includes("Exception 3.13 has no primary route"));
});

test("unknown findings and specs fail closed, including exception contracts", () => {
  const result = analyze(header + row + "| `3.15` | `missing.contract` | CLOSED |\n" + exception.replace("api.trust", "missing.exception"));
  assert.deepEqual(result.extra, ["3.15"]);
  assert.ok(result.errors.some((error) => error.includes("unknown spec missing.contract")));
  assert.ok(result.errors.some((error) => error.includes("unknown spec missing.exception")));
});

for (const range of ["`3.14`–`3.12`", "`3.12`–`2.14`", "`3.12b`–`3.14b`"]) {
  test(`invalid range fails: ${range}`, () => {
    assert.ok(analyze(header + row.replace("`3.12`–`3.14`", range)).errors.some((error) => error.includes("invalid range")));
  });
}

test("duplicate primary routes fail even with complete coverage", () => {
  assert.ok(analyze(header + row + "| `3.13` | `api.trust` | CLOSED |\n").errors.some((error) => error.includes("duplicate primary route for 3.13")));
});

test("a primary row must declare a real contract and routing state", () => {
  const result = analyze(header + row.replace("`ui.admin`", "unspecified").replace("CLOSED / regresión", "VERIFIED"));
  assert.ok(result.errors.some((error) => error.includes("no explicit spec contract")));
  assert.ok(result.errors.some((error) => error.includes("invalid routing state")));
});

test("empty plans cannot produce a green coverage result", () => {
  assert.ok(analyze(header, "").errors.includes("No finding IDs found in the audit plan"));
});

test("current routing isolates Field Ops and preserves closed design findings", () => {
  const map = readFileSync("docs/specs/governance/audit-remediation-program.spec.md", "utf8");
  const inputPlan = readFileSync("docs/AUDIT_REMEDIATION_PLAN.md", "utf8");
  const result = analyzeAuditCoverage(inputPlan, map, new Set(findSpecFiles().map((file) => readSpec(file).metadata.id)));
  passes(result);
  assert.deepEqual(result.routes.get("2.49").specs, ["api-field-ops"]);
  assert.equal(result.routes.get("1.17").state, "CLOSED");
  assert.equal(result.routes.get("1.19").state, "CLOSED");
  assert.equal(result.routes.get("1.15").state, "REVIEW_REQUIRED");
  assert.equal(result.routes.get("1.16").state, "REVIEW_REQUIRED");
  // A finding added to the plan without routing must fail the gate. The ID is derived from
  // the plan (one past the highest section-3 item) so it can never collide with a real finding
  // that gets routed later; an ID above the plan's maximum cannot be mapped without becoming
  // an "extra", so it is always unrouted.
  const highest = Math.max(...[...result.planIds].filter((id) => id.startsWith("3.")).map((id) => Number.parseInt(id.split(".")[1], 10)));
  const newId = `3.${highest + 1}`;
  const next = analyzeAuditCoverage(inputPlan + `\n- **${newId} NEW**\n`, map, new Set(findSpecFiles().map((file) => readSpec(file).metadata.id)));
  assert.deepEqual(next.missing, [newId]);
});

test("CLI returns nonzero for orphan exceptions while valid routing exits zero", (t) => {
  const root = mkdtempSync(path.join(tmpdir(), "semse-audit-coverage-"));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  mkdirSync(path.join(root, "scripts"));
  mkdirSync(path.join(root, "docs/specs/governance"), { recursive: true });
  for (const file of ["audit-plan-spec-coverage.mjs", "spec-lib.mjs"]) copyFileSync(`scripts/${file}`, path.join(root, "scripts", file));
  for (const id of known) writeFileSync(path.join(root, `docs/specs/${id}.spec.md`), `---\nid: "${id}"\n---\n`);
  writeFileSync(path.join(root, "docs/AUDIT_REMEDIATION_PLAN.md"), plan);
  const mapPath = path.join(root, "docs/specs/governance/audit-remediation-program.spec.md");
  writeFileSync(mapPath, header + row + exception);
  const run = () => spawnSync(process.execPath, ["scripts/audit-plan-spec-coverage.mjs"], { cwd: root, encoding: "utf8" });
  assert.equal(run().status, 0);
  writeFileSync(mapPath, header + row.replace("`3.12`–`3.14`", "`3.12`, `3.14`") + exception);
  const failure = run();
  assert.equal(failure.status, 1);
  assert.match(failure.stdout, /Missing IDs: 3.13/);
  assert.match(failure.stderr, /Exception 3.13 has no primary route/);
});
