import { Injectable, Logger } from "@nestjs/common";
import { SystemObserverService } from "./observer.service.js";
import { ConsciousnessIndexService } from "./consciousness.service.js";
import { RecommendationEngineService } from "./recommendation-engine.service.js";

// ── Types ─────────────────────────────────────────────────────────────────────

export type EvolutionSignal = {
  type:        "maturity_gap" | "recurring_alert" | "infra_degradation" | "knowledge_gap" | "autonomy_ceiling";
  area:        string;
  severity:    "critical" | "high" | "medium" | "low";
  observation: string;
  trend:       "worsening" | "stable" | "improving";
  evidence:    string[];
};

export type EvolutionPriority = {
  rank:        number;
  what:        string;
  why:         string;
  impact:      string;
  effort:      "low" | "medium" | "high";
  urgency:     "now" | "next" | "later";
  dependsOn:   string[];
};

export type EvolutionReport = {
  generatedAt:  string;
  systemScore:  number;
  autonomyLevel: number;
  signals:      EvolutionSignal[];
  priorities:   EvolutionPriority[];
  nextBlock:    {
    name:        string;
    description: string;
    items:       string[];
    rationale:   string;
  };
  strategicWarnings: string[];
  autonomyLevel5Note: string;
};

// ── Service ───────────────────────────────────────────────────────────────────

@Injectable()
export class EvolutionEngineService {
  private readonly logger = new Logger(EvolutionEngineService.name);

  constructor(
    private readonly observer: SystemObserverService,
    private readonly consciousness: ConsciousnessIndexService,
    private readonly recommendations: RecommendationEngineService,
  ) {}

  async evolve(tenantId: string): Promise<EvolutionReport> {
    const [snap, index, recReport] = await Promise.all([
      this.observer.observe(tenantId),
      this.consciousness.buildIndex(tenantId),
      this.recommendations.generate(tenantId),
    ]);

    const signals = this.detectEvolutionSignals(snap, index);
    const priorities = this.prioritizeEvolution(signals, index, recReport);
    const nextBlock = this.proposeNextBlock(priorities, index, snap);
    const warnings = this.generateStrategicWarnings(snap, index);

    this.logger.log(`[EvolutionEngine] tenantId=${tenantId} signals=${signals.length} priorities=${priorities.length} score=${snap.healthScore}`);

    return {
      generatedAt:   new Date().toISOString(),
      systemScore:   snap.healthScore,
      autonomyLevel: 5,
      signals,
      priorities,
      nextBlock,
      strategicWarnings: warnings,
      autonomyLevel5Note: "Nivel 5 — Evolución: el sistema detecta patrones y propone el siguiente bloque de desarrollo. El humano decide si ejecutarlo.",
    };
  }

  // ── Signal detection ────────────────────────────────────────────────────────

  private detectEvolutionSignals(
    snap: Awaited<ReturnType<SystemObserverService["observe"]>>,
    index: Awaited<ReturnType<ConsciousnessIndexService["buildIndex"]>>,
  ): EvolutionSignal[] {
    const signals: EvolutionSignal[] = [];

    // Maturity gaps
    const weakModules = index.maturity.byModule.filter((m) => m.score < 60);
    if (weakModules.length > 0) {
      signals.push({
        type: "maturity_gap",
        area: weakModules.map((m) => m.module).join(", "),
        severity: weakModules.some((m) => m.score < 30) ? "high" : "medium",
        observation: `${weakModules.length} módulos con madurez < 60: ${weakModules.map((m) => `${m.module}(${m.score})`).join(", ")}`,
        trend: "stable",
        evidence: weakModules.map((m) => `${m.module}: faltan ${m.gaps.join(", ")}`),
      });
    }

    // Recurring alerts from observer
    if (snap.alerts.length > 0) {
      const critical = snap.alerts.filter((a) => a.level === "critical" || a.level === "high");
      if (critical.length > 0) {
        signals.push({
          type: "recurring_alert",
          area: critical.map((a) => a.area).join(", "),
          severity: snap.operationalHealth.criticalSignals > 0 ? "critical" : "high",
          observation: `${critical.length} alerta(s) activa(s): ${critical.map((a) => a.message).join("; ")}`,
          trend: "worsening",
          evidence: critical.map((a) => `${a.area}: ${a.recommendation}`),
        });
      }
    }

    // Infrastructure degradation
    if (!snap.infrastructure.allHealthy) {
      const unhealthy = snap.infrastructure.items.filter((i) => !i.healthy);
      signals.push({
        type: "infra_degradation",
        area: "Infrastructure",
        severity: unhealthy.some((i) => i.name === "Postgres") ? "critical" : "high",
        observation: `${unhealthy.length} servicio(s) no saludable(s): ${unhealthy.map((i) => i.name).join(", ")}`,
        trend: "worsening",
        evidence: unhealthy.map((i) => `${i.name}: ${i.detail ?? "sin detalle"}`),
      });
    }

    // RAG knowledge gap
    if (snap.intelligenceHealth.ragDocuments < 15) {
      signals.push({
        type: "knowledge_gap",
        area: "Prometeo RAG",
        severity: snap.intelligenceHealth.ragDocuments === 0 ? "high" : "medium",
        observation: `Solo ${snap.intelligenceHealth.ragDocuments} documentos en la biblioteca — los agentes RAG tienen contexto limitado`,
        trend: "stable",
        evidence: ["Trade Guide responde con menos precisión cuando hay pocos manuales", "EvidenceReview tiene menos contexto documental"],
      });
    }

    // Autonomy ceiling — if we're not progressing through levels
    const autonomyLevel = 4; // current achieved level (apply engine)
    if (autonomyLevel < 5) {
      signals.push({
        type: "autonomy_ceiling",
        area: "Autonomy Core",
        severity: "low",
        observation: "Sistema en Autonomy Level 4 — el siguiente nivel (Evolution) requiere patrones temporales y auto-priorización",
        trend: "improving",
        evidence: ["Observer + Consciousness + Recommendations + Simulation + Apply implementados", "Falta: feedback loop de decisiones aplicadas"],
      });
    }

    return signals.sort((a, b) => {
      const ORDER = { critical: 0, high: 1, medium: 2, low: 3 };
      return (ORDER[a.severity] ?? 4) - (ORDER[b.severity] ?? 4);
    });
  }

  // ── Priority generation ─────────────────────────────────────────────────────

  private prioritizeEvolution(
    signals: EvolutionSignal[],
    index: Awaited<ReturnType<ConsciousnessIndexService["buildIndex"]>>,
    recReport: Awaited<ReturnType<RecommendationEngineService["generate"]>>,
  ): EvolutionPriority[] {
    const priorities: EvolutionPriority[] = [];
    let rank = 1;

    // 1. Resolve critical signals first
    const criticalSignals = signals.filter((s) => s.severity === "critical" || s.severity === "high");
    if (criticalSignals.length > 0) {
      priorities.push({
        rank: rank++,
        what: `Resolver ${criticalSignals.length} señal(es) crítica(s)/alta(s)`,
        why:  "Las señales activas bloquean el flujo monetizable y aumentan el riesgo de disputa",
        impact: "Desbloquea pagos, reduce disputas y mejora el health score del sistema",
        effort: "medium",
        urgency: "now",
        dependsOn: [],
      });
    }

    // 2. Complete weak modules (tests/frontend gaps)
    const weakest = index.maturity.byModule
      .filter((m) => m.score < 50 && m.gaps.includes("tests"))
      .slice(0, 3);
    if (weakest.length > 0) {
      priorities.push({
        rank: rank++,
        what: `Agregar tests para: ${weakest.map((m) => m.module).join(", ")}`,
        why:  `Módulos sin tests son zonas frágiles — cambios futuros pueden romper el sistema sin detección`,
        impact: `+${weakest.length * 20} pts de madurez. Reduce el riesgo de regresiones en producción.`,
        effort: "medium",
        urgency: "next",
        dependsOn: [],
      });
    }

    // 3. Expand RAG knowledge base
    if (signals.some((s) => s.type === "knowledge_gap")) {
      priorities.push({
        rank: rank++,
        what: "Subir más manuales trade (roofing, flooring, concrete, carpentry avanzado)",
        why:  "La Trade Knowledge Library es el principal diferenciador de SEMSE — más contexto = mejores decisiones de agentes",
        impact: "TradeGuide responde mejor, EvidenceReview cita fuentes más relevantes, CO detection más precisa",
        effort: "low",
        urgency: "next",
        dependsOn: ["Prometeo RAG hybrid activo (✅)"],
      });
    }

    // 4. Marketplace client experience
    priorities.push({
      rank: rank++,
      what: "Mejorar UX cliente en /client/marketplace — formulario de aplicación real",
      why:  "El botón 'Aplicar' muestra un alert() — el flujo completo requiere un formulario con presupuesto, disponibilidad y mensaje",
      impact: "Convierte el marketplace de vetrina a flujo completo de captación de trabajos",
      effort: "medium",
      urgency: "next",
      dependsOn: ["Marketplace v1 (✅)", "Bid system (✅)"],
    });

    // 5. Autonomy Level 5 completion
    priorities.push({
      rank: rank++,
      what: "Autonomy Level 5 — Evolution feedback loop: registrar qué patches aplicados tuvieron éxito",
      why:  "El sistema aplica patches pero no aprende si fueron útiles — el feedback loop cierra el ciclo de autonomía",
      impact: "SEMSE puede priorizar el backlog automáticamente basándose en qué cambios realmente mejoraron el sistema",
      effort: "high",
      urgency: "later",
      dependsOn: ["Apply Engine (✅)", "AuditLog (✅)", "Observer (✅)"],
    });

    // Add recommendations from the engine
    recReport.recommendations.slice(0, 2).forEach((rec) => {
      priorities.push({
        rank: rank++,
        what: rec.action,
        why:  rec.rationale,
        impact: rec.estimatedImpact,
        effort: rec.effort,
        urgency: rec.priority <= 3 ? "next" : "later",
        dependsOn: [],
      });
    });

    return priorities;
  }

  // ── Next block proposal ─────────────────────────────────────────────────────

  private proposeNextBlock(
    priorities: EvolutionPriority[],
    index: Awaited<ReturnType<ConsciousnessIndexService["buildIndex"]>>,
    snap: Awaited<ReturnType<SystemObserverService["observe"]>>,
  ): EvolutionReport["nextBlock"] {
    const urgent = priorities.filter((p) => p.urgency === "now");
    const hasAlerts = snap.operationalHealth.criticalSignals > 0 || snap.operationalHealth.openSignals > 3;

    if (hasAlerts || urgent.length > 0) {
      return {
        name: "Bloque Urgente — Estabilización",
        description: "Hay problemas activos que requieren atención antes de continuar con nuevas features",
        items: urgent.map((p) => p.what),
        rationale: "El sistema tiene señales críticas o alertas altas — priorizamos estabilidad sobre evolución",
      };
    }

    const weakest = index.maturity.byModule.filter((m) => m.score < 50).slice(0, 3);
    if (weakest.length > 0) {
      return {
        name: "Bloque F — Madurez de módulos débiles",
        description: "Completar los módulos con menos madurez antes de agregar más features",
        items: [
          ...weakest.map((m) => `${m.module}: agregar ${m.gaps.slice(0, 2).join(" y ")}`),
          "Marketplace: formulario de aplicación real (reemplazar alert())",
          "Notifications: tests de integración con dominio",
        ],
        rationale: `Madurez global ${index.maturity.globalScore}/100 — los módulos débiles son el principal gap.`,
      };
    }

    return {
      name: "Bloque F — Experiencia y escala",
      description: "El core está maduro. Momento de mejorar la UX y preparar el sistema para más usuarios",
      items: [
        "Marketplace: formulario de aplicación con bid real",
        "Trade Knowledge Library: +10 manuales (concrete, roofing, flooring, tile, insulation)",
        "Autonomy Level 5: feedback loop de patches aplicados",
        "Mobile UX: responsive improvements para campo",
      ],
      rationale: `Con ${index.maturity.globalScore}/100 de madurez y 0 alertas críticas, el sistema está listo para crecer.`,
    };
  }

  // ── Strategic warnings ──────────────────────────────────────────────────────

  private generateStrategicWarnings(
    snap: Awaited<ReturnType<SystemObserverService["observe"]>>,
    index: Awaited<ReturnType<ConsciousnessIndexService["buildIndex"]>>,
  ): string[] {
    const warnings: string[] = [];

    if (!snap.intelligenceHealth.ollamaAvailable) {
      warnings.push("Ollama no disponible — privacyCritical flows usan template fallback. Configurar Ollama en Railway para restaurar LLM local.");
    }

    if (snap.intelligenceHealth.embeddingsMode === "fts_fallback") {
      warnings.push("RAG en FTS fallback — verificar OPENAI_API_KEY en Railway.");
    }

    if (index.maturity.globalScore < 70) {
      warnings.push(`Madurez global ${index.maturity.globalScore}/100 — completar módulos débiles antes de agregar features de alto riesgo.`);
    }

    warnings.push("No implementar self-healing completo hasta que el Evolution feedback loop esté probado en producción.");
    warnings.push("Payment Governance es fuente de verdad para canRelease — no automatizar sin aprobación humana.");

    return warnings;
  }
}
