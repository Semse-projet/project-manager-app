import { Injectable, Logger } from "@nestjs/common";
import { PrismaService } from "../../infrastructure/prisma/prisma.service.js";
import { AiModelGatewayService } from "../ai-models/gateway/ai-model-gateway.service.js";

export type BudgetSuggestion = {
  min: number;
  max: number;
  median: number;
  currency: string;
  confidence: "high" | "medium" | "low";
  basis: string;
  similarJobsFound: number;
  factors: Array<{ name: string; impact: "increases" | "decreases" | "neutral"; note: string }>;
  aiNarrative: string;
  calculatedAt: string;
};

type JobRecord = {
  budgetMin: unknown;
  budgetMax: unknown;
  title: string;
  category: string | null;
};

function toNum(v: unknown): number {
  return parseFloat(String(v ?? 0)) || 0;
}

function percentile(arr: number[], p: number): number {
  if (arr.length === 0) return 0;
  const sorted = [...arr].sort((a, b) => a - b);
  const idx = (p / 100) * (sorted.length - 1);
  const lo = Math.floor(idx);
  const hi = Math.ceil(idx);
  return sorted[lo] + (sorted[hi] - sorted[lo]) * (idx - lo);
}

function simpleKeywordMatch(title: string, scope: string, candidate: string): number {
  const normalize = (s: string) => s.toLowerCase().split(/\W+/).filter(w => w.length > 3);
  const target = [...normalize(title), ...normalize(scope)];
  const source = normalize(candidate);
  const matches = target.filter(w => source.includes(w)).length;
  return matches / Math.max(1, target.length);
}

@Injectable()
export class BudgetIntelligenceService {
  private readonly logger = new Logger(BudgetIntelligenceService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly gateway: AiModelGatewayService,
  ) {}

  async suggestBudget(input: {
    tenantId: string;
    userId: string;
    title: string;
    scope: string;
    category?: string;
    location?: string;
  }): Promise<BudgetSuggestion> {
    // 1. Load historical jobs with budgets
    const historicalJobs = await this.prisma.job.findMany({
      where: {
        tenantId: input.tenantId,
        status: { in: ["COMPLETED", "IN_PROGRESS", "AWARDED", "REVIEW"] },
        budgetMin: { not: null },
      },
      select: { budgetMin: true, budgetMax: true, title: true, category: true },
      take: 200,
      orderBy: { createdAt: "desc" },
    }) as JobRecord[];

    // 2. Also get all published/any jobs for broader reference (even without status filter)
    const allJobs = await this.prisma.job.findMany({
      where: {
        tenantId: input.tenantId,
        budgetMin: { not: null },
      },
      select: { budgetMin: true, budgetMax: true, title: true, category: true },
      take: 200,
    }) as JobRecord[];

    const referenceJobs = [...historicalJobs, ...allJobs]
      .filter((j, i, arr) => arr.findIndex(x => x.title === j.title) === i); // dedupe

    // 3. Score and filter similar jobs
    const scored = referenceJobs.map(job => ({
      job,
      similarity: simpleKeywordMatch(input.title, input.scope, job.title ?? ""),
      categoryMatch: input.category && job.category
        ? job.category.toLowerCase() === input.category.toLowerCase() ? 1 : 0
        : 0,
    }));

    const similar = scored
      .filter(s => s.similarity > 0.1 || s.categoryMatch > 0)
      .sort((a, b) => (b.similarity + b.categoryMatch) - (a.similarity + a.categoryMatch))
      .slice(0, 20);

    // 4. Extract budget ranges
    const mins = similar.map(s => toNum(s.job.budgetMin)).filter(v => v > 0);
    const maxs = similar.map(s => toNum(s.job.budgetMax ?? s.job.budgetMin)).filter(v => v > 0);
    const mids = similar.map(s => (toNum(s.job.budgetMin) + toNum(s.job.budgetMax ?? s.job.budgetMin)) / 2).filter(v => v > 0);

    // 5. If not enough data, use category averages
    let budgetMin: number;
    let budgetMax: number;
    let budgetMedian: number;
    let confidence: BudgetSuggestion["confidence"];
    let basisNote: string;
    let similarJobsFound = similar.length;

    if (mids.length >= 3) {
      budgetMin = Math.round(percentile(mins, 25));
      budgetMax = Math.round(percentile(maxs, 75));
      budgetMedian = Math.round(percentile(mids, 50));
      confidence = mids.length >= 8 ? "high" : "medium";
      basisNote = `Basado en ${similar.length} trabajos similares en el historial del sistema`;
    } else if (referenceJobs.length > 0) {
      // Broader average
      const allMins = referenceJobs.map(j => toNum(j.budgetMin)).filter(v => v > 0);
      const allMaxs = referenceJobs.map(j => toNum(j.budgetMax ?? j.budgetMin)).filter(v => v > 0);
      const avg = (allMins.reduce((s, v) => s + v, 0) + allMaxs.reduce((s, v) => s + v, 0)) / (allMins.length + allMaxs.length);
      budgetMin = Math.round(avg * 0.6);
      budgetMax = Math.round(avg * 1.4);
      budgetMedian = Math.round(avg);
      confidence = "low";
      similarJobsFound = referenceJobs.length;
      basisNote = `Sin trabajos directamente similares — estimado del promedio general del sistema (${referenceJobs.length} trabajos)`;
    } else {
      // No historical data — use AI only
      budgetMin = 0;
      budgetMax = 0;
      budgetMedian = 0;
      confidence = "low";
      basisNote = "Sin datos históricos — estimación basada en análisis de IA";
    }

    // 6. Factors analysis
    const factors: BudgetSuggestion["factors"] = [];
    const scopeWords = input.scope.toLowerCase();
    if (scopeWords.includes("urgente") || scopeWords.includes("inmediato") || scopeWords.includes("express")) {
      factors.push({ name: "Urgencia", impact: "increases", note: "Trabajos urgentes tienen sobrecosto del 15-25%" });
    }
    if (scopeWords.includes("fuera de") || input.location?.includes("fuera")) {
      factors.push({ name: "Trabajo fuera de ciudad", impact: "increases", note: "Viáticos y tiempo de traslado suman al costo" });
    }
    if (scopeWords.includes("premium") || scopeWords.includes("lujo") || scopeWords.includes("alta calidad")) {
      factors.push({ name: "Acabados premium", impact: "increases", note: "Materiales premium pueden duplicar el costo de materiales" });
    }
    if (scopeWords.includes("pequeño") || scopeWords.includes("básico") || scopeWords.includes("menor")) {
      factors.push({ name: "Alcance reducido", impact: "decreases", note: "Proyectos de menor alcance están en el rango inferior" });
    }
    if (factors.length === 0) {
      factors.push({ name: "Alcance estándar", impact: "neutral", note: "Sin factores especiales detectados en la descripción" });
    }

    // 7. AI narrative
    const aiNarrative = await this.buildAiNarrative(input, budgetMin, budgetMax, budgetMedian, similar.length, confidence);

    this.logger.log(`[budget] suggest tenantId=${input.tenantId} min=${budgetMin} max=${budgetMax} similar=${similar.length} confidence=${confidence}`);

    return {
      min: budgetMin,
      max: budgetMax,
      median: budgetMedian,
      currency: "MXN",
      confidence,
      basis: basisNote,
      similarJobsFound,
      factors,
      aiNarrative,
      calculatedAt: new Date().toISOString(),
    };
  }

  private async buildAiNarrative(
    input: { title: string; scope: string; category?: string },
    min: number, max: number, median: number,
    similarCount: number,
    confidence: string,
  ): Promise<string> {
    if (min === 0 && max === 0) {
      return "No hay suficientes datos históricos para generar una estimación confiable. Te recomiendo solicitar 3 cotizaciones de profesionales verificados para establecer un rango real.";
    }

    const prompt = `Eres un experto en presupuestos de construcción y servicios en México.

Trabajo: "${input.title}"
Descripción: "${input.scope}"
Categoría: ${input.category ?? "general"}
Datos del sistema: ${similarCount} trabajos similares encontrados
Rango estimado: $${min.toLocaleString()} - $${max.toLocaleString()} MXN (mediana $${median.toLocaleString()})
Confianza: ${confidence}

Escribe una explicación corta (3-4 oraciones) en español que:
1. Explique por qué el rango es razonable para este tipo de trabajo
2. Mencione qué factores podrían llevar el precio al techo o al piso del rango
3. Dé una recomendación práctica al cliente

Sé directo y conversacional. No uses listas. Máximo 100 palabras.`;

    try {
      const response = await this.gateway.generate({
        agentId: "budget-intelligence",
        userId: "system",
        taskType: "estimate_review",
        input: prompt,
        temperature: 0.3,
        maxTokens: 200,
      });
      return response.output.trim();
    } catch {
      return `Para este tipo de trabajo, el rango de $${min.toLocaleString()} - $${max.toLocaleString()} MXN refleja el mercado local basado en ${similarCount} proyectos similares. La mediana de $${median.toLocaleString()} es un buen punto de partida para negociar.`;
    }
  }
}
