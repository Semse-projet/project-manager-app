// Contract checks for the SEMSE quality kit (docs/semse-kit/): four own skills
// adapted from the external replica-skill pack. Repository-local only: never
// contacts GitHub, Railway, a DB, a payment provider or a third-party site.
import { test } from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";

const projectRoot = fileURLToPath(new URL("../../", import.meta.url));
const repositoryRoot = fileURLToPath(new URL("../../../", import.meta.url));
const skillsRoot = join(projectRoot, ".claude/skills");
const kitDocs = join(projectRoot, "docs/semse-kit");
const UPSTREAM_COMMIT = "77c9436fb3d18c3d58169efb8caf4fe906b0dc51";

const kit = {
  "semse-recon": {
    delegates: ["semse-spec-kit-flow", "semse-business-flow-e2e", "semse-parity-audit"],
    words: ["Clean room", "nunca genera código", "URL", "no se versionan"],
    tools: ["reviews.py"],
  },
  "semse-parity-audit": {
    delegates: ["semse-spec-kit-flow", "semse-audit-remediation"],
    words: ["evidencia", "flag apagado", "SHA", "diseño ≠ código"],
    tools: ["parity.py", "imgdiff.py"],
  },
  "semse-functional-test": {
    delegates: ["semse-business-flow-e2e", "semse-synthetic-test-data", "semse-security-baseline"],
    words: ["OPS_ADMIN", "semse-language", "403", "S1", "Nunca producción"],
    tools: [],
  },
  "semse-release-gate": {
    delegates: ["semse-ci-pr-workflow", "semse-railway-release-verification", "semse-design-tokens"],
    words: ["BLOCKED", "UNVERIFIED", "READY_FOR_HUMAN_REVIEW", "**Nunca** fusiona"],
    tools: ["contrast.py"],
  },
};

test("Kit skills, Codex pointers and catalog rows exist with SEMSE governance", () => {
  const catalog = readFileSync(join(projectRoot, "docs/agents/SEMSE_SKILL_CATALOG.md"), "utf8");
  for (const [name, spec] of Object.entries(kit)) {
    const canonical = join(skillsRoot, name, "SKILL.md");
    const codex = join(repositoryRoot, ".agents/skills", name, "SKILL.md");
    assert.ok(existsSync(canonical), `missing canonical skill: ${name}`);
    assert.ok(existsSync(codex), `missing Codex descriptor: ${name}`);
    const source = readFileSync(canonical, "utf8");
    const pointer = readFileSync(codex, "utf8");
    assert.ok(source.startsWith(`---\nname: ${name}\ndescription: `), `canonical frontmatter: ${name}`);
    assert.ok(source.includes("project-manager-app/AGENTS.md"), `governance pointer: ${name}`);
    assert.ok(source.includes("docs/semse-kit/security-rules.md"), `kit rules pointer: ${name}`);
    assert.ok(source.includes(UPSTREAM_COMMIT.slice(0, 7)), `upstream provenance: ${name}`);
    assert.ok(pointer.includes(`project-manager-app/.claude/skills/${name}/SKILL.md`), `Codex canonical pointer: ${name}`);
    assert.ok(catalog.includes(`| ${name} |`), `catalog row: ${name}`);
    for (const other of spec.delegates) {
      assert.ok(source.includes(other), `${name} must delegate to ${other}, not replace it`);
      assert.ok(existsSync(join(skillsRoot, other, "SKILL.md")), `${name} delegates to a missing skill: ${other}`);
    }
    for (const word of spec.words) assert.ok(source.includes(word), `${name} lacks protocol: ${word}`);
  }
});

test("No kit skill reintroduces the discarded replica-skill capabilities", () => {
  for (const name of Object.keys(kit)) {
    assert.ok(!existsSync(join(skillsRoot, name.replace("semse-", "replica-"))), `replica skill installed: ${name}`);
  }
  const installed = readdirSync(skillsRoot).filter((id) => id.startsWith("replica-"));
  assert.deepEqual(installed, [], "the external pack must not be installed wholesale");
  const gate = readFileSync(join(skillsRoot, "semse-release-gate/SKILL.md"), "utf8");
  assert.match(gate, /No modifica workflows/);
  assert.match(gate, /no algo que este gate haga por su cuenta/);
});

test("Adapted third-party code keeps its MIT notice and stays offline", () => {
  const readme = readFileSync(join(kitDocs, "README.md"), "utf8");
  assert.ok(readme.includes(UPSTREAM_COMMIT), "kit README must pin the exact upstream commit");
  for (const [name, spec] of Object.entries(kit)) {
    for (const tool of spec.tools) {
      const dir = join(skillsRoot, name, "scripts");
      const license = readFileSync(join(dir, "LICENSE.replica-skill"), "utf8");
      assert.match(license, /MIT License/);
      assert.match(license, /Copyright \(c\) 2026 Jake Schincariol/);
      const code = readFileSync(join(dir, tool), "utf8");
      assert.doesNotMatch(code, /^\s*(import|from)\s+(urllib|socket|http|requests|subprocess|ftplib|smtplib)\b/m,
        `${name}/${tool} must not import network or process modules`);
      assert.doesNotMatch(code, /\b(os\.system|eval|exec)\(/, `${name}/${tool} must not run arbitrary code`);
    }
  }
  for (const doc of ["README.md", "security-rules.md", "test-matrix.md", "contrast-baseline.md"]) {
    assert.ok(existsSync(join(kitDocs, doc)), `missing kit doc: ${doc}`);
  }
});

test("semse-tokens exports the real SEMSE palette for the contrast checker", async () => {
  const mod = await import(join(skillsRoot, "semse-release-gate/scripts/semse-tokens.mjs"));
  const { dark, light } = await mod.loadPalettes();
  for (const [theme, palette] of Object.entries({ dark, light })) {
    const tokens = mod.toContrastTokens(palette, theme);
    assert.equal(tokens.color.onFill, "#ffffff");
    for (const [fg, bg] of tokens.pairs) {
      assert.match(tokens.color[fg] ?? "", /^#[0-9a-f]{6}$/i, `${theme}: pair uses unknown or non-hex ${fg}`);
      assert.match(tokens.color[bg] ?? "", /^#[0-9a-f]{6}$/i, `${theme}: pair uses unknown or non-hex ${bg}`);
    }
    assert.ok(!Object.values(tokens.color).some((v) => v.startsWith("rgba")), `${theme}: rgba tints leaked`);
  }
});

const python = spawnSync("python3", ["--version"], { encoding: "utf8" });
for (const name of ["semse-recon", "semse-parity-audit", "semse-release-gate"]) {
  test(`${name}: upstream Python tests pass`, { skip: python.status !== 0 && "python3 not available" }, () => {
    const run = spawnSync("python3", ["-I", "-B", "-m", "unittest", "discover", "-s", "scripts/tests"], {
      cwd: join(skillsRoot, name),
      encoding: "utf8",
      timeout: 60_000,
    });
    assert.equal(run.status, 0, run.stderr || run.stdout);
  });
}
