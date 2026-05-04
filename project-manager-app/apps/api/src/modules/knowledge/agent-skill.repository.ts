import { Injectable } from "@nestjs/common";
import { PrismaService } from "../../infrastructure/prisma/prisma.service.js";

export type AgentSkillStatus = "active" | "stale" | "archived" | "pinned";

export interface AgentSkillRecord {
  id: string;
  tenantId: string;
  orgId: string;
  agentId: string;
  name: string;
  trigger: string;
  procedure: string;
  category: string;
  tags: string[];
  successRate: number;
  useCount: number;
  lastUsedAt?: string;
  createdFromRunId?: string;
  status: AgentSkillStatus;
  createdAt: string;
  updatedAt: string;
}

export interface CreateAgentSkillInput {
  tenantId: string;
  orgId: string;
  agentId: string;
  name: string;
  trigger: string;
  procedure: string;
  category?: string;
  tags?: string[];
  createdFromRunId?: string;
}

export interface RecordSkillUseInput {
  tenantId: string;
  agentId: string;
  name: string;
  succeeded: boolean;
}

@Injectable()
export class AgentSkillRepository {
  constructor(private readonly prisma: PrismaService) {}

  async create(input: CreateAgentSkillInput): Promise<AgentSkillRecord> {
    const row = await this.prisma.agentSkill.create({
      data: {
        tenantId: input.tenantId,
        orgId: input.orgId,
        agentId: input.agentId,
        name: input.name,
        trigger: input.trigger,
        procedure: input.procedure,
        category: input.category ?? "general",
        tags: input.tags ?? [],
        createdFromRunId: input.createdFromRunId,
        status: "active",
      },
    });
    return this.toRecord(row);
  }

  async findByAgent(tenantId: string, agentId: string, status?: AgentSkillStatus): Promise<AgentSkillRecord[]> {
    const rows = await this.prisma.agentSkill.findMany({
      where: { tenantId, agentId, ...(status ? { status } : {}) },
      orderBy: [{ status: "asc" }, { lastUsedAt: "desc" }],
    });
    return rows.map((r) => this.toRecord(r));
  }

  async findByName(tenantId: string, agentId: string, name: string): Promise<AgentSkillRecord | null> {
    const row = await this.prisma.agentSkill.findUnique({
      where: { tenantId_agentId_name: { tenantId, agentId, name } },
    });
    return row ? this.toRecord(row) : null;
  }

  async recordUse(input: RecordSkillUseInput): Promise<AgentSkillRecord> {
    const existing = await this.prisma.agentSkill.findUnique({
      where: { tenantId_agentId_name: { tenantId: input.tenantId, agentId: input.agentId, name: input.name } },
    });

    if (!existing) throw new Error(`AgentSkill not found: ${input.tenantId}/${input.agentId}/${input.name}`);

    const newUseCount = existing.useCount + 1;
    const prevSuccesses = Math.round(existing.successRate * existing.useCount);
    const newSuccesses = prevSuccesses + (input.succeeded ? 1 : 0);
    const newSuccessRate = newUseCount > 0 ? newSuccesses / newUseCount : 0;

    const row = await this.prisma.agentSkill.update({
      where: { id: existing.id },
      data: {
        useCount: newUseCount,
        successRate: newSuccessRate,
        lastUsedAt: new Date(),
      },
    });
    return this.toRecord(row);
  }

  async updateProcedure(id: string, procedure: string): Promise<AgentSkillRecord> {
    const row = await this.prisma.agentSkill.update({
      where: { id },
      data: { procedure },
    });
    return this.toRecord(row);
  }

  async setStatus(id: string, status: AgentSkillStatus): Promise<AgentSkillRecord> {
    const row = await this.prisma.agentSkill.update({
      where: { id },
      data: { status },
    });
    return this.toRecord(row);
  }

  private toRecord(row: {
    id: string; tenantId: string; orgId: string; agentId: string;
    name: string; trigger: string; procedure: string; category: string;
    tags: string[]; successRate: number; useCount: number;
    lastUsedAt: Date | null; createdFromRunId: string | null;
    status: string; createdAt: Date; updatedAt: Date;
  }): AgentSkillRecord {
    return {
      id: row.id,
      tenantId: row.tenantId,
      orgId: row.orgId,
      agentId: row.agentId,
      name: row.name,
      trigger: row.trigger,
      procedure: row.procedure,
      category: row.category,
      tags: row.tags,
      successRate: row.successRate,
      useCount: row.useCount,
      lastUsedAt: row.lastUsedAt?.toISOString(),
      createdFromRunId: row.createdFromRunId ?? undefined,
      status: row.status as AgentSkillStatus,
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
    };
  }
}
