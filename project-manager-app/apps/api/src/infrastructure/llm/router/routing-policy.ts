import type { CopilotRoutingContext, LLMProviderName } from "../types.js";

export function selectProvider(ctx: CopilotRoutingContext | undefined): LLMProviderName {
  if (!ctx) return resolveDefault();
  if (ctx.preferredProvider) return ctx.preferredProvider;
  if (ctx.localOnly) return "ollama";
  if (ctx.privacyCritical) return "ollama";
  if (ctx.riskLevel === "high") return "anthropic";
  if (ctx.requiresTools) return "anthropic";
  if (ctx.lowCost) return "ollama";
  return resolveDefault();
}

function resolveDefault(): LLMProviderName {
  const env = process.env.LLM_DEFAULT_PROVIDER;
  if (env === "anthropic" || env === "openai" || env === "ollama" || env === "template") {
    return env;
  }
  // Ollama is the native default when LLM_DEFAULT_PROVIDER is not set
  return "ollama";
}

const CLOUD_PROVIDERS: ReadonlySet<LLMProviderName> = new Set(["anthropic", "openai"]);

export function buildFallbackChain(
  primary: LLMProviderName,
  ctx: CopilotRoutingContext | undefined,
): LLMProviderName[] {
  const fromEnv = (process.env.LLM_FALLBACK_PROVIDERS ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter((s): s is LLMProviderName => s === "anthropic" || s === "openai" || s === "ollama" || s === "template");

  const chain: LLMProviderName[] = ctx?.fallbackOrder ?? fromEnv;

  // Ensure primary is first, template is last, no duplicates
  let ordered = [primary, ...chain.filter((p) => p !== primary)];
  if (!ordered.includes("template")) ordered.push("template");

  // localOnly / privacyCritical: strip cloud providers — never fallback silently to cloud
  if (ctx?.localOnly || ctx?.privacyCritical) {
    ordered = ordered.filter((p) => !CLOUD_PROVIDERS.has(p));
  }

  return ordered;
}
