import crypto from "node:crypto";
import {
  BadGatewayException,
  BadRequestException,
  HttpException,
  HttpStatus,
  Injectable,
  Logger,
  NotFoundException,
  ServiceUnavailableException,
} from "@nestjs/common";
import type { Prisma } from "@prisma/client";
import type { ScopeActor } from "../../common/resource-scope.js";
import { ActorContextService } from "../../infrastructure/persistence/actor-context.service.js";
import { PrismaService } from "../../infrastructure/prisma/prisma.service.js";
import { resolveChatEvidenceMode, type ChatEvidenceMode } from "../ai-models/chat-evidence/chat-evidence-chat.service.js";
import { MAX_RISK_REASONS, sanitizeUntrustedText } from "../ai-models/chat-evidence/evidence-context.js";
import { VisionAccessPolicy } from "./vision-access.policy.js";
import { VisionService } from "./vision.service.js";

/** D4: análisis ADMITIDOS por usuario y día UTC (ajustable aquí, en un solo sitio). */
export const CHAT_EVIDENCE_DAILY_LIMIT = 20;

export const CHAT_EVIDENCE_ACTIONS = {
  requested: "prometeo.chat_evidence.analysis_requested",
  succeeded: "prometeo.chat_evidence.analysis_succeeded",
  failed: "prometeo.chat_evidence.analysis_failed",
} as const;

const ENTITY_TYPE = "ChatEvidenceAnalysis";
export const CHAT_EVIDENCE_DISCLAIMER = "Opinión asistida, no es una aprobación.";

export type ChatEvidenceAnalysisSummary = {
  evidenceId: string;
  analysisStatus: string;
  qualityScore: number | null;
  riskLevel: string | null;
  riskReasons: string[];
  requiresHumanReview: boolean | null;
  recommendedAction: string | null;
  disclaimer: string;
};

type AnalysisLike = {
  status?: string | null;
  qualityScore?: number | null;
  riskLevel?: string | null;
  riskReasons?: unknown;
  requiresHumanReview?: boolean | null;
  recommendedAction?: string | null;
};

/** Primer instante (00:00 UTC) del día de `now`. */
function startOfUtcDay(now: Date): Date {
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
}

/** Resumen SANEADO de un análisis: nunca `rawResult`, `canAutoApprove` ni enlaces. */
function summarize(evidenceId: string, analysis: AnalysisLike): ChatEvidenceAnalysisSummary {
  const reasons = Array.isArray(analysis.riskReasons)
    ? (analysis.riskReasons as unknown[]).map((reason) => sanitizeUntrustedText(reason, 160)).filter(Boolean).slice(0, MAX_RISK_REASONS)
    : [];
  return {
    evidenceId,
    analysisStatus: sanitizeUntrustedText(analysis.status, 24) || "unknown",
    qualityScore: typeof analysis.qualityScore === "number" && Number.isFinite(analysis.qualityScore) ? analysis.qualityScore : null,
    riskLevel: sanitizeUntrustedText(analysis.riskLevel, 24) || null,
    riskReasons: reasons,
    requiresHumanReview: typeof analysis.requiresHumanReview === "boolean" ? analysis.requiresHumanReview : null,
    recommendedAction: sanitizeUntrustedText(analysis.recommendedAction, 80) || null,
    disclaimer: CHAT_EVIDENCE_DISCLAIMER,
  };
}

/**
 * Endpoint fino para lanzar el análisis visual de una evidencia desde el chat (spec `prometeo.chat-evidence`, §3.5).
 *
 * Orden: modo ≠ off → pertenencia (`VisionAccessPolicy`) → imagen real → ¿ya analizada? (se devuelve sin repetir ni gastar
 * cupo) → ADMISIÓN: en una transacción con candado de asesoría por usuario y día se cuentan los intentos admitidos, se
 * rechaza con 429 al llegar a 20 y se escribe la auditoría del intento → SOLO ENTONCES se ejecuta el análisis → se registra
 * el resultado (SUCCEEDED/FAILED) enlazado al intento. Si el intento no se puede persistir, NO se ejecuta (fallo cerrado).
 * Sin migración: el contador es la propia tabla `AuditLog` existente.
 */
@Injectable()
export class ChatEvidenceAnalysisService {
  private readonly logger = new Logger(ChatEvidenceAnalysisService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly vision: VisionService,
    private readonly access: VisionAccessPolicy,
    private readonly actorContext: ActorContextService,
  ) {}

  async analyze(input: {
    actor: ScopeActor & { userId: string };
    evidenceId: string;
    requestId: string;
    chatRequestId?: string;
    mode?: ChatEvidenceMode;
    now?: Date;
  }): Promise<ChatEvidenceAnalysisSummary> {
    const mode = input.mode ?? resolveChatEvidenceMode();
    if (mode === "off") throw new NotFoundException("Not found"); // función apagada: no se revela

    const { actor, evidenceId } = input;
    await this.access.assertEvidence(actor, [evidenceId]); // otro tenant/inexistente ⇒ 404; otra organización ⇒ 403

    const evidence = await this.prisma.evidence.findFirst({
      where: { id: evidenceId, tenantId: actor.tenantId },
      select: { id: true, kind: true, bucketKey: true },
    });
    if (!evidence) throw new NotFoundException("Evidence not found");
    if (evidence.kind !== "PHOTO" || !evidence.bucketKey) {
      throw new BadRequestException("Esta evidencia no tiene una imagen que analizar");
    }

    const existing = await this.prisma.visionAnalysis.findUnique({ where: { evidenceId } });
    if (existing?.status === "completed") return summarize(evidenceId, existing as AnalysisLike);

    const attemptId = await this.admit(input, input.now ?? new Date());

    let analysis: AnalysisLike;
    try {
      analysis = (await this.vision.analyzeByEvidenceId(evidenceId)) as AnalysisLike;
    } catch (error) {
      await this.recordResult(input, attemptId, "failed", { error: error instanceof Error ? error.name : "unknown" });
      this.logger.warn(`[chat-evidence] análisis fallido: ${error instanceof Error ? error.message : String(error)}`);
      throw new BadGatewayException("No se pudo completar el análisis visual");
    }
    const completed = analysis.status === "completed";
    await this.recordResult(input, attemptId, completed ? "succeeded" : "failed", { analysisStatus: analysis.status ?? null });
    return summarize(evidenceId, analysis);
  }

  /** Cuenta intentos admitidos del día y escribe el intento, en UNA transacción serializada por usuario y día. */
  private async admit(
    input: { actor: ScopeActor & { userId: string }; evidenceId: string; requestId: string; chatRequestId?: string; mode?: ChatEvidenceMode },
    now: Date,
  ): Promise<string> {
    const { actor } = input;
    const dayStart = startOfUtcDay(now);
    const attemptId = `aud_${crypto.randomUUID()}`;
    try {
      await this.actorContext.ensureActorContext({ tenantId: actor.tenantId, orgId: actor.orgId, userId: actor.userId });
      await this.prisma.$transaction(async (tx) => {
        const lockKey = `chat_evidence:${actor.tenantId}:${actor.userId}:${dayStart.toISOString().slice(0, 10)}`;
        await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${lockKey}))`;
        const admitted = await tx.auditLog.count({
          where: { tenantId: actor.tenantId, actorUserId: actor.userId, action: CHAT_EVIDENCE_ACTIONS.requested, occurredAt: { gte: dayStart } },
        });
        if (admitted >= CHAT_EVIDENCE_DAILY_LIMIT) {
          throw new HttpException(`Límite diario de ${CHAT_EVIDENCE_DAILY_LIMIT} análisis alcanzado`, HttpStatus.TOO_MANY_REQUESTS);
        }
        await tx.auditLog.create({
          data: {
            id: attemptId,
            tenantId: actor.tenantId,
            actorUserId: actor.userId,
            entityType: ENTITY_TYPE,
            entityId: input.evidenceId,
            action: CHAT_EVIDENCE_ACTIONS.requested,
            afterJson: {
              requestId: input.requestId,
              ...(input.chatRequestId ? { chatRequestId: input.chatRequestId } : {}),
              origin: "chat",
              mode: input.mode ?? resolveChatEvidenceMode(),
              evidenceId: input.evidenceId,
              attempt: admitted + 1,
              dailyLimit: CHAT_EVIDENCE_DAILY_LIMIT,
              timestamp: now.toISOString(),
            } as Prisma.InputJsonValue,
            occurredAt: now,
          },
        });
      });
    } catch (error) {
      if (error instanceof HttpException) throw error; // 429
      // FALLO CERRADO: si no se puede dejar constancia (ni contar), no se gasta cómputo de visión.
      this.logger.error(`[chat-evidence] no se pudo auditar el intento; no se analiza: ${error instanceof Error ? error.message : String(error)}`);
      throw new ServiceUnavailableException("No se pudo registrar la solicitud de análisis");
    }
    return attemptId;
  }

  /** Registra el resultado, enlazado al intento. Si falla no se pierde el análisis ya ejecutado: el intento ya está auditado. */
  private async recordResult(
    input: { actor: ScopeActor & { userId: string }; evidenceId: string; requestId: string },
    attemptId: string,
    outcome: "succeeded" | "failed",
    detail: Record<string, unknown>,
  ): Promise<void> {
    try {
      await this.prisma.auditLog.create({
        data: {
          id: `aud_${crypto.randomUUID()}`,
          tenantId: input.actor.tenantId,
          actorUserId: input.actor.userId,
          entityType: ENTITY_TYPE,
          entityId: input.evidenceId,
          action: outcome === "succeeded" ? CHAT_EVIDENCE_ACTIONS.succeeded : CHAT_EVIDENCE_ACTIONS.failed,
          afterJson: { attemptId, requestId: input.requestId, outcome: outcome.toUpperCase(), ...detail } as Prisma.InputJsonValue,
          occurredAt: new Date(),
        },
      });
    } catch (error) {
      this.logger.warn(`[chat-evidence] no se pudo registrar el resultado del intento ${attemptId}: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
}
