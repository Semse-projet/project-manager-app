import { BadRequestException, ForbiddenException, Injectable } from "@nestjs/common";
import { LaborEngineRepository } from "./labor-engine.repository.js";
import { geocodeAddressSafe } from "../../integrations/google-maps.js";
import { distanceMeters, isValidCoordinate } from "../../integrations/geo-distance.js";

// Calendario lunes-domingo / día 1-fin de mes. Usado a propósito por los KPIs
// que se etiquetan como "Esta semana"/"Este mes"/"Semana actual" y por la
// navegación con `weekOffset` (Reportes) — ahí el corte calendario es correcto
// y esperado. NO usar para nada etiquetado como "Últimos N días": ver
// rollingWindowBounds() más abajo (docs/AUDIT_REMEDIATION_PLAN.md 2.12).
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

/**
 * Ventana móvil real de `days` días terminando ahora — NO alineada a
 * calendario. Usada por `listEntries` cuando `range: "week"|"month"` porque
 * la UI etiqueta esos filtros como "Últimos 7 días"/"Últimos 30 días"
 * (page.tsx, RegistrosTab.tsx) y también alimenta el contexto del chat de
 * Cronos (labor-chat.service.ts). Antes esto reutilizaba weekBounds/monthBounds
 * (calendario lunes-domingo / día 1-fin de mes), así que el día 1-2 de cada
 * mes "Últimos 30 días" devolvía solo 1-2 días reales de datos.
 * Ver docs/AUDIT_REMEDIATION_PLAN.md 2.12.
 */
function rollingWindowBounds(days: number): { from: Date; to: Date } {
  const to = new Date();
  const from = new Date(to.getTime() - days * 24 * 60 * 60 * 1000);
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
    latitude?: number;
    longitude?: number;
    description?: string;
  }) {
    if (!params.name?.trim()) throw new BadRequestException("name is required");
    const coords = await this.resolveLocationCoordinates(params.location, params.latitude, params.longitude);
    return this.repo.createFreeProject({
      tenantId: params.tenantId,
      createdBy: params.createdBy,
      name: params.name,
      color: params.color,
      location: params.location,
      description: params.description,
      ...coords,
    });
  }

  async listFreeProjects(tenantId: string, createdBy: string) {
    return this.repo.listFreeProjects(tenantId, createdBy);
  }

  async updateFreeProject(id: string, tenantId: string, data: {
    name?: string;
    color?: string;
    location?: string;
    latitude?: number;
    longitude?: number;
    description?: string;
    status?: string;
  }) {
    // "converted" solo puede llegar por el flujo dedicado POST /free-projects/:id/convert
    // (que exige jobId y setea convertedJobId de forma atómica). Este PATCH genérico no
    // acepta convertedJobId como input, así que aceptar status:"converted" aquí dejaría
    // el proyecto marcado "convertido" sin ningún job real de destino — la UI lo seguiría
    // renderizando como "Convertido a job" sin referencia real.
    // Ver docs/AUDIT_REMEDIATION_PLAN.md 2.16.
    if (data.status === "converted") {
      throw new BadRequestException(
        "status \"converted\" cannot be set directly. Use POST /free-projects/:id/convert instead.",
      );
    }
    const coords = await this.resolveLocationCoordinates(data.location, data.latitude, data.longitude);
    return this.repo.updateFreeProject(id, tenantId, {
      ...(data.name !== undefined && { name: data.name }),
      ...(data.color !== undefined && { color: data.color }),
      ...(data.location !== undefined && { location: data.location }),
      ...(data.description !== undefined && { description: data.description }),
      ...(data.status !== undefined && { status: data.status }),
      ...coords,
    });
  }

  /** Best-effort: manual lat/lng override wins if valid, else geocode `location`. Never throws. */
  private async resolveLocationCoordinates(
    location: string | undefined,
    latitude: number | undefined,
    longitude: number | undefined,
  ): Promise<{ latitude?: number; longitude?: number; locationSource?: "geocoded" | "manual" }> {
    if (latitude !== undefined && longitude !== undefined && isValidCoordinate(latitude, longitude)) {
      return { latitude, longitude, locationSource: "manual" };
    }
    if (location) {
      const geocoded = await geocodeAddressSafe(location);
      if (geocoded?.latitude !== undefined && geocoded.longitude !== undefined) {
        return { latitude: geocoded.latitude, longitude: geocoded.longitude, locationSource: "geocoded" };
      }
    }
    return {};
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
    checkIn?: { latitude: number; longitude: number; method?: string };
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
    await this.assertOwnership(params);
    const checkInFields = await this.resolveCheckIn(params.tenantId, params.jobId, params.freeProjectId, params.checkIn);
    return this.repo.startRealtimeEntry({
      tenantId: params.tenantId,
      orgId: params.orgId,
      createdBy: params.createdBy,
      purpose: params.purpose,
      jobId: params.jobId,
      freeProjectId: params.freeProjectId,
      notes: params.notes,
      contextEntityType: params.contextEntityType,
      contextEntityId: params.contextEntityId,
      clientEventId: params.clientEventId,
      ...checkInFields,
    });
  }

  /** Never blocks the timer/entry on distance — GPS is unreliable indoors. Only records
   * checkIn coordinates + distance to the site (when the site itself has coordinates) for
   * auditing/QualityGuard. Distance is omitted (not zero) when the site has no coordinates. */
  private async resolveCheckIn(
    tenantId: string,
    jobId: string | undefined,
    freeProjectId: string | undefined,
    checkIn: { latitude: number; longitude: number; method?: string } | undefined,
  ): Promise<{
    checkInLatitude?: number;
    checkInLongitude?: number;
    checkInDistanceMeters?: number;
    checkInMethod?: string;
  }> {
    if (!checkIn || !isValidCoordinate(checkIn.latitude, checkIn.longitude)) {
      return {};
    }
    const site = jobId
      ? await this.repo.getJobCoordinates(tenantId, jobId)
      : freeProjectId
        ? await this.repo.getFreeProjectCoordinates(tenantId, freeProjectId)
        : null;
    return {
      checkInLatitude: checkIn.latitude,
      checkInLongitude: checkIn.longitude,
      checkInMethod: checkIn.method,
      ...(site && { checkInDistanceMeters: Math.round(distanceMeters(checkIn, site)) }),
    };
  }

  /** A worker may only log time against a job they're actually assigned to, or a free
   * project they created themselves — jobId/freeProjectId are client-supplied and must
   * not be trusted as-is (see AUDIT_REMEDIATION_PLAN.md 2.9). */
  private async assertOwnership(params: { tenantId: string; orgId: string; createdBy: string; jobId?: string; freeProjectId?: string }) {
    if (params.jobId) {
      const assigned = await this.repo.isJobAssignedToWorker(params.tenantId, params.orgId, params.jobId, params.createdBy);
      if (!assigned) throw new ForbiddenException("This job is not assigned to you.");
    }
    if (params.freeProjectId) {
      const owned = await this.repo.isFreeProjectOwnedByWorker(params.tenantId, params.freeProjectId, params.createdBy);
      if (!owned) throw new ForbiddenException("This project does not belong to you.");
    }
  }

  /** hourlyRate/currency are client-supplied and feed `knownCost` on the admin
   * team-cost KPI (getTeamSummary) unchecked — reject a negative or absurd
   * rate here instead of trusting whatever the worker types in.
   * See AUDIT_REMEDIATION_PLAN.md 2.10. */
  private assertValidRate(hourlyRate?: number, currency?: string) {
    if (hourlyRate !== undefined) {
      const MAX_HOURLY_RATE = 100_000;
      if (!Number.isFinite(hourlyRate) || hourlyRate < 0) {
        throw new BadRequestException("hourlyRate must be a non-negative number");
      }
      if (hourlyRate > MAX_HOURLY_RATE) {
        throw new BadRequestException(`hourlyRate must not exceed ${MAX_HOURLY_RATE}`);
      }
    }
    if (currency !== undefined && !/^[A-Z]{3}$/.test(currency)) {
      throw new BadRequestException("currency must be a 3-letter ISO code (e.g. USD, MXN)");
    }
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

  async adminPauseTimer(id: string, tenantId: string) {
    return this.repo.adminPauseTimeEntry(id, tenantId);
  }

  async adminStopTimer(id: string, tenantId: string, notes?: string) {
    return this.repo.adminStopTimeEntry(id, tenantId, notes);
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
    checkIn?: { latitude: number; longitude: number };
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
      // Cap how long a rolled-over shift may be: a real overnight shift is a
      // handful of hours (22:00-06:00 = 8h); anything past MAX_ROLLOVER_HOURS
      // (e.g. 13:00-09:00 = 20h) is far more likely a reversed/typo'd entry
      // than a real single shift, so it's still rejected rather than silently
      // accepted as a day-long-plus shift.
      const MAX_ROLLOVER_HOURS = 16;
      const rolledOver = new Date(endedAt.getTime() + 24 * 60 * 60 * 1000);
      const rolledOverHours = (rolledOver.getTime() - startedAt.getTime()) / (60 * 60 * 1000);
      if (params.startTime > params.endTime && rolledOverHours <= MAX_ROLLOVER_HOURS) {
        endedAt = rolledOver;
      } else {
        throw new BadRequestException("endTime must be after startTime");
      }
    }
    this.assertValidRate(params.hourlyRate, params.currency);
    await this.assertOwnership(params);
    const checkInFields = await this.resolveCheckIn(
      params.tenantId,
      params.jobId,
      params.freeProjectId,
      params.checkIn ? { ...params.checkIn, method: "manual_tagged" } : undefined,
    );
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
      ...checkInFields,
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
    /**
     * Cuando se manda (p. ej. Reportes navegando semanas con las flechas),
     * ancla explícitamente a la semana calendario N atrás (weekBounds),
     * igual que fetchWeeklySummary — así los registros que ve Reportes para
     * "hace 3 semanas" son los reales de esa semana, no una ventana móvil
     * relativa a hoy. Ver docs/AUDIT_REMEDIATION_PLAN.md 2.13.
     */
    weekOffset?: number;
  }) {
    let from: Date | undefined;
    let to: Date | undefined;

    if (params.weekOffset != null) {
      ({ from, to } = weekBounds(params.weekOffset));
    } else if (params.range === "week") {
      ({ from, to } = rollingWindowBounds(7));
    } else if (params.range === "month") {
      ({ from, to } = rollingWindowBounds(30));
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
    const [activeTimers, team, longEntries, offSiteCheckIns] = await Promise.all([
      this.repo.listActiveEntriesForTenant(tenantId),
      this.repo.getTeamSummary({ tenantId, from, to }),
      this.repo.listLongEntries({ tenantId, from, to, minMinutes: QUALITY_GUARD.longEntryMinutes }),
      this.repo.listOffSiteCheckIns({ tenantId, from, to, minDistanceMeters: QUALITY_GUARD.farFromSiteMeters }),
    ]);

    const now = Date.now();
    const alerts: Array<{
      type: "stale_timer" | "overtime" | "long_entry" | "off_site_checkin";
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

    for (const entry of offSiteCheckIns) {
      const distanceMeters = entry.checkInDistanceMeters ?? 0;
      const distanceLabel = distanceMeters >= 1000 ? `${(distanceMeters / 1000).toFixed(1)}km` : `${distanceMeters}m`;
      alerts.push({
        type: "off_site_checkin",
        severity: distanceMeters >= QUALITY_GUARD.farFromSiteMeters * 2 ? "critical" : "warning",
        workerId: entry.createdBy,
        entryId: entry.id,
        detail: `Check-in a ${distanceLabel} del sitio del job/proyecto — revisa si corresponde.`,
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
  /** Meters — well past GPS noise around the 150m proximity-check-in radius,
   * so this flags a check-in that plausibly happened somewhere else entirely. */
  farFromSiteMeters: 500,
};
