// Jev Decision Layer — provider adapter for Jev AI (jev-ai.pro, System One).
// Spec: docs/specs/prometeo/jev-decision-layer.spec.md §5 / §9.9.
//
// Transport, auth, typed answers and typed errors live in JevAiClient
// (jev-ai.client.ts). Each SEMSE decision is ONE `choice` question whose
// options are exactly the feature's allowed actions, so Jev's answer space is
// the allowlist by construction. Callers depend on DecisionProvider, not on
// HTTP details.
import { REASON_CODE_PATTERN, type StructuredDecision } from "./decision.types.js";
import { JevAiClient, JevAiError, JEV_AI_DEFAULT_BASE_URL, JEV_AI_DEFAULT_MODEL, type JevAiErrorKind } from "./jev-ai.client.js";

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
  constructor(
    public readonly kind: DecisionProviderErrorKind,
    message: string,
    /** Underlying Jev AI error kind (401/402/422/429/502/504...), for diagnostics. */
    public readonly jevAiKind?: JevAiErrorKind,
  ) {
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
export const JEV_DEFAULT_BASE_URL = JEV_AI_DEFAULT_BASE_URL;
export const JEV_DEFAULT_MODEL = JEV_AI_DEFAULT_MODEL;
/** Price used for the telemetry cost estimate: $0.042 per million input tokens, output free. */
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

/** How each Jev AI failure resolves in the decision layer (all fall back to the deterministic decision). */
const FALLBACK_KIND: Record<JevAiErrorKind, DecisionProviderErrorKind | "invalid_response"> = {
  not_configured: "unavailable",
  unauthorized: "provider_error",
  payment_required: "provider_error",
  invalid_request: "provider_error",
  input_too_long: "provider_error",
  rate_limited: "unavailable",
  bad_gateway: "unavailable",
  gateway_timeout: "timeout",
  server_error: "unavailable",
  http_error: "provider_error",
  timeout: "timeout",
  network: "unavailable",
  invalid_response: "invalid_response",
};

export class JevHttpProvider implements DecisionProvider {
  readonly name = "jev";
  private readonly client: JevAiClient;

  constructor(
    config: { baseUrl: string | null; apiKey: string | null; model: string | null; timeoutMs: number },
    fetchImpl: typeof fetch = fetch,
  ) {
    // Decisions sit on a request path with a tight timeout: no 429 retries here.
    this.client = new JevAiClient({ ...config, maxRateLimitRetryMs: 0 }, fetchImpl);
  }

  async decide(request: DecisionProviderRequest): Promise<DecisionProviderResult> {
    const criteria =
      request.question?.criteria ?? Object.fromEntries(request.allowedActions.map((action) => [action, action]));
    // Jev reads `state` as the situation to judge: the structured context
    // plus whatever candidates/risk signals the caller declared. Only the
    // allowed actions are offered as options.
    const state = JSON.stringify({
      feature: request.feature,
      context: request.input,
      ...(request.candidates ? { candidates: request.candidates } : {}),
      ...(request.riskSignals ? { riskSignals: request.riskSignals } : {}),
    });
    const questions = {
      [JEV_QUESTION_ID]: {
        type: "choice" as const,
        instructions: request.question?.instructions ?? `Choose the right action for ${request.feature}.`,
        criteria: Object.fromEntries(request.allowedActions.map((action) => [action, criteria[action] ?? action])),
      },
    };
    try {
      const response = await this.client.systemOne({ state, questions });
      const inputTokens = response.usage.input_tokens;
      const costUsd = inputTokens !== undefined ? Math.round(inputTokens * JEV_USD_PER_INPUT_TOKEN * 1e9) / 1e9 : undefined;
      // Jev reports the resolved version, e.g. "jev-1.13.0" for "jev-latest".
      return { raw: mapSystemOneResponse(response), model: response.model, costUsd };
    } catch (error) {
      if (!(error instanceof JevAiError)) throw new DecisionProviderError("unavailable", "Jev AI request failed");
      const kind = FALLBACK_KIND[error.kind];
      // Off-contract body → the layer records invalid_response (doesn't trip the breaker).
      if (kind === "invalid_response") return { raw: null };
      // error.message never contains the key or the request body.
      throw new DecisionProviderError(kind, error.message, error.kind);
    }
  }
}
