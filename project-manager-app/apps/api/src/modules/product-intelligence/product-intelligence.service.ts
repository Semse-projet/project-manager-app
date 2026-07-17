import { Injectable, Logger, Optional } from "@nestjs/common";
import type { Prisma, ProductConsentClass } from "@prisma/client";
import type { ProductEventBatch } from "@semse/schemas";
import { redactValue } from "@semse/product-events";
import { PrismaService } from "../../infrastructure/prisma/prisma.service.js";
import { OperationalSignalsService } from "../operational-intelligence/operational-signals.service.js";

/**
 * Product Intelligence (PI-04) — ingesta de telemetría + retención.
 * Spec: docs/specs/platform/product-intelligence.spec.md (APPROVED 2026-07-13).
 *
 * El SDK redacta en cliente; aquí se re-redacta como defensa en profundidad:
 * ningún payload persistido puede contener emails/teléfonos/direcciones.
 */

export type IngestResult = { accepted: number; duplicated: boolean };

export type RetentionResult = {
  productEventsDeleted: number;
  productSessionsDeleted: number;
  frictionSignalsDeleted: number;
  ingestBatchesDeleted: number;
};

const IDENTIFIABLE_RETENTION_DAYS = 30;
const SIGNAL_RETENTION_DAYS = 90;

function redactScalar(value: unknown): unknown {
  return typeof value === "string" ? redactValue(value) : value;
}

@Injectable()
export class ProductIntelligenceService {
  private readonly logger = new Logger(ProductIntelligenceService.name);

  constructor(
    private readonly prisma: PrismaService,
    @Optional() private readonly operationalSignals?: OperationalSignalsService,
  ) {}

  async ingest(tenantId: string, batch: ProductEventBatch): Promise<IngestResult> {
    const existing = await this.prisma.productIngestBatch.findUnique({
      where: { batchId: batch.batchId },
    });
    if (existing) {
      return { accepted: 0, duplicated: true };
    }

    try {
      await this.prisma.$transaction(async (tx: Prisma.TransactionClient) => {
        await tx.productIngestBatch.create({
          data: {
            batchId: batch.batchId,
            tenantId,
            acceptedCount: batch.events.length,
            consentClass: batch.consentClass.toUpperCase() as ProductConsentClass,
          },
        });
        await tx.productSession.upsert({
          where: { sessionId: batch.session.sessionId },
          create: {
            sessionId: batch.session.sessionId,
            tenantId,
            anonymousId: batch.session.anonymousId,
            userId: batch.session.userId,
          },
          update: {
            lastSeen: new Date(),
            userId: batch.session.userId ?? undefined,
          },
        });
        await tx.productEvent.createMany({
          data: batch.events.map((event) => ({
            tenantId,
            sessionId: batch.session.sessionId,
            batchId: batch.batchId,
            name: event.name,
            route: redactValue(event.route),
            propsJson: Object.fromEntries(
              Object.entries(event.props ?? {}).map(([key, value]) => [key, redactScalar(value)]),
            ) as Prisma.InputJsonValue,
            ts: new Date(event.ts),
          })),
        });
      });
    } catch (error) {
      // Carrera entre reintentos concurrentes del mismo batch: el unique de
      // ProductIngestBatch convierte al perdedor en no-op idempotente.
      if ((error as { code?: string }).code === "P2002") {
        return { accepted: 0, duplicated: true };
      }
      throw error;
    }

    return { accepted: batch.events.length, duplicated: false };
  }

  /** PI-05.2 — funnel de eventos por nombre en una ventana de días. */
  async getFunnel(tenantId: string, days = 7): Promise<{
    windowDays: number;
    since: string;
    sessions: number;
    events: Array<{ name: string; count: number }>;
  }> {
    const since = new Date(Date.now() - Math.min(Math.max(days, 1), 90) * 86_400_000);
    const [grouped, sessions] = await Promise.all([
      this.prisma.productEvent.groupBy({
        by: ["name"],
        where: { tenantId, ts: { gte: since } },
        _count: { name: true },
      }),
      this.prisma.productSession.count({
        where: { tenantId, lastSeen: { gte: since } },
      }),
    ]);
    const events = (grouped as Array<{ name: string; _count: { name: number } }>)
      .map((row) => ({ name: row.name, count: row._count.name }))
      .sort((a, b) => b.count - a.count);
    return { windowDays: days, since: since.toISOString(), sessions, events };
  }

  /**
   * PI-06 — funnel económico derivado de las tablas de dominio (fuente de
   * verdad del servidor, sin duplicar eventos de UI):
   * job → primer bid → contrato → escrow → pago liberado.
   * "Evidence" no entra como etapa: Evidence cuelga de Project, no de Job.
   */
  async getEconomicFunnel(tenantId: string, days = 30): Promise<{
    windowDays: number;
    since: string;
    stages: Array<{ stage: string; count: number; conversionPct: number; medianHoursFromJob: number | null }>;
  }> {
    const windowDays = Math.min(Math.max(days, 1), 180);
    const since = new Date(Date.now() - windowDays * 86_400_000);
    const jobs = await this.prisma.job.findMany({
      where: { tenantId, deletedAt: null, createdAt: { gte: since } },
      take: 1000,
      select: {
        createdAt: true,
        bids: { select: { createdAt: true }, orderBy: { createdAt: "asc" }, take: 1 },
        contract: { select: { createdAt: true } },
        escrow: { select: { createdAt: true, status: true } },
      },
    });

    type JobRow = {
      createdAt: Date;
      bids: Array<{ createdAt: Date }>;
      contract: { createdAt: Date } | null;
      escrow: { createdAt: Date; status: string } | null;
    };
    const rows = jobs as JobRow[];

    const hoursFromJob = (row: JobRow, at: Date | undefined | null): number | null =>
      at ? (at.getTime() - row.createdAt.getTime()) / 3_600_000 : null;

    const median = (values: number[]): number | null => {
      if (values.length === 0) return null;
      const sorted = [...values].sort((a, b) => a - b);
      const mid = Math.floor(sorted.length / 2);
      const value = sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
      return Math.round(value * 10) / 10;
    };

    const withBid = rows.filter((r) => r.bids.length > 0);
    const withContract = rows.filter((r) => r.contract);
    const withEscrow = rows.filter((r) => r.escrow);
    const paid = rows.filter((r) => r.escrow?.status === "RELEASED" || r.escrow?.status === "CLOSED");

    const total = rows.length;
    const pct = (count: number) => (total > 0 ? Math.round((count / total) * 1000) / 10 : 0);

    const stages = [
      { stage: "job_created", count: total, conversionPct: total > 0 ? 100 : 0, medianHoursFromJob: null as number | null },
      {
        stage: "first_bid",
        count: withBid.length,
        conversionPct: pct(withBid.length),
        medianHoursFromJob: median(withBid.map((r) => hoursFromJob(r, r.bids[0]?.createdAt)).filter((v): v is number => v !== null)),
      },
      {
        stage: "contract",
        count: withContract.length,
        conversionPct: pct(withContract.length),
        medianHoursFromJob: median(withContract.map((r) => hoursFromJob(r, r.contract?.createdAt)).filter((v): v is number => v !== null)),
      },
      {
        stage: "escrow_funded",
        count: withEscrow.length,
        conversionPct: pct(withEscrow.length),
        medianHoursFromJob: median(withEscrow.map((r) => hoursFromJob(r, r.escrow?.createdAt)).filter((v): v is number => v !== null)),
      },
      {
        stage: "payment_released",
        count: paid.length,
        conversionPct: pct(paid.length),
        medianHoursFromJob: null,
      },
    ];

    return { windowDays, since: since.toISOString(), stages };
  }

  /**
   * PI-07/PI-08 — engines de fricción y anomalía. Corren sobre los
   * ProductEvents de la ventana (default 6h):
   * - PI-07: agrega friction.rage_click / friction.nav_loop / app.error_view
   *   por ruta → FrictionSignal (con dedupe por ventana).
   * - PI-08: anomalías de funnel (llegadas al wizard sin publicaciones) y
   *   fricción alta → OperationalSignal EXPERIENCE_FRICTION (Mission Control).
   * Nunca interviene: solo OBSERVE→ANALYZE→SUGGEST.
   */
  async runEngines(windowHours = 6): Promise<{
    windowHours: number;
    frictionSignalsCreated: number;
    operationalSignalsCreated: number;
  }> {
    const windowStart = new Date(Date.now() - Math.min(Math.max(windowHours, 1), 48) * 3_600_000);
    const windowEnd = new Date();

    const FRICTION_RULES: Array<{ eventName: string; kind: "RAGE_CLICK" | "NAV_LOOP" | "ERROR_REPEAT" | "FORM_ABANDON"; threshold: number }> = [
      { eventName: "friction.rage_click", kind: "RAGE_CLICK", threshold: 3 },
      { eventName: "friction.nav_loop", kind: "NAV_LOOP", threshold: 3 },
      { eventName: "app.error_view", kind: "ERROR_REPEAT", threshold: 5 },
      { eventName: "friction.form_abandon", kind: "FORM_ABANDON", threshold: 3 },
    ];

    let frictionCreated = 0;
    let operationalCreated = 0;

    for (const rule of FRICTION_RULES) {
      const grouped = await this.prisma.productEvent.groupBy({
        by: ["tenantId", "route"],
        where: { name: rule.eventName, ts: { gte: windowStart } },
        _count: { route: true },
      });
      for (const row of grouped as Array<{ tenantId: string; route: string; _count: { route: number } }>) {
        const count = row._count.route;
        if (count < rule.threshold) continue;

        // Dedupe: una señal por kind+ruta+ventana.
        const existing = await this.prisma.frictionSignal.findFirst({
          where: { tenantId: row.tenantId, kind: rule.kind, route: row.route, createdAt: { gte: windowStart } },
          select: { id: true },
        });
        if (existing) continue;

        const severity = count >= rule.threshold * 4 ? "high" : count >= rule.threshold * 2 ? "medium" : "low";
        await this.prisma.frictionSignal.create({
          data: {
            tenantId: row.tenantId,
            kind: rule.kind,
            route: row.route,
            severity,
            evidenceJson: { eventName: rule.eventName, count, windowHours },
            windowStart,
            windowEnd,
          },
        });
        frictionCreated += 1;

        if (severity !== "low" && this.operationalSignals) {
          const result = await this.operationalSignals.upsertSignal({
            tenantId: row.tenantId,
            type: "EXPERIENCE_FRICTION",
            severity: severity === "high" ? "high" : "medium",
            title: `Fricción de usuario en ${row.route}`,
            message: `${count} eventos ${rule.eventName} en ${windowHours}h en la ruta ${row.route}.`,
            recommendedAction: "Revisar la vista afectada: errores repetidos o UI que no responde a la intención del usuario.",
            sourceAgent: "product-intelligence",
            entityType: "route",
            entityId: row.route,
            metadataJson: { kind: rule.kind, count, windowHours },
          });
          if (result.created) operationalCreated += 1;
        }
      }
    }

    // PI-08 — anomalía de funnel: llegadas al wizard sin ninguna publicación.
    const funnelGroups = await this.prisma.productEvent.groupBy({
      by: ["tenantId", "name"],
      where: { name: { in: ["wizard.prefill_arrived", "wizard.published"] }, ts: { gte: windowStart } },
      _count: { name: true },
    });
    const byTenant = new Map<string, { arrived: number; published: number }>();
    for (const row of funnelGroups as Array<{ tenantId: string; name: string; _count: { name: number } }>) {
      const entry = byTenant.get(row.tenantId) ?? { arrived: 0, published: 0 };
      if (row.name === "wizard.prefill_arrived") entry.arrived = row._count.name;
      else entry.published = row._count.name;
      byTenant.set(row.tenantId, entry);
    }
    for (const [tenantId, { arrived, published }] of byTenant) {
      if (arrived >= 5 && published === 0 && this.operationalSignals) {
        const result = await this.operationalSignals.upsertSignal({
          tenantId,
          type: "EXPERIENCE_FRICTION",
          severity: "high",
          title: "Funnel del wizard sin conversiones",
          message: `${arrived} llegadas al wizard con prefill y 0 publicaciones en ${windowHours}h.`,
          recommendedAction: "Revisar el wizard de publicación: los usuarios llegan con contexto pero ninguno completa.",
          sourceAgent: "product-intelligence",
          entityType: "funnel",
          entityId: "wizard",
          metadataJson: { arrived, published, windowHours },
        });
        if (result.created) operationalCreated += 1;
      }
    }

    this.logger.log(
      `[PI engines] window=${windowHours}h friction=${frictionCreated} operational=${operationalCreated}`,
    );
    return { windowHours, frictionSignalsCreated: frictionCreated, operationalSignalsCreated: operationalCreated };
  }

  /** PI-03.2 — retención: 30d identificable, 90d señales agregadas. */
  async runRetention(): Promise<RetentionResult> {
    const identifiableCutoff = new Date(Date.now() - IDENTIFIABLE_RETENTION_DAYS * 86_400_000);
    const signalCutoff = new Date(Date.now() - SIGNAL_RETENTION_DAYS * 86_400_000);

    const events = await this.prisma.productEvent.deleteMany({
      where: { createdAt: { lt: identifiableCutoff } },
    });
    // Sesiones inactivas: sus eventos restantes caen por onDelete Cascade.
    const sessions = await this.prisma.productSession.deleteMany({
      where: { lastSeen: { lt: identifiableCutoff } },
    });
    const signals = await this.prisma.frictionSignal.deleteMany({
      where: { createdAt: { lt: signalCutoff } },
    });
    const batches = await this.prisma.productIngestBatch.deleteMany({
      where: { receivedAt: { lt: identifiableCutoff } },
    });

    return {
      productEventsDeleted: events.count,
      productSessionsDeleted: sessions.count,
      frictionSignalsDeleted: signals.count,
      ingestBatchesDeleted: batches.count,
    };
  }
}
