// Jev Decision Layer — pilot 2: Sense Vision Decision Gate.
// Spec: docs/specs/prometeo/jev-decision-layer.spec.md §4 (J9, J10).
//
// Runs AFTER recognition and Construction Library matching. It decides what
// the UI should do with a result; it never changes what was recognized.
// The deterministic gate derives directly from the existing confidence
// policy (vision-library.logic.ts decideRecognition), so with the flags off
// the behavior is exactly the pre-Jev one.
import type { StructuredDecision, VisionGateAction } from "./decision.types.js";

export type VisionGateState = {
  status: "recognized" | "uncertain" | "unknown" | "unavailable" | "error";
  reason?: string;
  candidate: { slug: string; confidence: number; trades: string[] } | null;
  alternatives: Array<{ slug: string; confidence: number }>;
  context?: { trade?: string };
};

export function deterministicVisionGate(state: VisionGateState): StructuredDecision<VisionGateAction> {
  switch (state.status) {
    case "recognized":
      return { action: "ACCEPT_RESULT", confidence: 1, reasonCode: "HIGH_CONFIDENCE_LIBRARY_MATCH" };
    case "uncertain":
      return state.alternatives.length > 0
        ? { action: "SHOW_ALTERNATIVES", confidence: 1, reasonCode: "AMBIGUOUS_VISUAL_MATCH" }
        : { action: "ASK_USER", confidence: 1, reasonCode: "MEDIUM_CONFIDENCE_NO_ALTERNATIVES" };
    case "unknown":
      if (state.reason === "not_in_library") return { action: "UNKNOWN", confidence: 1, reasonCode: "NOT_IN_LIBRARY" };
      if (state.reason === "malformed_result") return { action: "ESCALATE_MODEL", confidence: 1, reasonCode: "MALFORMED_MODEL_OUTPUT" };
      return { action: "RETRY_SCAN", confidence: 1, reasonCode: "LOW_CONFIDENCE_OR_NO_CANDIDATE" };
    case "error":
      return { action: "RETRY_SCAN", confidence: 1, reasonCode: "RECOGNITION_ERROR" };
    case "unavailable":
    default:
      return { action: "UNKNOWN", confidence: 1, reasonCode: "RECOGNITION_UNAVAILABLE" };
  }
}

/**
 * Jev may choose a different presentation, but only one the state supports:
 * it can't accept or ask about an object that doesn't exist, show
 * alternatives that don't exist, or turn an unavailable/errored recognizer
 * into an accepted result.
 */
export function visionGateInvariant(state: VisionGateState) {
  return (decision: StructuredDecision<VisionGateAction>): boolean => {
    if (decision.action === "ACCEPT_RESULT") {
      return state.candidate !== null && (state.status === "recognized" || state.status === "uncertain");
    }
    if (decision.action === "SHOW_ALTERNATIVES") return state.candidate !== null && state.alternatives.length > 0;
    if (decision.action === "ASK_USER") return state.candidate !== null;
    return true;
  };
}

/** Compact, non-sensitive context for Jev: slugs and scores only, never the frame. */
export function buildVisionGateInput(state: VisionGateState): Record<string, unknown> {
  return {
    status: state.status,
    reason: state.reason ?? null,
    candidate: state.candidate?.slug ?? null,
    confidence: state.candidate?.confidence ?? null,
    candidateTrades: state.candidate?.trades ?? [],
    alternatives: state.alternatives.map((alt) => ({ slug: alt.slug, confidence: alt.confidence })),
    context: { trade: state.context?.trade ?? null },
  };
}
