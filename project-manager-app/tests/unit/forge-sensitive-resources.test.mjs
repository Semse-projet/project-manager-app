import test from "node:test";
import assert from "node:assert/strict";

import { categoriesForPaths, isCriticalPath, isDataPath, matchingRules } from "../../packages/forge/dist/index.js";

test("isCriticalPath matches the original 6 patch-planner/deployment-provider patterns", () => {
  assert.ok(isCriticalPath("packages/db/prisma/schema.prisma"));
  assert.ok(isCriticalPath("packages/db/prisma/migrations/20260101_init.sql"));
  assert.ok(isCriticalPath(".github/workflows/ci.yml"));
  assert.ok(isCriticalPath("railway.json"));
  assert.ok(isCriticalPath("infra/railway/railway.json"));
  assert.ok(isCriticalPath("Dockerfile"));
  assert.ok(isCriticalPath("apps/api/Dockerfile"));
  assert.ok(isCriticalPath("docker-compose.yml"));
});

test("isCriticalPath covers the new lockfile and raw SQL categories", () => {
  assert.ok(isCriticalPath("pnpm-lock.yaml"));
  assert.ok(isCriticalPath("project-manager-app/pnpm-lock.yaml"));
  assert.ok(isCriticalPath("scripts/seed.sql"));
});

test("isCriticalPath does not flag unrelated paths", () => {
  assert.equal(isCriticalPath("apps/web/app/page.tsx"), false);
  assert.equal(isCriticalPath("docs/README.md"), false);
});

test("isDataPath is narrower than isCriticalPath — only schema and migrations", () => {
  assert.ok(isDataPath("packages/db/prisma/schema.prisma"));
  assert.ok(isDataPath("packages/db/prisma/migrations/20260101_init.sql"));
  assert.equal(isDataPath("railway.json"), false);
  assert.equal(isDataPath(".github/workflows/ci.yml"), false);
});

test("matchingRules finds every rule that applies to a path", () => {
  const rules = matchingRules("packages/db/prisma/schema.prisma");
  const ruleNames = rules.map((r) => r.rule);
  assert.ok(ruleNames.includes("security.database_schema"));
  assert.ok(ruleNames.includes("forge.critical_path.schema"));
});

test("categoriesForPaths only returns lease-required categories", () => {
  const categories = categoriesForPaths([
    "packages/db/prisma/schema.prisma",
    ".github/workflows/ci.yml",
    "apps/web/app/page.tsx"
  ]);
  assert.ok(categories.has("schema"));
  assert.equal(categories.has("cicd"), false, "cicd is a security finding, not lease-required");
  assert.equal(categories.size, 1);
});

test("categoriesForPaths deduplicates categories across multiple matching paths", () => {
  const categories = categoriesForPaths([
    "packages/db/prisma/schema.prisma",
    "packages/db/prisma/migrations/20260101_init.sql"
  ]);
  assert.ok(categories.has("schema"));
  assert.ok(categories.has("migrations"));
  assert.equal(categories.size, 2);
});
