// Jev Decision Layer — pilot 1: Agent Router.
// Spec: docs/specs/prometeo/jev-decision-layer.spec.md §4 (J8).
//
// The deterministic router is NOT replaced: `deterministicAgentRoute` maps the
// existing keyword classifier (PrometeoOrchestratorService.classifyIntent) to
// a capability and is both the fallback and the baseline Jev is measured
// against. The router never executes anything; SEMSE decides what a
// capability label means and runs its own authorized workflow.
import type { PrometeoIntentType } from "../orchestrator/prometeo-orchestrator.service.js";
import type { AgentRouteAction, StructuredDecision } from "./decision.types.js";

const INTENT_TO_ACTION: Record<PrometeoIntentType, AgentRouteAction> = {
  operational_summary: "PROMETEO",
  project_report: "PROMETEO",
  evidence_review: "EVIDENCE",
  payment_status: "PROMETEO",
  dispute_status: "PROMETEO",
  schedule_plan: "BUILDOPS",
  legal_compliance: "PROMETEO",
  system_health: "PROMETEO",
  developer_diagnostics: "PROMETEO",
  budget_estimate: "ESTIMATE",
  estimate_generation: "ESTIMATE",
  price_suggestion: "ESTIMATE",
  materials_list: "ESTIMATE",
  client_message: "PROMETEO",
  project_summary_client: "PROMETEO",
  unknown: "PROMETEO",
};

// Capabilities the keyword classifier has no intent for yet.
const CHANGE_ORDER_KEYWORDS = ["change order", "orden de cambio", "cambio de alcance", "trabajo extra", "extra work", "scope change"];
const VISION_KEYWORDS = [
  "cómo se llama esta", "como se llama esta", "qué es esta pieza", "que es esta pieza", "qué herramienta es",
  "que herramienta es", "identify this", "what is this tool", "what is this part", "what's this called",
];
// Requests that touch money movement are escalated to SEMSE's governed flow;
// the chat's existing human_required gate still applies on top of this.
const MONEY_MOVEMENT_KEYWORDS = ["liberar pago", "liberar el pago", "release payment", "release the payment", "liberar escrow", "release escrow"];

function includesAny(text: string, keywords: string[]): boolean {
  return keywords.some((keyword) => text.includes(keyword));
}

export function deterministicAgentRoute(intent: PrometeoIntentType, message: string): StructuredDecision<AgentRouteAction> {
  const lower = message.toLowerCase();
  if (includesAny(lower, MONEY_MOVEMENT_KEYWORDS)) {
    return { action: "ESCALATE", confidence: 1, reasonCode: "MONEY_MOVEMENT_REQUIRES_GOVERNED_FLOW" };
  }
  if (includesAny(lower, CHANGE_ORDER_KEYWORDS)) {
    return { action: "CHANGE_ORDER", confidence: 0.8, reasonCode: "CHANGE_ORDER_KEYWORD" };
  }
  if (includesAny(lower, VISION_KEYWORDS)) {
    return { action: "VISION", confidence: 0.8, reasonCode: "VISION_KEYWORD" };
  }
  if (intent === "unknown") {
    const words = lower.split(/\s+/).filter(Boolean).length;
    return words < 3
      ? { action: "ASK_USER", confidence: 0.6, reasonCode: "MESSAGE_TOO_SHORT" }
      : { action: "PROMETEO", confidence: 0.5, reasonCode: "NO_INTENT_MATCH_DEFAULT_PROMETEO" };
  }
  return { action: INTENT_TO_ACTION[intent], confidence: 0.75, reasonCode: `INTENT_${intent.toUpperCase()}` };
}

/**
 * Structured context sent to Jev. The message is truncated and no operational
 * data (projects, money, evidence) is included — Jev only needs the ask.
 */
export function buildAgentRouterInput(input: {
  message: string;
  deterministicIntent: PrometeoIntentType;
  role?: string;
  pageRoute?: string;
  attachmentCount?: number;
  trade?: string;
}): Record<string, unknown> {
  return {
    message: input.message.slice(0, 500),
    deterministicIntent: input.deterministicIntent,
    role: input.role ?? null,
    pageRoute: input.pageRoute ?? null,
    attachmentCount: input.attachmentCount ?? 0,
    trade: input.trade ?? null,
  };
}

/**
 * Assist mode only: the intent Jev's capability may fill in when the keyword
 * classifier found nothing. Capabilities without an equivalent chat intent
 * (CHANGE_ORDER, VISION, ASK_USER, ESCALATE) never change the chat intent —
 * they are surfaced to the client as a routing hint instead.
 */
const ACTION_TO_ASSIST_INTENT: Partial<Record<AgentRouteAction, PrometeoIntentType>> = {
  ESTIMATE: "estimate_generation",
  EVIDENCE: "evidence_review",
  BUILDOPS: "schedule_plan",
};

export function resolveChatIntent(input: {
  deterministicIntent: PrometeoIntentType;
  decision: { action: AgentRouteAction; source: "jev" | "deterministic" };
  mode: "shadow" | "assist";
}): PrometeoIntentType {
  if (input.mode !== "assist" || input.decision.source !== "jev") return input.deterministicIntent;
  if (input.deterministicIntent !== "unknown") return input.deterministicIntent;
  return ACTION_TO_ASSIST_INTENT[input.decision.action] ?? input.deterministicIntent;
}

/**
 * Invariant applied to Jev's proposal: once the deterministic router has
 * escalated a money-movement request, Jev may not downgrade it to any other
 * capability. Jev can add caution (ESCALATE/ASK_USER elsewhere) but never
 * remove it here.
 */
export function agentRouteInvariant(fallback: StructuredDecision<AgentRouteAction>) {
  return (decision: StructuredDecision<AgentRouteAction>) =>
    fallback.reasonCode !== "MONEY_MOVEMENT_REQUIRES_GOVERNED_FLOW" || decision.action === "ESCALATE";
}
