import { Injectable, Logger, Optional } from "@nestjs/common";
import type { PrometeoProposedAction } from "@semse/schemas";
import { hasPermission } from "../../../common/rbac.js";
import type { RequestContext } from "../../../common/request-context.js";
import { AuditService } from "../../../infrastructure/audit/audit.service.js";
import { ChatEvidenceService, type ChatEvidenceListing } from "./chat-evidence.service.js";
import { buildEvidenceContextBlock, EVIDENCE_SYSTEM_INSTRUCTION } from "./evidence-context.js";
import { isEvidenceReviewRequest } from "./intent.js";

/** `off` (por defecto): sin cambios. `shadow`: calcula y audita lo que HABRÍA incluido. `live`: añade bloque, instrucción y acciones. */
export type ChatEvidenceMode = "off" | "shadow" | "live";

export function resolveChatEvidenceMode(env: Record<string, string | undefined> = process.env): ChatEvidenceMode {
  const raw = env.SEMSE_CHAT_EVIDENCE_MODE?.trim().toLowerCase();
  return raw === "shadow" || raw === "live" ? raw : "off";
}

export const CHAT_EVIDENCE_ANALYZE_TOOL = "analyze_evidence";
export const CHAT_EVIDENCE_LISTED_ACTION = "prometeo.chat_evidence.listed";

export type ChatEvidencePreparation = {
  /** Bloque `<evidence_data>` para el contexto del modelo. */
  contextBlock: string;
  /** Instrucción de sistema que declara el bloque como dato no confiable. */
  systemInstruction: string;
  /** Botones «Analizar con visión» (solo evidencias analizables). */
  actions: PrometeoProposedAction[];
};

/**
 * Integración de evidencias en el chat de Prometeo (spec `prometeo.chat-evidence`, §3.4). Solo lectura: nunca aprueba ni
 * rechaza una evidencia, y el análisis visual solo se lanza con el clic del usuario (endpoint aparte, con tope y auditoría).
 * La auditoría NUNCA incluye el texto del mensaje ni el contenido de las evidencias.
 */
@Injectable()
export class ChatEvidenceChatService {
  private readonly logger = new Logger(ChatEvidenceChatService.name);

  constructor(
    private readonly evidence: ChatEvidenceService,
    @Optional() private readonly auditService?: AuditService,
  ) {}

  async prepare(input: {
    actor: RequestContext;
    message: string;
    requestId: string;
    mode?: ChatEvidenceMode;
  }): Promise<ChatEvidencePreparation | null> {
    const mode = input.mode ?? resolveChatEvidenceMode();
    if (mode === "off") return null;
    if (!isEvidenceReviewRequest(input.message)) return null;

    let listing: ChatEvidenceListing;
    try {
      listing = await this.evidence.listPending({
        tenantId: input.actor.tenantId,
        orgId: input.actor.orgId,
        userId: input.actor.userId,
        roles: input.actor.roles,
      });
    } catch (error) {
      // Un añadido: un fallo del servicio nunca rompe el chat.
      this.logger.warn(`[chat-evidence] listado fallido; el chat sigue sin evidencias: ${error instanceof Error ? error.message : String(error)}`);
      return null;
    }

    const canAnalyze = hasPermission(input.actor.roles, "vision:run");
    const analyzable = listing.items.filter((item) => item.analyzable);
    await this.audit(input.actor, input.requestId, {
      mode,
      listed: listing.items.length,
      remaining: listing.remaining,
      total: listing.total,
      analyzable: canAnalyze ? analyzable.length : 0,
    });
    if (mode === "shadow") return null;

    return {
      contextBlock: buildEvidenceContextBlock(listing.items, { remaining: listing.remaining }),
      systemInstruction: EVIDENCE_SYSTEM_INSTRUCTION,
      actions: canAnalyze ? analyzable.map((item) => this.buildAction(item.id)) : [],
    };
  }

  private buildAction(evidenceId: string): PrometeoProposedAction {
    return {
      id: `chat-${CHAT_EVIDENCE_ANALYZE_TOOL}-${evidenceId}`,
      namespace: "chat",
      tool: CHAT_EVIDENCE_ANALYZE_TOOL,
      label: "Analizar con visión",
      description: "Lanza el análisis visual de esta evidencia. Es una opinión asistida, no una aprobación.",
      riskLevel: "low",
      approvalPolicy: "confirm",
      requiresApproval: true,
      status: "proposed",
      input: { evidenceId },
      reason: "chat_evidence",
    };
  }

  private async audit(actor: RequestContext, requestId: string, detail: Record<string, unknown>): Promise<void> {
    if (!this.auditService) return;
    try {
      await this.auditService.append({
        id: `aud_chat_evidence_${Date.now()}_${Math.random().toString(16).slice(2, 8)}`,
        tenantId: actor.tenantId,
        orgId: actor.orgId,
        actorUserId: actor.userId,
        action: CHAT_EVIDENCE_LISTED_ACTION,
        entityType: "ChatEvidence",
        entityId: requestId,
        requestId,
        timestamp: new Date().toISOString(),
        afterJson: detail,
      });
    } catch (error) {
      // El listado es de solo lectura: un fallo de auditoría aquí no es una compuerta (a diferencia del análisis, que falla cerrado).
      this.logger.warn(`Audit failed for ${CHAT_EVIDENCE_LISTED_ACTION}: ${String(error)}`);
    }
  }
}
