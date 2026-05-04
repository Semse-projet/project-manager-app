import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from "@nestjs/common";
import { Queue } from "bullmq";
import { Redis } from "ioredis";
import { SEMSE_AGENT_RUN_QUEUE } from "@semse/shared";

type QueueRunInput = {
  runId: string;
  tenantId: string;
  agentType: string;
  correlationId: string;
};

// Lower number = higher priority in BullMQ
const AGENT_PRIORITY: Record<string, number> = {
  dispute:        1,
  risk:           2,
  "evidence-coach": 3,
  "trust-match":  4,
  pricing:        5,
  "job-planner":  6
};

function resolveJobPriority(agentType: string): number {
  return AGENT_PRIORITY[agentType] ?? 10;
}

function toQueueJobId(input: QueueRunInput): string {
  return `${input.tenantId}__${input.runId}`.replace(/[^a-zA-Z0-9_-]/g, "_");
}

@Injectable()
export class AgentQueueService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(AgentQueueService.name);
  private connection: Redis | null = null;
  private queue: Queue | null = null;
  private readonly redisUrl = process.env.REDIS_URL ?? "redis://127.0.0.1:6379";
  private connectPromise: Promise<void> | null = null;

  async onModuleInit(): Promise<void> {
    await this.ensureQueueConnected();
  }

  async enqueueRun(input: QueueRunInput): Promise<void> {
    await this.ensureQueueConnected();

    if (!this.queue) {
      this.logger.warn(`Queue unavailable; agent run '${input.runId}' left queued in persistence only`);
      return;
    }

    await this.queue.add(
      input.agentType,
      input,
      {
        jobId: toQueueJobId(input),
        priority: resolveJobPriority(input.agentType)
      }
    );
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
      retryStrategy: () => null
    });
    connection.on("error", (error) => {
      this.logger.warn(`Redis connection error: ${error.message}`);
    });

    try {
      await connection.connect();
      await connection.ping();

      this.connection = connection;
      this.queue = new Queue(SEMSE_AGENT_RUN_QUEUE, {
        connection,
        defaultJobOptions: {
          removeOnComplete: 500,
          removeOnFail: 1000
        }
      });
      this.logger.log(`Redis queue connected at ${this.redisUrl}`);
    } catch (error) {
      this.logger.warn(
        `Redis queue disabled for this process: ${error instanceof Error ? error.message : String(error)}`
      );
      connection.disconnect();
      this.connection = null;
      this.queue = null;
    }
  }
}
