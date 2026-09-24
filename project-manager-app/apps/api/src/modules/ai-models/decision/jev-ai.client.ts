// Jev AI (jev-ai.pro) HTTP client — typed System One requests, typed answers,
// typed errors. Server-side only: the key comes from JEV_AI_API_KEY and is
// never logged, echoed in errors or sent anywhere but the Authorization header.
// Spec: docs/specs/prometeo/jev-decision-layer.spec.md §9.9.
//
//   POST {JEV_AI_BASE_URL=https://jev-ai.pro/api}/v1/systemone
//   Authorization: Bearer $JEV_AI_API_KEY
//   { model: "jev-latest", state: "My payment failed. Please help.",
//     questions: { urgent: { type: "noul", instructions: "Does this message need urgent support?" } } }
//   → { model, answers: { urgent: { type: "noul", noul: 0.93 } }, usage: { input_tokens, output_tokens, ... } }
//
//   GET {base}/v1/models → the models connected to this key.
//
// Retry policy: a POST is never retried when its outcome is uncertain
// (timeout, network error, 5xx). A 429 means the request was not processed:
// the client honours Retry-After by refusing calls locally until it expires,
// and only retries once when the caller explicitly opts in with a budget.

export const JEV_AI_DEFAULT_BASE_URL = "https://jev-ai.pro/api";
export const JEV_AI_DEFAULT_MODEL = "jev-latest";

/** Laya models share the endpoint and key but cap each question's input (tokens). */
export const LAYA_INPUT_TOKEN_LIMITS: Readonly<Record<string, number>> = {
  "laya-english": 512,
  "laya-multilingual": 1024,
};

const DEFAULT_RATE_LIMIT_COOLDOWN_MS = 1_000;
const MAX_RETRY_AFTER_MS = 3_600_000;

// ── Request types ───────────────────────────────────────────────────────────

export type JevAiNoulQuestion = { type: "noul"; instructions: string };
export type JevAiChoiceQuestion = { type: "choice"; instructions: string; criteria: Record<string, string> };
/** Score questions: extra fields documented at jev-ai.pro/docs are passed through unchanged. */
export type JevAiScoreQuestion = { type: "score"; instructions: string; [field: string]: unknown };
export type JevAiQuestion = JevAiNoulQuestion | JevAiChoiceQuestion | JevAiScoreQuestion;

export type JevAiSystemOneRequest<Q extends Record<string, JevAiQuestion> = Record<string, JevAiQuestion>> = {
  model?: string;
  state: string;
  questions: Q;
};

// ── Response types ──────────────────────────────────────────────────────────

/** `noul`: probability (0–1) that the answer is yes. */
export type JevAiNoulAnswer = { type: "noul"; noul: number };
export type JevAiChoiceAnswer = {
  type: "choice";
  choice: string;
  probabilities: Record<string, number>;
  confidence?: number;
};
export type JevAiScoreAnswer = {
  type: "score";
  score?: number;
  probabilities: Record<string, number>;
  confidence?: number;
};
export type JevAiAnswer = JevAiNoulAnswer | JevAiChoiceAnswer | JevAiScoreAnswer;

type AnswerFor<Q extends JevAiQuestion> = Q extends { type: "noul" }
  ? JevAiNoulAnswer
  : Q extends { type: "choice" }
    ? JevAiChoiceAnswer
    : JevAiScoreAnswer;

export type JevAiUsage = {
  input_tokens?: number;
  output_tokens?: number;
  reasoning_tokens?: number;
  cached_tokens?: number;
  n_calls?: number;
  n_retries?: number;
  latency?: number;
};

export type JevAiSystemOneResponse<Q extends Record<string, JevAiQuestion> = Record<string, JevAiQuestion>> = {
  model: string;
  answers: { [K in keyof Q]: AnswerFor<Q[K]> };
  usage: JevAiUsage;
};

// ── Errors ──────────────────────────────────────────────────────────────────

export type JevAiErrorKind =
  | "not_configured" // no JEV_AI_API_KEY
  | "unauthorized" // 401: key missing/invalid/revoked
  | "payment_required" // 402: no credits left
  | "invalid_request" // 422: body rejected (e.g. Laya input over the limit)
  | "input_too_long" // rejected locally before sending (Laya pre-flight)
  | "rate_limited" // 429 (or local cooldown from a previous 429)
  | "bad_gateway" // 502
  | "gateway_timeout" // 504
  | "server_error" // other 5xx
  | "http_error" // other non-2xx
  | "timeout" // client-side timeout
  | "network" // fetch failed
  | "invalid_response"; // 2xx with a body that doesn't match the contract

export class JevAiError extends Error {
  readonly kind: JevAiErrorKind;
  readonly status?: number;
  /** Server-provided error type, e.g. "authentication_error". */
  readonly errorType?: string;
  /** How long to wait before calling again (429 only). */
  readonly retryAfterMs?: number;
  /**
   * True when the POST may have been processed (and billed) by Jev AI:
   * timeouts, network failures after sending, and 5xx. Never retry these
   * automatically.
   */
  readonly outcomeUncertain: boolean;
  /** True only when repeating the same call later is known to be safe. */
  readonly retryable: boolean;

  constructor(
    kind: JevAiErrorKind,
    message: string,
    extra: { status?: number; errorType?: string; retryAfterMs?: number; outcomeUncertain?: boolean; retryable?: boolean } = {},
  ) {
    super(message);
    this.name = "JevAiError";
    this.kind = kind;
    this.status = extra.status;
    this.errorType = extra.errorType;
    this.retryAfterMs = extra.retryAfterMs;
    this.outcomeUncertain = extra.outcomeUncertain ?? false;
    this.retryable = extra.retryable ?? false;
  }
}

const STATUS_MESSAGES: Record<number, [JevAiErrorKind, string]> = {
  401: ["unauthorized", "Jev AI rejected the API key (401). Check JEV_AI_API_KEY on the server."],
  402: ["payment_required", "Jev AI account has no credits left (402). Top up before retrying."],
  422: ["invalid_request", "Jev AI rejected the request body (422)."],
  429: ["rate_limited", "Jev AI rate limit reached (429)."],
  502: ["bad_gateway", "Jev AI upstream error (502); the request may or may not have been processed."],
  504: ["gateway_timeout", "Jev AI upstream timeout (504); the request may or may not have been processed."],
};

/** Parses Retry-After (delta-seconds or HTTP-date) into milliseconds from `now`. */
export function parseRetryAfter(value: string | null | undefined, now = Date.now()): number | undefined {
  if (!value) return undefined;
  const trimmed = value.trim();
  if (/^\d+(\.\d+)?$/.test(trimmed)) return Math.min(Math.round(Number(trimmed) * 1000), MAX_RETRY_AFTER_MS);
  const date = Date.parse(trimmed);
  if (Number.isNaN(date)) return undefined;
  return Math.min(Math.max(date - now, 0), MAX_RETRY_AFTER_MS);
}

/** Extracts a short error type/message from the known error body shapes, never the request. */
function readErrorBody(body: unknown): { errorType?: string; message?: string } {
  if (!body || typeof body !== "object") return {};
  const b = body as Record<string, any>;
  const nested = [b.detail, b.error].find((v) => v && typeof v === "object" && !Array.isArray(v)) as Record<string, unknown> | undefined;
  const pick = (...values: unknown[]) => values.find((v): v is string => typeof v === "string" && v.length > 0);
  const errorType = pick(nested?.error_type, nested?.type, nested?.code, b.error_type, b.code, typeof b.error === "string" ? b.error : undefined);
  const message = pick(nested?.message, b.message, typeof b.detail === "string" ? b.detail : undefined);
  // Server messages can quote input on validation errors: keep them short.
  return { errorType: errorType?.slice(0, 64), message: message?.slice(0, 200) };
}

// ── Response parsing ────────────────────────────────────────────────────────

const isProbability = (value: unknown): value is number =>
  typeof value === "number" && Number.isFinite(value) && value >= 0 && value <= 1;

function readProbabilities(value: unknown): Record<string, number> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const entries = Object.entries(value as Record<string, unknown>);
  if (!entries.every(([, p]) => isProbability(p))) return null;
  return Object.fromEntries(entries) as Record<string, number>;
}

/** Validates one answer against the question type that was asked; null when off-contract. */
export function parseJevAiAnswer(question: JevAiQuestion, raw: unknown): JevAiAnswer | null {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const answer = raw as Record<string, unknown>;
  if (answer.type !== undefined && answer.type !== question.type) return null;
  const confidence = isProbability(answer.confidence) ? answer.confidence : undefined;
  if (answer.confidence !== undefined && confidence === undefined) return null;
  switch (question.type) {
    case "noul":
      return isProbability(answer.noul) ? { type: "noul", noul: answer.noul } : null;
    case "choice": {
      const probabilities = readProbabilities(answer.probabilities ?? {});
      if (typeof answer.choice !== "string" || !probabilities) return null;
      if (!Object.prototype.hasOwnProperty.call(question.criteria, answer.choice)) return null;
      return { type: "choice", choice: answer.choice, probabilities, ...(confidence !== undefined ? { confidence } : {}) };
    }
    case "score": {
      const probabilities = readProbabilities(answer.probabilities ?? {});
      const score = typeof answer.score === "number" && Number.isFinite(answer.score) ? answer.score : undefined;
      if (!probabilities || (score === undefined && Object.keys(probabilities).length === 0)) return null;
      return { type: "score", ...(score !== undefined ? { score } : {}), probabilities, ...(confidence !== undefined ? { confidence } : {}) };
    }
    default:
      return null;
  }
}

function readUsage(value: unknown): JevAiUsage {
  if (!value || typeof value !== "object") return {};
  const usage: JevAiUsage = {};
  for (const key of ["input_tokens", "output_tokens", "reasoning_tokens", "cached_tokens", "n_calls", "n_retries", "latency"] as const) {
    const n = (value as Record<string, unknown>)[key];
    if (typeof n === "number" && Number.isFinite(n) && n >= 0) usage[key] = n;
  }
  return usage;
}

/**
 * Validates a /v1/systemone body against the questions that were asked.
 * Throws invalid_response when any requested answer is missing or malformed.
 */
export function parseSystemOneResponse<Q extends Record<string, JevAiQuestion>>(
  questions: Q,
  body: unknown,
  requestedModel: string,
): JevAiSystemOneResponse<Q> {
  const answers = (body as { answers?: unknown } | null)?.answers;
  if (!answers || typeof answers !== "object") {
    throw new JevAiError("invalid_response", "Jev AI response has no answers object");
  }
  const parsed: Record<string, JevAiAnswer> = {};
  for (const [id, question] of Object.entries(questions)) {
    const answer = parseJevAiAnswer(question, (answers as Record<string, unknown>)[id]);
    if (!answer) throw new JevAiError("invalid_response", `Jev AI answer '${id}' is missing or not a valid ${question.type}`);
    parsed[id] = answer;
  }
  const model = (body as { model?: unknown }).model;
  return {
    model: typeof model === "string" && model ? model : requestedModel,
    answers: parsed as JevAiSystemOneResponse<Q>["answers"],
    usage: readUsage((body as { usage?: unknown }).usage),
  };
}

/** Accepts the common list shapes and keeps only entries not marked disconnected/unavailable. */
export function parseModelsResponse(body: unknown): string[] {
  const list = Array.isArray(body)
    ? body
    : Array.isArray((body as { data?: unknown })?.data)
      ? (body as { data: unknown[] }).data
      : Array.isArray((body as { models?: unknown })?.models)
        ? (body as { models: unknown[] }).models
        : null;
  if (!list) throw new JevAiError("invalid_response", "Jev AI /v1/models response is not a model list");
  const ids = list.flatMap((entry) => {
    if (typeof entry === "string") return [entry];
    if (!entry || typeof entry !== "object") return [];
    const e = entry as Record<string, unknown>;
    if (e.connected === false || e.available === false || e.enabled === false) return [];
    const id = [e.id, e.name, e.model].find((v): v is string => typeof v === "string" && v.length > 0);
    return id ? [id] : [];
  });
  return [...new Set(ids)];
}

/**
 * Conservative token estimate (≈3 characters per token) used only for the
 * Laya pre-flight; the server's own count is authoritative (it answers 422).
 */
export function estimateTokens(text: string): number {
  return Math.ceil(text.length / 3);
}

function questionText(question: JevAiQuestion): string {
  const { type: _type, ...rest } = question;
  return JSON.stringify(rest);
}

// ── Client ──────────────────────────────────────────────────────────────────

export type JevAiClientConfig = {
  baseUrl?: string | null;
  apiKey: string | null;
  model?: string | null;
  timeoutMs: number;
  /**
   * Opt-in: when a 429 asks to wait at most this long, sleep and retry once.
   * 0 (default) never retries; the caller gets rate_limited + retryAfterMs.
   */
  maxRateLimitRetryMs?: number;
};

export class JevAiClient {
  private rateLimitedUntil = 0;

  constructor(
    private readonly config: JevAiClientConfig,
    private readonly fetchImpl: typeof fetch = fetch,
    private readonly now: () => number = Date.now,
    private readonly sleep: (ms: number) => Promise<void> = (ms) => new Promise((r) => setTimeout(r, ms)),
  ) {}

  get configured(): boolean {
    return Boolean(this.config.apiKey);
  }

  get defaultModel(): string {
    return this.config.model || JEV_AI_DEFAULT_MODEL;
  }

  private url(path: string): string {
    return `${(this.config.baseUrl || JEV_AI_DEFAULT_BASE_URL).replace(/\/+$/, "")}${path}`;
  }

  private headers(): Record<string, string> {
    if (!this.config.apiKey) throw new JevAiError("not_configured", "JEV_AI_API_KEY is not configured on the server");
    return { authorization: `Bearer ${this.config.apiKey}`, accept: "application/json" };
  }

  private checkCooldown(): void {
    const wait = this.rateLimitedUntil - this.now();
    if (wait > 0) {
      throw new JevAiError("rate_limited", `Jev AI rate limit: wait ${Math.ceil(wait / 1000)}s (Retry-After)`, {
        status: 429,
        retryAfterMs: wait,
        retryable: true,
      });
    }
  }

  private async send(path: string, init: RequestInit): Promise<unknown> {
    this.checkCooldown();
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.config.timeoutMs);
    let response: Response;
    try {
      response = await this.fetchImpl(this.url(path), { ...init, signal: controller.signal });
    } catch (error) {
      clearTimeout(timer);
      const isPost = init.method === "POST";
      if ((error as { name?: string })?.name === "AbortError") {
        throw new JevAiError("timeout", `Jev AI did not answer within ${this.config.timeoutMs}ms`, { outcomeUncertain: isPost });
      }
      throw new JevAiError("network", "Jev AI request failed before a response was received", { outcomeUncertain: isPost });
    }
    try {
      if (response.ok) {
        const body = await response.json().catch(() => undefined);
        if (body === undefined) throw new JevAiError("invalid_response", "Jev AI returned a non-JSON body");
        return body;
      }
      const { errorType, message } = readErrorBody(await response.json().catch(() => null));
      const [kind, base] = STATUS_MESSAGES[response.status] ?? [
        response.status >= 500 ? "server_error" : "http_error",
        `Jev AI returned HTTP ${response.status}.`,
      ];
      const detail = [errorType, message].filter(Boolean).join(": ");
      const text = detail ? `${base} ${detail}` : base;
      if (response.status === 429) {
        const retryAfterMs = parseRetryAfter(response.headers.get("retry-after"), this.now()) ?? DEFAULT_RATE_LIMIT_COOLDOWN_MS;
        this.rateLimitedUntil = this.now() + retryAfterMs;
        throw new JevAiError(kind, `${text} Retry after ${Math.ceil(retryAfterMs / 1000)}s.`, {
          status: 429,
          errorType,
          retryAfterMs,
          retryable: true,
        });
      }
      throw new JevAiError(kind, text, { status: response.status, errorType, outcomeUncertain: response.status >= 500 && init.method === "POST" });
    } finally {
      clearTimeout(timer);
    }
  }

  /** Throws input_too_long when a Laya question would exceed its per-question input limit. */
  assertWithinModelLimits(request: JevAiSystemOneRequest): void {
    const model = request.model || this.defaultModel;
    const limit = LAYA_INPUT_TOKEN_LIMITS[model];
    if (!limit) return;
    const stateTokens = estimateTokens(request.state);
    for (const [id, question] of Object.entries(request.questions)) {
      const estimate = stateTokens + estimateTokens(questionText(question));
      if (estimate > limit) {
        throw new JevAiError(
          "input_too_long",
          `Question '${id}' is ~${estimate} tokens with its state; ${model} allows ${limit} per question. Shorten the state or instructions.`,
        );
      }
    }
  }

  async systemOne<Q extends Record<string, JevAiQuestion>>(request: JevAiSystemOneRequest<Q>): Promise<JevAiSystemOneResponse<Q>> {
    const model = request.model || this.defaultModel;
    const body = { model, state: request.state, questions: request.questions };
    this.assertWithinModelLimits(body);
    const init: RequestInit = {
      method: "POST",
      headers: { ...this.headers(), "content-type": "application/json" },
      body: JSON.stringify(body),
    };
    let json: unknown;
    try {
      json = await this.send("/v1/systemone", init);
    } catch (error) {
      // A 429 was not processed, so one retry is safe — but only within the
      // caller's explicit budget, and only after the full Retry-After.
      const budget = this.config.maxRateLimitRetryMs ?? 0;
      if (error instanceof JevAiError && error.kind === "rate_limited" && error.status === 429 && (error.retryAfterMs ?? Infinity) <= budget) {
        await this.sleep(error.retryAfterMs ?? 0);
        json = await this.send("/v1/systemone", init);
      } else {
        throw error;
      }
    }
    return parseSystemOneResponse(request.questions, json, model);
  }

  /** Models connected to this key, exactly as Jev AI reports them (no hardcoded list). */
  async listModels(): Promise<string[]> {
    return parseModelsResponse(await this.send("/v1/models", { method: "GET", headers: this.headers() }));
  }
}
