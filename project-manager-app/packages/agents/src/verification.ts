/**
 * @semse/agents — verification.ts
 *
 * SPEC-AGT-001 (bloque AGT-001-A): contratos del Verification Loop.
 * Deriva de ADR-021 (Anatomía del Agente SEMSE).
 *
 * Solo tipos y constantes — cero impacto de runtime. El loop que consume
 * estos contratos se implementa en AGT-001-C (`executeGovernedAgentRun`).
 */

// ─────────────────────────────────────────────────────────────
// VERIFICADORES
// ─────────────────────────────────────────────────────────────

/**
 * Verificadores disponibles. Regla ADR-021 §6: los verificadores son los
 * mismos comandos de CI (nunca checks ad-hoc del agente). La implementación
 * (AGT-001-B) reutiliza el patrón spawnSync de packages/autonomy/validator.
 */
export const verifierNames = [
  "verify.typecheck",
  "verify.lint",
  "verify.unit_tests",
  "verify.build",
  "verify.schema",
  "verify.custom"
] as const;

export type VerifierName = (typeof verifierNames)[number];

export type VerificationAttemptStatus = "pass" | "fail" | "skipped" | "error";

// ─────────────────────────────────────────────────────────────
// PRESUPUESTO (Principio P2 — ADR-021)
// ─────────────────────────────────────────────────────────────

export type VerificationBudget = {
  /** Iteraciones actuar→verificar→corregir. Default 3, techo duro 5. */
  maxIterations: number;
  /** Presupuesto total de tokens LLM del loop (opcional en v1). */
  maxTokens?: number;
  /** Techo temporal del loop completo en milisegundos. */
  timeoutMs?: number;
  /** Verificadores que deben pasar para declarar el run como verificado. */
  successCriteria: VerifierName[];
};

export const DEFAULT_MAX_ITERATIONS = 3;
export const HARD_MAX_ITERATIONS = 5;
export const DEFAULT_VERIFICATION_TIMEOUT_MS = 10 * 60 * 1000;

/** Razón de policy `deny` cuando un run de escritura llega sin budget. */
export const MISSING_VERIFICATION_BUDGET_REASON = "missing_verification_budget";

export function createDefaultVerificationBudget(
  successCriteria: VerifierName[]
): VerificationBudget {
  return {
    maxIterations: DEFAULT_MAX_ITERATIONS,
    timeoutMs: DEFAULT_VERIFICATION_TIMEOUT_MS,
    successCriteria
  };
}

/** Normaliza un budget aplicando el techo duro de iteraciones. */
export function clampVerificationBudget(budget: VerificationBudget): VerificationBudget {
  return {
    ...budget,
    maxIterations: Math.max(1, Math.min(budget.maxIterations, HARD_MAX_ITERATIONS))
  };
}

// ─────────────────────────────────────────────────────────────
// REPORTE
// ─────────────────────────────────────────────────────────────

export type VerificationAttempt = {
  /** Iteración del loop (1-indexed). */
  iteration: number;
  verifier: VerifierName;
  status: VerificationAttemptStatus;
  durationMs: number;
  /** stderr/stdout truncado. Máx EVIDENCE_MAX_BYTES. */
  evidence?: string;
};

export const EVIDENCE_MAX_BYTES = 4096;

export type VerificationFinalStatus = "verified" | "exhausted" | "not_applicable";

export type VerificationReport = {
  budget: VerificationBudget;
  attempts: VerificationAttempt[];
  finalStatus: VerificationFinalStatus;
  iterationsUsed: number;
  tokensUsed?: number;
};

// ─────────────────────────────────────────────────────────────
// ACCIONES DE ESCRITURA (qué runs entran al loop)
// ─────────────────────────────────────────────────────────────

/**
 * actionTypes que implican mutación y por tanto exigen verificación.
 * Los runs de solo lectura/análisis (pricing, risk, trust-match) no verifican.
 */
export const WRITE_ACTION_TYPES = new Set<string>([
  "code.write",
  "file.write",
  "data.write",
  "config.write",
  "doc.write"
]);

export function isWriteActionType(actionType: string): boolean {
  return WRITE_ACTION_TYPES.has(actionType) || actionType.endsWith(".write");
}

// ─────────────────────────────────────────────────────────────
// DELEGACIÓN TIPADA (GAP-2 — SPEC-AGT-001 §4)
// ─────────────────────────────────────────────────────────────

/**
 * `explore`: solo lectura + verificación, no puede escribir.
 * `general`: hereda el manifest del rol delegado, con sub-budget propio.
 */
export type DelegateProfile = "explore" | "general";

export const delegateProfiles = ["explore", "general"] as const;

/** Techo de delegaciones concurrentes por run (rate limits + costo). */
export const MAX_CONCURRENT_DELEGATES = 4;

/** Fracción máxima del budget del padre que puede recibir un delegado `general`. */
export const DELEGATE_BUDGET_RATIO = 0.5;
