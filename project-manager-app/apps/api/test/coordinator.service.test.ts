import test from "node:test";
import assert from "node:assert/strict";
import { CoordinatorService } from "../dist/modules/agents/coordinator.service.js";

// ── Mock builders ─────────────────────────────────────────────────────────────

function makeDelegation(overrides: Record<string, unknown> = {}) {
  const now = new Date();
  return {
    id: `del_${Math.random().toString(36).slice(2)}`,
    tenantId: "tnt_t",
    orgId: "org_t",
    coordinatorId: "project-copilot",
    targetAgentId: "field-ops",
    taskTitle: "Revisar evidencia de demolición",
    status: "pending",
    projectId: "proj_1",
    sourceRunId: null,
    targetRunId: null,
    resultJson: null,
    error: null,
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}

function makeDelegationService(delegations: ReturnType<typeof makeDelegation>[] = []) {
  const spawned: Array<{ targetAgentId: string; taskTitle: string }> = [];
  return {
    get spawned() { return spawned; },
    service: {
      async delegateTask(input: { targetAgentId: string; taskTitle: string }) {
        spawned.push({ targetAgentId: input.targetAgentId, taskTitle: input.taskTitle });
        const del = makeDelegation({ targetAgentId: input.targetAgentId, taskTitle: input.taskTitle });
        return { delegation: del, run: { id: `run_${del.id}` } };
      },
      async getTask({ delegationId }: { delegationId: string }) {
        return delegations.find((d) => d.id === delegationId) ?? null;
      },
      async listByCoordinator(_input: unknown) {
        return delegations;
      },
      async listByProject(_input: unknown) {
        return delegations;
      },
      buildDelegationContext(items: Array<{ id: string; targetAgentId: string; taskTitle: string; status: string; resultJson: unknown; error?: string | null }>) {
        const done = items.filter((d) => d.status === "completed" || d.status === "failed");
        if (done.length === 0) return "";
        const lines = ["## Resultados de agentes especializados"];
        for (const d of done) {
          const glyph = d.status === "completed" ? "✓" : "✗";
          lines.push(`${glyph} [${d.targetAgentId}] ${d.taskTitle}`);
          if (d.status === "completed" && d.resultJson) {
            lines.push(`  Resultado: ${JSON.stringify(d.resultJson).slice(0, 100)}`);
          } else if (d.status === "failed" && d.error) {
            lines.push(`  Error: ${d.error.slice(0, 100)}`);
          }
        }
        const pending = items.filter((d) => d.status === "pending" || d.status === "executing");
        if (pending.length > 0) {
          lines.push(`\n${pending.length} tarea(s) en ejecución: ${pending.map((d) => d.taskTitle).join(", ")}`);
        }
        return lines.join("\n");
      },
    },
  };
}

function makeCoordinator(delegations: ReturnType<typeof makeDelegation>[] = []) {
  const { service, spawned } = makeDelegationService(delegations);
  return { coordinator: new CoordinatorService(service as never), spawned };
}

// ── spawnTasks ────────────────────────────────────────────────────────────────

test("spawnTasks spawns one task per entry", async () => {
  const { coordinator, spawned } = makeCoordinator();
  const results = await coordinator.spawnTasks({
    tenantId: "tnt_t", orgId: "org_t", userId: "usr_t",
    coordinatorId: "project-copilot", projectId: "proj_1",
    requestId: "req_1",
    tasks: [
      { targetAgentId: "field-ops",  taskTitle: "Revisar evidencia", taskContextJson: {} },
      { targetAgentId: "trust-match", taskTitle: "Calcular trust",   taskContextJson: {} },
    ],
  });
  assert.equal(results.length, 2);
  assert.equal(spawned.length, 2);
  assert.equal(spawned[0]?.targetAgentId, "field-ops");
  assert.equal(spawned[1]?.targetAgentId, "trust-match");
});

test("spawnTasks returns pending status for all new tasks", async () => {
  const { coordinator } = makeCoordinator();
  const results = await coordinator.spawnTasks({
    tenantId: "tnt_t", orgId: "org_t", userId: "usr_t",
    coordinatorId: "project-copilot",
    requestId: "req_2",
    tasks: [{ targetAgentId: "field-ops", taskTitle: "Tarea de campo", taskContextJson: {} }],
  });
  assert.equal(results[0]?.status, "pending");
  assert.ok(results[0]?.delegationId.length > 0);
  assert.ok(results[0]?.runId.length > 0);
});

test("spawnTasks spawns zero tasks when tasks array is empty", async () => {
  const { coordinator, spawned } = makeCoordinator();
  const results = await coordinator.spawnTasks({
    tenantId: "tnt_t", orgId: "org_t", userId: "usr_t",
    coordinatorId: "project-copilot", requestId: "req_3", tasks: [],
  });
  assert.equal(results.length, 0);
  assert.equal(spawned.length, 0);
});

// ── collectProjectSnapshot ────────────────────────────────────────────────────

test("collectProjectSnapshot returns correct counters", async () => {
  const delegations = [
    makeDelegation({ status: "completed" }),
    makeDelegation({ status: "completed" }),
    makeDelegation({ status: "executing" }),
    makeDelegation({ status: "pending" }),
    makeDelegation({ status: "failed" }),
  ];
  const { coordinator } = makeCoordinator(delegations);
  const snapshot = await coordinator.collectProjectSnapshot({
    tenantId: "tnt_t", coordinatorId: "project-copilot", projectId: "proj_1",
  });
  assert.equal(snapshot.totalDelegations, 5);
  assert.equal(snapshot.completed, 2);
  assert.equal(snapshot.executing, 1);
  assert.equal(snapshot.pending, 1);
  assert.equal(snapshot.failed, 1);
});

test("collectProjectSnapshot contextBlock is empty when no completed/failed tasks", async () => {
  const delegations = [makeDelegation({ status: "pending" }), makeDelegation({ status: "executing" })];
  const { coordinator } = makeCoordinator(delegations);
  const snapshot = await coordinator.collectProjectSnapshot({
    tenantId: "tnt_t", coordinatorId: "project-copilot", projectId: "proj_1",
  });
  assert.equal(snapshot.contextBlock, "");
});

test("collectProjectSnapshot contextBlock includes completed task summaries", async () => {
  const delegations = [
    makeDelegation({ status: "completed", targetAgentId: "field-ops", taskTitle: "Revisar evidencia", resultJson: { summary: "Evidencia completa con 3 fotos." } }),
    makeDelegation({ status: "failed",    targetAgentId: "trust-match", taskTitle: "Calcular trust", error: "Timeout en cálculo." }),
  ];
  const { coordinator } = makeCoordinator(delegations);
  const snapshot = await coordinator.collectProjectSnapshot({
    tenantId: "tnt_t", coordinatorId: "project-copilot", projectId: "proj_1",
  });
  assert.ok(snapshot.contextBlock.includes("field-ops"), "should include agent id");
  assert.ok(snapshot.contextBlock.includes("Revisar evidencia"), "should include task title");
  assert.ok(snapshot.contextBlock.includes("✓"), "should mark completed with checkmark");
  assert.ok(snapshot.contextBlock.includes("✗"), "should mark failed with X");
});

// ── buildContextBlock ─────────────────────────────────────────────────────────

test("buildContextBlock returns empty string for empty snapshot", () => {
  const { coordinator } = makeCoordinator();
  const block = coordinator.buildContextBlock({
    projectId: "proj_1", totalDelegations: 0,
    completed: 0, executing: 0, pending: 0, failed: 0,
    delegations: [], contextBlock: "",
  });
  assert.equal(block, "");
});

test("buildContextBlock includes coordinator header when there are delegations", () => {
  const { coordinator } = makeCoordinator();
  const block = coordinator.buildContextBlock({
    projectId: "proj_1", totalDelegations: 2,
    completed: 1, executing: 0, pending: 1, failed: 0,
    delegations: [],
    contextBlock: "## Resultados de agentes especializados\n✓ [field-ops] Revisar evidencia",
  });
  assert.ok(block.includes("Coordinación"), "should include coordinator header");
  assert.ok(block.includes("1/2"), "should show progress");
});

// ── getTask ───────────────────────────────────────────────────────────────────

test("getTask returns null for unknown delegation", async () => {
  const { coordinator } = makeCoordinator([]);
  const result = await coordinator.getTask({ tenantId: "tnt_t", delegationId: "del_unknown" });
  assert.equal(result, null);
});

test("getTask returns record for known delegation", async () => {
  const del = makeDelegation({ id: "del_known", status: "completed" });
  const { coordinator } = makeCoordinator([del]);
  const result = await coordinator.getTask({ tenantId: "tnt_t", delegationId: "del_known" });
  assert.ok(result !== null);
  assert.equal(result.id, "del_known");
  assert.equal(result.status, "completed");
});

// ── listByProject ─────────────────────────────────────────────────────────────

test("listByProject returns all delegations for the project", async () => {
  const delegations = [
    makeDelegation({ projectId: "proj_A" }),
    makeDelegation({ projectId: "proj_A" }),
    makeDelegation({ projectId: "proj_A" }),
  ];
  const { coordinator } = makeCoordinator(delegations);
  const result = await coordinator.listByProject({ tenantId: "tnt_t", projectId: "proj_A" });
  assert.equal(result.length, 3);
  for (const d of result) assert.equal(d.projectId, "proj_A");
});
