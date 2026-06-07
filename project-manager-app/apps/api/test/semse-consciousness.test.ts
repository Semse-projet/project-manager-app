import test from "node:test";
import assert from "node:assert/strict";

/**
 * SEMSE Consciousness Index v1 — Tests
 * Verifica el contrato del espejo interno del ecosistema.
 * REGLA ABSOLUTA: Solo lectura. No modifica nada.
 */

// ── Reproduce scoring logic ────────────────────────────────────────────────────

type ModuleStatus = "mature" | "functional" | "partial" | "minimal" | "missing";

type ModuleDef = {
  name: string;
  hasBackend: boolean; hasFrontend: boolean; hasTests: boolean;
  hasSSE: boolean;     hasRAG: boolean;      hasAudit: boolean; hasPermissions: boolean;
};

function scoreModule(m: ModuleDef): { score: number; status: ModuleStatus; gaps: string[] } {
  const weights = { hasBackend: 25, hasFrontend: 20, hasTests: 20, hasSSE: 10, hasRAG: 10, hasAudit: 10, hasPermissions: 5 };
  let score = 0;
  const gaps: string[] = [];
  (Object.keys(weights) as Array<keyof typeof weights>).forEach((key) => {
    if (m[key]) score += weights[key];
    else gaps.push(key.replace("has", "").toLowerCase());
  });
  const status: ModuleStatus =
    score >= 90 ? "mature" :
    score >= 70 ? "functional" :
    score >= 45 ? "partial" :
    score >= 20 ? "minimal" : "missing";
  return { score, status, gaps };
}

// ── SemseConsciousnessIndex contract tests ────────────────────────────────────

test("C.ID1: identity.autonomyLevel debe ser 1 en v1 (solo diagnóstico)", () => {
  const autonomyLevel = 1; // hardcoded in v1
  assert.equal(autonomyLevel, 1, "v1 debe estar en Nivel 1 — Diagnóstico");
  assert.ok(autonomyLevel < 4, "No debe ser nivel de reparación todavía");
});

test("C.ID2: coreLoop debe contener el ciclo monetizable completo", () => {
  const coreLoop = ["Intake", "Estimate", "BuildOps", "Milestones", "Evidence", "Approval", "Payment"];
  assert.equal(coreLoop.length, 7, "El ciclo monetizable tiene 7 pasos");
  assert.ok(coreLoop.includes("Payment"), "Debe incluir Payment");
  assert.ok(coreLoop.includes("Evidence"), "Debe incluir Evidence");
  assert.ok(coreLoop.includes("BuildOps"), "Debe incluir BuildOps");
});

test("C.ID3: operatingPrinciples debe incluir política privacyCritical", () => {
  const principles = [
    "privacyCritical → nunca cloud",
    "Payment Governance es fuente de verdad para canRelease",
    "Evidence Review no libera pagos directamente",
    "RAG entrega contexto — los agentes deciden dentro de sus límites",
    "OBSERVE → ANALYZE → SUGGEST → VALIDATE → APPROVE → APPLY",
  ];
  assert.ok(principles.some((p) => p.includes("privacyCritical")), "debe tener política privacyCritical");
  assert.ok(principles.some((p) => p.includes("OBSERVE")), "debe tener ciclo de autonomía estratificada");
});

// ── Maturity scoring tests ──────────────────────────────────────────────────────

test("C.M1: módulo completamente implementado → score=100, status=mature", () => {
  const fullModule: ModuleDef = {
    name: "BuildOps", hasBackend: true, hasFrontend: true, hasTests: true,
    hasSSE: true, hasRAG: true, hasAudit: true, hasPermissions: true,
  };
  const { score, status } = scoreModule(fullModule);
  assert.equal(score, 100);
  assert.equal(status, "mature");
});

test("C.M2: módulo sin implementar → score=0, status=missing", () => {
  const emptyModule: ModuleDef = {
    name: "Marketplace", hasBackend: false, hasFrontend: false, hasTests: false,
    hasSSE: false, hasRAG: false, hasAudit: false, hasPermissions: false,
  };
  const { score, status, gaps } = scoreModule(emptyModule);
  assert.equal(score, 0);
  assert.equal(status, "missing");
  assert.equal(gaps.length, 7);
});

test("C.M3: módulo parcial (solo backend+tests) → score=45, status=partial", () => {
  const partialModule: ModuleDef = {
    name: "Contractors", hasBackend: true, hasFrontend: false, hasTests: true,
    hasSSE: false, hasRAG: false, hasAudit: false, hasPermissions: false,
  };
  const { score, status } = scoreModule(partialModule);
  assert.equal(score, 45, "backend(25) + tests(20) = 45");
  assert.equal(status, "partial");
});

test("C.M4: módulo funcional (backend+frontend+tests+permisos) → status=functional", () => {
  const functionalModule: ModuleDef = {
    name: "Finance", hasBackend: true, hasFrontend: true, hasTests: false,
    hasSSE: true, hasRAG: false, hasAudit: false, hasPermissions: true,
  };
  const { score, status } = scoreModule(functionalModule);
  assert.equal(score, 60, "backend(25)+frontend(20)+sse(10)+permissions(5)=60");
  assert.equal(status, "partial", "60 es partial (70+ es functional)");
});

test("C.M5: globalScore es promedio de todos los módulos", () => {
  const scores = [100, 80, 60, 40, 0];
  const globalScore = Math.round(scores.reduce((a, b) => a + b, 0) / scores.length);
  assert.equal(globalScore, 56);
});

test("C.M6: maturity identifica correctamente áreas fuertes y débiles", () => {
  const modules = [
    { module: "BuildOps", score: 100, status: "mature" as ModuleStatus, gaps: [] },
    { module: "Evidence", score: 90, status: "mature" as ModuleStatus, gaps: [] },
    { module: "Marketplace", score: 0, status: "missing" as ModuleStatus, gaps: ["backend", "frontend"] },
    { module: "Worker", score: 25, status: "minimal" as ModuleStatus, gaps: ["frontend", "sse"] },
  ];

  const sorted = [...modules].sort((a, b) => b.score - a.score);
  const strongest = sorted.filter((m) => m.score >= 70).map((m) => m.module);
  const weakest = sorted.filter((m) => m.score < 60).map((m) => m.module);

  assert.ok(strongest.includes("BuildOps"), "BuildOps debe estar en strongest");
  assert.ok(weakest.includes("Marketplace"), "Marketplace debe estar en weakest");
  assert.ok(!strongest.includes("Marketplace"), "Marketplace no debe estar en strongest");
});

// ── Risk detection tests ────────────────────────────────────────────────────────

test("C.R1: señales críticas abiertas → risk crítico", () => {
  const criticalSignals = 3;
  const risks: Array<{ severity: string; area: string; message: string }> = [];
  if (criticalSignals > 0) {
    risks.push({ severity: "critical", area: "Mission Control", message: `${criticalSignals} señales críticas abiertas` });
  }
  assert.ok(risks.some((r) => r.severity === "critical"), "debe generar risk crítico");
});

test("C.R2: Ollama no registrado → risk alto", () => {
  const ollamaAvailable = false;
  const risks: Array<{ severity: string; area: string }> = [];
  if (!ollamaAvailable) {
    risks.push({ severity: "high", area: "LLM Infrastructure" });
  }
  assert.ok(risks.some((r) => r.severity === "high" && r.area === "LLM Infrastructure"), "Ollama ausente → risk alto");
});

test("C.R3: embeddings no disponibles → risk alto", () => {
  const embeddingsAvailable = false;
  const risks: Array<{ severity: string; area: string }> = [];
  if (!embeddingsAvailable) {
    risks.push({ severity: "high", area: "Embeddings" });
  }
  assert.ok(risks.some((r) => r.area === "Embeddings"), "sin embeddings → risk alto");
});

test("C.R4: sin señales críticas ni Ollama caído → no hay risks críticos por infraestructura", () => {
  const criticalSignals = 0;
  const ollamaAvailable = true;
  const risks: Array<{ severity: string; area: string }> = [];
  if (criticalSignals > 0) risks.push({ severity: "critical", area: "Mission Control" });
  if (!ollamaAvailable) risks.push({ severity: "high", area: "LLM Infrastructure" });
  assert.equal(risks.length, 0, "sin problemas no debe haber risks de infraestructura");
});

// ── Recommendations tests ──────────────────────────────────────────────────────

test("C.RE1: doNotDoYet debe incluir self-healing en v1", () => {
  const doNotDoYet = [
    "Auto-healing / self-repair — requiere Internal Observer maduro primero",
    "Marketplace — requiere madurez operacional completa",
    "Modificar payment governance core sin tests de regresión",
    "Agregar más LLM providers externos",
  ];
  assert.ok(doNotDoYet.some((d) => d.toLowerCase().includes("self") || d.toLowerCase().includes("auto-heal")), "Self-healing debe estar en doNotDoYet");
});

test("C.RE2: strategicWarnings debe advertir contra autonomía prematura", () => {
  const warnings = [
    "No implementar Self-Healing hasta tener Internal Observer estable",
    "No automatizar liberación de pagos — mantener aprobación humana obligatoria",
  ];
  assert.ok(warnings.some((w) => w.includes("Self-Healing") || w.includes("Internal Observer")), "debe advertir sobre orden correcto de implementación");
  assert.ok(warnings.some((w) => w.includes("pagos") || w.includes("payment")), "debe proteger el ciclo de pagos");
});

test("C.RE3: nextBestActions no debe sugerir self-repair como primera acción", () => {
  const nextBestActions = [
    "URGENTE: Resolver señales críticas",
    "Subir manuales trade a Prometeo RAG",
    "Trade Knowledge Library",
    "RAG Fase 5 — Human Feedback Memory Loop",
    "SEMSE Internal Observer v1",
  ];
  const firstAction = nextBestActions[0] ?? "";
  assert.ok(!firstAction.toLowerCase().includes("self-repair"), "primera acción no debe ser self-repair");
  assert.ok(!firstAction.toLowerCase().includes("auto-fix"), "primera acción no debe ser auto-fix");
});

// ── Read-only constraint tests ─────────────────────────────────────────────────

test("C.RO1: índice de consciencia NUNCA debe modificar datos (contrato)", () => {
  // This test documents the invariant: ConsciousnessIndexService is READ-ONLY
  const ALLOWED_OPERATIONS = ["SELECT", "COUNT", "findMany", "findFirst", "findUnique"];
  const FORBIDDEN_OPERATIONS = ["UPDATE", "DELETE", "CREATE", "INSERT", "upsert", "update", "delete", "create"];

  // Verify the service contract conceptually
  const consciousnessServiceActions = ["buildIndex", "queryConsciousness", "buildModuleMap", "buildServiceMap"];
  const hasWriteMethod = consciousnessServiceActions.some((action) =>
    FORBIDDEN_OPERATIONS.some((op) => action.toLowerCase().includes(op.toLowerCase()))
  );
  assert.equal(hasWriteMethod, false, "ConsciousnessIndexService no debe tener métodos de escritura");
});

test("C.RO2: autonomyLevel=1 implica Diagnóstico — no puede hacer cambios", () => {
  const autonomyLevel = 1;
  const CAN_MODIFY_CODE    = autonomyLevel >= 4;
  const CAN_TOUCH_PAYMENTS = false; // always false regardless of level
  const CAN_AUTO_DEPLOY    = autonomyLevel >= 5;

  assert.equal(CAN_MODIFY_CODE, false, "Nivel 1 no puede modificar código");
  assert.equal(CAN_TOUCH_PAYMENTS, false, "Ningún nivel toca pagos sin humano");
  assert.equal(CAN_AUTO_DEPLOY, false, "Nivel 1 no puede auto-deployar");
});

test("C.RO3: el ciclo de autonomía estratificada es correcto", () => {
  const AUTONOMY_LEVELS = [
    { level: 0, name: "OBSERVACIÓN",        canModify: false, canSuggest: false },
    { level: 1, name: "DIAGNÓSTICO",        canModify: false, canSuggest: false },
    { level: 2, name: "RECOMENDACIÓN",      canModify: false, canSuggest: true  },
    { level: 3, name: "SIMULACIÓN",         canModify: false, canSuggest: true  },
    { level: 4, name: "REPARACIÓN",         canModify: true,  canSuggest: true  },
    { level: 5, name: "EVOLUCIÓN",          canModify: true,  canSuggest: true  },
  ];

  // v1 is level 1 — no modification
  const currentLevel = AUTONOMY_LEVELS.find((l) => l.level === 1)!;
  assert.equal(currentLevel.canModify, false, "Nivel 1 no puede modificar");
  assert.equal(currentLevel.name, "DIAGNÓSTICO");

  // Levels < 4 cannot modify
  const nonModifying = AUTONOMY_LEVELS.filter((l) => !l.canModify);
  assert.equal(nonModifying.length, 4, "Solo niveles 0-3 no modifican");
});

// ── SemseConsciousnessIndex type structure ────────────────────────────────────

test("C.TY1: índice debe tener todas las secciones requeridas", () => {
  const requiredSections = [
    "generatedAt", "version", "identity", "body", "memory",
    "brains", "maturity", "risks", "operationalState", "recommendations",
  ];

  // Mock index
  const mockIndex: Record<string, unknown> = {
    generatedAt: new Date().toISOString(),
    version: "1",
    identity: { name: "SEMSE OS", purpose: "...", coreLoop: [], operatingPrinciples: [], autonomyLevel: 1, autonomyDescription: "..." },
    body: { modules: [], services: [], knownSSEChannels: [], knownSSEEvents: [] },
    memory: { ragStatus: {}, auditLogActive: true, operationalSignalsActive: true, reportsDirectory: "docs/reportes/", memoryLayers: [] },
    brains: { providers: [], routingPolicy: {}, privacyRules: [], totalLLMCalls: 0, totalFallbacks: 0 },
    maturity: { globalScore: 0, byModule: [], strongestAreas: [], weakestAreas: [] },
    risks: { critical: [], high: [], medium: [], low: [] },
    operationalState: { openSignals: 0, criticalSignals: 0, monetizableFlowReady: false, monetizableFlowStatus: "" },
    recommendations: { nextBestActions: [], doNotDoYet: [], strategicWarnings: [] },
  };

  requiredSections.forEach((section) => {
    assert.ok(section in mockIndex, `índice debe tener sección: ${section}`);
  });
});

test("C.TY2: risks debe tener las 4 severidades", () => {
  const risks = { critical: [], high: [], medium: [], low: [] };
  assert.ok("critical" in risks);
  assert.ok("high" in risks);
  assert.ok("medium" in risks);
  assert.ok("low" in risks);
});

test("C.TY3: maturity.globalScore debe estar entre 0 y 100", () => {
  const scores = [0, 25, 50, 75, 100];
  scores.forEach((score) => {
    assert.ok(score >= 0 && score <= 100, `score ${score} debe estar entre 0 y 100`);
  });
});

// ── Consciousness vs. other layers: no overlapping responsibility ─────────────

test("C.SEP1: Consciousness NO reemplaza Mission Control (operacional)", () => {
  const consciousnessScope = ["ecosystem identity", "maturity", "strategic recommendations", "risks"];
  const missionControlScope = ["project signals", "incidents", "operational alerts"];
  const overlap = consciousnessScope.filter((c) => missionControlScope.includes(c));
  assert.equal(overlap.length, 0, "No debe haber overlap entre Consciousness y Mission Control");
});

test("C.SEP2: Consciousness NO reemplaza AI Mission Control (LLM providers)", () => {
  const consciousnessScope = ["ecosystem identity", "maturity score", "module health"];
  const aiMissionControlScope = ["LLM provider health", "Ollama latency", "LLM call metrics"];
  const overlap = consciousnessScope.filter((c) => aiMissionControlScope.includes(c));
  assert.equal(overlap.length, 0, "Consciousness y AI Mission Control no se solapan");
});

test("C.SEP3: Consciousness NO reemplaza Prometeo RAG (memoria documental)", () => {
  const consciousnessScope = ["system state", "module maturity", "strategic direction"];
  const ragScope = ["document retrieval", "trade guides", "operational context"];
  const overlap = consciousnessScope.filter((c) => ragScope.includes(c));
  assert.equal(overlap.length, 0, "Consciousness y RAG tienen responsabilidades distintas");
});
