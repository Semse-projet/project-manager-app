import assert from "node:assert/strict";
import test from "node:test";
import { ProjectCopilotHarness } from "../dist/modules/agents/harnesses/project-copilot.harness.js";
import { ToolAuditUnavailableError } from "../dist/modules/prometeo/tool-governance/tool-call-audit.js";

// 0.42 / H05 pendiente (spec prometeo.tool-call-audit-lineage, D5 aceptada): las acciones que ejecuta el harness del
// copiloto pasan por el mismo ToolCallAuditor que las tools de Prometeo (source "project_copilot"), con el run padre
// D5, el proyecto, la aprobación y —tras aprobar— el mismo executionId con el que se reclamó la aprobación.

const actor = { tenantId: "t1", orgId: "org_client", userId: "u1", roles: ["CLIENT"] };
const runtime = { actor, requestId: "req_9", projectId: "p_mine", corpusStatus: { evidenceCount: 0 }, parentRunId: "run_parent_1" };

function withMode<T>(mode: string | undefined, fn: () => Promise<T>): Promise<T> {
  const previous = process.env.PROMETEO_TOOL_AUDIT_LIFECYCLE;
  if (mode === undefined) delete process.env.PROMETEO_TOOL_AUDIT_LIFECYCLE;
  else process.env.PROMETEO_TOOL_AUDIT_LIFECYCLE = mode;
  return fn().finally(() => {
    if (previous === undefined) delete process.env.PROMETEO_TOOL_AUDIT_LIFECYCLE;
    else process.env.PROMETEO_TOOL_AUDIT_LIFECYCLE = previous;
  });
}

function makeHarness(overrides: { failStart?: boolean; readTextFile?: () => Promise<string> } = {}) {
  const calls = { starts: [] as any[], terminals: [] as any[], invocations: [] as any[], delegated: 0, claims: [] as any[] };
  const repository = {
    async recordStart(input: any) {
      if (overrides.failStart) throw new Error("audit db down");
      calls.starts.push(input);
    },
    async recordTerminal(tenantId: string, executionId: string, patch: any) {
      calls.terminals.push({ tenantId, executionId, ...patch });
      return true;
    },
    async recordInvocation(input: any) { calls.invocations.push(input); },
  };
  const deps = {
    agentsService: {},
    projectsRepository: {},
    auditService: { append: async () => {} },
    agentApprovalService: {
      claimExecution: async (input: any) => (calls.claims.push(input), true),
      finishExecution: async () => true,
    },
    milestonesRepository: {}, milestonesService: {}, disputesRepository: {}, disputesService: {}, paymentsService: {},
    agentMemory: {}, planModeService: {}, agentPolicy: {},
    planExecutionService: { resolveActionExecution: async () => ({ allowed: false }) },
    technicalRuntime: { readTextFile: overrides.readTextFile ?? (async () => "hola") },
    agentDelegationService: {
      delegateTask: async () => { calls.delegated += 1; return { delegation: { id: "dlg_1" }, run: { id: "run_t1" } }; },
    },
    coordinatorService: {}, usersRepository: {}, workspaceMemoryRepository: {}, prometeoService: {},
    operationalContextService: {}, prometeoOrchestrator: {}, browserAgentService: {},
    projectAccess: { assertProjectAccess: async () => {} },
    toolGovernance: repository,
  };
  const harness = new (ProjectCopilotHarness as unknown as new (...a: unknown[]) => Record<string, any>)(...Object.values(deps));
  return { harness, calls };
}

test("shadow: a read action records start and a succeeded terminal with project, D5 run, approval and agent", () =>
  withMode("shadow", async () => {
    const { harness, calls } = makeHarness();
    const summary = await harness.executeApprovedAction(runtime, "READ_FILE", { path: "README.md" }, undefined, { approvalId: "apr_7" });
    assert.match(summary, /Contenido de 'README.md'/);
    assert.equal(calls.starts.length, 1);
    const start = calls.starts[0];
    assert.equal(start.source, "project_copilot");
    assert.equal(start.namespace, "project_copilot");
    assert.equal(start.name, "READ_FILE");
    assert.equal(start.mode, "read");
    assert.equal(start.projectId, "p_mine");
    assert.equal(start.runId, "run_parent_1");
    assert.equal(start.approvalId, "apr_7");
    assert.equal(start.agentId, "project-copilot");
    assert.equal(start.tenantId, "t1");
    assert.equal(start.actorId, "u1");
    assert.match(start.executionId, /^exec_/);
    assert.equal(calls.terminals.length, 1);
    assert.equal(calls.terminals[0].executionId, start.executionId);
    assert.equal(calls.terminals[0].status, "succeeded");
  }));

test("shadow: a handler exception is recorded as failed and still propagates", () =>
  withMode("shadow", async () => {
    const { harness, calls } = makeHarness({ readTextFile: async () => { throw new Error("ENOENT"); } });
    await assert.rejects(() => harness.executeApprovedAction(runtime, "READ_FILE", { path: "x" }), /ENOENT/);
    assert.equal(calls.terminals[0].status, "failed");
    assert.equal(calls.terminals[0].errorCode, "HANDLER_EXCEPTION");
  }));

test("shadow: an action without a real handler is recorded as blocked", () =>
  withMode("shadow", async () => {
    const { harness, calls } = makeHarness();
    await assert.rejects(() => harness.executeApprovedAction(runtime, "NOT_A_REAL_ACTION", {}));
    assert.equal(calls.terminals[0].status, "blocked");
  }));

test("off (default): nothing is written — same behaviour as before this change", () =>
  withMode(undefined, async () => {
    const { harness, calls } = makeHarness();
    await harness.executeApprovedAction(runtime, "READ_FILE", { path: "README.md" });
    await assert.rejects(() => harness.executeApprovedAction(runtime, "NOT_A_REAL_ACTION", {}));
    assert.equal(calls.starts.length + calls.terminals.length + calls.invocations.length, 0);
  }));

test("enforce: a write action whose start row cannot be persisted does not run (D1)", () =>
  withMode("enforce", async () => {
    const { harness, calls } = makeHarness({ failStart: true });
    await assert.rejects(
      () => harness.executeApprovedAction(runtime, "DELEGATE_TASK", { agentRole: "legal-agent", task: "revisar" }),
      ToolAuditUnavailableError,
    );
    assert.equal(calls.delegated, 0, "the delegation effect never ran");
  }));

test("enforce: a read action still runs when the start row fails (fail-open for reads, D1)", () =>
  withMode("enforce", async () => {
    const { harness } = makeHarness({ failStart: true });
    assert.match(await harness.executeApprovedAction(runtime, "READ_FILE", { path: "README.md" }), /Contenido/);
  }));

test("after approval: the audit row uses the same executionId the approval was claimed with", () =>
  withMode("shadow", async () => {
    const { harness, calls } = makeHarness();
    harness.resolveRuntime = async () => ({ ...runtime, parentRunId: undefined });
    const approval = {
      id: "apr_9",
      correlationId: "copilot:p_mine",
      runId: "run_parent_9",
      contextSummary: JSON.stringify({ projectId: "p_mine", actionType: "READ_FILE", payload: { path: "README.md" } }),
    };
    const result = await harness.executeFromApproval(actor, "req_1", approval);
    assert.equal(result.executed, true);
    assert.equal(calls.claims.length, 1);
    assert.equal(calls.starts[0].executionId, calls.claims[0].executionId);
    assert.equal(calls.starts[0].approvalId, "apr_9");
    assert.equal(calls.starts[0].runId, "run_parent_9");
  }));

test("manual retry (alreadyClaimed): the audit row reuses the id the controller claimed with", () =>
  withMode("shadow", async () => {
    const { harness, calls } = makeHarness();
    harness.resolveRuntime = async () => ({ ...runtime });
    const approval = {
      id: "apr_10",
      correlationId: "copilot:p_mine",
      contextSummary: JSON.stringify({ projectId: "p_mine", actionType: "READ_FILE", payload: { path: "a" } }),
    };
    await harness.executeFromApproval(actor, "req_2", approval, { alreadyClaimed: true, executionId: "exec_from_controller" });
    assert.equal(calls.claims.length, 0, "the harness does not claim a second time");
    assert.equal(calls.starts[0].executionId, "exec_from_controller");
  }));
