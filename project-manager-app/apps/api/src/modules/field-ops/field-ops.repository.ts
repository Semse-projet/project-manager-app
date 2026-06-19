import { randomUUID } from "node:crypto";
import { Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../../infrastructure/prisma/prisma.service.js";
import { Prisma } from "@prisma/client";
import type { PrismaClient } from "@prisma/client";
import type { TrackerSessionRecord } from "./tracker-session.js";

@Injectable()
export class FieldOpsRepository {
  constructor(private readonly prisma: PrismaService) {}

  private get client(): PrismaClient {
    return this.prisma as unknown as PrismaClient;
  }

  private get trackerSessionDelegate(): {
    findFirst: (...args: unknown[]) => Promise<unknown>;
    findMany: (...args: unknown[]) => Promise<unknown[]>;
    create: (...args: unknown[]) => Promise<unknown>;
    update: (...args: unknown[]) => Promise<unknown>;
  } {
    return (this.client as unknown as Record<string, unknown>).trackerSession as {
      findFirst: (...args: unknown[]) => Promise<unknown>;
      findMany: (...args: unknown[]) => Promise<unknown[]>;
      create: (...args: unknown[]) => Promise<unknown>;
      update: (...args: unknown[]) => Promise<unknown>;
    };
  }

  private readonly trackerSessionSelect = Prisma.sql`
    SELECT
      ts.id,
      ts."tenantId",
      ts."orgId",
      ts."jobId",
      ts."createdBy",
      ts.status::text AS status,
      ts."startedAt",
      ts."resumedAt",
      ts."pausedAt",
      ts."stoppedAt",
      ts."accumulatedSeconds",
      ts.notes,
      ts."createdAt",
      ts."updatedAt",
      json_build_object(
        'id', j.id,
        'title', j.title,
        'status', j.status::text
      ) AS job
    FROM "TrackerSession" ts
    INNER JOIN "Job" j ON j.id = ts."jobId"
  `;

  private mapTrackerSessionRow(row: Record<string, unknown>): TrackerSessionRecord {
    return {
      id: String(row.id),
      tenantId: String(row.tenantId),
      orgId: String(row.orgId),
      jobId: String(row.jobId),
      createdBy: String(row.createdBy),
      status: String(row.status) as TrackerSessionRecord["status"],
      startedAt: row.startedAt as Date,
      resumedAt: (row.resumedAt as Date | null) ?? null,
      pausedAt: (row.pausedAt as Date | null) ?? null,
      stoppedAt: (row.stoppedAt as Date | null) ?? null,
      accumulatedSeconds: Number(row.accumulatedSeconds ?? 0),
      notes: (row.notes as string | null) ?? null,
      createdAt: row.createdAt as Date,
      updatedAt: row.updatedAt as Date,
      job: row.job as TrackerSessionRecord["job"],
    };
  }

  private async queryTrackerSessions(query: Prisma.Sql): Promise<TrackerSessionRecord[]> {
    const rows = await this.client.$queryRaw<Record<string, unknown>[]>(query);
    return rows.map((row: Record<string, unknown>) => this.mapTrackerSessionRow(row));
  }

  private async findTrackerSessionBySql(query: Prisma.Sql): Promise<TrackerSessionRecord | null> {
    const [session] = await this.queryTrackerSessions(query);
    return session ?? null;
  }

  // ── FieldUnit ─────────────────────────────────────────────────────────────

  async listUnits(input: { tenantId: string; projectId?: string; status?: string }) {
    return this.client.fieldUnit.findMany({
      where: {
        tenantId: input.tenantId,
        ...(input.projectId ? { projectId: input.projectId } : {}),
        ...(input.status ? { status: input.status as Prisma.EnumFieldUnitStatusFilter["equals"] } : {}),
      },
      orderBy: { code: "asc" },
    });
  }

  async findUnitById(input: { tenantId: string; fieldUnitId: string }) {
    const unit = await this.client.fieldUnit.findFirst({
      where: { id: input.fieldUnitId, tenantId: input.tenantId },
      include: { worklogs: { orderBy: { date: "desc" }, take: 10 } },
    });
    if (!unit) throw new NotFoundException(`FieldUnit ${input.fieldUnitId} not found`);
    return unit;
  }

  async createUnit(input: {
    tenantId: string;
    projectId: string;
    code: string;
    name?: string;
    address?: string;
  }) {
    return this.client.fieldUnit.create({
      data: {
        tenantId: input.tenantId,
        projectId: input.projectId,
        code: input.code,
        name: input.name,
        address: input.address,
      },
    });
  }

  async updateUnitStatus(input: { tenantId: string; fieldUnitId: string; status: string }) {
    return this.client.fieldUnit.update({
      where: { id: input.fieldUnitId },
      data: { status: input.status as Prisma.EnumFieldUnitStatusFilter["equals"] },
    });
  }

  // ── WorklogEntry ──────────────────────────────────────────────────────────

  async listWorklogs(input: { tenantId: string; fieldUnitId?: string; dateFrom?: Date; dateTo?: Date }) {
    return this.client.worklogEntry.findMany({
      where: {
        tenantId: input.tenantId,
        ...(input.fieldUnitId ? { fieldUnitId: input.fieldUnitId } : {}),
        ...(input.dateFrom || input.dateTo ? {
          date: {
            ...(input.dateFrom ? { gte: input.dateFrom } : {}),
            ...(input.dateTo   ? { lte: input.dateTo   } : {}),
          },
        } : {}),
      },
      orderBy: { date: "desc" },
      include: { fieldUnit: { select: { id: true, code: true, name: true } } },
    });
  }

  async createWorklog(input: {
    tenantId: string;
    fieldUnitId: string;
    date: Date;
    doneToday: string;
    pendingNext: string;
    blockers?: string;
    notes?: string;
    createdBy: string;
  }) {
    return this.client.worklogEntry.create({
      data: {
        tenantId: input.tenantId,
        fieldUnitId: input.fieldUnitId,
        date: input.date,
        doneToday: input.doneToday,
        pendingNext: input.pendingNext,
        blockers: input.blockers,
        notes: input.notes,
        createdBy: input.createdBy,
      },
    });
  }

  // ── Tracker Sessions ──────────────────────────────────────────────────────

  async findJobForTracker(input: { tenantId: string; jobId: string; userId: string }) {
    return this.client.job.findFirst({
      where: {
        id: input.jobId,
        tenantId: input.tenantId,
        deletedAt: null,
        bids: {
          some: {
            professionalUserId: input.userId,
            status: "ACCEPTED",
          },
        },
      },
      select: {
        id: true,
        title: true,
        status: true,
      },
    });
  }

  async listJobsForTracker(input: { tenantId: string; userId: string }) {
    const jobs = await this.client.job.findMany({
      where: {
        tenantId: input.tenantId,
        deletedAt: null,
        bids: {
          some: {
            professionalUserId: input.userId,
            status: "ACCEPTED",
          },
        },
      },
      select: {
        id: true,
        tenantId: true,
        title: true,
        category: true,
        scope: true,
        status: true,
        budgetType: true,
        budgetMin: true,
        budgetMax: true,
        location: true,
        urgency: true,
        deadline: true,
      },
      orderBy: { updatedAt: "desc" },
    });

    return jobs.map((job) => ({
      ...job,
      status: job.status.toLowerCase(),
      budgetMin: job.budgetMin?.toNumber(),
      budgetMax: job.budgetMax?.toNumber(),
    }));
  }

  async findActiveTrackerSession(input: { tenantId: string; createdBy: string }): Promise<TrackerSessionRecord | null> {
    return this.findTrackerSessionBySql(Prisma.sql`
      ${this.trackerSessionSelect}
      WHERE ts."tenantId" = ${input.tenantId}
        AND ts."createdBy" = ${input.createdBy}
        AND ts.status IN ('RUNNING', 'PAUSED')
      ORDER BY ts."updatedAt" DESC
      LIMIT 1
    `);
  }

  async listRecentTrackerSessions(input: { tenantId: string; createdBy: string; limit: number }): Promise<TrackerSessionRecord[]> {
    return this.queryTrackerSessions(Prisma.sql`
      ${this.trackerSessionSelect}
      WHERE ts."tenantId" = ${input.tenantId}
        AND ts."createdBy" = ${input.createdBy}
      ORDER BY ts."startedAt" DESC
      LIMIT ${input.limit}
    `);
  }

  async listTrackerSessions(input: { tenantId: string; createdBy: string; limit: number }): Promise<TrackerSessionRecord[]> {
    return this.queryTrackerSessions(Prisma.sql`
      ${this.trackerSessionSelect}
      WHERE ts."tenantId" = ${input.tenantId}
        AND ts."createdBy" = ${input.createdBy}
      ORDER BY ts."startedAt" DESC
      LIMIT ${input.limit}
    `);
  }

  async findTrackerSessionById(input: { tenantId: string; createdBy: string; sessionId: string }): Promise<TrackerSessionRecord> {
    const session = await this.findTrackerSessionBySql(Prisma.sql`
      ${this.trackerSessionSelect}
      WHERE ts.id = ${input.sessionId}
        AND ts."tenantId" = ${input.tenantId}
        AND ts."createdBy" = ${input.createdBy}
      LIMIT 1
    `);

    if (!session) {
      throw new NotFoundException(`TrackerSession ${input.sessionId} not found`);
    }

    return session;
  }

  async createTrackerSession(input: {
    tenantId: string;
    orgId: string;
    jobId: string;
    createdBy: string;
    startedAt: Date;
    resumedAt: Date | null;
    pausedAt?: Date | null;
    stoppedAt?: Date | null;
    accumulatedSeconds: number;
    notes?: string;
    status: "RUNNING" | "PAUSED" | "STOPPED";
  }): Promise<TrackerSessionRecord> {
    const sessionId = randomUUID();
    const inserted = await this.client.$queryRaw<{ id: string }[]>(Prisma.sql`
      INSERT INTO "TrackerSession" (
        id,
        "tenantId",
        "orgId",
        "jobId",
        "createdBy",
        status,
        "startedAt",
        "resumedAt",
        "pausedAt",
        "stoppedAt",
        "accumulatedSeconds",
        notes
      ) VALUES (
        ${sessionId},
        ${input.tenantId},
        ${input.orgId},
        ${input.jobId},
        ${input.createdBy},
        ${input.status}::"TrackerSessionStatus",
        ${input.startedAt},
        ${input.resumedAt},
        ${input.pausedAt ?? null},
        ${input.stoppedAt ?? null},
        ${input.accumulatedSeconds},
        ${input.notes ?? null}
      )
      RETURNING id
    `);

    return this.findTrackerSessionById({
      tenantId: input.tenantId,
      createdBy: input.createdBy,
      sessionId: inserted[0].id,
    });
  }

  async updateTrackerSession(input: {
    sessionId: string;
    status?: "RUNNING" | "PAUSED" | "STOPPED";
    resumedAt?: Date | null;
    pausedAt?: Date | null;
    stoppedAt?: Date | null;
    accumulatedSeconds?: number;
    notes?: string | null;
  }): Promise<TrackerSessionRecord> {
    const updates: string[] = [];
    const values: unknown[] = [];

    if (input.status !== undefined) {
      values.push(input.status);
      updates.push(`status = $${values.length}::"TrackerSessionStatus"`);
    }
    if (input.resumedAt !== undefined) {
      values.push(input.resumedAt);
      updates.push(`"resumedAt" = $${values.length}`);
    }
    if (input.pausedAt !== undefined) {
      values.push(input.pausedAt);
      updates.push(`"pausedAt" = $${values.length}`);
    }
    if (input.stoppedAt !== undefined) {
      values.push(input.stoppedAt);
      updates.push(`"stoppedAt" = $${values.length}`);
    }
    if (input.accumulatedSeconds !== undefined) {
      values.push(input.accumulatedSeconds);
      updates.push(`"accumulatedSeconds" = $${values.length}`);
    }
    if (input.notes !== undefined) {
      values.push(input.notes);
      updates.push(`notes = $${values.length}`);
    }

    updates.push(`"updatedAt" = NOW()`);
    values.push(input.sessionId);

    await this.client.$executeRawUnsafe(
      `UPDATE "TrackerSession" SET ${updates.join(", ")} WHERE id = $${values.length}`,
      ...values,
    );

    const session = await this.findTrackerSessionBySql(Prisma.sql`
      ${this.trackerSessionSelect}
      WHERE ts.id = ${input.sessionId}
      LIMIT 1
    `);

    if (!session) {
      throw new NotFoundException(`TrackerSession ${input.sessionId} not found`);
    }

    return session;
  }

  // ── Context Memory Entries ────────────────────────────────────────────────

  async listFacts(input: { tenantId: string; subject?: string; predicate?: string }) {
    return this.client.knowledgeFact.findMany({
      where: {
        tenantId: input.tenantId,
        ...(input.subject   ? { subject: { contains: input.subject } } : {}),
        ...(input.predicate ? { predicate: input.predicate } : {}),
      },
      orderBy: { createdAt: "desc" },
      take: 100,
    });
  }

  async createFact(input: {
    tenantId: string;
    subject: string;
    predicate: string;
    object: string;
    confidence?: number;
    worklogId?: string;
    createdBy: string;
  }) {
    return this.client.knowledgeFact.create({
      data: {
        tenantId: input.tenantId,
        subject: input.subject,
        predicate: input.predicate,
        object: input.object,
        confidence: input.confidence ?? 0.7,
        worklogId: input.worklogId,
        createdBy: input.createdBy,
      },
    });
  }

  // ── Vendor ────────────────────────────────────────────────────────────────

  async listVendors(input: { tenantId: string }) {
    return this.client.vendor.findMany({
      where: { tenantId: input.tenantId },
      include: { compliance: true },
      orderBy: { name: "asc" },
    });
  }

  async createVendor(input: {
    tenantId: string;
    name: string;
    phone?: string;
    email?: string;
    notes?: string;
  }) {
    return this.client.vendor.create({
      data: {
        tenantId: input.tenantId,
        name: input.name,
        phone: input.phone,
        email: input.email,
        notes: input.notes,
      },
    });
  }

  async upsertComplianceDoc(input: {
    tenantId: string;
    vendorId: string;
    type: string;
    status: string;
    fileUrl?: string;
    expiresAt?: Date;
    notes?: string;
  }) {
    return this.client.complianceDoc.upsert({
      where: { id: `${input.vendorId}_${input.type}` }, // fallback; handled by create/update pattern
      create: {
        tenantId: input.tenantId,
        vendorId: input.vendorId,
        type: input.type,
        status: input.status as Prisma.EnumComplianceDocStatusFilter["equals"],
        fileUrl: input.fileUrl,
        expiresAt: input.expiresAt,
        notes: input.notes,
      },
      update: {
        status: input.status as Prisma.EnumComplianceDocStatusFilter["equals"],
        fileUrl: input.fileUrl,
        expiresAt: input.expiresAt,
        notes: input.notes,
      },
    });
  }
}
