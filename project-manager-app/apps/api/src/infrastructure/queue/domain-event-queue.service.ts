import { Injectable, Logger, OnModuleDestroy } from "@nestjs/common";
import { Queue, type QueueOptions } from "bullmq";
import { Redis } from "ioredis";
import { SEMSE_DOMAIN_EVENT_QUEUE } from "@semse/shared";

export type DomainEventQueueInput = {
  eventId: string;
};

export const DOMAIN_EVENT_JOB_OPTIONS = {
  attempts: 5,
  backoff: {
    type: "exponential",
    delay: 1_000,
    jitter: 0.5,
  },
  removeOnComplete: {
    age: 3_600,
    count: 1_000,
  },
  removeOnFail: {
    age: 7 * 24 * 60 * 60,
    count: 5_000,
  },
} as const;

export function toDomainEventJobId(eventId: string): string {
  return `event-${eventId}`.replace(/:/g, "_");
}

export class DomainEventQueueUnavailableError extends Error {
  constructor() {
    super("Domain event queue is unavailable");
    this.name = "DomainEventQueueUnavailableError";
  }
}

function redactRedisMessage(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error);
  return message
    .replace(/\b(rediss?):\/\/[^@/\s]+@/gi, "$1://***@")
    .replace(/\b(password|token|secret)=([^\s&]+)/gi, "$1=***")
    .slice(0, 500);
}

@Injectable()
export class DomainEventQueueService implements OnModuleDestroy {
  private readonly logger = new Logger(DomainEventQueueService.name);
  private connection: Redis | null = null;
  private queue: Queue | null = null;
  private readonly redisUrl = process.env.REDIS_URL ?? "redis://127.0.0.1:6379";
  private connectPromise: Promise<void> | null = null;

  async enqueueEvent(input: DomainEventQueueInput): Promise<void> {
    await this.ensureQueueConnected();

    if (!this.queue) {
      throw new DomainEventQueueUnavailableError();
    }

    await this.queue.add(
      "domain-event.process",
      { eventId: input.eventId },
      {
        jobId: toDomainEventJobId(input.eventId),
        ...DOMAIN_EVENT_JOB_OPTIONS,
      },
    );
  }

  async onModuleDestroy(): Promise<void> {
    this.connectPromise = null;
    const queue = this.queue;
    const connection = this.connection;
    this.queue = null;
    this.connection = null;

    if (queue) {
      await queue.close();
    }
    if (connection && connection.status !== "end") {
      await connection.quit();
    }
  }

  private async ensureQueueConnected(): Promise<void> {
    if (this.queue) {
      return;
    }

    if (!this.connectPromise) {
      this.connectPromise = this.connectQueue().finally(() => {
        this.connectPromise = null;
      });
    }

    await this.connectPromise;
  }

  private async connectQueue(): Promise<void> {
    const connection = new Redis(this.redisUrl, {
      maxRetriesPerRequest: 1,
      lazyConnect: true,
      enableOfflineQueue: false,
      retryStrategy: () => null,
    });

    connection.on("error", (error) => {
      this.logger.warn(
        `Domain event Redis connection error: ${redactRedisMessage(error)}`,
      );
    });
    connection.on("end", () => {
      if (this.connection === connection) {
        this.connection = null;
        this.queue = null;
      }
    });

    try {
      await connection.connect();
      await connection.ping();

      this.connection = connection;
      this.queue = new Queue(SEMSE_DOMAIN_EVENT_QUEUE, {
        connection: connection as QueueOptions["connection"],
      });
      this.logger.log(`Domain event queue connected at ${this.redactedRedisUrl()}`);
    } catch (error) {
      this.logger.warn(
        `Domain event queue unavailable: ${redactRedisMessage(error)}`,
      );
      connection.disconnect();
      this.connection = null;
      this.queue = null;
    }
  }

  private redactedRedisUrl(): string {
    return this.redisUrl.replace(
      /^(rediss?:\/\/)[^@/\s]+@/i,
      "$1***@",
    );
  }
}
