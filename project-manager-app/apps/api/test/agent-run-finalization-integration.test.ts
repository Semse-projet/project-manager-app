/**
 * AgentRun terminal CAS -> DomainOutboxEvent -> atomic effects receipts.
 * Strictly restricted to disposable loopback Postgres :5433.
 */
import "reflect-metadata";
import test from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { PrismaClient } from "@prisma/client";
import { AgentsRepository } from "../dist/modules/agents/agents.repository.js";
import { AgentRunFinalizationConsumer } from "../dist/modules/domain-events/agent-run-finalization.consumer.js";

function allowedDisposableDb(): boolean {
  if (!process.env.DATABASE_URL) return false;
  let url: URL;
  try { url = new URL(process.env.DATABASE_URL); } catch { return false; }
  if (!["postgresql:", "postgres:"].includes(url.protocol) ||
    !["127.0.0.1", "localhost", "[::1]"].includes(url.hostname) ||
    url.port !== "5433") return false;
  const database = decodeURIComponent(url.pathname.slice(1));
  if (process.env.GITHUB_ACTIONS === "true")
    return process.env.CI === "true" && url.hostname === "127.0.0.1" &&
      url.username === "semse" && database === "semse";
  return process.env.SEMSE_ALLOW_DISPOSABLE_AGENT_CLAIM_DB === "1" &&
    /^semse_(test|e2e)(?:_|$)/.test(database);
}
const allowed = allowedDisposableDb();
if ((process.env.GITHUB_ACTIONS === "true" && !allowed) ||
    (process.env.SEMSE_ALLOW_DISPOSABLE_AGENT_CLAIM_DB === "1" && !allowed)) {
  throw new Error("Finalization integration requires disposable loopback PostgreSQL :5433");
}
const dbTest = allowed ? test : test.skip;
const prisma = new PrismaClient();
const repo = new AgentsRepository(prisma as never,
  { async ensureActorContext() {} } as never);
const effects = new AgentRunFinalizationConsumer(prisma as never);
const uid = (p: string) => p + "_" + randomUUID().replaceAll("-", "");
async function fixture() {
  const tenantId = uid("ten_final"), userId = uid("usr_final");
  const run = await prisma.$transaction(async tx => {
    await tx.tenant.create({data:{id:tenantId,slug:tenantId,name:"Disposable Finalization Test"}});
    await tx.user.create({data:{id:userId,email:userId+"@example.invalid"}});
    return tx.agentRun.create({data:{
      tenantId,agentType:"pricing",triggerType:"manual",inputJson:{},
      correlationId:uid("corr"),status:"QUEUED",maxAttempts:3,
    }});
  });
  return {
    tenantId,userId,run,
    actor:{tenantId,orgId:"org_test",userId,runId:run.id,workerId:"worker_test"},
    async cleanup() {
      await prisma.domainEventConsumption.deleteMany({where:{tenantId}});
      await prisma.domainOutboxEvent.deleteMany({where:{tenantId}});
      await prisma.agentApproval.deleteMany({where:{tenantId}});
      await prisma.auditLog.deleteMany({where:{tenantId}});
      await prisma.workspaceMemoryEntry.deleteMany({where:{tenantId}});
      await prisma.agentDelegation.deleteMany({where:{tenantId}});
      await prisma.agentRun.deleteMany({where:{tenantId}});
      await prisma.user.delete({where:{id:userId}});
      await prisma.tenant.delete({where:{id:tenantId}});
    },
  };
}
async function claim(f: Awaited<ReturnType<typeof fixture>>) {
  const got = await repo.claimNext({
    tenantId:f.tenantId,orgId:"org_test",userId:f.userId,
    workerId:"worker_test",runId:f.run.id,
  });
  assert.equal(got?.attempts,1);
  return got!;
}
async function withDurableFlag(work:()=>Promise<void>) {
  const before=process.env.SEMSE_AGENT_RUN_FINALIZATION_OUTBOX_ENABLED;
  process.env.SEMSE_AGENT_RUN_FINALIZATION_OUTBOX_ENABLED="true";
  try { await work(); } finally {
    if (before===undefined) delete process.env.SEMSE_AGENT_RUN_FINALIZATION_OUTBOX_ENABLED;
    else process.env.SEMSE_AGENT_RUN_FINALIZATION_OUTBOX_ENABLED=before;
  }
}
dbTest("PostgreSQL finalization: single terminal state and outbox commit, receipt replay, retry after consumption",async()=>{
  await withDurableFlag(async()=>{
    const f=await fixture();
    try {
      await claim(f);
      const approvalId=uid("apr");
      const result=await repo.complete({
        ...f.actor,expectedAttempts:1,requestId:"req_final",
        output:{summary:"verified",approvals:[{
          id:approvalId,runId:f.run.id,correlationId:f.run.correlationId,
          agentType:"pricing",title:"Human review",reason:"High-risk run",
          status:"pending",riskLevel:"high",riskScore:0.8,
          requestedAt:new Date().toISOString(),policyDecision:"require_approval",
          requiredApprovals:["OPS_ADMIN"],
        }]},
      });
      assert.equal(result.status,"completed");
      const items=await prisma.domainOutboxEvent.findMany({
        where:{tenantId:f.tenantId,entityId:f.run.id,eventType:"agent.run.finalized.v1"},
      });
      assert.equal(items.length,1);
      assert.equal((items[0]?.payloadJson as any)?.attempts,1);
      await assert.rejects(repo.retry(f.actor),
        (error:unknown)=>(error as any)?.getStatus?.()===409,
        "terminal generation must be consumed before retry");
      const first=await effects.consume(items[0]!);
      assert.equal(first.effect,"updated");
      const repeated=await effects.consume(items[0]!);
      assert.equal(repeated.duplicate,true);
      assert.equal(await prisma.agentApproval.count({where:{tenantId:f.tenantId,runId:f.run.id}}),1);
      assert.equal(await prisma.auditLog.count({where:{tenantId:f.tenantId,entityId:f.run.id,action:"agent.run.complete"}}),1);
      assert.equal(await prisma.auditLog.count({where:{tenantId:f.tenantId,entityId:approvalId,action:"agent.approval.create"}}),1);
      assert.equal(await prisma.domainEventConsumption.count({
        where:{eventId:items[0]!.eventId,consumerName:"agent-run-effects.v1",status:"COMPLETED"},
      }),1);
      const retried=await repo.retry(f.actor);
      assert.equal(retried.status,"queued");
    } finally {await f.cleanup();}
  });
});
dbTest("PostgreSQL finalization: event insert conflict rolls back terminal state",async()=>{
  await withDurableFlag(async()=>{
    const f=await fixture();
    try {
      await claim(f);
      // Simulate a conflicting durable write after the terminal CAS inside
      // the same transaction. Unique (tenantId,idempotencyKey) forces rollback.
      await prisma.domainOutboxEvent.create({data:{
        eventId:randomUUID(),eventType:"agent.run.finalized.v1",
        version:1,envelopeVersion:2,
        tenantId:f.tenantId,orgId:"org_test",module:"agents",
        entityType:"AgentRun",entityId:f.run.id,
        actorType:"user",actorId:f.userId,correlationId:f.run.correlationId,
        idempotencyKey:["agent-run-effects",f.run.id,1,"COMPLETED"].join(":"),
        schemaRef:"semse://schemas/events/agent.run.finalized.v1",
        payloadJson:{runId:f.run.id,terminalStatus:"COMPLETED",attempts:1,requestId:"req_final"},
        occurredAt:new Date(),recordedAt:new Date(),
      }});
      await assert.rejects(repo.complete({
        ...f.actor,expectedAttempts:1,requestId:"req_final",
        output:{summary:"should rollback"},
      }));
      const persisted=await prisma.agentRun.findUniqueOrThrow({where:{id:f.run.id}});
      assert.equal(persisted.status,"RUNNING");
      assert.equal(persisted.outputJson,null);
    } finally {await f.cleanup();}
  });
});
