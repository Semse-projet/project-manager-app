import assert from "node:assert/strict";
import test from "node:test";

import { AgentsRepository } from "../dist/modules/agents/agents.repository.js";

type AgentRunRow = {
  id: string;
  tenantId: string;
  agentType: string;
  triggerType: string;
  inputJson: Record<string, unknown>;
  status: string;
  correlationId: string;
  workerId: string | null;
  attempts: number;
  maxAttempts: number;
  deadLettered: boolean;
  outputJson: Record<string, unknown> | null;
  error: string | null;
  startedAt: Date | null;
  heartbeatAt: Date | null;
  endedAt: Date | null;
  durationMs: number | null;
  toolCallCount: number;
  createdAt: Date;
  updatedAt: Date;
};

type AgentRunCall = {
  where?: Record<string, unknown>;
  data?: Record<string, unknown>;
  orderBy?: Record<string, unknown>;
  take?: number;
};

function runFixture(
  id: string,
  overrides: Partial<AgentRunRow> = {},
): AgentRunRow {
  const staleAt = new Date(Date.now() - 60_000);
  return {
    id,
    tenantId: "tenant_1",
    agentType: "prometeo",
    triggerType: "manual",
    inputJson: {},
    status: "RUNNING",
    correlationId: `correlation_${id}`,
    workerId: "worker_1",
    attempts: 1,
    maxAttempts: 3,
    deadLettered: false,
    outputJson: null,
    error: null,
    startedAt: staleAt,
    heartbeatAt: staleAt,
    endedAt: null,
    durationMs: null,
    toolCallCount: 0,
    createdAt: staleAt,
    updatedAt: staleAt,
    ...overrides,
  };
}

test("stale reclaim is transactional and skips runs changed after selection", async () => {
  const candidates = [
    runFixture("run_completed_race"),
    runFixture("run_requeue"),
    runFixture("run_dead_letter", { attempts: 3, maxAttempts: 3 }),
  ];
  const findManyCalls: AgentRunCall[] = [];
  const updateManyCalls: AgentRunCall[] = [];
  const updates = new Map<string, Record<string, unknown>>();
  let transactionCalls = 0;
  let actorContextCalls = 0;

  const transaction = {
    agentRun: {
      async findMany(input: AgentRunCall) {
        findManyCalls.push(input);
        return candidates;
      },
      async updateMany(input: AgentRunCall) {
        updateManyCalls.push(input);
        const runId = String(input.where?.id);
        if (runId === "run_completed_race") {
          return { count: 0 };
        }
        updates.set(runId, input.data ?? {});
        return { count: 1 };
      },
      async findFirst(input: AgentRunCall) {
        const runId = String(input.where?.id);
        const original = candidates.find((run) => run.id === runId);
        if (!original) return null;
        return {
          ...original,
          ...updates.get(runId),
          updatedAt: new Date(),
        };
      },
    },
  };
  const repository = new AgentsRepository(
    {
      async $transaction(callback: (tx: typeof transaction) => unknown) {
        transactionCalls++;
        return callback(transaction);
      },
    } as never,
    {
      async ensureActorContext() {
        actorContextCalls++;
      },
    } as never,
  );

  const result = await repository.reclaimStale({
    tenantId: "tenant_1",
    orgId: "org_ops",
    userId: "usr_ops",
    staleAfterMs: 10_000,
    maxItems: 10,
  });

  assert.equal(actorContextCalls, 1);
  assert.equal(transactionCalls, 1);
  assert.equal(findManyCalls.length, 1);
  assert.equal(findManyCalls[0]?.where?.tenantId, "tenant_1");
  assert.equal(findManyCalls[0]?.where?.status, "RUNNING");
  assert.equal(
    Array.isArray(findManyCalls[0]?.where?.OR),
    true,
    "candidate selection must filter stale heartbeat/start/update timestamps",
  );

  assert.equal(updateManyCalls.length, 3);
  for (const call of updateManyCalls) {
    assert.equal(call.where?.tenantId, "tenant_1");
    assert.equal(call.where?.status, "RUNNING");
    assert.equal(Array.isArray(call.where?.OR), true);
  }

  assert.deepEqual(
    result.map((run) => run.id),
    ["run_requeue", "run_dead_letter"],
  );
  assert.equal(result[0]?.status, "queued");
  assert.equal(result[0]?.correlationId, "correlation_run_requeue");
  assert.equal(result[0]?.deadLettered, false);
  assert.equal(result[1]?.status, "failed");
  assert.equal(result[1]?.deadLettered, true);
  assert.equal(result[1]?.error, "max attempts reached during stale reclaim");
});
