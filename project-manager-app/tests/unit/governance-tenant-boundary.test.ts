import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const testDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(testDir, "../..");
const governanceRoot = path.join(repoRoot, "apps/web/app/api/semse/governance");

function discoverRoutes(directory: string): string[] {
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const absolute = path.join(directory, entry.name);
    if (entry.isDirectory()) return discoverRoutes(absolute);
    if (entry.name !== "route.ts") return [];
    return [path.relative(repoRoot, absolute).replaceAll("\\", "/")];
  }).sort();
}

const governanceRoutes = discoverRoutes(governanceRoot);

function read(relativePath: string): string {
  return fs.readFileSync(path.join(repoRoot, relativePath), "utf8");
}

test("every Governance BFF route requires signed session identity without static fallback", () => {
  assert.equal(governanceRoutes.length, 5, "update the boundary inventory when adding Governance routes");
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
  assert.match(proposals, /body:\s*JSON\.stringify\(payload\)/);
  assert.match(vote, /delete payload\.tenantId/);
  assert.match(vote, /delete payload\.voterId/);
  assert.match(vote, /body:\s*JSON\.stringify\(payload\)/);
  assert.doesNotMatch(credits, /tenantId/);
});

test("vote and close share a row lock before reading or mutating proposal state", () => {
  const service = read("apps/api/src/modules/governance/governance.service.ts");
  const voteSection = service.slice(service.indexOf("async castVote"), service.indexOf("async listProposals"));
  const closeSection = service.slice(service.indexOf("async closeProposal"), service.indexOf("// ── Helpers"));

  assert.match(service, /FROM "GovernanceProposal"[\s\S]*FOR UPDATE/);
  assert.match(voteSection, /this\.lockProposal\(tx,/);
  assert.match(closeSection, /this\.lockProposal\(tx,/);
});
