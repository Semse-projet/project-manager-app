// Jev Decision Layer — invariant registry (handoff §33 "regla maestra", §54).
// Spec: docs/specs/prometeo/jev-decision-layer.spec.md §9.3.
//
// Non-negotiable, executable rules applied by the core to EVERY Jev decision
// before SEMSE can use it. Each invariant has its own test
// (apps/api/test/jev-invariants.test.ts). Features may add their own
// state invariants on top (e.g. vision: no ACCEPT without an object), never
// fewer.
import { DECISION_FEATURES, type DecisionFeature, type RiskSignals, type StructuredDecision } from "./decision.types.js";

export type InvariantContext = {
  feature: DecisionFeature;
  deterministic: StructuredDecision<string>;
  proposed: StructuredDecision<string>;
  riskSignals: RiskSignals;
};

export type DecisionInvariant = {
  id: string;
  description: string;
  /** Returns true when the proposal satisfies the invariant. */
  holds: (ctx: InvariantContext) => boolean;
};

function caution(feature: DecisionFeature, action: string): number {
  const table = DECISION_FEATURES[feature].caution as Record<string, number>;
  return table[action] ?? 0;
}

/** Jev may add caution, never remove it, when the given signal is present. */
function noDowngradeWhen(signal: keyof RiskSignals) {
  return (ctx: InvariantContext) =>
    !ctx.riskSignals[signal] || caution(ctx.feature, ctx.proposed.action) >= caution(ctx.feature, ctx.deterministic.action);
}

export const DECISION_INVARIANTS: readonly DecisionInvariant[] = [
  {
    id: "MONEY_NO_DOWNGRADE",
    description: "A deterministic decision involving money movement cannot be made less cautious.",
    holds: noDowngradeWhen("money"),
  },
  {
    id: "PERMISSION_DENIAL_NO_DOWNGRADE",
    description: "A permission denial cannot be downgraded.",
    holds: noDowngradeWhen("permissionDenied"),
  },
  {
    id: "IDENTITY_FAILURE_NO_DOWNGRADE",
    description: "An identity failure cannot be downgraded.",
    holds: noDowngradeWhen("identityFailure"),
  },
  {
    id: "LEGAL_COMPLIANCE_NO_DOWNGRADE",
    description: "A legal/compliance escalation cannot be downgraded.",
    holds: noDowngradeWhen("legalCompliance"),
  },
  {
    id: "SAFETY_CRITICAL_NO_DOWNGRADE",
    description: "A safety-critical escalation cannot be downgraded.",
    holds: noDowngradeWhen("safetyCritical"),
  },
  {
    id: "IRREVERSIBLE_REQUIRES_DETERMINISTIC_AUTH",
    description: "For irreversible actions only the deterministic decision may stand.",
    holds: (ctx) => !ctx.riskSignals.irreversible || ctx.proposed.action === ctx.deterministic.action,
  },
  {
    id: "LOW_CONFIDENCE_NOT_CERTAINTY",
    description: "Low-confidence input cannot be turned into a certainty action.",
    holds: (ctx) =>
      !ctx.riskSignals.lowConfidence ||
      !(DECISION_FEATURES[ctx.feature].certaintyActions as readonly string[]).includes(ctx.proposed.action),
  },
];

/**
 * PROVIDER_FAILURE_FALLS_BACK is structural rather than a predicate: every
 * provider failure path in DecisionLayerService.decide() resolves to the
 * deterministic decision. It is listed here so the registry is complete and
 * covered by the same test file.
 */
export const STRUCTURAL_INVARIANTS = ["PROVIDER_FAILURE_FALLS_BACK"] as const;

export function evaluateInvariants(ctx: InvariantContext): string[] {
  return DECISION_INVARIANTS.filter((invariant) => !invariant.holds(ctx)).map((invariant) => invariant.id);
}
