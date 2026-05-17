import type { CopilotRoutingContext } from "./types.js";

/**
 * Routing profiles for each SEMSE agent.
 * Each profile encodes where to send inference: local (Ollama) vs external (Anthropic/OpenAI).
 *
 * Tiers:
 *   Tier 1 (local/cheap)  — classification, summaries, translation, extraction
 *   Tier 2 (hybrid)       — evidence analysis, risk, change orders
 *   Tier 3 (premium)      — contracts, disputes, legal, complex reasoning
 */
export const AGENT_PROFILES = {
  // ── Tier 1 — always local ───────────────────────────────────────────────────

  "mission-control": {
    agentName: "mission-control",
    source: "operational-intelligence",
    localOnly: true,
    lowCost: true,
  },

  "intake-interpreter": {
    agentName: "intake-interpreter",
    source: "smart-intake",
    localOnly: true,
    lowCost: true,
  },

  "buildops-intelligence": {
    agentName: "buildops-intelligence",
    source: "buildops",
    localOnly: true,
    lowCost: true,
  },

  "risk-narrator": {
    agentName: "risk-narrator",
    source: "operational-intelligence",
    localOnly: true,
    lowCost: true,
  },

  "change-order-detector": {
    agentName: "change-order-detector",
    source: "change-orders",
    localOnly: true,
    lowCost: true,
  },

  "translation": {
    agentName: "translation",
    source: "shared",
    localOnly: true,
    lowCost: true,
  },

  // ── Tier 2 — local preferred, external allowed ──────────────────────────────

  "evidence-analyzer": {
    agentName: "evidence-analyzer",
    source: "evidence",
    privacyCritical: true,   // fotos y datos de proyecto no salen al cloud sin necesidad
    lowCost: true,
  },

  "prometeo-chat": {
    agentName: "prometeo-chat",
    source: "prometeo",
    lowCost: true,
  },

  // ── Tier 3 — premium / external for complex reasoning ──────────────────────

  "contract-reviewer": {
    agentName: "contract-reviewer",
    source: "contracts",
    riskLevel: "high" as const,
  },

  "dispute-analyzer": {
    agentName: "dispute-analyzer",
    source: "disputes",
    riskLevel: "high" as const,
    requiresTools: true,
  },
} satisfies Record<string, CopilotRoutingContext>;

export type AgentProfileName = keyof typeof AGENT_PROFILES;

export function getAgentProfile(name: AgentProfileName): CopilotRoutingContext {
  return AGENT_PROFILES[name];
}
