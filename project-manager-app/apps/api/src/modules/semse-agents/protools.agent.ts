import { Injectable, Logger, Optional } from "@nestjs/common";
import type { LocationMultipliers } from "@semse/tools";
import type { SemseAgentMessage } from "./semse-agents.service.js";
import { SemseAgentsService } from "./semse-agents.service.js";
import { ToolsService } from "../tools/tools.service.js";
import { MaterialPricingService } from "../pricing/material-pricing.service.js";
import { LocationCostService } from "../pricing/location-cost.service.js";
import { ContractorRateService } from "../pricing/contractor-rate.service.js";

// ── ProTools Agent ────────────────────────────────────────────────────────────
// Inteligencia técnica: materiales, costos, checklists, riesgos.
// No maneja pagos, ni disputas, ni organiza proyectos.

export type ProToolsLocale = "es" | "en";

export type ProToolsEstimateInput = {
  trade:       string;
  description: string;
  locale?:     ProToolsLocale;
  area?:       number;
  rooms?:      number;
  projectId?:  string;
  zipCode?:    string;  // for regional cost adjustment
  userId?:     string;  // for contractor rate override lookup
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

const EN_TEXT: Record<string, string> = {
  "Verificar voltaje y capacidad del panel": "Verify panel voltage and capacity",
  "Confirmar gauge de cable según carga": "Confirm wire gauge for the load",
  "Instalar GFCI en áreas húmedas": "Install GFCI protection in wet areas",
  "Revisar distancia mínima 36\" frente al panel": "Verify minimum 36\" clearance in front of the panel",
  "Fotografiar antes de cerrar paredes": "Photograph before closing walls",
  "Cerrar llave de paso antes de empezar": "Shut off the water supply before starting",
  "Probar presión con manómetro 30 min": "Pressure-test with a gauge for 30 minutes",
  "Verificar pendientes hacia drenaje": "Verify slope toward drainage",
  "Sellar con teflón + pasta todas las roscas": "Seal threaded joints with PTFE tape and pipe compound",
  "Fotografiar antes de cubrir tuberías": "Photograph before covering pipes",
  "Verificar framing nivelado y a plomo": "Verify framing is level and plumb",
  "Usar drywall resistente a humedad en baños": "Use moisture-resistant drywall in bathrooms",
  "Aplicar 3 capas de compound con lija entre capas": "Apply 3 coats of joint compound, sanding between coats",
  "Usar mascarilla N95 al lijar": "Use an N95 respirator while sanding",
  "Fotografiar instalación antes de pintar": "Photograph installation before painting",
  "Limpiar superficie con TSP": "Clean the surface with TSP",
  "Aplicar primer en drywall nuevo": "Apply primer on new drywall",
  "Encintar marcos y molduras con blue tape": "Mask frames and trim with painter's tape",
  "Dos capas mínimas de color": "Apply at least two finish coats",
  "Documentar antes y después con fotos": "Document before and after with photos",
  "Revisar alcance del trabajo antes de empezar": "Review the work scope before starting",
  "Verificar materiales contra la lista": "Verify materials against the list",
  "Fotografiar estado inicial": "Photograph initial conditions",
  "Documentar avance por fase": "Document progress by phase",
  "Fotografiar trabajo terminado": "Photograph completed work",
  "Verificar permiso eléctrico requerido": "Verify whether an electrical permit is required",
  "Asbesto en instalaciones pre-1980": "Possible asbestos in pre-1980 installations",
  "Posible daño oculto por humedad": "Possible hidden moisture damage",
  "Verificar presión de agua": "Verify water pressure",
  "Posible humedad o moho detrás": "Possible hidden moisture or mold",
  "Verificar estructura de soporte": "Verify supporting structure",
  "VOCs — ventilación obligatoria": "VOCs — ventilation required",
  "No pintar sobre moho sin tratar": "Do not paint over untreated mold",
  "Cable NM-B 12/2": "12/2 NM-B cable",
  "Tomacorriente GFCI 20A": "20A GFCI receptacle",
  "Cajas eléctricas": "Electrical boxes",
  "Tubo CPVC 3/4\"": "3/4\" CPVC pipe",
  "Pegamento PVC": "PVC cement",
  "Cinta teflón": "PTFE tape",
  "Panel drywall 4×8 1/2\"": "4×8 1/2\" drywall panel",
  "Tornillos drywall": "Drywall screws",
  "Pintura satinada 1 galón": "1-gallon satin paint",
  "Primer 1 galón": "1-gallon primer",
  "Rodillo + bandeja": "Roller + tray",
  "Materiales generales": "General materials",
  "pies": "ft",
  "botes": "cans",
  "rollos": "rolls",
  "hojas": "sheets",
  "cubetas": "buckets",
  "galones": "gallons",
  "unidades": "units",
};

function localized(locale: ProToolsLocale, value: string): string {
  return locale === "en" ? (EN_TEXT[value] ?? value) : value;
}

@Injectable()
export class ProToolsAgent {
  private readonly logger = new Logger(ProToolsAgent.name);

  constructor(
    private readonly bus: SemseAgentsService,
    @Optional() private readonly tools?: ToolsService,
    @Optional() private readonly pricing?: MaterialPricingService,
    @Optional() private readonly locationCost?: LocationCostService,
    @Optional() private readonly contractorRate?: ContractorRateService,
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
    const locale: ProToolsLocale = input.locale === "en" ? "en" : "es";

    // Fetch live BLS material prices (non-blocking fallback to empty map)
    let livePrices: Record<string, number> = {};
    if (this.pricing) {
      try {
        livePrices = await this.pricing.getCurrentPrices();
      } catch {
        this.logger.debug("[ProTools] pricing.getCurrentPrices failed — using hardcoded defaults");
      }
    }

    // Fetch regional location multipliers if zipCode provided
    let liveLocation: LocationMultipliers | undefined;
    if (input.zipCode && this.locationCost) {
      try {
        liveLocation = await this.locationCost.getMultipliers(input.zipCode);
        this.logger.debug(`[ProTools] location multipliers for ${input.zipCode}: mat=${liveLocation.materialMultiplier} labor=${liveLocation.laborMultiplier}`);
      } catch {
        this.logger.debug("[ProTools] locationCost.getMultipliers failed — using national averages");
      }
    }

    // Contractor rate override takes priority over BLS location data
    let contractorOverride: Awaited<ReturnType<ContractorRateService["getOverride"]>> | null = null;
    if (input.userId && this.contractorRate) {
      try {
        contractorOverride = await this.contractorRate.getOverride(input.userId);
        if (contractorOverride) {
          liveLocation = {
            zipCode: input.zipCode ?? "00000",
            stateCode: liveLocation?.stateCode ?? "US",
            metro: undefined,
            materialMultiplier: contractorOverride.materialMultiplier,
            laborMultiplier:    contractorOverride.laborMultiplier,
            source: "manual" as const,
            fetchedAt: new Date().toISOString(),
          };
          this.logger.debug(`[ProTools] contractor rate override for user ${input.userId}: $${contractorOverride.laborRatePerHr}/hr, labor×${contractorOverride.laborMultiplier}`);
        }
      } catch {
        this.logger.debug("[ProTools] contractorRate.getOverride failed — using BLS data");
      }
    }

    // Use tools service if available; pass live prices + location through
    let toolResult: Record<string, unknown> | null | undefined = null;
    if (this.tools) {
      try {
        toolResult = this.tools.calculate({
          tool: input.trade,
          mode: "professional",
          input: {
            area: input.area ?? 100,
            rooms: input.rooms ?? 1,
          },
          prices: livePrices,
          location: liveLocation,
        }) as unknown as Record<string, unknown>;
      } catch {
        this.logger.debug("[ProTools] tools.calculate failed — using rules engine");
      }
    }

    // Rules-based fallback estimation
    const area   = input.area ?? 100;
    const rooms  = input.rooms ?? 1;
    const materials = this.estimateMaterials(trade, area, rooms, locale);
    const laborHours = this.estimateLabor(trade, area, rooms);
    const baseMaterials = materials.reduce((s, m) => s + m.total, 0);
    const totalMaterials = contractorOverride
      ? Math.round(baseMaterials * contractorOverride.materialMultiplier)
      : Math.round(baseMaterials);
    const laborRate = contractorOverride?.laborRatePerHr ?? 35; // $/hr: contractor override or BLS-based default
    const totalLabor = laborHours * laborRate;

    const riskFlags = [
      ...(TRADE_RISKS[trade] ?? []).map((flag) => localized(locale, flag)),
      ...(toolResult?.riskFlags as string[] ?? []),
    ];

    const checklist = (TRADE_CHECKLISTS[trade] ?? TRADE_CHECKLISTS.default!)
      .map((item) => localized(locale, item));

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
      agentNote: locale === "en"
        ? `ProTools estimate for ${input.trade}. ${toolResult ? "Tool-assisted." : "Rules-based — verify quantities on site."} ${contractorOverride ? `Custom rates applied (${contractorOverride.laborRatePerHr}/hr, markup ${(contractorOverride.materialMarkup * 100).toFixed(1)}%).` : ""} Does not replace local inspection or required licensing.`
        : `Estimado ProTools para ${input.trade}. ${toolResult ? "Asistido por herramientas." : "Basado en reglas — verificar cantidades en sitio."} ${contractorOverride ? `Tarifas propias aplicadas (${contractorOverride.laborRatePerHr}/hr, markup ${(contractorOverride.materialMarkup * 100).toFixed(1)}%).` : ""} No reemplaza inspección local ni licencias requeridas.`,
    };
  }

  private estimateMaterials(trade: string, area: number, rooms: number, locale: ProToolsLocale): ProToolsEstimateResult["materials"] {
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
    return items.map((m) => ({
      ...m,
      item: localized(locale, m.item),
      unit: localized(locale, m.unit),
      total: Math.round(m.qty * m.unitCost * 100) / 100,
    }));
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
