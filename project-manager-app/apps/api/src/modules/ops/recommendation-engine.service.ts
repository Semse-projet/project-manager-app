import { Injectable, Logger } from "@nestjs/common";
import { SystemObserverService } from "./observer.service.js";
import { ConsciousnessIndexService } from "./consciousness.service.js";

// ── Types ─────────────────────────────────────────────────────────────────────

export type RecommendationType =
  | "add_tests"
  | "add_frontend"
  | "fix_risk"
  | "add_trade_docs"
  | "review_module"
  | "improve_observability"
  | "complete_feature"
  | "resolve_alert";

export type EffortLevel = "low" | "medium" | "high";

export type StructuredRecommendation = {
  id:             string;
  type:           RecommendationType;
  priority:       number;   // 1 = highest
  area:           string;
  action:         string;
  rationale:      string;
  estimatedImpact: string;
  maturityGain:   number;   // estimated score points
  effort:         EffortLevel;
  draftPRTitle:   string;
  draftPRScope:   string[];  // bullet points for PR body
  autonomyNote:   "Nivel 2 — Recomendación: el sistema propone, humano aprueba y actúa";
};

export type RecommendationReport = {
  generatedAt:     string;
  tenantId:        string;
  systemScore:     number;
  totalActions:    number;
  recommendations: StructuredRecommendation[];
  topPriority:     StructuredRecommendation | null;
  autonomyLevel:   2;
  autonomyPolicy:  string;
};

// ── Priority scoring ──────────────────────────────────────────────────────────
// Priority = urgency (1-3) + impact (1-3) + effort_penalty (0-2 inverse)
// Lower number = higher priority

function priorityScore(urgency: 1|2|3, impact: 1|2|3, effort: EffortLevel): number {
  const effortPenalty = effort === "low" ? 0 : effort === "medium" ? 1 : 2;
  // Lower is better: high urgency, high impact, low effort = priority 1
  return 7 - urgency - impact + effortPenalty;
}

// ── Service ───────────────────────────────────────────────────────────────────

@Injectable()
export class RecommendationEngineService {
  private readonly logger = new Logger(RecommendationEngineService.name);

  constructor(
    private readonly observer: SystemObserverService,
    private readonly consciousness: ConsciousnessIndexService,
  ) {}

  async generate(tenantId: string): Promise<RecommendationReport> {
    const [snap, index] = await Promise.all([
      this.observer.observe(tenantId),
      this.consciousness.buildIndex(tenantId),
    ]);

    const recs: StructuredRecommendation[] = [];

    // ── 1. Alert-driven recommendations (from Observer) ──────────────────────
    for (const alert of snap.alerts) {
      if (alert.level === "critical" || alert.level === "high") {
        recs.push(this.alertToRec(alert, recs.length));
      }
    }

    // ── 2. Module maturity recommendations ───────────────────────────────────
    const weakModules = index.maturity.byModule
      .filter((m) => m.score < 70)
      .sort((a, b) => a.score - b.score)
      .slice(0, 8);

    for (const mod of weakModules) {
      const gaps = mod.gaps;

      if (gaps.includes("tests")) {
        recs.push({
          id:             `tests-${mod.module.toLowerCase().replace(/\s+/g, "-")}`,
          type:           "add_tests",
          priority:       priorityScore(2, 3, "medium"),
          area:           mod.module,
          action:         `Agregar tests unitarios para ${mod.module}`,
          rationale:      `${mod.module} tiene madurez ${mod.score}/100 y carece de cobertura de tests. Sin tests, cambios futuros son riesgosos.`,
          estimatedImpact: `Aumenta madurez de ${mod.score} → ${mod.score + 20} pts. Reduce riesgo de regresiones.`,
          maturityGain:   20,
          effort:         "medium",
          draftPRTitle:   `test(${mod.module.toLowerCase().replace(/[^a-z0-9]/g, "-")}): unit tests coverage`,
          draftPRScope:   [
            `Crear \`test/${mod.module.toLowerCase().replace(/\s+/g, "-")}.test.ts\``,
            "Tests de lógica de servicio (sin DB requerida)",
            "Tests de contratos de tipos y schemas Zod",
            "Tests de edge cases: null, vacío, error",
            `Meta: >= 10 tests cubriendo flujos críticos de ${mod.module}`,
          ],
          autonomyNote: "Nivel 2 — Recomendación: el sistema propone, humano aprueba y actúa",
        });
      }

      if (gaps.includes("frontend") && !gaps.includes("backend")) {
        recs.push({
          id:             `frontend-${mod.module.toLowerCase().replace(/\s+/g, "-")}`,
          type:           "add_frontend",
          priority:       priorityScore(1, 2, "high"),
          area:           mod.module,
          action:         `Crear interfaz web para ${mod.module}`,
          rationale:      `${mod.module} tiene backend funcional pero sin UI. Los operadores no pueden usar esta funcionalidad desde el dashboard.`,
          estimatedImpact: `Aumenta madurez ${mod.score} → ${mod.score + 20} pts. Hace el módulo accesible a admin/ops.`,
          maturityGain:   20,
          effort:         "high",
          draftPRTitle:   `feat(web): ${mod.module} admin page`,
          draftPRScope:   [
            `Crear \`apps/web/app/(app)/admin/${mod.module.toLowerCase().replace(/\s+/g, "-")}/page.tsx\``,
            "BFF route: `/api/semse/${mod.module.toLowerCase()}/route.ts`",
            "Componente de lista/tabla con datos reales",
            "Acciones básicas: ver, filtrar",
            "Agregar link en nav sidebar con traducción ES/EN",
          ],
          autonomyNote: "Nivel 2 — Recomendación: el sistema propone, humano aprueba y actúa",
        });
      }

      if (gaps.includes("sse") && !gaps.includes("backend") && !gaps.includes("frontend")) {
        recs.push({
          id:             `sse-${mod.module.toLowerCase().replace(/\s+/g, "-")}`,
          type:           "improve_observability",
          priority:       priorityScore(1, 1, "low"),
          area:           mod.module,
          action:         `Agregar SSE real-time a ${mod.module}`,
          rationale:      `${mod.module} cambia de estado pero no tiene notificaciones en tiempo real. La UI requiere refresh manual.`,
          estimatedImpact: `Aumenta madurez ${mod.score} → ${mod.score + 10} pts. UX reactiva sin polling.`,
          maturityGain:   10,
          effort:         "low",
          draftPRTitle:   `feat(sse): ${mod.module} real-time events`,
          draftPRScope:   [
            `Emitir evento SSE en mutaciones de ${mod.module}`,
            "Canal: `buildops:{tenantId}` o canal específico",
            `Hook \`use${mod.module.replace(/\s+/g, "")}SSE\` en web`,
            "Refresh automático en UI al recibir evento",
          ],
          autonomyNote: "Nivel 2 — Recomendación: el sistema propone, humano aprueba y actúa",
        });
      }
    }

    // ── 3. Trade Knowledge Library ────────────────────────────────────────────
    const ragDocs = snap.intelligenceHealth.ragDocuments;
    if (ragDocs < 20) {
      recs.push({
        id:             "trade-library-expand",
        type:           "add_trade_docs",
        priority:       priorityScore(2, 2, "low"),
        area:           "Prometeo RAG",
        action:         "Subir manuales trade faltantes (electrical, HVAC, plumbing detallados)",
        rationale:      `Solo hay ${ragDocs} documentos en la biblioteca. Los agentes RAG necesitan más contexto documental por trade para dar respuestas precisas.`,
        estimatedImpact: "Mejora precisión de TradeGuideService, EvidenceReview y ChangeOrder detection con contexto real.",
        maturityGain:   5,
        effort:         "low",
        draftPRTitle:   "docs(prometeo): trade knowledge library expansion",
        draftPRScope:   [
          "Subir manuales via POST /v1/prometeo/ingest",
          "Trades prioritarios: electrical detallado, HVAC códigos, plumbing",
          "Incluir checklists de evidencia SEMSE por trade",
          "metadata: trade, visibility: public_training, documentType: manual",
        ],
        autonomyNote: "Nivel 2 — Recomendación: el sistema propone, humano aprueba y actúa",
      });
    }

    // ── 4. RAG mode ───────────────────────────────────────────────────────────
    if (snap.intelligenceHealth.embeddingsMode === "fts_fallback") {
      recs.push({
        id:             "fix-embeddings",
        type:           "fix_risk",
        priority:       priorityScore(3, 3, "low"),
        area:           "Prometeo Embeddings",
        action:         "Configurar OPENAI_API_KEY en Railway para activar hybrid retrieval",
        rationale:      "RAG en modo FTS fallback — sin embeddings semánticos, la recuperación de contexto es solo por texto.",
        estimatedImpact: "Activa hybrid retrieval (0.70×cosine + 0.30×FTS). Mejora significativamente la precisión de RAG.",
        maturityGain:   10,
        effort:         "low",
        draftPRTitle:   "infra: configure OPENAI_API_KEY for embeddings",
        draftPRScope:   [
          "Agregar OPENAI_API_KEY en Railway → service API",
          "Ejecutar backfill: POST /v1/prometeo/embeddings/backfill",
          "Verificar: GET /v1/prometeo/embeddings/health → retrievalMode: hybrid",
        ],
        autonomyNote: "Nivel 2 — Recomendación: el sistema propone, humano aprueba y actúa",
      });
    }

    // ── 5. Operational signals ────────────────────────────────────────────────
    if (snap.operationalHealth.criticalSignals > 0) {
      recs.push({
        id:             "resolve-critical-signals",
        type:           "resolve_alert",
        priority:       1, // always highest
        area:           "Mission Control",
        action:         `Resolver ${snap.operationalHealth.criticalSignals} señal(es) crítica(s) abiertas`,
        rationale:      "Señales críticas indican problemas activos que pueden bloquear pagos o generar disputas.",
        estimatedImpact: "Elimina riesgo operacional inmediato. Desbloquea flujo monetizable.",
        maturityGain:   0,
        effort:         "medium",
        draftPRTitle:   "fix(ops): resolve critical operational signals",
        draftPRScope:   [
          "Revisar /admin/ai-mission-control → señales críticas",
          "Identificar causa raíz de cada señal",
          "Resolver o acknowledger con auditReason",
          "Verificar que governance esté desbloqueada",
        ],
        autonomyNote: "Nivel 2 — Recomendación: el sistema propone, humano aprueba y actúa",
      });
    }

    // ── Sort by priority and deduplicate ──────────────────────────────────────
    const sorted = recs
      .sort((a, b) => a.priority - b.priority || b.maturityGain - a.maturityGain)
      .slice(0, 12); // top 12 max

    const report: RecommendationReport = {
      generatedAt:     new Date().toISOString(),
      tenantId,
      systemScore:     snap.healthScore,
      totalActions:    sorted.length,
      recommendations: sorted,
      topPriority:     sorted[0] ?? null,
      autonomyLevel:   2,
      autonomyPolicy:  "El sistema genera recomendaciones estructuradas. El humano decide cuáles implementar y cuándo. El sistema NO modifica código, NO hace push, NO despliega.",
    };

    this.logger.log(`[RecommendationEngine] generated ${sorted.length} recommendations score=${snap.healthScore}`);
    return report;
  }

  private alertToRec(alert: { level: string; area: string; message: string; recommendation: string }, idx: number): StructuredRecommendation {
    const urgency: 1|2|3 = alert.level === "critical" ? 3 : alert.level === "high" ? 2 : 1;
    return {
      id:             `alert-${idx}-${alert.area.toLowerCase().replace(/\s+/g, "-")}`,
      type:           "resolve_alert",
      priority:       priorityScore(urgency, 3, "medium"),
      area:           alert.area,
      action:         alert.recommendation,
      rationale:      alert.message,
      estimatedImpact: `Resolve ${alert.level} alert in ${alert.area}. Improves system health score.`,
      maturityGain:   alert.level === "critical" ? 15 : 8,
      effort:         "medium",
      draftPRTitle:   `fix(${alert.area.toLowerCase().replace(/\s+/g, "-")}): resolve ${alert.level} alert`,
      draftPRScope:   [alert.recommendation],
      autonomyNote:   "Nivel 2 — Recomendación: el sistema propone, humano aprueba y actúa",
    };
  }
}
