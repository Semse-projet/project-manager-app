import { Injectable, Logger, Optional } from "@nestjs/common";
import type { SemseAgentMessage } from "./semse-agents.service.js";
import { SemseAgentsService } from "./semse-agents.service.js";
import { ToolsService } from "../tools/tools.service.js";

// ── ProTools Agent ────────────────────────────────────────────────────────────
// Inteligencia técnica: materiales, costos, checklists, riesgos.
// No maneja pagos, ni disputas, ni organiza proyectos.

export type ProToolsEstimateInput = {
  trade:       string;
  description: string;
  area?:       number;
  rooms?:      number;
  projectId?:  string;
};

export type ProToolsEstimateResult = {
  trade:         string;
  materials:     Array<{ item: string; qty: number; unit: string; unitCost: number; total: number }>;
  laborHours:    number;
  totalMaterials: number;
  totalLabor:    number;
  totalCost:     number;
  riskFlags:     string[];
  checklist:     string[];
  confidence:    number;
  agentNote:     string;
};

const TRADE_CHECKLISTS: Record<string, string[]> = {
  electrical: [
    "Verificar voltaje y capacidad del panel",
    "Confirmar gauge de cable según carga",
    "Instalar GFCI en áreas húmedas",
    "Revisar distancia mínima 36\" frente al panel",
    "Fotografiar antes de cerrar paredes",
  ],
  plumbing: [
    "Cerrar llave de paso antes de empezar",
    "Probar presión con manómetro 30 min",
    "Verificar pendientes hacia drenaje",
    "Sellar con teflón + pasta todas las roscas",
    "Fotografiar antes de cubrir tuberías",
  ],
  drywall: [
    "Verificar framing nivelado y a plomo",
    "Usar drywall resistente a humedad en baños",
    "Aplicar 3 capas de compound con lija entre capas",
    "Usar mascarilla N95 al lijar",
    "Fotografiar instalación antes de pintar",
  ],
  painting: [
    "Limpiar superficie con TSP",
    "Aplicar primer en drywall nuevo",
    "Encintar marcos y molduras con blue tape",
    "Dos capas mínimas de color",
    "Documentar antes y después con fotos",
  ],
  default: [
    "Revisar alcance del trabajo antes de empezar",
    "Verificar materiales contra la lista",
    "Fotografiar estado inicial",
    "Documentar avance por fase",
    "Fotografiar trabajo terminado",
  ],
};

const TRADE_RISKS: Record<string, string[]> = {
  electrical: ["Verificar permiso eléctrico requerido", "Asbesto en instalaciones pre-1980"],
  plumbing:   ["Posible daño oculto por humedad", "Verificar presión de agua"],
  drywall:    ["Posible humedad o moho detrás", "Verificar estructura de soporte"],
  painting:   ["VOCs — ventilación obligatoria", "No pintar sobre moho sin tratar"],
};

@Injectable()
export class ProToolsAgent {
  private readonly logger = new Logger(ProToolsAgent.name);

  constructor(
    private readonly bus: SemseAgentsService,
    @Optional() private readonly tools?: ToolsService,
  ) {
    // Register as handler for ESTIMATE_REQUESTED events
    this.bus.register("protools", (msg) => this.handleMessage(msg));
    this.logger.log("[ProTools] Agent registered on event bus");
  }

  async handleMessage(msg: SemseAgentMessage): Promise<void> {
    if (msg.event === "ESTIMATE_REQUESTED") {
      const input = msg.payload as ProToolsEstimateInput;
      const result = await this.estimate(input);

      // Emit MATERIALS_CALCULATED back to the requesting agent
      this.bus.dispatch(this.bus.makeMessage({
        from:       "protools",
        to:         msg.from,
        event:      "MATERIALS_CALCULATED",
        payload:    { estimate: result, originalProjectId: msg.projectId },
        projectId:  msg.projectId,
      }));
    }
  }

  async estimate(input: ProToolsEstimateInput): Promise<ProToolsEstimateResult> {
    const trade = input.trade.toLowerCase();

    // Use tools service if available, otherwise use rules engine
    let toolResult: Record<string, unknown> | null | undefined = null;
    if (this.tools) {
      try {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
    toolResult = await (this.tools as any).runTool?.("calculate", {
          trade: input.trade,
          description: input.description,
          area: input.area,
          rooms: input.rooms,
          projectId: input.projectId,
        }) as Record<string, unknown> | undefined;
      } catch {
        this.logger.debug("[ProTools] tools.runTool failed — using rules engine");
      }
    }

    // Rules-based fallback estimation
    const area   = input.area ?? 100;
    const rooms  = input.rooms ?? 1;
    const materials = this.estimateMaterials(trade, area, rooms);
    const laborHours = this.estimateLabor(trade, area, rooms);
    const totalMaterials = materials.reduce((s, m) => s + m.total, 0);
    const laborRate = 35; // $/hr default
    const totalLabor = laborHours * laborRate;

    const riskFlags = [
      ...(TRADE_RISKS[trade] ?? []),
      ...(toolResult?.riskFlags as string[] ?? []),
    ];

    const checklist = TRADE_CHECKLISTS[trade] ?? TRADE_CHECKLISTS.default!;

    return {
      trade:          input.trade,
      materials,
      laborHours,
      totalMaterials: Math.round(totalMaterials),
      totalLabor:     Math.round(totalLabor),
      totalCost:      Math.round(totalMaterials + totalLabor),
      riskFlags,
      checklist,
      confidence:     toolResult ? 0.85 : 0.65,
      agentNote:      `ProTools estimate for ${input.trade}. ${toolResult ? "Tool-assisted." : "Rules-based — verify quantities on site."} No reemplaza inspección local ni licencias requeridas.`,
    };
  }

  private estimateMaterials(trade: string, area: number, rooms: number): ProToolsEstimateResult["materials"] {
    const base: Record<string, ProToolsEstimateResult["materials"]> = {
      electrical: [
        { item: "Cable NM-B 12/2", qty: Math.ceil(area * 0.8), unit: "pies", unitCost: 0.65, total: 0 },
        { item: "Tomacorriente GFCI 20A", qty: rooms * 2, unit: "pcs", unitCost: 22, total: 0 },
        { item: "Breaker 20A", qty: rooms, unit: "pcs", unitCost: 18, total: 0 },
        { item: "Cajas eléctricas", qty: rooms * 4, unit: "pcs", unitCost: 1.25, total: 0 },
      ],
      plumbing: [
        { item: "Tubo CPVC 3/4\"", qty: Math.ceil(area * 0.3), unit: "pies", unitCost: 1.20, total: 0 },
        { item: "Pegamento PVC", qty: 2, unit: "botes", unitCost: 12, total: 0 },
        { item: "Cinta teflón", qty: rooms * 2, unit: "rollos", unitCost: 2.50, total: 0 },
      ],
      drywall: [
        { item: "Panel drywall 4×8 1/2\"", qty: Math.ceil(area / 32), unit: "hojas", unitCost: 14, total: 0 },
        { item: "Joint compound", qty: Math.ceil(area / 200), unit: "cubetas", unitCost: 18, total: 0 },
        { item: "Tornillos drywall", qty: Math.ceil(area / 10), unit: "lbs", unitCost: 3.50, total: 0 },
      ],
      painting: [
        { item: "Pintura satinada 1 galón", qty: Math.ceil(area / 350), unit: "galones", unitCost: 38, total: 0 },
        { item: "Primer 1 galón", qty: Math.ceil(area / 400), unit: "galones", unitCost: 28, total: 0 },
        { item: "Rodillo + bandeja", qty: rooms, unit: "sets", unitCost: 12, total: 0 },
      ],
    };

    const items = base[trade] ?? [{ item: "Materiales generales", qty: Math.ceil(area / 10), unit: "unidades", unitCost: 25, total: 0 }];
    return items.map((m) => ({ ...m, total: Math.round(m.qty * m.unitCost * 100) / 100 }));
  }

  private estimateLabor(trade: string, area: number, rooms: number): number {
    const rates: Record<string, number> = {
      electrical: area * 0.15 + rooms * 4,
      plumbing:   area * 0.08 + rooms * 3,
      drywall:    area * 0.12,
      painting:   area * 0.06 + rooms * 2,
    };
    return Math.ceil(rates[trade] ?? area * 0.10);
  }
}
