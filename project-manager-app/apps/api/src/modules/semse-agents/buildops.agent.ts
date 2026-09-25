import { Injectable, Logger } from "@nestjs/common";
import type { SemseAgentMessage } from "./semse-agents.service.js";
import { SemseAgentsService } from "./semse-agents.service.js";

export type ProjectPlan = {
  phases: Array<{
    name: string;
    durationDays: number;
    tasks: string[];
    milestoneTitle: string;
    evidenceRequired: string[];
  }>;
  totalDays: number;
  criticalPath: string[];
  /** Real trace of the planning logic — not LLM-generated. */
  reasoningSteps: string[];
};

const TRADE_PHASES: Record<string, ProjectPlan["phases"]> = {
  electrical: [
    { name: "Rough-in", durationDays: 2, tasks: ["Instalar cajas", "Pasar cable", "Conectar panel"], milestoneTitle: "Rough-in eléctrico completado", evidenceRequired: ["Foto cable instalado", "Foto cajas eléctricas", "Foto panel"] },
    { name: "Finish", durationDays: 1, tasks: ["Instalar dispositivos", "Pruebas GFCI/AFCI", "Etiquetas panel"], milestoneTitle: "Instalación eléctrica terminada", evidenceRequired: ["Foto tomacorrientes", "Foto prueba GFCI", "Foto panel final"] },
  ],
  plumbing: [
    { name: "Rough-in", durationDays: 2, tasks: ["Instalar tuberías", "Conectar drenaje", "Prueba de presión"], milestoneTitle: "Rough-in plomería completado", evidenceRequired: ["Foto tubería instalada", "Foto prueba presión", "Foto drenaje"] },
    { name: "Finish", durationDays: 1, tasks: ["Instalar fixtures", "Sellar penetraciones", "Prueba final"], milestoneTitle: "Plomería terminada", evidenceRequired: ["Foto fixtures", "Foto prueba agua", "Foto sellos"] },
  ],
  drywall: [
    { name: "Instalación", durationDays: 2, tasks: ["Instalar paneles", "Tape y mud", "Primera capa"], milestoneTitle: "Paneles instalados", evidenceRequired: ["Foto paneles", "Foto cinta aplicada"] },
    { name: "Acabado", durationDays: 3, tasks: ["Segunda capa mud", "Lijar", "Pintura primaria"], milestoneTitle: "Drywall terminado", evidenceRequired: ["Foto superficie lisa", "Foto acabado final"] },
  ],
  painting: [
    { name: "Preparación", durationDays: 1, tasks: ["Limpiar superficie", "Aplicar primer", "Proteger área"], milestoneTitle: "Superficie preparada", evidenceRequired: ["Foto prep", "Foto primer"] },
    { name: "Pintura", durationDays: 2, tasks: ["Primera capa", "Segunda capa", "Detalles"], milestoneTitle: "Pintura terminada", evidenceRequired: ["Foto primera capa", "Foto acabado final"] },
  ],
};

@Injectable()
export class BuildOpsAgent {
  private readonly logger = new Logger(BuildOpsAgent.name);

  constructor(private readonly bus: SemseAgentsService) {
    this.bus.register("buildops", (msg) => this.handleMessage(msg));
    this.logger.log("[BuildOps] Agent registered");
  }

  async handleMessage(msg: SemseAgentMessage): Promise<void> {
    if (msg.event === "PROJECT_PLANNED") {
      const classification = msg.payload.classification as Record<string, unknown> | undefined;
      const trade = String(classification?.trade ?? "general");
      const plan = this.createPlan(trade, Number(classification?.estimatedHours ?? 8));

      this.bus.dispatch(this.bus.makeMessage({
        from: "buildops", to: "evidence", event: "MILESTONE_CREATED",
        payload: { plan, milestones: plan.phases.map((p) => p.milestoneTitle) },
        projectId: msg.projectId,
      }));
    }
  }

  createPlan(trade: string, estimatedHours: number): ProjectPlan {
    const hasTemplate = trade in TRADE_PHASES;
    const phases = TRADE_PHASES[trade] ?? [
      { name: "Ejecución", durationDays: Math.ceil(estimatedHours / 8), tasks: ["Ejecutar trabajo"], milestoneTitle: "Trabajo completado", evidenceRequired: ["Foto antes", "Foto durante", "Foto después"] },
    ];
    const totalDays = phases.reduce((s, p) => s + p.durationDays, 0);
    const criticalPath = phases.map((p) => p.name);

    const reasoningSteps: string[] = [
      hasTemplate
        ? `Trade "${trade}" tiene plantilla de fases predefinida (${phases.length} fases: ${phases.map((p) => p.name).join(", ")}).`
        : `Trade "${trade}" no tiene plantilla predefinida → genero una fase única de ${Math.ceil(estimatedHours / 8)} día(s) a partir de ${estimatedHours}h estimadas.`,
      `Duración total: ${totalDays} día(s) = suma de la duración de cada fase.`,
      `Ruta crítica: ${criticalPath.join(" → ")} (fases tratadas como secuenciales; no hay paralelismo modelado aún).`,
      `Evidencia requerida por fase queda definida en el plan para que Evidence genere el checklist correspondiente.`,
    ];

    return { phases, totalDays, criticalPath, reasoningSteps };
  }
}
