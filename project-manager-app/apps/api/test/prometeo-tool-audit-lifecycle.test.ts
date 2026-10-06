import assert from "node:assert/strict";
import test from "node:test";
import { ConflictException, ServiceUnavailableException } from "@nestjs/common";
import { PrometeoToolExecutionService } from "../dist/modules/prometeo/prometeo-tool-execution.service.js";
import { ToolGovernanceRepository } from "../dist/modules/prometeo/tool-governance/tool-governance.repository.js";
import {
  REDACTION_VERSION,
  ToolAuditUnavailableError,
  ToolCallAuditor,
  policyVersionOf,
  redactValue,
  resolveAuditLifecycleMode,
  resolveRetentionDays,
  summarizeForAudit,
  toolAuditMetrics,
} from "../dist/modules/prometeo/tool-governance/tool-call-audit.js";

// H05 (spec prometeo.tool-call-audit-lineage): ciclo de vida por ejecución, redacción, retención y modos off/shadow/enforce.

function withMode<T>(mode: string | undefined, run: () => Promise<T>): Promise<T> {
  const previous = process.env.PROMETEO_TOOL_AUDIT_LIFECYCLE;
  if (mode === undefined) delete process.env.PROMETEO_TOOL_AUDIT_LIFECYCLE;
  else process.env.PROMETEO_TOOL_AUDIT_LIFECYCLE = mode;
  return run().finally(() => {
    if (previous === undefined) delete process.env.PROMETEO_TOOL_AUDIT_LIFECYCLE;
    else process.env.PROMETEO_TOOL_AUDIT_LIFECYCLE = previous;
  });
}

// ── redacción ──────────────────────────────────────────────────────────────

test("redacción: claves sensibles, correos y dígitos largos nunca llegan al resumen ni al digest", () => {
  const input = {
    jobId: "job_1",
    password: "hunter2",
    apiKey: "sk-live-123",
    nested: { authorization: "Bearer abc", note: "escríbeme a persona@example.com o al 5551234567890" },
    cardNumber: "4111 1111 1111 1111",
  };
  const redacted = redactValue(input) as Record<string, any>;
  assert.equal(redacted.jobId, "job_1");
  assert.equal(redacted.password, "[REDACTED]");
  assert.equal(redacted.apiKey, "[REDACTED]");
  assert.equal(redacted.nested.authorization, "[REDACTED]");
  assert.equal(redacted.cardNumber, "[REDACTED]");
  assert.match(redacted.nested.note, /\[email\]/);
  assert.match(redacted.nested.note, /\[digits\]/);

  const { summary, digest } = summarizeForAudit(input)!;
  for (const secret of ["hunter2", "sk-live-123", "Bearer abc", "persona@example.com", "4111"]) {
    assert.equal(summary.includes(secret), false, `${secret} no debe aparecer`);
  }
  assert.match(digest, /^[0-9a-f]{64}$/);
});

test("redacción: el digest es determinista (orden de claves irrelevante) y el resumen está acotado", () => {
  assert.equal(summarizeForAudit({ a: 1, b: 2 })!.digest, summarizeForAudit({ b: 2, a: 1 })!.digest);
  assert.notEqual(summarizeForAudit({ a: 1 })!.digest, summarizeForAudit({ a: 2 })!.digest);
  const big = summarizeForAudit({ text: "x".repeat(5000), list: Array.from({ length: 100 }, (_, i) => i) })!;
  assert.ok(big.summary.length <= 500);
  assert.equal(summarizeForAudit(undefined), null);
});

test("policyVersionOf cambia si cambia el contrato del descriptor y es estable si no", () => {
  const a = { namespace: "x", name: "y", risk: "low" };
  assert.equal(policyVersionOf(a), policyVersionOf({ ...a }));
  assert.notEqual(policyVersionOf(a), policyVersionOf({ ...a, risk: "high" }));
  assert.match(policyVersionOf(a), /^d1:[0-9a-f]{12}$/);
});

test("modo y retención: por defecto off y 90 días; valores inválidos no activan nada", () => {
  assert.equal(resolveAuditLifecycleMode({}), "off");
  assert.equal(resolveAuditLifecycleMode({ PROMETEO_TOOL_AUDIT_LIFECYCLE: "SHADOW" } as never), "shadow");
  assert.equal(resolveAuditLifecycleMode({ PROMETEO_TOOL_AUDIT_LIFECYCLE: "enforce" } as never), "enforce");
  assert.equal(resolveAuditLifecycleMode({ PROMETEO_TOOL_AUDIT_LIFECYCLE: "on" } as never), "off");
  assert.equal(resolveRetentionDays({}), 90);
  assert.equal(resolveRetentionDays({ PROMETEO_TOOL_AUDIT_RETENTION_DAYS: "30" } as never), 30);
  assert.equal(resolveRetentionDays({ PROMETEO_TOOL_AUDIT_RETENTION_DAYS: "-5" } as never), 90);
});

// ── auditor ────────────────────────────────────────────────────────────────

function fakeRepo(opts: { failStart?: boolean; failTerminal?: boolean } = {}) {
  const log = { invocation: [] as any[], start: [] as any[], terminal: [] as any[] };
  const repo = {
    recordInvocation: async (i: any) => void log.invocation.push(i),
    recordStart: async (i: any) => {
      if (opts.failStart) throw new Error("db down");
      log.start.push(i);
    },
    recordTerminal: async (t: string, e: string, p: any) => {
      if (opts.failTerminal) throw new Error("db down");
      log.terminal.push({ t, e, p });
      return true;
    },
  };
  return { repo, log };
}

const ctx = {
  executionId: "exec_1",
  tenantId: "t1",
  actorId: "u1",
  namespace: "time_tracker",
  name: "get_status",
  mode: "read",
  requestId: "req_1",
  source: "prometeo_tools" as const,
  policyVersion: "d1:abc",
  input: { jobId: "j1", password: "x" },
};

test("off: comportamiento anterior (una fila terminal sin columnas nuevas; fallos sin fila)", async () => {
  await withMode(undefined, async () => {
    const { repo, log } = fakeRepo();
    const auditor = new ToolCallAuditor(repo as never);
    assert.equal(await auditor.begin(ctx, { critical: true }), false);
    await auditor.finish(ctx, false, { status: "succeeded" });
    await auditor.finish(ctx, false, { status: "failed", errorCode: "HANDLER_EXCEPTION" });
    assert.equal(log.start.length, 0);
    assert.equal(log.terminal.length, 0);
    assert.equal(log.invocation.length, 1, "los fallos no dejaban fila con el ciclo de vida apagado");
    assert.deepEqual(Object.keys(log.invocation[0]).sort(), ["actorId", "blockedReason", "mode", "name", "namespace", "requestId", "status", "tenantId"]);
  });
});

test("shadow: inicio con lineage y entrada redactada; terminal con duración, retención y salida redactada", async () => {
  await withMode("shadow", async () => {
    const times = [1_000, 1_450];
    const { repo, log } = fakeRepo();
    const auditor = new ToolCallAuditor(repo as never, () => times.shift() ?? 9_999);
    assert.equal(await auditor.begin({ ...ctx, projectId: "p1", runId: "r1" }, { critical: false }), true);
    const start = log.start[0];
    assert.equal(start.executionId, "exec_1");
    assert.equal(start.projectId, "p1");
    assert.equal(start.runId, "r1");
    assert.equal(start.policyVersion, "d1:abc");
    assert.equal(start.redactionVersion, REDACTION_VERSION);
    assert.equal(start.inputSummary.includes("\"x\""), false, "la contraseña no se guarda");
    assert.match(start.inputDigest, /^[0-9a-f]{64}$/);

    await auditor.finish(ctx, true, { status: "succeeded", output: { token: "t0p", ok: true } }, 1_000);
    const term = log.terminal[0];
    assert.equal(term.t, "t1");
    assert.equal(term.e, "exec_1");
    assert.equal(term.p.status, "succeeded");
    assert.equal(term.p.durationMs, 450);
    assert.equal(term.p.outputSummary.includes("t0p"), false);
    assert.equal(term.p.expiresAt.getTime(), 1_450 + 90 * 86_400_000);
    assert.equal(log.invocation.length, 0, "no se duplica con una fila legacy");
  });
});

test("shadow: un fallo del propio audit se cuenta y se registra pero nunca cambia el resultado", async () => {
  await withMode("shadow", async () => {
    const before = { ...toolAuditMetrics };
    const { repo } = fakeRepo({ failStart: true, failTerminal: true });
    const auditor = new ToolCallAuditor(repo as never);
    assert.equal(await auditor.begin(ctx, { critical: true }), false, "shadow nunca bloquea, ni siquiera una escritura");
    await auditor.finish(ctx, true, { status: "succeeded" });
    assert.equal(toolAuditMetrics.startFailures, before.startFailures + 1);
    assert.equal(toolAuditMetrics.terminalFailures, before.terminalFailures + 1);
  });
});

test("enforce: una escritura sin registro de inicio no se ejecuta; una lectura sí (fail-open)", async () => {
  await withMode("enforce", async () => {
    const { repo } = fakeRepo({ failStart: true });
    const auditor = new ToolCallAuditor(repo as never);
    await assert.rejects(() => auditor.begin(ctx, { critical: true }), ToolAuditUnavailableError);
    assert.equal(await auditor.begin(ctx, { critical: false }), false);
  });
});

test("sin inicio (denegación): escribe UNA fila terminal completa con el mismo executionId", async () => {
  await withMode("shadow", async () => {
    const { repo, log } = fakeRepo();
    const auditor = new ToolCallAuditor(repo as never, () => 5_000);
    await auditor.finish(ctx, false, { status: "blocked", blockedReason: "missing permissions: x", errorCode: "POLICY_DENIED" });
    assert.equal(log.start.length, 0);
    assert.equal(log.terminal.length, 0);
    assert.equal(log.invocation.length, 1);
    const row = log.invocation[0];
    assert.equal(row.executionId, "exec_1");
    assert.equal(row.errorCode, "POLICY_DENIED");
    assert.equal(row.durationMs, 0);
    assert.ok(row.completedAt instanceof Date && row.expiresAt instanceof Date);
  });
});

// ── repositorio ────────────────────────────────────────────────────────────

test("repositorio: el cierre es condicional (started → terminal) y acotado al tenant; los barridos son idempotentes", async () => {
  const calls: any[] = [];
  const prisma = {
    prometeoToolInvocationAudit: {
      create: async (a: any) => (calls.push(["create", a]), {}),
      updateMany: async (a: any) => (calls.push(["updateMany", a]), { count: a.where.status === "started" && a.where.executionId ? 1 : 3 }),
    },
  };
  const repo = new ToolGovernanceRepository(prisma as never);
  const patch = { status: "succeeded", completedAt: new Date(), durationMs: 5, expiresAt: new Date() };
  assert.equal(await repo.recordTerminal("t1", "exec_1", patch), true);
  const where = calls.find((c) => c[0] === "updateMany")[1].where;
  assert.deepEqual(where, { tenantId: "t1", executionId: "exec_1", status: "started" });

  const now = new Date("2026-10-05T00:00:00Z");
  const swept = await repo.reconcileInterrupted({ olderThan: new Date(now.getTime() - 900_000), now, retentionDays: 90 });
  assert.equal(swept, 3);
  const sweep = calls.filter((c) => c[0] === "updateMany")[1][1];
  assert.equal(sweep.where.status, "started");
  assert.equal(sweep.data.status, "failed");
  assert.equal(sweep.data.errorCode, "INTERRUPTED");

  await repo.purgeExpiredContent(now);
  const purge = calls.filter((c) => c[0] === "updateMany")[2][1];
  assert.deepEqual(purge.data, { inputSummary: null, outputSummary: null });
  assert.deepEqual(Object.keys(purge.data).sort(), ["inputSummary", "outputSummary"], "conserva digest, estado y tiempos");
});

// ── integración en el servicio ─────────────────────────────────────────────

const actor = { tenantId: "tenant_1", orgId: "org_1", userId: "usr_1", roles: ["WORKER"] };

function makeService(governance: Record<string, unknown>, fieldOps: Record<string, unknown> = {}) {
  return new PrometeoToolExecutionService(
    fieldOps as never,
    {} as never,
    {} as never,
    {} as never,
    {} as never,
    {} as never,
    {} as never,
    governance as never,
  );
}

test("servicio (shadow): una excepción del handler de lectura queda como ejecución FALLIDA y se relanza", async () => {
  await withMode("shadow", async () => {
    const { repo, log } = fakeRepo();
    const service = makeService(repo, { getTrackerBootstrap: async () => { throw new Error("boom db"); } });
    await assert.rejects(
      () => service.invokeReadTool(actor as never, "req_9", { namespace: "time_tracker", name: "get_status", input: {} }),
      /boom db/,
    );
    assert.equal(log.start.length, 1);
    assert.equal(log.terminal.length, 1);
    assert.equal(log.terminal[0].p.status, "failed");
    assert.equal(log.terminal[0].p.errorCode, "HANDLER_EXCEPTION");
    assert.equal(log.terminal[0].e, log.start[0].executionId);
  });
});

test("servicio (shadow): éxito de lectura — el executionId de la fila está dentro del auditRef que ve el cliente", async () => {
  await withMode("shadow", async () => {
    const { repo, log } = fakeRepo();
    const service = makeService(repo, { getTrackerBootstrap: async () => ({ active: false }) });
    const result = await service.invokeReadTool(actor as never, "req_9", { namespace: "time_tracker", name: "get_status", input: {} });
    assert.equal(result.status, "succeeded");
    assert.equal(result.auditRef, `prometeo-tool:req_9:${log.start[0].executionId}`);
    assert.equal(log.terminal[0].p.status, "succeeded");
  });
});

test("servicio (off): éxito de lectura escribe la fila anterior y no toca el ciclo de vida", async () => {
  await withMode(undefined, async () => {
    const { repo, log } = fakeRepo();
    const service = makeService(repo, { getTrackerBootstrap: async () => ({ active: false }) });
    await service.invokeReadTool(actor as never, "req_9", { namespace: "time_tracker", name: "get_status", input: {} });
    assert.equal(log.start.length, 0);
    assert.equal(log.invocation.length, 1);
    assert.equal(log.invocation[0].status, "succeeded");
  });
});

function approvalGovernance(repoOverrides: Record<string, unknown> = {}) {
  const { repo, log } = fakeRepo();
  const events: string[] = [];
  const action = {
    id: "act_1",
    tenantId: "tenant_1",
    orgId: "org_1",
    actorId: "usr_1",
    namespace: "time_tracker",
    name: "start",
    approvalPolicy: "confirm",
    status: "PROPOSED",
    inputJson: { jobId: "j1", password: "no-se-guarda" },
  };
  const governance = {
    ...repo,
    findProposedAction: async () => action,
    transitionProposedAction: async () => (events.push("transition"), true),
    finalizeProposedAction: async () => {},
    ...repoOverrides,
  };
  const original = governance.recordStart;
  governance.recordStart = async (i: any) => {
    events.push("start");
    return (original as any)(i);
  };
  return { governance, log, events };
}

test("servicio (enforce): si no se puede registrar el inicio, la aprobación NO cambia nada ni ejecuta el efecto", async () => {
  await withMode("enforce", async () => {
    let effectRan = false;
    const { governance, events } = approvalGovernance({
      recordStart: async () => {
        throw new Error("db down");
      },
    });
    const service = makeService(governance, { startTrackerSession: async () => ((effectRan = true), { id: "s1" }) });
    await assert.rejects(
      () => service.approveProposedAction(actor as never, "req_2", "act_1"),
      ServiceUnavailableException,
    );
    assert.equal(effectRan, false);
    assert.equal(events.includes("transition"), false, "no se hizo la transición a APPROVED");
  });
});

test("servicio (shadow): la aprobación registra el inicio ANTES de la transición y cierra la misma ejecución", async () => {
  await withMode("shadow", async () => {
    const { governance, log, events } = approvalGovernance();
    const service = makeService(governance, { startTrackerSession: async () => ({ id: "s1" }) });
    const result = await service.approveProposedAction(actor as never, "req_2", "act_1");
    assert.equal(result.status, "succeeded");
    assert.deepEqual(events, ["start", "transition"]);
    assert.equal(log.start[0].proposedActionId, "act_1");
    assert.equal(log.start[0].inputSummary.includes("no-se-guarda"), false);
    assert.equal(log.terminal[0].e, log.start[0].executionId);
    assert.equal(result.auditRef, `prometeo-tool:req_2:${log.start[0].executionId}`);
  });
});

test("servicio (shadow): perder la carrera de aprobación cierra la ejecución como 'skipped' y devuelve 409", async () => {
  await withMode("shadow", async () => {
    const { governance, log } = approvalGovernance({ transitionProposedAction: async () => false });
    const service = makeService(governance, { startTrackerSession: async () => ({ id: "s1" }) });
    await assert.rejects(() => service.approveProposedAction(actor as never, "req_2", "act_1"), ConflictException);
    assert.equal(log.terminal[0].p.status, "skipped");
    assert.equal(log.terminal[0].p.errorCode, "LOST_RACE");
  });
});

test("servicio (shadow): el efecto que lanza queda 'failed' con el mismo id y la excepción real se propaga", async () => {
  await withMode("shadow", async () => {
    const { governance, log } = approvalGovernance();
    const service = makeService(governance, { startTrackerSession: async () => { throw new Error("milestone invariant"); } });
    await assert.rejects(() => service.approveProposedAction(actor as never, "req_2", "act_1"), /milestone invariant/);
    assert.equal(log.terminal[0].p.status, "failed");
    assert.equal(log.terminal[0].e, log.start[0].executionId);
  });
});

test("servicio (off): la excepción del efecto sigue dejando la fila anterior 'blocked'", async () => {
  await withMode(undefined, async () => {
    const { governance, log } = approvalGovernance();
    const service = makeService(governance, { startTrackerSession: async () => { throw new Error("milestone invariant"); } });
    await assert.rejects(() => service.approveProposedAction(actor as never, "req_2", "act_1"), /milestone invariant/);
    assert.equal(log.invocation.length, 1);
    assert.equal(log.invocation[0].status, "blocked");
    assert.equal(log.invocation[0].blockedReason, "milestone invariant");
  });
});

test("servicio (shadow): rechazar usa el mismo id de ejecución que ve el cliente (antes eran dos ids distintos)", async () => {
  await withMode("shadow", async () => {
    const { governance, log } = approvalGovernance();
    const service = makeService(governance);
    const result = await service.rejectProposedAction(actor as never, "req_3", "act_1", "no procede");
    assert.equal(result.status, "skipped");
    assert.equal(log.invocation.length, 1);
    assert.equal(log.invocation[0].status, "rejected");
    assert.equal(result.auditRef, `prometeo-tool:req_3:${log.invocation[0].executionId}`);
  });
});
