// Jev Decision Layer — provider adapter for TypeSafe AI's Jev (System One model).
// Spec: docs/specs/prometeo/jev-decision-layer.spec.md §5 / §9.8.
//
// Real API (TypeSafe AI public docs):
//   POST {JEV_BASE_URL=https://api.typesafe.ai}/v1/systemone
//   Authorization: Bearer <JEV_API_KEY>
//   { state, model: "jev-latest", questions: { <id>: { type: "choice", instructions, criteria: { option: description } } } }
//   → { model, answers: { <id>: { type: "choice", choice, probabilities: { option: p }, confidence } }, usage: { input_tokens, output_tokens } }
//
// Each SEMSE decision is ONE `choice` question whose options are exactly the
// feature's allowed actions, so Jev's answer space is the allowlist by
// construction. Callers depend on DecisionProvider, not on HTTP details.
import { REASON_CODE_PATTERN, type StructuredDecision } from "./decision.types.js";

export type DecisionProviderRequest = {
  feature: string;
  allowedActions: readonly string[];
  /** The `choice` question for this feature (instructions + one criterion per allowed action). */
  question?: { instructions: string; criteria: Record<string, string> };
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

/** Question id used in every /v1/systemone call. */
export const JEV_QUESTION_ID = "decision";
export const JEV_DEFAULT_BASE_URL = "https://api.typesafe.ai";
export const JEV_DEFAULT_MODEL = "jev-latest";
/** Published price: $0.042 per million input tokens, output free. */
export const JEV_USD_PER_INPUT_TOKEN = 0.042 / 1_000_000;

/**
 * Maps a /v1/systemone response to the layer's raw decision shape
 * ({ action, confidence, reasonCode }) — still validated afterwards by
 * parseProviderDecision. Returns null when the answer is missing or isn't a
 * choice; confidence prefers Jev's calibrated `confidence` and falls back to
 * the chosen option's probability.
 */
export function mapSystemOneResponse(body: unknown): { action: string; confidence: number; reasonCode: string } | null {
  if (!body || typeof body !== "object") return null;
  const answer = (body as { answers?: Record<string, unknown> }).answers?.[JEV_QUESTION_ID];
  if (!answer || typeof answer !== "object") return null;
  const { type, choice, confidence, probabilities } = answer as {
    type?: unknown;
    choice?: unknown;
    confidence?: unknown;
    probabilities?: Record<string, unknown>;
  };
  if (type !== "choice" || typeof choice !== "string") return null;
  const probability = probabilities && typeof probabilities[choice] === "number" ? (probabilities[choice] as number) : undefined;
  const resolved = typeof confidence === "number" ? confidence : probability;
  if (resolved === undefined) return null;
  // Jev returns typed answers, not rationales; the reason code records that
  // the decision came from Jev's choice distribution.
  return { action: choice, confidence: resolved, reasonCode: "JEV_CHOICE" };
}

export class JevHttpProvider implements DecisionProvider {
  readonly name = "jev";

  constructor(
    private readonly config: { baseUrl: string | null; apiKey: string | null; model: string | null; timeoutMs: number },
    private readonly fetchImpl: typeof fetch = fetch,
  ) {}

  async decide(request: DecisionProviderRequest): Promise<DecisionProviderResult> {
    if (!this.config.apiKey) {
      throw new DecisionProviderError("unavailable", "JEV_API_KEY not configured");
    }
    const baseUrl = this.config.baseUrl ?? JEV_DEFAULT_BASE_URL;
    const criteria =
      request.question?.criteria ?? Object.fromEntries(request.allowedActions.map((action) => [action, action]));
    // Jev reads `state` as the situation to judge: the structured context
    // plus whatever candidates/risk signals the caller declared. Only the
    // allowed actions are offered as options.
    const state = {
      feature: request.feature,
      context: request.input,
      ...(request.candidates ? { candidates: request.candidates } : {}),
      ...(request.riskSignals ? { riskSignals: request.riskSignals } : {}),
    };
    const body = {
      state,
      model: this.config.model ?? JEV_DEFAULT_MODEL,
      questions: {
        [JEV_QUESTION_ID]: {
          type: "choice",
          instructions: request.question?.instructions ?? `Choose the right action for ${request.feature}.`,
          criteria: Object.fromEntries(request.allowedActions.map((action) => [action, criteria[action] ?? action])),
        },
      },
    };
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.config.timeoutMs);
    try {
      const response = await this.fetchImpl(`${baseUrl}/v1/systemone`, {
        method: "POST",
        headers: { "content-type": "application/json", accept: "application/json", authorization: `Bearer ${this.config.apiKey}` },
        body: JSON.stringify(body),
        signal: controller.signal,
      });
      if (response.status === 503 || response.status === 502) {
        throw new DecisionProviderError("unavailable", `Jev returned ${response.status}`);
      }
      if (!response.ok) {
        // e.g. 401 {"detail":{"error_type":"authentication_error",...}} — log the
        // error type only; never the key or the request body.
        const detail = (await response.json().catch(() => null)) as { detail?: { error_type?: unknown } } | null;
        const errorType = typeof detail?.detail?.error_type === "string" ? detail.detail.error_type : "http_error";
        throw new DecisionProviderError("provider_error", `Jev returned ${response.status} (${errorType})`);
      }
      const json = (await response.json().catch(() => null)) as { model?: unknown; usage?: { input_tokens?: unknown } } | null;
      // Jev reports the resolved version, e.g. "jev-1.13.0" for "jev-latest".
      const model = typeof json?.model === "string" ? json.model : this.config.model ?? JEV_DEFAULT_MODEL;
      const inputTokens = json?.usage?.input_tokens;
      const costUsd =
        typeof inputTokens === "number" && Number.isFinite(inputTokens) && inputTokens >= 0
          ? Math.round(inputTokens * JEV_USD_PER_INPUT_TOKEN * 1e9) / 1e9
          : undefined;
      return { raw: mapSystemOneResponse(json), model, costUsd };
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
