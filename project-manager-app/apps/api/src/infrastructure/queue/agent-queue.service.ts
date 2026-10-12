import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from "@nestjs/common";
import { Queue, type QueueOptions } from "bullmq";
import { Redis } from "ioredis";
import { SEMSE_AGENT_RUN_QUEUE } from "@semse/shared";
import { buildQueueTracePayload } from "../observability/request-context.store.js";

type QueueRunInput = {
  runId: string;
  tenantId: string;
  agentType: string;
  correlationId: string;
  /** Overrides AGENT_PRIORITY for this one job — e.g. a Forge task's own declared priority. */
  priority?: number;
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

export type EnqueueRunResult = {
  enqueued: boolean;
  reason?: "JOB_ACTIVE" | "QUEUE_UNAVAILABLE" | "QUEUE_ERROR";
};

type RetryJobHandle = { getState(): Promise<string>; remove(): Promise<void> };

/**
 * Decides what to do with an existing job that shares the retry's jobId.
 * Only finished (failed/completed) jobs are removed; pending work is kept and
 * an active job is never touched.
 */
export async function prepareRetryJob(
  queue: { getJob(id: string): Promise<RetryJobHandle | undefined | null> },
  jobId: string
): Promise<{ decision: "add" | "keep" | "active" | "error"; previousState?: string }> {
  const job = await queue.getJob(jobId);
  if (!job) return { decision: "add" };
  const previousState = await job.getState();
  if (["waiting", "delayed", "prioritized", "waiting-children"].includes(previousState)) {
    return { decision: "keep", previousState };
  }
  if (previousState === "active") return { decision: "active", previousState };
  if (previousState === "failed" || previousState === "completed") {
    try {
      await job.remove();
    } catch {
      // Removed concurrently, or locked: only proceed if the id is really free now.
      const again = await queue.getJob(jobId);
      if (again) return { decision: "error", previousState };
    }
    return { decision: "add", previousState };
  }
  // "unknown" or an unrecognised state: do not guess.
  return { decision: "error", previousState };
}

@Injectable()
export class AgentQueueService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(AgentQueueService.name);
  private connection: Redis | null = null;
  private queue: Queue | null = null;
  private readonly redisUrl = process.env.REDIS_URL ?? "redis://127.0.0.1:6379";
  private connectPromise: Promise<void> | null = null;

  async onModuleInit(): Promise<void> {
    // Non-blocking — Redis connect must not delay NestJS startup
    this.ensureQueueConnected().catch(() => undefined);
  }

  /**
   * `create` (default) keeps the historical idempotent `add` by jobId.
   * `retry` is used by RETRY/REQUEUE: BullMQ silently ignores `add` while a
   * finished job with the same id is retained (removeOnFail/removeOnComplete),
   * which left re-queued runs orphaned in `QUEUED`. See
   * docs/specs/agents/agent-queue-retry-idempotency.spec.md.
   */
  async enqueueRun(
    input: QueueRunInput,
    options: { mode?: "create" | "retry" } = {}
  ): Promise<EnqueueRunResult> {
    const mode = options.mode ?? "create";
    try {
      await this.ensureQueueConnected();
    } catch (error) {
      if (mode === "create") throw error;
      return { enqueued: false, reason: "QUEUE_UNAVAILABLE" };
    }

    if (!this.queue) {
      this.logger.warn(`Queue unavailable; agent run '${input.runId}' left queued in persistence only`);
      return { enqueued: false, reason: "QUEUE_UNAVAILABLE" };
    }

    const jobId = toQueueJobId(input);
    try {
      if (mode === "retry") {
        const action = await prepareRetryJob(this.queue, jobId);
        this.logger.log(`Agent run '${input.runId}' retry: previous job state '${action.previousState ?? "none"}' -> ${action.decision}`);
        if (action.decision === "keep") return { enqueued: true };
        if (action.decision === "active") return { enqueued: false, reason: "JOB_ACTIVE" };
        if (action.decision === "error") return { enqueued: false, reason: "QUEUE_ERROR" };
      }

      const { priority, ...jobData } = input;
      await this.queue.add(
        input.agentType,
        { ...jobData, ...buildQueueTracePayload() },
        {
          jobId,
          priority: priority ?? resolveJobPriority(input.agentType)
        }
      );
      return { enqueued: true };
    } catch (error) {
      if (mode === "create") throw error;
      this.logger.warn(`Agent run '${input.runId}' retry enqueue failed: ${error instanceof Error ? error.message : String(error)}`);
      return { enqueued: false, reason: "QUEUE_ERROR" };
    }
  }

  async getMetrics(): Promise<{
    connected: boolean;
    waiting: number;
    active: number;
    completed: number;
    failed: number;
    delayed: number;
    queueName: string;
  }> {
    await this.ensureQueueConnected();
    if (!this.queue) {
      return { connected: false, waiting: 0, active: 0, completed: 0, failed: 0, delayed: 0, queueName: SEMSE_AGENT_RUN_QUEUE };
    }
    const [waiting, active, completed, failed, delayed] = await Promise.all([
      this.queue.getWaitingCount().catch(() => 0),
      this.queue.getActiveCount().catch(() => 0),
      this.queue.getCompletedCount().catch(() => 0),
      this.queue.getFailedCount().catch(() => 0),
      this.queue.getDelayedCount().catch(() => 0),
    ]);
    return { connected: true, waiting, active, completed, failed, delayed, queueName: SEMSE_AGENT_RUN_QUEUE };
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
        connection: connection as QueueOptions["connection"],
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
