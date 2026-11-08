/**
 * Regression for O.HI3 AgentRun compare-and-set claim on real PostgreSQL.
 * Writes are allowed only on isolated loopback databases in CI/local opt-in.
 * These tests do not certify worker lifecycle fencing after reclaim.
 */
import "reflect-metadata";
import test from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { PrismaClient } from "@prisma/client";
import { AgentsRepository } from "../dist/modules/agents/agents.repository.js";

function allowedDisposableDb(): boolean {
  if (!process.env.DATABASE_URL) return false;
  let url: URL;
  try { url = new URL(process.env.DATABASE_URL); }
  catch { return false; }
  if (!["postgresql:", "postgres:"].includes(url.protocol)
      || !["127.0.0.1", "localhost", "[::1]"].includes(url.hostname)
      || url.port !== "5433") return false;
  const database = decodeURIComponent(url.pathname.slice(1));
  if (process.env.GITHUB_ACTIONS === "true") {
    return process.env.CI === "true" && url.hostname === "127.0.0.1"
      && url.username === "semse" && database === "semse";
  }
  return process.env.SEMSE_ALLOW_DISPOSABLE_AGENT_CLAIM_DB === "1"
    && /^semse_(test|e2e)(?:_|$)/.test(database);
}
const dbAllowed = allowedDisposableDb();
if ((process.env.GITHUB_ACTIONS === "true" && !dbAllowed)
  || (process.env.SEMSE_ALLOW_DISPOSABLE_AGENT_CLAIM_DB === "1" && !dbAllowed)) {
  throw new Error("Agent claim integration requires isolated loopback PostgreSQL :5433 and disposable DB");
}
const dbTest = dbAllowed ? test : test.skip;
const prisma = new PrismaClient();
const repository = new AgentsRepository(
  prisma as never,
  { async ensureActorContext() { /* synthetic tenant-scoped test actor */ } } as never,
);
const uid = (prefix: string) => prefix + "_" + randomUUID().replaceAll("-", "");
const actor = (tenantId: string, workerId: string) => ({
  tenantId, orgId: "org_test", userId: "user_test", agentType: "pricing" as const, workerId,
});
async function fixture() {
  const tenantId = uid("ten_claim");
  await prisma.tenant.create({ data: { id: tenantId, slug: tenantId, name: "Disposable Claim Test" } });
  const run = await prisma.agentRun.create({
    data: {
      tenantId, agentType: "pricing", triggerType: "manual", inputJson: {},
      correlationId: uid("corr"), status: "QUEUED", maxAttempts: 3,
    },
  });
  return {
    tenantId, run,
    async cleanup() {
      await prisma.agentRun.deleteMany({ where: { tenantId } });
      await prisma.tenant.delete({ where: { id: tenantId } });
    },
  };
}

dbTest("PostgreSQL CAS: two workers racing to claim one QUEUED run yield one owner", async () => {
  const f = await fixture();
  try {
    const claims = await Promise.all([
      repository.claimNext(actor(f.tenantId, "worker_A")),
      repository.claimNext(actor(f.tenantId, "worker_B")),
    ]);
    const winners = claims.filter((c) => c !== null);
    assert.equal(winners.length, 1, "one and only one claim must be granted");
    const persisted = await prisma.agentRun.findUniqueOrThrow({ where: { id: f.run.id } });
    assert.equal(persisted.status, "RUNNING");
    assert.equal(persisted.attempts, 1);
    assert.equal(persisted.workerId, winners[0]?.workerId);
    assert.ok(["worker_A", "worker_B"].includes(persisted.workerId ?? ""));
  } finally {
    await f.cleanup();
  }
});

dbTest("PostgreSQL CAS: claiming a tenant cannot claim another tenant's QUEUED run", async () => {
  const a = await fixture();
  const b = await fixture();
  try {
    const owned = await repository.claimNext(actor(a.tenantId, "worker_A"));
    assert.equal(owned?.id, a.run.id);
    const other = await prisma.agentRun.findUniqueOrThrow({ where: { id: b.run.id } });
    assert.equal(other.status, "QUEUED");
    assert.equal(other.attempts, 0);
    assert.equal(other.workerId, null);
  } finally {
    await a.cleanup();
    await b.cleanup();
  }
});

dbTest("PostgreSQL CAS: an exhausted attempt budget is never re-claimed", async () => {
  const f = await fixture();
  try {
    await prisma.agentRun.update({
      where: { id: f.run.id },
      data: { attempts: 3, maxAttempts: 3 },
    });
    const result = await repository.claimNext(actor(f.tenantId, "worker_exhausted"));
    assert.equal(result, null);
    const persisted = await prisma.agentRun.findUniqueOrThrow({ where: { id: f.run.id } });
    assert.equal(persisted.attempts, 3);
    assert.equal(persisted.status, "QUEUED");
  } finally {
    await f.cleanup();
  }
});

test.after(async () => { await prisma.$disconnect(); });
