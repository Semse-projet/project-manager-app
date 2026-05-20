import { Injectable, Logger, Optional } from "@nestjs/common";
import { PrismaService } from "../../infrastructure/prisma/prisma.service.js";
import type { SemseAgentMessage } from "./semse-agents.service.js";
import { SemseAgentsService } from "./semse-agents.service.js";

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
    }
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
