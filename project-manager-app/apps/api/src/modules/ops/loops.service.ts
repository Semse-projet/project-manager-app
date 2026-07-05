import { Injectable } from "@nestjs/common";
import { getLoopDefinition, permanentLoops } from "@semse/autonomy";
import type { LoopCycleReportInput } from "@semse/schemas";
import { PrismaService } from "../../infrastructure/prisma/prisma.service.js";

/**
 * SPEC-AUT-001 — estado y memoria episódica de los permanent loops.
 *
 * - PermanentLoopState: pause/resume + métricas de ciclo (panel OMEGA).
 * - AgentDecision: hallazgos registrados y memoria de rechazos (los loops no
 *   re-proponen lo rechazado dentro del cooldown — regla dura §2.2).
 */
@Injectable()
export class LoopsService {
  constructor(private readonly prisma: PrismaService) {}

  async listLoops() {
    const states = await this.prisma.permanentLoopState.findMany() as Array<{ id: string }>;
    const stateById = new Map(states.map((state) => [state.id, state]));

    const openProposals = await this.prisma.agentDecision.findMany({
      where: { decision: "proposed", outcome: "pending_review" },
      select: { loopId: true }
    }) as Array<{ loopId: string }>;
    const openByLoop = new Map<string, number>();
    for (const row of openProposals) {
      openByLoop.set(row.loopId, (openByLoop.get(row.loopId) ?? 0) + 1);
    }

    return permanentLoops.map((definition) => {
      const state = stateById.get(definition.id);
      return {
        definition,
        state: state ?? null,
        openProposals: openByLoop.get(definition.id) ?? 0
      };
    });
  }

  getDefinition(loopId: string) {
    return getLoopDefinition(loopId);
  }

  async setPaused(loopId: string, paused: boolean, actorId?: string) {
    return this.prisma.permanentLoopState.upsert({
      where: { id: loopId },
      create: {
        id: loopId,
        paused,
        pausedAt: paused ? new Date() : null,
        pausedBy: paused ? actorId ?? null : null
      },
      update: {
        paused,
        pausedAt: paused ? new Date() : null,
        pausedBy: paused ? actorId ?? null : null
      }
    });
  }

  async isPaused(loopId: string): Promise<boolean> {
    const state = await this.prisma.permanentLoopState.findUnique({ where: { id: loopId } });
    return state?.paused ?? false;
  }

  /** Targets rechazados dentro del cooldown — el loop los consulta antes de proponer. */
  async rejectedTargets(loopId: string, cooldownDays: number): Promise<string[]> {
    const since = new Date(Date.now() - cooldownDays * 24 * 60 * 60 * 1000);
    const rows = await this.prisma.agentDecision.findMany({
      where: { loopId, decision: "rejected", createdAt: { gte: since } },
      select: { target: true },
      distinct: ["target"]
    }) as Array<{ target: string }>;
    return rows.map((row) => row.target);
  }

  async openProposalCount(loopId: string): Promise<number> {
    return this.prisma.agentDecision.count({
      where: { loopId, decision: "proposed", outcome: "pending_review" }
    });
  }

  /** Persiste el resultado de un ciclo: hallazgos + propuestas + estado. */
  async recordCycleReport(report: LoopCycleReportInput) {
    const proposalTargets = new Set(report.proposalsPlanned.map((finding) => finding.target));

    const decisions = report.findings.map((finding) => ({
      loopId: report.loopId,
      agentType: this.getDefinition(report.loopId)?.agentType ?? "qa-agent",
      target: finding.target,
      kind: proposalTargets.has(finding.target) ? "proposal" : "finding",
      decision: proposalTargets.has(finding.target) ? "proposed" : "recorded",
      outcome: proposalTargets.has(finding.target) ? "pending_review" : null,
      rationale: finding.rationale,
      confidence: finding.confidence,
      evidence: (finding.evidence ?? {}) as object
    }));

    // Idempotencia básica: no duplicar hallazgos abiertos del mismo target
    const existingOpen = await this.prisma.agentDecision.findMany({
      where: {
        loopId: report.loopId,
        target: { in: decisions.map((d) => d.target) },
        outcome: "pending_review"
      },
      select: { target: true }
    }) as Array<{ target: string }>;
    const alreadyOpen = new Set(existingOpen.map((row) => row.target));
    const toInsert = decisions.filter((decision) => !alreadyOpen.has(decision.target) || decision.decision === "recorded");

    if (toInsert.length > 0) {
      await this.prisma.agentDecision.createMany({ data: toInsert });
    }

    const completed = report.status === "completed";
    await this.prisma.permanentLoopState.upsert({
      where: { id: report.loopId },
      create: {
        id: report.loopId,
        lastCycleAt: new Date(report.finishedAt),
        lastCycleStatus: report.status,
        cyclesCompleted: completed ? 1 : 0,
        cyclesSkipped: completed ? 0 : 1,
        findingsRecorded: report.findings.length,
        proposalsOpened: report.proposalsPlanned.length,
        tokensConsumed: report.metrics.tokensConsumed ?? 0
      },
      update: {
        lastCycleAt: new Date(report.finishedAt),
        lastCycleStatus: report.status,
        cyclesCompleted: { increment: completed ? 1 : 0 },
        cyclesSkipped: { increment: completed ? 0 : 1 },
        findingsRecorded: { increment: report.findings.length },
        proposalsOpened: { increment: report.proposalsPlanned.length },
        tokensConsumed: { increment: report.metrics.tokensConsumed ?? 0 }
      }
    });

    return { recorded: toInsert.length, skippedDuplicates: decisions.length - toInsert.length };
  }

  /** Decisión humana sobre una propuesta — alimenta la memoria de rechazos. */
  async resolveDecision(decisionId: string, outcome: "accepted" | "rejected", actorId?: string) {
    return this.prisma.agentDecision.update({
      where: { id: decisionId },
      data: {
        decision: outcome,
        outcome: outcome === "accepted" ? "merged" : "dismissed",
        evidence: actorId ? { resolvedBy: actorId } : undefined
      }
    });
  }

  async recentDecisions(loopId: string, limit = 50) {
    return this.prisma.agentDecision.findMany({
      where: { loopId },
      orderBy: { createdAt: "desc" },
      take: Math.min(limit, 200)
    });
  }
}
