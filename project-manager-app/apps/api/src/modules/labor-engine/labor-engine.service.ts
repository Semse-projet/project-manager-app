import { BadRequestException, Injectable } from "@nestjs/common";
import { LaborEngineRepository } from "./labor-engine.repository.js";

function weekBounds(offset = 0): { from: Date; to: Date } {
  const now = new Date();
  const day = now.getDay(); // 0 = Sun
  const monday = new Date(now);
  monday.setDate(now.getDate() - ((day + 6) % 7) + offset * 7);
  monday.setHours(0, 0, 0, 0);
  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);
  sunday.setHours(23, 59, 59, 999);
  return { from: monday, to: sunday };
}

function monthBounds(offset = 0): { from: Date; to: Date } {
  const now = new Date();
  const from = new Date(now.getFullYear(), now.getMonth() + offset, 1);
  const to = new Date(now.getFullYear(), now.getMonth() + offset + 1, 0, 23, 59, 59, 999);
  return { from, to };
}

@Injectable()
export class LaborEngineService {
  constructor(private readonly repo: LaborEngineRepository) {}

  // ── FreeProject ────────────────────────────────────────────────────────────

  async createFreeProject(params: {
    tenantId: string;
    createdBy: string;
    name: string;
    color?: string;
    location?: string;
    description?: string;
  }) {
    if (!params.name?.trim()) throw new BadRequestException("name is required");
    return this.repo.createFreeProject(params);
  }

  async listFreeProjects(tenantId: string, createdBy: string) {
    return this.repo.listFreeProjects(tenantId, createdBy);
  }

  async updateFreeProject(id: string, tenantId: string, data: {
    name?: string;
    color?: string;
    location?: string;
    description?: string;
    status?: string;
  }) {
    return this.repo.updateFreeProject(id, tenantId, data);
  }

  async archiveFreeProject(id: string, tenantId: string) {
    return this.repo.archiveFreeProject(id, tenantId);
  }

  async convertToJob(id: string, tenantId: string, jobId: string) {
    return this.repo.updateFreeProject(id, tenantId, { status: "converted", convertedJobId: jobId });
  }

  // ── TimeEntry — realtime ──────────────────────────────────────────────────

  async startTimer(params: {
    tenantId: string;
    orgId: string;
    createdBy: string;
    purpose: string;
    jobId?: string;
    freeProjectId?: string;
    notes?: string;
    contextEntityType?: string;
    contextEntityId?: string;
    clientEventId?: string;
  }) {
    // Idempotent replay: if this exact client event already produced a TimeEntry
    // (e.g. the tracker's offline sync retried a "start" whose response was lost,
    // or a previously-confirmed batch item got resent), return that entry instead
    // of re-checking "already has an active timer" against a session that IS this one.
    if (params.clientEventId) {
      const existing = await this.repo.findTimeEntryByClientEventId(params.tenantId, params.createdBy, params.clientEventId);
      if (existing) return existing;
    }
    const active = await this.repo.getActiveTimeEntry(params.tenantId, params.createdBy);
    if (active) throw new BadRequestException("Already has an active timer. Stop or pause it first.");
    if (!params.jobId && !params.freeProjectId && params.purpose === "job_linked") {
      throw new BadRequestException("job_linked purpose requires jobId or freeProjectId");
    }
    return this.repo.startRealtimeEntry(params);
  }

  async pauseTimer(id: string, tenantId: string, createdBy: string) {
    return this.repo.pauseTimeEntry(id, tenantId, createdBy);
  }

  async resumeTimer(id: string, tenantId: string, createdBy: string) {
    return this.repo.resumeTimeEntry(id, tenantId, createdBy);
  }

  async stopTimer(id: string, tenantId: string, createdBy: string, notes?: string) {
    return this.repo.stopTimeEntry(id, tenantId, createdBy, notes);
  }

  async updateTimerNotes(id: string, tenantId: string, createdBy: string, notes: string) {
    return this.repo.updateTimeEntryNotes(id, tenantId, createdBy, notes);
  }

  async getActiveTimer(tenantId: string, createdBy: string) {
    return this.repo.getActiveTimeEntry(tenantId, createdBy);
  }

  // ── TimeEntry — manual ────────────────────────────────────────────────────

  async createManualEntry(params: {
    tenantId: string;
    orgId: string;
    createdBy: string;
    purpose: string;
    jobId?: string;
    freeProjectId?: string;
    date: string;
    startTime: string;
    endTime: string;
    breakMinutes?: number;
    hourlyRate?: number;
    currency?: string;
    location?: string;
    notes?: string;
    contextEntityType?: string;
    contextEntityId?: string;
    clientEventId?: string;
  }) {
    const startedAt = new Date(`${params.date}T${params.startTime}:00`);
    let endedAt = new Date(`${params.date}T${params.endTime}:00`);
    if (isNaN(startedAt.getTime()) || isNaN(endedAt.getTime())) {
      throw new BadRequestException("Invalid date/time format");
    }
    if (endedAt <= startedAt) {
      // A shift can legitimately cross midnight (e.g. 22:00-06:00). When the
      // clock time alone makes it look like endTime is before/equal to
      // startTime on the same calendar day, and startTime is later in the
      // day than endTime, treat endedAt as landing on the next calendar day
      // instead of rejecting it or silently producing a negative duration.
      if (params.startTime > params.endTime) {
        endedAt = new Date(endedAt.getTime() + 24 * 60 * 60 * 1000);
      } else {
        throw new BadRequestException("endTime must be after startTime");
      }
    }
    return this.repo.createTimeEntry({
      tenantId: params.tenantId,
      orgId: params.orgId,
      createdBy: params.createdBy,
      mode: "manual",
      purpose: params.purpose,
      jobId: params.jobId,
      freeProjectId: params.freeProjectId,
      startedAt,
      endedAt,
      breakMinutes: params.breakMinutes ?? 0,
      hourlyRate: params.hourlyRate,
      currency: params.currency,
      location: params.location,
      notes: params.notes,
      clientEventId: params.clientEventId,
    });
  }

  // ── Listings & summaries ─────────────────────────────────────────────────

  async listEntries(params: {
    tenantId: string;
    createdBy?: string;
    jobId?: string;
    freeProjectId?: string;
    purpose?: string;
    range?: "week" | "month" | "all";
    limit?: number;
  }) {
    let from: Date | undefined;
    let to: Date | undefined;

    if (params.range === "week") {
      ({ from, to } = weekBounds());
    } else if (params.range === "month") {
      ({ from, to } = monthBounds());
    }

    return this.repo.listTimeEntries({ ...params, from, to, limit: params.limit ?? 50 });
  }

  async getWeeklySummary(tenantId: string, workerId: string, weekOffset = 0) {
    const { from, to } = weekBounds(weekOffset);
    const [current, previous] = await Promise.all([
      this.repo.getLaborSummary({ tenantId, workerId, from, to }),
      this.repo.getLaborSummary({ tenantId, workerId, ...weekBounds(weekOffset - 1) }),
    ]);
    return {
      period: "week",
      from: from.toISOString(),
      to: to.toISOString(),
      totalMinutes: current.totalMinutes,
      totalHours: +(current.totalMinutes / 60).toFixed(2),
      totalEntries: current.totalEntries,
      byDay: current.byDay,
      previousWeekMinutes: previous.totalMinutes,
      changePercent: previous.totalMinutes > 0
        ? +((((current.totalMinutes - previous.totalMinutes) / previous.totalMinutes) * 100).toFixed(1))
        : null,
    };
  }

  async getMonthlySummary(tenantId: string, workerId: string) {
    const { from, to } = monthBounds();
    const result = await this.repo.getLaborSummary({ tenantId, workerId, from, to });
    return {
      period: "month",
      from: from.toISOString(),
      to: to.toISOString(),
      totalMinutes: result.totalMinutes,
      totalHours: +(result.totalMinutes / 60).toFixed(2),
      totalEntries: result.totalEntries,
      byDay: result.byDay,
    };
  }

  // ── Admin / supervisor (multi-worker + QualityGuard) ──────────────────────

  async getAdminOverview(tenantId: string) {
    const { from, to } = weekBounds();
    const [activeTimers, team, longEntries] = await Promise.all([
      this.repo.listActiveEntriesForTenant(tenantId),
      this.repo.getTeamSummary({ tenantId, from, to }),
      this.repo.listLongEntries({ tenantId, from, to, minMinutes: QUALITY_GUARD.longEntryMinutes }),
    ]);

    const now = Date.now();
    const alerts: Array<{
      type: "stale_timer" | "overtime" | "long_entry";
      severity: "warning" | "critical";
      workerId: string;
      entryId?: string;
      detail: string;
    }> = [];

    for (const entry of activeTimers) {
      const anchor = entry.status === "running" ? (entry.resumedAt ?? entry.startedAt) : null;
      const elapsedSeconds = entry.accumulatedSeconds
        + (anchor ? Math.max(0, Math.floor((now - anchor.getTime()) / 1000)) : 0);
      if (elapsedSeconds >= QUALITY_GUARD.staleTimerHours * 3600) {
        alerts.push({
          type: "stale_timer",
          severity: "critical",
          workerId: entry.createdBy,
          entryId: entry.id,
          detail: `Timer ${entry.status === "running" ? "corriendo" : "en pausa"} desde hace ${Math.floor(elapsedSeconds / 3600)}h — posible olvido.`,
        });
      }
    }

    for (const worker of team) {
      if (worker.totalMinutes >= QUALITY_GUARD.overtimeWeekMinutes) {
        alerts.push({
          type: "overtime",
          severity: worker.totalMinutes >= QUALITY_GUARD.overtimeWeekMinutes * 1.25 ? "critical" : "warning",
          workerId: worker.workerId,
          detail: `${(worker.totalMinutes / 60).toFixed(1)}h esta semana — supera el umbral de ${QUALITY_GUARD.overtimeWeekMinutes / 60}h.`,
        });
      }
    }

    for (const entry of longEntries) {
      alerts.push({
        type: "long_entry",
        severity: "warning",
        workerId: entry.createdBy,
        entryId: entry.id,
        detail: `Jornada de ${((entry.durationMinutes ?? 0) / 60).toFixed(1)}h en una sola entrada.`,
      });
    }

    return {
      period: { from: from.toISOString(), to: to.toISOString() },
      activeTimers,
      team,
      alerts,
      thresholds: QUALITY_GUARD,
      generatedAt: new Date().toISOString(),
    };
  }
}

const QUALITY_GUARD = {
  staleTimerHours: 12,
  overtimeWeekMinutes: 48 * 60,
  longEntryMinutes: 12 * 60,
};
