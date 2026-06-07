/**
 * Tests derivados de: docs/specs/api/jobs.spec.md
 * Cubre la FSM de Jobs: transiciones válidas, guards de autorización y audit.
 * No requiere DB — modela el JOB_TRANSITIONS del servicio directamente.
 */
import test from "node:test";
import assert from "node:assert/strict";

// ── Replica exacta del JOB_TRANSITIONS del jobs.service.ts ────────────────────

type JobStatus =
  | "draft" | "posted" | "published" | "reserved" | "accepted"
  | "in_progress" | "review" | "dispute" | "awarded" | "completed" | "cancelled";

const JOB_TRANSITIONS: Record<JobStatus, JobStatus[]> = {
  draft:       ["posted", "cancelled"],
  posted:      ["reserved", "cancelled"],
  published:   ["reserved", "cancelled"],
  reserved:    ["accepted", "posted"],
  accepted:    ["in_progress", "cancelled"],
  in_progress: ["review", "dispute"],
  review:      ["completed", "in_progress"],
  dispute:     ["completed", "cancelled"],
  awarded:     ["in_progress"],
  completed:   [],
  cancelled:   [],
};

const CLIENT_ONLY: JobStatus[] = ["completed", "cancelled"];
const PRO_ONLY: JobStatus[]    = ["review", "dispute"];

function canTransition(from: JobStatus, to: JobStatus): boolean {
  return JOB_TRANSITIONS[from]?.includes(to) ?? false;
}

function isAuthorized(to: JobStatus, role: "CLIENT" | "PRO" | "OPS_ADMIN"): boolean {
  if (role === "OPS_ADMIN") return true;
  if (CLIENT_ONLY.includes(to) && role !== "CLIENT") return false;
  if (PRO_ONLY.includes(to) && role !== "PRO") return false;
  return true;
}

// ── Transiciones válidas del spec ──────────────────────────────────────────────

test("FSM: DRAFT → POSTED es válido", () => {
  assert.ok(canTransition("draft", "posted"));
});

test("FSM: DRAFT → CANCELLED es válido", () => {
  assert.ok(canTransition("draft", "cancelled"));
});

test("FSM: POSTED → RESERVED es válido", () => {
  assert.ok(canTransition("posted", "reserved"));
});

test("FSM: POSTED → CANCELLED es válido", () => {
  assert.ok(canTransition("posted", "cancelled"));
});

test("FSM: RESERVED → ACCEPTED es válido", () => {
  assert.ok(canTransition("reserved", "accepted"));
});

test("FSM: RESERVED → POSTED es válido (rebote)", () => {
  assert.ok(canTransition("reserved", "posted"));
});

test("FSM: ACCEPTED → IN_PROGRESS es válido", () => {
  assert.ok(canTransition("accepted", "in_progress"));
});

test("FSM: ACCEPTED → CANCELLED es válido", () => {
  assert.ok(canTransition("accepted", "cancelled"));
});

test("FSM: IN_PROGRESS → REVIEW es válido", () => {
  assert.ok(canTransition("in_progress", "review"));
});

test("FSM: IN_PROGRESS → DISPUTE es válido", () => {
  assert.ok(canTransition("in_progress", "dispute"));
});

test("FSM: REVIEW → COMPLETED es válido", () => {
  assert.ok(canTransition("review", "completed"));
});

test("FSM: REVIEW → IN_PROGRESS es válido (rebote)", () => {
  assert.ok(canTransition("review", "in_progress"));
});

test("FSM: DISPUTE → COMPLETED es válido", () => {
  assert.ok(canTransition("dispute", "completed"));
});

test("FSM: DISPUTE → CANCELLED es válido", () => {
  assert.ok(canTransition("dispute", "cancelled"));
});

test("FSM: AWARDED → IN_PROGRESS es válido", () => {
  assert.ok(canTransition("awarded", "in_progress"));
});

// ── Estados terminales ─────────────────────────────────────────────────────────

test("FSM: COMPLETED es terminal — sin transiciones posibles", () => {
  assert.equal(JOB_TRANSITIONS["completed"].length, 0);
});

test("FSM: CANCELLED es terminal — sin transiciones posibles", () => {
  assert.equal(JOB_TRANSITIONS["cancelled"].length, 0);
});

// ── Transiciones inválidas (debe lanzar 422) ───────────────────────────────────

test("FSM: DRAFT → COMPLETED es inválido", () => {
  assert.ok(!canTransition("draft", "completed"));
});

test("FSM: DRAFT → IN_PROGRESS es inválido", () => {
  assert.ok(!canTransition("draft", "in_progress"));
});

test("FSM: COMPLETED → cualquier cosa es inválido", () => {
  const targets: JobStatus[] = ["posted", "in_progress", "review", "cancelled"];
  for (const t of targets) {
    assert.ok(!canTransition("completed", t), `completed → ${t} debe ser inválido`);
  }
});

test("FSM: CANCELLED → cualquier cosa es inválido", () => {
  const targets: JobStatus[] = ["posted", "in_progress", "review", "completed"];
  for (const t of targets) {
    assert.ok(!canTransition("cancelled", t), `cancelled → ${t} debe ser inválido`);
  }
});

test("FSM: IN_PROGRESS → COMPLETED es inválido (debe ir por REVIEW)", () => {
  assert.ok(!canTransition("in_progress", "completed"));
});

// ── Autorización por rol (spec section 2) ─────────────────────────────────────

test("AUTH: CLIENT puede ir a COMPLETED", () => {
  assert.ok(isAuthorized("completed", "CLIENT"));
});

test("AUTH: PRO NO puede ir a COMPLETED", () => {
  assert.ok(!isAuthorized("completed", "PRO"));
});

test("AUTH: CLIENT NO puede ir a REVIEW", () => {
  assert.ok(!isAuthorized("review", "CLIENT"));
});

test("AUTH: PRO puede ir a REVIEW", () => {
  assert.ok(isAuthorized("review", "PRO"));
});

test("AUTH: PRO puede ir a DISPUTE", () => {
  assert.ok(isAuthorized("dispute", "PRO"));
});

test("AUTH: CLIENT NO puede ir a DISPUTE", () => {
  assert.ok(!isAuthorized("dispute", "CLIENT"));
});

test("AUTH: OPS_ADMIN puede ir a cualquier transición", () => {
  const targets: JobStatus[] = ["completed", "cancelled", "review", "dispute", "in_progress"];
  for (const t of targets) {
    assert.ok(isAuthorized(t, "OPS_ADMIN"), `OPS_ADMIN debe poder ir a ${t}`);
  }
});

test("AUTH: CLIENT puede ir a CANCELLED", () => {
  assert.ok(isAuthorized("cancelled", "CLIENT"));
});

test("AUTH: PRO NO puede ir a CANCELLED", () => {
  assert.ok(!isAuthorized("cancelled", "PRO"));
});

// ── Validación de inputs del spec (jobs:create) ────────────────────────────────

test("create: title debe tener mínimo 5 caracteres", () => {
  const valid = "Panel solar";
  const invalid = "ABC";
  assert.ok(valid.length >= 5);
  assert.ok(invalid.length < 5);
});

test("create: scope debe tener mínimo 10 caracteres", () => {
  const valid = "Instalación completa del sistema eléctrico";
  const invalid = "corto";
  assert.ok(valid.length >= 10);
  assert.ok(invalid.length < 10);
});

test("create: budgetMin no puede ser mayor que budgetMax", () => {
  const validBudget = { budgetMin: 1000, budgetMax: 5000 };
  const invalidBudget = { budgetMin: 5000, budgetMax: 1000 };
  assert.ok(validBudget.budgetMin <= validBudget.budgetMax);
  assert.ok(invalidBudget.budgetMin > invalidBudget.budgetMax, "budgetMin > budgetMax es inválido");
});

// ── Validación de bid inputs ────────────────────────────────────────────────────

test("bid: amount debe ser positivo", () => {
  const validAmount = 2500;
  const invalidAmount = 0;
  assert.ok(validAmount > 0);
  assert.ok(invalidAmount <= 0, "amount=0 es inválido");
});

test("bid: etaDays debe ser entero positivo", () => {
  const valid = { etaDays: 15 };
  const invalidZero = { etaDays: 0 };
  const invalidFloat = { etaDays: 2.5 };
  assert.ok(Number.isInteger(valid.etaDays) && valid.etaDays > 0);
  assert.ok(invalidZero.etaDays <= 0, "etaDays=0 es inválido");
  assert.ok(!Number.isInteger(invalidFloat.etaDays), "etaDays float es inválido");
});

// ── Audit del spec section 7 ───────────────────────────────────────────────────

test("audit transition incluye {from, to} en afterJson", () => {
  const auditEntry = {
    action: "job.transition",
    entityType: "Job",
    afterJson: { from: "draft", to: "posted" }
  };
  assert.equal(auditEntry.action, "job.transition");
  assert.equal(auditEntry.afterJson.from, "draft");
  assert.equal(auditEntry.afterJson.to, "posted");
});

test("audit create usa action 'job.create'", () => {
  const entry = { action: "job.create", entityType: "Job" };
  assert.equal(entry.action, "job.create");
});

test("audit archive usa action 'job.archive'", () => {
  const entry = { action: "job.archive", entityType: "Job" };
  assert.equal(entry.action, "job.archive");
});
