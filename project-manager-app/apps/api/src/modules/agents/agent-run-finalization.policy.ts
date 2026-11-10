import { randomUUID } from "node:crypto";
import {
  AGENT_RUN_FINALIZED_V1_SCHEMA_REF, agentRunFinalizedV1EventSchema,
} from "@semse/schemas";

export function isAgentRunFinalizationOutboxEnabled(env: NodeJS.ProcessEnv = process.env): boolean {
  return env.SEMSE_AGENT_RUN_FINALIZATION_OUTBOX_ENABLED === "true";
}

export function createAgentRunFinalizationEvent(input: {
  tenantId: string; orgId: string; userId: string; requestId?: string;
  runId: string; attempts: number; correlationId: string;
  status: "COMPLETED" | "FAILED";
}) {
  const now = new Date().toISOString();
  return agentRunFinalizedV1EventSchema.parse({
    eventId: randomUUID(), eventType: "agent.run.finalized.v1",
    version: 1, envelopeVersion: 2,
    occurredAt: now, recordedAt: now,
    tenantId: input.tenantId, orgId: input.orgId,
    module: "agents", entityType: "AgentRun", entityId: input.runId,
    actor: { type: "user", id: input.userId },
    correlationId: input.correlationId,
    idempotencyKey: ["agent-run-effects",input.runId,input.attempts,input.status].join(":"),
    schemaRef: AGENT_RUN_FINALIZED_V1_SCHEMA_REF,
    payload: {
      runId: input.runId, terminalStatus: input.status,
      attempts: input.attempts, requestId: input.requestId || input.correlationId,
    },
  });
}
