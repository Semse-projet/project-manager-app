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

  async generateNarrative(query: string, projectId: string, tenantId: string): Promise<ProjectNarrative> {
    let ragCitations: string[] = [];
    let fromRAG = false;

    if (this.prometeo) {
      try {
        const ctx = await this.prometeo.retrieveContext({
          query, tenantId, projectId, topK: 3,
        });
        if (ctx.available) {
          ragCitations = ctx.citations.map((c) => c.documentTitle);
          fromRAG = true;
        }
      } catch { /* fallback */ }
    }

    return {
      summary:    `Análisis del proyecto ${projectId}: ${query}. ${fromRAG ? "Basado en documentación indexada." : "Sin contexto documental disponible."}`,
      nextAction: fromRAG ? "Consultar la documentación citada para más detalles" : "Subir documentos relevantes a Prometeo RAG",
      riskLevel:  "medium",
      citations:  ragCitations,
      fromRAG,
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
