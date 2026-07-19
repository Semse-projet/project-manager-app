import { Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../../infrastructure/prisma/prisma.service.js";
import { Prisma } from "@prisma/client";
import type { PrismaClient } from "@prisma/client";
import type { JobRecordStatus, JobRecordView } from "@semse/schemas";
import type { TrackerSessionRecord } from "./tracker-session.js";

type TimeEntryWithJob = {
  id: string;
  tenantId: string;
  orgId: string;
  createdBy: string;
  jobId: string | null;
  status: string;
  startedAt: Date;
  resumedAt: Date | null;
  pausedAt: Date | null;
  endedAt: Date | null;
  accumulatedSeconds: number;
  notes: string | null;
  createdAt: Date;
  updatedAt: Date;
  job: { id: string; title: string; status: string } | null;
};

@Injectable()
export class FieldOpsRepository {
  constructor(private readonly prisma: PrismaService) {}

  private get client(): PrismaClient {
    return this.prisma as unknown as PrismaClient;
  }

  private readonly timeEntryJobInclude = { job: { select: { id: true, title: true, status: true } } };

  private toTimeEntryStatus(status: TrackerSessionRecord["status"]): string {
    switch (status) {
      case "RUNNING":
        return "running";
      case "PAUSED":
        return "paused";
      case "STOPPED":
        return "completed";
      default:
        return "completed";
    }
  }

  private fromTimeEntryStatus(status: string): TrackerSessionRecord["status"] {
    switch (status) {
      case "running":
        return "RUNNING";
      case "paused":
        return "PAUSED";
      case "completed":
        return "STOPPED";
      default:
        return "STOPPED";
    }
  }

  private mapTimeEntryToTrackerSession(entry: TimeEntryWithJob): TrackerSessionRecord {
    return {
      id: entry.id,
      tenantId: entry.tenantId,
      orgId: entry.orgId,
      jobId: entry.jobId ?? "",
      createdBy: entry.createdBy,
      status: this.fromTimeEntryStatus(entry.status),
      startedAt: entry.startedAt,
      resumedAt: entry.resumedAt,
      pausedAt: entry.pausedAt,
      stoppedAt: entry.endedAt,
      accumulatedSeconds: entry.accumulatedSeconds,
      notes: entry.notes,
      createdAt: entry.createdAt,
      updatedAt: entry.updatedAt,
      job: entry.job ?? { id: entry.jobId ?? "", title: "(deleted job)", status: "unknown" },
    };
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

  private trackerJobAssignmentWhere(input: { orgId: string; userId: string }): Prisma.JobWhereInput[] {
    return [
      {
        bids: {
          some: {
            professionalUserId: input.userId,
            status: "ACCEPTED" as const,
          },
        },
      },
      {
        reservations: {
          some: {
            professionalId: input.userId,
            status: {
              in: ["ACTIVE", "ACCEPTED"],
            },
          },
        },
      },
      {
        reservations: {
          some: {
            professionalOrgId: input.orgId,
            status: {
              in: ["ACTIVE", "ACCEPTED"],
            },
          },
        },
      },
      {
        contract: {
          is: {
            professionalUserId: input.userId,
            deletedAt: null,
          },
        },
      },
      {
        contract: {
          is: {
            professionalOrgId: input.orgId,
            deletedAt: null,
          },
        },
      },
      {
        project: {
          is: {
            assignedProOrgId: input.orgId,
          },
        },
      },
    ];
  }

  async findJobForTracker(input: { tenantId: string; jobId: string; orgId: string; userId: string }) {
    return this.client.job.findFirst({
      where: {
        id: input.jobId,
        tenantId: input.tenantId,
        deletedAt: null,
        OR: this.trackerJobAssignmentWhere(input),
      },
      select: {
        id: true,
        title: true,
        status: true,
      },
    });
  }

  async listJobsForTracker(input: { tenantId: string; orgId: string; userId: string }): Promise<JobRecordView[]> {
    const jobs = await this.client.job.findMany({
      where: {
        tenantId: input.tenantId,
        deletedAt: null,
        OR: this.trackerJobAssignmentWhere(input),
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
      id: job.id,
      tenantId: job.tenantId,
      title: job.title,
      category: job.category ?? undefined,
      scope: job.scope,
      status: job.status.toLowerCase() as JobRecordStatus,
      budgetType: job.budgetType ?? undefined,
      budgetMin: job.budgetMin?.toNumber(),
      budgetMax: job.budgetMax?.toNumber(),
      location: job.location ?? undefined,
      urgency: job.urgency ?? undefined,
      deadline: job.deadline?.toISOString(),
    }));
  }

  async findActiveTrackerSession(input: { tenantId: string; createdBy: string }): Promise<TrackerSessionRecord | null> {
    const entry = await this.client.timeEntry.findFirst({
      where: {
        tenantId: input.tenantId,
        createdBy: input.createdBy,
        purpose: "job_linked",
        status: { in: ["running", "paused"] },
      },
      orderBy: { startedAt: "desc" },
      include: this.timeEntryJobInclude,
    });
    return entry ? this.mapTimeEntryToTrackerSession(entry as TimeEntryWithJob) : null;
  }

  async listRecentTrackerSessions(input: { tenantId: string; createdBy: string; limit: number }): Promise<TrackerSessionRecord[]> {
    const entries = await this.client.timeEntry.findMany({
      where: {
        tenantId: input.tenantId,
        createdBy: input.createdBy,
        purpose: "job_linked",
        status: { in: ["running", "paused", "completed"] },
      },
      orderBy: { startedAt: "desc" },
      take: input.limit,
      include: this.timeEntryJobInclude,
    });
    return entries.map((entry) => this.mapTimeEntryToTrackerSession(entry as TimeEntryWithJob));
  }

  async listTrackerSessions(input: {
    tenantId: string;
    createdBy: string;
    limit: number;
    jobId?: string;
    status?: TrackerSessionRecord["status"];
    startedAfter?: Date;
  }): Promise<TrackerSessionRecord[]> {
    const entries = await this.client.timeEntry.findMany({
      where: {
        tenantId: input.tenantId,
        createdBy: input.createdBy,
        purpose: "job_linked",
        ...(input.status
          ? { status: this.toTimeEntryStatus(input.status) }
          : { status: { in: ["running", "paused", "completed"] } }),
        ...(input.jobId ? { jobId: input.jobId } : {}),
        ...(input.startedAfter ? { startedAt: { gte: input.startedAfter } } : {}),
      },
      orderBy: { startedAt: "desc" },
      take: input.limit,
      include: this.timeEntryJobInclude,
    });
    return entries.map((entry) => this.mapTimeEntryToTrackerSession(entry as TimeEntryWithJob));
  }

  async findTrackerSessionById(input: { tenantId: string; createdBy: string; sessionId: string }): Promise<TrackerSessionRecord> {
    const entry = await this.client.timeEntry.findFirst({
      where: {
        id: input.sessionId,
        tenantId: input.tenantId,
        createdBy: input.createdBy,
        purpose: "job_linked",
      },
      include: this.timeEntryJobInclude,
    });

    if (!entry) {
      throw new NotFoundException(`TimeEntry ${input.sessionId} not found`);
    }

    return this.mapTimeEntryToTrackerSession(entry as TimeEntryWithJob);
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
    const isStopped = input.status === "STOPPED";
    const entry = await this.client.timeEntry.create({
      data: {
        tenantId: input.tenantId,
        orgId: input.orgId,
        createdBy: input.createdBy,
        mode: isStopped ? "manual" : "realtime",
        purpose: "job_linked",
        jobId: input.jobId,
        status: this.toTimeEntryStatus(input.status),
        startedAt: input.startedAt,
        endedAt: input.stoppedAt ?? null,
        resumedAt: input.resumedAt,
        pausedAt: input.pausedAt ?? null,
        breakMinutes: 0,
        durationMinutes: isStopped ? Math.floor(input.accumulatedSeconds / 60) : null,
        accumulatedSeconds: input.accumulatedSeconds,
        hourlyRate: null,
        currency: "MXN",
        location: null,
        notes: input.notes ?? null,
        contextEntityType: "Job",
        contextEntityId: input.jobId,
      },
      include: this.timeEntryJobInclude,
    });

    return this.mapTimeEntryToTrackerSession(entry as TimeEntryWithJob);
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
    const existing = await this.client.timeEntry.findFirst({
      where: { id: input.sessionId },
    });
    if (!existing) {
      throw new NotFoundException(`TimeEntry ${input.sessionId} not found`);
    }

    const data: Record<string, unknown> = {};
    if (input.status !== undefined) data.status = this.toTimeEntryStatus(input.status);
    if (input.resumedAt !== undefined) data.resumedAt = input.resumedAt;
    if (input.pausedAt !== undefined) data.pausedAt = input.pausedAt;
    if (input.stoppedAt !== undefined) data.endedAt = input.stoppedAt;
    if (input.accumulatedSeconds !== undefined) {
      data.accumulatedSeconds = input.accumulatedSeconds;
      if (input.stoppedAt !== undefined || input.status === "STOPPED" || existing.status === "completed") {
        data.durationMinutes = Math.floor(input.accumulatedSeconds / 60);
      }
    }
    if (input.notes !== undefined) data.notes = input.notes;

    const entry = await this.client.timeEntry.update({
      where: { id: input.sessionId },
      data,
      include: this.timeEntryJobInclude,
    });

    return this.mapTimeEntryToTrackerSession(entry as TimeEntryWithJob);
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
