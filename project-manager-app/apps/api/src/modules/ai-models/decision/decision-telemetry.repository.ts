import { Injectable } from "@nestjs/common";
import { PrismaService } from "../../../infrastructure/prisma/prisma.service.js";
import type { DecisionTelemetry, DecisionTelemetryEvent } from "./decision-layer.service.js";

// Persists JevDecisionEvent rows so "Jev decision vs. final action vs.
// outcome" can be compared (spec §6). Stores only the decision metadata —
// never the input context (messages, images, identifiers beyond tenant/user).
@Injectable()
export class PrismaDecisionTelemetry implements DecisionTelemetry {
  constructor(private readonly prisma: PrismaService) {}

  async record(event: DecisionTelemetryEvent): Promise<string | null> {
    const row = await this.prisma.jevDecisionEvent.create({
      data: {
        tenantId: event.tenantId,
        userId: event.userId ?? null,
        feature: event.feature,
        decision: event.decision,
        confidence: event.confidence,
        reasonCode: event.reasonCode,
        source: event.source,
        fallbackUsed: event.fallbackUsed,
        fallbackReason: event.fallbackReason ?? null,
        latencyMs: event.latencyMs,
        model: event.model ?? null,
        finalSystemAction: event.finalSystemAction,
        provider: event.provider,
        mode: event.mode,
        canary: event.canary ?? null,
        deterministicDecision: event.deterministicDecision,
        jevDecision: event.jevDecision ?? null,
        jevConfidence: event.jevConfidence ?? null,
        jevReasonCode: event.jevReasonCode ?? null,
        agreement: event.agreement ?? null,
        invariantsViolated: event.invariantsViolated ?? [],
        inputClass: event.inputClass ?? null,
        correlationId: event.correlationId ?? null,
        costUsd: event.costUsd ?? null,
      },
      select: { id: true },
    });
    return row.id;
  }

  /** Scoped by tenant so one tenant can't annotate another tenant's events. */
  async recordOutcome(input: { eventId: string; tenantId: string; outcome: string }): Promise<void> {
    await this.prisma.jevDecisionEvent.updateMany({
      where: { id: input.eventId, tenantId: input.tenantId },
      data: { outcome: input.outcome },
    });
  }
}
