import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import path from "node:path";
import { ProjectCopilotHarness } from "../dist/modules/agents/harnesses/project-copilot.harness.js";
import { AgentDelegationService } from "../dist/modules/agents/agent-delegation.service.js";
import { AgentsRepository } from "../dist/modules/agents/agents.repository.js";

// D5 (tool-call-audit-lineage): el copiloto abre un run padre de OBSERVABILIDAD por cada acción que pasa las compuertas.
// El worker toma cualquier run `QUEUED` (y `project-copilot` tiene handler propio) y `reclaim-stale` reencola los
// `RUNNING` sin latido, así que el run padre debe nacer TERMINAL: ni se ejecuta ni se reencola.

const actor = { tenantId: "t1", orgId: "org_client", userId: "u1", roles: ["CLIENT"] };
const runtime = { actor, requestId: "req_9", projectId: "p_mine", corpusStatus: { evidenceCount: 0 } };

function makeHarness(delegation: Record<string, unknown>) {
  const registered: Array<Record<string, any>> = [];
  const deps = {
    agentsService: { list: async () => [] },
    projectsRepository: {},
    auditService: { append: async () => {} },
    agentApprovalService: {
      register: async (input: Record<string, any>) => (registered.push(input), [{ id: "apr_1" }]),
    },
    milestonesRepository: {},
    milestonesService: {},
    disputesRepository: {},
    disputesService: {},
    paymentsService: {},
    agentMemory: {},
    planModeService: {},
    agentPolicy: {},
    planExecutionService: {},
    technicalRuntime: {},
    agentDelegationService: delegation,
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
  return { harness, registered };
}

test("D5: el run padre se abre con el proyecto, la acción y la solicitud, y se añade al runtime", async () => {
  const opened: Array<Record<string, unknown>> = [];
  const { harness } = makeHarness({ openParentRun: async (input: Record<string, unknown>) => (opened.push(input), "run_parent_1") });
  const scoped = await harness.withParentRun(runtime, "DELEGATE_TASK");
  assert.equal(scoped.parentRunId, "run_parent_1");
  assert.deepEqual(opened[0], {
    tenantId: "t1", orgId: "org_client", userId: "u1", requestId: "req_9", projectId: "p_mine", actionType: "DELEGATE_TASK",
  });
  assert.equal("parentRunId" in runtime, false, "no muta el runtime original");
});

test("D5: si el run padre no se puede registrar, la acción sigue sin él (la trazabilidad no es una compuerta)", async () => {
  const failing = makeHarness({ openParentRun: async () => { throw new Error("db"); } });
  assert.equal((await failing.harness.withParentRun(runtime, "X")).parentRunId, undefined);
  const missing = makeHarness({});
  assert.equal((await missing.harness.withParentRun(runtime, "X")).parentRunId, undefined);
  const empty = makeHarness({ openParentRun: async () => undefined });
  assert.equal((await empty.harness.withParentRun(runtime, "X")).parentRunId, undefined);
});

test("D5: la solicitud de aprobación y la delegación apuntan al run padre real", async () => {
  const calls: Array<Record<string, any>> = [];
  const { harness, registered } = makeHarness({
    delegateTask: async (input: Record<string, any>) => (calls.push(input), { delegation: { id: "dlg_1" }, run: { id: "run_t1" } }),
  });
  const scoped = { ...runtime, parentRunId: "run_parent_1" };

  await harness.registerApprovalRequest(scoped, "DELEGATE_TASK", {}, "high");
  assert.equal(registered[0]!.approvals[0].runId, "run_parent_1");

  await harness.executeDelegateTask(scoped, { agentRole: "legal-agent", task: "revisar" }, { approvalId: "apr_1" });
  assert.equal(calls[0]!.sourceRunId, "run_parent_1");
  assert.equal(calls[0]!.lineage.approvalId, "apr_1", "el lineage sigue siendo el origen durable");

  await harness.registerApprovalRequest(runtime, "DELEGATE_TASK", {}, "high");
  assert.match(registered[1]!.approvals[0].runId, /^copilot_action_p_mine_/, "sin run padre se conserva el id anterior");
});

test("D5: openParentRun registra un run terminal de project-copilot y devuelve su id; si falla, undefined", async () => {
  const recorded: Array<Record<string, any>> = [];
  const service = new AgentDelegationService(
    {} as never,
    { recordObservedRun: async (input: Record<string, any>) => (recorded.push(input), { id: "run_parent_1" }) } as never,
  );
  const id = await service.openParentRun({ tenantId: "t1", orgId: "o", userId: "u1", requestId: "req_9", projectId: "p_mine", actionType: "EDIT_FILE" });
  assert.equal(id, "run_parent_1");
  assert.equal(recorded[0]!.agentType, "project-copilot");
  assert.equal(recorded[0]!.correlationId, "copilot:req_9:EDIT_FILE");
  assert.equal(recorded[0]!.input.observedOnly, true);
  assert.equal(recorded[0]!.input.projectId, "p_mine");

  const broken = new AgentDelegationService({} as never, { recordObservedRun: async () => { throw new Error("db"); } } as never);
  assert.equal(await broken.openParentRun({ tenantId: "t1", orgId: "o", userId: "u1", requestId: "r", projectId: "p", actionType: "X" }), undefined);
});

test("D5: la ejecución tras aprobar hereda el run padre de la aprobación (no los ids anteriores a D5)", async () => {
  const seen: Array<string | undefined> = [];
  const { harness } = makeHarness({});
  harness.projectAccess = { assertProjectAccess: async () => {} };
  harness.resolveRuntime = async () => ({ ...runtime });
  harness.executeApprovedAction = async (rt: { parentRunId?: string }) => (seen.push(rt.parentRunId), "ok");
  harness.audit = async () => {};
  const context = JSON.stringify({ projectId: "p_mine", actionType: "DELEGATE_TASK", payload: {} });
  const base = { id: "apr_1", contextSummary: context, correlationId: "copilot:p_mine:DELEGATE_TASK:1" };

  await harness.executeFromApproval(actor, "req_9", { ...base, runId: "run_parent_1" });
  await harness.executeFromApproval(actor, "req_9", { ...base, runId: "copilot_action_p_mine_123" });
  await harness.executeFromApproval(actor, "req_9", base);
  assert.deepEqual(seen, ["run_parent_1", undefined, undefined]);
});

test("D5: el run padre nace terminal y ni el worker ni el barrido pueden tomarlo", async () => {
  const created: Array<Record<string, any>> = [];
  const repo = new AgentsRepository(
    { agentRun: { create: async ({ data }: { data: Record<string, any> }) => (created.push(data), { id: "run_1", ...data, workerId: null, deadLettered: false, toolCallCount: 0, createdAt: new Date(), updatedAt: new Date() }) } } as never,
    { ensureActorContext: async () => {} } as never,
  );
  const record = await repo.recordObservedRun({
    tenantId: "t1", orgId: "o", userId: "u1", agentType: "project-copilot" as never, correlationId: "copilot:r:X", input: { observedOnly: true },
  });
  const data = created[0]!;
  assert.equal(data.status, "COMPLETED");
  assert.equal(data.attempts, 0);
  assert.ok(data.startedAt && data.endedAt, "tiene inicio y fin: no queda como pendiente");
  assert.equal(record.status, "completed");

  // El contrato del que depende la garantía: solo se toman `QUEUED` y solo se reencolan `RUNNING`.
  const source = readFileSync(path.resolve(import.meta.dirname, "../src/modules/agents/agents.repository.ts"), "utf8");
  assert.match(source.slice(source.indexOf("async claimNext")), /status: "QUEUED"/);
  assert.match(source.slice(source.indexOf("async reclaimStale")), /status: "RUNNING"/);
});
