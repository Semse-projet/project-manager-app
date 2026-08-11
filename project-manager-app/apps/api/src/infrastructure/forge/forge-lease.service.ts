import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from "@nestjs/common";
import { Redis } from "ioredis";

/**
 * Real resource leases for Forge (SEMSE_FORGE_AGENT_HARNESS.spec.md §9) —
 * "solo un task de escritura puede tener lease activo por recurso." Before
 * this, the 4 providers only had string-pattern lists used to *request
 * approval*; nothing actually coordinated two concurrent tasks touching the
 * same sensitive resource (see docs/reportes/forge_agent_harness_auditoria_2026-08-10.md).
 *
 * Deliberately Redis-backed, not a new Prisma table: each API request builds
 * a fresh ForgeHarness that only loads the one run it's operating on
 * (forge.service.ts's `load()`), so there's no in-memory place a lease could
 * live across requests/runs. A lease here is scoped to the duration of one
 * applyTaskResult() call — an "exclusive processing" lock preventing two
 * concurrent requests from racing on the same category, not a long-held
 * lease across a task's full real-world execution (which doesn't exist yet:
 * every Forge provider is dry-run-only). The short TTL is a safety net for a
 * process crashing mid-request, not a business rule.
 */
@Injectable()
export class ForgeLeaseService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(ForgeLeaseService.name);
  private connection: Redis | null = null;
  private readonly redisUrl = process.env.REDIS_URL ?? "redis://127.0.0.1:6379";
  private connectPromise: Promise<void> | null = null;
  private static readonly DEFAULT_TTL_SECONDS = 60;
  private static readonly RELEASE_IF_OWNER_SCRIPT = `
    if redis.call("get", KEYS[1]) == ARGV[1] then
      return redis.call("del", KEYS[1])
    else
      return 0
    end
  `;

  async onModuleInit(): Promise<void> {
    // Non-blocking — Redis connect must not delay NestJS startup.
    this.ensureConnected().catch(() => undefined);
  }

  async onModuleDestroy(): Promise<void> {
    this.connectPromise = null;
    if (this.connection) {
      await this.connection.quit();
    }
  }

  /**
   * Attempts to atomically acquire an exclusive lease on `category` for
   * `tenantId`. Fails CLOSED if Redis is unreachable — deliberately the
   * opposite default of AgentQueueService (which degrades gracefully when
   * Redis is down). Losing an async agent-run enqueue is low-stakes; silently
   * losing the only coordination mechanism protecting schema.prisma/auth/
   * payments writes is exactly the vulnerability this phase exists to close.
   * `reason` lets the caller give an honest deny message instead of implying
   * a specific other run holds it when the real cause is "can't tell."
   */
  async acquire(input: {
    category: string;
    tenantId: string;
    runId: string;
    taskId: string;
    ttlSeconds?: number;
  }): Promise<{
    acquired: boolean;
    heldBy?: { runId: string; taskId: string };
    reason?: "held_by_other" | "lease_coordination_unavailable";
  }> {
    await this.ensureConnected();
    if (!this.connection) {
      this.logger.warn(`Redis unavailable; denying lease for '${input.category}' (fail-closed)`);
      return { acquired: false, reason: "lease_coordination_unavailable" };
    }

    const key = this.leaseKey(input.tenantId, input.category);
    const value = JSON.stringify({ runId: input.runId, taskId: input.taskId });
    const ttl = input.ttlSeconds ?? ForgeLeaseService.DEFAULT_TTL_SECONDS;

    // Every Redis command below is wrapped so a mid-request connection drop
    // denies (fail-closed, consistent with the unreachable-at-start case
    // above) instead of throwing — an uncaught rejection here would surface
    // as a 500 to the caller instead of the documented deny, and would skip
    // releasing whatever leases this same request already acquired.
    try {
      const result = await this.connection.set(key, value, "EX", ttl, "NX");
      if (result === "OK") {
        return { acquired: true };
      }

      const existing = await this.connection.get(key);
      if (!existing) {
        // Lease expired between the failed SET and this GET. Retry the SET
        // once instead of assuming free-and-unclaimed: without this, no key
        // is ever written, so a concurrent acquirer hitting the same gap
        // would also see "free" and both callers would believe they hold
        // the lease.
        const retry = await this.connection.set(key, value, "EX", ttl, "NX");
        if (retry === "OK") {
          return { acquired: true };
        }
        return { acquired: false, reason: "held_by_other" };
      }
      try {
        return { acquired: false, heldBy: JSON.parse(existing), reason: "held_by_other" };
      } catch {
        return { acquired: false, reason: "held_by_other" };
      }
    } catch (error) {
      this.logger.warn(
        `Redis error while acquiring lease for '${input.category}' (fail-closed): ${error instanceof Error ? error.message : String(error)}`
      );
      this.discardConnection();
      return { acquired: false, reason: "lease_coordination_unavailable" };
    }
  }

  /**
   * Releases a lease only if it's still held by the exact runId/taskId that
   * acquired it — as a single atomic Lua script, not a GET-then-DEL from
   * Node. A GET-then-DEL has a real race: if the TTL expires between the two
   * (or another writer's del races in), a different run's freshly-acquired
   * lease for the same key would get deleted, breaking the mutual exclusion
   * this whole mechanism exists to provide. The compare is on the exact JSON
   * string acquire() wrote, so no parsing is needed on either side.
   */
  async release(input: { category: string; tenantId: string; runId: string; taskId: string }): Promise<void> {
    if (!this.connection) return;

    const key = this.leaseKey(input.tenantId, input.category);
    const value = JSON.stringify({ runId: input.runId, taskId: input.taskId });
    try {
      await this.connection.eval(ForgeLeaseService.RELEASE_IF_OWNER_SCRIPT, 1, key, value);
    } catch (error) {
      this.logger.warn(
        `Redis error while releasing lease for '${input.category}': ${error instanceof Error ? error.message : String(error)}`
      );
      this.discardConnection();
    }
  }

  private leaseKey(tenantId: string, category: string): string {
    return `forge:lease:${tenantId}:${category}`;
  }

  /**
   * Drops the cached connection so the next call reconnects from scratch.
   * Necessary because `retryStrategy: () => null` (below) means ioredis
   * itself never retries a dead connection — without this, one mid-request
   * failure would leave the service permanently unusable until process
   * restart instead of degrading to per-call fail-closed denials.
   */
  private discardConnection(): void {
    const dead = this.connection;
    this.connection = null;
    dead?.disconnect();
  }

  private async ensureConnected(): Promise<void> {
    if (this.connection) return;
    if (!this.connectPromise) {
      this.connectPromise = this.connect().finally(() => {
        this.connectPromise = null;
      });
    }
    await this.connectPromise;
  }

  private async connect(): Promise<void> {
    const connection = new Redis(this.redisUrl, {
      maxRetriesPerRequest: 1,
      lazyConnect: true,
      enableOfflineQueue: false,
      retryStrategy: () => null
    });
    connection.on("error", (error) => {
      this.logger.warn(`Redis connection error: ${error.message}`);
    });
    // With retryStrategy: () => null, ioredis gives up reconnecting on its
    // own and the connection just goes 'end' — without discarding it here,
    // ensureConnected() would keep treating a dead `this.connection` as
    // live forever (it only checks for null) instead of reconnecting.
    connection.on("end", () => {
      if (this.connection === connection) {
        this.connection = null;
      }
    });

    try {
      await connection.connect();
      await connection.ping();
      this.connection = connection;
      this.logger.log(`Forge lease service connected to Redis at ${this.redisUrl}`);
    } catch (error) {
      this.logger.warn(
        `Forge lease service Redis disabled: ${error instanceof Error ? error.message : String(error)}`
      );
      connection.disconnect();
      this.connection = null;
    }
  }
}
