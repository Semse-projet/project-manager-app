import { Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../../infrastructure/prisma/prisma.service.js";
import { randomUUID } from "node:crypto";

export type TimeEntryRecord = {
  id: string;
  tenantId: string;
  orgId: string;
  createdBy: string;
  mode: string;
  purpose: string;
  jobId: string | null;
  freeProjectId: string | null;
  status: string;
  startedAt: Date;
  endedAt: Date | null;
  resumedAt: Date | null;
  pausedAt: Date | null;
  breakMinutes: number;
  durationMinutes: number | null;
  accumulatedSeconds: number;
  hourlyRate: number | null;
  currency: string;
  location: string | null;
  notes: string | null;
  editedBy: string | null;
  editReason: string | null;
  createdAt: Date;
  updatedAt: Date;
};

export type FreeProjectRecord = {
  id: string;
  tenantId: string;
  createdBy: string;
  name: string;
  color: string;
  location: string | null;
  description: string | null;
  status: string;
  convertedJobId: string | null;
  createdAt: Date;
  updatedAt: Date;
};

@Injectable()
export class LaborEngineRepository {
  constructor(private readonly prisma: PrismaService) {}

  // ── TimeEntry ──────────────────────────────────────────────────────────────

  async createTimeEntry(data: {
    tenantId: string;
    orgId: string;
    createdBy: string;
    mode: string;
    purpose: string;
    jobId?: string;
    freeProjectId?: string;
    startedAt: Date;
    endedAt?: Date;
    breakMinutes?: number;
    durationMinutes?: number;
    hourlyRate?: number;
    currency?: string;
    location?: string;
    notes?: string;
  }): Promise<TimeEntryRecord> {
    const now = new Date();
    const duration = data.durationMinutes
      ?? (data.endedAt
        ? Math.max(0, Math.floor((data.endedAt.getTime() - data.startedAt.getTime()) / 60000) - (data.breakMinutes ?? 0))
        : null);

    return this.prisma.timeEntry.create({
      data: {
        id: randomUUID(),
        tenantId: data.tenantId,
        orgId: data.orgId,
        createdBy: data.createdBy,
        mode: data.mode,
        purpose: data.purpose,
        jobId: data.jobId ?? null,
        freeProjectId: data.freeProjectId ?? null,
        status: data.endedAt ? "completed" : "running",
        startedAt: data.startedAt,
        endedAt: data.endedAt ?? null,
        breakMinutes: data.breakMinutes ?? 0,
        durationMinutes: duration,
        accumulatedSeconds: duration ? duration * 60 : 0,
        hourlyRate: data.hourlyRate ? String(data.hourlyRate) as unknown as number : null,
        currency: data.currency ?? "MXN",
        location: data.location ?? null,
        notes: data.notes ?? null,
        createdAt: now,
        updatedAt: now,
      },
    }) as unknown as TimeEntryRecord;
  }

  async startRealtimeEntry(data: {
    tenantId: string;
    orgId: string;
    createdBy: string;
    purpose: string;
    jobId?: string;
    freeProjectId?: string;
    notes?: string;
  }): Promise<TimeEntryRecord> {
    return this.createTimeEntry({
      ...data,
      mode: "realtime",
      startedAt: new Date(),
    });
  }

  async pauseTimeEntry(id: string, tenantId: string, createdBy: string): Promise<TimeEntryRecord> {
    const entry = await this.prisma.timeEntry.findFirst({ where: { id, tenantId, createdBy } });
    if (!entry) throw new NotFoundException("TimeEntry not found");
    const now = new Date();
    const elapsed = entry.status === "running"
      ? Math.max(0, Math.floor((now.getTime() - (entry.resumedAt ?? entry.startedAt).getTime()) / 1000))
      : 0;
    return this.prisma.timeEntry.update({
      where: { id },
      data: {
        status: "paused",
        pausedAt: now,
        accumulatedSeconds: entry.accumulatedSeconds + elapsed,
        updatedAt: now,
      },
    }) as unknown as TimeEntryRecord;
  }

  async resumeTimeEntry(id: string, tenantId: string, createdBy: string): Promise<TimeEntryRecord> {
    const entry = await this.prisma.timeEntry.findFirst({ where: { id, tenantId, createdBy } });
    if (!entry) throw new NotFoundException("TimeEntry not found");
    const now = new Date();
    return this.prisma.timeEntry.update({
      where: { id },
      data: { status: "running", resumedAt: now, pausedAt: null, updatedAt: now },
    }) as unknown as TimeEntryRecord;
  }

  async updateTimeEntryNotes(id: string, tenantId: string, createdBy: string, notes: string): Promise<TimeEntryRecord> {
    const entry = await this.prisma.timeEntry.findFirst({ where: { id, tenantId, createdBy } });
    if (!entry) throw new NotFoundException("TimeEntry not found");
    return this.prisma.timeEntry.update({
      where: { id },
      data: { notes: notes.trim() || null, updatedAt: new Date() },
    }) as unknown as TimeEntryRecord;
  }

  async stopTimeEntry(id: string, tenantId: string, createdBy: string, notes?: string): Promise<TimeEntryRecord> {
    const entry = await this.prisma.timeEntry.findFirst({ where: { id, tenantId, createdBy } });
    if (!entry) throw new NotFoundException("TimeEntry not found");
    const now = new Date();
    const lastResume = entry.resumedAt ?? entry.startedAt;
    const additionalSeconds = entry.status === "running"
      ? Math.floor((now.getTime() - lastResume.getTime()) / 1000)
      : 0;
    const totalSeconds = entry.accumulatedSeconds + additionalSeconds;
    return this.prisma.timeEntry.update({
      where: { id },
      data: {
        status: "completed",
        endedAt: now,
        accumulatedSeconds: totalSeconds,
        durationMinutes: Math.floor(totalSeconds / 60),
        notes: notes?.trim() || entry.notes,
        updatedAt: now,
      },
    }) as unknown as TimeEntryRecord;
  }

  async listTimeEntries(params: {
    tenantId: string;
    createdBy?: string;
    jobId?: string;
    freeProjectId?: string;
    purpose?: string;
    status?: string;
    from?: Date;
    to?: Date;
    limit?: number;
    offset?: number;
  }): Promise<TimeEntryRecord[]> {
    return this.prisma.timeEntry.findMany({
      where: {
        tenantId: params.tenantId,
        ...(params.createdBy && { createdBy: params.createdBy }),
        ...(params.jobId && { jobId: params.jobId }),
        ...(params.freeProjectId && { freeProjectId: params.freeProjectId }),
        ...(params.purpose && { purpose: params.purpose }),
        ...(params.status && { status: params.status }),
        ...(params.from || params.to ? {
          startedAt: {
            ...(params.from && { gte: params.from }),
            ...(params.to && { lte: params.to }),
          },
        } : {}),
      },
      orderBy: { startedAt: "desc" },
      take: params.limit ?? 50,
      skip: params.offset ?? 0,
    }) as unknown as TimeEntryRecord[];
  }

  async getActiveTimeEntry(tenantId: string, createdBy: string): Promise<TimeEntryRecord | null> {
    return this.prisma.timeEntry.findFirst({
      where: { tenantId, createdBy, status: { in: ["running", "paused"] } },
      orderBy: { startedAt: "desc" },
    }) as unknown as TimeEntryRecord | null;
  }

  /** Todos los timers activos del tenant (vista admin multi-worker). */
  async listActiveEntriesForTenant(tenantId: string): Promise<TimeEntryRecord[]> {
    return this.prisma.timeEntry.findMany({
      where: { tenantId, status: { in: ["running", "paused"] } },
      orderBy: { startedAt: "asc" },
    }) as unknown as TimeEntryRecord[];
  }

  /** Horas completadas por worker en un rango (vista admin de equipo). */
  async getTeamSummary(params: { tenantId: string; from: Date; to: Date }): Promise<
    Array<{ workerId: string; totalMinutes: number; totalEntries: number; knownCost: number; minutesWithoutRate: number }>
  > {
    const entries = await this.prisma.timeEntry.findMany({
      where: {
        tenantId: params.tenantId,
        status: "completed",
        startedAt: { gte: params.from, lte: params.to },
      },
      select: { createdBy: true, durationMinutes: true, hourlyRate: true },
    });

    const byWorker = new Map<string, { totalMinutes: number; totalEntries: number; knownCost: number; minutesWithoutRate: number }>();
    for (const entry of entries as Array<{ createdBy: string; durationMinutes: number | null; hourlyRate: unknown }>) {
      const minutes = entry.durationMinutes ?? 0;
      const rate = entry.hourlyRate != null ? parseFloat(String(entry.hourlyRate)) : null;
      const current = byWorker.get(entry.createdBy) ?? { totalMinutes: 0, totalEntries: 0, knownCost: 0, minutesWithoutRate: 0 };
      current.totalMinutes += minutes;
      current.totalEntries += 1;
      if (rate != null && Number.isFinite(rate)) {
        current.knownCost += (minutes / 60) * rate;
      } else {
        current.minutesWithoutRate += minutes;
      }
      byWorker.set(entry.createdBy, current);
    }

    return Array.from(byWorker.entries())
      .map(([workerId, summary]) => ({ workerId, ...summary, knownCost: Math.round(summary.knownCost * 100) / 100 }))
      .sort((a, b) => b.totalMinutes - a.totalMinutes);
  }

  /** Entradas completadas anormalmente largas en un rango (QualityGuard). */
  async listLongEntries(params: { tenantId: string; from: Date; to: Date; minMinutes: number }): Promise<TimeEntryRecord[]> {
    return this.prisma.timeEntry.findMany({
      where: {
        tenantId: params.tenantId,
        status: "completed",
        startedAt: { gte: params.from, lte: params.to },
        durationMinutes: { gte: params.minMinutes },
      },
      orderBy: { durationMinutes: "desc" },
      take: 50,
    }) as unknown as TimeEntryRecord[];
  }

  async getLaborSummary(params: {
    tenantId: string;
    workerId: string;
    from: Date;
    to: Date;
  }): Promise<{ totalMinutes: number; totalEntries: number; byDay: { date: string; minutes: number }[] }> {
    const entries = await this.prisma.timeEntry.findMany({
      where: {
        tenantId: params.tenantId,
        createdBy: params.workerId,
        status: "completed",
        startedAt: { gte: params.from, lte: params.to },
      },
      select: { startedAt: true, durationMinutes: true },
    });

    const byDay: Record<string, number> = {};
    let totalMinutes = 0;
    for (const e of entries) {
      const mins = e.durationMinutes ?? 0;
      totalMinutes += mins;
      const day = e.startedAt.toISOString().slice(0, 10);
      byDay[day] = (byDay[day] ?? 0) + mins;
    }

    return {
      totalMinutes,
      totalEntries: entries.length,
      byDay: Object.entries(byDay).map(([date, minutes]) => ({ date, minutes })).sort((a, b) => a.date.localeCompare(b.date)),
    };
  }

  // ── FreeProject ───────────────────────────────────────────────────────────

  async createFreeProject(data: {
    tenantId: string;
    createdBy: string;
    name: string;
    color?: string;
    location?: string;
    description?: string;
  }): Promise<FreeProjectRecord> {
    const now = new Date();
    return this.prisma.freeProject.create({
      data: {
        id: randomUUID(),
        tenantId: data.tenantId,
        createdBy: data.createdBy,
        name: data.name,
        color: data.color ?? "#3B82F6",
        location: data.location ?? null,
        description: data.description ?? null,
        status: "active",
        createdAt: now,
        updatedAt: now,
      },
    }) as unknown as FreeProjectRecord;
  }

  async listFreeProjects(tenantId: string, createdBy: string): Promise<FreeProjectRecord[]> {
    return this.prisma.freeProject.findMany({
      where: { tenantId, createdBy, status: { not: "archived" } },
      orderBy: { createdAt: "desc" },
    }) as unknown as FreeProjectRecord[];
  }

  async updateFreeProject(id: string, tenantId: string, data: {
    name?: string;
    color?: string;
    location?: string;
    description?: string;
    status?: string;
    convertedJobId?: string;
  }): Promise<FreeProjectRecord> {
    const existing = await this.prisma.freeProject.findFirst({ where: { id, tenantId } });
    if (!existing) throw new NotFoundException("FreeProject not found");
    return this.prisma.freeProject.update({
      where: { id },
      data: { ...data, updatedAt: new Date() },
    }) as unknown as FreeProjectRecord;
  }

  async archiveFreeProject(id: string, tenantId: string): Promise<FreeProjectRecord> {
    return this.updateFreeProject(id, tenantId, { status: "archived" });
  }
}
