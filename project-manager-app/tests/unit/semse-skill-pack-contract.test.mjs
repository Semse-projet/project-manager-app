// Contract checks for four SEMSE 36-flow execution skills.
// Tests are repository-local and never connect to GitHub, Railway, a DB or payment provider.
import { test } from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const projectRoot = fileURLToPath(new URL("../../", import.meta.url));
const repositoryRoot = fileURLToPath(new URL("../../../", import.meta.url));
const catalogPath = join(projectRoot, "docs/agents/SEMSE_SKILL_CATALOG.md");
const names = [
  "semse-synthetic-test-data",
  "semse-business-flow-e2e",
  "semse-railway-release-verification",
  "semse-backup-restore-verification",
];
const policyWords = {
  "semse-synthetic-test-data": ["testRunId", "tenantId", "teardown", "SIMULADO_VALIDADO", "producción"],
  "semse-business-flow-e2e": ["F01–F36", "403/404", "e2e_synthetic", "PENDIENTE_PILOTO_REAL"],
  "semse-railway-release-verification": ["Railway", "SHA", "rollback", "CI", "canario"],
  "semse-backup-restore-verification": ["SHA-256", "ISOLATED_RESTORE_VERIFIED", "PENDING_REAL_RESTORE", "PostgreSQL"],
};
test("The four canonical skills, Codex pointers, and catalog entries exist", () => {
  const catalog = readFileSync(catalogPath, "utf8");
  for (const name of names) {
    const canonical = join(projectRoot, ".claude/skills", name, "SKILL.md");
    const codex = join(repositoryRoot, ".agents/skills", name, "SKILL.md");
    assert.ok(existsSync(canonical), `missing canonical skill: ${name}`);
    assert.ok(existsSync(codex), `missing Codex descriptor: ${name}`);
    const source = readFileSync(canonical, "utf8");
    const pointer = readFileSync(codex, "utf8");
    assert.ok(source.startsWith(`---\nname: ${name}\ndescription: `), `missing canonical frontmatter: ${name}`);
    assert.ok(pointer.startsWith(`---\nname: ${name}\ndescription: `), `missing Codex frontmatter: ${name}`);
    assert.ok(source.includes("project-manager-app/AGENTS.md"), `governance missing: ${name}`);
    assert.match(source, /piloto real|PILOTO_REAL/i, `missing real-world verification gate: ${name}`);
    assert.ok(pointer.includes(`project-manager-app/.claude/skills/${name}/SKILL.md`), `canonical pointer missing: ${name}`);
    assert.ok(pointer.includes("project-manager-app/AGENTS.md"), `Codex governance missing: ${name}`);
    assert.ok(catalog.includes(`| ${name} |`), `catalog row missing: ${name}`);
    for (const key of policyWords[name]) {
      assert.ok(source.includes(key), `${name} lacks critical protocol ${key}`);
    }
  }
});
test("New skills never declare fixture-only or a healthy service sufficient for production acceptance", () => {
  const testData = readFileSync(join(projectRoot, ".claude/skills/semse-synthetic-test-data/SKILL.md"), "utf8");
  const e2e = readFileSync(join(projectRoot, ".claude/skills/semse-business-flow-e2e/SKILL.md"), "utf8");
  const backup = readFileSync(join(projectRoot, ".claude/skills/semse-backup-restore-verification/SKILL.md"), "utf8");
  assert.match(testData, /DB efímera\/local/);
  assert.match(testData, /No generar datos de prueba visibles para clientes reales/);
  assert.match(e2e, /CI verde/);
  assert.match(e2e, /Railway SUCCESS/);
  assert.match(backup, /Fixture sintético ≠ backup productivo restaurado/);
});
