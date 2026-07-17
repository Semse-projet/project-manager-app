import { Injectable, NotFoundException } from "@nestjs/common";
import type { ForgeRun as PrismaForgeRun } from "@prisma/client";
import type {
  ForgeAgentRole,
  ForgeRun,
  ForgeRunState,
  ForgeSpecReference,
  ForgeTaskPacket
} from "@semse/forge";
import { ActorContextService } from "../../infrastructure/persistence/actor-context.service.js";
import { PrismaService } from "../../infrastructure/prisma/prisma.service.js";

type StoredForgeRun = PrismaForgeRun & {
  tasksJson: unknown;
  assignedAgentsJson: unknown;
  approvalsJson: unknown;
  eventsJson: unknown;
  agentRunIdsJson: unknown;
};

@Injectable()
export class ForgeRepository {
  constructor(
    private readonly prisma: PrismaService,
    private readonly actorContextService: ActorContextService
  ) {}

  async list(tenantId: string): Promise<ForgeRun[]> {
    const rows = (await this.prisma.forgeRun.findMany({
      where: { tenantId },
      orderBy: { createdAt: "desc" }
    })) as StoredForgeRun[];
    return rows.map((row) => this.toDomain(row));
  }

  async findById(input: { tenantId: string; runId: string }): Promise<ForgeRun> {
    const row = (await this.prisma.forgeRun.findFirst({
      where: { id: input.runId, tenantId: input.tenantId }
    })) as StoredForgeRun | null;
    if (!row) {
      throw new NotFoundException(`Forge run '${input.runId}' not found`);
    }
    return this.toDomain(row);
  }

  async create(input: {
    tenantId: string;
    orgId: string;
    userId: string;
    run: ForgeRun;
  }): Promise<ForgeRun> {
    await this.actorContextService.ensureActorContext(input);
    const row = (await this.prisma.forgeRun.create({
      data: this.toPrismaData(input.tenantId, input.orgId, input.run)
    })) as StoredForgeRun;
    return this.toDomain(row);
  }

  async update(input: {
    tenantId: string;
    orgId: string;
    userId: string;
    run: ForgeRun;
  }): Promise<ForgeRun> {
    await this.actorContextService.ensureActorContext(input);
    const row = (await this.prisma.forgeRun.update({
      where: { id: input.run.id, tenantId: input.tenantId },
      data: this.toPrismaData(input.tenantId, input.orgId, input.run)
    })) as StoredForgeRun;
    return this.toDomain(row);
  }

  async missionControlSummary(tenantId: string): Promise<{
    total: number;
    blocked: number;
    pendingApprovals: number;
    readyForReview: number;
    recent: ForgeRun[];
  }> {
    const [total, blocked, pendingApprovals, readyForReview, recent] = await Promise.all([
      this.prisma.forgeRun.count({ where: { tenantId } }),
      this.prisma.forgeRun.count({ where: { tenantId, state: "blocked" } }),
      this.prisma.forgeRun.count({ where: { tenantId, state: { in: ["spec_review", "ready_for_review"] } } }),
      this.prisma.forgeRun.count({ where: { tenantId, state: "ready_for_review" } }),
      this.prisma.forgeRun.findMany({
        where: { tenantId },
        orderBy: { updatedAt: "desc" },
        take: 20
      })
    ]);
    return {
      total,
      blocked,
      pendingApprovals,
      readyForReview,
      recent: (recent as StoredForgeRun[]).map((row) => this.toDomain(row))
    };
  }

  private toDomain(row: StoredForgeRun): ForgeRun {
    return {
      id: row.id,
      title: row.title,
      state: row.state as ForgeRunState,
      spec: {
        id: row.specId,
        path: row.specPath,
        digest: row.specDigest,
        status: row.specStatus as ForgeSpecReference["status"]
      },
      tasks: (row.tasksJson as ForgeTaskPacket[]) ?? [],
      assignedAgents: (row.assignedAgentsJson as Record<ForgeAgentRole, string[]>) ?? {},
      approvals: (row.approvalsJson as ForgeRun["approvals"]) ?? [],
      events: (row.eventsJson as ForgeRun["events"]) ?? [],
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString()
    };
  }

  private toPrismaData(tenantId: string, orgId: string, run: ForgeRun) {
    return {
      tenantId,
      orgId,
      title: run.title,
      state: run.state,
      specId: run.spec.id,
      specPath: run.spec.path,
      specDigest: run.spec.digest,
      specStatus: run.spec.status,
      tasksJson: run.tasks as unknown as object,
      assignedAgentsJson: run.assignedAgents as unknown as object,
      approvalsJson: run.approvals as unknown as object,
      eventsJson: run.events as unknown as object,
      agentRunIdsJson: [] as unknown as object,
      updatedAt: new Date(run.updatedAt)
    };
  }
}
