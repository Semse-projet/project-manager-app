import test from "node:test";
import assert from "node:assert/strict";
import { LaborChatService } from "../dist/modules/labor-engine/labor-chat.service.js";

function createLaborStub(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    async getWeeklySummary() {
      return { totalHours: 12.5, totalEntries: 4, changePercent: 8 };
    },
    async getMonthlySummary() {
      return { totalHours: 40, totalEntries: 12 };
    },
    async getActiveTimer() {
      return null;
    },
    async listFreeProjects() {
      return [{ id: "fp1", name: "Remodelación Pérez", status: "active", location: "CDMX" }];
    },
    async listEntries() {
      return [
        {
          startedAt: new Date("2026-07-01T09:00:00Z"),
          durationMinutes: 120,
          jobId: null,
          freeProjectId: "fp1",
          purpose: "payable",
          notes: "Instalación de drywall",
        },
      ];
    },
    ...overrides,
  };
}

function createService(opts: {
  labor?: Partial<Record<string, unknown>>;
  generate?: () => Promise<Record<string, unknown>>;
} = {}) {
  const interactions: Array<Record<string, unknown>> = [];
  const labor = createLaborStub(opts.labor);
  const gateway = {
    async generate() {
      return opts.generate
        ? await opts.generate()
        : {
            output: "Esta semana llevas 12.5h.",
            provider: "ollama",
            modelSlug: "ollama-local",
            modelName: "Ollama Local",
            success: true,
            fallbackUsed: false,
          };
    },
  };
  const logger = {
    async logInteraction(request: Record<string, unknown>, response: Record<string, unknown>) {
      interactions.push({ request, response });
    },
  };

  const service = new LaborChatService(labor as never, gateway as never, logger as never);
  return { service, interactions };
}

test("chat forces privacyLevel local_only so the router picks ollama-local", async () => {
  let capturedRequest: Record<string, unknown> | null = null;
  const labor = createLaborStub();
  const gateway = {
    async generate(request: Record<string, unknown>) {
      capturedRequest = request;
      return { output: "ok", provider: "ollama", modelSlug: "ollama-local", modelName: "Ollama Local", success: true };
    },
  };
  const logger = { async logInteraction() {} };
  const svc = new LaborChatService(labor as never, gateway as never, logger as never);

  await svc.chat({ tenantId: "tnt_demo", orgId: "org_demo", userId: "usr_worker", message: "¿Cuántas horas llevo esta semana?", threadId: "th-1" });

  assert.equal(capturedRequest?.privacyLevel, "local_only");
  assert.equal(capturedRequest?.taskType, "general_chat");
  assert.match(String(capturedRequest?.context), /Semana actual: 12\.5h en 4 registro\(s\)/);
  assert.match(String(capturedRequest?.context), /Remodelación Pérez/);
  assert.match(String(capturedRequest?.context), /Instalación de drywall/);
});

test("chat returns runtime mode and logs the interaction on success", async () => {
  const { service, interactions } = createService();

  const result = await service.chat({
    tenantId: "tnt_demo",
    orgId: "org_demo",
    userId: "usr_worker",
    message: "resumen",
    threadId: "th-2",
  });

  assert.equal(result.mode, "runtime");
  assert.equal(result.threadId, "th-2");
  assert.equal(result.response, "Esta semana llevas 12.5h.");
  assert.equal(interactions.length, 1);
});

test("chat falls back to a friendly message when the gateway fails", async () => {
  const { service } = createService({
    generate: async () => ({
      output: "",
      provider: "none",
      modelSlug: "ollama-local",
      modelName: "",
      success: false,
      errorMessage: "connection refused",
    }),
  });

  const result = await service.chat({
    tenantId: "tnt_demo",
    orgId: "org_demo",
    userId: "usr_worker",
    message: "resumen",
    threadId: "th-3",
  });

  assert.equal(result.mode, "fallback");
  assert.match(result.response, /No pude conectar con el motor local de IA \(Ollama\)/);
  assert.match(result.response, /connection refused/);
});

test("context reports 'no timer activo' when there is none", async () => {
  let capturedRequest: Record<string, unknown> | null = null;
  const labor = createLaborStub();
  const gateway = {
    async generate(request: Record<string, unknown>) {
      capturedRequest = request;
      return { output: "ok", provider: "ollama", modelSlug: "ollama-local", modelName: "Ollama Local", success: true };
    },
  };
  const logger = { async logInteraction() {} };
  const svc = new LaborChatService(labor as never, gateway as never, logger as never);

  await svc.chat({ tenantId: "tnt_demo", orgId: "org_demo", userId: "usr_worker", message: "hola", threadId: "th-4" });

  assert.match(String(capturedRequest?.context), /No hay timer activo en este momento\./);
});

test("context describes the active timer with its resolved project label", async () => {
  let capturedRequest: Record<string, unknown> | null = null;
  const labor = createLaborStub({
    async getActiveTimer() {
      return { status: "running", jobId: null, freeProjectId: "fp1", purpose: "payable" };
    },
  });
  const gateway = {
    async generate(request: Record<string, unknown>) {
      capturedRequest = request;
      return { output: "ok", provider: "ollama", modelSlug: "ollama-local", modelName: "Ollama Local", success: true };
    },
  };
  const logger = { async logInteraction() {} };
  const svc = new LaborChatService(labor as never, gateway as never, logger as never);

  await svc.chat({ tenantId: "tnt_demo", orgId: "org_demo", userId: "usr_worker", message: "hola", threadId: "th-5" });

  assert.match(String(capturedRequest?.context), /Timer activo ahora: estado "running", en "Remodelación Pérez"\./);
});
