/**
 * #1153 regression: AgentRun organization ownership against disposable PostgreSQL.
 * Does not create financial objects, trigger BullMQ or rely on header identity.
 * HTTP session, permission and signed-claim controls are separately tested in QA.
 */
import "reflect-metadata";
import test from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { PrismaClient } from "@prisma/client";
import { AgentsRepository } from "../dist/modules/agents/agents.repository.js";
import { ActorContextService } from "../dist/infrastructure/persistence/actor-context.service.js";
import { OpsRepository } from "../dist/modules/ops/ops.repository.js";
import { DomainEventsRepository } from "../dist/modules/domain-events/domain-events.repository.js";

function allowedDisposableDb(): boolean {
  if (!process.env.DATABASE_URL) return false;
  let url: URL;
  try { url = new URL(process.env.DATABASE_URL); } catch { return false; }
  if (!["postgresql:", "postgres:"].includes(url.protocol)
    || !["localhost", "127.0.0.1", "[::1]"].includes(url.hostname) || url.port !== "5433") return false;
  const database = decodeURIComponent(url.pathname.slice(1));
  if (process.env.GITHUB_ACTIONS === "true")
    return process.env.CI === "true" && url.hostname === "127.0.0.1" && url.username === "semse" && database === "semse";
  return process.env.SEMSE_ALLOW_DISPOSABLE_AGENT_CLAIM_DB === "1"
    && /^semse_(test|e2e)(?:_|$)/.test(database);
}

const dbTest = allowedDisposableDb() ? test : test.skip;
if (process.env.SEMSE_ALLOW_DISPOSABLE_AGENT_CLAIM_DB === "1" && !allowedDisposableDb())
  throw new Error("AgentRun organization test needs isolated localhost PostgreSQL :5433");
const prisma = new PrismaClient();
const actors = new ActorContextService(prisma as never);
const runs = new AgentsRepository(prisma as never, actors);
const ops = new OpsRepository(prisma as never, actors);
const events = new DomainEventsRepository(prisma as never, actors);
const id = (kind: string) => kind + "_" + randomUUID().replaceAll("-", "");

async function fixture() {
  const tenantId = id("tenant"), otherTenantId = id("tenant");
  const orgId = id("org"), foreignOrgId = id("org"), workerOrgId = id("org"), otherTenantOrgId = id("org");
  const userId = id("user"), foreignUserId = id("user"), workerUserId = id("user"), otherTenantUserId = id("user");
  await prisma.tenant.createMany({ data: [
    { id: tenantId, slug: tenantId, name: "Disposable owner QA" },
    { id: otherTenantId, slug: otherTenantId, name: "Disposable other tenant" },
  ] });
  await prisma.org.createMany({ data: [
    { id: orgId, tenantId, name: "Owner", type: "CLIENT" },
    { id: foreignOrgId, tenantId, name: "Foreign", type: "CLIENT" },
    { id: workerOrgId, tenantId, name: "Worker", type: "OPS" },
    { id: otherTenantOrgId, tenantId: otherTenantId, name: "Foreign tenant", type: "CLIENT" },
  ] });
  await prisma.user.createMany({ data: [userId, foreignUserId, workerUserId, otherTenantUserId]
    .map(v => ({ id: v, email: v + "@example.invalid", status: "active" })) });
  const owner = { tenantId, orgId, userId };
  const foreign = { tenantId, orgId: foreignOrgId, userId: foreignUserId };
  const worker = { tenantId, orgId: workerOrgId, userId: workerUserId };
  const otherTenant = { tenantId: otherTenantId, orgId: otherTenantOrgId, userId: otherTenantUserId };
  return {
    owner, foreign, worker, otherTenant, otherTenantId,
    async create(agentType: "risk" | "pricing" = "risk") {
      return runs.create({ ...owner, agentType, triggerType: "manual",
        correlationId: id("corr"), input: { testOnly: true } });
    },
    async cleanup() {
      await prisma.agentRun.deleteMany({ where: { tenantId } });
      await prisma.user.deleteMany({ where: { id: { in: [userId, foreignUserId, workerUserId, otherTenantUserId] } } });
      await prisma.org.deleteMany({ where: { id: { in: [orgId, foreignOrgId, workerOrgId, otherTenantOrgId] } } });
      await prisma.tenant.deleteMany({ where: { id: { in: [tenantId, otherTenantId] } } });
    },
  };
}

dbTest("org A sees its run, org B is excluded from list/detail/events/cancel/retry", async () => {
  const f = await fixture();
  try {
    const run = await f.create();
    assert.equal(run.orgId, f.owner.orgId);
    assert.ok((await runs.list(f.owner)).some(x => x.id === run.id));
    assert.ok(!(await runs.list(f.foreign)).some(x => x.id === run.id));
    assert.equal((await runs.findById({ ...f.owner, runId: run.id })).id, run.id);
    for (const action of [
      () => runs.findById({ ...f.foreign, runId: run.id }),
      () => runs.getEvents({ ...f.foreign, runId: run.id }),
      () => runs.cancel({ ...f.foreign, runId: run.id }),
      () => runs.retry({ ...f.foreign, runId: run.id }),
      () => runs.start({ ...f.foreign, runId: run.id }),
      () => runs.complete({ ...f.foreign, runId: run.id, output: { summary: "foreign" } }),
      () => runs.fail({ ...f.foreign, runId: run.id, error: "foreign" }),
      () => runs.findById({ ...f.otherTenant, runId: run.id }),
      () => ops.retryAgentRun({ ...f.foreign, runId: run.id }),
      () => ops.requeueAgentRun({ ...f.foreign, runId: run.id }),
    ]) await assert.rejects(action, (error: any) => error?.getStatus?.() === 404);
    assert.equal((await runs.getEvents({ ...f.owner, runId: run.id })).runId, run.id);
    assert.ok(!(await ops.listAgentRuns({ ...f.foreign, limit: 20 })).some(x => x.id === run.id));
    assert.ok(!(await events.listAgentRunsByCorrelationId({ ...f.foreign, correlationId: run.correlationId }))
      .some(x => x.id === run.id));
  } finally { await f.cleanup(); }
});

dbTest("legacy AgentRun with NULL orgId is not inferred from correlation or JSON", async () => {
  const f = await fixture();
  try {
    const legacy = await prisma.agentRun.create({ data: {
      tenantId: f.owner.tenantId, agentType: "pricing", triggerType: "event",
      inputJson: { operatorContext: { orgId: f.owner.orgId } },
      correlationId: id("corr"), status: "COMPLETED",
    } });
    assert.ok(!(await runs.list(f.owner)).some(x => x.id === legacy.id));
    await assert.rejects(
      () => runs.findById({ ...f.owner, runId: legacy.id }),
      (error: any) => error?.getStatus?.() === 404,
    );
    assert.ok(!(await ops.listAgentRuns({ ...f.owner, limit: 20 })).some(x => x.id === legacy.id));
  } finally { await f.cleanup(); }
});

dbTest("verified worker access can complete owned run without a cross-org human read", async () => {
  const f = await fixture();
  try {
    const run = await f.create("pricing");
    assert.equal((await runs.findByIdForWorker({ ...f.worker, runId: run.id })).id, run.id);
    const claim = await runs.claimNext({ ...f.worker, runId: run.id, workerId: "worker-test-1153" });
    assert.equal(claim?.id, run.id);
    assert.ok(claim && claim.attempts >= 1);
    await assert.rejects(
      () => runs.heartbeat({ ...f.worker, runId: run.id, workerId: "worker-test-1153", expectedAttempts: claim!.attempts }),
      (error: any) => error?.getStatus?.() === 404,
    );
    await runs.heartbeat({ ...f.worker, runId: run.id, workerId: "worker-test-1153",
      expectedAttempts: claim!.attempts, workerAccess: true });
    await assert.rejects(
      () => runs.complete({ ...f.worker, runId: run.id, workerId: "worker-test-1153",
        expectedAttempts: claim!.attempts - 1, workerAccess: true, output: { summary: "stale" } }),
      (error: any) => error?.getStatus?.() === 409,
    );
    const done = await runs.complete({ ...f.worker, runId: run.id, workerId: "worker-test-1153",
      expectedAttempts: claim!.attempts, workerAccess: true, output: { summary: "safe" } });
    assert.equal(done.status, "completed");
    await assert.rejects(
      () => runs.findById({ ...f.worker, runId: run.id }),
      (error: any) => error?.getStatus?.() === 404,
    );
  } finally { await f.cleanup(); }
});

test.after(async () => { await prisma.$disconnect(); });
