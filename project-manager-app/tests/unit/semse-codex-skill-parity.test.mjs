// Enforce parity between canonical Claude skills and Codex discovery entrypoints.
// This test runs via pnpm test:unit and does not contact external services.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readdirSync, existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const appRoot = fileURLToPath(new URL("../../", import.meta.url));
const repoRoot = fileURLToPath(new URL("../../../", import.meta.url));
const claudeRoot = join(appRoot, ".claude", "skills");
const codexRoot = join(repoRoot, ".agents", "skills");
const skillIds = (root) => readdirSync(root, { withFileTypes: true })
  .filter((entry) => entry.isDirectory() && existsSync(join(root, entry.name, "SKILL.md")))
  .map((entry) => entry.name).sort();

// A legacy Codex-native worker tracker contains additional procedures;
// preserve it rather than silently discarding its existing content.
const legacyCodexNative = new Set(["testing-worker-tracker"]);

test("Claude and Codex have one discoverable entry per installed skill", () => {
  const claude = skillIds(claudeRoot);
  const codex = skillIds(codexRoot);
  assert.ok(claude.length > 0, "canonical skills directory is empty");
  assert.deepEqual(codex, claude, "Update Codex discovery when adding or removing Claude skills");
});

test("Codex entry names, descriptions, and canonical references are valid", () => {
  for (const id of skillIds(claudeRoot)) {
    assert.ok(existsSync(join(claudeRoot, id, "SKILL.md")), `missing canonical skill: ${id}`);
    const codex = join(codexRoot, id, "SKILL.md");
    assert.ok(existsSync(codex), `missing Codex descriptor: ${id}`);
    const text = readFileSync(codex, "utf8");
    assert.ok(text.startsWith(["---", `name: ${id}`, "description:"].join("\n")), `invalid frontmatter: ${id}`);
    const description = text.split("\n").find((line) => line.startsWith("description: "));
    assert.ok(description && description.length >= 25, `missing meaningful description: ${id}`);
    if (!legacyCodexNative.has(id)) {
      const target = `project-manager-app/.claude/skills/${id}/SKILL.md`;
      assert.ok(text.includes(target), `missing canonical pointer: ${id}`);
      assert.ok(text.includes("project-manager-app/AGENTS.md"), `missing governance pointer: ${id}`);
    }
  }
});
