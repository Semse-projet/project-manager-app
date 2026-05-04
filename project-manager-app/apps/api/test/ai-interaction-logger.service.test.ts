import test from "node:test";
import assert from "node:assert/strict";
import { AiInteractionLoggerService } from "../dist/modules/ai-models/logging/ai-interaction-logger.service.js";

function createService() {
  const persistedRows: Array<Record<string, unknown>> = [];
  const createdRows: Array<Record<string, unknown>> = [];

  const prisma = {
    aiInteractionLog: {
      async create(input: { data: Record<string, unknown> }) {
        createdRows.push(input.data);
        return input.data;
      },
      async findMany(input?: { select?: Record<string, boolean> }) {
        if (input?.select) {
          return persistedRows.map((row) => ({
            provider: row.provider,
            modelSlug: row.modelSlug,
            fallbackUsed: row.fallbackUsed,
            success: row.success,
          }));
        }
        return persistedRows;
      },
      async count(input?: { where?: { success?: boolean } }) {
        if (input?.where?.success === true) {
          return persistedRows.filter((row) => row.success === true).length;
        }
        return persistedRows.length;
      },
      async groupBy(input: { by: string[]; _count: { id: boolean } }) {
        const key = input.by[0] as "modelSlug" | "taskType";
        const grouped = new Map<string, number>();
        for (const row of persistedRows) {
          const value = String(row[key] ?? "");
          grouped.set(value, (grouped.get(value) ?? 0) + 1);
        }
        return Array.from(grouped.entries()).map(([value, count]) => ({
          [key]: value,
          _count: { id: count },
        }));
      },
    },
  };

  return {
    service: new AiInteractionLoggerService(prisma as never),
    persistedRows,
    createdRows,
  };
}

test("logger classifies context guard interactions as context_only", async () => {
  const { service, createdRows } = createService();

  await service.logSyntheticInteraction({
    tenantId: "tenant_default",
    agentId: "assistant",
    taskType: "project_planning",
    provider: "semse-context",
    modelSlug: "prometeo-context-guard",
    input: "estado del proyecto",
    output: "No tengo proyecto seleccionado.",
  });

  const recent = service.getRecentLogs(1)[0];
  assert.equal(recent?.mode, "context_only");
  assert.equal(createdRows.length, 1);
});

test("logger maps persisted rows to report/runtime/fallback modes", async () => {
  const { service, persistedRows } = createService();

  persistedRows.push(
    {
      id: "log_report",
      tenantId: "tenant_default",
      agentId: "assistant",
      projectId: "proj_1",
      userId: "usr_1",
      taskType: "document_summary",
      provider: "semse-context",
      modelSlug: "prometeo-operational-report",
      modelName: "Prometeo Operational Report",
      inputLength: 20,
      outputLength: 40,
      inputTokens: null,
      outputTokens: null,
      estimatedCostUsd: null,
      latencyMs: 12,
      routeReason: "SEMSE Core: operational_report",
      fallbackUsed: false,
      success: true,
      errorMessage: null,
      threadId: "thr_1",
      eligibleForTraining: false,
      createdAt: new Date("2026-05-01T10:00:00.000Z"),
    },
    {
      id: "log_fallback",
      tenantId: "tenant_default",
      agentId: "assistant",
      projectId: "proj_1",
      userId: "usr_1",
      taskType: "general_chat",
      provider: "anthropic",
      modelSlug: "claude-sonnet",
      modelName: "Claude",
      inputLength: 20,
      outputLength: 0,
      inputTokens: null,
      outputTokens: null,
      estimatedCostUsd: null,
      latencyMs: 99,
      routeReason: "Default route",
      fallbackUsed: true,
      success: false,
      errorMessage: "timeout",
      threadId: "thr_2",
      eligibleForTraining: false,
      createdAt: new Date("2026-05-01T10:01:00.000Z"),
    },
  );

  const logs = await service.getDbLogs(10);
  assert.equal(logs[0]?.mode, "report");
  assert.equal(logs[1]?.mode, "fallback");
});

test("logger stats include byMode breakdown", async () => {
  const { service, persistedRows } = createService();

  persistedRows.push(
    {
      id: "log_runtime",
      tenantId: "tenant_default",
      agentId: "assistant",
      projectId: null,
      userId: "usr_1",
      taskType: "general_chat",
      provider: "anthropic",
      modelSlug: "claude-sonnet",
      modelName: "Claude",
      inputLength: 10,
      outputLength: 10,
      inputTokens: null,
      outputTokens: null,
      estimatedCostUsd: null,
      latencyMs: 10,
      routeReason: "Default route",
      fallbackUsed: false,
      success: true,
      errorMessage: null,
      threadId: "thr_a",
      eligibleForTraining: false,
      createdAt: new Date("2026-05-01T09:00:00.000Z"),
    },
    {
      id: "log_context",
      tenantId: "tenant_default",
      agentId: "assistant",
      projectId: null,
      userId: "usr_1",
      taskType: "project_planning",
      provider: "semse-context",
      modelSlug: "prometeo-context-guard",
      modelName: "Context Guard",
      inputLength: 12,
      outputLength: 12,
      inputTokens: null,
      outputTokens: null,
      estimatedCostUsd: null,
      latencyMs: 4,
      routeReason: "Pulse: no_project_selected",
      fallbackUsed: false,
      success: true,
      errorMessage: null,
      threadId: "thr_b",
      eligibleForTraining: false,
      createdAt: new Date("2026-05-01T09:01:00.000Z"),
    },
  );

  const stats = await service.getStats();
  assert.deepEqual(stats.byMode, {
    runtime: 1,
    context_only: 1,
  });
});
