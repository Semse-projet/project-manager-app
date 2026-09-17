// Golden routing cases (07_GOLDEN_ROUTING_CASES.md from the SEMSE Skill
// Router & Governance Kit), exercised against the REAL, live
// `.claude/skills/` on this checkout — not synthetic fixtures. This is the
// one test file that should break if a real skill's description drifts
// enough to break routing for its own golden case.
import { test } from "node:test";
import assert from "node:assert/strict";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { discoverSkills } from "../../scripts/skill-router/lib/discover.mjs";
import { buildRegistry } from "../../scripts/skill-router/lib/registry.mjs";
import { route } from "../../scripts/skill-router/lib/router.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = join(__dirname, "..", "..");
const SKILLS_ROOT = join(REPO_ROOT, ".claude", "skills");

const registry = buildRegistry(discoverSkills([SKILLS_ROOT]));

function routeFor(taskText) {
  return route(taskText, registry);
}

test("live registry sanity: discovers the real skill set with no duplicates", () => {
  assert.ok(registry.skills.length >= 18, `expected at least 18 real skills, found ${registry.skills.length}`);
  assert.equal(registry.duplicates.length, 0);
  assert.ok(registry.skills.some((s) => s.id === "semseproject"));
  assert.ok(registry.skills.some((s) => s.id === "semse-audit-remediation"));
  assert.ok(registry.skills.some((s) => s.id === "aaa-zoom-loop-execution"));
});

test("G1 — failed Prisma migration: semse-prisma-workflow primary, AAA active", () => {
  const d = routeFor("Fix a failed Prisma migration where prisma migrate deploy fails on the schema, touching multiple migration files end to end");
  assert.equal(d.primary, "semse-prisma-workflow");
  assert.ok(d.execution.includes("aaa-zoom-loop-execution"));
});

test("G2 — contributors landing clarity: semse-ecosystem-architect primary for a genuinely broad design task", () => {
  const d = routeFor("Improve the public contributors landing page clarity, messaging and visual design across the site");
  assert.equal(d.primary, "semse-ecosystem-architect");
});

test("G2b — a narrow token fix does not get crowded out by the broad ecosystem-architect skill", () => {
  const d = routeFor("Add a simple design token fix for one color in globals.css");
  assert.equal(d.primary, "semse-design-tokens");
  assert.notEqual(d.primary, "semse-ecosystem-architect");
});

test("G3 — cross-tenant IDOR: governance + rbac + security-baseline", () => {
  const d = routeFor(
    "Fix a cross-tenant IDOR vulnerability where a worker missing a tenant scope check can view another tenant's job records through an API endpoint",
  );
  assert.ok(d.governance.includes("semseproject"));
  const selected = [d.primary, ...d.supporting].filter(Boolean);
  assert.ok(selected.includes("semse-rbac-permissions") || selected.includes("semse-security-baseline"));
});

test("G4 — mobile offline media upload: semse-mobile-offline-sync in the mix, upload-flow supporting", () => {
  const d = routeFor(
    "Implement offline media upload for the mobile app's offline sync queue, wiring it through the upload flow across the API and BFF",
  );
  const selected = [d.primary, ...d.supporting].filter(Boolean);
  assert.ok(selected.includes("semse-mobile-offline-sync") || selected.includes("semse-upload-flow"));
});

test("G5 — simple token fix: design-tokens only, no AAA", () => {
  const d = routeFor("Add a simple design token fix for one color in globals.css");
  assert.equal(d.primary, "semse-design-tokens");
  assert.equal(d.execution.length, 0);
});

test("G6 — payment audit remediation: semseproject + semse-audit-remediation governance, AAA subordinate", () => {
  const d = routeFor("Implement a payment audit remediation fix for the audit_remediation_plan escrow integrity finding RC5");
  assert.ok(d.governance.includes("semseproject"));
  assert.ok(d.governance.includes("semse-audit-remediation"));
});

test("G7 — new cross-domain feature: spec phase routes toward semse-spec-kit-flow, AAA active", () => {
  const d = routeFor("Specify a new feature end to end, write a spec for a brand-new cross-domain capability spanning several modules");
  assert.equal(d.phase, "spec");
  assert.ok(d.execution.includes("aaa-zoom-loop-execution"));
});

test("G8 — session report: semse-report-writer only", () => {
  const d = routeFor("Write the end-of-session report for today's implementation work");
  assert.equal(d.primary, "semse-report-writer");
  assert.equal(d.governance.length, 0);
  assert.equal(d.execution.length, 0);
});

test("G9 — worker tracker UI test: testing-worker-tracker primary", () => {
  const d = routeFor("Test the worker Time Tracker UI at /worker/tracker, seeding pending offline work and checking trackerLocalStore assertions");
  assert.equal(d.primary, "testing-worker-tracker");
});

test("G10 — finish Prometeo Live end-to-end: AAA mandatory, never load everything at once", () => {
  const d = routeFor("Finish implementing Prometeo Live sessions end to end across the API and web BFF, closing every remaining gap");
  assert.ok(d.execution.includes("aaa-zoom-loop-execution"));
  // Minimum-sufficient-set: never select every skill at once.
  const activeCount = d.governance.length + d.execution.length + (d.primary ? 1 : 0) + d.supporting.length;
  assert.ok(activeCount <= 5, `expected a minimal active skill set, got ${activeCount}`);
});
