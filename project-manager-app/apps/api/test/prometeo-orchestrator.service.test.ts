import test from "node:test";
import assert from "node:assert/strict";
import { PrometeoOrchestratorService } from "../dist/modules/ai-models/orchestrator/prometeo-orchestrator.service.js";

test("orchestrator classifies resumen operativo as operational_summary", () => {
  const service = new PrometeoOrchestratorService();
  assert.equal(service.classifyIntent("Dame un resumen operativo del sistema"), "operational_summary");
});

test("orchestrator respects panel agent override when user opens a specialist", () => {
  const service = new PrometeoOrchestratorService();
  const route = service.routeToAgent("payment_status", "marta");

  assert.equal(route.primaryAgent, "Marta");
  assert.equal(route.selectionSource, "panel_agent");
  assert.equal(route.requestedAgentId, "marta");
  assert.equal(route.supportingAgents.includes("Prometeo"), true);
});

test("orchestrator routes dispute_status to Justus with Marta as support by intent", () => {
  const service = new PrometeoOrchestratorService();
  const route = service.routeToAgent("dispute_status");

  assert.equal(route.primaryAgent, "Justus");
  assert.equal(route.selectionSource, "intent");
  assert.equal(route.supportingAgents.includes("Marta"), true);
});

// ── Contractor mode tests ────────────────────────────────────────────────────

test("orchestrator classifies estimate request as estimate_generation", () => {
  const service = new PrometeoOrchestratorService();
  assert.equal(service.classifyIntent("Hazme un estimado para reparar el techo"), "estimate_generation");
  assert.equal(service.classifyIntent("Crea un estimado para trabajo de construcción"), "estimate_generation");
  assert.equal(service.classifyIntent("Prepara el estimado para este cliente"), "estimate_generation");
});

test("orchestrator classifies materials question as materials_list", () => {
  const service = new PrometeoOrchestratorService();
  assert.equal(service.classifyIntent("Lista de materiales para instalar drywall en 200 sqft"), "materials_list");
  assert.equal(service.classifyIntent("Qué materiales necesito para pintar una casa de 1500 sqft"), "materials_list");
});

test("orchestrator classifies price question as price_suggestion", () => {
  const service = new PrometeoOrchestratorService();
  assert.equal(service.classifyIntent("Cuánto debo cobrar por remodelar un baño"), "price_suggestion");
  assert.equal(service.classifyIntent("Cuánto cobrar por el trabajo de instalación"), "price_suggestion");
});

test("orchestrator classifies client message request as client_message", () => {
  const service = new PrometeoOrchestratorService();
  assert.equal(service.classifyIntent("Redacta un mensaje para el cliente González sobre el avance"), "client_message");
  assert.equal(service.classifyIntent("Escribe un mensaje de seguimiento para mi cliente"), "client_message");
});

test("isContractorIntent returns true for contractor intents and false for operational", () => {
  const service = new PrometeoOrchestratorService();
  assert.equal(service.isContractorIntent("estimate_generation"), true);
  assert.equal(service.isContractorIntent("materials_list"), true);
  assert.equal(service.isContractorIntent("price_suggestion"), true);
  assert.equal(service.isContractorIntent("client_message"), true);
  assert.equal(service.isContractorIntent("project_summary_client"), true);
  assert.equal(service.isContractorIntent("operational_summary"), false);
  assert.equal(service.isContractorIntent("dispute_status"), false);
});

test("buildNoProjectSelectedResponse returns empty string for contractor intents", () => {
  const service = new PrometeoOrchestratorService();
  const route = service.routeToAgent("estimate_generation");
  const mockCtx = {
    mode: "local", user: { id: "u1", role: "CLIENT", tenantId: "t1", orgId: "o1" },
    assistantSettings: { unifiedMode: true, expertMode: false },
    activeProject: null,
    preferredProfessional: null,
    jobs: { active: 0, waitingProposals: 0, completed: 0, recent: [] },
    milestones: { active: 0, pendingApproval: 0, submitted: 0 },
    payments: { escrowFunded: 0, escrowReleased: 0, pendingRelease: 0 },
    evidences: { total: 0, pendingReview: 0, approved: 0 },
    disputes: { open: 0, urgent: 0 },
    notifications: [],
    systemHealth: { api: "ok", worker: "ok", redis: "ok" },
    finance: null, ecosystem5d: null, risk: null,
    generatedAt: new Date().toISOString(),
  } as never;
  const response = service.buildNoProjectSelectedResponse(mockCtx, route);
  assert.equal(response, "");
});

test("buildContractorSystemPrompt includes construction expertise content", () => {
  const service = new PrometeoOrchestratorService();
  const mockCtx = {
    mode: "local", user: { id: "u1", role: "CLIENT", tenantId: "t1", orgId: "o1" },
    assistantSettings: { unifiedMode: true, expertMode: false },
    activeProject: null,
    preferredProfessional: null,
    jobs: { active: 0, waitingProposals: 0, completed: 0, recent: [] },
    milestones: { active: 0, pendingApproval: 0, submitted: 0 },
    payments: { escrowFunded: 0, escrowReleased: 0, pendingRelease: 0 },
    evidences: { total: 0, pendingReview: 0, approved: 0 },
    disputes: { open: 0, urgent: 0 },
    notifications: [],
    systemHealth: { api: "ok", worker: "ok", redis: "ok" },
    finance: null, ecosystem5d: null, risk: null,
    generatedAt: new Date().toISOString(),
  } as never;
  const prompt = service.buildContractorSystemPrompt(mockCtx, "estimate_generation");
  assert.ok(prompt.includes("contratistas"), "should include contractor expertise");
  assert.ok(prompt.includes("estimado") || prompt.includes("ESTIMADO"), "should have estimate instructions");
  assert.ok(prompt.includes("materiales"), "should reference materials");
});
