import {
  Injectable,
  Logger,
  OnApplicationBootstrap,
  OnModuleDestroy,
} from "@nestjs/common";
import { randomUUID } from "node:crypto";
import { hostname } from "node:os";
import { DomainEventQueueService } from "../../infrastructure/queue/domain-event-queue.service.js";
import { MetricsService } from "../../infrastructure/observability/metrics.service.js";
import { OutboxRepository } from "./outbox.repository.js";

type DispatchEnvironment = Record<string, string | undefined>;

export function isOutboxDispatchEnabled(
  environment: DispatchEnvironment = process.env,
): boolean {
  return environment.SEMSE_EVENT_OUTBOX_DISPATCH_ENABLED === "true";
}

export function redactOutboxError(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error);
  return message
    .replace(/\b(rediss?|https?):\/\/[^@/\s]+@/gi, "$1://***@")
    .replace(/\b(password|token|secret|api[_-]?key)=([^\s&]+)/gi, "$1=***")
    .slice(0, 500);
}

function environmentInteger(
  name: string,
  fallback: number,
  minimum: number,
  maximum: number,
): number {
  const value = Number(process.env[name] ?? fallback);
  return Number.isInteger(value) && value >= minimum && value <= maximum
    ? value
    : fallback;
}

@Injectable()
export class OutboxDispatcherService
  implements OnApplicationBootstrap, OnModuleDestroy
{
  private readonly logger = new Logger(OutboxDispatcherService.name);
  private readonly dispatcherId = `${hostname()}-${process.pid}-${randomUUID().slice(0, 8)}`;
  private readonly pollMs = environmentInteger(
    "SEMSE_EVENT_OUTBOX_POLL_MS",
    1_000,
    250,
    60_000,
  );
  private readonly batchSize = environmentInteger(
    "SEMSE_EVENT_OUTBOX_BATCH_SIZE",
    50,
    1,
    250,
  );
  private readonly leaseMs = environmentInteger(
    "SEMSE_EVENT_OUTBOX_LEASE_MS",
    30_000,
    1_000,
    300_000,
  );
  private interval: NodeJS.Timeout | null = null;
  private running = false;

  constructor(
    private readonly outboxRepository: OutboxRepository,
    private readonly queueService: DomainEventQueueService,
    private readonly metricsService: MetricsService,
  ) {}

  onApplicationBootstrap(): void {
    if (!isOutboxDispatchEnabled()) {
      this.logger.log("Domain event outbox dispatcher is disabled by kill switch");
      return;
    }

    this.logger.log(
      `Domain event outbox dispatcher enabled id=${this.dispatcherId} pollMs=${this.pollMs}`,
    );
    this.interval = setInterval(() => {
      void this.runScheduledBatch();
    }, this.pollMs);
    this.interval.unref();
    void this.runScheduledBatch();
  }

  onModuleDestroy(): void {
    if (this.interval) {
      clearInterval(this.interval);
      this.interval = null;
    }
  }

  async dispatchBatch(): Promise<{
    claimed: number;
    published: number;
    failed: number;
  }> {
    const claimed = await this.outboxRepository.claimBatch({
      dispatcherId: this.dispatcherId,
      batchSize: this.batchSize,
      leaseMs: this.leaseMs,
    });
    let published = 0;
    let failed = 0;

    for (const event of claimed) {
      try {
        await this.queueService.enqueueEvent({
          eventId: event.eventId,
          generation: event.replayCount,
        });
        const publishedAt = new Date();
        const acknowledged = await this.outboxRepository.markPublished({
          eventId: event.eventId,
          dispatcherId: this.dispatcherId,
          publishedAt,
        });
        if (!acknowledged) {
          failed += 1;
          this.logger.warn(
            `Outbox lease lost before ack eventId=${event.eventId} eventType=${event.eventType}`,
          );
          continue;
        }

        published += 1;
        this.metricsService.recordOutboxPublishLag(
          (publishedAt.getTime() - event.recordedAt.getTime()) / 1_000,
        );
      } catch (error) {
        failed += 1;
        const redactedError = redactOutboxError(error);
        const nacked = await this.outboxRepository.markFailed({
          eventId: event.eventId,
          dispatcherId: this.dispatcherId,
          attempts: event.attempts,
          maxAttempts: event.maxAttempts,
          error: redactedError,
        });
        this.logger.warn(
          `Outbox publish failed eventId=${event.eventId} eventType=${event.eventType} attempt=${event.attempts} status=${nacked?.status ?? "LEASE_LOST"} error=${redactedError}`,
        );
      }
    }

    await this.refreshMetrics();
    return { claimed: claimed.length, published, failed };
  }

  private async runScheduledBatch(): Promise<void> {
    if (this.running) {
      return;
    }
    this.running = true;
    try {
      await this.dispatchBatch();
    } catch (error) {
      this.logger.error(
        `Outbox dispatcher batch failed: ${redactOutboxError(error)}`,
      );
    } finally {
      this.running = false;
    }
  }

  private async refreshMetrics(): Promise<void> {
    const snapshot = await this.outboxRepository.getMetricsSnapshot();
    this.metricsService.recordOutboxSnapshot(snapshot);
  }
}
