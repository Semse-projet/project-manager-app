import "reflect-metadata";
import test from "node:test";
import assert from "node:assert/strict";
import { AgentRunFinalizationConsumer, AGENT_RUN_EFFECTS_CONSUMER }
  from "../dist/modules/domain-events/agent-run-finalization.consumer.js";
import { randomUUID } from "node:crypto";

test("finalization consumer uses a durable receipt and rolls back on source mismatch",async()=>{
  const eventId=randomUUID();
  let commits=0;
  const tx={
    async $executeRaw(){return 1;},
    async $queryRaw(){return [{id:"receipt_1",status:"PENDING",resultJson:null}];},
    agentRun:{async findFirst(){return null}},
  };
  const consumer=new AgentRunFinalizationConsumer({
    async $transaction(fn: (tx: unknown)=>Promise<unknown>){const r=await fn(tx);commits++;return r;},
  } as never);
  await assert.rejects(consumer.consume({
    eventId,eventType:"agent.run.finalized.v1",version:1,envelopeVersion:2,
    occurredAt:new Date("2026-11-08T00:00:00.000Z"),recordedAt:new Date("2026-11-08T00:00:00.000Z"),
    tenantId:"tenant_a",orgId:"org_a",module:"agents",entityType:"AgentRun",entityId:"run_1",
    actorType:"user",actorId:"user_1",correlationId:"corr_1",
    idempotencyKey:"idem_1",schemaRef:"semse://schemas/events/agent.run.finalized.v1",
    payloadJson:{runId:"run_1",terminalStatus:"COMPLETED",attempts:1,requestId:"req_1"},
  } as never),(e:unknown)=>String(e).includes("source changed"));
  assert.equal(commits,0);
  assert.equal(AGENT_RUN_EFFECTS_CONSUMER,"agent-run-effects.v1");
});
