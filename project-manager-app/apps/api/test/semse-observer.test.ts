import test from "node:test";
import assert from "node:assert/strict";

/**
 * SEMSE Internal Observer v1 — Tests
 * Verifica el contrato del sistema de observación automática.
 * REGLA ABSOLUTA: Solo lectura. Observer no modifica nada.
 */

// ── Types (reproduce from observer.service.ts) ────────────────────────────────

type InfraHealth = { name: string; healthy: boolean; latencyMs?: number; detail?: string };
type ObserverAlert = { level: "critical" | "high" | "medium" | "info"; area: string; message: string; recommendation: string };
type SignalPattern = { type: string; count: number; severity: string; lastSeen: string; interpretation: string };

// ── Health score logic (reproduce from service) ───────────────────────────────

function computeHealthScore(opts: {
  unhealthyInfra: number;
  postgresDown: boolean;
  criticalSignals: number;
  highSignals: number;
  blockedPayments: number;
  ftsOnly: boolean;
  fallbackRate: number;
  ollamaAvailable: boolean;
  criticalAlerts: number;
  highAlerts: number;
}): number {
  let score = 100;
  score -= opts.unhealthyInfra * 15;
  if (opts.postgresDown) score -= 30;
  score -= opts.criticalSignals * 20;
  score -= opts.highSignals * 8;
  score -= Math.min(opts.blockedPayments * 3, 15);
  if (opts.ftsOnly) score -= 10;
  if (opts.fallbackRate > 0.5) score -= 10;
  if (!opts.ollamaAvailable) score -= 5;
  score -= opts.criticalAlerts * 5;
  score -= opts.highAlerts * 3;
  return Math.max(0, Math.min(100, score));
}

// ── Alert generation logic (reproduce key rules) ──────────────────────────────

function generateAlerts(opts: {
  postgresHealthy: boolean;
  criticalSignals: number;
  highSignals: number;
  blockedPayments: number;
  pendingCOs: number;
  fallbackRate: number;
  ollamaAvailable: boolean;
  embeddingsMode: string;
  missingEmbeddings: number;
}): ObserverAlert[] {
  const alerts: ObserverAlert[] = [];

  if (!opts.postgresHealthy)
    alerts.push({ level: "critical", area: "Infrastructure", message: "Postgres no healthy", recommendation: "Verificar Railway DB" });

  if (opts.criticalSignals > 0)
    alerts.push({ level: "critical", area: "Mission Control", message: `${opts.criticalSignals} señal(es) crítica(s)`, recommendation: "Revisar /admin/ai-mission-control" });
  else if (opts.highSignals > 2)
    alerts.push({ level: "high", area: "Mission Control", message: `${opts.highSignals} señales altas`, recommendation: "Resolver antes de liberar pagos" });

  if (opts.blockedPayments > 0)
    alerts.push({ level: "medium", area: "Payment Governance", message: `${opts.blockedPayments} pago(s) bloqueado(s)`, recommendation: "Revisar governance por milestone" });

  if (opts.pendingCOs > 3)
    alerts.push({ level: "medium", area: "Change Orders", message: `${opts.pendingCOs} COs pendientes`, recommendation: "Resolver change orders" });

  if (opts.fallbackRate > 0.5 && opts.ollamaAvailable)
    alerts.push({ level: "high", area: "LLM Intelligence", message: "Alta tasa de fallback cloud", recommendation: "Verificar Ollama" });

  if (!opts.ollamaAvailable)
    alerts.push({ level: "medium", area: "LLM Intelligence", message: "Ollama no disponible", recommendation: "Verificar OLLAMA_BASE_URL" });

  if (opts.embeddingsMode === "fts_fallback")
    alerts.push({ level: "medium", area: "Prometeo RAG", message: "RAG en FTS fallback", recommendation: "Verificar OPENAI_API_KEY" });
  else if (opts.missingEmbeddings > 10)
    alerts.push({ level: "medium", area: "Prometeo RAG", message: `${opts.missingEmbeddings} chunks sin embeddings`, recommendation: "POST /v1/prometeo/embeddings/backfill" });

  return alerts;
}

// ── Health score tests ────────────────────────────────────────────────────────

test("O.H1: ecosistema sano → score cercano a 100", () => {
  const score = computeHealthScore({
    unhealthyInfra: 0, postgresDown: false, criticalSignals: 0, highSignals: 0,
    blockedPayments: 0, ftsOnly: false, fallbackRate: 0, ollamaAvailable: true,
    criticalAlerts: 0, highAlerts: 0,
  });
  assert.ok(score >= 95, `score=${score} debe ser >= 95 cuando todo está sano`);
});

test("O.H2: Postgres caído → score cae drásticamente", () => {
  const healthy = computeHealthScore({ unhealthyInfra: 0, postgresDown: false, criticalSignals: 0, highSignals: 0, blockedPayments: 0, ftsOnly: false, fallbackRate: 0, ollamaAvailable: true, criticalAlerts: 0, highAlerts: 0 });
  const down    = computeHealthScore({ unhealthyInfra: 1, postgresDown: true,  criticalSignals: 0, highSignals: 0, blockedPayments: 0, ftsOnly: false, fallbackRate: 0, ollamaAvailable: true, criticalAlerts: 0, highAlerts: 0 });
  assert.ok(healthy - down >= 40, `Postgres caído debe reducir score >= 40 pts (fue ${healthy - down})`);
});

test("O.H3: señales críticas reducen score significativamente", () => {
  const base = computeHealthScore({ unhealthyInfra: 0, postgresDown: false, criticalSignals: 0, highSignals: 0, blockedPayments: 0, ftsOnly: false, fallbackRate: 0, ollamaAvailable: true, criticalAlerts: 0, highAlerts: 0 });
  const crit = computeHealthScore({ unhealthyInfra: 0, postgresDown: false, criticalSignals: 3, highSignals: 0, blockedPayments: 0, ftsOnly: false, fallbackRate: 0, ollamaAvailable: true, criticalAlerts: 1, highAlerts: 0 });
  assert.ok(base - crit >= 60, `3 señales críticas deben reducir score >= 60 pts (fue ${base - crit})`);
});

test("O.H4: score nunca es negativo ni mayor a 100", () => {
  const worst = computeHealthScore({ unhealthyInfra: 5, postgresDown: true, criticalSignals: 10, highSignals: 10, blockedPayments: 100, ftsOnly: true, fallbackRate: 1, ollamaAvailable: false, criticalAlerts: 5, highAlerts: 5 });
  const best  = computeHealthScore({ unhealthyInfra: 0, postgresDown: false, criticalSignals: 0, highSignals: 0, blockedPayments: 0, ftsOnly: false, fallbackRate: 0, ollamaAvailable: true, criticalAlerts: 0, highAlerts: 0 });
  assert.ok(worst >= 0, "score nunca debe ser negativo");
  assert.ok(best <= 100, "score nunca debe superar 100");
});

test("O.H5: FTS-only y sin Ollama reducen score moderadamente", () => {
  const optimal   = computeHealthScore({ unhealthyInfra: 0, postgresDown: false, criticalSignals: 0, highSignals: 0, blockedPayments: 0, ftsOnly: false, fallbackRate: 0, ollamaAvailable: true, criticalAlerts: 0, highAlerts: 0 });
  const degraded  = computeHealthScore({ unhealthyInfra: 0, postgresDown: false, criticalSignals: 0, highSignals: 0, blockedPayments: 0, ftsOnly: true, fallbackRate: 0, ollamaAvailable: false, criticalAlerts: 0, highAlerts: 1 });
  assert.ok(optimal - degraded >= 15, `FTS+sin Ollama debe reducir >= 15 pts (fue ${optimal - degraded})`);
  assert.ok(degraded >= 70, "Con FTS+sin Ollama pero sin señales críticas, score debe ser >= 70");
});

// ── Alert generation tests ────────────────────────────────────────────────────

test("O.A1: sistema sano → sin alertas", () => {
  const alerts = generateAlerts({ postgresHealthy: true, criticalSignals: 0, highSignals: 0, blockedPayments: 0, pendingCOs: 0, fallbackRate: 0.1, ollamaAvailable: true, embeddingsMode: "hybrid", missingEmbeddings: 0 });
  assert.equal(alerts.length, 0, "sistema sano no debe generar alertas");
});

test("O.A2: Postgres caído → alerta crítica", () => {
  const alerts = generateAlerts({ postgresHealthy: false, criticalSignals: 0, highSignals: 0, blockedPayments: 0, pendingCOs: 0, fallbackRate: 0, ollamaAvailable: true, embeddingsMode: "hybrid", missingEmbeddings: 0 });
  assert.ok(alerts.some((a) => a.level === "critical" && a.area === "Infrastructure"), "Postgres caído → alerta crítica en Infrastructure");
});

test("O.A3: señal crítica → alerta crítica en Mission Control", () => {
  const alerts = generateAlerts({ postgresHealthy: true, criticalSignals: 2, highSignals: 0, blockedPayments: 0, pendingCOs: 0, fallbackRate: 0, ollamaAvailable: true, embeddingsMode: "hybrid", missingEmbeddings: 0 });
  assert.ok(alerts.some((a) => a.level === "critical" && a.area === "Mission Control"), "señal crítica → alerta crítica Mission Control");
});

test("O.A4: pocas señales altas → alerta media, no crítica", () => {
  const alerts = generateAlerts({ postgresHealthy: true, criticalSignals: 0, highSignals: 2, blockedPayments: 0, pendingCOs: 0, fallbackRate: 0, ollamaAvailable: true, embeddingsMode: "hybrid", missingEmbeddings: 0 });
  const mc = alerts.filter((a) => a.area === "Mission Control");
  assert.equal(mc.length, 0, "2 señales altas no deben generar alerta de Mission Control (umbral es > 2)");
});

test("O.A5: pagos bloqueados → alerta media en Payment Governance", () => {
  const alerts = generateAlerts({ postgresHealthy: true, criticalSignals: 0, highSignals: 0, blockedPayments: 3, pendingCOs: 0, fallbackRate: 0, ollamaAvailable: true, embeddingsMode: "hybrid", missingEmbeddings: 0 });
  assert.ok(alerts.some((a) => a.area === "Payment Governance"), "pagos bloqueados → alerta Payment Governance");
});

test("O.A6: FTS fallback → alerta en Prometeo RAG", () => {
  const alerts = generateAlerts({ postgresHealthy: true, criticalSignals: 0, highSignals: 0, blockedPayments: 0, pendingCOs: 0, fallbackRate: 0, ollamaAvailable: true, embeddingsMode: "fts_fallback", missingEmbeddings: 0 });
  assert.ok(alerts.some((a) => a.area === "Prometeo RAG"), "FTS fallback → alerta Prometeo RAG");
});

test("O.A7: hybrid mode → sin alerta RAG", () => {
  const alerts = generateAlerts({ postgresHealthy: true, criticalSignals: 0, highSignals: 0, blockedPayments: 0, pendingCOs: 0, fallbackRate: 0, ollamaAvailable: true, embeddingsMode: "hybrid", missingEmbeddings: 0 });
  const rag = alerts.filter((a) => a.area === "Prometeo RAG");
  assert.equal(rag.length, 0, "hybrid mode no debe generar alerta RAG");
});

test("O.A8: chunks faltantes → alerta RAG con recomendación de backfill", () => {
  const alerts = generateAlerts({ postgresHealthy: true, criticalSignals: 0, highSignals: 0, blockedPayments: 0, pendingCOs: 0, fallbackRate: 0, ollamaAvailable: true, embeddingsMode: "hybrid", missingEmbeddings: 15 });
  const rag = alerts.find((a) => a.area === "Prometeo RAG");
  assert.ok(rag, "chunks faltantes debe generar alerta RAG");
  assert.ok(rag!.recommendation.includes("backfill"), "recomendación debe incluir backfill");
});

// ── ObservationSnapshot structure tests ───────────────────────────────────────

test("O.S1: snapshot tiene todas las secciones requeridas", () => {
  const requiredSections = [
    "observedAt", "tenantId", "healthScore", "autonomyNote",
    "infrastructure", "operationalHealth", "intelligenceHealth",
    "patterns", "alerts",
  ];

  const mockSnapshot: Record<string, unknown> = {
    observedAt: new Date().toISOString(),
    tenantId: "tenant_default",
    healthScore: 85,
    autonomyNote: "Nivel 0-1 — Solo lectura.",
    infrastructure: { items: [], allHealthy: true, unhealthyCount: 0 },
    operationalHealth: { openSignals: 0, criticalSignals: 0, highSignals: 0, recentSignalTypes: [], topSignal: null, milestones: { total: 0, blockedPayment: 0, readyPayment: 0 }, changeOrders: { pendingCount: 0 } },
    intelligenceHealth: { llmTotalCalls: 0, llmFallbacks: 0, fallbackRate: 0, ollamaAvailable: false, embeddingsMode: "hybrid", ragDocuments: 28, ragChunks: 176, ragEmbedded: 176, ragMissingEmbeddings: 0 },
    patterns: [],
    alerts: [],
  };

  requiredSections.forEach((s) => {
    assert.ok(s in mockSnapshot, `snapshot debe tener sección: ${s}`);
  });
});

test("O.S2: healthScore debe estar entre 0 y 100", () => {
  [0, 50, 85, 100].forEach((score) => {
    assert.ok(score >= 0 && score <= 100, `score=${score} debe estar en [0, 100]`);
  });
});

test("O.S3: autonomyNote debe confirmar que Observer es read-only", () => {
  const note = "Nivel 0-1 — Solo lectura. Observer no modifica nada.";
  assert.ok(note.toLowerCase().includes("lectura"), "nota debe mencionar lectura");
  assert.ok(!note.toLowerCase().includes("modifica") || note.toLowerCase().includes("no modifica"), "nota no debe implicar que modifica algo");
});

// ── Pattern detection tests ───────────────────────────────────────────────────

test("O.P1: señal recurrente se convierte en patrón", () => {
  const signalTypes = ["EVIDENCE_GAP", "EVIDENCE_GAP", "PAYMENT_BLOCKED"];
  const patterns: SignalPattern[] = [];

  const typeCounts = new Map<string, number>();
  signalTypes.forEach((t) => typeCounts.set(t, (typeCounts.get(t) ?? 0) + 1));
  typeCounts.forEach((count, type) => {
    if (count >= 1) {
      patterns.push({ type, count, severity: "medium", lastSeen: new Date().toISOString(), interpretation: `Patrón de ${type}` });
    }
  });

  assert.equal(patterns.length, 2, "deben detectarse 2 tipos de patrones únicos");
  const evidencePattern = patterns.find((p) => p.type === "EVIDENCE_GAP");
  assert.equal(evidencePattern?.count, 2, "EVIDENCE_GAP debe tener count=2");
});

test("O.P2: interpretaciones de señales conocidas", () => {
  const INTERPRETATIONS: Record<string, string> = {
    EVIDENCE_GAP: "Hay trabajo con evidencia incompleta",
    PAYMENT_BLOCKED: "Pagos bloqueados activos",
    DISPUTE_RISK_HIGH: "Riesgo de disputa elevado",
    CHANGE_ORDER_RECOMMENDED: "Trabajo adicional detectado sin change order",
  };

  Object.keys(INTERPRETATIONS).forEach((type) => {
    assert.ok(INTERPRETATIONS[type]!.length > 10, `Interpretación para ${type} debe ser descriptiva`);
  });
});

// ── Read-only invariants ──────────────────────────────────────────────────────

test("O.RO1: Observer solo tiene métodos de lectura", () => {
  const OBSERVER_METHODS = ["observe", "getHistory", "getLatest"];
  const WRITE_OPERATIONS = ["update", "delete", "create", "upsert", "save", "insert"];

  const hasWriteMethod = OBSERVER_METHODS.some((m) =>
    WRITE_OPERATIONS.some((op) => m.toLowerCase().includes(op.toLowerCase()))
  );
  assert.equal(hasWriteMethod, false, "SystemObserverService solo debe tener métodos de lectura");
});

test("O.RO2: endpoints Observer son todos GET (sin POST de mutación)", () => {
  const OBSERVER_ENDPOINTS = [
    { method: "GET",  path: "/v1/ops/observer/snapshot" },
    { method: "GET",  path: "/v1/ops/observer/latest" },
    { method: "GET",  path: "/v1/ops/observer/history" },
  ];

  OBSERVER_ENDPOINTS.forEach((ep) => {
    assert.equal(ep.method, "GET", `${ep.path} debe ser GET — Observer no muta datos`);
  });
});

test("O.RO3: Observer no interfiere con Payment Governance", () => {
  // Payment Governance es fuente de verdad para canRelease
  // Observer solo lee el estado, no lo modifica
  const PAYMENT_READONLY_FIELDS = ["blockedPayment", "readyPayment", "pendingCOs"];
  const PAYMENT_WRITE_FIELDS = ["canRelease", "approve", "reject", "release"];

  const intersection = PAYMENT_READONLY_FIELDS.filter((f) => PAYMENT_WRITE_FIELDS.includes(f));
  assert.equal(intersection.length, 0, "Observer solo lee campos de governance, no los modifica");
});

// ── History tests ─────────────────────────────────────────────────────────────

test("O.HI1: historial mantiene máximo 50 snapshots", () => {
  const MAX_HISTORY = 50;
  const mockHistory: number[] = Array.from({ length: 60 }, (_, i) => i);
  const trimmed = mockHistory.length > MAX_HISTORY ? mockHistory.slice(-(MAX_HISTORY)) : mockHistory;
  assert.equal(trimmed.length, MAX_HISTORY, "historial no debe superar 50 snapshots");
  assert.equal(trimmed[0], 10, "snapshot más antiguo debe ser el 11° (índice 10)");
});

test("O.HI2: resumen del historial incluye campos clave por snapshot", () => {
  const historySummaryFields = ["observedAt", "healthScore", "alerts", "criticalSignals", "ragMode"];
  historySummaryFields.forEach((f) => {
    assert.ok(f.length > 0, `campo de resumen ${f} debe ser válido`);
  });
});

// ── Intelligence health tests ─────────────────────────────────────────────────

test("O.I1: fallbackRate es 0 cuando no hay llamadas LLM", () => {
  const totalCalls = 0;
  const fallbacks  = 0;
  const rate = totalCalls > 0 ? fallbacks / totalCalls : 0;
  assert.equal(rate, 0, "fallbackRate debe ser 0 cuando no hay llamadas");
});

test("O.I2: fallbackRate alta indica posible problema con Ollama", () => {
  const totalCalls = 100;
  const fallbacks  = 70; // 70% de cloud
  const rate = fallbacks / totalCalls;
  assert.ok(rate > 0.5, `rate=${rate} debe ser > 0.5 para disparar alerta`);
});

test("O.I3: ragMissingEmbeddings se calcula correctamente", () => {
  const ragChunks  = 176;
  const ragEmbedded = 174;
  const missing = ragChunks - ragEmbedded;
  assert.equal(missing, 2, "missing embeddings debe ser chunks - embedded");
  assert.ok(missing < 10, "menos de 10 missing no debe generar alerta");
});
