// Prevent silent drift between canonical Claude skills and Codex discovery entries.
// The canonical skill instructions live only in project-manager-app/.claude/skills.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readdirSync, existsSync, readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const appRoot = fileURLToPath(new URL("../../", import.meta.url));
const repoRoot = dirname(appRoot.replace(/\\/$/, ""));
const claudeRoot = join(appRoot, ".claude", "skills");
const codexRoot = join(repoRoot, ".agents", "skills");
const skillIds = (root) => readdirSync(root, { withFileTypes: true })
  .filter((entry) => entry.isDirectory() && existsSync(join(root, entry.name, "SKILL.md")))
  .map((entry) => entry.name).sort();

// Existing testing-worker-tracker entry contains legacy Codex-specific procedures;
// preserve them, but do not treat it as a second canonical source for new skills.
const legacyCodexNative = new Set(["testing-worker-tracker"]);

test("Claude and Codex have one discoverable entry per installed skill", () => {
  const claude = skillIds(claudeRoot);
  const codex = skillIds(codexRoot);
  assert.ok(claude.length > 0, "canonical skills directory is empty");
  assert.deepEqual(codex, claude, "When adding or removing canonical skills, synchronize Codex discovery entries");
});

test("Codex entries use valid names, meaningful descriptions and canonical paths", () => {
  for (const id of skillIds(claudeRoot)) {
    const canonical = join(claudeRoot, id, "SKILL.md");
    const codex = join(codexRoot, id, "SKILL.md");
    assert.ok(existsSync(canonical), `missing Claude canonical skill: ${id}`);
    assert.ok(existsSync(codex), `missing Codex descriptor: ${id}`);
    const content = readFileSync(codex, "utf8");
    assert.match(content, new RegExp(`^---\\\\nname: ${id}\\\\n(?:.|\\\\n)*?description: .{12,}`, "m"), `invalid Codex frontmatter: ${id}`);
    if (!legacyCodexNative.has(id)) {
      const canonicalPath = `project-manager-app/.claude/skills/${id}/SKILL.md`;
      assert.ok(content.includes(canonicalPath), `Codex entry missing canonical pointer: ${id}`);
      assert.ok(content.includes("project-manager-app/AGENTS.md"), `Codex entry missing governance pointer: ${id}`);
    }
  }
});
