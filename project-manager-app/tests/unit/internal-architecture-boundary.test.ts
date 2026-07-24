import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

import {
  canAccessInternalArchitecturePage,
  isInternalArchitecturePagePath,
} from "../../apps/web/lib/semse-api-auth.ts";

const testDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(testDir, "../..");
const internalBffRoots = [
  "apps/web/app/api/semse/anatomy",
  "apps/web/app/api/semse/knowledge",
  "apps/web/app/api/semse/repo-knowledge",
  "apps/web/app/api/semse/runtime-knowledge",
];

function walkRouteFiles(relativeDir: string): string[] {
  const absoluteDir = path.join(repoRoot, relativeDir);
  const files: string[] = [];

  for (const entry of fs.readdirSync(absoluteDir, { withFileTypes: true })) {
    const relativePath = path.join(relativeDir, entry.name);
    if (entry.isDirectory()) {
      files.push(...walkRouteFiles(relativePath));
    } else if (entry.isFile() && entry.name === "route.ts") {
      files.push(relativePath);
    }
  }

  return files;
}

test("internal architecture pages are exact-prefix protected and admin-only", () => {
  for (const pathname of ["/anatomy", "/knowledge", "/repo-map", "/runtime-map", "/repo-map/node/1"]) {
    assert.equal(isInternalArchitecturePagePath(pathname), true, pathname);
    assert.equal(canAccessInternalArchitecturePage(pathname, "client"), false, pathname);
    assert.equal(canAccessInternalArchitecturePage(pathname, "worker"), false, pathname);
    assert.equal(canAccessInternalArchitecturePage(pathname, "admin"), true, pathname);
  }

  assert.equal(isInternalArchitecturePagePath("/knowledge-base"), false);
  assert.equal(canAccessInternalArchitecturePage("/client/dashboard", "client"), true);
});

test("every internal architecture BFF route requires request identity without static fallback", () => {
  const routeFiles = internalBffRoots.flatMap(walkRouteFiles).sort();
  assert.equal(routeFiles.length, 18, "update this inventory when internal architecture BFF routes change");

  for (const routeFile of routeFiles) {
    const source = fs.readFileSync(path.join(repoRoot, routeFile), "utf8");
    assert.match(
      source,
      /\bfetchSemseDataForAuthenticatedRequest\b/,
      `${routeFile} must use the authenticated-only BFF helper`,
    );
    assert.doesNotMatch(
      source,
      /\bfetchSemseData(?:ForRequest)?(?:<|\()/,
      `${routeFile} must not use a helper that can fall back to static server identity`,
    );
  }
});

test("authenticated-only BFF helper cannot resolve the static server identity", () => {
  const source = fs.readFileSync(
    path.join(repoRoot, "apps/web/app/api/semse/_server.ts"),
    "utf8",
  );
  const helper = source
    .split("export async function fetchSemseDataForAuthenticatedRequest")[1]
    ?.split("export function isSemseRuntimeEnabled")[0];

  assert.ok(helper, "authenticated-only helper must exist");
  assert.match(helper, /resolveConfigFromRequest\(req\)/);
  assert.match(helper, /resolveConfigFromCookie\(req\)/);
  assert.doesNotMatch(helper, /resolveRuntimeConfig(?:ForRequest)?\(/);
});
