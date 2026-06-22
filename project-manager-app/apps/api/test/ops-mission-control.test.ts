import test from "node:test";
import assert from "node:assert/strict";

/**
 * Mission Control Summary — pure logic tests.
 * Exercises the priority-ordered nextAction directive and the
 * vision summary aggregation logic without touching I/O.
 */

// ── nextAction priority logic (mirrors ops.service.ts) ──────────────────────

type MCInput = {
  openSignals: number;
  criticalSignals: number;
  blockedPayments: number;
  activeDisputes: number;
  pendingMilestones: number;
  pendingEvidence: number;
  openChangeOrders: number;
};

function resolveNextAction(input: MCInput): string {
  const { activeDisputes, criticalSignals, blockedPayments, pendingMilestones, openChangeOrders, pendingEvidence } = input;
  if (activeDisputes > 0)    return `Resolve ${activeDisputes} active dispute(s) to unblock payments`;
  if (criticalSignals > 0)   return `Review ${criticalSignals} critical signal(s) in Mission Control`;
  if (blockedPayments > 0)   return `Release payment for ${blockedPayments} approved milestone(s)`;
  if (pendingMilestones > 0) return `Review ${pendingMilestones} milestone(s) pending approval`;
  if (openChangeOrders > 0)  return `Process ${openChangeOrders} open change order(s)`;
  if (pendingEvidence > 0)   return `Review ${pendingEvidence} pending evidence item(s)`;
  return "System healthy — no urgent actions required";
}

test("MC.1: disputes take highest priority over all other signals", () => {
  const action = resolveNextAction({
    openSignals: 10, criticalSignals: 5, blockedPayments: 3,
    activeDisputes: 2, pendingMilestones: 4, pendingEvidence: 6, openChangeOrders: 1,
  });
  assert.ok(action.startsWith("Resolve 2 active dispute(s)"), `Got: ${action}`);
});

test("MC.2: critical signals are P2 when no disputes", () => {
  const action = resolveNextAction({
    openSignals: 5, criticalSignals: 3, blockedPayments: 2,
    activeDisputes: 0, pendingMilestones: 1, pendingEvidence: 2, openChangeOrders: 0,
  });
  assert.ok(action.startsWith("Review 3 critical signal(s)"), `Got: ${action}`);
});

test("MC.3: blocked payments are P3 when no disputes or critical signals", () => {
  const action = resolveNextAction({
    openSignals: 2, criticalSignals: 0, blockedPayments: 4,
    activeDisputes: 0, pendingMilestones: 2, pendingEvidence: 0, openChangeOrders: 1,
  });
  assert.ok(action.startsWith("Release payment for 4 approved milestone(s)"), `Got: ${action}`);
});

test("MC.4: pending milestones are P4", () => {
  const action = resolveNextAction({
    openSignals: 1, criticalSignals: 0, blockedPayments: 0,
    activeDisputes: 0, pendingMilestones: 7, pendingEvidence: 3, openChangeOrders: 2,
  });
  assert.ok(action.startsWith("Review 7 milestone(s) pending"), `Got: ${action}`);
});

test("MC.5: change orders are P5", () => {
  const action = resolveNextAction({
    openSignals: 0, criticalSignals: 0, blockedPayments: 0,
    activeDisputes: 0, pendingMilestones: 0, pendingEvidence: 5, openChangeOrders: 3,
  });
  assert.ok(action.startsWith("Process 3 open change order(s)"), `Got: ${action}`);
});

test("MC.6: pending evidence is P6", () => {
  const action = resolveNextAction({
    openSignals: 0, criticalSignals: 0, blockedPayments: 0,
    activeDisputes: 0, pendingMilestones: 0, pendingEvidence: 8, openChangeOrders: 0,
  });
  assert.ok(action.startsWith("Review 8 pending evidence item(s)"), `Got: ${action}`);
});

test("MC.7: healthy system when all counts are zero", () => {
  const action = resolveNextAction({
    openSignals: 0, criticalSignals: 0, blockedPayments: 0,
    activeDisputes: 0, pendingMilestones: 0, pendingEvidence: 0, openChangeOrders: 0,
  });
  assert.equal(action, "System healthy — no urgent actions required");
});

// ── Vision summary aggregation logic ────────────────────────────────────────

type VisionAnalysisRow = {
  qualityScore: number | null;
  blurScore: number | null;
  brightnessScore: number | null;
  riskLevel: string;
  requiresHumanReview: boolean;
  canAutoApprove: boolean;
};

function computeVisionSummary(rows: VisionAnalysisRow[]) {
  const n = rows.length;
  if (n === 0) {
    return { totalAnalyzed: 0, avgQualityScore: null, avgBlurScore: null, avgBrightnessScore: null,
      riskLevelCounts: {}, requiresHumanReviewCount: 0, canAutoApproveCount: 0,
      overallVisionReady: false, blockers: [] };
  }

  const avg = (vals: (number | null)[]): number | null => {
    const nums = vals.filter((v): v is number => v !== null);
    return nums.length ? nums.reduce((a, b) => a + b, 0) / nums.length : null;
  };

  const riskLevelCounts: Record<string, number> = {};
  for (const r of rows) riskLevelCounts[r.riskLevel] = (riskLevelCounts[r.riskLevel] ?? 0) + 1;

  const requiresHumanReviewCount = rows.filter((r) => r.requiresHumanReview).length;
  const canAutoApproveCount = rows.filter((r) => r.canAutoApprove).length;
  const avgQualityScore = avg(rows.map((r) => r.qualityScore));
  const avgBlurScore = avg(rows.map((r) => r.blurScore));
  const avgBrightnessScore = avg(rows.map((r) => r.brightnessScore));

  const criticalHighCount = (riskLevelCounts["critical"] ?? 0) + (riskLevelCounts["high"] ?? 0);
  const blockers: string[] = [];
  if (criticalHighCount > 0) blockers.push(`${criticalHighCount} image(s) with critical/high risk level`);
  if (avgQualityScore !== null && avgQualityScore < 0.5) blockers.push("Average quality score below threshold (0.5)");
  if (requiresHumanReviewCount > 0) blockers.push(`${requiresHumanReviewCount} image(s) require human review`);

  return {
    totalAnalyzed: n,
    avgQualityScore,
    avgBlurScore,
    avgBrightnessScore,
    riskLevelCounts,
    requiresHumanReviewCount,
    canAutoApproveCount,
    overallVisionReady: blockers.length === 0,
    blockers,
  };
}

test("VS.1: empty set → totalAnalyzed=0, overallVisionReady=false", () => {
  const s = computeVisionSummary([]);
  assert.equal(s.totalAnalyzed, 0);
  assert.equal(s.overallVisionReady, false);
  assert.equal(s.avgQualityScore, null);
});

test("VS.2: all low-risk clean images → overallVisionReady=true, no blockers", () => {
  const rows: VisionAnalysisRow[] = [
    { qualityScore: 0.9, blurScore: 0.05, brightnessScore: 0.8, riskLevel: "low", requiresHumanReview: false, canAutoApprove: true },
    { qualityScore: 0.85, blurScore: 0.1, brightnessScore: 0.75, riskLevel: "low", requiresHumanReview: false, canAutoApprove: true },
  ];
  const s = computeVisionSummary(rows);
  assert.equal(s.totalAnalyzed, 2);
  assert.equal(s.overallVisionReady, true);
  assert.equal(s.blockers.length, 0);
  assert.equal(s.canAutoApproveCount, 2);
  assert.ok(s.avgQualityScore !== null && s.avgQualityScore > 0.8);
});

test("VS.3: critical risk image → adds blocker, overallVisionReady=false", () => {
  const rows: VisionAnalysisRow[] = [
    { qualityScore: 0.9, blurScore: 0.05, brightnessScore: 0.8, riskLevel: "low",      requiresHumanReview: false, canAutoApprove: true },
    { qualityScore: 0.7, blurScore: 0.2,  brightnessScore: 0.6, riskLevel: "critical", requiresHumanReview: true,  canAutoApprove: false },
  ];
  const s = computeVisionSummary(rows);
  assert.equal(s.overallVisionReady, false);
  assert.ok(s.blockers.some((b) => b.includes("critical/high")));
  assert.ok(s.blockers.some((b) => b.includes("human review")));
  assert.equal(s.requiresHumanReviewCount, 1);
});

test("VS.4: low average quality → adds threshold blocker", () => {
  const rows: VisionAnalysisRow[] = [
    { qualityScore: 0.3, blurScore: 0.7, brightnessScore: 0.2, riskLevel: "medium", requiresHumanReview: false, canAutoApprove: false },
    { qualityScore: 0.4, blurScore: 0.6, brightnessScore: 0.3, riskLevel: "medium", requiresHumanReview: false, canAutoApprove: false },
  ];
  const s = computeVisionSummary(rows);
  assert.equal(s.overallVisionReady, false);
  assert.ok(s.blockers.some((b) => b.includes("below threshold")));
  assert.ok(s.avgQualityScore !== null && s.avgQualityScore < 0.5);
});

test("VS.5: riskLevelCounts groups correctly", () => {
  const rows: VisionAnalysisRow[] = [
    { qualityScore: 0.9, blurScore: 0.1, brightnessScore: 0.8, riskLevel: "low",    requiresHumanReview: false, canAutoApprove: true },
    { qualityScore: 0.8, blurScore: 0.2, brightnessScore: 0.7, riskLevel: "medium", requiresHumanReview: false, canAutoApprove: false },
    { qualityScore: 0.75, blurScore: 0.15, brightnessScore: 0.75, riskLevel: "low",  requiresHumanReview: false, canAutoApprove: true },
  ];
  const s = computeVisionSummary(rows);
  assert.equal(s.riskLevelCounts["low"], 2);
  assert.equal(s.riskLevelCounts["medium"], 1);
  assert.equal(s.riskLevelCounts["high"], undefined);
});
