import { Injectable } from "@nestjs/common";
import type { Prisma, ProductConsentClass } from "@prisma/client";
import type { ProductEventBatch } from "@semse/schemas";
import { redactValue } from "@semse/product-events";
import { PrismaService } from "../../infrastructure/prisma/prisma.service.js";

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
  constructor(private readonly prisma: PrismaService) {}

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
