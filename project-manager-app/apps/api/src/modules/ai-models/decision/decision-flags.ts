// Jev Decision Layer — feature flags. Everything defaults to OFF: merging
// this code changes no behavior until someone opts in explicitly.
// Spec: docs/specs/prometeo/jev-decision-layer.spec.md §7.
import type { DecisionFeature } from "./decision.types.js";

export type AgentRouterMode = "shadow" | "assist";

export interface DecisionLayerConfig {
  enabled: boolean;
  features: Record<DecisionFeature, boolean>;
  agentRouterMode: AgentRouterMode;
  canaryTenantIds: ReadonlySet<string>;
  minConfidence: number;
  provider: { baseUrl: string | null; apiKey: string | null; model: string | null; timeoutMs: number };
}

function flag(value: string | undefined): boolean {
  return value?.trim().toLowerCase() === "true";
}

function number(value: string | undefined, fallback: number, min: number, max: number): number {
  const parsed = Number.parseFloat(value ?? "");
  return Number.isFinite(parsed) && parsed >= min && parsed <= max ? parsed : fallback;
}

export function resolveDecisionLayerConfig(env: NodeJS.ProcessEnv = process.env): DecisionLayerConfig {
  const mode = env.SEMSE_JEV_AGENT_ROUTER_MODE?.trim().toLowerCase();
  return {
    enabled: flag(env.SEMSE_JEV_ENABLED),
    features: {
      agent_router: flag(env.SEMSE_JEV_AGENT_ROUTER_ENABLED),
      vision_gate: flag(env.SEMSE_JEV_VISION_GATE_ENABLED),
    },
    // Anything other than an explicit "assist" stays in shadow (log-only).
    agentRouterMode: mode === "assist" ? "assist" : "shadow",
    canaryTenantIds: new Set(
      (env.SEMSE_JEV_CANARY_TENANT_IDS ?? "")
        .split(",")
        .map((id) => id.trim())
        .filter(Boolean),
    ),
    minConfidence: number(env.SEMSE_JEV_MIN_CONFIDENCE, 0.7, 0, 1),
    provider: {
      baseUrl: env.JEV_BASE_URL?.trim().replace(/\/+$/, "") || null,
      apiKey: env.JEV_API_KEY?.trim() || null,
      model: env.JEV_MODEL?.trim() || null,
      timeoutMs: number(env.JEV_TIMEOUT_MS, 800, 50, 10_000),
    },
  };
}

export function isFeatureActive(config: DecisionLayerConfig, feature: DecisionFeature): boolean {
  return config.enabled && config.features[feature] === true;
}

/** Empty canary list = every tenant (once the flags are on). */
export function isTenantInCanary(config: DecisionLayerConfig, tenantId: string | undefined): boolean {
  if (config.canaryTenantIds.size === 0) return true;
  return typeof tenantId === "string" && config.canaryTenantIds.has(tenantId);
}
