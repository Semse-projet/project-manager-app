import assert from "node:assert/strict";
import test from "node:test";
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { execFileSync, spawnSync } from "node:child_process";

const validator = path.resolve("scripts/spec-validate.mjs");
const legacy = `---
id: "test.contract"
title: "Test contract"
domain: "test"
status: "APPROVED"
owner: "semse-core"
risk: "low"
related_files: []
related_tests: []
related_endpoints: []
related_events: []
related_agents: []
last_verified: "2026-10-04"
---
# Test contract
`;
const delivery = `sdd_version: "2.0"
code_status: "NOT_STARTED"
ci_status: "NOT_RUN"
merge_status: "UNMERGED"
deploy_status: "NOT_DEPLOYED"
activation_status: "INACTIVE"
migration_status: "NOT_APPLICABLE"
feature_flags: []
production_evidence: []
`;

function fixture(t) {
  const root = mkdtempSync(path.join(tmpdir(), "semse-spec-validator-"));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  for (const dir of ["docs/specs/templates", ".specify/templates/overrides"]) mkdirSync(path.join(root, dir), { recursive: true });
  for (const file of ["docs/specs/templates/semse-spec-template.md", ".specify/templates/overrides/semse-spec.md"]) writeFileSync(path.join(root, file), "template\n");
  writeFileSync(path.join(root, "docs/specs/legacy.spec.md"), legacy);
  const git = (...args) => execFileSync("git", args, { cwd: root, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }).trim();
  git("init", "--quiet");
  git("add", ".");
  git("-c", "user.name=Spec Test", "-c", "user.email=spec-test@example.invalid", "commit", "--quiet", "-m", "baseline");
  const base = git("rev-parse", "HEAD");
  return {
    root, base, git,
    write: (name, content) => { writeFileSync(path.join(root, "docs/specs", name), content); git("add", "docs/specs"); },
    run: (...args) => spawnSync(process.execPath, [validator, "--strict", ...args], { cwd: root, encoding: "utf8" }),
  };
}

test("strict with a base tolerates untouched historical specs", (t) => {
  const f = fixture(t);
  assert.equal(f.run("--base-ref", f.base).status, 0);
});

test("strict rejects newly added specs that omit SDD 2.0", (t) => {
  const f = fixture(t);
  f.write("new.spec.md", legacy.replace("test.contract", "test.new"));
  const result = f.run("--base-ref", f.base);
  assert.equal(result.status, 1);
  assert.match(result.stdout, /new.spec.md: new or modified specs require sdd_version "2.0"/);
});

test("strict rejects modified historical specs that omit SDD 2.0", (t) => {
  const f = fixture(t);
  f.write("legacy.spec.md", legacy + "\nSubstantial contract change.\n");
  assert.equal(f.run("--base-ref", f.base).status, 1);
});

test("non-ASCII spec paths cannot bypass the changed-spec gate", (t) => {
  const f = fixture(t);
  f.write("decisión.spec.md", legacy.replace("test.contract", "test.decision"));
  assert.equal(f.run("--base-ref", f.base).status, 1);
});

test("a new spec with complete, conservative delivery metadata passes", (t) => {
  const f = fixture(t);
  f.write("new.spec.md", legacy.replace("test.contract", "test.new").replace("domain:", delivery + "domain:"));
  assert.equal(f.run("--base-ref", f.base).status, 0);
});

test("declaring SDD 2.0 without delivery metadata still fails", (t) => {
  const f = fixture(t);
  f.write("new.spec.md", legacy.replace("test.contract", "test.new").replace("domain:", 'sdd_version: "2.0"\ndomain:'));
  const result = f.run("--base-ref", f.base);
  assert.equal(result.status, 1);
  assert.match(result.stdout, /missing delivery metadata fields/);
});

test("an absent or invalid base cannot silently bypass the metadata gate", (t) => {
  const f = fixture(t);
  assert.notEqual(f.run("--base-ref").status, 0);
  assert.notEqual(f.run("--base-ref", "missing-ref").status, 0);
});
