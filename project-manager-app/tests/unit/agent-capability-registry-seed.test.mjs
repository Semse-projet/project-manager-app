// Agents Governance Reconciliation — PR A: Capability Registry truth for the
// 16 RuntimeAgentRoles (ADR-037, AG-03). These tests hold the acceptance
// criteria agreed for this PR: no maturity inflation, an idempotent seed,
// and no confusion between a role's maturity and its lifecycle/reachability
// (a DEPRECATE-the-path decision must never read as DEPRECATE-the-role for
// project-copilot, whose real feature lives outside this RuntimeAgentRole).
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { runtimeAgentRoles } from "../../packages/agents/dist/index.js";
import { AGENT_ROLE_CAPABILITY_SEED } from "../../apps/api/dist/modules/capability-registry/agent-role-capability-map.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const MIGRATION_SQL_PATH = join(
  __dirname,
  "../../packages/db/prisma/migrations/20260918010000_agent_role_capability_seed/migration.sql",
);
const migrationSql = readFileSync(MIGRATION_SQL_PATH, "utf8");

// ADR-032's ladder, in rank order — used to assert "never seeded above X"
// without hardcoding a brittle equality check against one exact value.
const MATURITY_RANK = ["DESIGNED", "IMPLEMENTED", "TESTED", "INTEGRATED", "DEPLOYED", "VERIFIED", "PRODUCTION"];
function rank(maturity) {
  const i = MATURITY_RANK.indexOf(maturity);
  assert.ok(i >= 0, `unknown maturity value: ${maturity}`);
  return i;
}

test("all 16 RuntimeAgentRole values are represented, and only those 16", () => {
  assert.equal(runtimeAgentRoles.length, 16, "expected exactly 16 RuntimeAgentRoles; update this seed if the enum changed");
  assert.deepEqual(
    Object.keys(AGENT_ROLE_CAPABILITY_SEED).sort(),
    [...runtimeAgentRoles].sort(),
    "AGENT_ROLE_CAPABILITY_SEED must map every real RuntimeAgentRole, and nothing else",
  );
});

test("no duplicate capability keys across the 16 seed rows", () => {
  const keys = Object.values(AGENT_ROLE_CAPABILITY_SEED).map((seed) => seed.key);
  assert.equal(new Set(keys).size, keys.length, "every agent-role capability key must be unique");
});

test("PRODUCTION_REACHABLE roles are never seeded above INTEGRATED", () => {
  for (const [role, seed] of Object.entries(AGENT_ROLE_CAPABILITY_SEED)) {
    if (seed.reachability !== "PRODUCTION_REACHABLE") continue;
    assert.ok(
      rank(seed.maturity) <= rank("INTEGRATED"),
      `${role} is PRODUCTION_REACHABLE but seeded at ${seed.maturity} — ADR-037 gathered no deploy-provenance or ` +
        `live-runtime evidence for these roles, so DEPLOYED/VERIFIED/PRODUCTION would be inflated`,
    );
  }
});

test("INTEGRATION_ONLY roles are never seeded above INTEGRATED", () => {
  // Per ADR-037's own table, PRODUCTION_REACHABLE and INTEGRATION_ONLY share
  // the same INTEGRATED cap: both have a reachability-tested production-
  // entrypoint->router->handler/builder chain (this repo's own reachability
  // test proves it for both groups) — the only difference between them is
  // whether real traffic ever invokes it, not whether the integration exists.
  // (An earlier draft of this PR's acceptance criteria proposed a stricter
  // TESTED cap for this group; confirmed with the user to keep ADR-037's
  // original, already-merged mapping instead of silently diverging from it.)
  for (const [role, seed] of Object.entries(AGENT_ROLE_CAPABILITY_SEED)) {
    if (seed.reachability !== "INTEGRATION_ONLY") continue;
    assert.ok(
      rank(seed.maturity) <= rank("INTEGRATED"),
      `${role} is INTEGRATION_ONLY but seeded at ${seed.maturity}`,
    );
  }
});

test("DESIGNED_BUT_UNWIRED roles are never seeded as INTEGRATED or higher", () => {
  for (const [role, seed] of Object.entries(AGENT_ROLE_CAPABILITY_SEED)) {
    if (seed.reachability !== "DESIGNED_BUT_UNWIRED") continue;
    assert.ok(
      rank(seed.maturity) < rank("INTEGRATED"),
      `${role} is DESIGNED_BUT_UNWIRED (no entrypoint reaches it at all) but seeded at ${seed.maturity} — ` +
        `INTEGRATED requires a demonstrable production path, which does not exist for this role`,
    );
  }
  const unwired = Object.values(AGENT_ROLE_CAPABILITY_SEED).filter((s) => s.reachability === "DESIGNED_BUT_UNWIRED");
  assert.equal(unwired.length, 4, "expected exactly 4 DESIGNED_BUT_UNWIRED roles per the reconciliation's classification");
});

test("a deprecated secondary path does not deprecate its surviving canonical capability (project-copilot regression)", () => {
  const projectCopilot = AGENT_ROLE_CAPABILITY_SEED["project-copilot"];
  assert.notEqual(
    projectCopilot.reachability,
    "DEPRECATED",
    "ADR-037 deprecates only the unused AgentRun-shaped path for project-copilot, not the capability itself — " +
      "the real, shipped feature (agents.service.ts:556's chatWithTools) is alive and bypasses this RuntimeAgentRole entirely",
  );
  assert.equal(projectCopilot.reachability, "INTEGRATION_ONLY");

  // Contrast case: field-ops IS a whole-role deprecation (CLAUDE.md +
  // semse-labor-engine-boundary already establish it's being replaced), so
  // its row correctly reads DEPRECATED — proving this test isn't just
  // asserting "never DEPRECATED" but the actual, evidence-based distinction.
  assert.equal(AGENT_ROLE_CAPABILITY_SEED["field-ops"].reachability, "DEPRECATED");
});

test("the migration's seed INSERT is idempotent by construction (ON CONFLICT upsert on a UNIQUE key/id)", () => {
  // No live Postgres is available in this environment to literally execute
  // the migration twice (same constraint ADR-032's own verification hit —
  // "no live DB available to this batch"). Idempotency is instead proven the
  // way a unique-keyed upsert guarantees it: the statement must target the
  // `capability` table's UNIQUE "key" column with an explicit ON CONFLICT
  // clause (re-running it can only update existing rows, never insert a
  // second row for the same key), and evidence rows must use ON CONFLICT ...
  // DO NOTHING keyed by their own unique id (append-only, never clobbered).
  assert.match(
    migrationSql,
    /INSERT INTO "capability" \([^)]*"key"[^)]*\)[\s\S]*?ON CONFLICT \("key"\) DO UPDATE SET/,
    "capability seed rows must upsert on the unique key column, not plain-INSERT",
  );
  assert.match(
    migrationSql,
    /INSERT INTO "capability_evidence"[\s\S]*?ON CONFLICT \("id"\) DO NOTHING/,
    "evidence rows must be append-only (ON CONFLICT DO NOTHING), never overwritten by a re-run",
  );
  // The capability UPDATE branch must never touch `health` — that column is
  // reserved for a future, separate runtime-observation evidence source;
  // this seed asserting maturity/reachability facts must not be able to
  // clobber a legitimately-observed health value on re-run.
  const updateSetMatch = migrationSql.match(/ON CONFLICT \("key"\) DO UPDATE SET([\s\S]*?);/);
  assert.ok(updateSetMatch, "expected an ON CONFLICT ... DO UPDATE SET clause for the capability insert");
  assert.doesNotMatch(updateSetMatch[1], /\bhealth\s*=/, "the seed's upsert must never overwrite `health`");
});

test("the migration SQL's inserted agent-role capability keys exactly match AGENT_ROLE_CAPABILITY_SEED (no drift between the two representations)", () => {
  const insertedKeys = [...migrationSql.matchAll(/'agent-role:[a-z-]+'/g)].map((m) => m[0].slice(1, -1));
  const uniqueInsertedKeys = [...new Set(insertedKeys)];
  assert.equal(uniqueInsertedKeys.length, insertedKeys.length, "the migration must not insert the same agent-role key twice");

  const expectedKeys = Object.values(AGENT_ROLE_CAPABILITY_SEED)
    .map((s) => s.key)
    .sort();
  assert.deepEqual(
    uniqueInsertedKeys.sort(),
    expectedKeys,
    "migration.sql and agent-role-capability-map.ts must agree on the exact set of agent-role capability keys — " +
      "Prisma migrations are static SQL and cannot import the TS map directly, so this cross-check is what keeps them in sync",
  );
});
