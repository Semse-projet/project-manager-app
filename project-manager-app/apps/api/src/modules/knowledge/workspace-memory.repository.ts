import { Injectable } from "@nestjs/common";
import type { WorkspaceMemoryQuery, WorkspaceMemoryRecord } from "@semse/knowledge";
import { PrismaService } from "../../infrastructure/prisma/prisma.service.js";

type StoredWorkspaceMemoryEntry = {
  id: string;
  tenantId: string;
  orgId: string;
  createdBy: string;
  workspaceId: string;
  repoId: string | null;
  runId: string | null;
  taskId: string | null;
  kind: WorkspaceMemoryRecord["kind"];
  scope: WorkspaceMemoryRecord["scope"];
  title: string;
  summary: string;
  body: string | null;
  tags: string[];
  sourceRef: string | null;
  createdAt: Date;
  updatedAt: Date;
};

function parseStoredEntry(entry: StoredWorkspaceMemoryEntry): WorkspaceMemoryRecord {
  return {
    id: entry.id,
    tenantId: entry.tenantId,
    orgId: entry.orgId,
    createdBy: entry.createdBy,
    workspaceId: entry.workspaceId,
    repoId: entry.repoId ?? undefined,
    runId: entry.runId ?? undefined,
    taskId: entry.taskId ?? undefined,
    kind: entry.kind,
    scope: entry.scope,
    title: entry.title,
    summary: entry.summary,
    body: entry.body ?? undefined,
    tags: entry.tags,
    sourceRef: entry.sourceRef ?? undefined,
    updatedAtIso: entry.updatedAt.toISOString()
  };
}

function matchesQuery(record: WorkspaceMemoryRecord, input: WorkspaceMemoryQuery): boolean {
  if (record.tenantId !== input.tenantId) {
    return false;
  }
  if (input.orgId && record.orgId !== input.orgId) {
    return false;
  }
  if (record.workspaceId !== input.workspaceId) {
    return false;
  }
  if (input.repoId && record.repoId !== input.repoId) {
    return false;
  }
  if (input.runId && record.runId !== input.runId) {
    return false;
  }
  if (input.taskId && record.taskId !== input.taskId) {
    return false;
  }
  if (input.kinds && input.kinds.length > 0 && !input.kinds.includes(record.kind)) {
    return false;
  }
  if (input.tags && input.tags.length > 0 && !input.tags.every((tag) => record.tags.includes(tag))) {
    return false;
  }
  return true;
}

type SearchHit = StoredWorkspaceMemoryEntry & { rank: number };

@Injectable()
export class WorkspaceMemoryRepository {
  constructor(private readonly prisma: PrismaService) {}

  async query(input: WorkspaceMemoryQuery): Promise<WorkspaceMemoryRecord[]> {
    const entries = await this.prisma.workspaceMemoryEntry.findMany({
      where: {
        tenantId: input.tenantId,
        workspaceId: input.workspaceId
      },
      orderBy: {
        updatedAt: "desc"
      },
      take: 250
    });

    const latestByRecordId = new Map<string, WorkspaceMemoryRecord>();
    for (const entry of entries) {
      const record = parseStoredEntry(entry as StoredWorkspaceMemoryEntry);
      if (!matchesQuery(record, input)) {
        continue;
      }
      latestByRecordId.set(record.id, record);
    }

    return Array.from(latestByRecordId.values()).sort((left, right) => right.updatedAtIso.localeCompare(left.updatedAtIso));
  }

  /**
   * Full-text search across title, summary, body and tags.
   * Uses Postgres tsvector/tsquery for stemming + ranking.
   * Falls back to empty array if FTS query is invalid (e.g. empty term).
   */
  async search(input: {
    tenantId: string;
    workspaceId: string;
    term: string;
    limit?: number;
    kinds?: WorkspaceMemoryRecord["kind"][];
  }): Promise<Array<WorkspaceMemoryRecord & { rank: number }>> {
    const term = input.term.trim();
    if (!term) return [];

    const limit = input.limit ?? 20;

    // Convert search term to tsquery: "foo bar" → "foo & bar", "foo" → "foo"
    const tokens = term
      .replace(/[^a-zA-Z0-9áéíóúüñÁÉÍÓÚÜÑ\s]/g, " ")
      .trim()
      .split(/\s+/)
      .filter(Boolean);

    if (tokens.length === 0) return [];

    // Each token gets :* for prefix matching — "reparacion:* & techo:*"
    const ftsQuery = tokens.map((t) => `${t}:*`).join(" & ");

    try {
      // Two queries: with and without kinds filter to keep raw SQL simple
      const rows: SearchHit[] = input.kinds && input.kinds.length > 0
        ? await this.prisma.$queryRaw<SearchHit[]>`
            SELECT e.*,
              ts_rank(
                to_tsvector('spanish', coalesce(e.title,'') || ' ' || coalesce(e.summary,'') || ' ' || coalesce(e.body,'')),
                to_tsquery('spanish', ${ftsQuery})
              ) AS rank
            FROM "WorkspaceMemoryEntry" e
            WHERE e."tenantId" = ${input.tenantId}
              AND e."workspaceId" = ${input.workspaceId}
              AND e.kind = ANY(${input.kinds})
              AND to_tsvector('spanish', coalesce(e.title,'') || ' ' || coalesce(e.summary,'') || ' ' || coalesce(e.body,''))
                  @@ to_tsquery('spanish', ${ftsQuery})
            ORDER BY rank DESC
            LIMIT ${limit}
          `
        : await this.prisma.$queryRaw<SearchHit[]>`
            SELECT e.*,
              ts_rank(
                to_tsvector('spanish', coalesce(e.title,'') || ' ' || coalesce(e.summary,'') || ' ' || coalesce(e.body,'')),
                to_tsquery('spanish', ${ftsQuery})
              ) AS rank
            FROM "WorkspaceMemoryEntry" e
            WHERE e."tenantId" = ${input.tenantId}
              AND e."workspaceId" = ${input.workspaceId}
              AND to_tsvector('spanish', coalesce(e.title,'') || ' ' || coalesce(e.summary,'') || ' ' || coalesce(e.body,''))
                  @@ to_tsquery('spanish', ${ftsQuery})
            ORDER BY rank DESC
            LIMIT ${limit}
          `;

      return rows.map((row) => ({
        ...parseStoredEntry(row),
        rank: Number(row.rank)
      }));
    } catch {
      // FTS query syntax error — fall back to empty
      return [];
    }
  }

  async append(record: WorkspaceMemoryRecord): Promise<WorkspaceMemoryRecord> {
    await this.prisma.workspaceMemoryEntry.upsert({
      where: {
        id: record.id
      },
      create: {
        id: record.id,
        tenantId: record.tenantId,
        orgId: record.orgId,
        createdBy: record.createdBy,
        workspaceId: record.workspaceId,
        repoId: record.repoId,
        runId: record.runId,
        taskId: record.taskId,
        kind: record.kind,
        scope: record.scope,
        title: record.title,
        summary: record.summary,
        body: record.body,
        tags: record.tags,
        sourceRef: record.sourceRef
      },
      update: {
        orgId: record.orgId,
        createdBy: record.createdBy,
        repoId: record.repoId,
        runId: record.runId,
        taskId: record.taskId,
        kind: record.kind,
        scope: record.scope,
        title: record.title,
        summary: record.summary,
        body: record.body,
        tags: record.tags,
        sourceRef: record.sourceRef
      }
    });

    return record;
  }
}
