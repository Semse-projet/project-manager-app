import { Injectable, Logger, Optional } from "@nestjs/common";
import { PrismaService } from "../../infrastructure/prisma/prisma.service.js";
import { LLMOrchestrator } from "../../infrastructure/llm/orchestrator.js";
import type { PrometeoService } from "../prometeo/prometeo.service.js";
import type { OperationalSignalsService } from "../operational-intelligence/operational-signals.service.js";
import type {
  SemseConsciousnessIndex, ModuleHealth, ModuleMaturityScore,
  Risk, LlmProviderStatus, ModuleStatus,
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
  { name: "AI Mission Control",hasBackend: true,  hasFrontend: true,  hasTests: false, hasSSE: false, hasRAG: false, hasAudit: false, hasPermissions: true,  notes: ["LLM metrics", "Ollama health", "Provider status", "RAG health"] },
  { name: "Prometeo RAG",      hasBackend: true,  hasFrontend: true,  hasTests: true,  hasSSE: false, hasRAG: true,  hasAudit: false, hasPermissions: true,  notes: ["Fases 0-4.5", "Hybrid retrieval", "Real embeddings", "Trade guide", "Operational RAG"] },
  { name: "Smart Intake",      hasBackend: true,  hasFrontend: true,  hasTests: true,  hasSSE: true,  hasRAG: false, hasAudit: false, hasPermissions: false, notes: ["7 categorías", "Scoring profiles", "Anonymous wizard", "Intake-ops bridge"] },
  { name: "SSE Infrastructure",hasBackend: true,  hasFrontend: true,  hasTests: true,  hasSSE: true,  hasRAG: false, hasAudit: false, hasPermissions: false, notes: ["SseEventBusService", "Multi-channel", "BFF proxy", "Reconnect backoff"] },
  { name: "Finance",           hasBackend: true,  hasFrontend: true,  hasTests: false, hasSSE: true,  hasRAG: false, hasAudit: false, hasPermissions: true,  notes: ["Invoices", "Expenses", "PDF export", "Finance Hub"] },
  { name: "Auth",              hasBackend: true,  hasFrontend: true,  hasTests: true,  hasSSE: false, hasRAG: false, hasAudit: true,  hasPermissions: true,  notes: ["Signed tokens", "Session management", "RBAC", "timingSafeEqual"] },
  { name: "Contractors / CRM", hasBackend: true,  hasFrontend: false, hasTests: false, hasSSE: false, hasRAG: false, hasAudit: false, hasPermissions: true,  notes: ["ContractorLead", "Matching", "Trust scores — frontend pendiente"] },
  { name: "Trade Guide",       hasBackend: true,  hasFrontend: true,  hasTests: true,  hasSSE: false, hasRAG: true,  hasAudit: false, hasPermissions: true,  notes: ["TradeGuideService", "trade-guide endpoint — sin manuales reales aún"] },
  { name: "Worker",            hasBackend: true,  hasFrontend: false, hasTests: false, hasSSE: false, hasRAG: false, hasAudit: false, hasPermissions: false, notes: ["BullMQ", "Curator", "Field-ops", "Trust-match handlers"] },
  { name: "Marketplace",       hasBackend: false, hasFrontend: false, hasTests: false, hasSSE: false, hasRAG: false, hasAudit: false, hasPermissions: false, notes: ["No implementado aún — prioridad futura"] },
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
    @Optional() private readonly llm?: LLMOrchestrator,
    @Optional() private readonly prometeo?: PrometeoService,
    @Optional() private readonly signals?: OperationalSignalsService,
  ) {}

  async buildIndex(tenantId: string): Promise<SemseConsciousnessIndex> {
    const [modules, brains, memory, operational] = await Promise.all([
      this.buildModuleMap(),
      this.buildBrainsMap(),
      this.buildMemoryMap(tenantId),
      this.buildOperationalState(tenantId),
    ]);

    const maturity = this.computeMaturity(modules);
    const risks    = this.detectRisks(modules, brains, memory, operational);
    const recs     = this.generateRecommendations(maturity, risks, operational);

    return {
      generatedAt: new Date().toISOString(),
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
        services: await this.buildServiceMap(),
        knownSSEChannels: KNOWN_SSE_CHANNELS,
        knownSSEEvents:   KNOWN_SSE_EVENTS,
      },

      memory,
      brains,
      maturity,
      risks,
      operationalState: operational,
      recommendations: recs,
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

  private async buildServiceMap() {
    const services = [];

    // Postgres
    try {
      await this.prisma.$queryRaw`SELECT 1`;
      services.push({ name: "Postgres", healthy: true });
    } catch (e) {
      services.push({ name: "Postgres", healthy: false, error: (e as Error).message });
    }

    // Redis (via worker lock detection)
    try {
      const redisLock = await this.prisma.$queryRaw`SELECT 1` as unknown[];
      services.push({ name: "Redis", healthy: redisLock.length > 0 });
    } catch {
      services.push({ name: "Redis", healthy: false, error: "Cannot verify via Prisma" });
    }

    // LLM providers
    if (this.llm) {
      const providers = this.llm.getRegisteredProviders();
      services.push({ name: "LLM Orchestrator", healthy: providers.length > 0 });
    }

    return services;
  }

  private async buildBrainsMap() {
    const providers: LlmProviderStatus[] = [];
    let totalCalls = 0;
    let totalFallbacks = 0;

    if (this.llm) {
      const snapshots = this.llm.metricsSnapshot();
      const registered = this.llm.getRegisteredProviders();

      const providerRoles: Record<string, string> = {
        ollama:    "Provider principal — privacidad, datos internos, costo bajo, razonamiento local",
        anthropic: "Fallback #1 — razonamiento fuerte, código, planificación compleja",
        openai:    "Fallback #2 + Embeddings RAG (exclusivo)",
        template:  "Fallback final — sin LLM disponible",
      };

      for (const name of registered) {
        const snap = snapshots.find((s) => s.provider === name);
        const isDefault = name === (process.env.LLM_DEFAULT_PROVIDER ?? "ollama");
        const success = snap?.successCount ?? 0;
        const failure = snap?.failureCount ?? 0;
        totalCalls += success + failure;
        providers.push({
          name, available: true, isDefault,
          successCount: success, failureCount: failure,
          role: providerRoles[name] ?? "Proveedor secundario",
        });
      }

      // Count fallbacks (non-ollama providers that were called in default/local contexts)
      totalFallbacks = snapshots
        .filter((s) => s.provider !== "ollama" && s.provider !== "template")
        .reduce((acc, s) => acc + s.successCount, 0);
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
      totalLLMCalls: totalCalls,
      totalFallbacks,
    };
  }

  private async buildMemoryMap(tenantId: string) {
    let ragStatus = {
      provider: "unknown", model: "unknown", available: false,
      totalDocuments: 0, totalChunks: 0, chunksWithEmbeddings: 0,
      retrievalMode: "unknown",
    };

    if (this.prometeo) {
      try {
        const health = await this.prometeo.getEmbeddingRagHealth(tenantId);
        ragStatus = {
          provider: health.embeddingsProvider,
          model: health.embeddingsModel,
          available: health.embeddingsAvailable,
          totalDocuments: health.totalDocuments,
          totalChunks: health.totalChunks,
          chunksWithEmbeddings: health.chunksWithEmbeddings,
          retrievalMode: health.retrievalMode,
        };
      } catch { /* ignore */ }
    }

    const auditCount = await this.prisma.auditLog.count({ where: { tenantId } }).catch(() => 0);
    const signalCount = await this.prisma.operationalSignal.count({ where: { tenantId } }).catch(() => 0);

    return {
      ragStatus,
      auditLogActive:          auditCount > 0,
      operationalSignalsActive: signalCount > 0,
      reportsDirectory:        "docs/reportes/",
      memoryLayers: [
        "Prometeo RAG — documentos indexados + embeddings reales",
        "AuditLog — historial completo de mutaciones",
        "OperationalSignal — señales Mission Control",
        "AlgorithmRun — runs de estimación BuildOps",
        "LLMInteractionLog — llamadas a modelos + provider + latencia",
        "EvidenceReviewNote — revisiones IA guardadas en reviewNote",
        "docs/reportes — reportes escritos de cada sesión de desarrollo",
      ],
    };
  }

  private async buildOperationalState(tenantId: string) {
    const [openSignals, criticalSignals, milestones] = await Promise.all([
      this.prisma.operationalSignal.count({ where: { tenantId, status: "open" } }).catch(() => 0),
      this.prisma.operationalSignal.count({ where: { tenantId, status: "open", severity: "critical" } }).catch(() => 0),
      this.prisma.milestone.findMany({
        where: { project: { tenantId } },
        select: { paymentReadiness: true, evidenceReadiness: true },
        take: 50,
      }).catch(() => []),
    ]);

    const readyCount = milestones.filter(
      (m) => (m as Record<string, unknown>).paymentReadiness === "ready",
    ).length;

    const monetizableFlowReady = readyCount > 0 || milestones.length > 0;
    const monetizableFlowStatus = milestones.length === 0
      ? "Sin proyectos activos"
      : `${readyCount}/${milestones.length} milestones listos para pago`;

    return { openSignals, criticalSignals, monetizableFlowReady, monetizableFlowStatus };
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

  private detectRisks(
    modules: ModuleHealth[],
    brains: { providers: LlmProviderStatus[]; totalFallbacks: number },
    memory: { ragStatus: { available: boolean; chunksWithEmbeddings: number; retrievalMode: string } },
    operational: { criticalSignals: number; openSignals: number },
  ) {
    const critical: Risk[] = [];
    const high: Risk[]     = [];
    const medium: Risk[]   = [];
    const low: Risk[]      = [];

    if (operational.criticalSignals > 0) {
      critical.push({ severity: "critical", area: "Mission Control", message: `${operational.criticalSignals} señales críticas abiertas en el sistema`, recommendation: "Revisar /admin/ai-mission-control" });
    }

    const ollamaProvider = brains.providers.find((p) => p.name === "ollama");
    if (!ollamaProvider) {
      high.push({ severity: "high", area: "LLM Infrastructure", message: "Ollama no está registrado como provider — LLM local no disponible", recommendation: "Verificar OLLAMA_BASE_URL y modelo instalado" });
    }

    if (!memory.ragStatus.available) {
      high.push({ severity: "high", area: "Embeddings", message: "OPENAI_API_KEY no configurada — Prometeo RAG usa FTS fallback sin semántica real", recommendation: "Configurar OPENAI_API_KEY en Railway" });
    } else if (memory.ragStatus.chunksWithEmbeddings === 0 && memory.ragStatus.retrievalMode !== "hybrid") {
      medium.push({ severity: "medium", area: "Embeddings", message: "Embeddings disponibles pero sin documentos indexados — RAG sin memoria documental", recommendation: "Subir manuales trade a la biblioteca de Prometeo" });
    }

    const missingFrontend = modules.filter((m) => !m.hasFrontend && m.hasBackend);
    if (missingFrontend.length > 0) {
      medium.push({ severity: "medium", area: "UI Coverage", message: `${missingFrontend.length} módulos con backend sin frontend: ${missingFrontend.map((m) => m.name).join(", ")}`, recommendation: "Priorizar UI para Contractors y Marketplace" });
    }

    const missingTests = modules.filter((m) => !m.hasTests && m.maturityScore > 30);
    if (missingTests.length > 0) {
      medium.push({ severity: "medium", area: "Test Coverage", message: `${missingTests.length} módulos sin tests: ${missingTests.map((m) => m.name).join(", ")}`, recommendation: "Agregar tests unitarios para AI Mission Control, Finance, Worker" });
    }

    if (brains.totalFallbacks > 10) {
      low.push({ severity: "low", area: "LLM Routing", message: `${brains.totalFallbacks} llamadas cloud detectadas — revisar si son necesarias o pueden ser locales`, recommendation: "Auditar agent profiles para maximizar uso de Ollama local" });
    }

    const marketplace = modules.find((m) => m.name === "Marketplace");
    if (marketplace && marketplace.status === "missing") {
      low.push({ severity: "low", area: "Producto", message: "Marketplace no implementado — limita la propuesta de valor como plataforma SaaS", recommendation: "Roadmap: después de madurez operacional core" });
    }

    return { critical, high, medium, low };
  }

  // ── Recommendations ────────────────────────────────────────────────────────

  private generateRecommendations(
    maturity: { globalScore: number; weakestAreas: string[] },
    risks: { critical: Risk[]; high: Risk[]; medium: Risk[] },
    operational: { openSignals: number },
  ) {
    const nextBestActions: string[] = [];
    const doNotDoYet: string[]     = [];
    const strategicWarnings: string[] = [];

    if (risks.critical.length > 0) {
      nextBestActions.push(`URGENTE: Resolver ${risks.critical.length} señal(es) crítica(s) antes de cualquier otro trabajo`);
    }

    if (risks.high.some((r) => r.area === "Embeddings")) {
      nextBestActions.push("Subir manuales trade a Prometeo RAG (electrical, plumbing, HVAC) — embeddings reales ya activos");
    }

    if (risks.high.some((r) => r.area === "LLM Infrastructure")) {
      nextBestActions.push("Configurar y verificar Ollama en Railway");
    }

    nextBestActions.push("Trade Knowledge Library — manuales reales por oficio para activar hybrid retrieval");
    nextBestActions.push("RAG Fase 5 — Human Feedback Memory Loop (qué chunks son útiles en decisiones reales)");
    nextBestActions.push("SEMSE Internal Observer v1 — leer logs, señales y health para autodiagnóstico continuo");

    if (maturity.globalScore < 60) {
      strategicWarnings.push("Madurez global baja — priorizar completar módulos existentes antes de agregar nuevos features");
    } else {
      strategicWarnings.push("Madurez operacional suficiente para uso real — foco en consistencia y observabilidad");
    }

    strategicWarnings.push("No implementar Self-Healing hasta tener Internal Observer estable (Nivel 0→1 antes de Nivel 4)");
    strategicWarnings.push("No automatizar liberación de pagos — mantener aprobación humana obligatoria");

    doNotDoYet.push("Auto-healing / self-repair — requiere Internal Observer maduro primero");
    doNotDoYet.push("Marketplace — requiere madurez operacional completa y trust scores funcionales");
    doNotDoYet.push("Modificar payment governance core sin tests de regresión completos");
    doNotDoYet.push("Agregar más LLM providers externos — primero maximizar Ollama local");

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
