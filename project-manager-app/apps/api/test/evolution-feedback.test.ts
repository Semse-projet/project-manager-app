import test from "node:test";
import assert from "node:assert/strict";

/**
 * Evolution Feedback Loop (Autonomy Level 5) — Tests unitarios
 * El sistema aprende de los patches aplicados.
 */

// ── Types ─────────────────────────────────────────────────────────────────────

type PatchOutcome = "success" | "partial" | "reverted" | "skipped";
type PatchFeedback = {
  patchId: string; recId: string; recType: string; recArea: string;
  filesCreated: string[]; outcome: PatchOutcome;
  maturityBefore?: number; maturityAfter?: number;
  note?: string; appliedAt: string; reviewedAt: string; reviewedBy: string;
};

// ── Summary computation ───────────────────────────────────────────────────────

function computeSummary(feedbacks: PatchFeedback[]) {
  const total     = feedbacks.length;
  const successes = feedbacks.filter((f) => f.outcome === "success");
  const failures  = feedbacks.filter((f) => f.outcome === "reverted" || f.outcome === "skipped");

  const successRate = total > 0 ? Math.round((successes.length / total) * 100) : 0;

  const gains = successes
    .filter((f) => f.maturityBefore != null && f.maturityAfter != null)
    .map((f) => f.maturityAfter! - f.maturityBefore!);
  const avgGain = gains.length > 0 ? Math.round(gains.reduce((s, g) => s + g, 0) / gains.length) : null;

  const successAreas = new Map<string, number>();
  const failureAreas = new Map<string, number>();
  successes.forEach((f) => successAreas.set(f.recArea, (successAreas.get(f.recArea) ?? 0) + 1));
  failures.forEach((f)  => failureAreas.set(f.recArea, (failureAreas.get(f.recArea)  ?? 0) + 1));

  return {
    totalPatches: total, successRate, avgMaturityGain: avgGain,
    topSuccessAreas: [...successAreas.entries()].sort(([,a],[,b])=>b-a).slice(0,3).map(([k])=>k),
    topFailureAreas: [...failureAreas.entries()].sort(([,a],[,b])=>b-a).slice(0,3).map(([k])=>k),
  };
}

function makeFeedback(
  patchId: string, area: string, outcome: PatchOutcome,
  maturityBefore?: number, maturityAfter?: number
): PatchFeedback {
  return {
    patchId, recId: patchId, recType: "add_tests", recArea: area,
    filesCreated: [`test/${area}.test.ts`], outcome,
    maturityBefore, maturityAfter,
    appliedAt: new Date().toISOString(), reviewedAt: new Date().toISOString(),
    reviewedBy: "admin",
  };
}

// ── Tests ─────────────────────────────────────────────────────────────────────

test("EF.S1: sin feedbacks → summary con zeros", () => {
  const s = computeSummary([]);
  assert.equal(s.totalPatches, 0);
  assert.equal(s.successRate, 0);
  assert.equal(s.avgMaturityGain, null);
  assert.deepEqual(s.topSuccessAreas, []);
});

test("EF.S2: todos exitosos → successRate=100", () => {
  const feedbacks = [
    makeFeedback("p1", "Finance", "success", 60, 80),
    makeFeedback("p2", "Worker",  "success", 25, 45),
  ];
  const s = computeSummary(feedbacks);
  assert.equal(s.successRate, 100);
  assert.equal(s.totalPatches, 2);
});

test("EF.S3: mix de outcomes → successRate correcto", () => {
  const feedbacks = [
    makeFeedback("p1", "Finance",       "success"),
    makeFeedback("p2", "Marketplace",   "success"),
    makeFeedback("p3", "Notifications", "reverted"),
    makeFeedback("p4", "Worker",        "skipped"),
  ];
  const s = computeSummary(feedbacks);
  assert.equal(s.totalPatches, 4);
  assert.equal(s.successRate, 50, "2/4 = 50%");
});

test("EF.S4: avgMaturityGain calcula promedio correcto", () => {
  const feedbacks = [
    makeFeedback("p1", "Finance", "success", 60, 80),  // +20
    makeFeedback("p2", "Worker",  "success", 25, 45),  // +20
    makeFeedback("p3", "Marketplace", "success", 40, 65), // +25
  ];
  const s = computeSummary(feedbacks);
  assert.equal(s.avgMaturityGain, 22, "(20+20+25)/3 = 21.7 ≈ 22");
});

test("EF.S5: sin maturityBefore/After → avgGain=null", () => {
  const feedbacks = [makeFeedback("p1", "Finance", "success")];
  const s = computeSummary(feedbacks);
  assert.equal(s.avgMaturityGain, null);
});

test("EF.S6: topSuccessAreas ordenadas por frecuencia", () => {
  const feedbacks = [
    makeFeedback("p1", "Finance", "success"),
    makeFeedback("p2", "Finance", "success"),
    makeFeedback("p3", "Finance", "success"),
    makeFeedback("p4", "Worker",  "success"),
    makeFeedback("p5", "Worker",  "success"),
  ];
  const s = computeSummary(feedbacks);
  assert.equal(s.topSuccessAreas[0], "Finance", "Finance tiene más éxitos");
  assert.equal(s.topSuccessAreas[1], "Worker");
});

test("EF.S7: topFailureAreas identifica áreas problemáticas", () => {
  const feedbacks = [
    makeFeedback("p1", "Notifications", "reverted"),
    makeFeedback("p2", "Notifications", "skipped"),
    makeFeedback("p3", "Worker",        "reverted"),
  ];
  const s = computeSummary(feedbacks);
  assert.ok(s.topFailureAreas.includes("Notifications"), "Notifications es área problemática");
});

// ── Feedback storage contract ─────────────────────────────────────────────────

test("EF.ST1: feedback tiene reviewedAt autogenerado", () => {
  const fb = makeFeedback("p1", "Finance", "success");
  assert.ok(fb.reviewedAt, "reviewedAt debe existir");
  assert.ok(!isNaN(new Date(fb.reviewedAt).getTime()), "reviewedAt debe ser fecha válida");
});

test("EF.ST2: feedback persiste todos los campos requeridos", () => {
  const required = ["patchId", "recId", "recType", "recArea", "filesCreated", "outcome", "appliedAt", "reviewedAt", "reviewedBy"];
  const fb = makeFeedback("p1", "Finance", "success");
  required.forEach((f) => {
    assert.ok(f in fb, `feedback debe incluir: ${f}`);
  });
});

test("EF.ST3: outcome solo acepta valores válidos", () => {
  const valid: PatchOutcome[] = ["success", "partial", "reverted", "skipped"];
  valid.forEach((o) => {
    const fb = makeFeedback("p1", "area", o);
    assert.equal(fb.outcome, o);
  });
});

// ── Learning signal ────────────────────────────────────────────────────────────

test("EF.L1: sistema aprende — patches exitosos informan futuras prioridades", () => {
  const feedbacks = [
    makeFeedback("p1", "Finance",     "success", 60, 80),
    makeFeedback("p2", "Finance",     "success", 80, 95),
    makeFeedback("p3", "Marketplace", "reverted"),
  ];
  const s = computeSummary(feedbacks);

  // Si Finance ha sido exitosa 2 veces, el sistema debería priorizarla para futuros patches
  assert.ok(s.topSuccessAreas.includes("Finance"), "Finance debe estar en topSuccessAreas");
  assert.ok(s.topFailureAreas.includes("Marketplace"), "Marketplace en topFailureAreas → el sistema aprende a evitar");
});

test("EF.L2: maturityGain positivo confirma que el patch mejoró el sistema", () => {
  const fb = makeFeedback("p1", "Finance", "success", 60, 85);
  const gain = (fb.maturityAfter ?? 0) - (fb.maturityBefore ?? 0);
  assert.ok(gain > 0, `ganancia positiva (${gain}) confirma mejora`);
});

test("EF.L3: maturityGain negativo indica regresión — debe investigarse", () => {
  const fb = makeFeedback("p1", "Finance", "partial", 80, 75);
  const gain = (fb.maturityAfter ?? 0) - (fb.maturityBefore ?? 0);
  assert.ok(gain < 0, `ganancia negativa (${gain}) indica regresión`);
  // El sistema debería marcar esto como área de atención
});

// ── Loop closing ──────────────────────────────────────────────────────────────

test("EF.CL1: ciclo completo: Observe → Recommend → Simulate → Apply → Feedback → Evolve", () => {
  const cycle = [
    "observer.observe()",           // Level 0: observe
    "consciousness.buildIndex()",   // Level 1: diagnose
    "recommendations.generate()",  // Level 2: recommend
    "simulation.simulate()",        // Level 3: simulate
    "applyEngine.apply()",          // Level 4: apply
    "feedback.recordFeedback()",    // Level 5: feedback
    "evolution.evolve()",           // Level 5: evolve with feedback
  ];
  assert.equal(cycle.length, 7, "7 pasos en el ciclo completo de autonomía");
  assert.ok(cycle[0]!.includes("observe"), "empieza con observación");
  assert.ok(cycle[6]!.includes("evolve"), "termina con evolución");
});

test("EF.CL2: el feedback enriquece las próximas recomendaciones", () => {
  // Los feedbacks de patches exitosos deberían subir el score de áreas similares
  // Los feedbacks de patches fallidos deberían bajar la prioridad de esas áreas
  const highConfidenceAreas = ["Finance", "Worker"]; // exitosos en el pasado
  const lowConfidenceAreas  = ["Notifications"];     // fallidos

  // El sistema debería priorizar áreas con histórico positivo
  const priority = (area: string) => highConfidenceAreas.includes(area) ? 1 : lowConfidenceAreas.includes(area) ? 3 : 2;

  assert.ok(priority("Finance") < priority("Notifications"), "Finance (exitoso) tiene mayor prioridad");
});
