import { Injectable } from "@nestjs/common";
import { PrismaService } from "../../infrastructure/prisma/prisma.service.js";

// ── Types ─────────────────────────────────────────────────────────────────────

export type AgentMemoryType =
  | "decision"
  | "observation"
  | "session_summary"
  | "action_proposal"
  | "fact"
  | "event";

export type AgentMemoryRecord = {
  id: string;
  tenantId: string;
  orgId: string;
  agentId: string;
  sessionId?: string;
  projectId?: string;
  workspaceId?: string;
  type: AgentMemoryType;
  content: string;
  summary: string;
  importanceScore: number;
  tags: string[];
  sourceRef?: string;
  createdAt: string;
  updatedAt: string;
};

export type CreateAgentMemoryInput = {
  id?: string;
  tenantId: string;
  orgId: string;
  agentId: string;
  sessionId?: string;
  projectId?: string;
  workspaceId?: string;
  type: AgentMemoryType;
  content: string;
  summary: string;
  importanceScore?: number;
  tags?: string[];
  sourceRef?: string;
};

export type SearchAgentMemoriesInput = {
  tenantId: string;
  projectId: string;
  term: string;
  agentId?: string;
  types?: AgentMemoryType[];
  limit?: number;
};

type StoredRow = {
  id: string;
  tenantId: string;
  orgId: string;
  agentId: string;
  sessionId: string | null;
  projectId: string | null;
  workspaceId: string | null;
  type: string;
  content: string;
  summary: string;
  importanceScore: number;
  tags: string[];
  sourceRef: string | null;
  createdAt: Date;
  updatedAt: Date;
};

type FtsRow = StoredRow & { rank: number };

function toRecord(row: StoredRow): AgentMemoryRecord {
  return {
    id: row.id,
    tenantId: row.tenantId,
    orgId: row.orgId,
    agentId: row.agentId,
    sessionId: row.sessionId ?? undefined,
    projectId: row.projectId ?? undefined,
    workspaceId: row.workspaceId ?? undefined,
    type: row.type as AgentMemoryType,
    content: row.content,
    summary: row.summary,
    importanceScore: row.importanceScore,
    tags: row.tags,
    sourceRef: row.sourceRef ?? undefined,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

// ── Repository ────────────────────────────────────────────────────────────────

@Injectable()
export class AgentMemoryRepository {
  constructor(private readonly prisma: PrismaService) {}

  async create(input: CreateAgentMemoryInput): Promise<AgentMemoryRecord> {
    const row = await this.prisma.agentMemory.create({
      data: {
        id: input.id ?? undefined,
        tenantId: input.tenantId,
        orgId: input.orgId,
        agentId: input.agentId,
        sessionId: input.sessionId ?? null,
        projectId: input.projectId ?? null,
        workspaceId: input.workspaceId ?? null,
        type: input.type,
        content: input.content.slice(0, 4_000),
        summary: input.summary.slice(0, 200),
        importanceScore: Math.min(5, Math.max(1, input.importanceScore ?? 3)),
        tags: input.tags ?? [],
        sourceRef: input.sourceRef ?? null,
      },
    });
    return toRecord(row as StoredRow);
  }

  async upsert(input: CreateAgentMemoryInput & { id: string }): Promise<AgentMemoryRecord> {
    const row = await this.prisma.agentMemory.upsert({
      where: { id: input.id },
      create: {
        id: input.id,
        tenantId: input.tenantId,
        orgId: input.orgId,
        agentId: input.agentId,
        sessionId: input.sessionId ?? null,
        projectId: input.projectId ?? null,
        workspaceId: input.workspaceId ?? null,
        type: input.type,
        content: input.content.slice(0, 4_000),
        summary: input.summary.slice(0, 200),
        importanceScore: Math.min(5, Math.max(1, input.importanceScore ?? 3)),
        tags: input.tags ?? [],
        sourceRef: input.sourceRef ?? null,
      },
      update: {
        content: input.content.slice(0, 4_000),
        summary: input.summary.slice(0, 200),
        importanceScore: Math.min(5, Math.max(1, input.importanceScore ?? 3)),
        tags: input.tags ?? [],
        sourceRef: input.sourceRef ?? null,
      },
    });
    return toRecord(row as StoredRow);
  }

  async listByProject(input: {
    tenantId: string;
    projectId: string;
    types?: AgentMemoryType[];
    limit?: number;
    minImportance?: number;
  }): Promise<AgentMemoryRecord[]> {
    const rows = await this.prisma.agentMemory.findMany({
      where: {
        tenantId: input.tenantId,
        projectId: input.projectId,
        ...(input.types?.length ? { type: { in: input.types } } : {}),
        ...(input.minImportance ? { importanceScore: { gte: input.minImportance } } : {}),
      },
      orderBy: [{ importanceScore: "desc" }, { updatedAt: "desc" }],
      take: input.limit ?? 50,
    });
    return (rows as StoredRow[]).map(toRecord);
  }

  async listBySession(input: {
    tenantId: string;
    sessionId: string;
  }): Promise<AgentMemoryRecord[]> {
    const rows = await this.prisma.agentMemory.findMany({
      where: { tenantId: input.tenantId, sessionId: input.sessionId },
      orderBy: { createdAt: "asc" },
    });
    return (rows as StoredRow[]).map(toRecord);
  }

  /**
   * Full-text search on content + summary.
   * Strictly scoped to (tenantId, projectId) — never leaks across projects.
   */
  async search(input: SearchAgentMemoriesInput): Promise<Array<AgentMemoryRecord & { rank: number }>> {
    const term = input.term.trim();
    if (!term) return [];

    const tokens = term
      .replace(/[^a-zA-Z0-9áéíóúüñÁÉÍÓÚÜÑ\s]/g, " ")
      .trim()
      .split(/\s+/)
      .filter(Boolean);

    if (tokens.length === 0) return [];

    const ftsQuery = tokens.map((t) => `${t}:*`).join(" & ");
    const limit = input.limit ?? 20;

    try {
      // Two branches to keep all variables parameterized (no string interpolation in SQL body)
      const rows: FtsRow[] = input.agentId
        ? await this.prisma.$queryRaw<FtsRow[]>`
            SELECT m.*,
              ts_rank(
                to_tsvector('spanish', coalesce(m.summary,'') || ' ' || coalesce(m.content,'')),
                to_tsquery('spanish', ${ftsQuery})
              ) AS rank
            FROM "AgentMemory" m
            WHERE m."tenantId" = ${input.tenantId}
              AND m."projectId" = ${input.projectId}
              AND m."agentId" = ${input.agentId}
              AND to_tsvector('spanish', coalesce(m.summary,'') || ' ' || coalesce(m.content,''))
                  @@ to_tsquery('spanish', ${ftsQuery})
            ORDER BY rank DESC, m."importanceScore" DESC
            LIMIT ${limit}
          `
        : await this.prisma.$queryRaw<FtsRow[]>`
            SELECT m.*,
              ts_rank(
                to_tsvector('spanish', coalesce(m.summary,'') || ' ' || coalesce(m.content,'')),
                to_tsquery('spanish', ${ftsQuery})
              ) AS rank
            FROM "AgentMemory" m
            WHERE m."tenantId" = ${input.tenantId}
              AND m."projectId" = ${input.projectId}
              AND to_tsvector('spanish', coalesce(m.summary,'') || ' ' || coalesce(m.content,''))
                  @@ to_tsquery('spanish', ${ftsQuery})
            ORDER BY rank DESC, m."importanceScore" DESC
            LIMIT ${limit}
          `;
      return rows.map((r) => ({ ...toRecord(r), rank: Number(r.rank) }));
    } catch {
      return [];
    }
  }

  async deleteBySession(input: { tenantId: string; sessionId: string }): Promise<number> {
    const result = await this.prisma.agentMemory.deleteMany({
      where: { tenantId: input.tenantId, sessionId: input.sessionId },
    });
    return result.count;
  }

  // ── Decay: reduce importanceScore of old memories ────────────────────────────

  async decayOldMemories(input: {
    tenantId: string;
    projectId: string;
    olderThanDays: number;
    minImportance?: number;
  }): Promise<number> {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - input.olderThanDays);
    const minScore = input.minImportance ?? 2;

    const result = await this.prisma.agentMemory.updateMany({
      where: {
        tenantId: input.tenantId,
        projectId: input.projectId,
        updatedAt: { lt: cutoff },
        importanceScore: { gte: minScore },
        type: { in: ["session_summary", "observation", "event"] as string[] },
      },
      data: {
        importanceScore: { decrement: 1 },
      },
    });
    return result.count;
  }

  // ── Cleanup: delete very old, low-importance memories ────────────────────────

  async cleanupExpiredMemories(input: {
    tenantId: string;
    projectId: string;
    olderThanDays: number;
    maxImportance?: number;
  }): Promise<number> {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - input.olderThanDays);
    const maxScore = input.maxImportance ?? 1;

    const result = await this.prisma.agentMemory.deleteMany({
      where: {
        tenantId: input.tenantId,
        projectId: input.projectId,
        updatedAt: { lt: cutoff },
        importanceScore: { lte: maxScore },
        type: { notIn: ["decision", "action_proposal"] as string[] },
      },
    });
    return result.count;
  }

  // ── Dedup: find candidate duplicates by summary similarity ───────────────────

  async findDuplicateCandidates(input: {
    tenantId: string;
    projectId: string;
    agentId: string;
    type?: string;
  }): Promise<Array<{ id: string; summary: string; type: string; importanceScore: number; createdAt: Date }>> {
    const rows = await this.prisma.agentMemory.findMany({
      where: {
        tenantId: input.tenantId,
        projectId: input.projectId,
        agentId: input.agentId,
        ...(input.type ? { type: input.type } : {}),
      },
      select: { id: true, summary: true, type: true, importanceScore: true, createdAt: true },
      orderBy: { createdAt: "asc" },
    });
    return rows.map((r: { id: string; summary: string; type: string; importanceScore: number; createdAt: Date }) => ({ ...r, createdAt: r.createdAt }));
  }

  async deleteManyById(ids: string[]): Promise<number> {
    if (ids.length === 0) return 0;
    const result = await this.prisma.agentMemory.deleteMany({ where: { id: { in: ids } } });
    return result.count;
  }
}
