import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { discoverSkills } from "../../scripts/skill-router/lib/discover.mjs";
import { buildRegistry } from "../../scripts/skill-router/lib/registry.mjs";

function makeSkillDir(root, id, skillMdContent) {
  const dir = join(root, id);
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, "SKILL.md"), skillMdContent, "utf8");
}

function withTempRoots(count, fn) {
  const roots = [];
  for (let i = 0; i < count; i++) {
    roots.push(mkdtempSync(join(tmpdir(), `skill-router-fixtures-${i}-`)));
  }
  try {
    fn(...roots);
  } finally {
    for (const r of roots) rmSync(r, { recursive: true, force: true });
  }
}

test("discoverSkills: a brand-new skill appears with zero router source changes required", () => {
  withTempRoots(1, (root) => {
    makeSkillDir(
      root,
      "zzz-dummy-fixture-skill",
      "---\nname: zzz-dummy-fixture-skill\ndescription: A never-before-seen fixture skill for a scale test.\n---\n# Dummy\n",
    );
    const discovery = discoverSkills([root]);
    assert.equal(discovery.entries.length, 1);
    assert.equal(discovery.entries[0].id, "zzz-dummy-fixture-skill");

    const registry = buildRegistry(discovery);
    assert.equal(registry.skills.length, 1);
    assert.equal(registry.skills[0].hasRoutingMetadata, false);
    assert.equal(registry.skills[0].routing.inferred, true);
    assert.ok(
      registry.warnings.some((w) => w.code === "MISSING_ROUTING_METADATA" && w.message.includes("zzz-dummy-fixture-skill")),
    );
  });
});

test("discoverSkills: a directory with no SKILL.md is skipped with a warning, not a crash (N4-adjacent)", () => {
  withTempRoots(1, (root) => {
    mkdirSync(join(root, "not-a-skill"), { recursive: true });
    writeFileSync(join(root, "not-a-skill", "README.md"), "not a skill file", "utf8");
    const discovery = discoverSkills([root]);
    assert.equal(discovery.entries.length, 0);
    assert.ok(discovery.warnings.some((w) => w.code === "MISSING_SKILL_MD"));
  });
});

test("discoverSkills: legacy skill with only name/description is discovered with a warning, no crash (N4)", () => {
  withTempRoots(1, (root) => {
    makeSkillDir(root, "legacy-skill", "---\nname: legacy-skill\ndescription: An old-style skill.\n---\n# body\n");
    const discovery = discoverSkills([root]);
    const registry = buildRegistry(discovery);
    assert.equal(registry.skills.length, 1);
    assert.equal(registry.skills[0].hasRoutingMetadata, false);
    assert.ok(registry.warnings.some((w) => w.code === "MISSING_ROUTING_METADATA"));
  });
});

test("discoverSkills: duplicate skill id across two roots is reported, neither silently overridden (N5)", () => {
  withTempRoots(2, (rootA, rootB) => {
    makeSkillDir(rootA, "dup-skill", "---\nname: dup-skill\ndescription: Version in root A.\n---\n# body\n");
    makeSkillDir(rootB, "dup-skill", "---\nname: dup-skill\ndescription: Version in root B.\n---\n# body\n");
    const discovery = discoverSkills([rootA, rootB]);
    assert.equal(discovery.entries.filter((e) => e.id === "dup-skill").length, 2);
    assert.equal(discovery.duplicates.length, 1);
    assert.equal(discovery.duplicates[0].id, "dup-skill");
    assert.ok(discovery.warnings.some((w) => w.code === "DUPLICATE_SKILL_ID"));
  });
});

test("discoverSkills: a missing root is reported, not thrown", () => {
  const discovery = discoverSkills([join(tmpdir(), "this-root-definitely-does-not-exist-xyz")]);
  assert.equal(discovery.entries.length, 0);
  assert.ok(discovery.warnings.some((w) => w.code === "ROOT_NOT_FOUND"));
});

test("buildRegistry: legacy inference derives a category from description hints, not a hardcoded id list", () => {
  withTempRoots(1, (root) => {
    makeSkillDir(
      root,
      "made-up-governance-skill",
      "---\nname: made-up-governance-skill\ndescription: The master governance skill with an Approval Gate for mutating actions.\n---\n# body\n",
    );
    const registry = buildRegistry(discoverSkills([root]));
    assert.equal(registry.skills[0].routing.category, "governance");
  });
});

test("buildRegistry: a longer/broader description gets lower inferred specificity than a short focused one", () => {
  withTempRoots(1, (root) => {
    const shortDescription = "Fix the design token colors in globals.css and colors.ts.";
    const longDescription = Array.from({ length: 40 }, (_, i) => `topic${i}`).join(" ") +
      " covering essentially every possible area of the whole system end to end.";
    makeSkillDir(root, "narrow-skill", `---\nname: narrow-skill\ndescription: ${shortDescription}\n---\n# body\n`);
    makeSkillDir(root, "broad-skill", `---\nname: broad-skill\ndescription: ${longDescription}\n---\n# body\n`);
    const registry = buildRegistry(discoverSkills([root]));
    const narrow = registry.skills.find((s) => s.id === "narrow-skill");
    const broad = registry.skills.find((s) => s.id === "broad-skill");
    assert.ok(narrow.routing.specificity > broad.routing.specificity);
  });
});
