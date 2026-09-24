// Jev Decision Layer — structured decision contracts.
// Spec: docs/specs/prometeo/jev-decision-layer.spec.md §5.
//
// Decisions are plain data. Nothing in this layer executes an action: SEMSE
// receives the decision, validates it, and runs its own authorized workflow.

export const AGENT_ROUTE_ACTIONS = [
  "PROMETEO",
  "ESTIMATE",
  "BUILDOPS",
  "EVIDENCE",
  "CHANGE_ORDER",
  "VISION",
  "ASK_USER",
  "ESCALATE",
] as const;
export type AgentRouteAction = (typeof AGENT_ROUTE_ACTIONS)[number];

export const VISION_GATE_ACTIONS = [
  "ACCEPT_RESULT",
  "SHOW_ALTERNATIVES",
  "RETRY_SCAN",
  "ASK_USER",
  "ESCALATE_MODEL",
  "UNKNOWN",
] as const;
export type VisionGateAction = (typeof VISION_GATE_ACTIONS)[number];

/** Reusable contract for autonomous flows (not wired in the pilot). */
export const WORKFLOW_DECISIONS = ["CONTINUE", "RETRY", "ASK_USER", "ESCALATE", "STOP"] as const;
export type WorkflowDecision = (typeof WORKFLOW_DECISIONS)[number];

// ── Future use cases: contracts only, deliberately NOT registered as
// DecisionFeatures yet. An Evidence decision alone must never release money.
export type EvidenceDecision = "CONTINUE" | "REQUEST_MORE_EVIDENCE" | "HUMAN_REVIEW" | "BLOCK";
export type ChangeOrderDecision = "NO_CHANGE" | "POTENTIAL_CHANGE_ORDER" | "REQUEST_DETAILS" | "ESCALATE";
export type ModelTierDecision = "FAST_MODEL" | "STANDARD_MODEL" | "ADVANCED_MODEL" | "HUMAN_REVIEW";

/**
 * Closed registry of features Jev may decide on. Adding one is a spec change.
 * Authorization, identity, role permissions, money movement, escrow release,
 * irreversible mutations, Evidence deletion, contract approval, legal
 * compliance, secrets and admin access must never appear here.
 */
export const DECISION_FEATURE_ACTIONS = {
  agent_router: AGENT_ROUTE_ACTIONS,
  vision_gate: VISION_GATE_ACTIONS,
} as const;
export type DecisionFeature = keyof typeof DECISION_FEATURE_ACTIONS;
export type DecisionActionFor<F extends DecisionFeature> = (typeof DECISION_FEATURE_ACTIONS)[F][number];

export type StructuredDecision<A extends string> = {
  action: A;
  confidence: number;
  reasonCode: string;
};

export type FallbackReason =
  | "disabled"
  | "not_in_canary"
  | "unavailable"
  | "timeout"
  | "invalid_response"
  | "low_confidence"
  | "provider_error"
  | "invariant_violation";

export type DecisionOutcome<A extends string> = StructuredDecision<A> & {
  source: "jev" | "deterministic";
  fallbackReason?: FallbackReason;
  /** JevDecisionEvent id, present only when telemetry recorded the decision. */
  eventId?: string;
  latencyMs: number;
  model?: string;
  /** What Jev proposed when it was overruled by fallback (for comparison). */
  proposed?: StructuredDecision<string>;
};

export const REASON_CODE_PATTERN = /^[A-Z][A-Z0-9_]{1,63}$/;

export function isDecisionFeature(value: unknown): value is DecisionFeature {
  return typeof value === "string" && Object.prototype.hasOwnProperty.call(DECISION_FEATURE_ACTIONS, value);
}
