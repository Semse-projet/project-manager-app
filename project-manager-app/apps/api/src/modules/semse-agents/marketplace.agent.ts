import { randomUUID } from "node:crypto";
import { Inject, Injectable, Logger, Optional } from "@nestjs/common";
import { JOB_MATCHED_V1_SCHEMA_REF, jobMatchedV1EventSchema, type JobMatchedV1Event } from "@semse/schemas";
import { PrismaService } from "../../infrastructure/prisma/prisma.service.js";
import { OutboxRepository } from "../domain-events/outbox.repository.js";
import type { SemseAgentMessage } from "./semse-agents.service.js";
import { SemseAgentsService } from "./semse-agents.service.js";
import type { MatchingService } from "../matching/matching.service.js";
import type { NotificationsService } from "../notifications/notifications.service.js";
import { DECISION_CONFIG, DECISION_TELEMETRY, type DecisionTelemetry } from "../ai-models/decision/decision-layer.service.js";
import { resolveDecisionLayerConfig, type DecisionLayerConfig } from "../ai-models/decision/decision-flags.js";
import {
  decodePendingReview,
  encodePendingReview,
  evaluateMarketplaceConfidenceGate,
  type MarketplaceGateEvaluation,
} from "./marketplace-confidence-gate.js";

export type PendingReviewSummary = {
  eventId: string;
  createdAt: string;
  confidence: number;
  reasonCode: string;
  jobId: string | null;
  classification: JobClassification | null;
  originalPayload: Record<string, unknown> | null;
};

export type ReviewMutationResult =
  | { status: "not_found" }
  | { status: "already_resolved"; outcome: string }
  | { status: "malformed" }
  | { status: "approved"; outcome: "user_corrected" | "user_saved" }
  | { status: "rejected" };

export type JobClassification = {
  trade:      string;
  urgency:    "low" | "medium" | "high" | "urgent";
  complexity: "simple" | "medium" | "complex";
  estimatedHours: number;
  suggestedBudgetMin: number;
  suggestedBudgetMax: number;
  requiredSkills: string[];
  matchScore:     number;  // 0-100
  /** Real trace of the deterministic classification logic — not LLM-generated. */
  reasoningSteps: string[];
};

const TRADE_KEYWORDS: Record<string, string[]> = {
  electrical: ["eléctrico", "electricidad", "cableado", "breaker", "panel", "tomacorriente", "electrical", "wiring"],
  plumbing:   ["plomería", "tubería", "agua", "fuga", "drenaje", "grifo", "plumbing", "pipe"],
  drywall:    ["drywall", "tablaroca", "yeso", "pared", "tabique", "gypsum"],
  painting:   ["pintura", "pintar", "pincel", "rodillo", "paint"],
  hvac:       ["aire", "calefacción", "hvac", "ventilación", "ducto", "ac", "heating"],
  roofing:    ["techo", "lámina", "impermeabilización", "roofing", "teja"],
  carpentry:  ["carpintería", "madera", "puerta", "mueble", "carpentry", "wood"],
  cleaning:   ["limpieza", "limpiar", "cleaning"],
};

function classifyTrade(description: string): { trade: string; matchedKeywords: string[] } {
  const lower = description.toLowerCase();
  let bestMatch = "general"; let bestScore = 0; let bestKeywords: string[] = [];
  for (const [trade, keywords] of Object.entries(TRADE_KEYWORDS)) {
    const matched = keywords.filter((kw) => lower.includes(kw));
    if (matched.length > bestScore) { bestScore = matched.length; bestMatch = trade; bestKeywords = matched; }
  }
  return { trade: bestMatch, matchedKeywords: bestKeywords };
}

function estimateBudget(trade: string, area = 100): { min: number; max: number; hours: number } {
  const rates: Record<string, { hourlyRate: number; areaFactor: number }> = {
    electrical: { hourlyRate: 75,  areaFactor: 0.15 },
    plumbing:   { hourlyRate: 85,  areaFactor: 0.08 },
    drywall:    { hourlyRate: 55,  areaFactor: 0.12 },
    painting:   { hourlyRate: 45,  areaFactor: 0.06 },
    hvac:       { hourlyRate: 90,  areaFactor: 0.20 },
    roofing:    { hourlyRate: 70,  areaFactor: 0.18 },
    carpentry:  { hourlyRate: 65,  areaFactor: 0.10 },
    cleaning:   { hourlyRate: 35,  areaFactor: 0.05 },
  };
  const r = rates[trade] ?? { hourlyRate: 55, areaFactor: 0.10 };
  const hours = Math.ceil(area * r.areaFactor + 2);
  const materialFactor = 1.4;
  const min = Math.round(hours * r.hourlyRate * 0.8);
  const max = Math.round(hours * r.hourlyRate * materialFactor);
  return { min, max, hours };
}

@Injectable()
export class MarketplaceAgent {
  private readonly logger = new Logger(MarketplaceAgent.name);

  constructor(
    private readonly bus: SemseAgentsService,
    @Optional() private readonly prisma?: PrismaService,
    @Optional() private readonly matching?: MatchingService,
    @Optional() private readonly notifications?: NotificationsService,
    @Optional() private readonly outboxRepository?: OutboxRepository,
    @Optional() @Inject(DECISION_TELEMETRY) private readonly telemetry?: DecisionTelemetry,
    /** Test-only escape hatch — mirrors DecisionLayerService's own DECISION_CONFIG pattern. Never bound in production. */
    @Optional() @Inject(DECISION_CONFIG) private readonly configOverride?: () => DecisionLayerConfig,
  ) {
    this.bus.register("marketplace", (msg) => this.handleMessage(msg));
    this.logger.log("[Marketplace] Agent registered");
  }

  async handleMessage(msg: SemseAgentMessage): Promise<void> {
    if (msg.event === "PROJECT_PUBLISHED") {
      const classification = await this.classifyJob(msg.payload);
      const tenantId = String(msg.payload.tenantId ?? "tenant_default");
      const config = this.configOverride ? this.configOverride() : resolveDecisionLayerConfig();
      const gate = evaluateMarketplaceConfidenceGate({ config, tenantId, matchScore: classification.matchScore });

      let reviewEventId: string | null = null;
      if (gate.active && gate.canary !== null) {
        reviewEventId = await this.recordGateEvent({ tenantId, msg, classification, gate }).catch((err) => {
          this.logger.warn(`[Marketplace] gate telemetry failed: ${String(err?.message ?? err)}`);
          return null;
        });
      }

      if (gate.shouldBlockDispatch) {
        this.logger.log(`[Marketplace] job ${String(msg.payload.jobId ?? "?")} held for human review (eventId=${reviewEventId ?? "n/a"}, reason=${gate.reasonCode})`);
        return;
      }

      this.dispatchClassification({ payload: msg.payload, projectId: msg.projectId }, classification);
    }
  }

  /** Shared by the normal flow and by approveReview() resuming a held job. */
  private dispatchClassification(source: { payload: Record<string, unknown>; projectId: string }, classification: JobClassification): void {
    this.bus.dispatch(this.bus.makeMessage({
      from: "marketplace", to: "protools", event: "ESTIMATE_REQUESTED",
      payload: { classification, originalPayload: source.payload },
      projectId: source.projectId,
    }));
    this.bus.dispatch(this.bus.makeMessage({
      from: "marketplace", to: "buildops", event: "PROJECT_PLANNED",
      payload: { classification, projectId: source.projectId },
      projectId: source.projectId,
    }));

    // Notify top-matched contractors about the new opportunity
    void this.notifyMatchedContractors(source.payload, classification).catch(
      (err) => this.logger.warn(`[Marketplace] Contractor notification failed: ${String(err?.message ?? err)}`),
    );
  }

  private async recordGateEvent(input: {
    tenantId: string;
    msg: SemseAgentMessage;
    classification: JobClassification;
    gate: MarketplaceGateEvaluation;
  }): Promise<string | null> {
    if (!this.telemetry) return null;
    const jobId = String(input.msg.payload.jobId ?? "");
    const finalSystemAction = input.gate.shouldBlockDispatch ? "HUMAN_REVIEW_PENDING" : "AUTO_PROCEED";
    const inputClass = input.gate.action === "HUMAN_REVIEW"
      ? encodePendingReview({
          jobId,
          projectId: input.msg.projectId,
          originalPayload: input.msg.payload,
          classification: input.classification as unknown as Record<string, unknown>,
        })
      : `job:${jobId}`;

    return this.telemetry.record({
      tenantId: input.tenantId,
      feature: "marketplace_classify",
      decision: input.gate.action,
      confidence: input.gate.confidence,
      reasonCode: input.gate.reasonCode,
      source: "deterministic",
      fallbackUsed: false,
      latencyMs: 0,
      provider: "none",
      mode: input.gate.mode,
      canary: input.gate.canary ?? undefined,
      deterministicDecision: input.gate.action,
      inputClass,
      correlationId: input.msg.correlationId,
      finalSystemAction,
    });
  }

  // ── Human review queue (admin/agents dashboard) ──────────────────────────

  async listPendingReviews(input: { tenantId: string; limit?: number }): Promise<PendingReviewSummary[]> {
    if (!this.prisma) return [];
    const rows = await this.prisma.jevDecisionEvent.findMany({
      where: { tenantId: input.tenantId, feature: "marketplace_classify", finalSystemAction: "HUMAN_REVIEW_PENDING", outcome: null },
      orderBy: { createdAt: "desc" },
      take: input.limit ?? 20,
    });
    return rows.map((row) => {
      const pending = decodePendingReview(row.inputClass);
      return {
        eventId: row.id,
        createdAt: row.createdAt.toISOString(),
        confidence: row.confidence,
        reasonCode: row.reasonCode,
        jobId: pending?.jobId ?? null,
        classification: (pending?.classification as JobClassification | undefined) ?? null,
        originalPayload: pending?.originalPayload ?? null,
      };
    });
  }

  async approveReview(input: {
    tenantId: string;
    eventId: string;
    override?: Partial<JobClassification>;
  }): Promise<ReviewMutationResult> {
    if (!this.prisma) return { status: "not_found" };
    const row = await this.prisma.jevDecisionEvent.findFirst({
      where: { id: input.eventId, tenantId: input.tenantId, feature: "marketplace_classify" },
    });
    if (!row) return { status: "not_found" };
    if (row.outcome) return { status: "already_resolved", outcome: row.outcome };

    const pending = decodePendingReview(row.inputClass);
    if (!pending) return { status: "malformed" };

    const hasOverride = !!input.override && Object.keys(input.override).length > 0;
    const classification: JobClassification = { ...(pending.classification as JobClassification), ...input.override };
    const outcome: "user_corrected" | "user_saved" = hasOverride ? "user_corrected" : "user_saved";

    this.dispatchClassification({ payload: pending.originalPayload, projectId: pending.projectId }, classification);
    await this.telemetry?.recordOutcome({ eventId: row.id, tenantId: input.tenantId, outcome });

    return { status: "approved", outcome };
  }

  async rejectReview(input: { tenantId: string; eventId: string; reason: string }): Promise<ReviewMutationResult> {
    if (!this.prisma) return { status: "not_found" };
    const row = await this.prisma.jevDecisionEvent.findFirst({
      where: { id: input.eventId, tenantId: input.tenantId, feature: "marketplace_classify" },
    });
    if (!row) return { status: "not_found" };
    if (row.outcome) return { status: "already_resolved", outcome: row.outcome };

    await this.telemetry?.recordOutcome({ eventId: row.id, tenantId: input.tenantId, outcome: "rejected" });
    this.logger.log(`[Marketplace] review ${row.id} rejected: ${input.reason}`);
    return { status: "rejected" };
  }

  private async notifyMatchedContractors(
    payload: Record<string, unknown>,
    classification: JobClassification,
  ): Promise<void> {
    const jobId = String(payload.jobId ?? "");
    const tenantId = String(payload.tenantId ?? "tenant_default");
    if (!jobId || !this.matching || !this.notifications) return;

    const result = await this.matching.matchJob(tenantId, { jobId, limit: 5, minScore: 40 });
    const topContractors = result.candidates.slice(0, 5);
    if (topContractors.length === 0) return;

    const jobMatchedPayload = {
      jobId,
      jobTitle: String(payload.title ?? "Nuevo trabajo"),
      trade: classification.trade,
      budgetMin: classification.suggestedBudgetMin,
      budgetMax: classification.suggestedBudgetMax,
      location: String(payload.location ?? ""),
      urgency: classification.urgency,
      matchedUserIds: topContractors.map((c) => c.userId),
    };

    await this.notifications.handleEvent({
      tenantId,
      eventType: "job.matched",
      payload: jobMatchedPayload,
    });
    this.logger.log(`[Marketplace] Notified ${topContractors.length} contractors for job ${jobId}`);

    // docs/specs/satellites/SAT-007-outbound-webhooks.spec.md — best-effort
    // durable outbox write, see plan.md §1.1 for why this isn't wrapped in a
    // $transaction: no domain write happens at this exact point to pair it
    // with (matching is a read/compute step), and this call site was already
    // fire-and-forget via notifications.handleEvent() above.
    void this.emitJobMatchedOutboxEvent(tenantId, jobId, jobMatchedPayload).catch((err) =>
      this.logger.warn(`[Marketplace] job.matched.v1 outbox write failed: ${String(err?.message ?? err)}`),
    );
  }

  private async emitJobMatchedOutboxEvent(
    tenantId: string,
    jobId: string,
    payload: JobMatchedV1Event["payload"],
  ): Promise<void> {
    if (!this.outboxRepository || !this.prisma) {
      return;
    }
    const job = await this.prisma.job.findFirst({
      where: { id: jobId, tenantId },
      select: { clientOrgId: true },
    });
    if (!job) {
      return;
    }

    const eventId = randomUUID();
    const recordedAt = new Date();
    const event = jobMatchedV1EventSchema.parse({
      eventId,
      eventType: "job.matched.v1",
      version: 1,
      envelopeVersion: 2,
      occurredAt: recordedAt.toISOString(),
      recordedAt: recordedAt.toISOString(),
      tenantId,
      orgId: job.clientOrgId,
      module: "jobs",
      entityType: "Job",
      entityId: jobId,
      actor: { type: "system", id: "marketplace-agent" },
      correlationId: eventId,
      idempotencyKey: `job.matched.v1:${jobId}:${eventId}`,
      schemaRef: JOB_MATCHED_V1_SCHEMA_REF,
      payload,
      metadata: { source: "marketplace-agent.notify-matched-contractors" },
    });
    await this.outboxRepository.create(this.prisma, event);
  }

  async classifyJob(payload: Record<string, unknown>): Promise<JobClassification> {
    const description = String(payload.description ?? payload.scope ?? "");
    const area        = typeof payload.area === "number" ? payload.area : 100;
    const { trade, matchedKeywords } = classifyTrade(description);
    const { min, max, hours } = estimateBudget(trade, area);

    const urgency = payload.urgency as "low" | "medium" | "high" | "urgent" ?? "medium";
    const complexity = area > 300 ? "complex" : area > 100 ? "medium" : "simple";
    const matchScore = description.length > 50 ? 85 : 65;

    const reasoningSteps: string[] = [
      matchedKeywords.length > 0
        ? `Encontré ${matchedKeywords.length} palabra(s) clave de "${trade}" en la descripción (${matchedKeywords.join(", ")}) → trade = ${trade}.`
        : `No encontré palabras clave de ningún trade conocido en la descripción → trade = "general" (fallback).`,
      `Área declarada: ${area} sqft → complejidad = ${complexity} (simple ≤100 sqft, medium ≤300 sqft, complex >300 sqft).`,
      `Horas estimadas: ${hours}h, calculadas a partir del área y la tarifa/factor del trade "${trade}".`,
      `Presupuesto sugerido: $${min.toLocaleString()}–$${max.toLocaleString()} (0.8×–1.4× horas × tarifa/hora del trade, incluye margen de materiales).`,
      `Match score: ${matchScore}% — ${description.length > 50 ? `descripción con ${description.length} caracteres (>50) → score alto` : `descripción corta (${description.length} caracteres, ≤50) → score reducido`}.`,
    ];

    return {
      trade, urgency, complexity,
      estimatedHours:     hours,
      suggestedBudgetMin: min,
      suggestedBudgetMax: max,
      requiredSkills:     [trade, "evidence_documentation", "semse_compliance"],
      matchScore,
      reasoningSteps,
    };
  }
}
