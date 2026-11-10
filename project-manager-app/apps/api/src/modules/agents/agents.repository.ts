import { BadRequestException, ConflictException, Injectable, Logger, NotFoundException } from "@nestjs/common";
import prismaClientPackage from "@prisma/client";
import type { Prisma as PrismaTypes } from "@prisma/client";
import { type AgentRunRecord } from "../../common/domain-store.js";
import { ActorContextService } from "../../infrastructure/persistence/actor-context.service.js";
import { PrismaService } from "../../infrastructure/prisma/prisma.service.js";
import { createAgentRunFinalizationEvent, isAgentRunFinalizationOutboxEnabled } from "./agent-run-finalization.policy.js";

const { Prisma } = prismaClientPackage as typeof import("@prisma/client");

// Replay status is local, non-serializable metadata; do not expose it through
// HTTP responses or persist it with an AgentRun row.
const replayedAgentRuns = new WeakSet<object>();
export function isAgentRunReplay(run: AgentRunRecord): boolean {
  return replayedAgentRuns.has(run);
}

type StoredAgentRun = {
  id: string;
  tenantId: string;
  agentType: string;
  triggerType: string;
  inputJson: unknown;
  status: string;
  correlationId: string;
  workerId: string | null;
  attempts: number;
  maxAttempts: number;
  deadLettered: boolean;
  outputJson: unknown;
  error: string | null;
  startedAt: Date | null;
  heartbeatAt: Date | null;
  endedAt: Date | null;
  durationMs: number | null;
  toolCallCount: number;
  createdAt: Date;
  updatedAt: Date;
};

type AgentRunTx = PrismaTypes.TransactionClient & Pick<PrismaService, "agentRun">;

@Injectable()
export class AgentsRepository {
  private readonly logger = new Logger(AgentsRepository.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly actorContextService: ActorContextService
  ) {}

  async list(input: { tenantId: string; orgId: string; userId: string }): Promise<AgentRunRecord[]> {
    await this.actorContextService.ensureActorContext(input);

    const runs = (await this.prisma.agentRun.findMany({
      where: {
        tenantId: input.tenantId
      },
      orderBy: { createdAt: "desc" }
    })) as StoredAgentRun[];

    return runs.map((run) => this.toRecord(run));
  }

  async findById(input: { tenantId: string; orgId: string; userId: string; runId: string }): Promise<AgentRunRecord> {
    await this.actorContextService.ensureActorContext(input);

    const run = (await this.prisma.agentRun.findFirst({
      where: {
        id: input.runId,
        tenantId: input.tenantId
      }
    })) as StoredAgentRun | null;

    if (!run) {
      throw new NotFoundException(`Agent run '${input.runId}' not found`);
    }

    return this.toRecord(run);
  }

  async create(input: {
    tenantId: string;
    orgId: string;
    userId: string;
    agentType: AgentRunRecord["agentType"];
    triggerType: AgentRunRecord["triggerType"];
    correlationId: string;
    maxAttempts?: number;
    input?: Record<string, unknown>;
    inputSummary?: string;
  }): Promise<AgentRunRecord> {
    await this.actorContextService.ensureActorContext(input);

    const maxAttempts = input.maxAttempts ?? 3;
    if (!Number.isInteger(maxAttempts) || maxAttempts <= 0) {
      throw new BadRequestException("maxAttempts must be a positive integer");
    }

    const run = (await this.prisma.agentRun.create({
      data: {
        tenantId: input.tenantId,
        agentType: input.agentType,
        triggerType: input.triggerType,
        inputJson: (input.input as PrismaTypes.InputJsonValue | undefined) ?? {},
        inputSummary: input.inputSummary,
        correlationId: input.correlationId,
        maxAttempts
      }
    })) as StoredAgentRun;

    return this.toRecord(run);
  }

  /**
   * Run de OBSERVABILIDAD (D5): deja constancia de una solicitud que NO debe ejecutar el worker. Nace ya en un estado
   * terminal (`COMPLETED`, sin intentos): `claimNext` solo toma `QUEUED` y `reclaimStale` solo reencola `RUNNING`, así
   * que ni se procesa ni se reencola. Lo que ocurrió de verdad queda en `inputSummary`/`inputJson` y en la auditoría
   * de cada tool call; el estado solo significa "no ejecutable".
   */
  async recordObservedRun(input: {
    tenantId: string;
    orgId: string;
    userId: string;
    agentType: AgentRunRecord["agentType"];
    correlationId: string;
    input: Record<string, unknown>;
    inputSummary?: string;
  }): Promise<AgentRunRecord> {
    await this.actorContextService.ensureActorContext(input);

    const now = new Date();
    const run = (await this.prisma.agentRun.create({
      data: {
        tenantId: input.tenantId,
        agentType: input.agentType,
        triggerType: "manual",
        inputJson: input.input as PrismaTypes.InputJsonValue,
        inputSummary: input.inputSummary,
        correlationId: input.correlationId,
        status: "COMPLETED",
        attempts: 0,
        maxAttempts: 1,
        startedAt: now,
        endedAt: now,
        durationMs: 0,
      },
    })) as StoredAgentRun;

    return this.toRecord(run);
  }

  async claimNext(input: {
    tenantId: string;
    orgId: string;
    userId: string;
    workerId: string;
    agentType?: AgentRunRecord["agentType"];
    runId?: string;
  }): Promise<AgentRunRecord | null> {
    await this.actorContextService.ensureActorContext(input);

    return this.prisma.$transaction(async (tx) => {
      const db = tx as AgentRunTx;
      const next = (await db.agentRun.findFirst({
        where: {
          tenantId: input.tenantId,
          status: "QUEUED",
          deadLettered: false,
          ...(input.runId ? { id: input.runId } : {}),
          ...(input.agentType ? { agentType: input.agentType } : {})
        },
        orderBy: { createdAt: "asc" }
      })) as StoredAgentRun | null;

      if (!next || next.attempts >= next.maxAttempts) {
        return null;
      }

      const now = new Date();
      // A transaction alone does not make findFirst + unconditional update
      // a single claim: two workers can select the same QUEUED run.
      // Compare-and-set the lifecycle and attempt budget atomically.
      const claim = await db.agentRun.updateMany({
        where: {
          id: next.id,
          tenantId: input.tenantId,
          status: "QUEUED",
          deadLettered: false,
          attempts: { lt: next.maxAttempts },
          ...(input.agentType ? { agentType: input.agentType } : {})
        },
        data: {
          status: "RUNNING",
          workerId: input.workerId,
          attempts: { increment: 1 },
          startedAt: now,
          heartbeatAt: now,
          // A new claim must not inherit the previous generation's terminal
          // error or completion timestamps after stale recovery.
          error: null,
          endedAt: null,
          durationMs: null
        }
      });
      if (claim.count !== 1) {
        // Another worker already claimed, cancelled or exhausted this run.
        return null;
      }

      const claimed = (await db.agentRun.findFirst({
        where: {
          id: next.id,
          tenantId: input.tenantId,
          status: "RUNNING",
          workerId: input.workerId
        }
      })) as StoredAgentRun | null;
      // A concurrent terminal transition after our claim must never be
      // represented as a fresh RUNNING claim.
      return claimed ? this.toRecord(claimed) : null;
    });
  }

  /**
   * Bounded, tenant-scoped projection used to reconcile QUEUED persistence
   * against BullMQ on every recovery sweep, including after a process crash
   * between a successful DB transaction and queue delivery.
   * Lexical cursor allows fair traversal without an unbounded response.
   */
  async listQueuedForDelivery(input: {
    tenantId: string; orgId: string; userId: string;
    afterRunId?: string; maxItems: number;
  }): Promise<AgentRunRecord[]> {
    await this.actorContextService.ensureActorContext(input);
    const rows = (await this.prisma.agentRun.findMany({
      where: {
        tenantId: input.tenantId,
        status: "QUEUED",
        deadLettered: false,
        ...(input.afterRunId ? { id: { gt: input.afterRunId } } : {}),
      },
      orderBy: { id: "asc" },
      take: Math.max(1, Math.min(20, input.maxItems)),
    })) as StoredAgentRun[];
    return rows.map((run) => this.toRecord(run));
  }

  async reclaimStale(input: {
    tenantId: string;
    orgId: string;
    userId: string;
    staleAfterMs: number;
    maxItems?: number;
  }): Promise<AgentRunRecord[]> {
    await this.actorContextService.ensureActorContext(input);

    const limit = input.maxItems ?? 50;
    const staleBefore = new Date(Date.now() - input.staleAfterMs);
    const staleSignalWhere: PrismaTypes.AgentRunWhereInput = {
      OR: [
        { heartbeatAt: { lte: staleBefore } },
        { heartbeatAt: null, startedAt: { lte: staleBefore } },
        { heartbeatAt: null, startedAt: null, updatedAt: { lte: staleBefore } }
      ]
    };

    return this.prisma.$transaction(async (tx) => {
      const db = tx as AgentRunTx;
      const candidates = (await db.agentRun.findMany({
        where: {
          tenantId: input.tenantId,
          status: "RUNNING",
          ...staleSignalWhere
        },
        orderBy: { updatedAt: "asc" },
        take: limit
      })) as StoredAgentRun[];
      const reclaimed: AgentRunRecord[] = [];

      for (const run of candidates) {
        const mutation = await db.agentRun.updateMany({
          where: {
            id: run.id,
            tenantId: input.tenantId,
            status: "RUNNING",
            ...staleSignalWhere
          },
          data:
            run.attempts >= run.maxAttempts
              ? {
                  status: "FAILED",
                  deadLettered: true,
                  error: "max attempts reached during stale reclaim",
                  workerId: null,
                  heartbeatAt: null,
                  endedAt: new Date()
                }
              : {
                  status: "QUEUED",
                  workerId: null,
                  error: "reclaimed due to stale heartbeat",
                  startedAt: null,
                  heartbeatAt: null,
                  endedAt: null
                }
        });

        if (mutation.count === 0) {
          continue;
        }

        const updated = (await db.agentRun.findFirst({
          where: {
            id: run.id,
            tenantId: input.tenantId
          }
        })) as StoredAgentRun | null;
        if (updated) {
          reclaimed.push(this.toRecord(updated));
        }
      }

      return reclaimed;
    });
  }

  async retry(input: { tenantId: string; orgId: string; userId: string; runId: string }): Promise<AgentRunRecord> {
    await this.actorContextService.ensureActorContext(input);
    const run = await this.requireRun(input);

    if (run.status === "RUNNING") {
      throw new BadRequestException("running run cannot be retried");
    }
    if (run.deadLettered || run.attempts >= run.maxAttempts) {
      throw new ConflictException("run reached max attempts and is dead-lettered");
    }

    // In durable mode, serialise with the effects consumer on AgentRun.
    // A retry before the old generation's receipt is COMMITTED would cause
    // the consumer to observe the wrong status and lose terminal effects.
    if (isAgentRunFinalizationOutboxEnabled()) {
      return this.prisma.$transaction(async tx => {
        await tx.$queryRaw(Prisma.sql`
          SELECT "id" FROM "AgentRun"
          WHERE "id"=${run.id} AND "tenantId"=${input.tenantId} FOR UPDATE
        `);
        const current = await tx.agentRun.findFirst({
          where: { id: run.id, tenantId: input.tenantId }
        });
        if (!current || current.status === "RUNNING") {
          throw new ConflictException("run changed during retry");
        }
        if (current.deadLettered || current.attempts >= current.maxAttempts) {
          throw new ConflictException("run reached max attempts");
        }
        const pending = await tx.domainOutboxEvent.findFirst({
          where: {
            tenantId: input.tenantId, entityType: "AgentRun", entityId: run.id,
            eventType: "agent.run.finalized.v1",
            consumptions: { none: {
              consumerName: "agent-run-effects.v1", status: "COMPLETED"
            } },
          },
          select: { eventId: true },
        });
        if (pending) throw new ConflictException("prior terminal effects not yet recovered");
        const updated = await tx.agentRun.updateMany({
          where: {
            id: run.id, tenantId: input.tenantId, status: current.status,
            attempts: current.attempts,
          },
          data: {
            status: "QUEUED", workerId: null, error: null,
            startedAt: null, endedAt: null, heartbeatAt: null,
          },
        });
        if (updated.count !== 1) throw new ConflictException("run changed during retry");
        const saved = await tx.agentRun.findFirst({
          where: { id: run.id, tenantId: input.tenantId },
        });
        if (!saved) throw new ConflictException("run unavailable after retry");
        return this.toRecord(saved as StoredAgentRun);
      });
    }
    const updated = (await this.prisma.agentRun.update({
      where: { id: run.id },
      data: {
        status: "QUEUED",
        workerId: null,
        error: null,
        startedAt: null,
        endedAt: null,
        heartbeatAt: null
      }
    })) as StoredAgentRun;

    return this.toRecord(updated);
  }

  /** Worker starts carry the expected QUEUED attempt; manual starts remain available. */
  async start(input: {
    tenantId: string; orgId: string; userId: string; runId: string;
    workerId?: string; expectedAttempts?: number;
  }): Promise<AgentRunRecord> {
    await this.actorContextService.ensureActorContext(input);
    const run = await this.requireRun(input);
    if (input.workerId && (!Number.isInteger(input.expectedAttempts) || input.expectedAttempts! < 0)) {
      throw new ConflictException("worker start requires expectedAttempts");
    }
    if (run.status === "RUNNING") {
      if (run.workerId) {
        if (input.workerId !== run.workerId || input.expectedAttempts !== run.attempts) {
          throw new ConflictException("stale worker attempt cannot start an owned run");
        }
      } else if (input.workerId) {
        throw new ConflictException("run already started by another actor");
      }
      return this.toReplayRecord(run);
    }
    if (run.deadLettered || run.attempts >= run.maxAttempts) {
      throw new ConflictException("run reached max attempts and cannot be started");
    }
    if (run.status !== "QUEUED") {
      throw new ConflictException("cannot start run in status '" + run.status.toLowerCase() + "'");
    }
    if (input.workerId) {
      // Workers must use claimNext() to atomically acquire a queued run.
      // In particular, an old worker may not reuse its previous attempt token
      // to revive a run which was reclaimed and requeued.
      throw new ConflictException("queued worker run must be acquired via claim, not start");
    }
    if (input.expectedAttempts !== undefined) {
      throw new ConflictException("manual start cannot use a worker attempt token");
    }
    const now = new Date();
    const applied = await this.prisma.agentRun.updateMany({
      where: {
        id: run.id, tenantId: input.tenantId, status: "QUEUED",
        deadLettered: false, attempts: run.attempts,
      },
      data: {
        status: "RUNNING", workerId: input.workerId ?? null,
        attempts: { increment: 1 }, startedAt: now, heartbeatAt: now,
      },
    });
    if (applied.count !== 1) throw new ConflictException("run was already claimed, cancelled or restarted");
    return this.toRecord(await this.requireRun(input));
  }

  async heartbeat(input: {
    tenantId: string; orgId: string; userId: string; runId: string;
    workerId: string; expectedAttempts?: number;
  }): Promise<AgentRunRecord> {
    await this.actorContextService.ensureActorContext(input);
    const run = await this.requireRun(input);
    if (run.status !== "RUNNING") {
      throw new ConflictException("cannot heartbeat run in status '" + run.status.toLowerCase() + "'");
    }
    if (run.workerId) {
      if (input.workerId !== run.workerId || input.expectedAttempts !== run.attempts) {
        throw new ConflictException("stale worker attempt cannot heartbeat");
      }
    } else if (input.expectedAttempts !== undefined) {
      throw new ConflictException("worker cannot heartbeat an unowned manual run");
    }
    const applied = await this.prisma.agentRun.updateMany({
      where: {
        id: run.id, tenantId: input.tenantId, status: "RUNNING",
        attempts: run.attempts, workerId: run.workerId,
      },
      data: {
        heartbeatAt: new Date(),
        ...(input.expectedAttempts !== undefined ? { workerId: input.workerId } : {}),
      },
    });
    if (applied.count !== 1) throw new ConflictException("run ownership changed before heartbeat");
    return this.toRecord(await this.requireRun(input));
  }

  private assertCurrentRunAttempt(
    run: StoredAgentRun,
    input: { workerId?: string; expectedAttempts?: number },
  ): void {
    if (run.workerId) {
      if (input.workerId !== run.workerId || input.expectedAttempts !== run.attempts) {
        throw new ConflictException("stale worker attempt cannot finalize an owned run");
      }
    } else if (input.workerId !== undefined || input.expectedAttempts !== undefined) {
      throw new ConflictException("worker cannot finalize an unowned manual run");
    }
  }

  /**
   * In opt-in mode the state CAS and post-commit work receipt must share a
   * PostgreSQL transaction. Without a consumer rollout flag stays OFF.
   */
  private async transitionToTerminal(
    input: { tenantId: string; orgId: string; userId: string; requestId?: string },
    run: StoredAgentRun,
    status: "COMPLETED" | "FAILED",
    mutation: PrismaTypes.AgentRunUpdateManyMutationInput,
  ): Promise<void> {
    const enabled = isAgentRunFinalizationOutboxEnabled();
    const persist = async (db: AgentRunTx) => {
      const changed = await db.agentRun.updateMany({
        where: {
          id: run.id, tenantId: input.tenantId,
          status: "RUNNING", attempts: run.attempts, workerId: run.workerId,
        },
        data: mutation,
      });
      if (changed.count !== 1) throw new ConflictException("run ownership changed before terminal state");
      if (!enabled) return;
      const event = createAgentRunFinalizationEvent({
        ...input, runId: run.id, attempts: run.attempts,
        correlationId: run.correlationId, status,
      });
      await db.domainOutboxEvent.create({
        data: {
          eventId: event.eventId, eventType: event.eventType,
          version: event.version, envelopeVersion: event.envelopeVersion,
          tenantId: event.tenantId, orgId: event.orgId,
          module: event.module, entityType: event.entityType, entityId: event.entityId,
          actorType: event.actor.type, actorId: event.actor.id,
          correlationId: event.correlationId, idempotencyKey: event.idempotencyKey,
          schemaRef: event.schemaRef, payloadJson: event.payload,
          occurredAt: new Date(event.occurredAt), recordedAt: new Date(event.recordedAt),
        },
      });
    };
    if (enabled) await this.prisma.$transaction(async tx => persist(tx as AgentRunTx));
    else await persist(this.prisma as AgentRunTx);
  }

  async complete(input: {
    tenantId: string; orgId: string; userId: string; runId: string;
    output?: Record<string, unknown>; workerId?: string; expectedAttempts?: number; requestId?: string;
  }): Promise<AgentRunRecord> {
    await this.actorContextService.ensureActorContext(input);
    const run = await this.requireRun(input);
    this.assertCurrentRunAttempt(run, input);
    if (run.status === "COMPLETED") return this.toReplayRecord(run);
    if (run.status !== "RUNNING") {
      throw new ConflictException("cannot complete run in status '" + run.status.toLowerCase() + "'");
    }
    const now = new Date();
    const durationMs = run.startedAt ? now.getTime() - run.startedAt.getTime() : null;
    const toolCallCount = typeof input.output?.toolCallCount === "number" ? input.output.toolCallCount : 0;
    await this.transitionToTerminal(input, run, "COMPLETED", {
        status: "COMPLETED",
        outputJson: (input.output as PrismaTypes.InputJsonValue | undefined) ?? Prisma.JsonNull,
        outputSummary: typeof input.output?.summary === "string"
          ? input.output.summary
          : typeof input.output?.recommendation === "string" ? input.output.recommendation : null,
        actionType: typeof input.output?.actionType === "string" ? input.output.actionType : null,
        confidence: typeof input.output?.confidence === "number" ? input.output.confidence : null,
        requiresHumanReview: typeof input.output?.requiresHumanReview === "boolean"
          ? input.output.requiresHumanReview : false,
        error: null, endedAt: now, durationMs, toolCallCount,
    });
    return this.toRecord(await this.requireRun(input));
  }

  async fail(input: {
    tenantId: string; orgId: string; userId: string; runId: string;
    error: string; workerId?: string; expectedAttempts?: number; requestId?: string;
  }): Promise<AgentRunRecord> {
    await this.actorContextService.ensureActorContext(input);
    const run = await this.requireRun(input);
    this.assertCurrentRunAttempt(run, input);
    if (run.status === "FAILED") return this.toReplayRecord(run);
    if (run.status !== "RUNNING") {
      throw new ConflictException("cannot fail run in status '" + run.status.toLowerCase() + "'");
    }
    const now = new Date();
    const durationMs = run.startedAt ? now.getTime() - run.startedAt.getTime() : null;
    await this.transitionToTerminal(input, run, "FAILED", {
        status: "FAILED", error: input.error,
        deadLettered: run.attempts >= run.maxAttempts,
        endedAt: now, durationMs,
    });
    return this.toRecord(await this.requireRun(input));
  }

  async getEvents(input: { tenantId: string; runId: string }): Promise<{
    runId: string;
    events: Array<{ type: string; at: string; detail: string }>;
  }> {
    const run = (await this.prisma.agentRun.findFirst({
      where: { id: input.runId, tenantId: input.tenantId },
      select: {
        id: true, status: true, agentType: true, correlationId: true,
        error: true, inputSummary: true, outputSummary: true,
        createdAt: true, startedAt: true, heartbeatAt: true, endedAt: true,
      },
    })) as (StoredAgentRun & { inputSummary?: string | null; outputSummary?: string | null }) | null;
    if (!run) throw new NotFoundException(`Agent run '${input.runId}' not found`);

    const events: Array<{ type: string; at: string; detail: string }> = [];
    events.push({ type: "queued",  at: run.createdAt.toISOString(), detail: `Agent '${run.agentType}' queued (correlationId: ${run.correlationId})` });
    if (run.startedAt)    events.push({ type: "started",   at: run.startedAt.toISOString(),   detail: "Execution started" });
    if (run.heartbeatAt)  events.push({ type: "heartbeat", at: run.heartbeatAt.toISOString(), detail: "Last heartbeat received" });
    if (run.inputSummary) events.push({ type: "input",     at: (run.startedAt ?? run.createdAt).toISOString(), detail: run.inputSummary });
    if (run.endedAt) {
      const isOk = run.status === "COMPLETED";
      events.push({
        type: isOk ? "completed" : "failed",
        at: run.endedAt.toISOString(),
        detail: isOk
          ? (run.outputSummary ?? "Run completed successfully")
          : (run.error ?? "Run failed with unknown error"),
      });
    }
    return { runId: run.id, events };
  }

  async cancel(input: {
    tenantId: string;
    orgId: string;
    userId: string;
    runId: string;
  }): Promise<AgentRunRecord> {
    await this.actorContextService.ensureActorContext(input);
    const run = await this.requireRun(input);

    if (["COMPLETED", "FAILED"].includes(run.status)) {
      return this.toRecord(run);
    }

    const now = new Date();
    const durationMs = run.startedAt ? now.getTime() - run.startedAt.getTime() : null;
    const updated = (await this.prisma.agentRun.update({
      where: { id: run.id },
      data: { status: "FAILED", error: "cancelled_by_user", endedAt: now, durationMs },
    })) as StoredAgentRun;

    return this.toRecord(updated);
  }

  private async requireRun(input: { tenantId: string; runId: string }): Promise<StoredAgentRun> {
    const run = (await this.prisma.agentRun.findFirst({
      where: {
        id: input.runId,
        tenantId: input.tenantId
      }
    })) as StoredAgentRun | null;

    if (!run) {
      this.logger.warn(
        `[agent.run.require.miss] ${JSON.stringify({
          runId: input.runId,
          tenantId: input.tenantId
        })}`
      );
      throw new NotFoundException(`Agent run '${input.runId}' not found`);
    }

    this.logger.warn(
      `[agent.run.require.hit] ${JSON.stringify({
        runId: input.runId,
        tenantId: input.tenantId,
        status: run.status
      })}`
    );

    return run;
  }

  private toReplayRecord(run: StoredAgentRun): AgentRunRecord {
    const record = this.toRecord(run);
    replayedAgentRuns.add(record);
    return record;
  }

  private toRecord(run: StoredAgentRun): AgentRunRecord {
    return {
      id: run.id,
      tenantId: run.tenantId,
      agentType: run.agentType as AgentRunRecord["agentType"],
      status: run.status.toLowerCase() as AgentRunRecord["status"],
      triggerType: run.triggerType as AgentRunRecord["triggerType"],
      correlationId: run.correlationId,
      input: (run.inputJson as Record<string, unknown> | null) ?? undefined,
      workerId: run.workerId ?? undefined,
      attempts: run.attempts,
      maxAttempts: run.maxAttempts,
      deadLettered: run.deadLettered,
      output: (run.outputJson as Record<string, unknown> | null) ?? undefined,
      error: run.error ?? undefined,
      startedAt: run.startedAt?.toISOString(),
      heartbeatAt: run.heartbeatAt?.toISOString(),
      endedAt: run.endedAt?.toISOString(),
      durationMs: run.durationMs ?? undefined,
      toolCallCount: run.toolCallCount,
      createdAt: run.createdAt.toISOString(),
      updatedAt: run.updatedAt.toISOString()
    };
  }
}
