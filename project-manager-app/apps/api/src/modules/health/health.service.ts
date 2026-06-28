import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from "@nestjs/common";
import { Redis } from "ioredis";

export type SystemHealthStatus = {
  api: "ok" | "degraded";
  worker: "ok" | "degraded";
  redis: "ok" | "degraded";
  checkedAt: string;
};

const WORKER_LOCK_PREFIX = "semse:worker-lock:";
const CHECK_INTERVAL_MS = 15_000;

@Injectable()
export class HealthService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(HealthService.name);
  private readonly redisUrl = process.env.REDIS_URL ?? "redis://127.0.0.1:6379";
  private redis: Redis | null = null;
  private timer: ReturnType<typeof setInterval> | null = null;
  private cached: SystemHealthStatus = {
    api: "ok",
    worker: "degraded",
    redis: "degraded",
    checkedAt: new Date().toISOString(),
  };

  async onModuleInit() {
    // Non-blocking — health checks run in background; don't delay Fastify startup
    void this.ensureRedis()
      .then(() => this.refresh())
      .catch(() => undefined);
    this.timer = setInterval(() => { void this.refresh(); }, CHECK_INTERVAL_MS);
  }

  async onModuleDestroy() {
    if (this.timer) clearInterval(this.timer);
    if (this.redis) { this.redis.disconnect(); this.redis = null; }
  }

  getHealth(): SystemHealthStatus {
    return this.cached;
  }

  async refreshNow(): Promise<SystemHealthStatus> {
    await this.refresh();
    return this.cached;
  }

  private async ensureRedis(): Promise<void> {
    if (this.redis) return;

    const client = new Redis(this.redisUrl, {
      maxRetriesPerRequest: 1,
      lazyConnect: true,
      enableOfflineQueue: false,
      retryStrategy: () => null,
      connectTimeout: 2_000,
    });
    client.on("error", () => { /* suppress */ });

    try {
      await client.connect();
      await client.ping();
      this.redis = client;
      this.logger.log("HealthService: Redis connected");
    } catch {
      client.disconnect();
      this.logger.warn("HealthService: Redis unavailable");
    }
  }

  private async refresh(): Promise<void> {
    if (!this.redis) await this.ensureRedis();
    const redisOk = await this.pingRedis();
    if (!redisOk) { this.redis = null; }
    const workerOk = redisOk ? await this.checkWorkerLock() : false;
    this.cached = {
      api: "ok",
      redis: redisOk ? "ok" : "degraded",
      worker: workerOk ? "ok" : "degraded",
      checkedAt: new Date().toISOString(),
    };
  }

  private async pingRedis(): Promise<boolean> {
    if (!this.redis) return false;
    try {
      const res = await this.redis.ping();
      return res === "PONG";
    } catch {
      return false;
    }
  }

  private async checkWorkerLock(): Promise<boolean> {
    if (!this.redis) return false;
    try {
      const keys = await this.redis.keys(`${WORKER_LOCK_PREFIX}*`);
      return keys.length > 0;
    } catch {
      return false;
    }
  }
}
