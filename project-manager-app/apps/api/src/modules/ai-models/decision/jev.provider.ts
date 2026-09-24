// Jev Decision Layer — provider adapter.
// Spec: docs/specs/prometeo/jev-decision-layer.spec.md §5.
//
// ASSUMPTION: Jev's real API is not documented anywhere in this repo or the
// product owner's Drive. This adapter defines the contract SEMSE expects
// (POST {JEV_BASE_URL}/v1/decide). If Jev's API differs, only this file
// changes — callers depend on DecisionProvider, not on HTTP details.
import { REASON_CODE_PATTERN, type StructuredDecision } from "./decision.types.js";

export type DecisionProviderRequest = {
  feature: string;
  allowedActions: readonly string[];
  input: Record<string, unknown>;
  candidates?: unknown[];
  riskSignals?: Record<string, boolean>;
  correlationId?: string;
  // The deterministic baseline is deliberately NOT sent: shadow agreement is
  // only meaningful if Jev decides independently of it.
};

export type DecisionProviderResult = { raw: unknown; model?: string; costUsd?: number };

export type DecisionProviderErrorKind = "unavailable" | "timeout" | "provider_error";

export class DecisionProviderError extends Error {
  constructor(public readonly kind: DecisionProviderErrorKind, message: string) {
    super(message);
    this.name = "DecisionProviderError";
  }
}

export interface DecisionProvider {
  readonly name: string;
  decide(request: DecisionProviderRequest): Promise<DecisionProviderResult>;
}

/**
 * Strict shape check. Anything off-contract — unknown action, confidence
 * outside [0,1], missing/free-text reason code, extra wrapping — is rejected
 * rather than "repaired", so a misbehaving model can only ever cause a
 * fallback, never a surprising action.
 */
export function parseProviderDecision(
  raw: unknown,
  allowedActions: readonly string[],
): StructuredDecision<string> | null {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const { action, confidence, reasonCode } = raw as Record<string, unknown>;
  if (typeof action !== "string" || !allowedActions.includes(action)) return null;
  if (typeof confidence !== "number" || !Number.isFinite(confidence) || confidence < 0 || confidence > 1) return null;
  if (typeof reasonCode !== "string" || !REASON_CODE_PATTERN.test(reasonCode)) return null;
  return { action, confidence, reasonCode };
}

export class JevHttpProvider implements DecisionProvider {
  readonly name = "jev";

  constructor(
    private readonly config: { baseUrl: string | null; apiKey: string | null; model: string | null; timeoutMs: number },
    private readonly fetchImpl: typeof fetch = fetch,
  ) {}

  async decide(request: DecisionProviderRequest): Promise<DecisionProviderResult> {
    if (!this.config.baseUrl || !this.config.apiKey) {
      throw new DecisionProviderError("unavailable", "JEV_BASE_URL/JEV_API_KEY not configured");
    }
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.config.timeoutMs);
    try {
      const response = await this.fetchImpl(`${this.config.baseUrl}/v1/decide`, {
        method: "POST",
        headers: { "content-type": "application/json", authorization: `Bearer ${this.config.apiKey}` },
        body: JSON.stringify({ ...request, ...(this.config.model ? { model: this.config.model } : {}) }),
        signal: controller.signal,
      });
      if (response.status === 503 || response.status === 502) {
        throw new DecisionProviderError("unavailable", `Jev returned ${response.status}`);
      }
      if (!response.ok) throw new DecisionProviderError("provider_error", `Jev returned ${response.status}`);
      const raw = (await response.json().catch(() => null)) as unknown;
      const meta = raw && typeof raw === "object" ? (raw as { model?: unknown; version?: unknown; costUsd?: unknown }) : {};
      const baseModel = typeof meta.model === "string" ? meta.model : this.config.model ?? undefined;
      // provider/model/version for telemetry (handoff §55): "model@version" when Jev reports one.
      const model = baseModel && typeof meta.version === "string" ? `${baseModel}@${meta.version}` : baseModel;
      const costUsd = typeof meta.costUsd === "number" && Number.isFinite(meta.costUsd) && meta.costUsd >= 0 ? meta.costUsd : undefined;
      return { raw, model, costUsd };
    } catch (error) {
      if (error instanceof DecisionProviderError) throw error;
      if ((error as { name?: string })?.name === "AbortError") {
        throw new DecisionProviderError("timeout", `Jev exceeded ${this.config.timeoutMs}ms`);
      }
      throw new DecisionProviderError("unavailable", (error as Error)?.message ?? "Jev request failed");
    } finally {
      clearTimeout(timer);
    }
  }
}
