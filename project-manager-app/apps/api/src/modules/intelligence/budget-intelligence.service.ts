import { Injectable, Logger, Optional } from "@nestjs/common";
import { PUBLIC_MARKET_CURRENCY } from "@semse/schemas";
import { PrismaService } from "../../infrastructure/prisma/prisma.service.js";
import { AiModelGatewayService } from "../ai-models/gateway/ai-model-gateway.service.js";
import { LocationCostService } from "../pricing/location-cost.service.js";

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
    @Optional() private readonly locationCost?: LocationCostService,
  ) {}

  async suggestBudget(input: {
    tenantId: string;
    userId: string;
    title: string;
    scope: string;
    category?: string;
    location?: string;
    /** Approximate project area in square feet, when known (e.g. from smart-intake). */
    areaSqft?: number;
    /** ZIP code for regional cost adjustment. Falls back to a 5-digit ZIP found in `location`. */
    zipCode?: string;
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
    } else {
      // Not enough directly-similar jobs. Previously this fell back to averaging
      // ALL reference jobs regardless of category — a "reparación de fugas" (leak
      // repair, reference ~$80) could get blended with unrelated large remodel
      // jobs and come out as $2,000+. Never mix unrelated categories: only widen
      // to a same-category average, and if there isn't one, don't fabricate a
      // number at all (see 0.29 in AUDIT_REMEDIATION_PLAN.md).
      const sameCategoryJobs = input.category
        ? referenceJobs.filter(j => (j.category ?? "").toLowerCase() === input.category!.toLowerCase())
        : [];

      if (sameCategoryJobs.length > 0) {
        const catMins = sameCategoryJobs.map(j => toNum(j.budgetMin)).filter(v => v > 0);
        const catMaxs = sameCategoryJobs.map(j => toNum(j.budgetMax ?? j.budgetMin)).filter(v => v > 0);
        const avg = (catMins.reduce((s, v) => s + v, 0) + catMaxs.reduce((s, v) => s + v, 0)) / (catMins.length + catMaxs.length);
        budgetMin = Math.round(avg * 0.6);
        budgetMax = Math.round(avg * 1.4);
        budgetMedian = Math.round(avg);
        confidence = "low";
        similarJobsFound = sameCategoryJobs.length;
        basisNote = `Sin trabajos directamente similares — estimado del promedio de la categoría "${input.category}" (${sameCategoryJobs.length} trabajos), sin mezclar con otras categorías`;
      } else {
        // No same-category history either — do not guess. Same shape as the
        // "no historical data at all" case: no auto-applied number, explicit
        // low-confidence signal, AI narrative recommends manual quotes instead.
        budgetMin = 0;
        budgetMax = 0;
        budgetMedian = 0;
        confidence = "low";
        similarJobsFound = 0;
        basisNote = input.category
          ? `Sin trabajos de la categoría "${input.category}" en el historial — no hay base confiable para un rango automático; se recomienda revisión manual o cotizaciones directas`
          : "Sin categoría ni trabajos directamente similares — no hay base confiable para un rango automático; se recomienda revisión manual o cotizaciones directas";
      }
    }

    // 6. Regional cost adjustment (LocationCostService) — applied to whatever
    // range was computed above, skipped for the explicit "no data" zero-state.
    const factors: BudgetSuggestion["factors"] = [];
    const resolvedZip = input.zipCode ?? input.location?.match(/\b\d{5}\b/)?.[0];
    if (resolvedZip && this.locationCost && (budgetMin > 0 || budgetMax > 0)) {
      try {
        const multipliers = await this.locationCost.getMultipliers(resolvedZip);
        const locationMultiplier = (multipliers.materialMultiplier + multipliers.laborMultiplier) / 2;
        if (Math.abs(locationMultiplier - 1) > 0.02) {
          budgetMin = Math.round(budgetMin * locationMultiplier);
          budgetMax = Math.round(budgetMax * locationMultiplier);
          budgetMedian = Math.round(budgetMedian * locationMultiplier);
          factors.push({
            name: "Ajuste regional de costos",
            impact: locationMultiplier > 1 ? "increases" : "decreases",
            note: `Costos en ${multipliers.stateCode} ${locationMultiplier > 1 ? "por encima" : "por debajo"} del promedio nacional (×${locationMultiplier.toFixed(2)}, fuente: ${multipliers.source})`,
          });
        }
      } catch (err) {
        this.logger.debug(`[budget] locationCost.getMultipliers failed for zip=${resolvedZip}: ${(err as Error).message}`);
      }
    }

    // 6b. Area/sqft signal. Note: Job records don't persist area/sqft today (no
    // such column exists on the schema), so there is no historical $/sqft basis
    // to compute a numeric adjustment from — that would need a schema change,
    // out of scope here. When the caller does supply an area, use it as an
    // honest qualitative bound instead of fabricating a price: flag when the
    // reported area looks too small for a full remodel-sized range, or too
    // large for it, rather than silently trusting the historical range.
    if (input.areaSqft && input.areaSqft > 0) {
      if (input.areaSqft <= 50) {
        factors.push({
          name: "Alcance pequeño (área)",
          impact: "decreases",
          note: `Área reportada de ${input.areaSqft} sqft es típica de una reparación puntual, no de una remodelación — verifica que el rango sugerido no esté sobreestimado para este alcance`,
        });
      } else if (input.areaSqft >= 1500) {
        factors.push({
          name: "Alcance amplio (área)",
          impact: "increases",
          note: `Área reportada de ${input.areaSqft} sqft es mayor al trabajo promedio de esta categoría — el costo probablemente supere la mediana histórica`,
        });
      }
    }

    // 8. Factors analysis (text-based signals)
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

    // 9. AI narrative
    const aiNarrative = await this.buildAiNarrative(input, budgetMin, budgetMax, budgetMedian, similar.length, confidence);

    this.logger.log(`[budget] suggest tenantId=${input.tenantId} min=${budgetMin} max=${budgetMax} similar=${similar.length} confidence=${confidence}`);

    return {
      min: budgetMin,
      max: budgetMax,
      median: budgetMedian,
      currency: PUBLIC_MARKET_CURRENCY,
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

    const prompt = `Eres un experto en presupuestos de construcción y servicios en Florida, Estados Unidos.

Trabajo: "${input.title}"
Descripción: "${input.scope}"
Categoría: ${input.category ?? "general"}
Datos del sistema: ${similarCount} trabajos similares encontrados
Rango estimado: $${min.toLocaleString()} - $${max.toLocaleString()} ${PUBLIC_MARKET_CURRENCY} (mediana $${median.toLocaleString()})
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
      return `Para este tipo de trabajo, el rango de $${min.toLocaleString()} - $${max.toLocaleString()} ${PUBLIC_MARKET_CURRENCY} refleja el mercado local basado en ${similarCount} proyectos similares. La mediana de $${median.toLocaleString()} es un buen punto de partida para negociar.`;
    }
  }
}
