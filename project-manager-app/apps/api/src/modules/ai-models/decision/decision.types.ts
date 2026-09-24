// Jev Decision Layer — structured decision contracts.
// Spec: docs/specs/prometeo/jev-decision-layer.spec.md §5 (pilots) and §9
// (Wave 0 core platform: handoff §34, §52–55).
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

/** Reusable contract for autonomous flows (Wave 5; not wired yet). */
export const WORKFLOW_DECISIONS = ["CONTINUE", "RETRY", "ASK_USER", "ESCALATE", "STOP"] as const;
export type WorkflowDecision = (typeof WORKFLOW_DECISIONS)[number];

// ── Future waves: contracts only, deliberately NOT registered as features.
// An Evidence decision alone must never release money (handoff §40, §50).
export type EvidenceDecision = "CONTINUE" | "REQUEST_MORE_EVIDENCE" | "HUMAN_REVIEW" | "BLOCK";
export type ChangeOrderDecision = "NO_CHANGE" | "POTENTIAL_CHANGE_ORDER" | "REQUEST_DETAILS" | "ESCALATE";
export type ModelTierDecision = "FAST_MODEL" | "STANDARD_MODEL" | "ADVANCED_MODEL" | "HUMAN_REVIEW";

/**
 * Per-feature policy. `caution` ranks how conservative each action is
 * (higher = more cautious); the invariant registry uses it to forbid Jev
 * from downgrading a cautious deterministic decision. `certaintyActions`
 * are the actions that assert a confident result — never allowed on
 * low-confidence input.
 */
export type FeaturePolicy<A extends string> = {
  actions: readonly A[];
  caution: Record<A, number>;
  certaintyActions: readonly A[];
};

/**
 * Closed registry of features Jev may decide on. Adding one is a spec change
 * and a new wave. Authorization, identity, role permissions, money movement,
 * escrow release, irreversible mutations, Evidence deletion, contract
 * approval, legal compliance, secrets and admin access must never appear here.
 */
export const DECISION_FEATURES = {
  agent_router: {
    actions: AGENT_ROUTE_ACTIONS,
    caution: {
      PROMETEO: 0,
      ESTIMATE: 0,
      BUILDOPS: 0,
      EVIDENCE: 0,
      CHANGE_ORDER: 0,
      VISION: 0,
      ASK_USER: 1,
      ESCALATE: 2,
    },
    certaintyActions: [],
  } satisfies FeaturePolicy<AgentRouteAction>,
  vision_gate: {
    actions: VISION_GATE_ACTIONS,
    caution: {
      ACCEPT_RESULT: 0,
      SHOW_ALTERNATIVES: 1,
      ASK_USER: 1,
      RETRY_SCAN: 1,
      UNKNOWN: 1,
      ESCALATE_MODEL: 2,
    },
    certaintyActions: ["ACCEPT_RESULT"],
  } satisfies FeaturePolicy<VisionGateAction>,
} as const;

/** Back-compat alias: feature → allowed actions. */
export const DECISION_FEATURE_ACTIONS = {
  agent_router: DECISION_FEATURES.agent_router.actions,
  vision_gate: DECISION_FEATURES.vision_gate.actions,
} as const;

export type DecisionFeature = keyof typeof DECISION_FEATURES;
export type DecisionActionFor<F extends DecisionFeature> = (typeof DECISION_FEATURES)[F]["actions"][number];

export type StructuredDecision<A extends string> = {
  action: A;
  confidence: number;
  reasonCode: string;
};

/**
 * Deterministic risk signals the caller already knows (handoff §33, §54).
 * When one is set, the invariant registry forbids Jev from making the
 * decision less cautious than the deterministic baseline.
 */
export type RiskSignals = {
  money?: boolean;
  permissionDenied?: boolean;
  identityFailure?: boolean;
  legalCompliance?: boolean;
  safetyCritical?: boolean;
  irreversible?: boolean;
  lowConfidence?: boolean;
};

export type DecisionMode = "shadow" | "live";

export type FallbackReason =
  | "disabled"
  | "not_in_canary"
  | "circuit_open"
  | "unavailable"
  | "timeout"
  | "invalid_response"
  | "low_confidence"
  | "provider_error"
  | "invariant_violation";

export type CanaryVia = "all" | "tenant" | "user" | "role" | "percent";

/** DecisionResult (handoff §34) — what callers act on. */
export type DecisionOutcome<A extends string> = StructuredDecision<A> & {
  /** Where the returned action came from. In shadow mode this is always "deterministic". */
  source: "jev" | "deterministic";
  provider: string;
  mode: DecisionMode;
  shadowMode: boolean;
  fallbackReason?: FallbackReason;
  /** The deterministic baseline, always present for comparison. */
  deterministic: StructuredDecision<A>;
  /** What Jev proposed (valid or not), when it answered. */
  jev?: StructuredDecision<string>;
  /** Jev and baseline agreed on the action (only when Jev answered with a valid action). */
  agreement?: boolean;
  invariantsViolated?: string[];
  canary?: CanaryVia;
  /** JevDecisionEvent id, present only when telemetry recorded the decision. */
  eventId?: string;
  latencyMs: number;
  model?: string;
  costUsd?: number;
};

export const REASON_CODE_PATTERN = /^[A-Z][A-Z0-9_]{1,63}$/;

export function isDecisionFeature(value: unknown): value is DecisionFeature {
  return typeof value === "string" && Object.prototype.hasOwnProperty.call(DECISION_FEATURES, value);
}
