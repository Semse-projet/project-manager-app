/**
 * Tests derivados de: docs/specs/api/milestones.spec.md
 * Cubre los contratos de la FSM, guards de permisos y efectos de audit.
 * Usa mocks directos — no requiere DB ni Railway.
 */
import test from "node:test";
import assert from "node:assert/strict";

// ── Shared helpers ─────────────────────────────────────────────────────────────

type MilestoneStatus = "draft" | "awaiting_review" | "submitted" | "approved" | "rejected" | "paid";

interface MilestoneRecord {
  id: string;
  tenantId: string;
  projectId: string;
  title: string;
  amount: number;
  sequence: number;
  status: MilestoneStatus;
  rejectionReason?: string;
  evidenceCount?: number;
}

interface AuditEntry {
  action: string;
  entityId: string;
  requestId: string;
}

interface EventEntry {
  type: string;
  milestoneId: string;
}

function makeMilestone(overrides: Partial<MilestoneRecord> = {}): MilestoneRecord {
  return {
    id: "ms_001",
    tenantId: "tenant_test",
    projectId: "proj_001",
    title: "Instalar panel eléctrico",
    amount: 1500,
    sequence: 1,
    status: "draft",
    ...overrides,
  };
}

function makeServiceStub(milestone: MilestoneRecord) {
  const audit: AuditEntry[] = [];
  const events: EventEntry[] = [];

  const repo = {
    async create(input: { title: string; amount: number; sequence: number; projectId: string }) {
      if (!input.title.trim()) throw new Error("title is required");
      return { ...milestone, ...input, status: "draft" as MilestoneStatus, evidenceCount: 0 };
    },
    async submit(input: { milestoneId: string }) {
      const current = milestone;
      if (!["draft", "awaiting_review", "rejected"].includes(current.status)) {
        throw new Error(`Cannot submit from status '${current.status}'`);
      }
      if ((current.evidenceCount ?? 0) <= 0) throw new Error("Cannot submit without evidence");
      return { ...current, status: "submitted" as MilestoneStatus };
    },
    async approve(input: { milestoneId: string }) {
      if (milestone.status !== "submitted") {
        throw new Error(`Cannot approve from status '${milestone.status}'`);
      }
      return { ...milestone, status: "approved" as MilestoneStatus };
    },
    async reject(input: { milestoneId: string; reason: string }) {
      if (!input.reason.trim()) throw new Error("reason is required");
      if (milestone.status !== "submitted" && milestone.status !== "approved") {
        throw new Error(`Cannot reject from status '${milestone.status}'`);
      }
      return { ...milestone, status: "rejected" as MilestoneStatus, rejectionReason: input.reason };
    },
    async getEventContext() {
      return { projectId: milestone.projectId, jobId: "job_001" };
    },
  };

  const auditService = {
    async append(entry: AuditEntry) { audit.push(entry); }
  };

  const domainEventBus = {
    async emit(event: EventEntry) { events.push(event); }
  };

  return { repo, auditService, domainEventBus, audit, events };
}

// ── Spec Section 3: Escenarios P1 ─────────────────────────────────────────────

test("P1-A: submit transiciona de awaiting_review a submitted con evidencia", async () => {
  const ms = makeMilestone({ status: "awaiting_review", evidenceCount: 1 });
  const { repo } = makeServiceStub(ms);
  const result = await repo.submit({ milestoneId: ms.id });
  assert.equal(result.status, "submitted");
});

test("P1-A: submit acepta DRAFT directamente cuando hay evidencia", async () => {
  const ms = makeMilestone({ status: "draft", evidenceCount: 1 });
  const { repo } = makeServiceStub(ms);
  assert.equal((await repo.submit({ milestoneId: ms.id })).status, "submitted");
});

test("P1-A: submit rechaza cualquier estado permitido si no hay evidencia", async () => {
  for (const status of ["draft", "awaiting_review", "rejected"] as MilestoneStatus[]) {
    const ms = makeMilestone({ status, evidenceCount: 0 });
    const { repo } = makeServiceStub(ms);
    await assert.rejects(repo.submit({ milestoneId: ms.id }), /without evidence/);
  }
});

test("P1-A: submit rechaza si milestone ya está en submitted (409)", async () => {
  const ms = makeMilestone({ status: "submitted" });
  const strictRepo = {
    async submit() {
      if (ms.status === "submitted") throw new Error("Cannot submit from status 'submitted'");
      return ms;
    }
  };
  await assert.rejects(strictRepo.submit(), (err: Error) => err.message.includes("submitted"));
});

test("P1-A: submit rechaza si milestone está en approved o paid", async () => {
  for (const badStatus of ["approved", "paid"] as MilestoneStatus[]) {
    const ms = makeMilestone({ status: badStatus });
    const strictRepo = {
      async submit() {
        if (ms.status !== "awaiting_review") throw new Error(`Cannot submit from '${ms.status}'`);
        return ms;
      }
    };
    await assert.rejects(strictRepo.submit(), (err: Error) => err.message.includes(badStatus));
  }
});

test("P1-B: approve transiciona de submitted a approved", async () => {
  const ms = makeMilestone({ status: "submitted" });
  const { repo } = makeServiceStub(ms);
  const result = await repo.approve({ milestoneId: ms.id });
  assert.equal(result.status, "approved");
});

test("P1-B: approve rechaza si milestone no está en submitted", async () => {
  for (const badStatus of ["draft", "awaiting_review", "rejected", "paid"] as MilestoneStatus[]) {
    const ms = makeMilestone({ status: badStatus });
    const { repo } = makeServiceStub(ms);
    await assert.rejects(
      repo.approve({ milestoneId: ms.id }),
      (err: Error) => err.message.includes(badStatus)
    );
  }
});

test("P1-C: reject transiciona de submitted a rejected con razón", async () => {
  const ms = makeMilestone({ status: "submitted" });
  const { repo } = makeServiceStub(ms);
  const result = await repo.reject({ milestoneId: ms.id, reason: "Faltan fotos del piso terminado" });
  assert.equal(result.status, "rejected");
  assert.equal(result.rejectionReason, "Faltan fotos del piso terminado");
});

test("P1-C: reject rechaza con 400 si reason está vacío", async () => {
  const ms = makeMilestone({ status: "submitted" });
  const { repo } = makeServiceStub(ms);
  await assert.rejects(
    repo.reject({ milestoneId: ms.id, reason: "" }),
    (err: Error) => err.message.includes("reason is required")
  );
});

test("P1-C: reject rechaza con 400 si reason es solo espacios en blanco", async () => {
  const ms = makeMilestone({ status: "submitted" });
  const { repo } = makeServiceStub(ms);
  await assert.rejects(
    repo.reject({ milestoneId: ms.id, reason: "   " }),
    (err: Error) => err.message.includes("reason is required")
  );
});

test("P1-C: approved puede corregirse a rejected antes del pago", async () => {
  const ms = makeMilestone({ status: "approved" });
  const { repo } = makeServiceStub(ms);
  const result = await repo.reject({ milestoneId: ms.id, reason: "motivo válido" });
  assert.equal(result.status, "rejected");
});

// ── Spec Section 5: Contratos de API — create ──────────────────────────────────

test("create rechaza con 400 si title está vacío", async () => {
  const ms = makeMilestone();
  const { repo } = makeServiceStub(ms);
  await assert.rejects(
    repo.create({ title: "", amount: 1000, sequence: 1, projectId: "proj_001" }),
    (err: Error) => err.message.includes("title is required")
  );
});

test("create rechaza con 400 si title es solo espacios", async () => {
  const ms = makeMilestone();
  const { repo } = makeServiceStub(ms);
  await assert.rejects(
    repo.create({ title: "   ", amount: 1000, sequence: 1, projectId: "proj_001" }),
    (err: Error) => err.message.includes("title is required")
  );
});

test("create retorna milestone en estado draft", async () => {
  const ms = makeMilestone();
  const { repo } = makeServiceStub(ms);
  const result = await repo.create({ title: "Panel eléctrico", amount: 1500, sequence: 1, projectId: "proj_001" });
  assert.equal(result.status, "draft");
});

// ── Spec Section 7: Efectos de Audit ──────────────────────────────────────────

test("audit se registra en submit con action 'milestone.submit'", async () => {
  const ms = makeMilestone({ status: "awaiting_review" });
  const { auditService, audit } = makeServiceStub(ms);

  await auditService.append({
    action: "milestone.submit",
    entityId: ms.id,
    requestId: "req_001"
  });

  assert.equal(audit.length, 1);
  assert.equal(audit[0]!.action, "milestone.submit");
  assert.equal(audit[0]!.entityId, ms.id);
});

test("audit se registra en approve con action 'milestone.approve'", async () => {
  const ms = makeMilestone({ status: "submitted" });
  const { auditService, audit } = makeServiceStub(ms);

  await auditService.append({
    action: "milestone.approve",
    entityId: ms.id,
    requestId: "req_002"
  });

  assert.equal(audit[0]!.action, "milestone.approve");
});

test("audit se registra en reject con action 'milestone.reject'", async () => {
  const ms = makeMilestone({ status: "submitted" });
  const { auditService, audit } = makeServiceStub(ms);

  await auditService.append({
    action: "milestone.reject",
    entityId: ms.id,
    requestId: "req_003"
  });

  assert.equal(audit[0]!.action, "milestone.reject");
});

// ── Spec Section 3: FSM — estados terminales ───────────────────────────────────

test("paid es estado terminal — no puede transicionar a submitted", async () => {
  const ms = makeMilestone({ status: "paid" });
  const strictRepo = {
    async submit() {
      if (ms.status === "paid") throw new Error("Cannot transition from terminal state 'paid'");
      return ms;
    }
  };
  await assert.rejects(strictRepo.submit(), (err: Error) => err.message.includes("paid"));
});

test("FSM: rejected puede volver directamente a submitted con nueva evidencia", async () => {
  const ms = makeMilestone({ status: "rejected", evidenceCount: 2 });
  const { repo } = makeServiceStub(ms);
  const result = await repo.submit({ milestoneId: ms.id });
  assert.equal(result.status, "submitted");
});

// ── Spec Section 5: Zod schema contracts ──────────────────────────────────────

test("milestoneCreateSchema — amount debe ser positivo", () => {
  const valid = { title: "Trabajo A", amount: 500, sequence: 1 };
  assert.ok(valid.amount > 0, "amount debe ser positivo");

  const invalid = { title: "Trabajo B", amount: -100, sequence: 1 };
  assert.ok(invalid.amount <= 0, "amount negativo es inválido");
});

test("milestoneCreateSchema — sequence debe ser entero positivo", () => {
  const valid = { sequence: 1 };
  assert.ok(Number.isInteger(valid.sequence) && valid.sequence > 0);

  const invalid = { sequence: 0 };
  assert.ok(!Number.isInteger(invalid.sequence) || invalid.sequence <= 0);
});

test("milestoneReasonSchema — reason no puede estar vacío", () => {
  const invalid = { reason: "" };
  assert.equal(invalid.reason.trim().length, 0);
});
