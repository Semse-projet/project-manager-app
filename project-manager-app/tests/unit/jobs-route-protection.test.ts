import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";

const repoRoot = path.resolve(import.meta.dirname, "..", "..");
const middleware = readFileSync(path.join(repoRoot, "apps/web/middleware.ts"), "utf8");

test("legacy /jobs/* pages require a session", () => {
  const match = middleware.match(/const PROTECTED_PREFIXES = \[([^\]]*)\]/);
  assert.ok(match, "PROTECTED_PREFIXES must be declared");
  assert.ok(match[1].includes('"/jobs"'), "/jobs must be a protected prefix");
});

test("every role that links to /jobs/:id keeps access to it", () => {
  const owned = middleware.match(/const ownedPrefixes[\s\S]*?\};/);
  assert.ok(owned, "ownedPrefixes must be declared");
  for (const role of ["worker", "client", "admin"]) {
    const line = owned[0].split("\n").find((l) => new RegExp(`^\\s*${role}:`).test(l));
    assert.ok(line?.includes('"/jobs"'), `${role} must own /jobs (worker tracker, client and admin pages link to it)`);
  }
});
