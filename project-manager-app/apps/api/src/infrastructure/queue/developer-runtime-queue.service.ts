import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from "@nestjs/common";
import { Queue } from "bullmq";
import { Redis } from "ioredis";
import { SEMSE_DEVELOPER_RUNTIME_QUEUE } from "@semse/shared";

export type DeveloperRuntimeQueueInput = {
  sessionId: string;
  missionId: string;
  tenantId: string;
  orgId: string;
  userId: string;
  repoId: string;
  cwd?: string;
};

function toQueueJobId(input: DeveloperRuntimeQueueInput): string {
  return `${input.tenantId}__${input.sessionId}`.replace(/[^a-zA-Z0-9_-]/g, "_");
}

@Injectable()
export class DeveloperRuntimeQueueService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(DeveloperRuntimeQueueService.name);
  private connection: Redis | null = null;
  private queue: Queue | null = null;
  private readonly redisUrl = process.env.REDIS_URL ?? "redis://127.0.0.1:6379";
  private connectPromise: Promise<void> | null = null;

  async onModuleInit(): Promise<void> {
    // Non-blocking — Redis connect must not delay NestJS startup
    this.ensureQueueConnected().catch(() => undefined);
  }

  async enqueueExecution(input: DeveloperRuntimeQueueInput): Promise<void> {
    await this.ensureQueueConnected();

    if (!this.queue) {
      this.logger.warn(`Queue unavailable; developer runtime session '${input.sessionId}' left in executing state`);
      return;
    }

    await this.queue.add("developer-runtime.execute", input, {
      jobId: toQueueJobId(input),
    });
  }

  async onModuleDestroy(): Promise<void> {
    this.connectPromise = null;
    if (this.queue) {
      await this.queue.close();
    }
    if (this.connection) {
      await this.connection.quit();
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
      this.logger.warn(`Redis connection error: ${error.message}`);
    });

    try {
      await connection.connect();
      await connection.ping();

      this.connection = connection;
      this.queue = new Queue(SEMSE_DEVELOPER_RUNTIME_QUEUE, {
        connection,
        defaultJobOptions: {
          removeOnComplete: 500,
          removeOnFail: 1000,
        },
      });
      this.logger.log(`Developer runtime queue connected at ${this.redisUrl}`);
    } catch (error) {
      this.logger.warn(
        `Developer runtime queue disabled for this process: ${error instanceof Error ? error.message : String(error)}`,
      );
      connection.disconnect();
      this.connection = null;
      this.queue = null;
    }
  }
}
