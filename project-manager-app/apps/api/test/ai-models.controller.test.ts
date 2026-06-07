import test from "node:test";
import assert from "node:assert/strict";
import { AiModelsController } from "../dist/modules/ai-models/ai-models.controller.js";

function actorHeaders() {
  return {
    "x-request-id": "req-ai-models",
    "x-tenant-id": "tenant_default",
    "x-org-id": "org_client_001",
    "x-user-id": "usr_client_001",
    "x-roles": "CLIENT",
  };
}

function createController() {
  const calls = {
    interactions: [] as Array<Record<string, unknown>>,
    synthetic: [] as Array<Record<string, unknown>>,
  };

  const gateway = {
    async generate() {
      return {
        output: "respuesta runtime",
        provider: "anthropic",
        modelSlug: "claude-sonnet",
        modelName: "Claude Sonnet",
        success: true,
        fallbackUsed: false,
        latencyMs: 120,
        routeReason: "Default route",
      };
    },
    hasRuntimeProvider() {
      return true;
    },
    getRuntimeProviders() {
      return ["anthropic", "template"];
    },
  };

  const logger = {
    async logInteraction(request: Record<string, unknown>, response: Record<string, unknown>) {
      calls.interactions.push({ request, response });
    },
    async logSyntheticInteraction(input: Record<string, unknown>) {
      calls.synthetic.push(input);
    },
    getRecentLogs() {
      return [];
    },
    async getDbLogs() {
      return [];
    },
    async getStats() {
      return { total: 0, success: 0, failureRate: 0, byModel: {}, byTask: {}, byMode: {} };
    },
  };

  const router = {
    selectRoute() {
      return { primaryModelSlug: "claude-sonnet", reason: "Default route" };
    },
  };

  const operationalContext = {
    async buildContext() {
      return {
        mode: "local",
        user: { id: "usr_client_001", role: "CLIENT", tenantId: "tenant_default", orgId: "org_client_001" },
        assistantSettings: { unifiedMode: true, expertMode: false },
        activeProject: null,
        preferredProfessional: null,
        jobs: { active: 1, waitingProposals: 0, completed: 0, recent: [{ id: "job_1", title: "Trabajo demo", status: "PUBLISHED" }] },
        milestones: { active: 0, pendingApproval: 0, submitted: 0 },
        payments: { escrowFunded: 0, escrowReleased: 0, pendingRelease: 0 },
        evidences: { total: 0, pendingReview: 0, approved: 0 },
        disputes: { open: 0, urgent: 0 },
        notifications: [],
        systemHealth: { api: "ok", worker: "ok", redis: "ok" },
        finance: null,
        ecosystem5d: null,
        risk: null,
        generatedAt: "2026-05-01T00:00:00.000Z",
      };
    },
    formatContextBlock() {
      return "CTX";
    },
    async getLatestSnapshot() {
      return null;
    },
  };

  const orchestrator = {
    classifyIntent(message: string) {
      if (message.includes("resumen")) return "operational_summary";
      return "project_report";
    },
    routeToAgent(intent: string) {
      return {
        intent,
        primaryAgent: intent === "operational_summary" ? "SEMSE Core" : "Pulse",
        supportingAgents: [],
        contextRequired: [],
        systemPromptAddition: "prompt",
        selectionSource: "intent",
      };
    },
    isContractorIntent() { return false; },
    mapIntentToTaskType(intent: string) {
      return intent === "operational_summary" ? "document_summary" : "project_planning";
    },
    buildOperationalReport() {
      return "REPORTE OPERATIVO";
    },
    buildNoProjectSelectedResponse() {
      return "NO PROJECT";
    },
    buildSystemPrompt() {
      return "prompt";
    },
  };

  const budgetIntelligence = {
    async suggestBudget() {
      return null;
    },
  };

  return {
    controller: new AiModelsController(
      gateway as never,
      router as never,
      logger as never,
      {
        async persist() { return {}; },
        async getRecent() { return []; },
      } as never,
      operationalContext as never,
      orchestrator as never,
      budgetIntelligence as never,
    ),
    calls,
  };
}

test("ai-models controller generate logs runtime interactions", async () => {
  const { controller, calls } = createController();

  const result = await controller.generate(
    { headers: actorHeaders() } as never,
    { taskType: "general_chat", input: "hola", agentId: "assistant" },
  );

  assert.equal(result.requestId, "req-ai-models");
  assert.equal(calls.interactions.length, 1);
  assert.equal(calls.synthetic.length, 0);
});

test("ai-models controller readiness exposes gateway and route diagnostics", async () => {
  const { controller } = createController();

  const result = controller.getReadiness({ headers: actorHeaders() } as never);

  assert.equal(result.requestId, "req-ai-models");
  assert.equal(result.data.llmOrchestrator.hasProvider, true);
  assert.deepEqual(result.data.llmOrchestrator.providers, ["anthropic", "template"]);
  assert.ok(Array.isArray(result.data.models));
  assert.ok(result.data.models.length > 0);
  assert.ok(Array.isArray(result.data.routeSamples));
  assert.ok(result.data.routeSamples.length > 0);
});

test("ai-models controller returns context_only and writes synthetic log when no project is selected", async () => {
  const { controller, calls } = createController();

  const result = await controller.prometeoChat(
    { headers: actorHeaders() } as never,
    { message: "necesito el estado del proyecto", agentId: "pulse" },
  );

  assert.equal(result.data.mode, "context_only");
  assert.equal(result.data.response, "NO PROJECT");
  assert.equal(calls.synthetic.length, 1);
  assert.equal(calls.synthetic[0]?.mode, "context_only");
});

test("ai-models controller returns report mode and writes synthetic log for operational summary", async () => {
  const { controller, calls } = createController();

  const result = await controller.prometeoChat(
    { headers: actorHeaders() } as never,
    { message: "dame un resumen operativo", agentId: "assistant" },
  );

  assert.equal(result.data.mode, "report");
  assert.equal(result.data.response, "REPORTE OPERATIVO");
  assert.equal(calls.synthetic.length, 1);
  assert.equal(calls.synthetic[0]?.mode, "report");
});
