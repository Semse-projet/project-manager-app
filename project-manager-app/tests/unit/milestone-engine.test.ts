/**
 * Unit tests for the tools milestone engine — pure functions, no I/O.
 * Run: node --experimental-strip-types --test tests/unit/milestone-engine.test.ts
 */
import test from "node:test";
import assert from "node:assert/strict";

// ── Inline milestone engine ────────────────────────────────────────────────────

type RiskLevel = "low" | "medium" | "high" | "critical";
type Milestone = { sequence: number; title: string; description: string; percentage: number; amount: number; evidenceRequired: string[]; releaseTrigger: string };

const MILESTONE_SPLITS: Record<RiskLevel, number[]> = {
  low:      [30, 70],
  medium:   [25, 50, 25],
  high:     [20, 30, 30, 20],
  critical: [15, 25, 30, 20, 10],
};

const DEFAULT_TRIGGERS = ["Inicio documentado con fotos","Avance aprobado por cliente","Inspección completada","Entrega final aprobada","Garantía activada"];

function buildMilestones(totalAmount: number, riskLevel: RiskLevel, tradePhases: string[], evidencePerPhase: string[][]): Milestone[] {
  const splits = MILESTONE_SPLITS[riskLevel];
  const phases = tradePhases.length >= splits.length ? tradePhases.slice(0, splits.length) : [...tradePhases, ...DEFAULT_TRIGGERS.slice(tradePhases.length, splits.length)];
  return splits.map((pct, i) => ({
    sequence: i + 1, title: phases[i] ?? `Fase ${i + 1}`,
    description: `${pct}% del total — ${phases[i] ?? `Etapa ${i + 1}`}`,
    percentage: pct, amount: Math.round(totalAmount * pct / 100 * 100) / 100,
    evidenceRequired: evidencePerPhase[i] ?? ["Foto de avance", "Aprobación del cliente"],
    releaseTrigger: `Cliente aprueba evidencia de fase ${i + 1}`,
  }));
}

// ── Tests ──────────────────────────────────────────────────────────────────────

test("low risk → 2 milestones [30%, 70%]", () => {
  const ms = buildMilestones(1000, "low", [], []);
  assert.equal(ms.length, 2);
  assert.equal(ms[0].percentage, 30);
  assert.equal(ms[1].percentage, 70);
});

test("medium risk → 3 milestones [25%, 50%, 25%]", () => {
  const ms = buildMilestones(1000, "medium", [], []);
  assert.equal(ms.length, 3);
  assert.deepEqual(ms.map(m => m.percentage), [25, 50, 25]);
});

test("high risk → 4 milestones [20%, 30%, 30%, 20%]", () => {
  const ms = buildMilestones(1000, "high", [], []);
  assert.equal(ms.length, 4);
  assert.deepEqual(ms.map(m => m.percentage), [20, 30, 30, 20]);
});

test("critical risk → 5 milestones [15%, 25%, 30%, 20%, 10%]", () => {
  const ms = buildMilestones(1000, "critical", [], []);
  assert.equal(ms.length, 5);
  assert.deepEqual(ms.map(m => m.percentage), [15, 25, 30, 20, 10]);
});

test("percentages sum to 100 for all risk levels", () => {
  for (const level of ["low", "medium", "high", "critical"] as RiskLevel[]) {
    const ms = buildMilestones(1000, level, [], []);
    const total = ms.reduce((s, m) => s + m.percentage, 0);
    assert.equal(total, 100, `${level}: percentages should sum to 100, got ${total}`);
  }
});

test("amounts sum to total", () => {
  const total = 2500;
  const ms = buildMilestones(total, "medium", [], []);
  const sum = ms.reduce((s, m) => s + m.amount, 0);
  assert.equal(sum, total, `amounts ${sum} should equal total ${total}`);
});

test("sequences are 1-indexed and consecutive", () => {
  const ms = buildMilestones(1000, "high", [], []);
  ms.forEach((m, i) => assert.equal(m.sequence, i + 1));
});

test("trade phases are used as milestone titles", () => {
  const phases = ["Site prep", "Framing", "Finish", "Closeout"];
  const ms = buildMilestones(1000, "high", phases, []);
  assert.equal(ms[0].title, "Site prep");
  assert.equal(ms[3].title, "Closeout");
});

test("short trade phases padded with default triggers", () => {
  const ms = buildMilestones(1000, "high", ["Site prep"], []);
  assert.equal(ms[0].title, "Site prep");
  assert.ok(ms[1].title.length > 0, "Second milestone should have fallback title");
});

test("evidence per phase is used when provided", () => {
  const evidence = [["Before photo"], ["Progress photo", "Inspection cert"]];
  const ms = buildMilestones(1000, "low", [], evidence);
  assert.deepEqual(ms[0].evidenceRequired, ["Before photo"]);
  assert.deepEqual(ms[1].evidenceRequired, ["Progress photo", "Inspection cert"]);
});

test("missing evidence falls back to default", () => {
  const ms = buildMilestones(1000, "low", [], []);
  assert.deepEqual(ms[0].evidenceRequired, ["Foto de avance", "Aprobación del cliente"]);
});

test("releaseTrigger references the correct phase number", () => {
  const ms = buildMilestones(1000, "medium", [], []);
  assert.ok(ms[0].releaseTrigger.includes("1"));
  assert.ok(ms[2].releaseTrigger.includes("3"));
});

test("$0 total → all amounts 0", () => {
  const ms = buildMilestones(0, "low", [], []);
  assert.ok(ms.every(m => m.amount === 0));
});
