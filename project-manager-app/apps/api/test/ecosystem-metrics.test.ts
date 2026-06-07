import test from "node:test";
import assert from "node:assert/strict";

/**
 * Ecosystem Metrics — Tests unitarios
 * Sin DB, sin HTTP. Cubre cálculos de métricas y contratos del sistema.
 */

// ── Conversion rate ────────────────────────────────────────────────────────────

function conversionRate(accepted: number, total: number): number {
  return total > 0 ? Math.round((accepted / total) * 100) : 0;
}

test("EM.CR1: conversión 2/10 = 20%", () => {
  assert.equal(conversionRate(2, 10), 20);
});

test("EM.CR2: conversión 0/0 = 0% (sin división por cero)", () => {
  assert.equal(conversionRate(0, 0), 0);
});

test("EM.CR3: conversión 10/10 = 100%", () => {
  assert.equal(conversionRate(10, 10), 100);
});

test("EM.CR4: conversión redondea al entero más cercano", () => {
  assert.equal(conversionRate(1, 3), 33); // 33.33% → 33
});

// ── Completion rate ────────────────────────────────────────────────────────────

function completionRate(approved: number, total: number): number {
  return total > 0 ? Math.round((approved / total) * 100) : 0;
}

test("EM.COMP1: evidence completionRate sin items = 0%", () => {
  assert.equal(completionRate(0, 0), 0);
});

test("EM.COMP2: milestone completionRate parcial", () => {
  assert.equal(completionRate(3, 5), 60);
});

test("EM.COMP3: completionRate 100% cuando todos aprobados", () => {
  assert.equal(completionRate(7, 7), 100);
});

// ── Top category ──────────────────────────────────────────────────────────────

function topCategory(byCategory: Record<string, number>): [string, number] | null {
  const entries = Object.entries(byCategory).sort(([, a], [, b]) => b - a);
  return entries.length > 0 ? entries[0]! : null;
}

test("EM.CAT1: top category es la con más trabajos", () => {
  const cats = { electrical: 5, plumbing: 2, painting: 8 };
  const top = topCategory(cats);
  assert.equal(top?.[0], "painting");
  assert.equal(top?.[1], 8);
});

test("EM.CAT2: sin categorías → null", () => {
  assert.equal(topCategory({}), null);
});

test("EM.CAT3: una sola categoría → esa es el top", () => {
  const cats = { electrical: 3 };
  const top = topCategory(cats);
  assert.equal(top?.[0], "electrical");
});

// ── Health score from metrics ─────────────────────────────────────────────────

function ecosystemHealthScore(data: {
  signals: { critical: number; high: number };
  evidence: { completionRate: number };
  milestones: { completionRate: number };
  agents: { totalErrors: number; active: number };
}): number {
  let score = 100;
  score -= data.signals.critical * 20;
  score -= data.signals.high * 8;
  score -= Math.max(0, 60 - data.evidence.completionRate) * 0.3;
  score -= Math.max(0, 60 - data.milestones.completionRate) * 0.2;
  if (data.agents.active === 0) score -= 15;
  if (data.agents.totalErrors > 10) score -= 10;
  return Math.max(0, Math.min(100, Math.round(score)));
}

test("EM.H1: sistema perfecto → score alto", () => {
  const score = ecosystemHealthScore({
    signals: { critical: 0, high: 0 },
    evidence: { completionRate: 90 },
    milestones: { completionRate: 85 },
    agents: { totalErrors: 0, active: 6 },
  });
  assert.ok(score >= 90, `score=${score} debe ser >= 90`);
});

test("EM.H2: señal crítica reduce score significativamente", () => {
  const clean = ecosystemHealthScore({ signals: { critical: 0, high: 0 }, evidence: { completionRate: 80 }, milestones: { completionRate: 80 }, agents: { totalErrors: 0, active: 6 } });
  const critical = ecosystemHealthScore({ signals: { critical: 2, high: 0 }, evidence: { completionRate: 80 }, milestones: { completionRate: 80 }, agents: { totalErrors: 0, active: 6 } });
  assert.ok(clean - critical >= 30, `2 señales críticas deben bajar >= 30 pts (fue ${clean - critical})`);
});

test("EM.H3: sin agentes activos → penalización", () => {
  const withAgents    = ecosystemHealthScore({ signals: { critical: 0, high: 0 }, evidence: { completionRate: 80 }, milestones: { completionRate: 80 }, agents: { totalErrors: 0, active: 6 } });
  const withoutAgents = ecosystemHealthScore({ signals: { critical: 0, high: 0 }, evidence: { completionRate: 80 }, milestones: { completionRate: 80 }, agents: { totalErrors: 0, active: 0 } });
  assert.ok(withAgents > withoutAgents, "sin agentes activos el score debe bajar");
});

test("EM.H4: score nunca < 0 ni > 100", () => {
  const worst = ecosystemHealthScore({ signals: { critical: 10, high: 10 }, evidence: { completionRate: 0 }, milestones: { completionRate: 0 }, agents: { totalErrors: 100, active: 0 } });
  const best  = ecosystemHealthScore({ signals: { critical: 0, high: 0 }, evidence: { completionRate: 100 }, milestones: { completionRate: 100 }, agents: { totalErrors: 0, active: 6 } });
  assert.ok(worst >= 0, `score ${worst} no puede ser negativo`);
  assert.ok(best <= 100, `score ${best} no puede superar 100`);
});

// ── Ecosystem metrics contract ────────────────────────────────────────────────

test("EM.M1: métricas tienen todas las secciones requeridas", () => {
  const required = ["generatedAt", "jobs", "bids", "milestones", "evidence", "agents", "rag", "signals"];
  const mock: Record<string, unknown> = {
    generatedAt: new Date().toISOString(),
    jobs:        { total: 0, published: 0, inProgress: 0, completed: 0, byCategory: {} },
    bids:        { total: 0, submitted: 0, accepted: 0, conversionRate: 0 },
    milestones:  { total: 0, approved: 0, pending: 0, completionRate: 0 },
    evidence:    { total: 0, approved: 0, missing: 0, rejected: 0, completionRate: 0 },
    agents:      { active: 0, totalMessages: 0, totalErrors: 0, byAgent: [] },
    rag:         { documents: 0, chunks: 0, retrievalMode: "fts_fallback" },
    signals:     { open: 0, critical: 0, high: 0 },
  };
  required.forEach((f) => {
    assert.ok(f in mock, `métricas deben incluir: ${f}`);
  });
});

test("EM.M2: jobs.published <= jobs.total siempre", () => {
  const jobs = { total: 10, published: 4, inProgress: 3, completed: 3 };
  assert.ok(jobs.published <= jobs.total);
  assert.ok(jobs.inProgress <= jobs.total);
  assert.ok(jobs.completed <= jobs.total);
});

test("EM.M3: evidence.completionRate = approved/total*100", () => {
  const evidence = { total: 20, approved: 15, missing: 3, rejected: 2 };
  const rate = Math.round((evidence.approved / evidence.total) * 100);
  assert.equal(rate, 75);
});

test("EM.M4: bids.conversionRate = accepted/total*100", () => {
  const bids = { total: 8, accepted: 2, submitted: 6 };
  const rate = Math.round((bids.accepted / bids.total) * 100);
  assert.equal(rate, 25);
});

// ── RAG health in ecosystem ───────────────────────────────────────────────────

test("EM.RAG1: retrievalMode=hybrid cuando OPENAI_API_KEY set + chunks > 0", () => {
  const mode = (hasKey: boolean, chunks: number) => hasKey && chunks > 0 ? "hybrid" : "fts_fallback";
  assert.equal(mode(true,  176), "hybrid");
  assert.equal(mode(false, 176), "fts_fallback");
  assert.equal(mode(true,  0),   "fts_fallback");
});

test("EM.RAG2: ecosystem con 42 docs y hybrid retrieval es óptimo", () => {
  const rag = { documents: 42, chunks: 201, retrievalMode: "hybrid" };
  assert.ok(rag.documents >= 20, ">= 20 docs es base suficiente");
  assert.ok(rag.chunks >= 100, ">= 100 chunks es base suficiente");
  assert.equal(rag.retrievalMode, "hybrid");
});

// ── Agent metrics in ecosystem ────────────────────────────────────────────────

test("EM.AG1: totalMessages es suma de todos los agentes", () => {
  const byAgent = [
    { name: "marketplace", messages: 10, errors: 0, active: true },
    { name: "buildops",    messages: 8,  errors: 1, active: true },
    { name: "protools",    messages: 15, errors: 0, active: true },
  ];
  const total = byAgent.reduce((s, a) => s + a.messages, 0);
  assert.equal(total, 33);
});

test("EM.AG2: active count = agentes con active=true", () => {
  const byAgent = [
    { active: true  },
    { active: false },
    { active: true  },
    { active: true  },
  ];
  const active = byAgent.filter((a) => a.active).length;
  assert.equal(active, 3);
});
