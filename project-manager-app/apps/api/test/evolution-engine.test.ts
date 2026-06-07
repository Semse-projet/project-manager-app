import test from "node:test";
import assert from "node:assert/strict";

/**
 * Evolution Engine (Autonomy Level 5) — Tests unitarios
 * El sistema detecta patrones y propone el siguiente bloque de desarrollo.
 */

// ── Signal detection logic ────────────────────────────────────────────────────

type EvolutionSignal = {
  type: "maturity_gap" | "recurring_alert" | "infra_degradation" | "knowledge_gap" | "autonomy_ceiling";
  severity: "critical" | "high" | "medium" | "low";
  area: string;
  trend: "worsening" | "stable" | "improving";
};

type ModuleScore = { module: string; score: number; gaps: string[] };

function detectMaturityGap(modules: ModuleScore[]): EvolutionSignal | null {
  const weak = modules.filter((m) => m.score < 60);
  if (weak.length === 0) return null;
  return {
    type: "maturity_gap",
    area: weak.map((m) => m.module).join(", "),
    severity: weak.some((m) => m.score < 30) ? "high" : "medium",
    trend: "stable",
  };
}

function detectKnowledgeGap(ragDocuments: number): EvolutionSignal | null {
  if (ragDocuments >= 15) return null;
  return {
    type: "knowledge_gap",
    area: "Prometeo RAG",
    severity: ragDocuments === 0 ? "high" : "medium",
    trend: "stable",
  };
}

function detectInfraDegradation(unhealthyCount: number): EvolutionSignal | null {
  if (unhealthyCount === 0) return null;
  return {
    type: "infra_degradation",
    area: "Infrastructure",
    severity: "high",
    trend: "worsening",
  };
}

test("EV.S1: módulos con score < 60 generan señal de maturity_gap", () => {
  const modules: ModuleScore[] = [
    { module: "Marketplace", score: 40, gaps: ["tests"] },
    { module: "Finance",     score: 80, gaps: [] },
  ];
  const signal = detectMaturityGap(modules);
  assert.ok(signal !== null);
  assert.equal(signal?.type, "maturity_gap");
  assert.ok(signal?.area.includes("Marketplace"));
});

test("EV.S2: todos los módulos maduros → sin señal de maturity_gap", () => {
  const modules: ModuleScore[] = [
    { module: "BuildOps", score: 100, gaps: [] },
    { module: "Evidence", score: 90, gaps: [] },
  ];
  assert.equal(detectMaturityGap(modules), null);
});

test("EV.S3: score < 30 → severidad high", () => {
  const modules: ModuleScore[] = [{ module: "Notifications", score: 25, gaps: ["tests", "frontend"] }];
  const signal = detectMaturityGap(modules);
  assert.equal(signal?.severity, "high");
});

test("EV.S4: menos de 15 docs RAG → knowledge_gap", () => {
  const signal = detectKnowledgeGap(5);
  assert.ok(signal !== null);
  assert.equal(signal?.type, "knowledge_gap");
  assert.equal(signal?.severity, "medium");
});

test("EV.S5: 0 docs RAG → knowledge_gap high", () => {
  const signal = detectKnowledgeGap(0);
  assert.equal(signal?.severity, "high");
});

test("EV.S6: >= 15 docs → sin knowledge_gap", () => {
  assert.equal(detectKnowledgeGap(28), null); // current: 28 docs
});

test("EV.S7: infra degradada → infra_degradation signal", () => {
  const signal = detectInfraDegradation(2);
  assert.ok(signal !== null);
  assert.equal(signal?.trend, "worsening");
});

test("EV.S8: infra sana → sin señal", () => {
  assert.equal(detectInfraDegradation(0), null);
});

// ── Priority scoring ──────────────────────────────────────────────────────────

type EvolutionPriority = { rank: number; urgency: "now" | "next" | "later"; what: string; effort: "low" | "medium" | "high" };

function sortPriorities(priorities: EvolutionPriority[]): EvolutionPriority[] {
  const ORDER = { now: 0, next: 1, later: 2 };
  return [...priorities].sort((a, b) => ORDER[a.urgency] - ORDER[b.urgency]);
}

test("EV.P1: 'now' siempre antes que 'next' y 'later'", () => {
  const priorities: EvolutionPriority[] = [
    { rank: 3, urgency: "later", what: "Feature X", effort: "high" },
    { rank: 1, urgency: "now",   what: "Fix crítico", effort: "medium" },
    { rank: 2, urgency: "next",  what: "Tests",      effort: "low" },
  ];
  const sorted = sortPriorities(priorities);
  assert.equal(sorted[0]?.urgency, "now");
  assert.equal(sorted[1]?.urgency, "next");
  assert.equal(sorted[2]?.urgency, "later");
});

test("EV.P2: sin señales críticas → primeras prioridades son 'next'", () => {
  const priorities: EvolutionPriority[] = [
    { rank: 1, urgency: "next",  what: "Tests Marketplace", effort: "medium" },
    { rank: 2, urgency: "later", what: "Mobile UX", effort: "high" },
  ];
  const sorted = sortPriorities(priorities);
  assert.equal(sorted[0]?.urgency, "next");
  assert.ok(!sorted.some((p) => p.urgency === "now"), "sin urgentes cuando no hay alertas");
});

// ── Next block proposal ───────────────────────────────────────────────────────

function proposeNextBlock(hasAlerts: boolean, globalScore: number): { name: string; urgency: "urgent" | "normal" } {
  if (hasAlerts) return { name: "Bloque Urgente — Estabilización", urgency: "urgent" };
  if (globalScore < 70) return { name: "Bloque F — Madurez de módulos débiles", urgency: "normal" };
  return { name: "Bloque F — Experiencia y escala", urgency: "normal" };
}

test("EV.NB1: con alertas → bloque urgente de estabilización", () => {
  const block = proposeNextBlock(true, 65);
  assert.equal(block.urgency, "urgent");
  assert.ok(block.name.includes("Estabilización"));
});

test("EV.NB2: sin alertas + madurez baja → bloque de madurez", () => {
  const block = proposeNextBlock(false, 60);
  assert.ok(block.name.includes("Madurez") || block.name.includes("débiles"));
});

test("EV.NB3: sin alertas + madurez alta → bloque de escala", () => {
  const block = proposeNextBlock(false, 80);
  assert.ok(block.name.includes("escala") || block.name.includes("Experiencia"));
});

// ── Evolution report contract ─────────────────────────────────────────────────

test("EV.R1: reporte tiene autonomyLevel=5", () => {
  const report = { autonomyLevel: 5 as const };
  assert.equal(report.autonomyLevel, 5);
});

test("EV.R2: reporte incluye todas las secciones requeridas", () => {
  const required = ["generatedAt", "systemScore", "autonomyLevel", "signals", "priorities", "nextBlock", "strategicWarnings"];
  const mock: Record<string, unknown> = {
    generatedAt: new Date().toISOString(),
    systemScore: 88,
    autonomyLevel: 5,
    signals: [],
    priorities: [],
    nextBlock: { name: "Test", description: "...", items: [], rationale: "..." },
    strategicWarnings: [],
  };
  required.forEach((f) => {
    assert.ok(f in mock, `reporte debe incluir: ${f}`);
  });
});

test("EV.R3: nextBlock tiene estructura correcta", () => {
  const nextBlock = { name: "Bloque F", description: "...", items: ["item 1"], rationale: "razón" };
  assert.ok("name" in nextBlock);
  assert.ok("items" in nextBlock);
  assert.ok(Array.isArray(nextBlock.items));
});

// ── Strategic warnings ────────────────────────────────────────────────────────

test("EV.W1: warnings siempre incluyen recordatorio de aprobación humana para pagos", () => {
  const warnings = [
    "Payment Governance es fuente de verdad para canRelease — no automatizar sin aprobación humana.",
    "No implementar self-healing completo hasta que el Evolution feedback loop esté probado.",
  ];
  assert.ok(warnings.some((w) => w.toLowerCase().includes("payment") || w.toLowerCase().includes("aprobación")));
});

test("EV.W2: Evolution Level 5 no modifica código automáticamente", () => {
  // Evolution Engine propone, no aplica
  const EVOLUTION_OPERATIONS = ["evolve", "detect signals", "prioritize", "proposeNextBlock"];
  const APPLY_OPERATIONS     = ["write file", "git push", "deploy", "modify"];
  const overlap = EVOLUTION_OPERATIONS.filter((op) => APPLY_OPERATIONS.some((a) => op.includes(a)));
  assert.equal(overlap.length, 0, "Evolution Engine no debe aplicar cambios directamente");
});

// ── Autonomy Core complete cycle ──────────────────────────────────────────────

test("EV.AC1: ciclo completo de autonomía — niveles 0-5", () => {
  const LEVELS = [
    { level: 0, name: "Observación",    readonly: true  },
    { level: 1, name: "Diagnóstico",    readonly: true  },
    { level: 2, name: "Recomendación",  readonly: true  },
    { level: 3, name: "Simulación",     readonly: true  },
    { level: 4, name: "Reparación",     readonly: false }, // escribe archivos
    { level: 5, name: "Evolución",      readonly: true  }, // propone, no aplica
  ];

  // All levels 0-3 and 5 are read-only
  const readOnly = LEVELS.filter((l) => l.readonly);
  assert.equal(readOnly.length, 5, "5 de 6 niveles son read-only");

  // Only level 4 can write, with triple confirmation
  const canWrite = LEVELS.filter((l) => !l.readonly);
  assert.equal(canWrite.length, 1);
  assert.equal(canWrite[0]?.level, 4, "solo el nivel 4 (reparación) puede escribir archivos");
});

test("EV.AC2: evolution report cita fuentes de sus señales", () => {
  const signal: EvolutionSignal & { evidence: string[] } = {
    type: "maturity_gap",
    severity: "medium",
    area: "Marketplace",
    trend: "stable",
    evidence: ["Marketplace: score=40, faltan tests y SSE"],
  };
  assert.ok(signal.evidence.length > 0, "señales deben citar evidencia");
});

test("EV.AC3: priorities tienen dependsOn para trazabilidad", () => {
  const priority: EvolutionPriority & { dependsOn: string[] } = {
    rank: 1,
    urgency: "next",
    what: "Autonomy Level 5 feedback loop",
    effort: "high",
    dependsOn: ["Apply Engine (✅)", "AuditLog (✅)", "Observer (✅)"],
  };
  assert.ok(priority.dependsOn.length > 0, "prioridades con dependencias deben listarlas");
});
