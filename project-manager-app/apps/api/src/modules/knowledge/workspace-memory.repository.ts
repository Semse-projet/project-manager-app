import { ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";
import type {
  WorkspaceMemoryEpistemicStatus,
  WorkspaceMemoryProvenance,
  WorkspaceMemoryQuery,
  WorkspaceMemoryRecord,
  WorkspaceMemorySensitivity,
  WorkspaceMemoryStatus,
} from "@semse/knowledge";
import { WORKSPACE_SENSITIVITY_RANK } from "@semse/knowledge";
import { PrismaService } from "../../infrastructure/prisma/prisma.service.js";
import { isOpsAdmin } from "../../common/resource-scope.js";

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
    updatedAtIso: entry.updatedAt.toISOString(),
    sensitivity: (entry.sensitivity as WorkspaceMemorySensitivity) ?? "internal",
    epistemicStatus: (entry.epistemicStatus as WorkspaceMemoryEpistemicStatus) ?? "remembered_context",
    confidence: entry.confidence ?? undefined,
    provenance: (entry.provenance as WorkspaceMemoryProvenance | null) ?? undefined,
    subjectType: entry.subjectType ?? undefined,
    subjectId: entry.subjectId ?? undefined,
    status: (entry.status as WorkspaceMemoryStatus) ?? "active",
    supersedesId: entry.supersedesId ?? undefined,
    supersededById: entry.supersededById ?? undefined,
    correctedFromId: entry.correctedFromId ?? undefined,
    conflictsWith: entry.conflictsWith ?? [],
    invalidatedAt: entry.invalidatedAt?.toISOString() ?? undefined,
    invalidatedBy: entry.invalidatedBy ?? undefined,
    invalidationReason: entry.invalidationReason ?? undefined,
    retentionUntil: entry.retentionUntil?.toISOString() ?? undefined,
  };
}

function sensitivityFilter(max?: WorkspaceMemorySensitivity) {
  if (!max) return {};
  const allowed = (Object.keys(WORKSPACE_SENSITIVITY_RANK) as WorkspaceMemorySensitivity[]).filter(
    (s) => WORKSPACE_SENSITIVITY_RANK[s] <= WORKSPACE_SENSITIVITY_RANK[max],
  );
  return { sensitivity: { in: allowed } };
}

function matchesQuery(record: WorkspaceMemoryRecord, input: WorkspaceMemoryQuery): boolean {
  if (record.tenantId !== input.tenantId) {
    return false;
  }
  // C51 (decisión del dueño): `orgId` es provenance del productor, NO un ACL. La memoria del workspace es
  // compartida; quién puede leerla lo decide WorkspaceMemoryAccessPolicy antes de llegar aquí. Por eso
  // `query()` ya no filtra por org (antes difería de `search()`, que nunca lo hizo).
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
        workspaceId: input.workspaceId,
        ...(input.includeInactive ? {} : { status: "active" }),
        ...sensitivityFilter(input.maxSensitivity)
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
   * Unlike query(), NOT scoped to a single workspaceId — for admin-facing
   * views that need to see records across every worker's own workspace at
   * once (e.g. the "Solicitudes de verificación" queue, see
   * AUDIT_REMEDIATION_PLAN.md 2.28). Filters by tenant + every tag in `tags`
   * (AND, matching matchesQuery's semantics) and optionally by kind.
   *
   * C51: reservado a flujos internos/admin EXPLÍCITOS (cola de verificación). No es una
   * lectura general: exige un actor OPS_ADMIN del mismo tenant y falla cerrado si no.
   */
  async queryAcrossTenant(input: {
    actor: { tenantId: string; roles: string[] };
    tenantId: string;
    tags: string[];
    kinds?: WorkspaceMemoryRecord["kind"][];
    limit?: number;
    includeInactive?: boolean;
  }): Promise<WorkspaceMemoryRecord[]> {
    if (!isOpsAdmin(input.actor) || input.actor.tenantId !== input.tenantId || !input.tenantId) {
      throw new ForbiddenException("Cross-workspace memory queries are restricted to OPS_ADMIN of the same tenant");
    }
    const entries = await this.prisma.workspaceMemoryEntry.findMany({
      where: {
        tenantId: input.tenantId,
        tags: { hasEvery: input.tags },
        ...(input.includeInactive ? {} : { status: "active" }),
        ...(input.kinds && input.kinds.length > 0 ? { kind: { in: input.kinds } } : {})
      },
      orderBy: {
        updatedAt: "desc"
      },
      take: input.limit ?? 100
    });

    return entries.map((entry) => parseStoredEntry(entry as StoredWorkspaceMemoryEntry));
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
    maxSensitivity?: WorkspaceMemorySensitivity;
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

    const allowedSensitivities = (Object.keys(WORKSPACE_SENSITIVITY_RANK) as WorkspaceMemorySensitivity[]).filter(
      (s) => WORKSPACE_SENSITIVITY_RANK[s] <= WORKSPACE_SENSITIVITY_RANK[input.maxSensitivity ?? "internal"],
    );

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
              AND e."status" = 'active'
              AND e."sensitivity" = ANY(${allowedSensitivities})
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
              AND e."status" = 'active'
              AND e."sensitivity" = ANY(${allowedSensitivities})
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
        sourceRef: record.sourceRef,
        sensitivity: record.sensitivity ?? "internal",
        epistemicStatus: record.epistemicStatus ?? "remembered_context",
        confidence: record.confidence ?? null,
        provenance: (record.provenance as never) ?? undefined,
        subjectType: record.subjectType ?? null,
        subjectId: record.subjectId ?? null,
        retentionUntil: record.retentionUntil ? new Date(record.retentionUntil) : null
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
        // Governance fields (status/supersession/etc.) are never touched by a
        // plain append() — use correct()/invalidate()/supersede() for those.
      }
    });

    return (await this.findById({ tenantId: record.tenantId, id: record.id }))!;
  }

  // ── C85 governance: read one (tenant-scoped) ─────────────────────────────────

  async findById(input: { tenantId: string; id: string }): Promise<WorkspaceMemoryRecord | null> {
    const row = await this.prisma.workspaceMemoryEntry.findFirst({
      where: { id: input.id, tenantId: input.tenantId }
    });
    return row ? parseStoredEntry(row as StoredWorkspaceMemoryEntry) : null;
  }

  // ── C85 governance: invalidate ───────────────────────────────────────────────

  async invalidate(input: {
    tenantId: string;
    id: string;
    invalidatedBy: string;
    reason: string;
  }): Promise<WorkspaceMemoryRecord> {
    const result = await this.prisma.workspaceMemoryEntry.updateMany({
      where: { id: input.id, tenantId: input.tenantId },
      data: {
        status: "invalidated",
        invalidatedAt: new Date(),
        invalidatedBy: input.invalidatedBy,
        invalidationReason: input.reason
      }
    });
    if (result.count === 0) throw new NotFoundException(`WorkspaceMemoryEntry ${input.id} not found for tenant`);
    return (await this.findById({ tenantId: input.tenantId, id: input.id }))!;
  }

  // ── C85 governance: correct ──────────────────────────────────────────────────
  // Never mutates content in place — the old row is marked `corrected` and a
  // new row carries the fixed content, linked both ways.

  async correct(input: {
    tenantId: string;
    id: string;
    correctedBy: string;
    patch: { title?: string; summary?: string; body?: string; tags?: string[] };
  }): Promise<WorkspaceMemoryRecord> {
    const original = await this.findById({ tenantId: input.tenantId, id: input.id });
    if (!original) throw new NotFoundException(`WorkspaceMemoryEntry ${input.id} not found for tenant`);

    const replacementId = `${original.id}:corrected:${Date.now()}`;
    const replacement: WorkspaceMemoryRecord = {
      ...original,
      id: replacementId,
      title: input.patch.title ?? original.title,
      summary: input.patch.summary ?? original.summary,
      body: input.patch.body ?? original.body,
      tags: input.patch.tags ?? original.tags,
      updatedAtIso: new Date().toISOString(),
      provenance: { producedBy: input.correctedBy, method: "correction", correlationId: original.id },
      status: "active"
    };

    await this.prisma.workspaceMemoryEntry.create({
      data: {
        id: replacement.id,
        tenantId: replacement.tenantId,
        orgId: replacement.orgId,
        createdBy: replacement.createdBy,
        workspaceId: replacement.workspaceId,
        repoId: replacement.repoId,
        runId: replacement.runId,
        taskId: replacement.taskId,
        kind: replacement.kind,
        scope: replacement.scope,
        title: replacement.title,
        summary: replacement.summary,
        body: replacement.body,
        tags: replacement.tags,
        sourceRef: replacement.sourceRef,
        sensitivity: replacement.sensitivity ?? "internal",
        epistemicStatus: replacement.epistemicStatus ?? "remembered_context",
        provenance: replacement.provenance as never,
        subjectType: replacement.subjectType ?? null,
        subjectId: replacement.subjectId ?? null,
        correctedFromId: original.id
      }
    });

    await this.prisma.workspaceMemoryEntry.updateMany({
      where: { id: original.id, tenantId: input.tenantId },
      data: { status: "corrected", supersededById: replacement.id }
    });

    return (await this.findById({ tenantId: input.tenantId, id: replacement.id }))!;
  }

  // ── C85 governance: supersede ────────────────────────────────────────────────

  async supersede(input: { tenantId: string; oldId: string; newId: string }): Promise<void> {
    const [oldResult, newResult] = await Promise.all([
      this.prisma.workspaceMemoryEntry.updateMany({
        where: { id: input.oldId, tenantId: input.tenantId },
        data: { status: "superseded", supersededById: input.newId }
      }),
      this.prisma.workspaceMemoryEntry.updateMany({
        where: { id: input.newId, tenantId: input.tenantId },
        data: { supersedesId: input.oldId }
      })
    ]);
    if (oldResult.count === 0 || newResult.count === 0) {
      throw new NotFoundException("One or both WorkspaceMemoryEntry ids not found for tenant");
    }
  }

  // ── C85 governance: conflicts ─────────────────────────────────────────────────

  async flagConflict(input: { tenantId: string; id: string; conflictsWithId: string }): Promise<void> {
    const [a, b] = await Promise.all([
      this.findById({ tenantId: input.tenantId, id: input.id }),
      this.findById({ tenantId: input.tenantId, id: input.conflictsWithId })
    ]);
    if (!a || !b) throw new NotFoundException("One or both WorkspaceMemoryEntry ids not found for tenant");

    await Promise.all([
      this.prisma.workspaceMemoryEntry.update({
        where: { id: a.id },
        data: { conflictsWith: Array.from(new Set([...(a.conflictsWith ?? []), b.id])) }
      }),
      this.prisma.workspaceMemoryEntry.update({
        where: { id: b.id },
        data: { conflictsWith: Array.from(new Set([...(b.conflictsWith ?? []), a.id])) }
      })
    ]);
  }

  // ── C85 governance: lineage ───────────────────────────────────────────────────

  async getLineage(input: { tenantId: string; id: string }): Promise<WorkspaceMemoryRecord[]> {
    const chain: WorkspaceMemoryRecord[] = [];
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
