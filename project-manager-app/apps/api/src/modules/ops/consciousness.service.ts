import { Injectable, Logger, Optional } from "@nestjs/common";
import { PrismaService } from "../../infrastructure/prisma/prisma.service.js";
import { LLMOrchestrator } from "../../infrastructure/llm/orchestrator.js";
import { isZeroVector } from "../prometeo/embedding.service.js";
import type { OperationalSignalsService } from "../operational-intelligence/operational-signals.service.js";
import { SystemObserverService, type ObservationSnapshot } from "./observer.service.js";
import type {
  SemseConsciousnessIndex, ModuleHealth, ModuleMaturityScore,
  Risk, LlmProviderStatus, ModuleStatus, RagStatus,
} from "./consciousness.types.js";

// ── SEMSE Module Registry ─────────────────────────────────────────────────────
// Static knowledge of what exists in the ecosystem.
// Updated manually when new modules are added.

const MODULE_REGISTRY: Array<{
  name: string;
  hasBackend: boolean; hasFrontend: boolean; hasTests: boolean;
  hasSSE: boolean;     hasRAG: boolean;      hasAudit: boolean; hasPermissions: boolean;
  notes: string[];
}> = [
  { name: "BuildOps",          hasBackend: true,  hasFrontend: true,  hasTests: true,  hasSSE: true,  hasRAG: true,  hasAudit: true,  hasPermissions: true,  notes: ["Plan approval", "Legacy promotion", "Health endpoint", "Algorithm runs"] },
  { name: "Evidence",          hasBackend: true,  hasFrontend: true,  hasTests: true,  hasSSE: true,  hasRAG: true,  hasAudit: true,  hasPermissions: true,  notes: ["CRUD Fase 1-2", "Admin review", "Upload UI", "Evidence review agent"] },
  { name: "Milestones",        hasBackend: true,  hasFrontend: true,  hasTests: true,  hasSSE: false, hasRAG: true,  hasAudit: true,  hasPermissions: true,  notes: ["Payment readiness", "Evidence readiness", "Milestone governance"] },
  { name: "Payment Governance",hasBackend: true,  hasFrontend: true,  hasTests: true,  hasSSE: true,  hasRAG: true,  hasAudit: true,  hasPermissions: true,  notes: ["canRelease", "blockers", "change order blockers", "governance panel"] },
  { name: "Change Orders",     hasBackend: true,  hasFrontend: true,  hasTests: true,  hasSSE: true,  hasRAG: true,  hasAudit: true,  hasPermissions: true,  notes: ["Lifecycle completo", "Impact", "Apply idempotente", "CO detector agent"] },
  { name: "Mission Control",   hasBackend: true,  hasFrontend: true,  hasTests: true,  hasSSE: true,  hasRAG: true,  hasAudit: false, hasPermissions: true,  notes: ["Operational signals", "Incidents SSE", "Alert banner"] },
  { name: "AI Mission Control",hasBackend: true,  hasFrontend: true,  hasTests: true,  hasSSE: false, hasRAG: false, hasAudit: false, hasPermissions: true,  notes: ["LLM metrics", "Ollama health", "Provider status", "RAG health", "Observer integration"] },
  { name: "Prometeo RAG",      hasBackend: true,  hasFrontend: true,  hasTests: true,  hasSSE: false, hasRAG: true,  hasAudit: false, hasPermissions: true,  notes: ["Fases 0-5", "Hybrid retrieval", "Real embeddings (32 docs/181 chunks)", "Trade guide", "Feedback loop"] },
  { name: "Smart Intake",      hasBackend: true,  hasFrontend: true,  hasTests: true,  hasSSE: true,  hasRAG: false, hasAudit: false, hasPermissions: false, notes: ["7 categorías", "Scoring profiles", "Anonymous wizard", "Intake-ops bridge"] },
  { name: "SSE Infrastructure",hasBackend: true,  hasFrontend: true,  hasTests: true,  hasSSE: true,  hasRAG: false, hasAudit: false, hasPermissions: false, notes: ["SseEventBusService", "Multi-channel", "BFF proxy", "Reconnect backoff"] },
  { name: "Finance",           hasBackend: true,  hasFrontend: true,  hasTests: true,  hasSSE: true,  hasRAG: false, hasAudit: false, hasPermissions: true,  notes: ["Invoices", "Expenses", "PDF export", "Finance Hub", "22 tests unitarios"] },
  { name: "Auth",              hasBackend: true,  hasFrontend: true,  hasTests: true,  hasSSE: false, hasRAG: false, hasAudit: true,  hasPermissions: true,  notes: ["Signed tokens", "Session management", "RBAC", "timingSafeEqual"] },
  { name: "Contractors / CRM", hasBackend: true,  hasFrontend: true,  hasTests: true,  hasSSE: false, hasRAG: false, hasAudit: false, hasPermissions: true,  notes: ["ContractorLead CRM", "Tabla leads + stats", "Trust scoring", "26 tests unitarios"] },
  { name: "Trade Guide",       hasBackend: true,  hasFrontend: true,  hasTests: true,  hasSSE: false, hasRAG: true,  hasAudit: false, hasPermissions: true,  notes: ["TradeGuideService", "32 docs 12 trades", "Hybrid RAG activo"] },
  { name: "Worker",            hasBackend: true,  hasFrontend: false, hasTests: true,  hasSSE: false, hasRAG: false, hasAudit: false, hasPermissions: false, notes: ["BullMQ", "Curator", "Field-ops", "Trust-match", "16 tests unitarios"] },
  { name: "Marketplace",       hasBackend: false, hasFrontend: false, hasTests: false, hasSSE: false, hasRAG: false, hasAudit: false, hasPermissions: false, notes: ["No implementado — roadmap post-madurez core"] },
  { name: "Notifications",     hasBackend: false, hasFrontend: false, hasTests: false, hasSSE: true,  hasRAG: false, hasAudit: false, hasPermissions: false, notes: ["Push notifications pendientes — SSE parcial"] },
];

const KNOWN_SSE_CHANNELS = [
  "buildops:{tenantId}", "mission-control:{tenantId}", "finance:{tenantId}",
  "plans:{planId}", "delegations", "context", "health",
];

const KNOWN_SSE_EVENTS = [
  "evidence-item:updated", "evidence-item:reviewed", "evidence-item:replaced", "evidence-item:archived",
  "change-order:updated", "change-order:applied", "operational-signal:created",
  "invoice-overdue", "milestone:updated", "plan:step-completed",
];

// ── Maturity scoring ──────────────────────────────────────────────────────────

function scoreModule(m: (typeof MODULE_REGISTRY)[0]): { score: number; status: ModuleStatus; gaps: string[] } {
  const weights = { hasBackend: 25, hasFrontend: 20, hasTests: 20, hasSSE: 10, hasRAG: 10, hasAudit: 10, hasPermissions: 5 };
  let score = 0;
  const gaps: string[] = [];

  (Object.keys(weights) as Array<keyof typeof weights>).forEach((key) => {
    if (m[key]) score += weights[key];
    else gaps.push(key.replace("has", "").toLowerCase());
  });

  const status: ModuleStatus =
    score >= 90 ? "mature" :
    score >= 70 ? "functional" :
    score >= 45 ? "partial" :
    score >= 20 ? "minimal" : "missing";

  return { score, status, gaps };
}

// ── Service ───────────────────────────────────────────────────────────────────

@Injectable()
export class ConsciousnessIndexService {
  private readonly logger = new Logger(ConsciousnessIndexService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly observer: SystemObserverService,
    @Optional() private readonly llm?: LLMOrchestrator,
    @Optional() private readonly signals?: OperationalSignalsService,
  ) {}

  async buildIndex(tenantId: string): Promise<SemseConsciousnessIndex> {
    // Observer is the single perception layer — runs first, feeds everything else
    const snap = await this.observer.observe(tenantId);

    const [modules, brains, memory, operational] = await Promise.all([
      this.buildModuleMap(),
      this.buildBrainsFromObserver(snap),
      this.buildMemoryFromObserver(snap),
      this.buildOperationalFromObserver(snap),
    ]);

    const maturity = this.computeMaturity(modules);
    // Risks come from observer alerts + static module analysis
    const risks    = this.mergeRisks(snap, modules);
    const recs     = this.generateRecommendations(maturity, risks, operational);

    return {
      generatedAt: snap.observedAt,
      version: "1",

      identity: {
        name:        "SEMSE OS",
        purpose:     "Ecosistema operacional IA para la industria de construcción — evidencia, governance de pagos por milestones, change orders, RAG y agentes locales.",
        coreLoop:    ["Intake", "Estimate", "BuildOps", "Milestones", "Evidence", "Approval", "Payment"],
        operatingPrinciples: [
          "privacyCritical → nunca cloud",
          "Payment Governance es fuente de verdad para canRelease",
          "Evidence Review no libera pagos directamente",
          "RAG entrega contexto — los agentes deciden dentro de sus límites",
          "OBSERVE → ANALYZE → SUGGEST → VALIDATE → APPROVE → APPLY",
        ],
        autonomyLevel:       1,
        autonomyDescription: "Nivel 1 — Diagnóstico: observa y explica. No modifica nada.",
      },

      body: {
        modules,
        // Services come from observer — single source of truth
        services: snap.infrastructure.items.map((i) => ({
          name: i.name, healthy: i.healthy, latencyMs: i.latencyMs, error: i.detail,
        })),
        knownSSEChannels: KNOWN_SSE_CHANNELS,
        knownSSEEvents:   KNOWN_SSE_EVENTS,
      },

      memory,
      brains,
      maturity,
      risks,
      operationalState: operational,
      recommendations: recs,

      // Live observation — powered by SystemObserverService
      observation: {
        observedAt:      snap.observedAt,
        healthScore:     snap.healthScore,
        infraHealthy:    snap.infrastructure.allHealthy,
        alertCount:      snap.alerts.length,
        alertSummary:    snap.alerts.map((a) => `[${a.level.toUpperCase()}] ${a.area}: ${a.message}`),
        patterns:        snap.patterns.map((p) => p.interpretation),
        ollamaAvailable: snap.intelligenceHealth.ollamaAvailable,
        ragMode:         snap.intelligenceHealth.embeddingsMode,
        fromObserver:    true as const,
      },
    };
  }

  // ── Builders ───────────────────────────────────────────────────────────────

  private async buildModuleMap(): Promise<ModuleHealth[]> {
    return MODULE_REGISTRY.map((m) => {
      const { score, status, gaps } = scoreModule(m);
      return {
        name: m.name, status, maturityScore: score,
        hasBackend: m.hasBackend, hasFrontend: m.hasFrontend, hasTests: m.hasTests,
        hasSSE: m.hasSSE, hasRAG: m.hasRAG, hasAudit: m.hasAudit, hasPermissions: m.hasPermissions,
        notes: m.notes,
      };
    });
  }

  // ── Observer-powered builders — no duplicate Prisma queries ──────────────────

  /** Brains map from Observer's LLM intelligence health. */
  private async buildBrainsFromObserver(snap: ObservationSnapshot) {
    const providerRoles: Record<string, string> = {
      ollama:    "Provider principal — privacidad, datos internos, costo bajo, razonamiento local",
      anthropic: "Fallback #1 — razonamiento fuerte, código, planificación compleja",
      openai:    "Fallback #2 + Embeddings RAG (exclusivo)",
      template:  "Fallback final — sin LLM disponible",
    };

    // Build provider list from LLM orchestrator + observer availability
    const providers: LlmProviderStatus[] = [];
    if (this.llm) {
      const snapshots = this.llm.metricsSnapshot();
      const registered = this.llm.getRegisteredProviders();
      for (const name of registered) {
        const s = snapshots.find((p) => p.provider === name);
        const isDefault = name === (process.env.LLM_DEFAULT_PROVIDER ?? "ollama");
        providers.push({
          name, available: true, isDefault,
          successCount: s?.successCount ?? 0, failureCount: s?.failureCount ?? 0,
          role: providerRoles[name] ?? "Proveedor secundario",
        });
      }
    }

    return {
      providers,
      routingPolicy: {
        defaultProvider:      process.env.LLM_DEFAULT_PROVIDER ?? "ollama",
        fallbackChain:        ["ollama", "anthropic", "openai", "template"],
        privacyCriticalChain: ["ollama", "template"],
        localOnlyChain:       ["ollama", "template"],
      },
      privacyRules: [
        "privacyCritical=true → nunca cloud — solo ollama o template",
        "localOnly=true → chain: ollama → template",
        "riskHigh+requiresTools → anthropic → openai → template",
        "default → ollama → anthropic → openai → template",
        "Embeddings OpenAI: solo documentos no privacyCritical",
      ],
      totalLLMCalls:  snap.intelligenceHealth.llmTotalCalls,
      totalFallbacks: snap.intelligenceHealth.llmFallbacks,
    };
  }

  /** Memory map from Observer's RAG intelligence. */
  private async buildMemoryFromObserver(snap: ObservationSnapshot) {
    const intel = snap.intelligenceHealth;
    const auditActive = await this.prisma.auditLog.count({ where: { tenantId: snap.tenantId } }).catch(() => 0);

    const ragStatus: RagStatus = {
      provider:             intel.embeddingsMode === "hybrid" ? "openai" : "none",
      model:                process.env.EMBEDDINGS_MODEL ?? "text-embedding-3-small",
      available:            intel.embeddingsMode === "hybrid",
      totalDocuments:       intel.ragDocuments,
      totalChunks:          intel.ragChunks,
      chunksWithEmbeddings: intel.ragEmbedded,
      retrievalMode:        intel.embeddingsMode,
    };

    return {
      ragStatus,
      auditLogActive:           auditActive > 0,
      operationalSignalsActive: snap.operationalHealth.openSignals > 0,
      reportsDirectory:         "docs/reportes/",
      memoryLayers: [
        "Prometeo RAG — documentos indexados + embeddings reales",
        "AuditLog — historial completo de mutaciones",
        "OperationalSignal — señales Mission Control",
        "AlgorithmRun — runs de estimación BuildOps",
        "LLMInteractionLog — llamadas a modelos + provider + latencia",
        "EvidenceReviewNote — revisiones IA guardadas en reviewNote",
        "SystemObserver — snapshots de salud del ecosistema (últimos 50)",
        "docs/reportes — reportes escritos de cada sesión de desarrollo",
      ],
    };
  }

  /** Operational state from Observer's live signals and milestone data. */
  private buildOperationalFromObserver(snap: ObservationSnapshot) {
    const op = snap.operationalHealth;
    const total = op.milestones.total;
    const readyCount = op.milestones.readyPayment;

    return {
      openSignals:          op.openSignals,
      criticalSignals:      op.criticalSignals,
      monetizableFlowReady: total > 0,
      monetizableFlowStatus: total === 0
        ? "Sin proyectos activos"
        : `${readyCount}/${total} milestones listos para pago`,
    };
  }

  /** Merge observer alerts with module-level risks into consciousness risk format. */
  private mergeRisks(snap: ObservationSnapshot, modules: ModuleHealth[]) {
    const critical: Risk[] = [];
    const high: Risk[]     = [];
    const medium: Risk[]   = [];
    const low: Risk[]      = [];

    // Map observer alerts directly to risks
    for (const alert of snap.alerts) {
      const risk: Risk = { severity: alert.level === "info" ? "low" : alert.level, area: alert.area, message: alert.message, recommendation: alert.recommendation };
      if (alert.level === "critical") critical.push(risk);
      else if (alert.level === "high") high.push(risk);
      else if (alert.level === "medium") medium.push(risk);
      else low.push(risk);
    }

    // Add module-level risks (static analysis — not in observer)
    const missingFrontend = modules.filter((m) => !m.hasFrontend && m.hasBackend);
    if (missingFrontend.length > 0) {
      medium.push({ severity: "medium", area: "UI Coverage", message: `${missingFrontend.length} módulos con backend sin frontend: ${missingFrontend.map((m) => m.name).join(", ")}`, recommendation: "Priorizar UI para Contractors y Marketplace" });
    }

    const missingTests = modules.filter((m) => !m.hasTests && m.maturityScore > 30);
    if (missingTests.length > 0) {
      medium.push({ severity: "medium", area: "Test Coverage", message: `${missingTests.length} módulos sin tests: ${missingTests.map((m) => m.name).join(", ")}`, recommendation: "Agregar tests para AI Mission Control, Finance, Worker" });
    }

    const intel = snap.intelligenceHealth;
    if (intel.llmFallbacks > 10 && intel.fallbackRate > 0.3) {
      low.push({ severity: "low", area: "LLM Routing", message: `${intel.llmFallbacks} llamadas cloud — revisar si pueden ir a Ollama`, recommendation: "Auditar agent profiles para maximizar Ollama local" });
    }

    const marketplace = modules.find((m) => m.name === "Marketplace");
    if (marketplace?.status === "missing") {
      low.push({ severity: "low", area: "Producto", message: "Marketplace no implementado — limita la propuesta de valor SaaS", recommendation: "Roadmap: después de madurez operacional core" });
    }

    return { critical, high, medium, low };
  }

  // ── Maturity computation ───────────────────────────────────────────────────

  private computeMaturity(modules: ModuleHealth[]) {
    const byModule: ModuleMaturityScore[] = modules.map((m) => ({
      module: m.name,
      score:  m.maturityScore,
      status: m.status,
      gaps:   Object.entries({
        backend: m.hasBackend, frontend: m.hasFrontend, tests: m.hasTests,
        sse: m.hasSSE, rag: m.hasRAG, audit: m.hasAudit, permissions: m.hasPermissions,
      }).filter(([, v]) => !v).map(([k]) => k),
    }));

    const scores = byModule.map((m) => m.score);
    const globalScore = Math.round(scores.reduce((a, b) => a + b, 0) / scores.length);

    const sorted = [...byModule].sort((a, b) => b.score - a.score);
    const strongestAreas = sorted.slice(0, 5).filter((m) => m.score >= 70).map((m) => m.module);
    const weakestAreas   = sorted.slice(-5).filter((m) => m.score < 60).map((m) => m.module);

    return { globalScore, byModule, strongestAreas, weakestAreas };
  }

  // ── Risk detection ─────────────────────────────────────────────────────────

  // ── Recommendations — reflect current real state ──────────────────────────

  private generateRecommendations(
    maturity: { globalScore: number; weakestAreas: string[] },
    risks: { critical: Risk[]; high: Risk[]; medium: Risk[] },
    operational: { openSignals: number },
  ) {
    const nextBestActions: string[] = [];
    const doNotDoYet: string[]     = [];
    const strategicWarnings: string[] = [];

    // Urgent: critical risks first
    if (risks.critical.length > 0) {
      nextBestActions.push(`URGENTE: Resolver ${risks.critical.length} riesgo(s) crítico(s) antes de cualquier otro trabajo`);
    }

    // High priority from observer alerts
    risks.high.forEach((r) => {
      if (r.area === "LLM Intelligence") nextBestActions.push("Verificar Ollama en Railway — alta tasa de fallback cloud detectada");
      if (r.area === "Mission Control") nextBestActions.push("Revisar señales de alta severidad antes de liberar pagos");
    });

    // Dynamic: based on actual system state
    if (!risks.critical.length && !risks.high.length) {
      // System is healthy — suggest evolution
      nextBestActions.push("Sistema estable — foco en RAG Fase 5 Feedback Loop (marcar chunks útiles en decisiones reales)");
      nextBestActions.push("Ampliar Trade Knowledge Library — agregar más manuales por oficio (roofing, flooring, tile)");
      nextBestActions.push("Panel UI Observer — visualizar snapshots del Observer en /admin/ai-mission-control");
      nextBestActions.push("Autonomy Level 2 — Recommendation Engine: que SEMSE proponga PRs con fixes de forma asistida");
    } else {
      nextBestActions.push("Resolver riesgos actuales antes de avanzar con nuevos features");
      nextBestActions.push("Revisar alertas del Observer: GET /v1/ops/observer/snapshot");
    }

    if (maturity.globalScore >= 65) {
      strategicWarnings.push("Madurez operacional suficiente para producción real — foco en madurez de módulos débiles: " + maturity.weakestAreas.slice(0, 3).join(", "));
    } else {
      strategicWarnings.push("Madurez global < 65 — completar módulos existentes antes de agregar features");
    }

    strategicWarnings.push("Internal Observer opera en Nivel 0-1 — no avanzar a Self-Healing sin estabilidad probada del Observer");
    strategicWarnings.push("No automatizar liberación de pagos — aprobación humana es invariante del sistema");

    doNotDoYet.push("Auto-healing / self-repair — Nivel 4 requiere Observer + Reasoning maduros primero");
    doNotDoYet.push("Marketplace — requiere trust scores funcionales y madurez completa del ciclo monetizable");
    doNotDoYet.push("Modificar payment governance core sin tests de regresión completos");
    doNotDoYet.push("Agregar más LLM providers externos — maximizar Ollama local primero");

    return { nextBestActions, doNotDoYet, strategicWarnings };
  }

  // ── Natural language query ─────────────────────────────────────────────────

  async queryConsciousness(question: string, tenantId: string): Promise<{
    answer: string; sources: string[]; autonomyNote: string;
    provider: string; model?: string;
  }> {
    const index = await this.buildIndex(tenantId);

    const contextBlock = [
      `## SEMSE OS — Índice de Consciencia Interna`,
      `Madurez global: ${index.maturity.globalScore}/100`,
      `Áreas fuertes: ${index.maturity.strongestAreas.join(", ")}`,
      `Áreas débiles: ${index.maturity.weakestAreas.join(", ")}`,
      ``,
      `## Riesgos actuales`,
      ...index.risks.critical.map((r) => `- [CRÍTICO] ${r.area}: ${r.message}`),
      ...index.risks.high.map((r) => `- [ALTO] ${r.area}: ${r.message}`),
      ...index.risks.medium.map((r) => `- [MEDIO] ${r.area}: ${r.message}`),
      ``,
      `## Estado operacional`,
      `- Señales abiertas: ${index.operationalState.openSignals}`,
      `- Ciclo monetizable: ${index.operationalState.monetizableFlowStatus}`,
      `- Embeddings RAG: ${index.memory.ragStatus.retrievalMode} (${index.memory.ragStatus.totalDocuments} docs)`,
      ``,
      `## Recomendaciones actuales`,
      ...index.recommendations.nextBestActions.map((a) => `- ${a}`),
      ``,
      `## NO hacer todavía`,
      ...index.recommendations.doNotDoYet.map((a) => `- ${a}`),
    ].join("\n");

    const systemPrompt = [
      `Eres el motor de consciencia interna de SEMSE OS.`,
      `Respondes preguntas sobre el estado, madurez, riesgos y dirección del propio ecosistema.`,
      `NO eres un asistente de usuario final. NO hablas de proyectos de clientes.`,
      `Usas SOLO el contexto del índice interno para responder. No inventas datos.`,
      `Si algo no está en el contexto, lo dices claramente.`,
      `Autonomía actual: Nivel 1 — solo observación y diagnóstico, sin modificar nada.`,
    ].join(" ");

    const userMessage = `${contextBlock}\n\n---\nPregunta: ${question}\n\nResponde de forma directa y útil. Cita qué parte del índice usaste.`;

    let answer = this.templateAnswer(question, index);
    let provider = "template";
    let model: string | undefined;

    if (this.llm) {
      try {
        const res = await this.llm.chat({
          systemPrompt,
          history: [],
          userMessage,
          context: { localOnly: true, source: "semse-consciousness", routingReason: "internal-introspection" },
        });
        provider = res.provider;
        model = res.model;

        // Only use LLM answer if it's not the generic template greeting
        const isGenericTemplate = res.provider === "template" ||
          !res.text ||
          res.text.toLowerCase().includes("hola, soy prometeo") ||
          res.text.length < 30;

        if (!isGenericTemplate) {
          answer = res.text.trim();
        } else {
          // Use our structured template answer instead
          answer = this.templateAnswer(question, index);
          provider = "consciousness-template";
        }
      } catch (err) {
        this.logger.warn(`[Consciousness] LLM failed: ${(err as Error).message} — template fallback`);
        answer = this.templateAnswer(question, index);
      }
    }

    return {
      answer,
      sources: ["consciousness-index", "maturity-scores", "risk-detection", "operational-state"],
      autonomyNote: "Nivel 1 — Diagnóstico: solo lectura. El sistema observa y explica. No modifica nada.",
      provider, model,
    };
  }

  private templateAnswer(question: string, index: SemseConsciousnessIndex): string {
    const q = question.toLowerCase();
    if (q.includes("madu") || q.includes("completo") || q.includes("estado")) {
      return `SEMSE OS tiene madurez global de ${index.maturity.globalScore}/100. Áreas más fuertes: ${index.maturity.strongestAreas.join(", ")}. Áreas que necesitan trabajo: ${index.maturity.weakestAreas.join(", ")}.`;
    }
    if (q.includes("riesgo") || q.includes("problema") || q.includes("falla")) {
      const all = [...index.risks.critical, ...index.risks.high];
      if (!all.length) return "No se detectaron riesgos críticos o altos en este momento.";
      return all.map((r) => `[${r.severity.toUpperCase()}] ${r.area}: ${r.message}`).join("\n");
    }
    if (q.includes("hacer") || q.includes("prioridad") || q.includes("siguiente")) {
      return index.recommendations.nextBestActions.slice(0, 4).join("\n");
    }
    return `Madurez: ${index.maturity.globalScore}/100. Ciclo monetizable: ${index.operationalState.monetizableFlowStatus}. Señales abiertas: ${index.operationalState.openSignals}. Próxima acción: ${index.recommendations.nextBestActions[0] ?? "revisar módulos pendientes"}.`;
  }
}
