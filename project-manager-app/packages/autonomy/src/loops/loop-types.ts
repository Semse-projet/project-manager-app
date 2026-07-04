/**
 * @semse/autonomy — loops/loop-types.ts
 *
 * SPEC-AUT-001 (bloque AUT-001-A): contratos de los Permanent Loops.
 * Deriva de ADR-021 (GAP-3). Los loops proponen, nunca mergean (P4).
 */

export interface PermanentLoopBudget {
  /** Presupuesto de tokens LLM por ciclo (fase mecánica: 0). */
  maxTokens: number;
  /** PRs/propuestas máximas por ciclo. */
  maxProposals: number;
  /** Techo temporal del ciclo completo. */
  timeoutMs: number;
}

export interface PermanentLoopStopCriteria {
  /** Si hay N propuestas suyas abiertas sin revisar → SKIP ciclo (backpressure humano). */
  maxOpenProposals: number;
  /** N rechazos seguidos sobre un target → target en blacklist. */
  cooldownAfterRejections: number;
  /** Días que dura la blacklist de un target rechazado. */
  cooldownDays: number;
  /** Hallazgos bajo el umbral no generan propuesta, solo registro. */
  minConfidence: number;
}

export interface PermanentLoopDefinition {
  /** "loop.dedup-abstractions" | "loop.spec-drift" | ... */
  id: string;
  /** Rol registrado en packages/agents. */
  agentType: string;
  /** Cron (BullMQ repeatable job). */
  schedule: string;
  /** Globs de paths que puede leer. */
  scope: string[];
  budgetPerCycle: PermanentLoopBudget;
  stopCriteria: PermanentLoopStopCriteria;
  /** Métrica OMEGA que justifica su existencia. */
  successMetric: string;
}

export type LoopFindingKind =
  | "dedup.candidate"
  | "drift.missing_path"
  | "drift.missing_test"
  | "drift.done_without_tests"
  | "drift.missing_command"
  | "drift.invalid_status";

export interface LoopFinding {
  loopId: string;
  /** Identificador estable del hallazgo (para memoria de rechazos). */
  target: string;
  kind: LoopFindingKind;
  confidence: number;
  rationale: string;
  evidence?: Record<string, unknown>;
}

export type LoopCycleStatus =
  | "completed"
  | "skipped_disabled"
  | "skipped_paused"
  | "skipped_backpressure"
  | "skipped_no_repo"
  | "failed";

export interface LoopAuditEvent {
  type: string;
  status: "ok" | "warn" | "error";
  timestamp: string;
  detail: Record<string, unknown>;
}

export interface LoopSuppressedFinding {
  target: string;
  reason: "below_min_confidence" | "recently_rejected" | "over_proposal_budget";
}

export interface LoopCycleReport {
  loopId: string;
  status: LoopCycleStatus;
  startedAt: string;
  finishedAt: string;
  durationMs: number;
  /** Todo lo detectado (se registra en agent_decisions como "recorded"). */
  findings: LoopFinding[];
  /** Subconjunto sobre umbral, no rechazado, dentro de maxProposals → candidatos a propuesta. */
  proposalsPlanned: LoopFinding[];
  suppressed: LoopSuppressedFinding[];
  auditEvents: LoopAuditEvent[];
  metrics: Record<string, number>;
  /** Artefacto opcional (p.ej. spec-health.md del loop de drift). */
  artifacts?: Record<string, string>;
}

/** Puertos inyectables — el runner no conoce DB ni Redis (los tests tampoco). */
export interface LoopControlPort {
  /** Kill switch global (AUTONOMY_LOOPS_ENABLED). */
  isEnabled(): boolean | Promise<boolean>;
  /** Pausa por loop (endpoint admin pause/resume). */
  isPaused(loopId: string): boolean | Promise<boolean>;
  /** Propuestas abiertas sin revisar de este loop (backpressure humano). */
  openProposalCount(loopId: string): number | Promise<number>;
}

export interface LoopDecisionMemoryPort {
  /** Targets rechazados dentro del cooldown — el loop no los re-propone. */
  recentlyRejectedTargets(loopId: string, cooldownDays: number): Promise<string[]> | string[];
}

export interface LoopAnalyzerContext {
  repoRoot: string;
  definition: PermanentLoopDefinition;
}

/** Analizador mecánico de un loop: produce hallazgos sin efectos secundarios. */
export type LoopAnalyzer = (ctx: LoopAnalyzerContext) => LoopFinding[];
