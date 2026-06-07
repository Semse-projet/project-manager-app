import { BadRequestException, ConflictException, Injectable, Logger, NotFoundException } from "@nestjs/common";
import prismaClientPackage from "@prisma/client";
import type { Prisma as PrismaTypes } from "@prisma/client";
import { type AgentRunRecord } from "../../common/domain-store.js";
import { ActorContextService } from "../../infrastructure/persistence/actor-context.service.js";
import { PrismaService } from "../../infrastructure/prisma/prisma.service.js";

const { Prisma } = prismaClientPackage as typeof import("@prisma/client");

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

  async claimNext(input: {
    tenantId: string;
    orgId: string;
    userId: string;
    workerId: string;
    agentType?: AgentRunRecord["agentType"];
  }): Promise<AgentRunRecord | null> {
    await this.actorContextService.ensureActorContext(input);

    return this.prisma.$transaction(async (tx) => {
      const db = tx as AgentRunTx;
      const next = (await db.agentRun.findFirst({
        where: {
          tenantId: input.tenantId,
          status: "QUEUED",
          deadLettered: false,
          ...(input.agentType ? { agentType: input.agentType } : {})
        },
        orderBy: { createdAt: "asc" }
      })) as StoredAgentRun | null;

      if (!next || next.attempts >= next.maxAttempts) {
        return null;
      }

      const now = new Date();
      const claimed = (await db.agentRun.update({
        where: { id: next.id },
        data: {
          status: "RUNNING",
          workerId: input.workerId,
          attempts: { increment: 1 },
          startedAt: now,
          heartbeatAt: now
        }
      })) as StoredAgentRun;

      return this.toRecord(claimed);
    });
  }

  async reclaimStale(input: {
    tenantId: string;
    orgId: string;
    userId: string;
    staleAfterMs: number;
    maxItems?: number;
  }): Promise<AgentRunRecord[]> {
    await this.actorContextService.ensureActorContext(input);

    const candidates = (await this.prisma.agentRun.findMany({
      where: {
        tenantId: input.tenantId,
        status: "RUNNING"
      },
      orderBy: { updatedAt: "asc" },
      take: input.maxItems ?? 50
    })) as StoredAgentRun[];

    const now = Date.now();
    const reclaimed: AgentRunRecord[] = [];

    for (const run of candidates) {
      const lastSignal = run.heartbeatAt ?? run.startedAt ?? run.updatedAt ?? run.createdAt;
      const ageMs = now - lastSignal.getTime();

      if (Number.isNaN(ageMs) || ageMs < input.staleAfterMs) {
        continue;
      }

      const updated = (await this.prisma.agentRun.update({
        where: { id: run.id },
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
      })) as StoredAgentRun;

      reclaimed.push(this.toRecord(updated));

      if (reclaimed.length >= (input.maxItems ?? 50)) {
        break;
      }
    }

    return reclaimed;
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

  async start(input: { tenantId: string; orgId: string; userId: string; runId: string }): Promise<AgentRunRecord> {
    await this.actorContextService.ensureActorContext(input);
    const run = await this.requireRun(input);

    if (run.status === "RUNNING") {
      return this.toRecord(run);
    }
    if (run.deadLettered || run.attempts >= run.maxAttempts) {
      throw new ConflictException("run reached max attempts and cannot be started");
    }
    if (run.status !== "QUEUED") {
      throw new ConflictException(`cannot start run in status '${run.status.toLowerCase()}'`);
    }

    const now = new Date();
    const updated = (await this.prisma.agentRun.update({
      where: { id: run.id },
      data: {
        status: "RUNNING",
        attempts: { increment: 1 },
        startedAt: now,
        heartbeatAt: now
      }
    })) as StoredAgentRun;

    return this.toRecord(updated);
  }

  async heartbeat(input: {
    tenantId: string;
    orgId: string;
    userId: string;
    runId: string;
    workerId: string;
  }): Promise<AgentRunRecord> {
    await this.actorContextService.ensureActorContext(input);
    const run = await this.requireRun(input);

    if (run.status !== "RUNNING") {
      throw new ConflictException(`cannot heartbeat run in status '${run.status.toLowerCase()}'`);
    }
    if (run.workerId && run.workerId !== input.workerId) {
      throw new ConflictException("run is owned by another worker");
    }

    const updated = (await this.prisma.agentRun.update({
      where: { id: run.id },
      data: {
        workerId: input.workerId,
        heartbeatAt: new Date()
      }
    })) as StoredAgentRun;

    return this.toRecord(updated);
  }

  async complete(input: {
    tenantId: string;
    orgId: string;
    userId: string;
    runId: string;
    output?: Record<string, unknown>;
  }): Promise<AgentRunRecord> {
    await this.actorContextService.ensureActorContext(input);
    const run = await this.requireRun(input);

    if (run.status === "COMPLETED") {
      return this.toRecord(run);
    }
    if (run.status !== "RUNNING") {
      throw new ConflictException(`cannot complete run in status '${run.status.toLowerCase()}'`);
    }

    const now = new Date();
    const durationMs = run.startedAt ? now.getTime() - run.startedAt.getTime() : null;
    const toolCallCount = typeof input.output?.toolCallCount === "number" ? input.output.toolCallCount : 0;

    const updated = (await this.prisma.agentRun.update({
      where: { id: run.id },
      data: {
        status: "COMPLETED",
        outputJson: (input.output as PrismaTypes.InputJsonValue | undefined) ?? Prisma.JsonNull,
        outputSummary:
          typeof input.output?.summary === "string"
            ? input.output.summary
            : typeof input.output?.recommendation === "string"
              ? input.output.recommendation
              : null,
        actionType: typeof input.output?.actionType === "string" ? input.output.actionType : null,
        confidence:
          typeof input.output?.confidence === "number"
            ? input.output.confidence
            : null,
        requiresHumanReview:
          typeof input.output?.requiresHumanReview === "boolean"
            ? input.output.requiresHumanReview
            : false,
        error: null,
        endedAt: now,
        durationMs,
        toolCallCount
      }
    })) as StoredAgentRun;

    return this.toRecord(updated);
  }

  async fail(input: {
    tenantId: string;
    orgId: string;
    userId: string;
    runId: string;
    error: string;
  }): Promise<AgentRunRecord> {
    await this.actorContextService.ensureActorContext(input);
    const run = await this.requireRun(input);

    if (run.status === "FAILED") {
      return this.toRecord(run);
    }
    if (run.status !== "RUNNING") {
      throw new ConflictException(`cannot fail run in status '${run.status.toLowerCase()}'`);
    }

    const now = new Date();
    const durationMs = run.startedAt ? now.getTime() - run.startedAt.getTime() : null;

    const updated = (await this.prisma.agentRun.update({
      where: { id: run.id },
      data: {
        status: "FAILED",
        error: input.error,
        deadLettered: run.attempts >= run.maxAttempts,
        endedAt: now,
        durationMs
      }
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
