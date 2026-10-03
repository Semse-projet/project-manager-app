import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";

import {
  canAccessInternalArchitecturePage,
  isInternalArchitecturePagePath,
} from "../../apps/web/lib/semse-api-auth.ts";

const repoRoot = path.resolve(import.meta.dirname, "..", "..");

test("internal architecture page paths are recognised, including sub-paths", () => {
  for (const p of ["/anatomy", "/anatomy/node/1", "/knowledge", "/repo-map", "/runtime-map/status"]) {
    assert.equal(isInternalArchitecturePagePath(p), true, p);
  }
});

test("lookalike paths are not treated as internal architecture pages", () => {
  for (const p of ["/anatomyx", "/knowledge-base", "/repo-maps", "/client/anatomy", "/"]) {
    assert.equal(isInternalArchitecturePagePath(p), false, p);
  }
});

test("only the admin role reaches internal architecture pages", () => {
  assert.equal(canAccessInternalArchitecturePage("/anatomy", "admin"), true);
  assert.equal(canAccessInternalArchitecturePage("/anatomy", "client"), false);
  assert.equal(canAccessInternalArchitecturePage("/repo-map", "worker"), false);
  // Non-internal paths are not decided by this helper.
  assert.equal(canAccessInternalArchitecturePage("/client/dashboard", "client"), true);
});

test("middleware requires a session for internal pages and enforces the admin-only rule", () => {
  const source = readFileSync(path.join(repoRoot, "apps/web/middleware.ts"), "utf8");
  assert.match(source, /isInternalArchitecturePagePath\(pathname\) \|\|/);
  assert.match(source, /canAccessInternalArchitecturePage\(pathname, role\)/);
});
