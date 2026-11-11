import "reflect-metadata";
import test from "node:test";
import assert from "node:assert/strict";
import { AGENT_RUN_FINALIZED_V1_SCHEMA_REF, agentRunFinalizedV1EventSchema } from "@semse/schemas";
import { isAgentRunFinalizationOutboxEnabled, createAgentRunFinalizationEvent }
  from "../dist/modules/agents/agent-run-finalization.policy.js";

test("finalization producer remains OFF by default", () => {
  assert.equal(isAgentRunFinalizationOutboxEnabled({} as NodeJS.ProcessEnv), false);
  assert.equal(isAgentRunFinalizationOutboxEnabled({ SEMSE_AGENT_RUN_FINALIZATION_OUTBOX_ENABLED:"false" } as NodeJS.ProcessEnv), false);
  assert.equal(isAgentRunFinalizationOutboxEnabled({ SEMSE_AGENT_RUN_FINALIZATION_OUTBOX_ENABLED:"true" } as NodeJS.ProcessEnv), true);
});
test("finalization event contract binds run, generation and terminal state", () => {
  const event = createAgentRunFinalizationEvent({
    tenantId:"tenant_a",orgId:"org_a",userId:"service_a",requestId:"req_a",
    runId:"run_a",attempts:2,correlationId:"cor_a",status:"COMPLETED",
  });
  assert.equal(event.schemaRef, AGENT_RUN_FINALIZED_V1_SCHEMA_REF);
  assert.equal(event.payload.terminalStatus,"COMPLETED");
  assert.equal(agentRunFinalizedV1EventSchema.safeParse({...event,entityId:"run_b"}).success,false);
  assert.equal(agentRunFinalizedV1EventSchema.safeParse({...event,payload:{...event.payload, attempts:-1}}).success,false);
  assert.equal(agentRunFinalizedV1EventSchema.safeParse({...event,payload:{...event.payload, terminalStatus:"RUNNING"}}).success,false);
});
