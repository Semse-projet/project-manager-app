/**
 * SPEC-AUT-001 §2 — runner de un ciclo de permanent loop.
 *
 * Reglas duras del scheduler:
 *   1. Backpressure humano: openProposals ≥ maxOpenProposals → SKIP auditado.
 *   2. Memoria de rechazos: lo rechazado en cooldown no se re-propone.
 *   3. Kill switch: enabled/paused se comprueba al inicio Y entre etapas
 *      (un ciclo en curso se detiene en <30s — criterio de aceptación 4).
 *   4. Cero merges automáticos: el runner solo produce hallazgos y candidatos
 *      a propuesta; no existe ruta de código hacia merge (P4).
 *
 * Sin dependencias de DB/Redis: todo entra por puertos inyectables.
 */
import { existsSync } from "node:fs";
import { join } from "node:path";
import type {
  LoopAnalyzer,
  LoopAuditEvent,
  LoopControlPort,
  LoopCycleReport,
  LoopDecisionMemoryPort,
  LoopFinding,
  LoopSuppressedFinding,
  PermanentLoopDefinition
} from "./loop-types.js";
import { analyzeDedupAbstractions } from "./dedup-loop.js";
import { analyzeSpecDrift, buildSpecHealthReport } from "./spec-drift-loop.js";

export interface LoopRunnerDeps {
  control: LoopControlPort;
  memory: LoopDecisionMemoryPort;
  repoRoot: string;
  now?: () => Date;
}

const LOOP_ANALYZERS: Record<string, LoopAnalyzer> = {
  "loop.dedup-abstractions": analyzeDedupAbstractions,
  "loop.spec-drift": analyzeSpecDrift
};

function audit(type: string, detail: Record<string, unknown>, status: LoopAuditEvent["status"] = "ok", now: () => Date = () => new Date()): LoopAuditEvent {
  return { type, status, timestamp: now().toISOString(), detail };
}

function skippedReport(
  definition: PermanentLoopDefinition,
  status: LoopCycleReport["status"],
  events: LoopAuditEvent[],
  startedAt: Date,
  now: () => Date
): LoopCycleReport {
  const finishedAt = now();
  return {
    loopId: definition.id,
    status,
    startedAt: startedAt.toISOString(),
    finishedAt: finishedAt.toISOString(),
    durationMs: finishedAt.getTime() - startedAt.getTime(),
    findings: [],
    proposalsPlanned: [],
    suppressed: [],
    auditEvents: events,
    metrics: { skipped: 1 }
  };
}

/** El repo es analizable si contiene lo que el loop necesita leer. */
function repoIsAnalyzable(loopId: string, repoRoot: string): boolean {
  if (loopId === "loop.spec-drift") return existsSync(join(repoRoot, "docs", "specs"));
  if (loopId === "loop.dedup-abstractions") return existsSync(join(repoRoot, "packages"));
  return existsSync(repoRoot);
}

export async function runPermanentLoopCycle(
  definition: PermanentLoopDefinition,
  deps: LoopRunnerDeps
): Promise<LoopCycleReport> {
  const now = deps.now ?? (() => new Date());
  const startedAt = now();
  const events: LoopAuditEvent[] = [];

  // ── Kill switch global ──────────────────────────────────────────────────
  if (!(await deps.control.isEnabled())) {
    events.push(audit("loop.skipped.disabled", { loopId: definition.id }, "warn", now));
    return skippedReport(definition, "skipped_disabled", events, startedAt, now);
  }

  // ── Pausa por loop ──────────────────────────────────────────────────────
  if (await deps.control.isPaused(definition.id)) {
    events.push(audit("loop.skipped.paused", { loopId: definition.id }, "warn", now));
    return skippedReport(definition, "skipped_paused", events, startedAt, now);
  }

  // ── Backpressure humano ─────────────────────────────────────────────────
  const openProposals = await deps.control.openProposalCount(definition.id);
  if (openProposals >= definition.stopCriteria.maxOpenProposals) {
    events.push(
      audit("loop.skipped.backpressure", {
        loopId: definition.id,
        openProposals,
        maxOpenProposals: definition.stopCriteria.maxOpenProposals
      }, "warn", now)
    );
    return skippedReport(definition, "skipped_backpressure", events, startedAt, now);
  }

  // ── Repo analizable ─────────────────────────────────────────────────────
  if (!repoIsAnalyzable(definition.id, deps.repoRoot)) {
    events.push(audit("loop.skipped.no_repo", { loopId: definition.id, repoRoot: deps.repoRoot }, "warn", now));
    return skippedReport(definition, "skipped_no_repo", events, startedAt, now);
  }

  const analyzer = LOOP_ANALYZERS[definition.id];
  if (!analyzer) {
    events.push(audit("loop.failed", { loopId: definition.id, reason: "no analyzer registered" }, "error", now));
    return { ...skippedReport(definition, "failed", events, startedAt, now), metrics: { failed: 1 } };
  }

  events.push(audit("loop.cycle.start", { loopId: definition.id, openProposals }, "ok", now));

  let findings: LoopFinding[];
  try {
    findings = analyzer({ repoRoot: deps.repoRoot, definition });
  } catch (error) {
    events.push(
      audit("loop.failed", {
        loopId: definition.id,
        error: error instanceof Error ? error.message : String(error)
      }, "error", now)
    );
    return { ...skippedReport(definition, "failed", events, startedAt, now), metrics: { failed: 1 } };
  }

  // ── Kill switch re-check entre etapas (parada en <30s) ─────────────────
  if (await deps.control.isPaused(definition.id)) {
    events.push(audit("loop.aborted.paused_mid_cycle", { loopId: definition.id, findingsDiscarded: findings.length }, "warn", now));
    return skippedReport(definition, "skipped_paused", events, startedAt, now);
  }

  // ── Filtros: confidence + memoria de rechazos + budget de propuestas ────
  const rejectedTargets = new Set(
    await deps.memory.recentlyRejectedTargets(definition.id, definition.stopCriteria.cooldownDays)
  );
  const suppressed: LoopSuppressedFinding[] = [];
  const proposalCandidates: LoopFinding[] = [];

  for (const finding of findings) {
    if (finding.confidence < definition.stopCriteria.minConfidence) {
      suppressed.push({ target: finding.target, reason: "below_min_confidence" });
      continue;
    }
    if (rejectedTargets.has(finding.target)) {
      suppressed.push({ target: finding.target, reason: "recently_rejected" });
      continue;
    }
    proposalCandidates.push(finding);
  }

  const proposalsPlanned = proposalCandidates.slice(0, definition.budgetPerCycle.maxProposals);
  for (const overBudget of proposalCandidates.slice(definition.budgetPerCycle.maxProposals)) {
    suppressed.push({ target: overBudget.target, reason: "over_proposal_budget" });
  }

  const artifacts: Record<string, string> = {};
  const metrics: Record<string, number> = {
    findings: findings.length,
    proposalsPlanned: proposalsPlanned.length,
    suppressed: suppressed.length,
    tokensConsumed: 0 // fase mecánica
  };

  if (definition.id === "loop.spec-drift") {
    const health = buildSpecHealthReport(deps.repoRoot, findings);
    artifacts["spec-health.md"] = health.markdown;
    metrics.specHealthScore = health.healthScore;
    metrics.totalSpecs = health.totalSpecs;
  }

  const finishedAt = now();
  events.push(
    audit("loop.cycle.complete", {
      loopId: definition.id,
      findings: findings.length,
      proposalsPlanned: proposalsPlanned.length,
      suppressed: suppressed.length
    }, "ok", now)
  );

  return {
    loopId: definition.id,
    status: "completed",
    startedAt: startedAt.toISOString(),
    finishedAt: finishedAt.toISOString(),
    durationMs: finishedAt.getTime() - startedAt.getTime(),
    findings,
    proposalsPlanned,
    suppressed,
    auditEvents: events,
    metrics,
    ...(Object.keys(artifacts).length > 0 ? { artifacts } : {})
  };
}
