// Jev Decision Layer — evaluation harness (handoff §56).
// Spec: docs/specs/prometeo/jev-decision-layer.spec.md §9.5.
//
// Runs labelled fixtures through the REAL deterministic baseline and the
// central DecisionLayerService (live mode, so Jev's answer is observable),
// and reports what the activation criteria (§58) need: accuracy vs. ground
// truth, agreement with the baseline, abstention, schema validity, blocked
// unsafe downgrades, provider failures, latency and cost. Pure: the caller
// supplies the service and the case → request mapping.
import type { DecisionActionFor, DecisionFeature, DecisionOutcome } from "./decision.types.js";
import type { DecisionLayerService, DecisionRequest } from "./decision-layer.service.js";
import { PrometeoOrchestratorService } from "../orchestrator/prometeo-orchestrator.service.js";
import { agentRouteRiskSignals, buildAgentRouterInput, deterministicAgentRoute } from "./agent-router.js";
import { buildVisionGateInput, deterministicVisionGate, visionGateInvariant, type VisionGateState } from "./vision-gate.js";

export type EvalCase = { id: string; expected?: string; [key: string]: unknown };

export const ABSTAIN_ACTIONS: ReadonlySet<string> = new Set(["ASK_USER", "ESCALATE", "UNKNOWN", "RETRY_SCAN", "ESCALATE_MODEL"]);

export type EvalCaseResult = {
  id: string;
  expected?: string;
  deterministic: string;
  jev?: string;
  final: string;
  fallbackReason?: string;
  invariantsViolated?: string[];
  latencyMs: number;
  costUsd?: number;
};

export type EvalReport = {
  feature: DecisionFeature;
  cases: number;
  labelled: number;
  deterministicAccuracy: number | null;
  jevAccuracy: number | null;
  finalAccuracy: number | null;
  jevAnswered: number;
  agreementRate: number | null;
  jevAbstentionRate: number | null;
  schemaValidRate: number | null;
  unsafeDowngradesBlocked: number;
  fallbacks: Record<string, number>;
  latencyMs: { p50: number; p95: number; max: number };
  costUsd: number;
  results: EvalCaseResult[];
};

function ratio(numerator: number, denominator: number): number | null {
  return denominator === 0 ? null : Math.round((numerator / denominator) * 1000) / 1000;
}

function percentile(sorted: number[], p: number): number {
  if (sorted.length === 0) return 0;
  return sorted[Math.min(sorted.length - 1, Math.ceil((p / 100) * sorted.length) - 1)];
}

export async function runDecisionEval<F extends DecisionFeature>(input: {
  feature: F;
  cases: readonly EvalCase[];
  service: DecisionLayerService;
  toRequest: (testCase: EvalCase) => DecisionRequest<F>;
}): Promise<EvalReport> {
  const results: EvalCaseResult[] = [];
  for (const testCase of input.cases) {
    const request = input.toRequest(testCase);
    const outcome: DecisionOutcome<DecisionActionFor<F>> = await input.service.decide(request);
    results.push({
      id: testCase.id,
      expected: testCase.expected,
      deterministic: outcome.deterministic.action,
      jev: outcome.jev?.action,
      final: outcome.action,
      fallbackReason: outcome.fallbackReason,
      invariantsViolated: outcome.invariantsViolated,
      latencyMs: outcome.latencyMs,
      costUsd: outcome.costUsd,
    });
  }

  const labelled = results.filter((r) => r.expected !== undefined);
  const answered = results.filter((r) => r.jev !== undefined);
  const labelledAnswered = labelled.filter((r) => r.jev !== undefined);
  // Schema validity is measured over calls that reached Jev and got a body back.
  const reachedProvider = results.filter((r) => r.jev !== undefined || r.fallbackReason === "invalid_response");
  const fallbacks: Record<string, number> = {};
  for (const r of results) if (r.fallbackReason) fallbacks[r.fallbackReason] = (fallbacks[r.fallbackReason] ?? 0) + 1;
  const latencies = results.map((r) => r.latencyMs).sort((a, b) => a - b);

  return {
    feature: input.feature,
    cases: results.length,
    labelled: labelled.length,
    deterministicAccuracy: ratio(labelled.filter((r) => r.deterministic === r.expected).length, labelled.length),
    jevAccuracy: ratio(labelledAnswered.filter((r) => r.jev === r.expected).length, labelledAnswered.length),
    finalAccuracy: ratio(labelled.filter((r) => r.final === r.expected).length, labelled.length),
    jevAnswered: answered.length,
    agreementRate: ratio(answered.filter((r) => r.jev === r.deterministic).length, answered.length),
    jevAbstentionRate: ratio(answered.filter((r) => ABSTAIN_ACTIONS.has(r.jev!)).length, answered.length),
    schemaValidRate: ratio(answered.length, reachedProvider.length),
    // Only registry invariants count as "unsafe downgrade" attempts; feature
    // state invariants (e.g. *_STATE_INVARIANT) are consistency checks.
    unsafeDowngradesBlocked: results.filter((r) => r.invariantsViolated?.some((id) => !id.endsWith("_STATE_INVARIANT"))).length,
    fallbacks,
    latencyMs: { p50: percentile(latencies, 50), p95: percentile(latencies, 95), max: latencies.at(-1) ?? 0 },
    costUsd: Math.round(results.reduce((sum, r) => sum + (r.costUsd ?? 0), 0) * 1e6) / 1e6,
    results,
  };
}

// ── Case → request builders, shared by the eval script and its test so both
// exercise the exact production baseline and request shape.

const classifier = new PrometeoOrchestratorService();

export function agentRouterEvalRequest(testCase: EvalCase): DecisionRequest<"agent_router"> {
  const message = String(testCase.message ?? "");
  const deterministicIntent = classifier.classifyIntent(message);
  return {
    feature: "agent_router",
    actor: { tenantId: "eval", userId: "eval" },
    context: buildAgentRouterInput({ message, deterministicIntent }),
    deterministicDecision: deterministicAgentRoute(deterministicIntent, message),
    riskSignals: agentRouteRiskSignals(message),
    inputClass: `intent:${deterministicIntent}`,
    correlationId: `eval:${testCase.id}`,
  };
}

export function visionGateEvalRequest(testCase: EvalCase): DecisionRequest<"vision_gate"> {
  const state = testCase.state as VisionGateState;
  return {
    feature: "vision_gate",
    actor: { tenantId: "eval", userId: "eval" },
    context: buildVisionGateInput(state),
    candidates: state.alternatives.map((alt) => alt.slug),
    deterministicDecision: deterministicVisionGate(state),
    riskSignals: { lowConfidence: state.status !== "recognized" },
    isValid: visionGateInvariant(state),
    inputClass: `status:${state.status}`,
    correlationId: `eval:${testCase.id}`,
  };
}
