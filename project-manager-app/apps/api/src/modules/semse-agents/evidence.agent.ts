import { Injectable, Logger } from "@nestjs/common";
import type { SemseAgentMessage } from "./semse-agents.service.js";
import { SemseAgentsService } from "./semse-agents.service.js";

export type EvidenceChecklist = {
  milestoneTitle: string;
  required: Array<{ label: string; kind: string; phase: string; description: string }>;
  disputeRisk: "low" | "medium" | "high";
};

const EVIDENCE_TEMPLATES: Record<string, EvidenceChecklist["required"]> = {
  electrical: [
    { label: "Foto rough-in eléctrico",   kind: "photo",    phase: "rough_in",  description: "Foto de cables y cajas antes de cerrar paredes" },
    { label: "Prueba GFCI documentada",   kind: "test",     phase: "finish",    description: "Foto del botón test/reset activado" },
    { label: "Etiquetas panel completas", kind: "photo",    phase: "finish",    description: "Foto del panel con todos los breakers etiquetados" },
    { label: "Inspección municipal",       kind: "document", phase: "closeout",  description: "Sticker o carta de inspección aprobada si aplica" },
  ],
  plumbing: [
    { label: "Foto tubería instalada",    kind: "photo",    phase: "rough_in",  description: "Foto de tuberías antes de cubrir" },
    { label: "Prueba de presión",          kind: "test",     phase: "rough_in",  description: "Foto del manómetro durante 30 min de prueba" },
    { label: "Foto fixtures terminados",  kind: "photo",    phase: "finish",    description: "Foto de griferías y fixtures instalados" },
    { label: "Prueba de flujo final",      kind: "test",     phase: "finish",    description: "Video corto mostrando flujo sin fugas" },
  ],
  drywall: [
    { label: "Foto instalación paneles",  kind: "photo",    phase: "install",   description: "Foto antes de aplicar compound" },
    { label: "Foto acabado listo pintar", kind: "photo",    phase: "finish",    description: "Foto superficie lisa lista para pintura" },
  ],
  painting: [
    { label: "Foto antes de pintar",      kind: "photo",    phase: "prep",      description: "Estado inicial de la superficie" },
    { label: "Foto primer aplicado",      kind: "photo",    phase: "prep",      description: "Primer aplicado en superficie preparada" },
    { label: "Foto acabado final",        kind: "photo",    phase: "finish",    description: "Resultado final de pintura" },
  ],
};

@Injectable()
export class EvidenceAgent {
  private readonly logger = new Logger(EvidenceAgent.name);

  constructor(private readonly bus: SemseAgentsService) {
    this.bus.register("evidence", (msg) => this.handleMessage(msg));
    this.logger.log("[Evidence] Agent registered");
  }

  async handleMessage(msg: SemseAgentMessage): Promise<void> {
    if (msg.event === "MILESTONE_CREATED") {
      const milestones = (msg.payload.milestones as string[] | undefined) ?? [];
      for (const milestone of milestones) {
        const checklist = this.generateChecklist(milestone, "general");
        this.logger.debug(`[Evidence] Generated checklist for milestone: ${milestone} (${checklist.required.length} items)`);
      }
    }

    if (msg.event === "EVIDENCE_UPLOADED") {
      // Trigger review and potentially notify crowd to unblock payment
      this.bus.dispatch(this.bus.makeMessage({
        from: "evidence", to: "crowd", event: "EVIDENCE_VERIFIED",
        payload: { evidenceId: msg.payload.evidenceId, approved: true },
        projectId: msg.projectId,
      }));
    }
  }

  generateChecklist(milestoneTitle: string, trade: string): EvidenceChecklist {
    const lower = milestoneTitle.toLowerCase();
    const matchedTrade = Object.keys(EVIDENCE_TEMPLATES).find((t) => lower.includes(t)) ?? trade;
    const required = EVIDENCE_TEMPLATES[matchedTrade] ?? [
      { label: "Foto antes de empezar",  kind: "photo",    phase: "before",   description: "Estado inicial del área de trabajo" },
      { label: "Foto trabajo terminado", kind: "photo",    phase: "after",    description: "Resultado final del trabajo" },
    ];

    const disputeRisk: EvidenceChecklist["disputeRisk"] = required.length > 3 ? "high" : required.length > 2 ? "medium" : "low";
    return { milestoneTitle, required, disputeRisk };
  }
}
