import { test } from "node:test";
import assert from "node:assert/strict";
import {
  extractFrontmatterBlock,
  parseYamlSubset,
  parseSkillFrontmatter,
} from "../../scripts/skill-router/lib/frontmatter.mjs";

test("extractFrontmatterBlock: finds a well-formed block", () => {
  const raw = "---\nname: x\n---\n# body\n";
  const { frontmatter, hasFrontmatter, malformed } = extractFrontmatterBlock(raw);
  assert.equal(hasFrontmatter, true);
  assert.equal(malformed, false);
  assert.equal(frontmatter, "name: x");
});

test("extractFrontmatterBlock: no leading --- means no frontmatter, no crash", () => {
  const { hasFrontmatter, malformed } = extractFrontmatterBlock("# just a heading\n");
  assert.equal(hasFrontmatter, false);
  assert.equal(malformed, false);
});

test("extractFrontmatterBlock: unclosed --- is reported malformed, not thrown", () => {
  const { hasFrontmatter, malformed } = extractFrontmatterBlock("---\nname: x\n# body with no closing delim\n");
  assert.equal(hasFrontmatter, false);
  assert.equal(malformed, true);
});

test("parseYamlSubset: scalars, inline lists, block lists, nested maps", () => {
  const text = [
    "name: semse-example",
    "routing:",
    "  category: domain",
    "  scope: [a_b, c]",
    "  triggers:",
    "    - foo",
    "    - bar",
    "  precedence:",
    "    subordinate_to:",
    "      - semseproject",
    "  specificity: 80",
  ].join("\n");
  const { value, warnings } = parseYamlSubset(text);
  assert.equal(warnings.length, 0);
  assert.equal(value.name, "semse-example");
  assert.equal(value.routing.category, "domain");
  assert.deepEqual(value.routing.scope, ["a_b", "c"]);
  assert.deepEqual(value.routing.triggers, ["foo", "bar"]);
  assert.deepEqual(value.routing.precedence.subordinate_to, ["semseproject"]);
  assert.equal(value.routing.specificity, 80);
});

test("parseYamlSubset: folded (>) and literal (|) block scalars", () => {
  const text = [
    "description: >",
    "  Line one continues",
    "  onto line two.",
    "notes: |",
    "  kept",
    "  as-is",
  ].join("\n");
  const { value } = parseYamlSubset(text);
  assert.equal(value.description, "Line one continues onto line two.");
  assert.equal(value.notes, "kept\nas-is");
});

test("parseYamlSubset: a line with a trailing colon inside a folded scalar does not corrupt parsing", () => {
  // Regression: a multi-line `description: >` block where a wrapped line
  // happens to end in a colon (e.g. "(see references/x.md):") must stay
  // inside the block scalar, not be mistaken for a new nested mapping key.
  const text = [
    "description: >",
    "  See the remediation notes (ver `references/audit-v1.md`):",
    "  jerarquia normativa y contratos.",
  ].join("\n");
  const { value, warnings } = parseYamlSubset(text);
  assert.equal(warnings.length, 0);
  assert.match(value.description, /jerarquia normativa y contratos\.$/);
});

test("parseYamlSubset: unparseable lines warn but never throw", () => {
  const text = "not a valid mapping line at all\nname: ok";
  const { value, warnings } = parseYamlSubset(text);
  assert.equal(value.name, "ok");
  assert.ok(warnings.length >= 1);
});

test("parseSkillFrontmatter: missing frontmatter warns, does not throw", () => {
  const result = parseSkillFrontmatter("# no frontmatter here\n", { skillId: "x" });
  assert.equal(result.name, undefined);
  assert.equal(result.routing, undefined);
  assert.equal(result.warnings.some((w) => w.code === "NO_FRONTMATTER"), true);
});

test("parseSkillFrontmatter: name/description only (legacy shape) parses cleanly, routing undefined", () => {
  const raw = "---\nname: my-skill\ndescription: Does a thing.\n---\n# body\n";
  const result = parseSkillFrontmatter(raw, { skillId: "my-skill" });
  assert.equal(result.name, "my-skill");
  assert.equal(result.description, "Does a thing.");
  assert.equal(result.routing, undefined);
});

test("parseSkillFrontmatter: valid routing block is normalized", () => {
  const raw = [
    "---",
    "name: my-skill",
    "description: Does a thing.",
    "routing:",
    "  version: 1",
    "  category: domain",
    "  scope: [thing_a]",
    "  triggers: [thing]",
    "  phases: [implementation, verification]",
    "  specificity: 70",
    "  status: active",
    "---",
    "# body",
    "",
  ].join("\n");
  const result = parseSkillFrontmatter(raw, { skillId: "my-skill" });
  assert.equal(result.warnings.length, 0);
  assert.equal(result.routing.category, "domain");
  assert.deepEqual(result.routing.phases, ["implementation", "verification"]);
  assert.equal(result.routing.specificity, 70);
});

test("parseSkillFrontmatter: invalid category/specificity/phase warn but degrade gracefully (N6)", () => {
  const raw = [
    "---",
    "name: my-skill",
    "description: Does a thing.",
    "routing:",
    "  category: not_a_real_category",
    "  specificity: 500",
    "  phases: [implementation, not_a_real_phase]",
    "---",
    "# body",
    "",
  ].join("\n");
  const result = parseSkillFrontmatter(raw, { skillId: "my-skill" });
  assert.equal(result.routing.category, undefined);
  assert.equal(result.routing.specificity, undefined);
  assert.deepEqual(result.routing.phases, ["implementation"]);
  const codes = result.warnings.map((w) => w.code);
  assert.ok(codes.includes("INVALID_METADATA"));
});

test("parseSkillFrontmatter: unknown future field is preserved, not dropped (N7)", () => {
  const raw = [
    "---",
    "name: my-skill",
    "description: Does a thing.",
    "routing:",
    "  category: domain",
    "  future_field: some_future_value",
    "---",
    "# body",
    "",
  ].join("\n");
  const result = parseSkillFrontmatter(raw, { skillId: "my-skill" });
  assert.equal(result.routing.future_field, "some_future_value");
  assert.equal(result.warnings.length, 0);
});
