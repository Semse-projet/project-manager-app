import assert from "node:assert/strict";
import test from "node:test";
import { ProjectCopilotHarness } from "../dist/modules/agents/harnesses/project-copilot.harness.js";
import {
  COPILOT_TOOLS,
  effectiveActionPolicy,
  toolCallsToActions,
} from "../dist/modules/agents/harnesses/copilot-tools.js";
import { AgentDelegationService } from "../dist/modules/agents/agent-delegation.service.js";

// Reconciliación 2026-10-05 · H07 (la policy mostrada es la efectiva) y H08 (lineage de delegaciones).

// ── H07 ────────────────────────────────────────────────────────────────────

test("H07: toda acción propuesta muestra la policy efectiva del backend, no la propuesta de TOOL_META", () => {
  for (const tool of COPILOT_TOOLS as Array<{ name: string }>) {
    if (tool.name === "propose_plan") continue;
    const [action] = toolCallsToActions([{ toolUseId: "t", toolName: tool.name, input: {} }] as never);
    const effective = effectiveActionPolicy(action!.type);
    assert.equal(action!.approvalMode, effective.approvalMode, `${tool.name}: approvalMode`);
    assert.equal(action!.riskLevel, effective.riskLevel, `${tool.name}: riskLevel`);
  }
});

test("H07: las acciones técnicas (fuera de agentActionTypeSchema) se muestran high/required, no low/none", () => {
  for (const type of ["RUN_COMMAND", "RUN_BUILD", "RUN_TYPECHECK", "RUN_TESTS", "READ_FILE", "LIST_DIRECTORY", "SEARCH_PATTERNS", "EDIT_FILE", "DELEGATE_TASK", "RUN_BROWSER_MISSION"]) {
    assert.deepEqual(effectiveActionPolicy(type), { riskLevel: "high", approvalMode: "required" }, type);
  }
  const [read] = toolCallsToActions([{ toolUseId: "t", toolName: "read_file", input: { path: "a.ts" } }] as never);
  assert.equal(read!.approvalMode, "required", "antes se anunciaba 'none' (Ejecución directa) y el backend exigía aprobación");
});

test("H07: un tipo del catálogo conserva la policy de getActionPolicy (los alias no escalan ni rebajan autoridad)", () => {
  assert.equal(effectiveActionPolicy("PROPOSE_ESCROW_RELEASE").approvalMode, "required");
  assert.equal(effectiveActionPolicy("PROPOSE_MILESTONE_APPROVAL").approvalMode, "required");
  // un tipo desconocido nunca baja de high/required
  assert.deepEqual(effectiveActionPolicy("ALGO_NUEVO"), { riskLevel: "high", approvalMode: "required" });
});

// ── H08 ────────────────────────────────────────────────────────────────────

const actor = { tenantId: "t1", orgId: "org_client", userId: "u1", roles: ["CLIENT"] };
const runtime = { actor, requestId: "req_9", projectId: "p_mine", corpusStatus: { evidenceCount: 0 } };

function makeHarness(opts: { runs?: unknown[]; delegations?: unknown[] } = {}) {
  const delegateCalls: Array<Record<string, unknown>> = [];
  const deps = {
    agentsService: { list: async () => opts.runs ?? [] },
    projectsRepository: {},
    auditService: { append: async () => {} },
    agentApprovalService: {},
    milestonesRepository: {},
    milestonesService: {},
    disputesRepository: {},
    disputesService: {},
    paymentsService: {},
    agentMemory: {},
    planModeService: {},
    agentPolicy: {},
    planExecutionService: { resolveActionExecution: async () => ({ allowed: false }) },
    technicalRuntime: {},
    agentDelegationService: {
      delegateTask: async (input: Record<string, unknown>) => {
        delegateCalls.push(input);
        return { delegation: { id: "dlg_1" }, run: { id: "run_t1" } };
      },
      listByProject: async () => opts.delegations ?? [],
    },
    coordinatorService: {},
    usersRepository: {},
    workspaceMemoryRepository: {},
    prometeoService: {},
    operationalContextService: {},
    prometeoOrchestrator: {},
    browserAgentService: {},
    projectAccess: {},
  };
  const harness = new (ProjectCopilotHarness as unknown as new (...a: unknown[]) => Record<string, any>)(...Object.values(deps));
  return { harness, delegateCalls };
}

test("H08: la delegación declara su origen (solicitud, aprobación, actor y proyecto)", async () => {
  const { harness, delegateCalls } = makeHarness();
  await harness.executeApprovedAction(runtime, "DELEGATE_TASK", { agentRole: "legal-agent", task: "revisar contrato" }, undefined, {
    approvalId: "apr_7",
  });
  assert.equal(delegateCalls.length, 1);
  const call = delegateCalls[0]!;
  assert.equal(call.projectId, "p_mine");
  assert.equal(call.sourceRunId, undefined, "sin run padre registrado (D5 degradado) no se inventa uno");
  assert.deepEqual(call.lineage, {
    parent: "project-copilot",
    requestId: "req_9",
    approvalId: "apr_7",
    actorUserId: "u1",
    projectId: "p_mine",
  });
});

test("H08: el run delegado lleva projectId y lineage en su input (AgentDelegationService)", async () => {
  const created: Array<Record<string, any>> = [];
  const service = new AgentDelegationService(
    { create: async () => ({ id: "dlg_1" }), attachTargetRun: async () => {} } as never,
    { create: async (input: Record<string, any>) => (created.push(input), { id: "run_t1" }) } as never,
  );
  await service.delegateTask({
    tenantId: "t1",
    orgId: "org_client",
    userId: "u1",
    projectId: "p_mine",
    coordinatorId: "project-copilot",
    targetAgentId: "legal-agent",
    taskTitle: "x",
    taskContextJson: {},
    lineage: { parent: "project-copilot", approvalId: "apr_7" },
    requestId: "req_9",
  });
  assert.equal(created[0]!.input.projectId, "p_mine");
  assert.deepEqual(created[0]!.input.lineage, { parent: "project-copilot", approvalId: "apr_7" });
  assert.equal(created[0]!.input.delegationId, "dlg_1");
});

test("H08: los runs recientes del proyecto excluyen delegados de otros proyectos", async () => {
  const runs = [
    { id: "r_own", agentType: "project-copilot", status: "completed", input: { projectId: "p_mine" } },
    { id: "r_ctx", agentType: "x", status: "queued", input: { operatorContext: { workspaceId: "project:p_mine" } } },
    // delegado de ESTE proyecto: solo se reconoce por la delegación (el input antiguo no traía projectId)
    { id: "r_deleg_mine", agentType: "legal-agent", status: "executing", input: { delegationId: "dlg_1" } },
    // delegado de OTRO proyecto: tiene delegationId pero no pertenece a este proyecto
    { id: "r_deleg_other", agentType: "legal-agent", status: "executing", input: { delegationId: "dlg_9" } },
    { id: "r_other_ctx", agentType: "x", status: "queued", input: { operatorContext: { workspaceId: "project:p_other" } } },
    { id: "r_other", agentType: "x", status: "queued", input: { projectId: "p_other" } },
  ];
  const { harness } = makeHarness({ runs, delegations: [{ id: "dlg_1", targetRunId: "r_deleg_mine" }, { id: "dlg_2", targetRunId: null }] });
  const result = (await harness.resolveRecentRuns(actor, "p_mine")) as Array<{ id: string }>;
  assert.deepEqual(result.map((r) => r.id).sort(), ["r_ctx", "r_deleg_mine", "r_own"]);
});

test("H08: si no se pueden leer las delegaciones, los runs del proyecto siguen filtrándose sin mezclar otros", async () => {
  const { harness } = makeHarness({ runs: [{ id: "r_deleg", agentType: "x", status: "q", input: { delegationId: "d" } }, { id: "r_own", agentType: "x", status: "q", input: { projectId: "p_mine" } }] });
  harness.agentDelegationService.listByProject = async () => {
    throw new Error("db");
  };
  const result = (await harness.resolveRecentRuns(actor, "p_mine")) as Array<{ id: string }>;
  assert.deepEqual(result.map((r) => r.id), ["r_own"]);
});
