import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const testDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(testDir, "../..");
const governanceRoutes = [
  "apps/web/app/api/semse/governance/credits/[userId]/route.ts",
  "apps/web/app/api/semse/governance/proposals/route.ts",
  "apps/web/app/api/semse/governance/proposals/[id]/close/route.ts",
  "apps/web/app/api/semse/governance/proposals/[id]/results/route.ts",
  "apps/web/app/api/semse/governance/proposals/[id]/vote/route.ts",
] as const;

function read(relativePath: string): string {
  return fs.readFileSync(path.join(repoRoot, relativePath), "utf8");
}

test("every Governance BFF route requires signed session identity without static fallback", () => {
  for (const routeFile of governanceRoutes) {
    const source = read(routeFile);
    assert.match(source, /\bfetchSemseDataForAuthenticatedRequest\b/, routeFile);
    assert.doesNotMatch(source, /\bfetchSemseData(?:ForRequest)?(?:<|\()/, routeFile);
    assert.doesNotMatch(source, /\b(?:resolveRuntimeConfigForRequest|getServerConfig)\b/, routeFile);
  }
});

test("Governance BFF never forwards client-controlled tenant or actor identity", () => {
  const proposals = read("apps/web/app/api/semse/governance/proposals/route.ts");
  const vote = read("apps/web/app/api/semse/governance/proposals/[id]/vote/route.ts");
  const credits = read("apps/web/app/api/semse/governance/credits/[userId]/route.ts");

  assert.doesNotMatch(proposals, /searchParams\.get\("tenantId"\)/);
  assert.match(proposals, /delete payload\.tenantId/);
  assert.match(proposals, /delete payload\.authorId/);
  assert.match(vote, /delete payload\.tenantId/);
  assert.match(vote, /delete payload\.voterId/);
  assert.doesNotMatch(credits, /tenantId/);
});
