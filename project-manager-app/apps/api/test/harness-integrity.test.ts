import assert from "node:assert/strict";
import test from "node:test";
import { ConflictException, ForbiddenException, NotFoundException } from "@nestjs/common";
import { ActionNotExecutableError, ProjectCopilotHarness } from "../dist/modules/agents/harnesses/project-copilot.harness.js";
import {
  COPILOT_TOOLS,
  EXECUTABLE_ACTION_TYPES,
  getExposedCopilotTools,
} from "../dist/modules/agents/harnesses/copilot-tools.js";
import { AgentApprovalService } from "../dist/modules/agents/agent-approval.service.js";
import { AgentsController } from "../dist/modules/agents/agents.controller.js";
import { ProjectAccessService } from "../dist/modules/agents/project-access.service.js";

// Reconciliación 2026-10-05 · H01 (autorizar antes de decidir), H02 (sin handler ⇒ no completa), H03 (request_agent_help
// no afirma un envío inexistente) y H04 (un comando que falla no completa el paso).

const actor = { tenantId: "t1", orgId: "org_client", userId: "u1", roles: ["OPS_ADMIN"] };
const runtime = {
  actor,
  requestId: "req_1",
  projectId: "p_mine",
  workspace: {},
  context: {},
  journal: {},
  corpusStatus: { evidenceCount: 0 },
  activePlan: null,
};

function makeHarness(overrides: { exitCode?: number; projectAccess?: unknown } = {}) {
  const calls = {
    audit: [] as string[],
    register: 0,
    decide: 0,
    startStep: 0,
    completeStep: 0,
    failStep: [] as string[],
    bind: 0,
    runCommand: [] as string[],
  };
  const gate = { allowed: true, plan: { id: "plan1" }, step: { id: "step1", boundAction: undefined } };
  const deps = {
    agentsService: {},
    projectsRepository: {},
    auditService: { append: async (e: { action: string }) => void calls.audit.push(e.action) },
    agentApprovalService: {
      register: async () => {
        calls.register += 1;
        return [{ id: "apr1" }];
      },
      decide: async () => {
        calls.decide += 1;
        return { id: "apr1", status: "approved" };
      },
    },
    milestonesRepository: {},
    milestonesService: {},
    disputesRepository: {},
    disputesService: {},
    paymentsService: {},
    agentMemory: {},
    planModeService: {},
    agentPolicy: { checkActionAllowed: () => ({ allowed: true }) },
    planExecutionService: {
      resolveActionExecution: async () => gate,
      startStep: async () => void (calls.startStep += 1),
      completeStep: async () => void (calls.completeStep += 1),
      failStep: async (i: { reason: string }) => void calls.failStep.push(i.reason),
      bindActionToStep: async () => void (calls.bind += 1),
    },
    technicalRuntime: {
      runCommand: async (command: string) => {
        calls.runCommand.push(command);
        const exitCode = overrides.exitCode ?? 0;
        return { stdout: exitCode === 0 ? "BUILD OK" : "BUILD FAILED", stderr: exitCode === 0 ? "" : "error TS2322", exitCode };
      },
    },
    agentDelegationService: {},
    coordinatorService: {},
    usersRepository: {},
    workspaceMemoryRepository: {},
    prometeoService: {},
    operationalContextService: {},
    prometeoOrchestrator: {},
    browserAgentService: {},
    projectAccess: overrides.projectAccess ?? { assertProjectAccess: async () => {} },
  };
  const harness = new (ProjectCopilotHarness as unknown as new (...a: unknown[]) => Record<string, any>)(...Object.values(deps));
  return { harness, calls };
}

const NOT_EXECUTABLE = [
  "APPLY_PATCH",
  "REQUEST_AGENT_HELP",
  "DRAFT_MESSAGE",
  "REQUEST_MISSING_EVIDENCE",
  "EXPLORE_PROJECT",
  "INSPECT_STRUCTURE",
  "SUMMARIZE_FINDINGS",
  "INSPECT_TEST_FAILURE",
  "WAIT_BACKGROUND_TERMINAL",
  "READ_BACKGROUND_RESULT",
  "READ_CONTEXT",
];

test("H02/H03: una acción sin handler real se bloquea antes de aprobar, ligar pasos o completar nada", async () => {
  for (const actionType of NOT_EXECUTABLE) {
    const { harness, calls } = makeHarness();
    const out = await harness.handleAction(runtime, actionType, {});
    assert.equal(out.success, false, actionType);
    assert.match(out.message, /no está disponible/, actionType);
    assert.equal(calls.register, 0, `${actionType}: no registra aprobación`);
    assert.equal(calls.decide, 0, actionType);
    assert.equal(calls.startStep, 0, actionType);
    assert.equal(calls.completeStep, 0, `${actionType}: no completa ningún paso`);
    assert.equal(calls.bind, 0, actionType);
    assert.ok(calls.audit.includes("project.copilot.action.blocked_not_executable"), actionType);
  }
});

test("H02: el dispatch de una aprobación antigua sin handler lanza falla tipada, falla el paso y NO lo completa", async () => {
  const { harness, calls } = makeHarness();
  await assert.rejects(
    () => harness.executeApprovedAction(runtime, "APPLY_PATCH", {}, { planId: "plan1", stepId: "step1" }),
    (err: unknown) => err instanceof ActionNotExecutableError && err.actionType === "APPLY_PATCH",
  );
  assert.equal(calls.completeStep, 0);
  assert.equal(calls.failStep.length, 1);
  assert.match(calls.failStep[0]!, /no está disponible/);
});

test("H04: un build/test/typecheck con exitCode ≠ 0 falla el paso y nunca lo completa", async () => {
  for (const actionType of ["RUN_BUILD", "RUN_TESTS", "RUN_TYPECHECK", "RUN_COMMAND"]) {
    const { harness, calls } = makeHarness({ exitCode: 1 });
    await assert.rejects(
      () => harness.executeApprovedAction(runtime, actionType, { command: "ls src" }, { planId: "plan1", stepId: "step1" }),
      /exit 1/,
      actionType,
    );
    assert.equal(calls.completeStep, 0, `${actionType}: no completa`);
    assert.equal(calls.failStep.length, 1, actionType);
    assert.match(calls.failStep[0]!, /BUILD FAILED/, actionType);
  }
});

test("H04: con exitCode 0 el paso sí se completa una sola vez", async () => {
  const { harness, calls } = makeHarness({ exitCode: 0 });
  const summary = await harness.executeApprovedAction(runtime, "RUN_BUILD", {}, { planId: "plan1", stepId: "step1" });
  assert.match(summary, /exit 0/);
  assert.equal(calls.completeStep, 1);
  assert.equal(calls.failStep.length, 0);
});

test("H02: al modelo solo se le ofrecen herramientas con handler ejecutable; las definiciones se conservan", () => {
  const exposed = getExposedCopilotTools().map((t: { name: string }) => t.name);
  assert.ok(exposed.includes("propose_plan"));
  for (const hidden of [
    "request_missing_evidence",
    "draft_message",
    "explore_project",
    "inspect_structure",
    "summarize_findings",
    "apply_patch",
    "inspect_test_failure",
    "wait_background_terminal",
    "read_background_result",
    "request_agent_help",
  ]) {
    assert.equal(exposed.includes(hidden), false, `${hidden} no debe ofrecerse`);
  }
  assert.ok(exposed.includes("run_build") && exposed.includes("propose_escrow_release") && exposed.includes("delegate_task"));
  assert.equal(exposed.length, 1 + EXECUTABLE_ACTION_TYPES.size);
  assert.equal(COPILOT_TOOLS.length, 25, "las 25 definiciones siguen existiendo como diseño pendiente");
});

// ── H01 ────────────────────────────────────────────────────────────────────

const PROJECTS: Record<string, { tenantId: string; clientOrgId: string; assignedProOrgId: string }> = {
  p_mine: { tenantId: "t1", clientOrgId: "org_client", assignedProOrgId: "org_pro" },
  p_other_org: { tenantId: "t1", clientOrgId: "org_x", assignedProOrgId: "org_y" },
  p_other_tenant: { tenantId: "t2", clientOrgId: "org_client", assignedProOrgId: "org_pro" },
};
const access = new ProjectAccessService({
  resolveProjectScope: async (tenantId: string, projectId: string) => {
    const p = PROJECTS[projectId];
    return p && p.tenantId === tenantId ? p : null;
  },
} as never);
const approvalFor = (projectId: string) => ({
  correlationId: "copilot:x",
  contextSummary: JSON.stringify({ projectId, actionType: "RUN_COMMAND", payload: {} }),
});
const nonAdmin = { tenantId: "t1", orgId: "org_z", userId: "u_z", roles: ["CLIENT"] };

async function status(p: Promise<unknown>): Promise<number | "ok"> {
  try {
    await p;
    return "ok";
  } catch (e) {
    if (e instanceof NotFoundException) return 404;
    if (e instanceof ForbiddenException) return 403;
    throw e;
  }
}

test("H01: authorizeApprovalDecision exige participación en el proyecto de la aprobación del copiloto", async () => {
  const { harness } = makeHarness({ projectAccess: access });
  assert.equal(await status(harness.authorizeApprovalDecision(nonAdmin, approvalFor("p_other_org"))), 403);
  assert.equal(await status(harness.authorizeApprovalDecision(nonAdmin, approvalFor("p_other_tenant"))), 404);
  assert.equal(await status(harness.authorizeApprovalDecision(actor, approvalFor("p_mine"))), "ok");
  assert.equal(await status(harness.authorizeApprovalDecision(actor, approvalFor("p_other_tenant"))), 404, "OPS_ADMIN no cruza tenants");
  // aprobaciones que no son del copiloto no se ven afectadas
  assert.equal(await status(harness.authorizeApprovalDecision(nonAdmin, { correlationId: "run:abc" })), "ok");
});

test("H01: el controlador autoriza ANTES de persistir la decisión (sin scope ⇒ 403 y la decisión no se guarda)", async () => {
  const calls: string[] = [];
  const agentsService = {
    detailApproval: async () => approvalFor("p_other_org"),
    decideApproval: async () => {
      calls.push("decide");
      return { id: "a1", correlationId: "copilot:x", status: "approved" };
    },
  };
  const { harness } = makeHarness({ projectAccess: access });
  const noop = {} as never;
  const controller = new AgentsController(agentsService as never, harness as never, noop, noop, noop, access);
  const req = {
    headers: {},
    authContext: { tenantId: "t1", orgId: "org_z", userId: "u_z", roles: ["CLIENT"], requestId: "r" },
  };
  await assert.rejects(
    () => controller.decideApproval(req as never, "11111111-1111-4111-8111-111111111111", { decision: "approved" }),
    (e: unknown) => e instanceof ForbiddenException,
  );
  assert.deepEqual(calls, [], "decideApproval no debe ejecutarse");
});

function approvalServiceWith(updateCount: number) {
  const row = {
    id: "a1",
    tenantId: "t1",
    orgId: "org_client",
    runId: "run1",
    correlationId: "copilot:x",
    agentType: "project-copilot",
    title: "t",
    reason: "r",
    status: "PENDING",
    riskLevel: "high",
    riskScore: 80,
    requestedAt: new Date(),
    policyDecision: "require_approval",
    requiredApprovals: [],
    contextSummary: "{}",
    decisionComment: null,
    decidedAt: null,
    decidedByUserId: null,
  };
  const updates: unknown[] = [];
  const prisma = {
    agentApproval: {
      // La primera lectura ve PENDING (ambas decisiones concurrentes la ven); tras ganar el updateMany ya es APPROVED.
      findFirst: async () => ({ ...row, status: updates.length > 0 && updateCount === 1 ? "APPROVED" : "PENDING" }),
      updateMany: async (args: unknown) => {
        updates.push(args);
        return { count: updateCount };
      },
    },
  };
  const service = new AgentApprovalService(prisma as never, { ensureActorContext: async () => {} } as never, { append: async () => {} } as never);
  return { service, updates };
}
const decideInput = { tenantId: "t1", orgId: "org_client", userId: "u1", approvalId: "a1", decision: "approved" as const, requestId: "r" };

test("H01: la transición pending → decidido es condicional: la decisión perdedora recibe 409", async () => {
  const lost = approvalServiceWith(0);
  await assert.rejects(() => lost.service.decide(decideInput), ConflictException);
  const won = approvalServiceWith(1);
  const approved = await won.service.decide(decideInput);
  assert.equal(approved.status, "approved");
  const where = (won.updates[0] as { where: Record<string, unknown> }).where;
  assert.deepEqual(where, { id: "a1", tenantId: "t1", status: "PENDING" });
});
