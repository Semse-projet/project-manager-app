import assert from "node:assert/strict";
import test from "node:test";
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";

const indexScript = path.resolve("scripts/spec-index.mjs");

function fixture(t) {
  const root = mkdtempSync(path.join(tmpdir(), "semse-spec-index-"));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  mkdirSync(path.join(root, "docs/specs"), { recursive: true });

  const specPath = path.join(root, "docs/specs/example.spec.md");
  const indexPath = path.join(root, "docs/SPEC_INDEX.md");

  const baseSpec = `---
id: "example.sdd"
title: "Example SDD contract"
domain: "platform"
sdd_version: "2.0"
status: "DRAFT"
owner: "semse-core"
risk: "low"
code_status: "NOT_STARTED"
ci_status: "NOT_RUN"
merge_status: "UNMERGED"
deploy_status: "NOT_DEPLOYED"
activation_status: "INACTIVE"
migration_status: "NOT_APPLICABLE"
feature_flags: []
production_evidence: []
related_files: []
related_tests: []
related_endpoints: []
related_events: []
related_agents: []
last_verified: "NOT_VERIFIED"
---
# Example
`;
  writeFileSync(specPath, baseSpec);
  writeFileSync(indexPath, "# SEMSE specification index\n\nManual intro.\n");

  return {
    specPath,
    indexPath,
    baseSpec,
    run: (...args) => spawnSync(process.execPath, [indexScript, ...args], {
      cwd: root, encoding: "utf8",
    }),
  };
}

test("spec index check detects missing generated block without writing it", (t) => {
  const f = fixture(t);
  const before = readFileSync(f.indexPath, "utf8");
  const check = f.run("--check");
  assert.equal(check.status, 1);
  assert.match(check.stderr, /out of sync/);
  assert.equal(readFileSync(f.indexPath, "utf8"), before);
});

test("spec index normal mode regenerates exactly what --check validates", (t) => {
  const f = fixture(t);
  assert.equal(f.run().status, 0);
  const generated = readFileSync(f.indexPath, "utf8");
  assert.match(generated, /\[example\.sdd\]\(specs\/example\.spec\.md\)/);

  const check = f.run("--check");
  assert.equal(check.status, 0);
  assert.match(check.stdout, /Validated/);
  assert.equal(readFileSync(f.indexPath, "utf8"), generated);
});

test("changing spec metadata invalidates the index, including when reusing existing spec file", (t) => {
  const f = fixture(t);
  assert.equal(f.run().status, 0);
  const previous = readFileSync(f.indexPath, "utf8");

  writeFileSync(f.specPath, f.baseSpec.replace('status: "DRAFT"', 'status: "REVIEW"'));
  const check = f.run("--check");
  assert.equal(check.status, 1);
  assert.equal(readFileSync(f.indexPath, "utf8"), previous);

  assert.equal(f.run().status, 0);
  assert.match(readFileSync(f.indexPath, "utf8"), /\| REVIEW \|/);
  assert.equal(f.run("--check").status, 0);
});

test("adding another spec requires a new index row; --check is never a writer", (t) => {
  const f = fixture(t);
  assert.equal(f.run().status, 0);
  const before = readFileSync(f.indexPath, "utf8");
  writeFileSync(path.join(path.dirname(f.specPath), "second.spec.md"),
    f.baseSpec.replace('example.sdd', 'example.second'));
  assert.equal(f.run("--check").status, 1);
  assert.equal(readFileSync(f.indexPath, "utf8"), before);
  assert.equal(f.run().status, 0);
  assert.match(readFileSync(f.indexPath, "utf8"), /\[example\.second\]/);
});

test("an existing generated block with no footer remains byte-for-byte stable", (t) => {
  const f = fixture(t);
  assert.equal(f.run().status, 0);
  const once = readFileSync(f.indexPath, "utf8");
  assert.equal(f.run().status, 0);
  assert.equal(readFileSync(f.indexPath, "utf8"), once);
  assert.equal(f.run("--check").status, 0);
});

test("legacy NIVEL 0 index insertion keeps handwritten content and is idempotent", (t) => {
  const f = fixture(t);
  writeFileSync(f.indexPath, "# Index\n\n## NIVEL 0\nHandwritten section.\n");
  assert.equal(f.run().status, 0);
  const once = readFileSync(f.indexPath, "utf8");
  assert.match(once, /## NIVEL 0\nHandwritten section/);
  assert.equal(f.run("--check").status, 0);
  assert.equal(f.run().status, 0);
  assert.equal(readFileSync(f.indexPath, "utf8"), once);
});
