import assert from "node:assert/strict";
import test from "node:test";
import { BadRequestException, ConflictException, ForbiddenException, NotFoundException } from "@nestjs/common";
import { AgentApprovalService } from "../dist/modules/agents/agent-approval.service.js";
import { AgentsController } from "../dist/modules/agents/agents.controller.js";
import { AuditMaintenanceService } from "../dist/modules/agents/audit-maintenance.service.js";
import { ProjectCopilotHarness } from "../dist/modules/agents/harnesses/project-copilot.harness.js";
import { ProjectAccessService } from "../dist/modules/agents/project-access.service.js";
import { ToolExecutionQueryService } from "../dist/modules/prometeo/tool-governance/tool-execution-query.service.js";

// H05 · entrega B: estado de ejecución de aprobaciones (reclamo condicional, recuperación sin reintento automático),
// consulta autorizada (D4) y barridos.

function withMode<T>(mode: string | undefined, run: () => Promise<T>): Promise<T> {
  const previous = process.env.PROMETEO_TOOL_AUDIT_LIFECYCLE;
  if (mode === undefined) delete process.env.PROMETEO_TOOL_AUDIT_LIFECYCLE;
  else process.env.PROMETEO_TOOL_AUDIT_LIFECYCLE = mode;
  return run().finally(() => {
    if (previous === undefined) delete process.env.PROMETEO_TOOL_AUDIT_LIFECYCLE;
    else process.env.PROMETEO_TOOL_AUDIT_LIFECYCLE = previous;
  });
}

// ── AgentApprovalService ───────────────────────────────────────────────────

function approvalRow(over: Record<string, unknown> = {}) {
  return {
    id: "a1",
    tenantId: "t1",
    orgId: "org1",
    runId: "run1",
    correlationId: "copilot:p1",
    agentType: "project-copilot",
    title: "t",
    reason: "r",
    status: "PENDING",
    riskLevel: "high",
    riskScore: 0.8,
    requestedAt: new Date(),
    policyDecision: "require_approval",
    requiredApprovals: [],
    contextSummary: "{}",
    decisionComment: null,
    decidedAt: null,
    decidedByUserId: null,
    ...over,
  };
}

function approvalService(opts: { count?: number; row?: Record<string, unknown> } = {}) {
  const updates: any[] = [];
  const prisma = {
    agentApproval: {
      findFirst: async () => approvalRow(opts.row),
      updateMany: async (args: any) => (updates.push(args), { count: opts.count ?? 1 }),
    },
  };
  const service = new AgentApprovalService(prisma as never, { ensureActorContext: async () => {} } as never, { append: async () => {} } as never);
  return { service, updates };
}
const decideInput = { tenantId: "t1", orgId: "org1", userId: "u1", approvalId: "a1", decision: "approved" as const, requestId: "r" };

test("decide: una aprobación del copiloto nace NOT_STARTED solo con el ciclo de vida activo", async () => {
  await withMode("shadow", async () => {
    const { service, updates } = approvalService();
    await service.decide(decideInput);
    assert.equal(updates[0].data.executionStatus, "NOT_STARTED");
  });
  await withMode(undefined, async () => {
    const { service, updates } = approvalService();
    await service.decide(decideInput);
    assert.equal("executionStatus" in updates[0].data, false, "con off (o migración sin aplicar) no se escriben columnas nuevas");
  });
  await withMode("shadow", async () => {
    const { service, updates } = approvalService({ row: { correlationId: "run:abc" } });
    await service.decide(decideInput);
    assert.equal("executionStatus" in updates[0].data, false, "solo las aprobaciones del copiloto");
    const rejected = approvalService();
    await rejected.service.decide({ ...decideInput, decision: "rejected" });
    assert.equal("executionStatus" in rejected.updates[0].data, false, "un rechazo no se ejecuta");
  });
});

test("claimExecution es condicional (APPROVED y estado de origen); la segunda reclamación pierde", async () => {
  const won = approvalService({ count: 1 });
  assert.equal(await won.service.claimExecution({ tenantId: "t1", approvalId: "a1", executionId: "exec_1", from: ["NOT_STARTED"] }), true);
  const where = won.updates[0].where;
  assert.deepEqual(where, { id: "a1", tenantId: "t1", status: "APPROVED", executionStatus: { in: ["NOT_STARTED"] } });
  assert.equal(won.updates[0].data.executionStatus, "EXECUTING");
  assert.equal(won.updates[0].data.executionId, "exec_1");
  const lost = approvalService({ count: 0 });
  assert.equal(await lost.service.claimExecution({ tenantId: "t1", approvalId: "a1", executionId: "exec_2", from: ["NOT_STARTED"] }), false);
});

test("finishExecution solo cierra una ejecución EXECUTING y acota el error", async () => {
  const { service, updates } = approvalService();
  await service.finishExecution({ tenantId: "t1", approvalId: "a1", status: "FAILED", error: "x".repeat(900) });
  assert.deepEqual(updates[0].where, { id: "a1", tenantId: "t1", executionStatus: "EXECUTING" });
  assert.equal(updates[0].data.executionStatus, "FAILED");
  assert.equal(updates[0].data.executionError.length, 500);
});

test("reconcileExecutions: EXECUTING caducada ⇒ FAILED/INTERRUPTED; NOT_STARTED caducada ⇒ FAILED/NOT_EXECUTED; sin reintentos", async () => {
  const { service, updates } = approvalService({ count: 2 });
  const olderThan = new Date("2026-10-05T12:00:00Z");
  const result = await service.reconcileExecutions({ olderThan, now: new Date("2026-10-05T13:00:00Z") });
  assert.deepEqual(result, { interrupted: 2, notExecuted: 2 });
  assert.equal(updates[0].where.executionStatus, "EXECUTING");
  assert.equal(updates[0].data.executionError, "INTERRUPTED");
  assert.equal(updates[1].where.executionStatus, "NOT_STARTED");
  assert.equal(updates[1].data.executionError, "NOT_EXECUTED");
  assert.ok(updates.every((u) => u.data.executionStatus === "FAILED"), "nunca vuelve a EXECUTING ni ejecuta nada solo");
});

// ── harness.executeFromApproval ────────────────────────────────────────────

const actor = { tenantId: "t1", orgId: "org1", userId: "u1", roles: ["OPS_ADMIN"] };
const approval = {
  id: "a1",
  correlationId: "copilot:p1",
  contextSummary: JSON.stringify({ projectId: "p1", actionType: "RUN_BUILD", payload: {} }),
};

function harnessWith(opts: { claim?: boolean; effect?: () => Promise<string> } = {}) {
  const calls = { claim: [] as any[], finish: [] as any[], effect: 0 };
  const deps = Array.from({ length: 22 }, () => ({}));
  (deps[3] as any) = {
    claimExecution: async (i: any) => (calls.claim.push(i), opts.claim ?? true),
    finishExecution: async (i: any) => (calls.finish.push(i), true),
  };
  (deps[2] as any) = { append: async () => {} };
  const access = { assertProjectAccess: async () => {} };
  const harness = new (ProjectCopilotHarness as unknown as new (...a: unknown[]) => Record<string, any>)(...deps, access);
  harness.resolveRuntime = async () => ({ actor, requestId: "r", projectId: "p1", corpusStatus: { evidenceCount: 0 } });
  harness.executeApprovedAction = async () => {
    calls.effect += 1;
    return opts.effect ? opts.effect() : "ok";
  };
  return { harness, calls };
}

test("executeFromApproval (shadow): reclama NOT_STARTED, ejecuta y cierra SUCCEEDED", async () => {
  await withMode("shadow", async () => {
    const { harness, calls } = harnessWith();
    const result = await harness.executeFromApproval(actor, "r", approval);
    assert.equal(result.executed, true);
    assert.deepEqual(calls.claim[0].from, ["NOT_STARTED"]);
    assert.match(calls.claim[0].executionId, /^exec_/);
    assert.equal(calls.finish[0].status, "SUCCEEDED");
    assert.equal(calls.effect, 1);
  });
});

test("executeFromApproval (shadow): si otra ejecución ya reclamó, NO ejecuta el efecto (como máximo una vez)", async () => {
  await withMode("shadow", async () => {
    const { harness, calls } = harnessWith({ claim: false });
    const result = await harness.executeFromApproval(actor, "r", approval);
    assert.equal(result.executed, false);
    assert.match(result.summary, /ya fue reclamada o ejecutada/);
    assert.equal(calls.effect, 0);
    assert.equal(calls.finish.length, 0);
  });
});

test("executeFromApproval (shadow): un efecto que falla cierra FAILED con el error y no relanza", async () => {
  await withMode("shadow", async () => {
    const { harness, calls } = harnessWith({ effect: async () => { throw new Error("milestone invariant"); } });
    const result = await harness.executeFromApproval(actor, "r", approval);
    assert.equal(result.executed, false);
    assert.equal(calls.finish[0].status, "FAILED");
    assert.match(calls.finish[0].error, /milestone invariant/);
  });
});

test("executeFromApproval: con alreadyClaimed (reintento manual) no vuelve a reclamar; con off no toca el estado", async () => {
  await withMode("shadow", async () => {
    const { harness, calls } = harnessWith();
    await harness.executeFromApproval(actor, "r", approval, { alreadyClaimed: true });
    assert.equal(calls.claim.length, 0);
    assert.equal(calls.finish[0].status, "SUCCEEDED");
  });
  await withMode(undefined, async () => {
    const { harness, calls } = harnessWith();
    const result = await harness.executeFromApproval(actor, "r", approval);
    assert.equal(result.executed, true);
    assert.equal(calls.claim.length + calls.finish.length, 0, "con off el comportamiento es el anterior");
  });
});

// ── reintento manual (controlador) ─────────────────────────────────────────

function retryController(over: { approval?: Record<string, unknown>; claim?: boolean; authorize?: () => Promise<void> } = {}) {
  const calls: string[] = [];
  const agentsService = {
    detailApproval: async () => ({ ...approval, status: "approved", ...(over.approval ?? {}) }),
    claimApprovalExecution: async (i: any) => (calls.push(`claim:${i.from.join(",")}`), over.claim ?? true),
  };
  const harness = {
    authorizeApprovalDecision: over.authorize ?? (async () => void calls.push("authorize")),
    executeFromApproval: async (_a: unknown, _r: unknown, _ap: unknown, o: any) => (calls.push(`execute:${o?.alreadyClaimed}`), { executed: true, summary: "ok" }),
  };
  const noop = {} as never;
  const controller = new AgentsController(agentsService as never, harness as never, noop, noop, noop, { assertProjectAccess: async () => {} } as never);
  const req = { headers: {}, authContext: { ...actor, requestId: "r" } };
  return { controller, calls, req };
}
const APPROVAL_ID = "11111111-1111-4111-8111-111111111111";

test("retry-execution: autoriza el proyecto, reclama FAILED→EXECUTING y ejecuta con alreadyClaimed", async () => {
  const { controller, calls, req } = retryController();
  const res: any = await controller.retryApprovalExecution(req as never, APPROVAL_ID);
  assert.deepEqual(calls, ["authorize", "claim:FAILED", "execute:true"]);
  assert.equal(res.data.executionResult.executed, true);
});

test("retry-execution: si la ejecución no está FAILED (doble clic o ya terminó) ⇒ 409 y no ejecuta", async () => {
  const { controller, calls, req } = retryController({ claim: false });
  await assert.rejects(() => controller.retryApprovalExecution(req as never, APPROVAL_ID), ConflictException);
  assert.equal(calls.some((c) => c.startsWith("execute")), false);
});

test("retry-execution: solo aprobaciones aprobadas del copiloto; sin scope ⇒ 403 antes de reclamar", async () => {
  const notCopilot = retryController({ approval: { correlationId: "run:abc" } });
  await assert.rejects(() => notCopilot.controller.retryApprovalExecution(notCopilot.req as never, APPROVAL_ID), BadRequestException);
  const rejected = retryController({ approval: { status: "rejected" } });
  await assert.rejects(() => rejected.controller.retryApprovalExecution(rejected.req as never, APPROVAL_ID), BadRequestException);
  const forbidden = retryController({ authorize: async () => { throw new ForbiddenException("x"); } });
  await assert.rejects(() => forbidden.controller.retryApprovalExecution(forbidden.req as never, APPROVAL_ID), ForbiddenException);
  assert.equal(forbidden.calls.some((c) => c.startsWith("claim")), false);
});

// ── consulta autorizada (D4) ───────────────────────────────────────────────

const PROJECTS: Record<string, { tenantId: string; clientOrgId: string; assignedProOrgId: string }> = {
  p_mine: { tenantId: "t1", clientOrgId: "org_client", assignedProOrgId: "org_pro" },
};
const access = {
  assertProjectFilter: async (a: { tenantId: string; orgId: string; roles: string[] }, projectId: string) => {
    const p = PROJECTS[projectId];
    if (!p || p.tenantId !== a.tenantId) throw new NotFoundException();
    if (!a.roles.includes("OPS_ADMIN") && ![p.clientOrgId, p.assignedProOrgId].includes(a.orgId)) throw new ForbiddenException();
  },
};
const row = (over: Record<string, unknown> = {}) => ({
  executionId: "exec_1",
  actorId: "u_initiator",
  namespace: "payments",
  name: "propose_release",
  mode: "critical",
  status: "succeeded",
  source: "prometeo_tools",
  projectId: "p_mine",
  runId: null,
  approvalId: "a1",
  proposedActionId: "act1",
  policyVersion: "d1:abc",
  startedAt: new Date("2026-10-05T10:00:00Z"),
  completedAt: new Date("2026-10-05T10:00:01Z"),
  durationMs: 1000,
  errorCode: null,
  blockedReason: null,
  inputSummary: '{"milestoneId":"m1"}',
  outputSummary: '{"ok":true}',
  ...over,
});
function queryService(rows: any[]) {
  const repo = {
    findExecution: async (tenantId: string, id: string) => (tenantId === "t1" ? rows.find((r) => r.executionId === id) ?? null : null),
    listExecutionsByProject: async () => rows,
  };
  return new ToolExecutionQueryService(repo as never, access as never);
}
const initiator = { tenantId: "t1", orgId: "org_x", userId: "u_initiator", roles: ["PRO"] };
const admin = { tenantId: "t1", orgId: "org_ops", userId: "u_admin", roles: ["OPS_ADMIN"] };
const participant = { tenantId: "t1", orgId: "org_client", userId: "u_client", roles: ["CLIENT"] };
const stranger = { tenantId: "t1", orgId: "org_z", userId: "u_z", roles: ["CLIENT"] };

test("consulta: el iniciador y OPS_ADMIN ven el detalle; el participante del proyecto, solo el resumen", async () => {
  const svc = queryService([row()]);
  const full = await svc.getExecution(initiator as never, "exec_1");
  assert.equal(full.detail, "full");
  assert.equal(full.inputSummary, '{"milestoneId":"m1"}');
  assert.equal((await svc.getExecution(admin as never, "exec_1")).detail, "full");

  const summary = await svc.getExecution(participant as never, "exec_1");
  assert.equal(summary.detail, "summary");
  assert.equal("inputSummary" in summary, false, "el participante no ve el contenido de entrada");
  assert.equal("outputSummary" in summary, false);
  assert.equal(summary.tool, "payments.propose_release");
  assert.equal(summary.policyVersion, "d1:abc");
});

test("consulta: otro tenant o inexistente ⇒ 404; otra organización sin relación ⇒ 403", async () => {
  const svc = queryService([row()]);
  await assert.rejects(() => svc.getExecution({ ...admin, tenantId: "t2" } as never, "exec_1"), NotFoundException);
  await assert.rejects(() => svc.getExecution(admin as never, "no_existe"), NotFoundException);
  await assert.rejects(() => svc.getExecution(stranger as never, "exec_1"), ForbiddenException);
  const noProject = queryService([row({ projectId: null })]);
  await assert.rejects(() => noProject.getExecution(participant as never, "exec_1"), ForbiddenException);
});

test("listado por proyecto: exige participar en el proyecto y aplica el nivel de detalle por fila", async () => {
  const svc = queryService([row(), row({ executionId: "exec_2", actorId: "u_client" })]);
  await assert.rejects(() => svc.listByProject(stranger as never, "p_mine"), ForbiddenException);
  const list = await svc.listByProject(participant as never, "p_mine");
  assert.equal(list.length, 2);
  assert.equal(list.find((v) => v.executionId === "exec_1")!.detail, "summary");
  assert.equal(list.find((v) => v.executionId === "exec_2")!.detail, "full", "la propia ejecución sí se ve completa");
});

// ── barridos ───────────────────────────────────────────────────────────────

test("mantenimiento: con off no toca nada; con shadow corre los tres barridos con el umbral configurado", async () => {
  const calls: any[] = [];
  const tools = {
    reconcileInterrupted: async (i: any) => (calls.push(["tools", i]), 4),
    purgeExpiredContent: async (n: Date) => (calls.push(["purge", n]), 7),
  };
  const approvals = { reconcileExecutions: async (i: any) => (calls.push(["approvals", i]), { interrupted: 1, notExecuted: 2 }) };
  const service = new AuditMaintenanceService(tools as never, approvals as never);
  const now = new Date("2026-10-05T12:00:00Z");

  await withMode(undefined, async () => {
    const off = await service.runOnce(now);
    assert.equal(off.skipped, true);
    assert.equal(calls.length, 0);
  });
  await withMode("shadow", async () => {
    const result = await service.runOnce(now);
    assert.deepEqual(result, { skipped: false, toolExecutionsInterrupted: 4, contentPurged: 7, approvalsInterrupted: 1, approvalsNotExecuted: 2 });
    assert.equal(calls[0][1].olderThan.getTime(), now.getTime() - 15 * 60_000);
    assert.equal(calls[0][1].retentionDays, 90);
    assert.deepEqual(calls.map((c) => c[0]), ["tools", "purge", "approvals"]);
  });
});
