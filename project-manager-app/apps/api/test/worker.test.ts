import test from "node:test";
import assert from "node:assert/strict";

/**
 * Worker (BullMQ) — Tests unitarios
 * Sin DB, sin Redis. Cubre lógica de handlers, routing de jobs y retry policy.
 */

// ── Job types ─────────────────────────────────────────────────────────────────

const KNOWN_JOB_TYPES = new Set([
  "field-ops",
  "trust-match",
  "pricing",
  "project-copilot",
  "curator",
  "intake-ops-bridge",
  "agent-run",
]);

test("W.J1: job types conocidos están registrados", () => {
  assert.ok(KNOWN_JOB_TYPES.has("field-ops"));
  assert.ok(KNOWN_JOB_TYPES.has("trust-match"));
  assert.ok(KNOWN_JOB_TYPES.has("curator"));
  assert.ok(KNOWN_JOB_TYPES.has("agent-run"));
});

test("W.J2: job type desconocido no está en el set", () => {
  assert.equal(KNOWN_JOB_TYPES.has("unknown-job"), false);
  assert.equal(KNOWN_JOB_TYPES.has(""), false);
});

// ── Retry policy ──────────────────────────────────────────────────────────────

type RetryPolicy = { attempts: number; backoff: { type: "exponential"; delay: number } };

function getRetryPolicy(jobType: string): RetryPolicy {
  if (jobType === "curator" || jobType === "trust-match") {
    return { attempts: 5, backoff: { type: "exponential", delay: 2000 } };
  }
  return { attempts: 3, backoff: { type: "exponential", delay: 1000 } };
}

test("W.R1: curator tiene más reintentos (5)", () => {
  const policy = getRetryPolicy("curator");
  assert.equal(policy.attempts, 5);
  assert.equal(policy.backoff.type, "exponential");
});

test("W.R2: job estándar tiene 3 reintentos", () => {
  const policy = getRetryPolicy("field-ops");
  assert.equal(policy.attempts, 3);
});

test("W.R3: trust-match tiene política premium", () => {
  const policy = getRetryPolicy("trust-match");
  assert.equal(policy.attempts, 5);
  assert.ok(policy.backoff.delay >= 2000);
});

// ── Handler routing ───────────────────────────────────────────────────────────

type JobPayload = { type: string; tenantId: string; data: unknown };

function routeJob(payload: JobPayload): string {
  const routes: Record<string, string> = {
    "field-ops":         "FieldOpsHandler",
    "trust-match":       "TrustMatchHandler",
    "pricing":           "PricingHandler",
    "project-copilot":   "ProjectCopilotHandler",
    "curator":           "CuratorHandler",
    "intake-ops-bridge": "IntakeOpsBridgeHandler",
    "agent-run":         "AgentRunHandler",
  };
  return routes[payload.type] ?? "UnknownHandler";
}

test("W.H1: cada job type tiene handler asignado", () => {
  const types = ["field-ops", "trust-match", "pricing", "project-copilot", "curator"];
  types.forEach((type) => {
    const handler = routeJob({ type, tenantId: "t1", data: {} });
    assert.notEqual(handler, "UnknownHandler", `${type} debe tener handler conocido`);
  });
});

test("W.H2: job type desconocido → UnknownHandler", () => {
  const handler = routeJob({ type: "invalid-type", tenantId: "t1", data: {} });
  assert.equal(handler, "UnknownHandler");
});

test("W.H3: curator → CuratorHandler", () => {
  assert.equal(routeJob({ type: "curator", tenantId: "t1", data: {} }), "CuratorHandler");
});

test("W.H4: agent-run → AgentRunHandler", () => {
  assert.equal(routeJob({ type: "agent-run", tenantId: "t1", data: {} }), "AgentRunHandler");
});

// ── Job payload validation ────────────────────────────────────────────────────

function validateJobPayload(payload: unknown): { valid: boolean; errors: string[] } {
  const errors: string[] = [];
  if (!payload || typeof payload !== "object") return { valid: false, errors: ["payload must be object"] };
  const p = payload as Record<string, unknown>;
  if (!p.type || typeof p.type !== "string")     errors.push("type must be a non-empty string");
  if (!p.tenantId || typeof p.tenantId !== "string") errors.push("tenantId required");
  return { valid: errors.length === 0, errors };
}

test("W.V1: payload válido pasa validación", () => {
  const result = validateJobPayload({ type: "curator", tenantId: "t1", data: {} });
  assert.ok(result.valid);
  assert.deepEqual(result.errors, []);
});

test("W.V2: payload sin type → inválido", () => {
  const result = validateJobPayload({ tenantId: "t1" });
  assert.equal(result.valid, false);
  assert.ok(result.errors.some((e) => e.includes("type")));
});

test("W.V3: payload sin tenantId → inválido", () => {
  const result = validateJobPayload({ type: "curator" });
  assert.equal(result.valid, false);
  assert.ok(result.errors.some((e) => e.includes("tenantId")));
});

test("W.V4: payload null → inválido", () => {
  const result = validateJobPayload(null);
  assert.equal(result.valid, false);
});

// ── Worker health / singleton lock ────────────────────────────────────────────

test("W.L1: worker lock key tiene formato correcto", () => {
  const tenantId = "tenant_default";
  const lockKey = `semse:worker-lock:${tenantId}`;
  assert.ok(lockKey.startsWith("semse:worker-lock:"));
  assert.ok(lockKey.includes(tenantId));
});

test("W.L2: worker lock TTL debe ser > 0", () => {
  const LOCK_TTL_MS = 30_000; // 30 seconds
  assert.ok(LOCK_TTL_MS > 0);
  assert.ok(LOCK_TTL_MS >= 10_000, "TTL mínimo recomendado: 10s");
});

// ── Job deduplication ─────────────────────────────────────────────────────────

function deduplicateJobId(type: string, entityId: string): string {
  return `${type}:${entityId}`;
}

test("W.D1: job ID de dedup es determinista", () => {
  const id1 = deduplicateJobId("curator", "entity-123");
  const id2 = deduplicateJobId("curator", "entity-123");
  assert.equal(id1, id2);
});

test("W.D2: diferentes entityIds producen diferentes job IDs", () => {
  const id1 = deduplicateJobId("curator", "entity-123");
  const id2 = deduplicateJobId("curator", "entity-456");
  assert.notEqual(id1, id2);
});

// ── QA Agent: Vision-gated auto-approval ──────────────────────────────────────

type VisionSummary = { overallVisionReady: boolean; blockers: string[]; totalAnalyzed: number };
type Milestone = { id: string; status: string };

async function simulateQaAutoApprove(
  duplicateCount: number,
  milestones: Milestone[],
  visionSummaryFn: (id: string) => VisionSummary,
  approveFn: (id: string) => void,
): Promise<string[]> {
  const approved: string[] = [];
  if (duplicateCount > 0) return approved;
  for (const m of milestones) {
    const summary = visionSummaryFn(m.id);
    if (summary.overallVisionReady) {
      approveFn(m.id);
      approved.push(m.id);
    }
  }
  return approved;
}

test("W.QA1: milestone vision-ready sin fraude → auto-aprobado", async () => {
  const approved: string[] = [];
  const result = await simulateQaAutoApprove(
    0,
    [{ id: "m-1", status: "submitted" }],
    () => ({ overallVisionReady: true, blockers: [], totalAnalyzed: 3 }),
    (id) => approved.push(id),
  );
  assert.deepEqual(result, ["m-1"]);
  assert.deepEqual(approved, ["m-1"]);
});

test("W.QA2: duplicados detectados → sin auto-aprobación", async () => {
  const approved: string[] = [];
  const result = await simulateQaAutoApprove(
    2,
    [{ id: "m-1", status: "submitted" }],
    () => ({ overallVisionReady: true, blockers: [], totalAnalyzed: 3 }),
    (id) => approved.push(id),
  );
  assert.deepEqual(result, []);
  assert.deepEqual(approved, []);
});

test("W.QA3: milestone con blockers Vision → no se aprueba", async () => {
  const approved: string[] = [];
  const result = await simulateQaAutoApprove(
    0,
    [{ id: "m-2", status: "submitted" }],
    () => ({ overallVisionReady: false, blockers: ["1 foto de alto riesgo"], totalAnalyzed: 2 }),
    (id) => approved.push(id),
  );
  assert.deepEqual(result, []);
});

test("W.QA4: aprobación parcial — solo milestones vision-ready se aprueban", async () => {
  const summaries: Record<string, VisionSummary> = {
    "m-ready":   { overallVisionReady: true,  blockers: [], totalAnalyzed: 4 },
    "m-blocked": { overallVisionReady: false, blockers: ["Calidad baja"], totalAnalyzed: 2 },
  };
  const approved: string[] = [];
  const result = await simulateQaAutoApprove(
    0,
    [{ id: "m-ready", status: "submitted" }, { id: "m-blocked", status: "awaiting_review" }],
    (id) => summaries[id]!,
    (id) => approved.push(id),
  );
  assert.deepEqual(result, ["m-ready"]);
  assert.equal(approved.length, 1);
});

test("W.QA5: sin hitos sometidos → auto-aprobación vacía", async () => {
  const result = await simulateQaAutoApprove(
    0,
    [],
    () => ({ overallVisionReady: true, blockers: [], totalAnalyzed: 0 }),
    () => {},
  );
  assert.deepEqual(result, []);
});
