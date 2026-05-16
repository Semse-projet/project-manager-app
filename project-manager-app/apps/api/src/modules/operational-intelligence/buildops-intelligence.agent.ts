import { Injectable, Logger } from "@nestjs/common";
import { PrismaService } from "../../infrastructure/prisma/prisma.service.js";
import {
  OperationalSignalsService,
  type SignalSeverity,
} from "./operational-signals.service.js";
import { IntelligenceRunsService } from "./intelligence-runs.service.js";

const AGENT_NAME = "BuildOpsIntelligenceAgent";
const LOW_CONFIDENCE_THRESHOLD = 65; // confidenceScore is 0-100

@Injectable()
export class BuildOpsIntelligenceAgent {
  private readonly logger = new Logger(BuildOpsIntelligenceAgent.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly signals: OperationalSignalsService,
    private readonly runs: IntelligenceRunsService,
  ) {}

  async evaluateMilestone(input: {
    tenantId: string;
    milestoneId: string;
    triggerEvent: string;
  }): Promise<void> {
    const started = Date.now();
    const signalsCreated: string[] = [];

    try {
      // Load milestone with evidence items and related context
      const milestone = await this.prisma.milestone.findUnique({
        where: { id: input.milestoneId },
        include: {
          evidenceItems: true,
        },
      });

      if (!milestone) return;

      const buildOpsProjectId = (milestone as Record<string, unknown>).buildOpsProjectId as string | null ?? null;
      const jobId = (milestone as Record<string, unknown>).jobId as string | null ?? null;

      // Load related AlgorithmRun if buildOps project exists
      let algorithmRun: { confidenceScore: number | null } | null = null;
      if (buildOpsProjectId) {
        algorithmRun = await this.prisma.algorithmRun.findFirst({
          where: { buildOpsProjectId },
          orderBy: { createdAt: "desc" },
          select: { confidenceScore: true },
        });
      }

      // Load open change order candidates for this milestone
      const openChangeCandidates = await this.prisma.changeOrderCandidate.count({
        where: {
          milestoneId: input.milestoneId,
          status: { in: ["predicted", "submitted"] },
        },
      });

      const paymentReadiness = (milestone as Record<string, unknown>).paymentReadiness as string ?? "not_ready";
      const evidenceReadiness = (milestone as Record<string, unknown>).evidenceReadiness as string ?? "missing";
      const milestoneStatus = (milestone as Record<string, unknown>).status as string ?? "draft";

      const missingItems = milestone.evidenceItems.filter(
        (e) => e.status === "missing" || e.status === "rejected",
      );
      const rejectedItems = milestone.evidenceItems.filter(
        (e) => e.status === "rejected",
      );

      const context = {
        milestoneStatus,
        paymentReadiness,
        evidenceReadiness,
        evidenceItemsTotal: milestone.evidenceItems.length,
        evidenceItemsMissing: missingItems.length,
        evidenceItemsRejected: rejectedItems.length,
        algorithmConfidence: algorithmRun?.confidenceScore ?? null,
        openChangeCandidates,
      };

      // ── Rule 1: EVIDENCE_GAP ────────────────────────────────────────────────
      if (missingItems.length > 0) {
        const severity: SignalSeverity =
          paymentReadiness === "not_ready" && milestoneStatus === "submitted"
            ? "high"
            : "medium";

        const result = await this.signals.upsertSignal({
          tenantId: input.tenantId,
          type: "EVIDENCE_GAP",
          severity,
          title: "Evidencia incompleta",
          message: `Este milestone tiene ${missingItems.length} evidencia(s) faltante(s) o rechazada(s).`,
          recommendedAction:
            "Solicitar evidencia faltante al profesional antes de aprobar el pago.",
          sourceAgent: AGENT_NAME,
          entityType: "Milestone",
          entityId: input.milestoneId,
          jobId: jobId ?? undefined,
          buildOpsProjectId: buildOpsProjectId ?? undefined,
          milestoneId: input.milestoneId,
          metadataJson: {
            missingCount: missingItems.length,
            rejectedCount: rejectedItems.length,
            missingLabels: missingItems.map((e) => e.label),
          },
        });
        if (result.created) signalsCreated.push("EVIDENCE_GAP");
      }

      // ── Rule 2: PAYMENT_BLOCKED ─────────────────────────────────────────────
      if (
        paymentReadiness === "not_ready" &&
        (milestoneStatus === "submitted" || milestoneStatus === "awaiting_review")
      ) {
        const result = await this.signals.upsertSignal({
          tenantId: input.tenantId,
          type: "PAYMENT_BLOCKED",
          severity: "high",
          title: "Pago bloqueado",
          message:
            "El payment readiness de este milestone sigue en not_ready mientras está pendiente de aprobación.",
          recommendedAction:
            "Revisar evidencia y cambios de alcance antes de proceder con el pago.",
          sourceAgent: AGENT_NAME,
          entityType: "Milestone",
          entityId: input.milestoneId,
          jobId: jobId ?? undefined,
          buildOpsProjectId: buildOpsProjectId ?? undefined,
          milestoneId: input.milestoneId,
          metadataJson: { paymentReadiness, evidenceReadiness, milestoneStatus },
        });
        if (result.created) signalsCreated.push("PAYMENT_BLOCKED");
      }

      // ── Rule 3: LOW_CONFIDENCE_ESTIMATE ────────────────────────────────────
      if (
        algorithmRun?.confidenceScore !== null &&
        algorithmRun?.confidenceScore !== undefined &&
        algorithmRun.confidenceScore < LOW_CONFIDENCE_THRESHOLD
      ) {
        const result = await this.signals.upsertSignal({
          tenantId: input.tenantId,
          type: "LOW_CONFIDENCE_ESTIMATE",
          severity: buildOpsProjectId ? "high" : "medium",
          title: "Estimate con baja confianza",
          message: `El estimate asociado tiene confianza de ${algorithmRun.confidenceScore}/100. Puede haber condiciones ocultas o scope ambiguo.`,
          recommendedAction:
            "Revisar mediciones, condiciones del sitio y scope antes de continuar.",
          sourceAgent: AGENT_NAME,
          entityType: "Milestone",
          entityId: input.milestoneId,
          jobId: jobId ?? undefined,
          buildOpsProjectId: buildOpsProjectId ?? undefined,
          milestoneId: input.milestoneId,
          metadataJson: { confidenceScore: algorithmRun.confidenceScore },
        });
        if (result.created) signalsCreated.push("LOW_CONFIDENCE_ESTIMATE");
      }

      // ── Rule 4: CHANGE_ORDER_RECOMMENDED ───────────────────────────────────
      if (rejectedItems.length > 0 && openChangeCandidates === 0) {
        const result = await this.signals.upsertSignal({
          tenantId: input.tenantId,
          type: "CHANGE_ORDER_RECOMMENDED",
          severity: "medium",
          title: "Change order recomendado",
          message:
            "Hay evidencia rechazada que podría indicar un cambio de alcance no documentado.",
          recommendedAction:
            "Considerar crear un Change Order para documentar el alcance adicional.",
          sourceAgent: AGENT_NAME,
          entityType: "Milestone",
          entityId: input.milestoneId,
          jobId: jobId ?? undefined,
          buildOpsProjectId: buildOpsProjectId ?? undefined,
          milestoneId: input.milestoneId,
          metadataJson: { rejectedCount: rejectedItems.length },
        });
        if (result.created) signalsCreated.push("CHANGE_ORDER_RECOMMENDED");
      }

      // ── Rule 5: DISPUTE_RISK_HIGH ──────────────────────────────────────────
      if (
        rejectedItems.length > 0 &&
        paymentReadiness === "not_ready" &&
        openChangeCandidates > 0
      ) {
        const result = await this.signals.upsertSignal({
          tenantId: input.tenantId,
          type: "DISPUTE_RISK_HIGH",
          severity: "critical",
          title: "Riesgo de disputa elevado",
          message:
            "Este proyecto tiene evidencia rechazada, pago bloqueado y cambios de alcance activos simultáneamente.",
          recommendedAction:
            "Revisar inmediatamente antes de liberar cualquier pago. Alta probabilidad de disputa.",
          sourceAgent: AGENT_NAME,
          entityType: "Milestone",
          entityId: input.milestoneId,
          jobId: jobId ?? undefined,
          buildOpsProjectId: buildOpsProjectId ?? undefined,
          milestoneId: input.milestoneId,
          metadataJson: {
            rejectedCount: rejectedItems.length,
            openChangeCandidates,
            paymentReadiness,
          },
        });
        if (result.created) signalsCreated.push("DISPUTE_RISK_HIGH");
      }

      // Record the intelligence run
      await this.runs.record({
        tenantId: input.tenantId,
        agentName: AGENT_NAME,
        triggerEvent: input.triggerEvent,
        entityType: "Milestone",
        entityId: input.milestoneId,
        contextSnapshotJson: context,
        decisionJson: {
          signalsCreated,
          rulesEvaluated: 5,
          skippedDueToDedup: signalsCreated.length === 0,
        },
        signalsCreated,
        status: "completed",
        durationMs: Date.now() - started,
      });

      if (signalsCreated.length > 0) {
        this.logger.log(
          `[${AGENT_NAME}] milestone=${input.milestoneId} trigger=${input.triggerEvent} signals=${signalsCreated.join(",")}`,
        );
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      this.logger.error(`[${AGENT_NAME}] evaluation failed: ${msg}`);

      await this.runs.record({
        tenantId: input.tenantId,
        agentName: AGENT_NAME,
        triggerEvent: input.triggerEvent,
        entityType: "Milestone",
        entityId: input.milestoneId,
        signalsCreated: [],
        status: "failed",
        error: msg,
        durationMs: Date.now() - started,
      }).catch(() => undefined);
    }
  }

  async evaluateBuildOpsProject(input: {
    tenantId: string;
    buildOpsProjectId: string;
    jobId?: string;
    triggerEvent: string;
  }): Promise<void> {
    const started = Date.now();
    const signalsCreated: string[] = [];

    try {
      const project = await this.prisma.buildOpsProject.findUnique({
        where: { id: input.buildOpsProjectId },
        select: { id: true, tenantId: true, jobId: true, riskLevel: true, riskScore: true, status: true, sourceToolResult: true },
      });

      if (!project || project.tenantId !== input.tenantId) return;

      const jobId = input.jobId ?? project.jobId ?? undefined;
      const src = project.sourceToolResult as Record<string, unknown> | null;
      const missingInputs = Array.isArray(src?.missingInputs) ? (src.missingInputs as string[]) : [];

      if (missingInputs.length > 0) {
        const r = await this.signals.upsertSignal({
          tenantId: input.tenantId, type: "LOW_CONFIDENCE_ESTIMATE", severity: "medium",
          title: "Información faltante en el estimate",
          message: `El proyecto tiene ${missingInputs.length} campo(s) sin información que afectan la precisión del presupuesto.`,
          recommendedAction: "Completar la información del intake para mejorar el presupuesto sugerido.",
          sourceAgent: AGENT_NAME, entityType: "BuildOpsProject", entityId: project.id,
          jobId, buildOpsProjectId: project.id,
          metadataJson: { missingInputs: missingInputs.slice(0, 10) },
        });
        if (r.created) signalsCreated.push("LOW_CONFIDENCE_ESTIMATE");
      }

      if (project.riskLevel === "high" || project.riskLevel === "critical") {
        const r = await this.signals.upsertSignal({
          tenantId: input.tenantId, type: "DISPUTE_RISK_HIGH",
          severity: project.riskLevel === "critical" ? "critical" : "high",
          title: "Proyecto con riesgo elevado detectado",
          message: `El análisis detectó riesgo ${project.riskLevel} en este proyecto.`,
          recommendedAction: "Revisar scope, materiales y condiciones antes de asignar profesional.",
          sourceAgent: AGENT_NAME, entityType: "BuildOpsProject", entityId: project.id,
          jobId, buildOpsProjectId: project.id,
          metadataJson: { riskLevel: project.riskLevel, riskScore: project.riskScore },
        });
        if (r.created) signalsCreated.push("DISPUTE_RISK_HIGH");
      }

      await this.runs.record({
        tenantId: input.tenantId, agentName: AGENT_NAME, triggerEvent: input.triggerEvent,
        entityType: "BuildOpsProject", entityId: project.id,
        contextSnapshotJson: { riskLevel: project.riskLevel, missingInputsCount: missingInputs.length },
        decisionJson: { signalsCreated }, signalsCreated, status: "completed",
        durationMs: Date.now() - started,
      });

      if (signalsCreated.length > 0) {
        this.logger.log(`[${AGENT_NAME}] buildops=${project.id} signals=${signalsCreated.join(",")}`);
      }
    } catch (err) {
      this.logger.warn(`[${AGENT_NAME}] project evaluation failed: ${(err as Error)?.message ?? String(err)}`);
    }
  }
}
