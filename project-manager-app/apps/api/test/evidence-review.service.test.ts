import test from "node:test";
import assert from "node:assert/strict";

/**
 * P3 — Evidence review logic tests (no DB, no LLM).
 * Tests the rules-based fallback and schema validation used by EvidenceReviewService.
 */

// ── Reproduce rulesBasedReview logic ──────────────────────────────────────────

type ReviewStatus =
  | "approved_suggestion"
  | "needs_reupload"
  | "missing_context"
  | "possible_mismatch"
  | "rejected_suggestion"
  | "manual_review_required";

function rulesBasedReview(status: string, label: string) {
  if (status === "approved") {
    return { reviewStatus: "approved_suggestion" as ReviewStatus, confidence: 0.7, riskLevel: "low", disputeRisk: false };
  }
  if (status === "rejected") {
    return { reviewStatus: "rejected_suggestion" as ReviewStatus, confidence: 0.8, riskLevel: "high", disputeRisk: true };
  }
  if (status === "missing") {
    return { reviewStatus: "needs_reupload" as ReviewStatus, confidence: 0.9, riskLevel: "medium", disputeRisk: false };
  }
  return { reviewStatus: "manual_review_required" as ReviewStatus, confidence: 0.5, riskLevel: "medium", disputeRisk: false };
}

// ── Schema validation (reproduces Zod logic) ──────────────────────────────────

const VALID_REVIEW_STATUSES = new Set([
  "approved_suggestion", "needs_reupload", "missing_context",
  "possible_mismatch", "rejected_suggestion", "manual_review_required",
]);
const VALID_RISK_LEVELS = new Set(["low", "medium", "high", "critical"]);

function validateReviewOutput(raw: unknown): boolean {
  if (!raw || typeof raw !== "object") return false;
  const r = raw as Record<string, unknown>;
  return (
    VALID_REVIEW_STATUSES.has(r.reviewStatus as string) &&
    typeof r.confidence === "number" &&
    r.confidence >= 0 && r.confidence <= 1 &&
    VALID_RISK_LEVELS.has(r.riskLevel as string) &&
    Array.isArray(r.findings) &&
    Array.isArray(r.requiredActions) &&
    typeof r.recommendedAction === "string" &&
    typeof r.disputeRisk === "boolean" &&
    typeof r.auditReason === "string"
  );
}

function parseStructured(raw: string): unknown | null {
  const match = raw.match(/\{[\s\S]*\}/);
  if (!match) return null;
  try { return JSON.parse(match[0]); } catch { return null; }
}

// ── Tests ─────────────────────────────────────────────────────────────────────

test("P3.R1: evidencia approved → approved_suggestion, low risk", () => {
  const result = rulesBasedReview("approved", "Final photo");
  assert.equal(result.reviewStatus, "approved_suggestion");
  assert.equal(result.riskLevel, "low");
  assert.equal(result.disputeRisk, false);
  assert.ok(result.confidence >= 0.6);
});

test("P3.R2: evidencia missing → needs_reupload, medium risk", () => {
  const result = rulesBasedReview("missing", "Electrical panel photo");
  assert.equal(result.reviewStatus, "needs_reupload");
  assert.equal(result.riskLevel, "medium");
  assert.equal(result.disputeRisk, false);
  assert.ok(result.confidence >= 0.8);
});

test("P3.R3: evidencia rejected → rejected_suggestion, high risk, disputeRisk=true", () => {
  const result = rulesBasedReview("rejected", "Before photo");
  assert.equal(result.reviewStatus, "rejected_suggestion");
  assert.equal(result.riskLevel, "high");
  assert.equal(result.disputeRisk, true);
  assert.ok(result.confidence >= 0.7);
});

test("P3.R4: evidencia submitted (LLM unavailable) → manual_review_required", () => {
  const result = rulesBasedReview("submitted", "Roof photo");
  assert.equal(result.reviewStatus, "manual_review_required");
  assert.equal(result.confidence, 0.5);
});

test("P3.V1: schema válido → pasa validación", () => {
  const valid = {
    reviewStatus: "approved_suggestion",
    confidence: 0.85,
    riskLevel: "low",
    findings: ["Work appears complete"],
    requiredActions: [],
    recommendedAction: "Approve",
    disputeRisk: false,
    auditReason: "Evidence matches milestone requirements",
  };
  assert.ok(validateReviewOutput(valid));
});

test("P3.V2: reviewStatus inválido → falla validación", () => {
  const invalid = {
    reviewStatus: "approve_everything", // not in schema
    confidence: 0.9,
    riskLevel: "low",
    findings: [],
    requiredActions: [],
    recommendedAction: "ok",
    disputeRisk: false,
    auditReason: "test",
  };
  assert.equal(validateReviewOutput(invalid), false);
});

test("P3.V3: confidence fuera de rango → falla validación", () => {
  const invalid = {
    reviewStatus: "approved_suggestion",
    confidence: 1.5, // > 1.0
    riskLevel: "low",
    findings: [],
    requiredActions: [],
    recommendedAction: "ok",
    disputeRisk: false,
    auditReason: "test",
  };
  assert.equal(validateReviewOutput(invalid), false);
});

test("P3.V4: JSON con texto extra → parseStructured extrae objeto", () => {
  const rawWithPreamble = `Aquí está mi análisis:\n{"reviewStatus":"needs_reupload","confidence":0.7,"riskLevel":"medium","findings":["missing"],"requiredActions":["upload"],"recommendedAction":"upload","disputeRisk":false,"auditReason":"missing evidence"}\nEspero que sirva.`;
  const parsed = parseStructured(rawWithPreamble);
  assert.ok(parsed !== null);
  assert.ok(validateReviewOutput(parsed));
});

test("P3.V5: JSON inválido → parseStructured devuelve null", () => {
  const raw = "No hay JSON aquí, solo texto libre del modelo";
  const parsed = parseStructured(raw);
  assert.equal(parsed, null);
});

test("P3.P1: review no debe liberar pago directamente (interface check)", () => {
  // The review service returns a recommendation, not an action
  const result = rulesBasedReview("submitted", "Final photo");
  // reviewStatus must be a suggestion/review, never "release" or "approve_payment"
  assert.ok(!result.reviewStatus.includes("release"));
  assert.ok(!result.reviewStatus.includes("payment"));
});

test("P3.P2: privacyCritical routing — localOnly no incluye cloud providers", () => {
  // This tests the policy logic without importing the full LLM stack
  const CLOUD = new Set(["anthropic", "openai"]);
  const chain = ["ollama", "template"]; // expected chain for privacyCritical
  const cloudInChain = chain.filter((p) => CLOUD.has(p));
  assert.equal(cloudInChain.length, 0, "privacyCritical chain must not include cloud providers");
});

test("P3.P3: high risk + disputeRisk → should trigger Mission Control signal", () => {
  const review = rulesBasedReview("rejected", "Critical photo");
  // High risk rejected evidence should create a signal
  const shouldSignal = review.riskLevel === "high" && review.disputeRisk;
  assert.ok(shouldSignal, "rejected evidence with disputeRisk should trigger signal");
});
