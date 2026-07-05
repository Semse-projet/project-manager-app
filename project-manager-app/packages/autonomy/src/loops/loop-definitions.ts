/**
 * SPEC-AUT-001 §3-4 — definiciones de los dos primeros permanent loops.
 * Configuración inicial exacta del spec.
 */
import type { PermanentLoopDefinition } from "./loop-types.js";

// Sin ":" — BullMQ lo reserva como separador de keys de Redis y rechaza
// nombres de cola que lo contengan ("Queue name cannot contain :").
export const AUTONOMY_LOOPS_QUEUE = "autonomy-loops";

export const dedupAbstractionsLoop: PermanentLoopDefinition = {
  id: "loop.dedup-abstractions",
  agentType: "qa-agent",
  schedule: "0 6 * * 1", // semanal, lunes 06:00
  scope: ["packages/**"],
  budgetPerCycle: {
    maxTokens: 0, // fase mecánica: cero tokens
    maxProposals: 2,
    timeoutMs: 5 * 60 * 1000
  },
  stopCriteria: {
    maxOpenProposals: 3,
    cooldownAfterRejections: 2,
    cooldownDays: 30,
    minConfidence: 0.8
  },
  successMetric: "dedup.accepted_rate"
};

export const specDriftLoop: PermanentLoopDefinition = {
  id: "loop.spec-drift",
  agentType: "qa-agent",
  schedule: "0 6 * * 2,5", // 2×/semana, martes y viernes 06:00
  scope: ["docs/**"],
  budgetPerCycle: {
    maxTokens: 0, // fase mecánica: cero tokens
    maxProposals: 3,
    timeoutMs: 5 * 60 * 1000
  },
  stopCriteria: {
    maxOpenProposals: 3,
    cooldownAfterRejections: 2,
    cooldownDays: 30,
    minConfidence: 0.9
  },
  successMetric: "spec.health_score"
};

export const permanentLoops: PermanentLoopDefinition[] = [specDriftLoop, dedupAbstractionsLoop];

export function getLoopDefinition(loopId: string): PermanentLoopDefinition | undefined {
  return permanentLoops.find((loop) => loop.id === loopId);
}
