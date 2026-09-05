import { randomUUID } from "node:crypto";
import { Injectable, Logger, Optional } from "@nestjs/common";
import { JOB_MATCHED_V1_SCHEMA_REF, jobMatchedV1EventSchema, type JobMatchedV1Event } from "@semse/schemas";
import { PrismaService } from "../../infrastructure/prisma/prisma.service.js";
import { OutboxRepository } from "../domain-events/outbox.repository.js";
import type { SemseAgentMessage } from "./semse-agents.service.js";
import { SemseAgentsService } from "./semse-agents.service.js";
import type { MatchingService } from "../matching/matching.service.js";
import type { NotificationsService } from "../notifications/notifications.service.js";

export type JobClassification = {
  trade:      string;
  urgency:    "low" | "medium" | "high" | "urgent";
  complexity: "simple" | "medium" | "complex";
  estimatedHours: number;
  suggestedBudgetMin: number;
  suggestedBudgetMax: number;
  requiredSkills: string[];
  matchScore:     number;  // 0-100
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

function classifyTrade(description: string): string {
  const lower = description.toLowerCase();
  let bestMatch = "general"; let bestScore = 0;
  for (const [trade, keywords] of Object.entries(TRADE_KEYWORDS)) {
    const score = keywords.filter((kw) => lower.includes(kw)).length;
    if (score > bestScore) { bestScore = score; bestMatch = trade; }
  }
  return bestMatch;
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
  ) {
    this.bus.register("marketplace", (msg) => this.handleMessage(msg));
    this.logger.log("[Marketplace] Agent registered");
  }

  async handleMessage(msg: SemseAgentMessage): Promise<void> {
    if (msg.event === "PROJECT_PUBLISHED") {
      const classification = await this.classifyJob(msg.payload);
      this.bus.dispatch(this.bus.makeMessage({
        from: "marketplace", to: "protools", event: "ESTIMATE_REQUESTED",
        payload: { classification, originalPayload: msg.payload },
        projectId: msg.projectId,
      }));
      this.bus.dispatch(this.bus.makeMessage({
        from: "marketplace", to: "buildops", event: "PROJECT_PLANNED",
        payload: { classification, projectId: msg.projectId },
        projectId: msg.projectId,
      }));

      // Notify top-matched contractors about the new opportunity
      void this.notifyMatchedContractors(msg.payload, classification).catch(
        (err) => this.logger.warn(`[Marketplace] Contractor notification failed: ${String(err?.message ?? err)}`),
      );
    }
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
    const trade = classifyTrade(description);
    const { min, max, hours } = estimateBudget(trade, area);

    const urgency = payload.urgency as "low" | "medium" | "high" | "urgent" ?? "medium";
    const complexity = area > 300 ? "complex" : area > 100 ? "medium" : "simple";

    return {
      trade, urgency, complexity,
      estimatedHours:     hours,
      suggestedBudgetMin: min,
      suggestedBudgetMax: max,
      requiredSkills:     [trade, "evidence_documentation", "semse_compliance"],
      matchScore:         description.length > 50 ? 85 : 65,
    };
  }
}
