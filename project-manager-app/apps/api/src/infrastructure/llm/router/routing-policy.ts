import type { CopilotRoutingContext, LLMProviderName } from "../types.js";

const TOOL_CAPABLE: ReadonlySet<LLMProviderName> = new Set(["anthropic", "openai"]);
const RISK_SAFE: ReadonlySet<LLMProviderName> = new Set(["anthropic", "openai"]);

export function selectProvider(ctx: CopilotRoutingContext | undefined): LLMProviderName {
  if (!ctx) return resolveDefault();
  if (ctx.localOnly) return "ollama";
  if (ctx.privacyCritical) return "ollama";
  if (ctx.riskLevel === "high") {
    return ctx.preferredProvider && RISK_SAFE.has(ctx.preferredProvider)
      ? ctx.preferredProvider
      : "anthropic";
  }
  if (ctx.requiresTools) {
    return ctx.preferredProvider && TOOL_CAPABLE.has(ctx.preferredProvider)
      ? ctx.preferredProvider
      : "anthropic";
  }
  if (ctx.preferredProvider) return ctx.preferredProvider;
  if (ctx.lowCost) return "ollama";
  return resolveDefault();
}

function resolveDefault(): LLMProviderName {
  const env = process.env.LLM_DEFAULT_PROVIDER;
  if (env === "anthropic" || env === "openai" || env === "together" || env === "ollama" || env === "template") {
    return env;
  }
  // Ollama is the native default when LLM_DEFAULT_PROVIDER is not set
  return "ollama";
}

const CLOUD_PROVIDERS: ReadonlySet<LLMProviderName> = new Set(["anthropic", "openai", "together"]);

export function buildFallbackChain(
  primary: LLMProviderName,
  ctx: CopilotRoutingContext | undefined,
): LLMProviderName[] {
  const fromEnv = (process.env.LLM_FALLBACK_PROVIDERS ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter((s): s is LLMProviderName => s === "anthropic" || s === "openai" || s === "together" || s === "ollama" || s === "template");

  const chain: LLMProviderName[] = ctx?.fallbackOrder ?? fromEnv;

  // Ensure primary is first, template is last, no duplicates
  let ordered = [primary, ...chain.filter((p) => p !== primary)];
  if (!ordered.includes("template")) ordered.push("template");

  // localOnly / privacyCritical: strip cloud providers — never fallback silently to cloud
  if (ctx?.localOnly || ctx?.privacyCritical) {
    ordered = ordered.filter((p) => !CLOUD_PROVIDERS.has(p));
  }

  // Apply tool and high-risk policies to every attempt, including fallbacks.
  if (ctx?.requiresTools) {
    ordered = ordered.filter((p) => TOOL_CAPABLE.has(p) || p === "template");
  }
  if (ctx?.riskLevel === "high") {
    ordered = ordered.filter((p) => RISK_SAFE.has(p) || p === "template");
  }

  return ordered;
}
