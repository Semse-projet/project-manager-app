import { Injectable, Logger } from "@nestjs/common";
import { ProviderMetricsStore } from "../metrics/provider-metrics.store.js";
import type { CopilotRoutingContext, LLMProviderName, TaskType } from "../types.js";

// Providers that support tool calling natively
const TOOL_CAPABLE: ReadonlySet<LLMProviderName> = new Set(["anthropic", "openai"]);
// Providers that can handle sensitive/high-risk tasks
const RISK_SAFE: ReadonlySet<LLMProviderName> = new Set(["anthropic", "openai"]);
// Providers for private/local inference
const PRIVATE: ReadonlySet<LLMProviderName> = new Set(["ollama", "template"]);

@Injectable()
export class AdaptiveRouter {
  private readonly logger = new Logger(AdaptiveRouter.name);

  constructor(private readonly metrics: ProviderMetricsStore) {}

  /**
   * Returns an ordered list of providers to try: best first, template last.
   * Respects hard constraints before applying score-based ranking.
   */
  rank(
    available: LLMProviderName[],
    ctx: CopilotRoutingContext | undefined,
    taskType: TaskType,
  ): LLMProviderName[] {
    if (ctx?.preferredProvider && available.includes(ctx.preferredProvider)) {
      const pref = ctx.preferredProvider;
      const rest = this.rankByScore(
        available.filter((p) => p !== pref && p !== "template"),
        taskType,
      );
      return ([pref, ...rest, "template"] as LLMProviderName[]).filter((p) => available.includes(p));
    }

    const candidates = this.applyHardConstraints(available, ctx);
    const scored = this.rankByScore(candidates.filter((p) => p !== "template"), taskType);
    return ([...scored, "template"] as LLMProviderName[]).filter((p) => available.includes(p));
  }

  inferTaskType(ctx: CopilotRoutingContext | undefined): TaskType {
    if (ctx?.taskType) return ctx.taskType;
    if (ctx?.riskLevel === "high") return "high_risk_action";
    if (ctx?.riskLevel === "low") return "low_risk_action";
    if (ctx?.requiresTools) return "tool_use";
    return "chat";
  }

  // ── Private ───────────────────────────────────────────────────────────────

  private applyHardConstraints(
    providers: LLMProviderName[],
    ctx: CopilotRoutingContext | undefined,
  ): LLMProviderName[] {
    let candidates = [...providers];

    // Privacy: only local providers
    if (ctx?.privacyCritical) {
      const privCandidates = candidates.filter((p) => PRIVATE.has(p));
      if (privCandidates.length > 0) candidates = privCandidates;
    }

    // Tools: only tool-capable providers
    if (ctx?.requiresTools) {
      const toolCandidates = candidates.filter((p) => TOOL_CAPABLE.has(p) || p === "template");
      if (toolCandidates.length > 0) candidates = toolCandidates;
    }

    // High risk: only providers safe for sensitive actions
    if (ctx?.riskLevel === "high") {
      const riskCandidates = candidates.filter((p) => RISK_SAFE.has(p) || p === "template");
      if (riskCandidates.length > 0) candidates = riskCandidates;
    }

    return candidates;
  }

  private rankByScore(providers: LLMProviderName[], taskType: TaskType): LLMProviderName[] {
    const open = providers.filter((p) => this.metrics.isCircuitOpen(p, taskType));
    const eligible = providers.filter((p) => !this.metrics.isCircuitOpen(p, taskType));

    if (open.length > 0) {
      this.logger.warn(`[adaptive] circuit open for: ${open.join(", ")} taskType=${taskType}`);
    }

    const scored = eligible.map((p) => ({ p, score: this.metrics.score(p, taskType) }));
    scored.sort((a, b) => b.score - a.score);

    const ranked = scored.map((s) => s.p);

    if (scored.length > 1) {
      this.logger.debug(
        `[adaptive] ranking taskType=${taskType}: ` +
        scored.map((s) => `${s.p}=${s.score.toFixed(1)}`).join(" > "),
      );
    }

    // Append open-circuit providers at end (last resort before template)
    return [...ranked, ...open];
  }
}
