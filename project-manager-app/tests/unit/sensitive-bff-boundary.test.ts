import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const testDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(testDir, "../..");
const semseBffRoot = "apps/web/app/api/semse";

const migratedSensitiveRoutes = [
  "apps/web/app/api/semse/buildops/estimates/from-tool-result/route.ts",
  "apps/web/app/api/semse/buildops/plans/[projectId]/approve/route.ts",
  "apps/web/app/api/semse/buildops/plans/[projectId]/reject/route.ts",
  "apps/web/app/api/semse/buildops/plans/[projectId]/request-changes/route.ts",
  "apps/web/app/api/semse/buildops/plans/[projectId]/unapprove/route.ts",
  "apps/web/app/api/semse/buildops/projects/route.ts",
  "apps/web/app/api/semse/buildops/tasks/route.ts",
  "apps/web/app/api/semse/field-ops/units/[unitId]/status/route.ts",
  "apps/web/app/api/semse/field-ops/units/route.ts",
  "apps/web/app/api/semse/field-ops/vendors/[vendorId]/compliance/route.ts",
  "apps/web/app/api/semse/field-ops/vendors/route.ts",
  "apps/web/app/api/semse/field-ops/worklogs/route.ts",
  "apps/web/app/api/semse/governance/proposals/[id]/close/route.ts",
  "apps/web/app/api/semse/incidents/route.ts",
  "apps/web/app/api/semse/materials/route.ts",
  "apps/web/app/api/semse/ops/agent-runtime/[id]/requeue/route.ts",
  "apps/web/app/api/semse/ops/agent-runtime/[id]/retry/route.ts",
  "apps/web/app/api/semse/ops/alerts/[alertId]/ack/route.ts",
  "apps/web/app/api/semse/ops/incidents/route.ts",
  "apps/web/app/api/semse/ops/runbooks/[runbookId]/execute/route.ts",
  "apps/web/app/api/semse/tasks/[taskId]/status/route.ts",
  "apps/web/app/api/semse/tasks/route.ts",
] as const;

function walkRouteFiles(relativeDir: string): string[] {
  const absoluteDir = path.join(repoRoot, relativeDir);
  const files: string[] = [];

  for (const entry of fs.readdirSync(absoluteDir, { withFileTypes: true })) {
    const relativePath = path.join(relativeDir, entry.name);
    if (entry.isDirectory()) {
      files.push(...walkRouteFiles(relativePath));
    } else if (entry.isFile() && entry.name === "route.ts") {
      files.push(relativePath.replaceAll("\\", "/"));
    }
  }

  return files;
}

const mutationExport = /export async function (?:POST|PUT|PATCH|DELETE)\b/;
const staticIdentityFetch = /\bfetchSemseData(?:<|\()/;
const fallbackIdentityFetch = /\bfetchSemseDataForRequest(?:<|\()/;
const localStaticConfigResolver = /\b(?:resolveRuntimeConfigForRequest|getServerConfig)\b/;

test("the 22 formerly static-identity mutation BFF routes require an authenticated session identity", () => {
  assert.equal(migratedSensitiveRoutes.length, 22, "update the reviewed P0 inventory explicitly");

  for (const routeFile of migratedSensitiveRoutes) {
    const source = fs.readFileSync(path.join(repoRoot, routeFile), "utf8");
    assert.match(source, mutationExport, `${routeFile} must remain a mutating route`);
    assert.match(
      source,
      /\bfetchSemseDataForAuthenticatedRequest\b/,
      `${routeFile} must forward only the authenticated user's identity`,
    );
    assert.doesNotMatch(source, staticIdentityFetch, `${routeFile} must not use the static server identity`);
    assert.doesNotMatch(source, fallbackIdentityFetch, `${routeFile} must not fall back to the static server identity`);
    assert.doesNotMatch(source, localStaticConfigResolver, `${routeFile} must not resolve a fallback identity locally`);
  }
});

test("no mutating SEMSE BFF route calls the bare static-identity helper", () => {
  const offenders = walkRouteFiles(semseBffRoot)
    .filter((routeFile) => {
      const source = fs.readFileSync(path.join(repoRoot, routeFile), "utf8");
      return mutationExport.test(source) && staticIdentityFetch.test(source);
    })
    .sort();

  assert.deepEqual(
    offenders,
    [],
    "mutating BFF routes must preserve the signed session identity instead of escalating to SEMSE_*",
  );
});

const migratedReadRoutes = [
  "apps/web/app/api/semse/buildops/milestones/route.ts",
  "apps/web/app/api/semse/buildops/overview/route.ts",
  "apps/web/app/api/semse/buildops/projects/[projectId]/route.ts",
  "apps/web/app/api/semse/buildops/tasks/[taskId]/route.ts",
  "apps/web/app/api/semse/control-surface/route.ts",
  "apps/web/app/api/semse/cortex/route.ts",
  "apps/web/app/api/semse/did/[userId]/route.ts",
  "apps/web/app/api/semse/trust/[userId]/passport/route.ts",
  "apps/web/app/api/semse/jobs/[jobId]/route.ts",
  "apps/web/app/api/semse/jobs/[jobId]/agent-signals/route.ts",
  "apps/web/app/api/semse/jobs/bootstrap/route.ts",
  "apps/web/app/api/semse/field-ops/units/[unitId]/route.ts",
] as const;

test("the 12 formerly static-identity read BFF routes require an authenticated session identity", () => {
  assert.equal(migratedReadRoutes.length, 12, "update the reviewed read-route inventory explicitly");

  for (const routeFile of migratedReadRoutes) {
    const source = fs.readFileSync(path.join(repoRoot, routeFile), "utf8");
    assert.match(
      source,
      /\bfetchSemseDataForAuthenticatedRequest\b/,
      `${routeFile} must forward only the authenticated user's identity`,
    );
    assert.doesNotMatch(source, staticIdentityFetch, `${routeFile} must not use the static server identity`);
    assert.doesNotMatch(source, fallbackIdentityFetch, `${routeFile} must not fall back to the static server identity`);
    assert.doesNotMatch(source, localStaticConfigResolver, `${routeFile} must not resolve a fallback identity locally`);
  }
});

// Read-only routes that still call the bare static-identity helper. This is a ratchet:
// the list may only shrink. `stats/public` is public on purpose (no session exists);
// the rest are knowledge/anatomy reference trees pending an explicit decision.
const remainingStaticIdentityReadRoutes = [
  "apps/web/app/api/semse/anatomy/children/[id]/route.ts",
  "apps/web/app/api/semse/anatomy/node/[id]/route.ts",
  "apps/web/app/api/semse/anatomy/relations/[id]/route.ts",
  "apps/web/app/api/semse/anatomy/tree/route.ts",
  "apps/web/app/api/semse/knowledge/domains/route.ts",
  "apps/web/app/api/semse/knowledge/overview/route.ts",
  "apps/web/app/api/semse/repo-knowledge/tree/route.ts",
  "apps/web/app/api/semse/runtime-knowledge/status/route.ts",
  "apps/web/app/api/semse/runtime-knowledge/tree/route.ts",
  "apps/web/app/api/semse/stats/public/route.ts",
] as const;

test("only the reviewed read-only routes may still call the bare static-identity helper", () => {
  const offenders = walkRouteFiles(semseBffRoot)
    .filter((routeFile) => staticIdentityFetch.test(fs.readFileSync(path.join(repoRoot, routeFile), "utf8")))
    .sort();

  assert.deepEqual(
    offenders,
    [...remainingStaticIdentityReadRoutes].sort(),
    "new BFF routes must act as the signed-in user; shrink this list when migrating, never grow it",
  );
});
