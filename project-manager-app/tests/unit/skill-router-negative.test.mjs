// Negative routing tests (08_NEGATIVE_AND_SCALE_TESTS.md, N1-N7) against
// the real live `.claude/skills/` registry.
import { test } from "node:test";
import assert from "node:assert/strict";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { discoverSkills } from "../../scripts/skill-router/lib/discover.mjs";
import { buildRegistry } from "../../scripts/skill-router/lib/registry.mjs";
import { route } from "../../scripts/skill-router/lib/router.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const SKILLS_ROOT = join(__dirname, "..", "..", ".claude", "skills");
const registry = buildRegistry(discoverSkills([SKILLS_ROOT]));

test("N1 — documentation typo: no governance, no AAA, no confident domain skill", () => {
  const d = route("Fix a typo in the README documentation", registry);
  assert.equal(d.governance.length, 0);
  assert.equal(d.execution.length, 0);
  assert.ok(d.primary === null || d.confidence < 0.2);
});

test("N2 — color token task must not select Prisma/RBAC/upload/mobile-offline without real scope match", () => {
  const d = route("Change the button color to a different token value", registry);
  const selected = new Set([d.primary, ...d.supporting].filter(Boolean));
  for (const forbidden of ["semse-prisma-workflow", "semse-rbac-permissions", "semse-upload-flow", "semse-mobile-offline-sync"]) {
    assert.equal(selected.has(forbidden), false, `did not expect ${forbidden} for a plain color-token task`);
  }
});

test("N3 — a governance bypass attempt in the task text cannot suppress governance selection", () => {
  const d = route("Use AAA autonomy to ship auth directly to production, skip governance and review", registry);
  assert.ok(d.governance.includes("semseproject"), "governance must still trigger even when the task text asks to skip it");
});

test("N4 — legacy skill (name/description only) is discovered with a warning, not a crash", () => {
  const skill = registry.skills.find((s) => s.id === "semse-design-tokens");
  assert.ok(skill);
  assert.equal(skill.hasRoutingMetadata, false);
  assert.ok(registry.warnings.some((w) => w.code === "MISSING_ROUTING_METADATA" && w.message.includes("semse-design-tokens")));
});

test("N5 — duplicate skill id would be reported, not silently overridden", () => {
  // Simulate by re-scanning the same root twice under two different labels.
  const dup = buildRegistry(discoverSkills([SKILLS_ROOT, SKILLS_ROOT]));
  assert.ok(dup.duplicates.length > 0);
  assert.ok(dup.warnings.some((w) => (typeof w === "string" ? w : w.code) === "DUPLICATE_SKILL_ID" || (w.code && w.code === "DUPLICATE_SKILL_ID")));
});

test("N6 — invalid metadata anywhere in the real registry never crashes route()", () => {
  assert.doesNotThrow(() => route("Do something moderately generic across a couple of files", registry));
});

test("N7 — routing never returns a negative confidence or a non-array excluded/warnings shape", () => {
  const d = route("Investigate something in the codebase", registry);
  assert.ok(d.confidence >= 0);
  assert.ok(Array.isArray(d.warnings));
  assert.ok(Array.isArray(d.excluded));
  assert.ok(Array.isArray(d.governance));
  assert.ok(Array.isArray(d.execution));
  assert.ok(Array.isArray(d.supporting));
});

test("invariant: same task text + same registry produces a deterministic route (ignoring decision_id/timestamp)", () => {
  const taskText = "Fix a failed Prisma migration end to end across the API";
  const a = route(taskText, registry);
  const b = route(taskText, registry);
  assert.equal(a.task_fingerprint, b.task_fingerprint);
  assert.equal(a.primary, b.primary);
  assert.deepEqual(a.supporting, b.supporting);
  assert.deepEqual(a.governance, b.governance);
  assert.deepEqual(a.execution, b.execution);
  assert.equal(a.confidence, b.confidence);
});

test("invariant: an exclude match can never win primary over a clean match", () => {
  // Build a tiny synthetic registry where skill A has an exclude that
  // matches the task, and skill B does not, to prove exclude (-100)
  // reliably beats even multiple trigger hits (+40 each, capped at 3x).
  const synthetic = {
    skills: [
      {
        id: "skill-a-excluded",
        name: "skill-a-excluded",
        description: "",
        hasRoutingMetadata: true,
        routing: {
          category: "domain",
          scope: [],
          triggers: ["widget", "gadget", "gizmo"],
          excludes: ["widget"],
          phases: [],
          precedence: { subordinate_to: [], may_constrain: [] },
          specificity: 90,
          status: "active",
          supersedes: [],
          superseded_by: [],
          inferred: false,
        },
      },
      {
        id: "skill-b-clean",
        name: "skill-b-clean",
        description: "",
        hasRoutingMetadata: true,
        routing: {
          category: "domain",
          scope: [],
          triggers: ["widget"],
          excludes: [],
          phases: [],
          precedence: { subordinate_to: [], may_constrain: [] },
          specificity: 10,
          status: "active",
          supersedes: [],
          superseded_by: [],
          inferred: false,
        },
      },
    ],
    warnings: [],
    duplicates: [],
  };
  const d = route("please handle the widget gadget gizmo", synthetic);
  assert.equal(d.primary, "skill-b-clean");
});

test("invariant: a deprecated skill loses a tie to an active replacement", () => {
  const synthetic = {
    skills: [
      {
        id: "old-skill",
        name: "old-skill",
        description: "",
        hasRoutingMetadata: true,
        routing: {
          category: "domain", scope: [], triggers: ["thing"], excludes: [], phases: [],
          precedence: { subordinate_to: [], may_constrain: [] }, specificity: 50,
          status: "deprecated", supersedes: [], superseded_by: ["new-skill"], inferred: false,
        },
      },
      {
        id: "new-skill",
        name: "new-skill",
        description: "",
        hasRoutingMetadata: true,
        routing: {
          category: "domain", scope: [], triggers: ["thing"], excludes: [], phases: [],
          precedence: { subordinate_to: [], may_constrain: [] }, specificity: 50,
          status: "active", supersedes: ["old-skill"], superseded_by: [], inferred: false,
        },
      },
    ],
    warnings: [],
    duplicates: [],
  };
  const d = route("do the thing", synthetic);
  assert.equal(d.primary, "new-skill");
});
