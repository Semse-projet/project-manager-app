import { Injectable, Logger, Optional } from "@nestjs/common";
import { PrismaService } from "../../infrastructure/prisma/prisma.service.js";
import type { SemseAgentMessage } from "./semse-agents.service.js";
import { SemseAgentsService } from "./semse-agents.service.js";
import type { PrometeoService } from "../prometeo/prometeo.service.js";

export type ProjectNarrative = {
  summary:      string;
  nextAction:   string;
  riskLevel:    "low" | "medium" | "high";
  citations:    string[];
  fromRAG:      boolean;
  /** No unverified bus message is allowed to grant private RAG access. */
  ragDiagnostic?: "RAG_SCOPE_UNAVAILABLE" | "RAG_SERVICE_UNAVAILABLE";
};

@Injectable()
export class PrometeoAgent {
  private readonly logger = new Logger(PrometeoAgent.name);

  constructor(
    private readonly bus: SemseAgentsService,
    private readonly prisma: PrismaService,
    @Optional() private readonly prometeo?: PrometeoService,
  ) {
    this.bus.register("prometeo", (msg) => this.handleMessage(msg));
    this.logger.log("[Prometeo] Agent registered");
  }

  async handleMessage(msg: SemseAgentMessage): Promise<void> {
    if (msg.event === "PAYMENT_RELEASE_REQUESTED") {
      const narrative = await this.explainPaymentStatus(msg.payload, msg.projectId);
      this.logger.log(`[Prometeo] Payment narrative: ${narrative.summary.slice(0, 80)}`);

      // Create in-app notification: payment is ready for review
      const tenantId = String(msg.payload.tenantId ?? "tenant_default");
      const professionalUserId = String(msg.payload.professionalUserId ?? "");
      if (professionalUserId) {
        await this.prisma.notification.create({
          data: {
            tenantId,
            userId:    professionalUserId,
            type:      "payment_release_requested",
            title:     "Pago listo para liberar",
            body:      narrative.summary,
            payload:   { projectId: msg.projectId, narrative: narrative.nextAction } as object,
          },
        }).catch((err) => this.logger.warn(`[Prometeo] Notification failed: ${(err as Error).message}`));
      }
    }

    if (msg.event === "CONTEXT_REQUESTED") {
      const query = String(msg.payload.query ?? "estado del proyecto");
      const narrative = await this.generateNarrative(query, msg.projectId, msg.payload.tenantId as string);
      this.bus.dispatch(this.bus.makeMessage({
        from: "prometeo", to: msg.from, event: "NARRATIVE_GENERATED",
        payload: { narrative }, projectId: msg.projectId,
      }));
    }
  }

  async generateNarrative(query: string, projectId: string, _tenantId: string): Promise<ProjectNarrative> {
    // CONTEXT_REQUESTED is an in-memory bus event, not an authenticated actor.
    // Project/tenant IDs (and any org/user/scope fields) may be forged by the
    // producer. Do not call RAG or pass a fabricated scope on this path.
    // #1007 owns the verified actor/service-principal recovery contract.
    const ragDiagnostic = this.prometeo ? "RAG_SCOPE_UNAVAILABLE" : "RAG_SERVICE_UNAVAILABLE";
    return {
      summary: `Análisis del proyecto ${projectId}: ${query}. Contexto documental privado no disponible sin autorización verificada.`,
      nextAction: "Solicitar acceso documental autorizado antes de citar fuentes",
      riskLevel: "medium",
      citations: [],
      fromRAG: false,
      ragDiagnostic,
    };
  }

  async explainPaymentStatus(payload: Record<string, unknown>, projectId: string): Promise<ProjectNarrative> {
    const readyForRelease = Boolean(payload.readyForRelease);
    return {
      summary:    readyForRelease
        ? `El proyecto ${projectId} tiene toda la evidencia aprobada y está listo para liberar el pago.`
        : `El proyecto ${projectId} tiene bloqueadores pendientes. Revisar evidencia y change orders.`,
      nextAction: readyForRelease ? "Proceder con liberación de pago" : "Resolver bloqueadores antes de liberar pago",
      riskLevel:  readyForRelease ? "low" : "medium",
      citations:  [],
      fromRAG:    false,
    };
  }
}
