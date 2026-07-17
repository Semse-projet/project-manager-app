import { Injectable, Logger, Optional } from "@nestjs/common";
import { PrismaService } from "../../infrastructure/prisma/prisma.service.js";
import { LLMOrchestrator } from "../../infrastructure/llm/orchestrator.js";
import { SseEventBusService } from "../../infrastructure/sse/sse-event-bus.service.js";
import { BehavioralObserverService, type BehavioralHealth } from "./behavioral-observer.service.js";

// ── Types ─────────────────────────────────────────────────────────────────────

export type InfraHealth = {
  name: string;
  healthy: boolean;
  latencyMs?: number;
  detail?: string;
};

export type SignalPattern = {
  type: string;
  count: number;
  severity: string;
  lastSeen: string;
  interpretation: string;
};

export type ObserverAlert = {
  level: "critical" | "high" | "medium" | "info";
  area: string;
  message: string;
  recommendation: string;
};

export type ObservationSnapshot = {
  observedAt:    string;
  tenantId:      string;
  healthScore:   number;     // 0–100
  autonomyNote:  string;

  infrastructure: {
    items:    InfraHealth[];
    allHealthy: boolean;
    unhealthyCount: number;
  };

  operationalHealth: {
    openSignals:        number;
    criticalSignals:    number;
    highSignals:        number;
    recentSignalTypes:  string[];
    topSignal:          { type: string; severity: string; message: string } | null;
    milestones:         { total: number; blockedPayment: number; readyPayment: number };
    changeOrders:       { pendingCount: number };
  };

  intelligenceHealth: {
    llmTotalCalls:   number;
    llmFallbacks:    number;
    fallbackRate:    number;        // 0–1
    ollamaAvailable: boolean;
    embeddingsMode:  string;
    ragDocuments:    number;
    ragChunks:       number;
    ragEmbedded:     number;
    ragMissingEmbeddings: number;
  };

  patterns: SignalPattern[];
  alerts:   ObserverAlert[];
  behavioralHealth: BehavioralHealth | null;

  /** PI-09 — salud de experiencia de usuario (null si PI está apagado). */
  experienceHealth: {
    sessions7d: number;
    frictionSignals24h: number;
    highFriction24h: number;
    topFrictionRoute: string | null;
  } | null;
};

// ── Pattern rules ─────────────────────────────────────────────────────────────

const SIGNAL_INTERPRETATIONS: Record<string, string> = {
  EVIDENCE_GAP:           "Hay trabajo con evidencia incompleta o rechazada — puede bloquear pagos",
  PAYMENT_BLOCKED:        "Pagos bloqueados activos — requiere atención antes de liberar escrow",
  DISPUTE_RISK_HIGH:      "Riesgo de disputa elevado — situación con múltiples factores críticos simultáneos",
  CHANGE_ORDER_RECOMMENDED: "Trabajo adicional detectado sin change order formal — documentar para proteger ingresos",
  LOW_CONFIDENCE_ESTIMATE: "Estimados con baja confianza — datos de intake insuficientes",
  EXPERIENCE_FRICTION:     "Fricción de usuario detectada por Product Intelligence — revisar la vista afectada",
};

// ── Service ───────────────────────────────────────────────────────────────────

@Injectable()
export class SystemObserverService {
  private readonly logger = new Logger(SystemObserverService.name);

  // In-memory observation history (last 50 snapshots — no DB to keep it lean)
  private readonly history: ObservationSnapshot[] = [];

  constructor(
    private readonly prisma: PrismaService,
    @Optional() private readonly llm?: LLMOrchestrator,
    @Optional() private readonly sse?: SseEventBusService,
    @Optional() private readonly behavioralObserver?: BehavioralObserverService,
  ) {}

  async observe(tenantId: string): Promise<ObservationSnapshot> {
    const observedAt = new Date().toISOString();

    const [infra, operational, intelligence, behavioralHealth, experienceHealth] = await Promise.all([
      this.observeInfrastructure(),
      this.observeOperational(tenantId),
      this.observeIntelligence(tenantId),
      this.behavioralObserver?.observe(tenantId).catch(() => null) ?? Promise.resolve(null),
      this.observeExperience(tenantId).catch(() => null),
    ]);

    const patterns = this.detectPatterns(operational);
    const alerts   = this.generateAlerts(infra, operational, intelligence, patterns);
    const healthScore = this.computeHealthScore(infra, operational, intelligence, alerts);

    const snapshot: ObservationSnapshot = {
      observedAt,
      tenantId,
      healthScore,
      autonomyNote: "Nivel 0-1 — Solo lectura. Observer no modifica nada.",
      infrastructure: infra,
      operationalHealth: operational,
      intelligenceHealth: intelligence,
      patterns,
      alerts,
      behavioralHealth: behavioralHealth ?? null,
      experienceHealth,
    };

    if (experienceHealth && experienceHealth.highFriction24h > 0) {
      alerts.push({
        level: "high",
        area: "experiencia",
        message: `${experienceHealth.highFriction24h} señales de fricción alta en 24h (ruta principal: ${experienceHealth.topFrictionRoute ?? "?"}).`,
        recommendation: "Revisar /admin/product-intelligence y la vista afectada antes de que impacte conversión.",
      });
    }

    // Keep last 50 in memory
    this.history.push(snapshot);
    if (this.history.length > 50) this.history.shift();

    // SSE: emit to AI Mission Control channel when there are critical/high alerts
    if (alerts.some((a) => a.level === "critical" || a.level === "high")) {
      this.sse?.emit(`mission-control:${tenantId}`, "observer:alert", {
        healthScore,
        alertCount: alerts.length,
        criticalCount: alerts.filter((a) => a.level === "critical").length,
        highCount: alerts.filter((a) => a.level === "high").length,
        topAlert: alerts[0] ? { level: alerts[0].level, area: alerts[0].area, message: alerts[0].message } : null,
        observedAt: snapshot.observedAt,
      });
    }

    this.logger.log(`[Observer] snapshot tenantId=${tenantId} score=${healthScore} alerts=${alerts.length}`);
    return snapshot;
  }

  /** PI-09 — lee señales de Product Intelligence. Null si PI está apagado. */
  private async observeExperience(tenantId: string): Promise<ObservationSnapshot["experienceHealth"]> {
    if (process.env.PRODUCT_INTELLIGENCE_ENABLED !== "true") return null;
    const day = new Date(Date.now() - 24 * 3_600_000);
    const week = new Date(Date.now() - 7 * 24 * 3_600_000);
    const [sessions7d, friction24h, high24h, top] = await Promise.all([
      this.prisma.productSession.count({ where: { tenantId, lastSeen: { gte: week } } }),
      this.prisma.frictionSignal.count({ where: { tenantId, createdAt: { gte: day } } }),
      this.prisma.frictionSignal.count({ where: { tenantId, createdAt: { gte: day }, severity: "high" } }),
      this.prisma.frictionSignal.findFirst({
        where: { tenantId, createdAt: { gte: day } },
        orderBy: { createdAt: "desc" },
        select: { route: true },
      }),
    ]);
    return {
      sessions7d,
      frictionSignals24h: friction24h,
      highFriction24h: high24h,
      topFrictionRoute: top?.route ?? null,
    };
  }

  getHistory(): ObservationSnapshot[] {
    return [...this.history];
  }

  getLatest(): ObservationSnapshot | null {
    return this.history.length > 0 ? this.history[this.history.length - 1]! : null;
  }

  // ── Infrastructure observation ────────────────────────────────────────────

  private async observeInfrastructure() {
    const items: InfraHealth[] = [];

    // Postgres
    const dbStart = Date.now();
    try {
      await this.prisma.$queryRaw`SELECT 1`;
      items.push({ name: "Postgres", healthy: true, latencyMs: Date.now() - dbStart });
    } catch (e) {
      items.push({ name: "Postgres", healthy: false, detail: (e as Error).message.slice(0, 100) });
    }

    // Redis (via worker lock presence)
    try {
      const workerActivity = await this.prisma.$queryRaw`SELECT COUNT(*) FROM "AuditLog" LIMIT 1` as unknown[];
      items.push({ name: "Database", healthy: Array.isArray(workerActivity), detail: "AuditLog accessible" });
    } catch {
      items.push({ name: "Database", healthy: false, detail: "AuditLog not accessible" });
    }

    // LLM Orchestrator
    if (this.llm) {
      const providers = this.llm.getRegisteredProviders();
      items.push({ name: "LLM Orchestrator", healthy: providers.length > 0, detail: `${providers.length} provider(s): ${providers.join(", ")}` });
    } else {
      items.push({ name: "LLM Orchestrator", healthy: false, detail: "Not registered in this context" });
    }

    // OpenAI Embeddings
    const hasOpenAI = typeof process.env.OPENAI_API_KEY === "string" && process.env.OPENAI_API_KEY.length > 10;
    items.push({ name: "OpenAI Embeddings", healthy: hasOpenAI, detail: hasOpenAI ? "API key configurada" : "OPENAI_API_KEY no configurada" });

    // Ollama
    const ollamaUrl = process.env.OLLAMA_BASE_URL ?? "http://localhost:11434";
    try {
      const ctrl = new AbortController();
      const timer = setTimeout(() => ctrl.abort(), 3000);
      const resp = await fetch(`${ollamaUrl}/api/tags`, { signal: ctrl.signal }).finally(() => clearTimeout(timer));
      items.push({ name: "Ollama", healthy: resp.ok, detail: resp.ok ? `${ollamaUrl} respondiendo` : `HTTP ${resp.status}` });
    } catch {
      items.push({ name: "Ollama", healthy: false, detail: `${ollamaUrl} no accesible (localOnly modes usarán template fallback)` });
    }

    const unhealthy = items.filter((i) => !i.healthy);
    return { items, allHealthy: unhealthy.length === 0, unhealthyCount: unhealthy.length };
  }

  // ── Operational observation ───────────────────────────────────────────────

  private async observeOperational(tenantId: string) {
    const [openSignals, criticalSignals, highSignals, recentSignals, milestones, changeOrders] =
      await Promise.all([
        this.prisma.operationalSignal.count({ where: { tenantId, status: "open" } }).catch(() => 0),
        this.prisma.operationalSignal.count({ where: { tenantId, status: "open", severity: "critical" } }).catch(() => 0),
        this.prisma.operationalSignal.count({ where: { tenantId, status: "open", severity: "high" } }).catch(() => 0),
        this.prisma.operationalSignal.findMany({
          where: { tenantId, status: "open" },
          orderBy: [{ severity: "asc" }, { createdAt: "desc" }],
          take: 10,
          select: { type: true, severity: true, message: true, createdAt: true, title: true },
        }).catch(() => [] as Array<{ type: string; severity: string; message: string; createdAt: Date; title: string }>),
        this.prisma.milestone.findMany({
          where: { project: { tenantId } },
          select: { paymentReadiness: true },
          take: 100,
        }).catch(() => [] as Array<{ paymentReadiness: string | null }>),
        this.prisma.changeOrderCandidate.count({
          where: { tenantId, status: { in: ["predicted", "submitted", "changes_requested"] } },
        }).catch(() => 0),
      ]);

    const blockedPayment = milestones.filter((m) => {
      const r = (m as Record<string, unknown>).paymentReadiness as string | null;
      return r === "not_ready" || r === "blocked";
    }).length;
    const readyPayment = milestones.filter((m) => {
      const r = (m as Record<string, unknown>).paymentReadiness as string | null;
      return r === "ready" || r === "released";
    }).length;

    const recentSignalTypes = [...new Set(recentSignals.map((s) => s.type))];
    const topSignal = recentSignals[0]
      ? { type: recentSignals[0].type, severity: recentSignals[0].severity, message: recentSignals[0].message }
      : null;

    return {
      openSignals, criticalSignals, highSignals,
      recentSignalTypes, topSignal,
      milestones: { total: milestones.length, blockedPayment, readyPayment },
      changeOrders: { pendingCount: changeOrders },
    };
  }

  // ── Intelligence observation ──────────────────────────────────────────────

  private async observeIntelligence(tenantId: string) {
    let llmTotalCalls = 0;
    let llmFallbacks  = 0;
    let ollamaAvailable = false;

    if (this.llm) {
      const snapshots = this.llm.metricsSnapshot();
      llmTotalCalls = snapshots.reduce((s, p) => s + p.successCount + p.failureCount, 0);
      llmFallbacks  = snapshots.filter((p) => p.provider !== "ollama").reduce((s, p) => s + p.successCount, 0);
      ollamaAvailable = this.llm.getRegisteredProviders().includes("ollama");
    }

    const fallbackRate = llmTotalCalls > 0 ? llmFallbacks / llmTotalCalls : 0;

    // RAG stats from Prisma (no circular dep)
    const hasOpenAI = typeof process.env.OPENAI_API_KEY === "string" && process.env.OPENAI_API_KEY.length > 10;
    let ragDocuments = 0; let ragChunks = 0; let ragEmbedded = 0;

    try {
      const docs = await this.prisma.prometeoDocument.findMany({
        where: { tenantId, status: "indexed" }, select: { id: true, chunkCount: true },
      });
      ragDocuments = await this.prisma.prometeoDocument.count({ where: { tenantId } });
      ragChunks = docs.reduce((s, d) => s + d.chunkCount, 0);

      // Count ALL chunks with non-zero embeddings (not a sample)
      // Use aggregation to avoid memory overhead with large datasets
      const chunkCounts = await Promise.all(
        docs.map((doc) =>
          this.prisma.documentChunk.count({
            where: {
              tenantId,
              documentId: doc.id,
              embeddingJson: { not: {} },
            },
          }),
        ),
      ).catch(() => [] as number[]);

      ragEmbedded = chunkCounts.reduce((sum, count) => sum + count, 0);
    } catch { /* ignore */ }

    const embeddingsMode = hasOpenAI && ragEmbedded > 0 ? "hybrid" : "fts_fallback";

    return {
      llmTotalCalls, llmFallbacks, fallbackRate, ollamaAvailable,
      embeddingsMode, ragDocuments, ragChunks,
      ragEmbedded, ragMissingEmbeddings: ragChunks - ragEmbedded,
    };
  }

  // ── Pattern detection ─────────────────────────────────────────────────────

  private detectPatterns(op: ObservationSnapshot["operationalHealth"]): SignalPattern[] {
    const patterns: SignalPattern[] = [];

    // Count signal types
    const typeCounts = new Map<string, number>();
    op.recentSignalTypes.forEach((t) => typeCounts.set(t, (typeCounts.get(t) ?? 0) + 1));

    typeCounts.forEach((count, type) => {
      if (count >= 1) {
        patterns.push({
          type, count,
          severity: op.criticalSignals > 0 ? "critical" : op.highSignals > 0 ? "high" : "medium",
          lastSeen: new Date().toISOString(),
          interpretation: SIGNAL_INTERPRETATIONS[type] ?? `Señal recurrente de tipo ${type}`,
        });
      }
    });

    // Payment pattern
    if (op.milestones.blockedPayment > 2) {
      patterns.push({
        type: "PAYMENT_BACKLOG",
        count: op.milestones.blockedPayment,
        severity: "high",
        lastSeen: new Date().toISOString(),
        interpretation: `${op.milestones.blockedPayment} milestones con pagos bloqueados — posible acumulación de trabajo sin evidencia`,
      });
    }

    return patterns;
  }

  // ── Alert generation ──────────────────────────────────────────────────────

  private generateAlerts(
    infra: ObservationSnapshot["infrastructure"],
    op: ObservationSnapshot["operationalHealth"],
    intel: ObservationSnapshot["intelligenceHealth"],
    patterns: SignalPattern[],
  ): ObserverAlert[] {
    const alerts: ObserverAlert[] = [];

    // Infrastructure alerts
    infra.items.filter((i) => !i.healthy).forEach((i) => {
      const level: ObserverAlert["level"] = i.name === "Postgres" ? "critical" : "high";
      alerts.push({ level, area: "Infrastructure", message: `${i.name} no healthy: ${i.detail ?? "sin detalle"}`, recommendation: `Verificar ${i.name} en Railway Dashboard` });
    });

    // Critical signals
    if (op.criticalSignals > 0) {
      alerts.push({ level: "critical", area: "Mission Control", message: `${op.criticalSignals} señal(es) crítica(s) abierta(s)`, recommendation: "Revisar /admin/ai-mission-control inmediatamente" });
    } else if (op.highSignals > 2) {
      alerts.push({ level: "high", area: "Mission Control", message: `${op.highSignals} señales de alta severidad activas`, recommendation: "Revisar y resolver señales antes de liberar pagos" });
    }

    // Payment blockers
    if (op.milestones.blockedPayment > 0) {
      alerts.push({ level: "medium", area: "Payment Governance", message: `${op.milestones.blockedPayment} milestone(s) con pago bloqueado`, recommendation: "Revisar evidencia y governance por milestone" });
    }

    // Change orders
    if (op.changeOrders.pendingCount > 3) {
      alerts.push({ level: "medium", area: "Change Orders", message: `${op.changeOrders.pendingCount} change orders pendientes de resolución`, recommendation: "Revisar y resolver change orders antes de que bloqueen más pagos" });
    }

    // LLM fallback rate
    if (intel.fallbackRate > 0.5 && intel.llmTotalCalls > 10) {
      alerts.push({ level: "high", area: "LLM Intelligence", message: `${Math.round(intel.fallbackRate * 100)}% de llamadas LLM usan cloud fallback — Ollama puede estar caído`, recommendation: "Verificar Ollama en Railway o VPS configurado" });
    } else if (!intel.ollamaAvailable) {
      alerts.push({ level: "medium", area: "LLM Intelligence", message: "Ollama no registrado en este contexto — localOnly/privacyCritical usan template fallback", recommendation: "Verificar OLLAMA_BASE_URL y disponibilidad del modelo" });
    }

    // RAG mode
    if (intel.embeddingsMode === "fts_fallback") {
      alerts.push({ level: "medium", area: "Prometeo RAG", message: "RAG en modo FTS fallback — sin embeddings semánticos reales", recommendation: "Verificar OPENAI_API_KEY y ejecutar backfill si hay documentos" });
    } else if (intel.ragMissingEmbeddings > 10) {
      alerts.push({ level: "medium", area: "Prometeo RAG", message: `${intel.ragMissingEmbeddings} chunks sin embeddings reales`, recommendation: "POST /v1/prometeo/embeddings/backfill" });
    }

    // Pattern alerts
    patterns.filter((p) => p.severity === "critical").forEach((p) => {
      alerts.push({ level: "critical", area: "Pattern", message: p.interpretation, recommendation: "Revisar raíz del patrón — posible problema sistémico" });
    });

    return alerts;
  }

  // ── Health score computation ───────────────────────────────────────────────

  private computeHealthScore(
    infra: ObservationSnapshot["infrastructure"],
    op: ObservationSnapshot["operationalHealth"],
    intel: ObservationSnapshot["intelligenceHealth"],
    alerts: ObserverAlert[],
  ): number {
    let score = 100;

    // Infrastructure deductions
    score -= infra.unhealthyCount * 15;
    if (!infra.items.find((i) => i.name === "Postgres")?.healthy) score -= 30; // critical

    // Operational deductions
    score -= op.criticalSignals * 20;
    score -= op.highSignals * 8;
    score -= Math.min(op.milestones.blockedPayment * 3, 15);

    // Intelligence deductions
    if (intel.embeddingsMode === "fts_fallback") score -= 10;
    if (intel.fallbackRate > 0.5) score -= 10;
    if (!intel.ollamaAvailable) score -= 5;

    // Alert bonus deductions
    score -= alerts.filter((a) => a.level === "critical").length * 5;
    score -= alerts.filter((a) => a.level === "high").length * 3;

    return Math.max(0, Math.min(100, score));
  }
}
