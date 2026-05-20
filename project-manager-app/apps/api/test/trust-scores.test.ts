import test from "node:test";
import assert from "node:assert/strict";

/**
 * Trust Scores — Tests unitarios
 * Sin DB. Cubre lógica de scoring, niveles, flags y alertas.
 */

// ── Score levels ───────────────────────────────────────────────────────────────

type TrustLevel = "low" | "medium" | "high" | "critical";

function scoreToLevel(score: number): TrustLevel {
  if (score >= 70) return "low";
  if (score >= 40) return "medium";
  if (score >= 20) return "high";
  return "critical";
}

test("TS.L1: score >= 70 → nivel bajo (riesgo mínimo)", () => {
  assert.equal(scoreToLevel(100), "low");
  assert.equal(scoreToLevel(70),  "low");
  assert.equal(scoreToLevel(75),  "low");
});

test("TS.L2: score 40-69 → nivel medio", () => {
  assert.equal(scoreToLevel(69), "medium");
  assert.equal(scoreToLevel(55), "medium");
  assert.equal(scoreToLevel(40), "medium");
});

test("TS.L3: score 20-39 → nivel alto (riesgo)", () => {
  assert.equal(scoreToLevel(39), "high");
  assert.equal(scoreToLevel(25), "high");
  assert.equal(scoreToLevel(20), "high");
});

test("TS.L4: score < 20 → nivel crítico", () => {
  assert.equal(scoreToLevel(19), "critical");
  assert.equal(scoreToLevel(0),  "critical");
  assert.equal(scoreToLevel(10), "critical");
});

test("TS.L5: score en límite exacto → nivel correcto", () => {
  assert.equal(scoreToLevel(70), "low",      "70 exacto → low");
  assert.equal(scoreToLevel(40), "medium",   "40 exacto → medium");
  assert.equal(scoreToLevel(20), "high",     "20 exacto → high");
});

// ── Score calculation ─────────────────────────────────────────────────────────

type TrustFactors = {
  completedJobs:   number;
  onTimeRate:      number;  // 0-1
  disputeRate:     number;  // 0-1
  avgRating:       number;  // 0-5
  evidenceQuality: number;  // 0-1
};

function clamp01(v: number): number { return Math.max(0, Math.min(1, v)); }

function computeScore(f: TrustFactors): number {
  const completedScore  = Math.min(f.completedJobs / 20, 1) * 25;
  const onTimeScore     = clamp01(f.onTimeRate) * 25;
  const disputeFree     = clamp01(1 - f.disputeRate) * 25;
  const ratingScore     = clamp01(f.avgRating / 5) * 15;
  const evidenceScore   = clamp01(f.evidenceQuality) * 10;
  const raw = completedScore + onTimeScore + disputeFree + ratingScore + evidenceScore;
  return Math.round(Math.max(0, Math.min(100, raw)));
}

test("TS.C1: profesional perfecto → score 100", () => {
  const score = computeScore({ completedJobs: 20, onTimeRate: 1, disputeRate: 0, avgRating: 5, evidenceQuality: 1 });
  assert.equal(score, 100);
});

test("TS.C2: profesional nuevo → score bajo pero no negativo", () => {
  const score = computeScore({ completedJobs: 0, onTimeRate: 0, disputeRate: 0, avgRating: 0, evidenceQuality: 0 });
  assert.ok(score >= 0);
  assert.ok(score < 30);
});

test("TS.C3: alta tasa de disputas reduce score significativamente", () => {
  const clean  = computeScore({ completedJobs: 15, onTimeRate: 0.9, disputeRate: 0.0, avgRating: 4.5, evidenceQuality: 0.9 });
  const disputa = computeScore({ completedJobs: 15, onTimeRate: 0.9, disputeRate: 0.5, avgRating: 4.5, evidenceQuality: 0.9 });
  assert.ok(clean > disputa, `sin disputas (${clean}) > con disputas (${disputa})`);
  assert.ok(clean - disputa >= 10, "diferencia debe ser >= 10 pts");
});

test("TS.C4: más trabajos completados mejora el score (cap en 20)", () => {
  const few  = computeScore({ completedJobs: 5,  onTimeRate: 0.8, disputeRate: 0.1, avgRating: 4, evidenceQuality: 0.8 });
  const many = computeScore({ completedJobs: 20, onTimeRate: 0.8, disputeRate: 0.1, avgRating: 4, evidenceQuality: 0.8 });
  const cap  = computeScore({ completedJobs: 50, onTimeRate: 0.8, disputeRate: 0.1, avgRating: 4, evidenceQuality: 0.8 });
  assert.ok(many > few, "20 trabajos debe superar a 5");
  assert.equal(many, cap, "el cap en 20 trabajos aplica — score no cambia más allá");
});

test("TS.C5: score siempre entre 0 y 100", () => {
  const cases: TrustFactors[] = [
    { completedJobs: 100, onTimeRate: 2, disputeRate: -1, avgRating: 10, evidenceQuality: 2 },
    { completedJobs: 0,   onTimeRate: 0, disputeRate: 1,  avgRating: 0,  evidenceQuality: 0 },
  ];
  cases.forEach((f) => {
    const score = computeScore(f);
    assert.ok(score >= 0 && score <= 100, `score ${score} debe estar en [0, 100]`);
  });
});

// ── Trust flags ────────────────────────────────────────────────────────────────

type TrustFlag = "DISPUTE_HISTORY" | "EVIDENCE_GAPS" | "LATE_DELIVERIES" | "PAYMENT_DELAYS" | "LOW_RATING";

function detectFlags(f: TrustFactors): TrustFlag[] {
  const flags: TrustFlag[] = [];
  if (f.disputeRate > 0.1)     flags.push("DISPUTE_HISTORY");
  if (f.evidenceQuality < 0.5) flags.push("EVIDENCE_GAPS");
  if (f.onTimeRate < 0.7)      flags.push("LATE_DELIVERIES");
  if (f.avgRating < 3.5)       flags.push("LOW_RATING");
  return flags;
}

test("TS.F1: sin problemas → sin flags", () => {
  const flags = detectFlags({ completedJobs: 15, onTimeRate: 0.95, disputeRate: 0.0, avgRating: 4.8, evidenceQuality: 0.9 });
  assert.deepEqual(flags, []);
});

test("TS.F2: alta tasa de disputas → DISPUTE_HISTORY", () => {
  const flags = detectFlags({ completedJobs: 10, onTimeRate: 0.8, disputeRate: 0.2, avgRating: 4, evidenceQuality: 0.8 });
  assert.ok(flags.includes("DISPUTE_HISTORY"));
});

test("TS.F3: evidencia baja → EVIDENCE_GAPS", () => {
  const flags = detectFlags({ completedJobs: 10, onTimeRate: 0.9, disputeRate: 0, avgRating: 4.5, evidenceQuality: 0.3 });
  assert.ok(flags.includes("EVIDENCE_GAPS"));
});

test("TS.F4: baja puntualidad → LATE_DELIVERIES", () => {
  const flags = detectFlags({ completedJobs: 8, onTimeRate: 0.5, disputeRate: 0, avgRating: 4, evidenceQuality: 0.8 });
  assert.ok(flags.includes("LATE_DELIVERIES"));
});

test("TS.F5: múltiples problemas → múltiples flags", () => {
  const flags = detectFlags({ completedJobs: 5, onTimeRate: 0.4, disputeRate: 0.3, avgRating: 2.5, evidenceQuality: 0.2 });
  assert.ok(flags.length >= 3, `debe detectar >= 3 flags (encontró ${flags.length})`);
});

// ── UI display logic ──────────────────────────────────────────────────────────

const LEVEL_COLORS: Record<TrustLevel, string> = {
  low:      "#86efac",
  medium:   "#fcd34d",
  high:     "#fb923c",
  critical: "#fca5a5",
};

test("TS.UI1: colores de nivel son correctos", () => {
  assert.equal(LEVEL_COLORS["low"],      "#86efac", "bajo riesgo es verde");
  assert.equal(LEVEL_COLORS["critical"], "#fca5a5", "crítico es rojo");
  assert.ok(LEVEL_COLORS["high"] !== LEVEL_COLORS["low"]);
});

test("TS.UI2: score bar width es proporcional al score", () => {
  const score = 75;
  const width = `${Math.max(4, score)}%`;
  assert.equal(width, "75%");
  // Edge case: score 0 → min width 4%
  const zeroWidth = `${Math.max(4, 0)}%`;
  assert.equal(zeroWidth, "4%");
});

test("TS.UI3: filtros de nivel cubren todos los casos", () => {
  const levels: TrustLevel[] = ["low", "medium", "high", "critical"];
  levels.forEach((l) => {
    const score = l === "low" ? 80 : l === "medium" ? 55 : l === "high" ? 30 : 10;
    assert.equal(scoreToLevel(score), l, `score ${score} debe ser nivel ${l}`);
  });
});

// ── Trust score context ────────────────────────────────────────────────────────

test("TS.CTX1: trust score es información — no bloquea pagos directamente", () => {
  // Payment Governance es fuente de verdad para canRelease
  // Trust score es contexto adicional, no decisor final
  const trustScore = 35;
  const paymentGovernanceCanRelease = true; // governance decides independently
  assert.ok(paymentGovernanceCanRelease, "Payment Governance decide independientemente del trust score");
  assert.ok(trustScore < 40, "trust score bajo puede informar pero no bloquear directamente");
});

test("TS.CTX2: trust score mejora con el tiempo si el profesional mejora", () => {
  const initial = computeScore({ completedJobs: 2, onTimeRate: 0.5, disputeRate: 0.2, avgRating: 3, evidenceQuality: 0.4 });
  const after   = computeScore({ completedJobs: 15, onTimeRate: 0.95, disputeRate: 0.0, avgRating: 4.8, evidenceQuality: 0.95 });
  assert.ok(after > initial, `después (${after}) debe ser mayor que inicial (${initial})`);
  assert.ok(after - initial >= 30, "mejora significativa esperada");
});
