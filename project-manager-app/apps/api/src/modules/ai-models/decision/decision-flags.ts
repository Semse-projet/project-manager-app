// Jev Decision Layer — feature flags, per-feature mode, canary and breaker
// config. Everything defaults to OFF / shadow: merging changes no behavior.
// Spec: docs/specs/prometeo/jev-decision-layer.spec.md §7 and §9.2.
import { createHash } from "node:crypto";
import type { CanaryVia, DecisionFeature, DecisionMode } from "./decision.types.js";

/** Kept for the router's API: "assist" is the router's name for live mode. */
export type AgentRouterMode = "shadow" | "assist";

export interface DecisionLayerConfig {
  enabled: boolean;
  features: Record<DecisionFeature, boolean>;
  modes: Record<DecisionFeature, DecisionMode>;
  canary: {
    tenantIds: ReadonlySet<string>;
    userIds: ReadonlySet<string>;
    roles: ReadonlySet<string>;
    percent: number;
  };
  minConfidence: number;
  breaker: { threshold: number; cooldownMs: number };
  provider: { baseUrl: string | null; apiKey: string | null; model: string | null; timeoutMs: number };
}

function flag(value: string | undefined): boolean {
  return value?.trim().toLowerCase() === "true";
}

function number(value: string | undefined, fallback: number, min: number, max: number): number {
  const parsed = Number.parseFloat(value ?? "");
  return Number.isFinite(parsed) && parsed >= min && parsed <= max ? parsed : fallback;
}

function list(value: string | undefined): ReadonlySet<string> {
  return new Set((value ?? "").split(",").map((item) => item.trim()).filter(Boolean));
}

/** Anything other than an explicit "live"/"assist" stays in shadow (log-only). */
function mode(value: string | undefined): DecisionMode {
  const normalized = value?.trim().toLowerCase();
  return normalized === "live" || normalized === "assist" ? "live" : "shadow";
}

export function resolveDecisionLayerConfig(env: NodeJS.ProcessEnv = process.env): DecisionLayerConfig {
  return {
    enabled: flag(env.SEMSE_JEV_ENABLED),
    features: {
      agent_router: flag(env.SEMSE_JEV_AGENT_ROUTER_ENABLED),
      vision_gate: flag(env.SEMSE_JEV_VISION_GATE_ENABLED),
      marketplace_classify: flag(env.SEMSE_JEV_MARKETPLACE_GATE_ENABLED),
    },
    modes: {
      agent_router: mode(env.SEMSE_JEV_AGENT_ROUTER_MODE),
      vision_gate: mode(env.SEMSE_JEV_VISION_GATE_MODE),
      marketplace_classify: mode(env.SEMSE_JEV_MARKETPLACE_GATE_MODE),
    },
    canary: {
      tenantIds: list(env.SEMSE_JEV_CANARY_TENANT_IDS),
      userIds: list(env.SEMSE_JEV_CANARY_USER_IDS),
      roles: list(env.SEMSE_JEV_CANARY_ROLES),
      percent: number(env.SEMSE_JEV_CANARY_PERCENT, 0, 0, 100),
    },
    minConfidence: number(env.SEMSE_JEV_MIN_CONFIDENCE, 0.7, 0, 1),
    breaker: {
      threshold: number(env.SEMSE_JEV_BREAKER_THRESHOLD, 5, 1, 1000),
      cooldownMs: number(env.SEMSE_JEV_BREAKER_COOLDOWN_MS, 30_000, 1000, 3_600_000),
    },
    provider: {
      // Jev AI (jev-ai.pro). JEV_AI_API_KEY is server-only: never in apps/web,
      // NEXT_PUBLIC_*, logs or the repo.
      baseUrl: env.JEV_AI_BASE_URL?.trim().replace(/\/+$/, "") || null,
      apiKey: env.JEV_AI_API_KEY?.trim() || null,
      model: env.JEV_AI_MODEL?.trim() || null,
      timeoutMs: number(env.JEV_AI_TIMEOUT_MS, 800, 50, 10_000),
    },
  };
}

export function isFeatureActive(config: DecisionLayerConfig, feature: DecisionFeature): boolean {
  return config.enabled && config.features[feature] === true;
}

/** Stable 0–99 bucket so a given user/tenant stays in (or out of) the canary. */
export function canaryBucket(feature: string, tenantId: string, userId = ""): number {
  const digest = createHash("sha256").update(`${feature}:${tenantId}:${userId}`).digest();
  return digest.readUInt32BE(0) % 100;
}

/**
 * Canary match (handoff §53). With no canary configured at all, every actor
 * matches once the flags are on. Otherwise an actor matches through any of:
 * tenant allowlist, user allowlist, internal role, or the percentage bucket.
 */
export function resolveCanary(
  config: DecisionLayerConfig,
  feature: DecisionFeature,
  actor: { tenantId?: string; userId?: string; roles?: readonly string[] },
): CanaryVia | null {
  const { tenantIds, userIds, roles, percent } = config.canary;
  if (tenantIds.size === 0 && userIds.size === 0 && roles.size === 0 && percent === 0) return "all";
  if (actor.tenantId && tenantIds.has(actor.tenantId)) return "tenant";
  if (actor.userId && userIds.has(actor.userId)) return "user";
  if (actor.roles?.some((role) => roles.has(role))) return "role";
  if (percent > 0 && actor.tenantId && canaryBucket(feature, actor.tenantId, actor.userId) < percent) return "percent";
  return null;
}

/** Back-compat helper (tenant-only view of the canary). */
export function isTenantInCanary(config: DecisionLayerConfig, tenantId: string | undefined): boolean {
  return resolveCanary(config, "agent_router", { tenantId }) !== null;
}
