// Marketplace confidence gate — Jev Decision Layer, Wave: Marketplace.
// Spec: docs/specs/prometeo/jev-human-review-queue.spec.md
//
// Deliberately does NOT call DecisionLayerService.decide(): that method is
// built to ask Jev (an external LLM) to confirm/override a deterministic
// baseline, with its own provider/circuit-breaker/canary machinery. This
// gate's AUTO_PROCEED/HUMAN_REVIEW decision is itself fully deterministic
// (a matchScore threshold) — there is no LLM second-opinion in this wave.
// It reuses DECISION_FEATURES' vocabulary, the shared flags/canary resolver,
// and the JevDecisionEvent telemetry table for a consistent review UX, but
// evaluates and persists independently of the Jev provider.
import type { CanaryVia, DecisionMode } from "../ai-models/decision/decision.types.js";
import { isFeatureActive, resolveCanary, type DecisionLayerConfig } from "../ai-models/decision/decision-flags.js";

export type MarketplaceGateAction = "AUTO_PROCEED" | "HUMAN_REVIEW";
export type MarketplaceGateReasonCode = "GATE_INACTIVE" | "MATCH_SCORE_OK" | "MATCH_SCORE_BELOW_THRESHOLD";

export type MarketplaceGateEvaluation = {
  /** Whether the gate is enabled at all (SEMSE_JEV_ENABLED + SEMSE_JEV_MARKETPLACE_GATE_ENABLED). */
  active: boolean;
  /** Which canary bucket the tenant fell into, or null when out of canary. */
  canary: CanaryVia | null;
  mode: DecisionMode;
  /** matchScore/100. */
  confidence: number;
  action: MarketplaceGateAction;
  reasonCode: MarketplaceGateReasonCode;
  /** True only when active + in canary + mode=live + action=HUMAN_REVIEW. Shadow mode never blocks. */
  shouldBlockDispatch: boolean;
};

export function evaluateMarketplaceConfidenceGate(input: {
  config: DecisionLayerConfig;
  tenantId: string;
  matchScore: number;
}): MarketplaceGateEvaluation {
  const { config, tenantId, matchScore } = input;
  const confidence = matchScore / 100;
  const mode = config.modes.marketplace_classify;
  const active = isFeatureActive(config, "marketplace_classify");
  const canary = active ? resolveCanary(config, "marketplace_classify", { tenantId }) : null;

  if (!active || canary === null) {
    return { active, canary, mode, confidence, action: "AUTO_PROCEED", reasonCode: "GATE_INACTIVE", shouldBlockDispatch: false };
  }

  const belowThreshold = confidence < config.minConfidence;
  const action: MarketplaceGateAction = belowThreshold ? "HUMAN_REVIEW" : "AUTO_PROCEED";
  const reasonCode: MarketplaceGateReasonCode = belowThreshold ? "MATCH_SCORE_BELOW_THRESHOLD" : "MATCH_SCORE_OK";
  const shouldBlockDispatch = mode === "live" && action === "HUMAN_REVIEW";

  return { active, canary, mode, confidence, action, reasonCode, shouldBlockDispatch };
}

// ── Pending-review payload ────────────────────────────────────────────────
// Reuses JevDecisionEvent.inputClass (a free-text Postgres column meant for
// short telemetry labels) to carry the small JSON blob needed to resume the
// held dispatch on approve/reject. This avoids a migration for this pilot
// wave; if the feature graduates past shadow/canary, a dedicated column is
// cleaner and should replace this (see spec §7 for the tradeoff, documented
// there rather than silently done in code).
export type PendingMarketplaceReview = {
  jobId: string;
  projectId: string;
  originalPayload: Record<string, unknown>;
  classification: Record<string, unknown>;
};

const PENDING_REVIEW_PREFIX = "marketplace_pending_review:v1:";

export function encodePendingReview(input: PendingMarketplaceReview): string {
  return `${PENDING_REVIEW_PREFIX}${JSON.stringify(input)}`;
}

export function decodePendingReview(inputClass: string | null | undefined): PendingMarketplaceReview | null {
  if (!inputClass || !inputClass.startsWith(PENDING_REVIEW_PREFIX)) return null;
  try {
    const parsed = JSON.parse(inputClass.slice(PENDING_REVIEW_PREFIX.length)) as PendingMarketplaceReview;
    if (!parsed.jobId || !parsed.projectId || !parsed.originalPayload || !parsed.classification) return null;
    return parsed;
  } catch {
    return null;
  }
}
