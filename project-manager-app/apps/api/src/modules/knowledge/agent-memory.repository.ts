import { Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../../infrastructure/prisma/prisma.service.js";

// ── Types ─────────────────────────────────────────────────────────────────────

export type AgentMemoryType =
  | "decision"
  | "observation"
  | "session_summary"
  | "action_proposal"
  | "fact"
  | "event";

// C85 governance vocabulary — see docs/specs/knowledge/agent-memory-governance.spec.md.
// Memory is context, never canonical truth or standalone authorization to act.
export type AgentMemorySensitivity = "public" | "internal" | "restricted" | "confidential";
export type AgentMemoryEpistemicStatus = "remembered_context" | "inference" | "verified_fact";
export type AgentMemoryStatus = "active" | "superseded" | "corrected" | "invalidated";

export const SENSITIVITY_RANK: Record<AgentMemorySensitivity, number> = {
  public: 0,
  internal: 1,
  restricted: 2,
  confidential: 3,
};

export type AgentMemoryProvenance = {
  producedBy: string; // agentId, userId, or system job name
  method: "user_input" | "llm_summary" | "llm_inference" | "system_event" | "import" | "correction";
  model?: string;
  correlationId?: string;
};

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
  sensitivity: AgentMemorySensitivity;
  epistemicStatus: AgentMemoryEpistemicStatus;
  confidence?: number;
  provenance?: AgentMemoryProvenance;
  subjectType?: string;
  subjectId?: string;
  status: AgentMemoryStatus;
  supersedesId?: string;
  supersededById?: string;
  correctedFromId?: string;
  conflictsWith: string[];
  invalidatedAt?: string;
  invalidatedBy?: string;
  invalidationReason?: string;
  retentionUntil?: string;
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
  sensitivity?: AgentMemorySensitivity;
  epistemicStatus?: AgentMemoryEpistemicStatus;
  confidence?: number;
  provenance?: AgentMemoryProvenance;
  subjectType?: string;
  subjectId?: string;
  retentionUntil?: string;
};

export type SearchAgentMemoriesInput = {
  tenantId: string;
  projectId: string;
  term: string;
  agentId?: string;
  types?: AgentMemoryType[];
  limit?: number;
  maxSensitivity?: AgentMemorySensitivity;
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
  sensitivity: string;
  epistemicStatus: string;
  confidence: number | null;
  provenance: unknown;
  subjectType: string | null;
  subjectId: string | null;
  status: string;
  supersedesId: string | null;
  supersededById: string | null;
  correctedFromId: string | null;
  conflictsWith: string[];
  invalidatedAt: Date | null;
  invalidatedBy: string | null;
  invalidationReason: string | null;
  retentionUntil: Date | null;
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
    sensitivity: (row.sensitivity as AgentMemorySensitivity) ?? "internal",
    epistemicStatus: (row.epistemicStatus as AgentMemoryEpistemicStatus) ?? "remembered_context",
    confidence: row.confidence ?? undefined,
    provenance: (row.provenance as AgentMemoryProvenance | null) ?? undefined,
    subjectType: row.subjectType ?? undefined,
    subjectId: row.subjectId ?? undefined,
    status: (row.status as AgentMemoryStatus) ?? "active",
    supersedesId: row.supersedesId ?? undefined,
    supersededById: row.supersededById ?? undefined,
    correctedFromId: row.correctedFromId ?? undefined,
    conflictsWith: row.conflictsWith ?? [],
    invalidatedAt: row.invalidatedAt?.toISOString() ?? undefined,
    invalidatedBy: row.invalidatedBy ?? undefined,
    invalidationReason: row.invalidationReason ?? undefined,
    retentionUntil: row.retentionUntil?.toISOString() ?? undefined,
  };
}

function sensitivityFilter(max?: AgentMemorySensitivity) {
  if (!max) return {};
  const allowed = (Object.keys(SENSITIVITY_RANK) as AgentMemorySensitivity[]).filter(
    (s) => SENSITIVITY_RANK[s] <= SENSITIVITY_RANK[max],
  );
  return { sensitivity: { in: allowed } };
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
        sensitivity: input.sensitivity ?? "internal",
        epistemicStatus: input.epistemicStatus ?? "remembered_context",
        confidence: input.confidence ?? null,
        provenance: (input.provenance as never) ?? undefined,
        subjectType: input.subjectType ?? null,
        subjectId: input.subjectId ?? null,
        retentionUntil: input.retentionUntil ? new Date(input.retentionUntil) : null,
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
        sensitivity: input.sensitivity ?? "internal",
        epistemicStatus: input.epistemicStatus ?? "remembered_context",
        confidence: input.confidence ?? null,
        provenance: (input.provenance as never) ?? undefined,
        subjectType: input.subjectType ?? null,
        subjectId: input.subjectId ?? null,
        retentionUntil: input.retentionUntil ? new Date(input.retentionUntil) : null,
      },
      update: {
        content: input.content.slice(0, 4_000),
        summary: input.summary.slice(0, 200),
        importanceScore: Math.min(5, Math.max(1, input.importanceScore ?? 3)),
        tags: input.tags ?? [],
        sourceRef: input.sourceRef ?? null,
        // Upsert only ever refreshes an active memory's own content (e.g. running
        // session summaries) — governance fields (status/supersession/etc.) are
        // never touched here; use correct()/invalidate()/supersede() for those.
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
    maxSensitivity?: AgentMemorySensitivity;
    includeInactive?: boolean;
  }): Promise<AgentMemoryRecord[]> {
    const rows = await this.prisma.agentMemory.findMany({
      where: {
        tenantId: input.tenantId,
        projectId: input.projectId,
        ...(input.includeInactive ? {} : { status: "active" }),
        ...(input.types?.length ? { type: { in: input.types } } : {}),
        ...(input.minImportance ? { importanceScore: { gte: input.minImportance } } : {}),
        ...sensitivityFilter(input.maxSensitivity),
      },
      orderBy: [{ importanceScore: "desc" }, { updatedAt: "desc" }],
      take: input.limit ?? 50,
    });
    return (rows as StoredRow[]).map(toRecord);
  }

  async listBySession(input: {
    tenantId: string;
    sessionId: string;
    includeInactive?: boolean;
  }): Promise<AgentMemoryRecord[]> {
    const rows = await this.prisma.agentMemory.findMany({
      where: {
        tenantId: input.tenantId,
        sessionId: input.sessionId,
        ...(input.includeInactive ? {} : { status: "active" }),
      },
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

    const allowedSensitivities = (Object.keys(SENSITIVITY_RANK) as AgentMemorySensitivity[]).filter(
      (s) => SENSITIVITY_RANK[s] <= SENSITIVITY_RANK[input.maxSensitivity ?? "internal"],
    );

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
              AND m."status" = 'active'
              AND m."sensitivity" = ANY(${allowedSensitivities})
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
              AND m."status" = 'active'
              AND m."sensitivity" = ANY(${allowedSensitivities})
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

  // ── C85 governance: read one (tenant-scoped) ─────────────────────────────────

  async findById(input: { tenantId: string; id: string }): Promise<AgentMemoryRecord | null> {
    const row = await this.prisma.agentMemory.findFirst({
      where: { id: input.id, tenantId: input.tenantId },
    });
    return row ? toRecord(row as StoredRow) : null;
  }

  // ── C85 governance: invalidate ───────────────────────────────────────────────
  // Never deletes — marks the record so retrieval stops surfacing it while the
  // row (and its audit trail) remains for forensic/compliance purposes.

  async invalidate(input: {
    tenantId: string;
    id: string;
    invalidatedBy: string;
    reason: string;
  }): Promise<AgentMemoryRecord> {
    const result = await this.prisma.agentMemory.updateMany({
      where: { id: input.id, tenantId: input.tenantId },
      data: {
        status: "invalidated",
        invalidatedAt: new Date(),
        invalidatedBy: input.invalidatedBy,
        invalidationReason: input.reason,
      },
    });
    if (result.count === 0) throw new NotFoundException(`AgentMemory ${input.id} not found for tenant`);
    const row = await this.findById({ tenantId: input.tenantId, id: input.id });
    return row!;
  }

  // ── C85 governance: correct ──────────────────────────────────────────────────
  // Corrections never mutate the original content in place: the old row is
  // marked `corrected` and a brand-new row carries the fixed content, linked
  // both ways (correctedFromId / supersededById) so the full history is
  // reconstructable.

  async correct(input: {
    tenantId: string;
    id: string;
    correctedBy: string;
    patch: { content?: string; summary?: string; tags?: string[] };
    reason: string;
  }): Promise<AgentMemoryRecord> {
    const original = await this.findById({ tenantId: input.tenantId, id: input.id });
    if (!original) throw new NotFoundException(`AgentMemory ${input.id} not found for tenant`);

    const replacement = await this.create({
      tenantId: original.tenantId,
      orgId: original.orgId,
      agentId: original.agentId,
      sessionId: original.sessionId,
      projectId: original.projectId,
      workspaceId: original.workspaceId,
      type: original.type,
      content: input.patch.content ?? original.content,
      summary: input.patch.summary ?? original.summary,
      importanceScore: original.importanceScore,
      tags: input.patch.tags ?? original.tags,
      sourceRef: original.sourceRef,
      sensitivity: original.sensitivity,
      epistemicStatus: original.epistemicStatus,
      confidence: original.confidence,
      provenance: { producedBy: input.correctedBy, method: "correction", correlationId: input.id },
      subjectType: original.subjectType,
      subjectId: original.subjectId,
    });

    await this.prisma.agentMemory.update({
      where: { id: replacement.id },
      data: { correctedFromId: original.id },
    });

    await this.prisma.agentMemory.updateMany({
      where: { id: original.id, tenantId: input.tenantId },
      data: { status: "corrected", supersededById: replacement.id },
    });

    return (await this.findById({ tenantId: input.tenantId, id: replacement.id }))!;
  }

  // ── C85 governance: supersede ────────────────────────────────────────────────
  // Explicit replacement without implying the original was wrong (unlike
  // correct()) — e.g. a newer decision overriding an older one.

  async supersede(input: {
    tenantId: string;
    oldId: string;
    newId: string;
  }): Promise<void> {
    const [oldResult, newResult] = await Promise.all([
      this.prisma.agentMemory.updateMany({
        where: { id: input.oldId, tenantId: input.tenantId },
        data: { status: "superseded", supersededById: input.newId },
      }),
      this.prisma.agentMemory.updateMany({
        where: { id: input.newId, tenantId: input.tenantId },
        data: { supersedesId: input.oldId },
      }),
    ]);
    if (oldResult.count === 0 || newResult.count === 0) {
      throw new NotFoundException("One or both AgentMemory ids not found for tenant");
    }
  }

  // ── C85 governance: conflicts ─────────────────────────────────────────────────
  // Symmetric, non-destructive flag — both memories stay active and retrievable,
  // but callers/consumers see they contradict each other and must not silently
  // treat either as settled fact.

  async flagConflict(input: { tenantId: string; id: string; conflictsWithId: string }): Promise<void> {
    const [a, b] = await Promise.all([
      this.findById({ tenantId: input.tenantId, id: input.id }),
      this.findById({ tenantId: input.tenantId, id: input.conflictsWithId }),
    ]);
    if (!a || !b) throw new NotFoundException("One or both AgentMemory ids not found for tenant");

    await Promise.all([
      this.prisma.agentMemory.update({
        where: { id: a.id },
        data: { conflictsWith: Array.from(new Set([...a.conflictsWith, b.id])) },
      }),
      this.prisma.agentMemory.update({
        where: { id: b.id },
        data: { conflictsWith: Array.from(new Set([...b.conflictsWith, a.id])) },
      }),
    ]);
  }

  // ── C85 governance: lineage ───────────────────────────────────────────────────
  // Walks supersedesId/correctedFromId backwards to reconstruct the full
  // history of a memory, oldest first. Bounded to avoid pathological loops.

  async getLineage(input: { tenantId: string; id: string }): Promise<AgentMemoryRecord[]> {
    const chain: AgentMemoryRecord[] = [];
    let cursor: string | undefined = input.id;
    const seen = new Set<string>();

    while (cursor && !seen.has(cursor) && chain.length < 50) {
      seen.add(cursor);
      const row = await this.findById({ tenantId: input.tenantId, id: cursor });
      if (!row) break;
      chain.push(row);
      cursor = row.supersedesId ?? row.correctedFromId;
    }

    return chain.reverse();
  }
}
