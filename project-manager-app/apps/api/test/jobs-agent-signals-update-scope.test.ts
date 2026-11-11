import test from "node:test";
import assert from "node:assert/strict";
import { ForbiddenException, NotFoundException } from "@nestjs/common";
import { JobsService } from "../dist/modules/jobs/jobs.service.js";

// C51: `GET /v1/jobs/:jobId/agent-signals` devolvía las ejecuciones de agentes de cualquier job del tenant sin
// comprobar visibilidad (cualquier CLIENT/PRO con jobs:read). `PATCH /v1/jobs/:jobId` editaba cualquier job del
// tenant sin comprobar propietario (latente: hoy ningún rol tiene jobs:update). Ahora ambos pasan por la regla de
// visibilidad del detalle y la edición exige la org cliente dueña u OPS_ADMIN.

const JOBS = [
  { id: "job_1", tenantId: "t1", clientOrgId: "org_client", visibleTo: ["org_client", "org_pro"] },
  { id: "job_t2", tenantId: "t2", clientOrgId: "org_client_t2", visibleTo: ["org_client_t2"] },
];

function build() {
  const calls: string[] = [];
  const repository = {
    // Mismo contrato que JobsRepository.findVisibleById: otro tenant/inexistente ⇒ 404; no visible ⇒ 403.
    async findVisibleById(input: { tenantId: string; jobId: string; orgId: string; roles: string[] }) {
      calls.push(`visible:${input.tenantId}:${input.jobId}`);
      const job = JOBS.find((j) => j.id === input.jobId && j.tenantId === input.tenantId);
      if (!job) throw new NotFoundException("not found");
      if (!input.roles.includes("OPS_ADMIN") && !job.visibleTo.includes(input.orgId)) throw new ForbiddenException("not visible");
      return { id: job.id, tenantId: job.tenantId, clientOrgId: job.clientOrgId, title: "t", scope: "s", status: "posted" };
    },
    async updateFields(input: { jobId: string }) {
      calls.push(`update:${input.jobId}`);
      return { id: input.jobId, tenantId: "t1", clientOrgId: "org_client", title: "nuevo", scope: "s", status: "posted" };
    },
  };
  const prisma = {
    agentRun: { findMany: async () => (calls.push("agentRun.findMany"), [{ id: "run_1" }]) },
    workspaceMemoryEntry: { findMany: async () => [] },
  };
  const audit = { append: async () => calls.push("audit") };
  const bus = { emit: async () => {} };
  const memory = { listByWorkspace: async () => [], search: async () => [] };
  const service = new JobsService(repository as never, audit as never, bus as never, memory as never, prisma as never, undefined);
  return { service, calls };
}

const actor = (over: Record<string, unknown> = {}) => ({ tenantId: "t1", orgId: "org_client", userId: "u1", roles: ["CLIENT"], ...over });

test("agent-signals: quien ve el job (cliente, profesional participante, OPS_ADMIN) recibe las señales", async () => {
  for (const a of [actor(), actor({ orgId: "org_pro", roles: ["PRO"] }), actor({ orgId: "org_ops", roles: ["OPS_ADMIN"] })]) {
    const { service, calls } = build();
    const signals = await service.agentSignals({ ...a, jobId: "job_1" });
    assert.deepEqual(signals, [{ id: "run_1" }]);
    assert.deepEqual(calls, ["visible:t1:job_1", "agentRun.findMany"]);
  }
});

test("agent-signals: otra org del tenant ⇒ 403 y no se consultan las ejecuciones", async () => {
  const { service, calls } = build();
  await assert.rejects(service.agentSignals({ ...actor({ orgId: "org_other" }), jobId: "job_1" }), ForbiddenException);
  assert.ok(!calls.includes("agentRun.findMany"));
});

test("agent-signals: job de otro tenant ⇒ 404 (también OPS_ADMIN) y no se consultan las ejecuciones", async () => {
  for (const a of [actor(), actor({ roles: ["OPS_ADMIN"] })]) {
    const { service, calls } = build();
    await assert.rejects(service.agentSignals({ ...a, jobId: "job_t2" }), NotFoundException);
    assert.ok(!calls.includes("agentRun.findMany"));
  }
});

test("update: org cliente dueña u OPS_ADMIN editan", async () => {
  for (const a of [actor(), actor({ orgId: "org_ops", roles: ["OPS_ADMIN"] })]) {
    const { service, calls } = build();
    await service.update({ ...a, jobId: "job_1", patch: { title: "nuevo" }, requestId: "r1" });
    assert.ok(calls.includes("update:job_1"));
  }
});

test("update: profesional que ve el job, otra org u org vacía ⇒ 403 sin escritura; otro tenant ⇒ 404", async () => {
  for (const a of [actor({ orgId: "org_pro", roles: ["PRO"] }), actor({ orgId: "org_other" }), actor({ orgId: "" })]) {
    const { service, calls } = build();
    await assert.rejects(service.update({ ...a, jobId: "job_1", patch: { title: "x" }, requestId: "r1" }), ForbiddenException);
    assert.ok(!calls.some((c) => c.startsWith("update:")));
  }
  const { service, calls } = build();
  await assert.rejects(service.update({ ...actor(), jobId: "job_t2", patch: { title: "x" }, requestId: "r1" }), NotFoundException);
  assert.ok(!calls.some((c) => c.startsWith("update:")));
});
