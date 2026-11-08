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
  // Tenant and run must either both exist or neither; a failure midway
  // through setup must not leave a synthetic tenant behind.
  const run = await prisma.$transaction(async (tx) => {
    await tx.tenant.create({ data: { id: tenantId, slug: tenantId, name: "Disposable Claim Test" } });
    return tx.agentRun.create({
      data: {
        tenantId, agentType: "pricing", triggerType: "manual", inputJson: {},
        correlationId: uid("corr"), status: "QUEUED", maxAttempts: 3,
      },
    });
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

dbTest("PostgreSQL CAS: older foreign QUEUED run cannot starve or be claimed by tenant A", async () => {
  // Foreign tenant B must have the OLDEST queued run; removing tenantId from
  // findFirst would select B and leave A's own queued run unclaimed.
  const b = await fixture();
  let a: Awaited<ReturnType<typeof fixture>> | undefined;
  try {
    a = await fixture();
    const owned = await repository.claimNext(actor(a.tenantId, "worker_A"));
    assert.equal(owned?.id, a.run.id, "tenant-local oldest job must win regardless of foreign queue age");
    const other = await prisma.agentRun.findUniqueOrThrow({ where: { id: b.run.id } });
    assert.equal(other.status, "QUEUED");
    assert.equal(other.attempts, 0);
    assert.equal(other.workerId, null);

    // A now has no QUEUED runs. Claiming again must never take B's run.
    const absent = await repository.claimNext(actor(a.tenantId, "worker_A2"));
    assert.equal(absent, null);
    const foreign = await prisma.agentRun.findUniqueOrThrow({ where: { id: b.run.id } });
    assert.equal(foreign.status, "QUEUED");
    assert.equal(foreign.workerId, null);
  } finally {
    if (a) await a.cleanup();
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


dbTest("PostgreSQL fencing: stale worker heartbeat, completion and failure cannot close a reclaimed attempt", async () => {
  const f = await fixture();
  const base = { tenantId: f.tenantId, orgId: "org_test", userId: "user_test", runId: f.run.id };
  try {
    const first = await repository.start({ ...base, workerId: "worker_A", expectedAttempts: 0 });
    assert.equal(first.status, "running");
    assert.equal(first.attempts, 1);
    assert.equal(first.workerId, "worker_A");

    // Use real transactional reclaim, not a synthetic direct status UPDATE.
    // The old heartbeat makes only this test run stale.
    const staleAt = new Date(Date.now() - 120_000);
    await prisma.agentRun.update({
      where: { id: f.run.id },
      data: { heartbeatAt: staleAt, startedAt: staleAt },
    });
    const reclaimed = await repository.reclaimStale({
      tenantId: f.tenantId, orgId: "org_test", userId: "user_test",
      staleAfterMs: 30_000, maxItems: 1,
    });
    assert.equal(reclaimed.length, 1, "real reclaim must requeue one run");
    assert.equal(reclaimed[0]?.id, f.run.id);
    assert.equal(reclaimed[0]?.status, "queued");
    const current = await repository.start({ ...base, workerId: "worker_A", expectedAttempts: 1 });
    assert.equal(current.attempts, 2, "reclaimed attempt has a different generation");

    await assert.rejects(
      repository.heartbeat({ ...base, workerId: "worker_A", expectedAttempts: 1 }),
      (error: unknown) => (error as any)?.getStatus?.() === 409,
    );
    await assert.rejects(
      repository.complete({ ...base, workerId: "worker_A", expectedAttempts: 1, output: { summary: "stale" } }),
      (error: unknown) => (error as any)?.getStatus?.() === 409,
    );
    await assert.rejects(
      repository.fail({ ...base, workerId: "worker_A", expectedAttempts: 1, error: "stale worker failed" }),
      (error: unknown) => (error as any)?.getStatus?.() === 409,
    );

    const unchanged = await prisma.agentRun.findUniqueOrThrow({ where: { id: f.run.id } });
    assert.equal(unchanged.status, "RUNNING");
    assert.equal(unchanged.attempts, 2);
    assert.equal(unchanged.error, null);
    assert.equal(unchanged.outputJson, null);

    await repository.heartbeat({ ...base, workerId: "worker_A", expectedAttempts: 2 });
    const finished = await repository.complete({
      ...base, workerId: "worker_A", expectedAttempts: 2, output: { summary: "valid" },
    });
    assert.equal(finished.status, "completed");
    await assert.rejects(
      repository.complete({ ...base, workerId: "worker_A", expectedAttempts: 1, output: { summary: "obsolete" } }),
      (error: unknown) => (error as any)?.getStatus?.() === 409,
    );
  } finally {
    await f.cleanup();
  }
});

dbTest("PostgreSQL fencing: two direct starts on the same queued run cannot both succeed", async () => {
  const f = await fixture();
  const input = { tenantId: f.tenantId, orgId: "org_test", userId: "user_test", runId: f.run.id };
  try {
    const results = await Promise.allSettled([
      repository.start({ ...input, workerId: "worker_A", expectedAttempts: 0 }),
      repository.start({ ...input, workerId: "worker_B", expectedAttempts: 0 }),
    ]);
    assert.equal(results.filter((r) => r.status === "fulfilled").length, 1);
    for (const r of results) {
      if (r.status === "rejected") assert.equal(r.reason?.getStatus?.(), 409);
    }
    const saved = await prisma.agentRun.findUniqueOrThrow({ where: { id: f.run.id } });
    assert.equal(saved.status, "RUNNING");
    assert.equal(saved.attempts, 1);
    assert.ok(["worker_A", "worker_B"].includes(saved.workerId ?? ""));
  } finally {
    await f.cleanup();
  }
});

dbTest("PostgreSQL fencing: legacy manual start and completion remain supported for unowned runs", async () => {
  const f = await fixture();
  const input = { tenantId: f.tenantId, orgId: "org_test", userId: "user_test", runId: f.run.id };
  try {
    const started = await repository.start(input);
    assert.equal(started.status, "running");
    assert.equal(started.workerId, undefined);
    const finished = await repository.complete({ ...input, output: { summary: "manual authorized action" } });
    assert.equal(finished.status, "completed");
    assert.equal(finished.attempts, 1);
  } finally {
    await f.cleanup();
  }
});

test.after(async () => { await prisma.$disconnect(); });
