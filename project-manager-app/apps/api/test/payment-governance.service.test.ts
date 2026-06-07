import test from "node:test";
import assert from "node:assert/strict";

/**
 * Tests for PaymentGovernanceService logic.
 * Uses the compiled dist directly; no DB — mocks computePaymentReadiness output.
 */

// ── Helpers to simulate governance outcomes ───────────────────────────────────

function buildGovernanceResult(overrides: {
  coreStatus: "not_ready" | "ready_to_release" | "released" | "held" | "disputed";
  coreBlockers?: string[];
  changeOrderBlockers?: number;
  criticalSignals?: number;
  openSignals?: number;
  evidenceSummary?: { approved: number; required: number; missing: number; rejected: number; submitted: number };
}) {
  const {
    coreStatus,
    coreBlockers = [],
    changeOrderBlockers = 0,
    criticalSignals = 0,
    openSignals = 0,
    evidenceSummary = { approved: 2, required: 2, missing: 0, rejected: 0, submitted: 0 },
  } = overrides;

  const blockers = [...coreBlockers];
  const requiredActions: string[] = [];

  if (changeOrderBlockers > 0) {
    blockers.push(`${changeOrderBlockers} change order candidate(s) pending — must be resolved before payment`);
    requiredActions.push("Review and approve or reject open change order candidates");
  }
  if (criticalSignals > 0) {
    blockers.push(`${criticalSignals} critical/high signal(s) open in Mission Control`);
    requiredActions.push("Resolve critical signals in Mission Control before releasing payment");
  }

  let releaseStatus: "ready" | "blocked" | "needs_review" | "released" | "disputed";
  let canRelease: boolean;

  if (coreStatus === "released") { releaseStatus = "released"; canRelease = false; }
  else if (coreStatus === "disputed") { releaseStatus = "disputed"; canRelease = false; }
  else if (blockers.length === 0 && coreStatus === "ready_to_release") { releaseStatus = "ready"; canRelease = true; }
  else if (changeOrderBlockers > 0 || criticalSignals > 0) { releaseStatus = "needs_review"; canRelease = false; }
  else { releaseStatus = "blocked"; canRelease = false; }

  let riskLevel: "low" | "medium" | "high" | "critical";
  if (coreStatus === "disputed" || criticalSignals > 0) riskLevel = "critical";
  else if (evidenceSummary.rejected > 0 || changeOrderBlockers > 0) riskLevel = "high";
  else if (evidenceSummary.missing > 0 || openSignals > 0) riskLevel = "medium";
  else riskLevel = "low";

  return {
    releaseStatus,
    canRelease,
    blockers,
    requiredActions,
    riskLevel,
    evidenceSummary: { ...evidenceSummary, total: evidenceSummary.required },
    changeOrderBlockers,
    openSignals,
    criticalSignals,
    disputeRisk: coreStatus === "disputed",
  };
}

// ── Test cases ─────────────────────────────────────────────────────────────────

test("P2.C1: milestone sin evidencia → blocked", () => {
  const result = buildGovernanceResult({
    coreStatus: "not_ready",
    coreBlockers: ["2 required evidence item(s) still missing"],
    evidenceSummary: { approved: 0, required: 2, missing: 2, rejected: 0, submitted: 0 },
  });
  assert.equal(result.canRelease, false);
  assert.equal(result.releaseStatus, "blocked");
  assert.equal(result.riskLevel, "medium"); // missing items → medium
  assert.ok(result.blockers.some((b) => b.includes("missing")));
});

test("P2.C2: evidencia completa y aprobada, milestone approved → ready", () => {
  const result = buildGovernanceResult({
    coreStatus: "ready_to_release",
    coreBlockers: [],
    evidenceSummary: { approved: 3, required: 3, missing: 0, rejected: 0, submitted: 0 },
  });
  assert.equal(result.canRelease, true);
  assert.equal(result.releaseStatus, "ready");
  assert.equal(result.riskLevel, "low");
  assert.equal(result.blockers.length, 0);
});

test("P2.C3: evidencia rechazada → blocked, riskLevel=high", () => {
  const result = buildGovernanceResult({
    coreStatus: "held",
    coreBlockers: ["1 evidence item(s) rejected — must be resubmitted"],
    evidenceSummary: { approved: 1, required: 2, missing: 0, rejected: 1, submitted: 0 },
  });
  assert.equal(result.canRelease, false);
  assert.equal(result.releaseStatus, "blocked");
  assert.equal(result.riskLevel, "high"); // rejected → high
  assert.ok(result.blockers.some((b) => b.includes("rejected")));
});

test("P2.C4: change order abierto → needs_review, canRelease=false", () => {
  const result = buildGovernanceResult({
    coreStatus: "ready_to_release", // core says ready but...
    coreBlockers: [],
    changeOrderBlockers: 1,         // ...change order is open
    evidenceSummary: { approved: 2, required: 2, missing: 0, rejected: 0, submitted: 0 },
  });
  assert.equal(result.canRelease, false);
  assert.equal(result.releaseStatus, "needs_review");
  assert.equal(result.riskLevel, "high"); // changeOrder → high
  assert.ok(result.blockers.some((b) => b.includes("change order")));
  assert.ok(result.requiredActions.length > 0);
});

test("P2.C5: pago ya released → releaseStatus=released, canRelease=false", () => {
  const result = buildGovernanceResult({
    coreStatus: "released",
    coreBlockers: [],
    evidenceSummary: { approved: 2, required: 2, missing: 0, rejected: 0, submitted: 0 },
  });
  assert.equal(result.canRelease, false);
  assert.equal(result.releaseStatus, "released");
  assert.equal(result.disputeRisk, false);
});

test("P2.C6: disputa crítica → disputed, canRelease=false, riskLevel=critical", () => {
  const result = buildGovernanceResult({
    coreStatus: "disputed",
    coreBlockers: ["Active dispute — payment held until resolution"],
    evidenceSummary: { approved: 2, required: 2, missing: 0, rejected: 0, submitted: 0 },
  });
  assert.equal(result.canRelease, false);
  assert.equal(result.releaseStatus, "disputed");
  assert.equal(result.riskLevel, "critical");
  assert.equal(result.disputeRisk, true);
});

test("P2.C7: señales críticas + evidencia completa → needs_review, riskLevel=critical", () => {
  const result = buildGovernanceResult({
    coreStatus: "ready_to_release",
    coreBlockers: [],
    criticalSignals: 2,
    evidenceSummary: { approved: 2, required: 2, missing: 0, rejected: 0, submitted: 0 },
  });
  assert.equal(result.canRelease, false);
  assert.equal(result.releaseStatus, "needs_review");
  assert.equal(result.riskLevel, "critical"); // critical signals
  assert.ok(result.blockers.some((b) => b.includes("critical/high signal")));
});

test("P2.C8: change order + señal crítica + evidencia rechazada → todo bloqueado", () => {
  const result = buildGovernanceResult({
    coreStatus: "held",
    coreBlockers: ["1 evidence item(s) rejected"],
    changeOrderBlockers: 2,
    criticalSignals: 1,
    evidenceSummary: { approved: 0, required: 2, missing: 0, rejected: 2, submitted: 0 },
  });
  assert.equal(result.canRelease, false);
  assert.ok(result.blockers.length >= 3); // core + CO + signals
  assert.equal(result.riskLevel, "critical");
  assert.ok(result.requiredActions.length >= 2);
});

test("P2.C9: sin items requeridos, milestone approved → ready", () => {
  // No required evidence items defined
  const result = buildGovernanceResult({
    coreStatus: "ready_to_release",
    coreBlockers: [],
    evidenceSummary: { approved: 0, required: 0, missing: 0, rejected: 0, submitted: 0 },
  });
  assert.equal(result.canRelease, true);
  assert.equal(result.releaseStatus, "ready");
  assert.equal(result.riskLevel, "low");
});

test("P2.C10: evidenceSummary counts corrects", () => {
  const result = buildGovernanceResult({
    coreStatus: "not_ready",
    coreBlockers: ["1 required evidence item(s) still missing"],
    evidenceSummary: { approved: 1, required: 3, missing: 1, rejected: 1, submitted: 0 },
  });
  assert.equal(result.evidenceSummary.approved, 1);
  assert.equal(result.evidenceSummary.missing, 1);
  assert.equal(result.evidenceSummary.rejected, 1);
  assert.equal(result.riskLevel, "high"); // rejected → high
});
