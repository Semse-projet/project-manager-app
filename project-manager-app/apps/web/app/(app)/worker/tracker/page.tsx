"use client";

import Link from "next/link";
import { useLanguage } from "../../../../lib/language-context";
import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { HtmlInCanvasPanel } from "@semse/ui";
import { BarChart3, Bot, Briefcase, Calculator, ChevronDown, Clock, Download, FolderOpen, LayoutDashboard, ListChecks, Pause, Play, Plus, Receipt, ShieldCheck, Square, Timer } from "lucide-react";
import {
  fetchJobContract,
  fetchJobEscrow,
  fetchJobPayments,
  fetchTimeTrackerJobs,
  SemseApiError,
  type JobRecordView,
} from "../../../semse-api";
import {
  createManualEntry,
  elapsedSeconds,
  fetchActiveTimer,
  fetchFreeProjects,
  fetchLaborEntries,
  fetchMonthlySummary,
  fetchWeeklySummary,
  LaborApiError,
  pauseLaborTimer,
  resumeLaborTimer,
  startLaborTimer,
  stopLaborTimer,
  updateLaborTimerNotes,
  type FreeProjectView,
  type MonthlySummaryView,
  type TimeEntryView,
  type WeeklySummaryView,
} from "../../labor-api";
import { NotificationBanner } from "../../../components/notifications/NotificationBanner";
import {
  clearTrackerLocalState,
  createTrackerEventId,
  createTrackerLocalState,
  enqueueTrackerEvent,
  hasTrackerLocalWork,
  markTrackerSyncFailed,
  markTrackerSynced,
  markTrackerSyncing,
  readTrackerLocalState,
  startTrackerLocalSession,
  updateTrackerLocalSession,
  writeTrackerLocalState,
  type TrackerLocalSession,
  type TrackerLocalState,
  type TrackerPendingEvent,
  type TrackerPurpose,
} from "./trackerLocalStore";
import { ResumenTab } from "./sections/ResumenTab";
import { RegistrosTab } from "./sections/RegistrosTab";
import { ProyectosTab } from "./sections/ProyectosTab";
import { ReportesTab } from "./sections/ReportesTab";
import { AsistenteTab } from "./sections/AsistenteTab";

function pad(n: number) {
  return String(Math.floor(n)).padStart(2, "0");
}

function fmtSeconds(s: number) {
  return `${pad(s / 3600)}:${pad((s % 3600) / 60)}:${pad(s % 60)}`;
}

function asNumber(value: unknown): number | undefined {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim().length > 0) {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return undefined;
}

function asString(value: unknown): string | undefined {
  return typeof value === "string" && value.trim().length > 0 ? value : undefined;
}

function formatMoney(value?: number) {
  if (value === undefined) return "—";
  return value.toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  });
}

function formatEntryDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString("es-MX", { day: "2-digit", month: "short", year: "numeric" });
}

function formatEntryRange(entry: TimeEntryView) {
  const startedAt = new Date(entry.startedAt);
  const endedAt = new Date(entry.endedAt ?? entry.pausedAt ?? entry.updatedAt);
  const start = Number.isNaN(startedAt.getTime())
    ? "—"
    : startedAt.toLocaleTimeString("es-MX", { hour: "2-digit", minute: "2-digit" });
  const end = Number.isNaN(endedAt.getTime())
    ? "—"
    : endedAt.toLocaleTimeString("es-MX", { hour: "2-digit", minute: "2-digit" });
  return `${start} – ${end}`;
}

function safeRouteId(value: string | undefined) {
  return value && /^[A-Za-z0-9_-]{1,128}$/.test(value) ? value : "";
}

function elapsedFromLocalSession(session: TrackerLocalSession | null): number {
  if (!session) return 0;
  if (session.status !== "RUNNING") return session.accumulatedSeconds;

  const anchor = session.resumedAt ?? session.startedAt;
  const anchorTime = new Date(anchor).getTime();
  if (Number.isNaN(anchorTime)) return session.accumulatedSeconds;

  return session.accumulatedSeconds + Math.max(0, Math.floor((Date.now() - anchorTime) / 1000));
}

function localStatusToEntryStatus(status: TrackerLocalSession["status"]): TimeEntryView["status"] {
  if (status === "RUNNING") return "running";
  if (status === "PAUSED") return "paused";
  return "completed";
}

function entryStatusToLocalStatus(status: TimeEntryView["status"]): TrackerLocalSession["status"] {
  if (status === "running") return "RUNNING";
  if (status === "paused") return "PAUSED";
  return "STOPPED";
}

function localSessionToEntry(session: TrackerLocalSession): TimeEntryView {
  return {
    id: session.backendSessionId ?? session.id,
    mode: "realtime",
    purpose: session.purpose ?? (session.jobId ? "job_linked" : "personal"),
    jobId: session.jobId ?? null,
    freeProjectId: session.freeProjectId ?? null,
    status: localStatusToEntryStatus(session.status),
    startedAt: session.startedAt,
    endedAt: session.stoppedAt ?? null,
    resumedAt: session.resumedAt ?? null,
    pausedAt: session.pausedAt ?? null,
    breakMinutes: 0,
    durationMinutes: null,
    accumulatedSeconds: session.accumulatedSeconds,
    hourlyRate: null,
    currency: "MXN",
    location: null,
    notes: session.notes ?? null,
    createdAt: session.startedAt,
    updatedAt: session.updatedAt,
  };
}

function entryToLocalSession(entry: TimeEntryView): TrackerLocalSession {
  return {
    id: entry.id,
    backendSessionId: entry.id,
    purpose: entry.purpose,
    jobId: entry.jobId ?? undefined,
    freeProjectId: entry.freeProjectId ?? undefined,
    status: entryStatusToLocalStatus(entry.status),
    startedAt: entry.startedAt,
    resumedAt: entry.resumedAt ?? undefined,
    pausedAt: entry.pausedAt ?? undefined,
    stoppedAt: entry.endedAt ?? undefined,
    accumulatedSeconds: entry.accumulatedSeconds,
    notes: entry.notes ?? undefined,
    updatedAt: entry.updatedAt,
  };
}

function ensureLocalStateForEntry(state: TrackerLocalState, entry: TimeEntryView): TrackerLocalState {
  if (state.activeSession?.id === entry.id || state.activeSession?.backendSessionId === entry.id) return state;
  return {
    ...state,
    activeSession: entryToLocalSession(entry),
  };
}

/**
 * Resolves the real backend TimeEntry id for a queued pause/resume/stop/update_note
 * event during sync. Prefers the id just learned in this same sync pass
 * (sessionIdMap, populated when the matching "start" event is processed above it in
 * the same batch); falls back to the id persisted on the local active session (set once
 * a "start" event is confirmed — see syncPendingEvents), which covers a retry that starts
 * a brand-new batch without the original "start" event in it anymore. Falls back to the
 * raw local session id only if neither is known yet (event ordering issue, or the
 * corresponding "start" never synced).
 */
function resolveSyncedEntryId(sessionId: string, sessionIdMap: Map<string, string>, state: TrackerLocalState): string {
  return (
    sessionIdMap.get(sessionId) ??
    (state.activeSession?.id === sessionId ? state.activeSession.backendSessionId : undefined) ??
    sessionId
  );
}

function isLikelyConnectionError(caught: unknown) {
  return (
    typeof navigator !== "undefined" && !navigator.onLine
  ) || (
    caught instanceof TypeError && caught.message.toLowerCase().includes("fetch")
  );
}

function friendlyConnectionMessage(action: string) {
  return `${action}. Tu tiempo se sigue guardando en este dispositivo y se sincronizará cuando haya conexión.`;
}

function shouldPreserveLocalEvent(caught: unknown) {
  if (isLikelyConnectionError(caught)) return true;
  if (caught instanceof SemseApiError) return caught.status >= 500;
  if (caught instanceof LaborApiError) return caught.status >= 500;
  return false;
}

function manualDurationSeconds(date: string, startTime: string, endTime: string, breakMinutes: number): number | null {
  const startedAt = new Date(`${date}T${startTime}:00`);
  let endedAt = new Date(`${date}T${endTime}:00`);
  if (Number.isNaN(startedAt.getTime()) || Number.isNaN(endedAt.getTime())) {
    return null;
  }
  if (endedAt <= startedAt) {
    // Overnight shift (e.g. 22:00-06:00): mirror the backend's rule (labor-engine.service.ts)
    // and treat endTime as landing on the next calendar day instead of flagging it invalid.
    if (startTime > endTime) {
      endedAt = new Date(endedAt.getTime() + 24 * 60 * 60 * 1000);
    } else {
      return null;
    }
  }
  const gross = Math.floor((endedAt.getTime() - startedAt.getTime()) / 1000);
  const net = gross - Math.max(0, breakMinutes) * 60;
  return net > 0 ? net : null;
}

function csvCell(value: unknown) {
  const text = String(value ?? "");
  return `"${text.replaceAll('"', '""')}"`;
}

function trackerHistoryFileLabel(range: TrackerHistoryRange, target: string) {
  const rangeLabel = range === "week" ? "7d" : range === "month" ? "30d" : "all";
  const targetLabel = target === "all" ? "all" : target.replaceAll(/[^A-Za-z0-9_-]/g, "-").slice(0, 40);
  return `${rangeLabel}-${targetLabel}`;
}

const ENTRY_STATUS_META: Record<string, { label: string; color: string; bg: string }> = {
  running: { label: "Corriendo", color: "#10b981", bg: "rgba(16,185,129,.12)" },
  paused: { label: "En pausa", color: "#f59e0b", bg: "rgba(245,158,11,.12)" },
  completed: { label: "Completada", color: "#64748b", bg: "rgba(100,116,139,.12)" },
  pending_review: { label: "En revisión", color: "#3b82f6", bg: "rgba(59,130,246,.12)" },
  approved: { label: "Aprobada", color: "#059669", bg: "rgba(5,150,105,.12)" },
};

function entryStatusMeta(status: string) {
  return ENTRY_STATUS_META[status] ?? { label: status, color: "#64748b", bg: "rgba(100,116,139,.12)" };
}

type TrackerMode = "job" | "free" | "personal";

const MODE_META: Record<TrackerMode, { label: string; hint: string; purpose: TrackerPurpose; icon: typeof Timer }> = {
  job: { label: "Job real", hint: "Tiempo ligado a un trabajo formal con escrow.", purpose: "job_linked", icon: Briefcase },
  free: { label: "Proyecto libre", hint: "Trabajo propio sin cliente formal (convertible a job).", purpose: "payable", icon: FolderOpen },
  personal: { label: "Solo calcular", hint: "Cuenta tus horas sin asociarlas a nada.", purpose: "personal", icon: Calculator },
};

function modeFromEntry(entry: { purpose?: string; jobId?: string | null; freeProjectId?: string | null } | null): TrackerMode {
  if (!entry) return "job";
  if (entry.jobId) return "job";
  if (entry.freeProjectId) return "free";
  return "personal";
}

type TrackerHistoryRange = "week" | "month" | "all";
type TrackerHistoryStatus = "all" | "running" | "paused" | "completed";

/** "all" | "personal" | `job:<id>` | `free:<id>` */
type TrackerTargetKey = string;

function targetKeyForEntry(entry: TimeEntryView): TrackerTargetKey {
  if (entry.jobId) return `job:${entry.jobId}`;
  if (entry.freeProjectId) return `free:${entry.freeProjectId}`;
  return "personal";
}

function parseTargetKey(key: TrackerTargetKey): { purpose: TrackerPurpose; jobId?: string; freeProjectId?: string } {
  if (key.startsWith("job:")) return { purpose: "job_linked", jobId: key.slice(4) };
  if (key.startsWith("free:")) return { purpose: "payable", freeProjectId: key.slice(5) };
  return { purpose: "personal" };
}

type TrackerTab = "timer" | "resumen" | "registros" | "proyectos" | "reportes" | "asistente";

const TRACKER_TABS: { value: TrackerTab; label: string; icon: typeof Timer }[] = [
  { value: "timer", label: "Timer", icon: Timer },
  { value: "resumen", label: "Resumen", icon: LayoutDashboard },
  { value: "registros", label: "Registros", icon: ListChecks },
  { value: "proyectos", label: "Proyectos", icon: FolderOpen },
  { value: "reportes", label: "Reportes", icon: BarChart3 },
  { value: "asistente", label: "Asistente", icon: Bot },
];

function trackerHistoryStatusLabel(status: TrackerHistoryStatus) {
  return status === "all" ? "Todos los estados" : entryStatusMeta(status).label;
}

function isEntryInHistoryRange(entry: TimeEntryView, range: TrackerHistoryRange) {
  if (range === "all") return true;

  const startedAt = new Date(entry.startedAt).getTime();
  if (Number.isNaN(startedAt)) return false;

  const days = range === "month" ? 30 : 7;
  return Date.now() - startedAt <= days * 24 * 3600 * 1000;
}

export default function WorkerTrackerPage() {
  const { t } = useLanguage();
  const [tab, setTab] = useState<TrackerTab>("timer");
  const [jobs, setJobs] = useState<JobRecordView[]>([]);
  const [freeProjects, setFreeProjects] = useState<FreeProjectView[]>([]);
  const [entries, setEntries] = useState<TimeEntryView[]>([]);
  const [activeEntry, setActiveEntry] = useState<TimeEntryView | null>(null);
  const [mode, setMode] = useState<TrackerMode>("job");
  const [selectedJob, setSelectedJob] = useState("");
  const [selectedFreeProject, setSelectedFreeProject] = useState("");
  const [notes, setNotes] = useState("");
  const [elapsed, setElapsed] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [manualTarget, setManualTarget] = useState<TrackerTargetKey>("personal");
  const [manualDate, setManualDate] = useState(new Date().toISOString().slice(0, 10));
  const [manualStart, setManualStart] = useState("09:00");
  const [manualEnd, setManualEnd] = useState("13:00");
  const [manualBreak, setManualBreak] = useState("0");
  const [manualNotes, setManualNotes] = useState("");
  const [historyRange, setHistoryRange] = useState<TrackerHistoryRange>("week");
  const [historyTarget, setHistoryTarget] = useState<TrackerTargetKey>("all");
  const [historyStatus, setHistoryStatus] = useState<TrackerHistoryStatus>("all");
  const [historyLoading, setHistoryLoading] = useState(false);
  const [escrow, setEscrow] = useState<Record<string, unknown> | null>(null);
  const [payments, setPayments] = useState<Record<string, unknown>[]>([]);
  const [contract, setContract] = useState<Record<string, unknown> | null>(null);
  const [weekSummary, setWeekSummary] = useState<WeeklySummaryView | null>(null);
  const [monthSummary, setMonthSummary] = useState<MonthlySummaryView | null>(null);
  const [trackerLocalState, setTrackerLocalState] = useState<TrackerLocalState>(() => createTrackerLocalState());
  const [isOnline, setIsOnline] = useState(true);
  const [syncNotice, setSyncNotice] = useState<string | null>(null);

  const persistTrackerLocalState = useCallback((nextState: TrackerLocalState) => {
    setTrackerLocalState(nextState);
    if (hasTrackerLocalWork(nextState) || nextState.syncStatus === "failed") {
      writeTrackerLocalState(window.localStorage, nextState);
    } else {
      clearTrackerLocalState(window.localStorage);
    }
  }, []);

  const loadTracker = useCallback(async () => {
    const [nextJobs, nextFreeProjects, nextActive, nextWeek, nextMonth] = await Promise.all([
      fetchTimeTrackerJobs().catch(() => [] as JobRecordView[]),
      fetchFreeProjects().catch(() => [] as FreeProjectView[]),
      fetchActiveTimer().catch(() => null),
      fetchWeeklySummary().catch(() => null),
      fetchMonthlySummary().catch(() => null),
    ]);

    setJobs(nextJobs);
    setFreeProjects(nextFreeProjects);
    setActiveEntry(nextActive);
    setWeekSummary(nextWeek);
    setMonthSummary(nextMonth);
    setElapsed(nextActive ? elapsedSeconds(nextActive) : 0);

    if (nextActive) {
      setMode(modeFromEntry(nextActive));
      if (nextActive.jobId) setSelectedJob(nextActive.jobId);
      if (nextActive.freeProjectId) setSelectedFreeProject(nextActive.freeProjectId);
      setNotes(nextActive.notes ?? "");
    } else {
      setSelectedJob((prev) => prev || nextJobs[0]?.id || "");
      setSelectedFreeProject((prev) => prev || nextFreeProjects[0]?.id || "");
    }
  }, []);

  const syncPendingEvents = useCallback(async (state: TrackerLocalState = trackerLocalState) => {
    if (state.pendingEvents.length === 0 || saving) return;
    if (typeof navigator !== "undefined" && !navigator.onLine) return;

    const syncingState = markTrackerSyncing(state);
    persistTrackerLocalState(syncingState);
    setSyncNotice("Sincronizando horas guardadas localmente...");

    const sessionIdMap = new Map<string, string>();
    // Remaining (unconfirmed) local state, updated after each event succeeds.
    // A failure partway through the batch persists THIS, not the original
    // syncingState — so already-confirmed events are never resent on retry.
    let remainingState = syncingState;

    try {
      for (const event of syncingState.pendingEvents) {
        switch (event.type) {
          case "start": {
            const entry = await startLaborTimer({
              purpose: event.purpose ?? (event.jobId ? "job_linked" : "personal"),
              jobId: event.jobId,
              freeProjectId: event.freeProjectId,
              notes: event.notes,
              clientEventId: event.id,
            });
            sessionIdMap.set(event.localSessionId, entry.id);
            break;
          }
          case "pause": {
            const entryId = resolveSyncedEntryId(event.sessionId, sessionIdMap, remainingState);
            await pauseLaborTimer(entryId);
            break;
          }
          case "resume": {
            const entryId = resolveSyncedEntryId(event.sessionId, sessionIdMap, remainingState);
            await resumeLaborTimer(entryId);
            break;
          }
          case "stop": {
            const entryId = resolveSyncedEntryId(event.sessionId, sessionIdMap, remainingState);
            await stopLaborTimer(entryId, event.notes);
            break;
          }
          case "update_note": {
            const entryId = resolveSyncedEntryId(event.sessionId, sessionIdMap, remainingState);
            await updateLaborTimerNotes(entryId, event.notes);
            break;
          }
          case "manual_session":
            await createManualEntry({
              purpose: event.purpose ?? (event.jobId ? "job_linked" : "personal"),
              jobId: event.jobId,
              freeProjectId: event.freeProjectId,
              date: event.date,
              startTime: event.startTime,
              endTime: event.endTime,
              breakMinutes: event.breakMinutes,
              notes: event.notes,
              clientEventId: event.id,
            });
            break;
        }

        // This event is now confirmed on the backend — prune it from the retry
        // queue right away. If it was the "start" event, also persist the real
        // backend session id onto the local active session so a later retry
        // (a fresh call, with an empty sessionIdMap) can still resolve
        // pause/resume/stop/update_note events for this same session even
        // though the "start" event itself is no longer in the queue to replay.
        remainingState = {
          ...remainingState,
          pendingEvents: remainingState.pendingEvents.filter((pending) => pending.id !== event.id),
          activeSession: event.type === "start" && remainingState.activeSession?.id === event.localSessionId
            ? { ...remainingState.activeSession, backendSessionId: sessionIdMap.get(event.localSessionId) }
            : remainingState.activeSession,
        };
        persistTrackerLocalState(remainingState);
      }

      const syncedState = markTrackerSynced(remainingState);
      persistTrackerLocalState(syncedState);
      setSyncNotice("Sincronización completada. Tus horas ya están protegidas en SEMSE.");
      await loadTracker();
    } catch (caught) {
      const failedState = markTrackerSyncFailed(remainingState, caught instanceof Error ? caught.message : "No se pudo sincronizar el tracker.");
      persistTrackerLocalState(failedState);
      setSyncNotice("No pudimos sincronizar ahora. Seguiremos intentando automáticamente.");
    }
  }, [loadTracker, persistTrackerLocalState, saving, trackerLocalState]);

  const syncPendingEventsRef = useRef(syncPendingEvents);

  useEffect(() => {
    syncPendingEventsRef.current = syncPendingEvents;
  }, [syncPendingEvents]);

  useEffect(() => {
    const storedState = readTrackerLocalState(window.localStorage);
    setTrackerLocalState(storedState);
    setIsOnline(navigator.onLine);

    if (storedState.activeSession && storedState.activeSession.status !== "STOPPED") {
      const recovered = localSessionToEntry(storedState.activeSession);
      setActiveEntry(recovered);
      setMode(modeFromEntry(recovered));
      if (storedState.activeSession.jobId) setSelectedJob(storedState.activeSession.jobId);
      if (storedState.activeSession.freeProjectId) setSelectedFreeProject(storedState.activeSession.freeProjectId);
      setNotes(storedState.activeSession.notes ?? "");
      setElapsed(elapsedFromLocalSession(storedState.activeSession));
      setSyncNotice("Sesión recuperada. Encontramos una jornada guardada localmente.");
    } else if (storedState.pendingEvents.length > 0) {
      setSyncNotice("Hay cambios del tracker pendientes de sincronizar.");
    }

    const handleOnline = () => {
      setIsOnline(true);
      setSyncNotice("Conexión restaurada. Sincronizando cambios pendientes...");
      void syncPendingEventsRef.current(readTrackerLocalState(window.localStorage));
    };
    const handleOffline = () => {
      setIsOnline(false);
      setSyncNotice("Sin conexión. Tu tiempo se sigue guardando en este dispositivo.");
    };

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, []);

  useEffect(() => {
    if (isOnline && trackerLocalState.pendingEvents.length > 0 && trackerLocalState.syncStatus !== "syncing") {
      void syncPendingEvents(trackerLocalState);
    }
  }, [isOnline, syncPendingEvents, trackerLocalState]);

  useEffect(() => {
    const run = async () => {
      setLoading(true);
      setError(null);
      try {
        await loadTracker();
      } catch (caught) {
        setError(caught instanceof Error ? caught.message : "No se pudo cargar el tracker.");
      } finally {
        setLoading(false);
      }
    };

    void run();
  }, [loadTracker]);

  const loadFilteredHistory = useCallback(async () => {
    setHistoryLoading(true);
    setError(null);
    try {
      const target = parseTargetKey(historyTarget === "all" || historyTarget === "personal" ? "" : historyTarget);
      const nextEntries = await fetchLaborEntries({
        range: historyRange,
        jobId: target.jobId,
        freeProjectId: target.freeProjectId,
        purpose: historyTarget === "personal" ? "personal" : undefined,
        limit: 200,
      });
      setEntries(nextEntries);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "No se pudo cargar el historial filtrado.");
    } finally {
      setHistoryLoading(false);
    }
  }, [historyRange, historyTarget]);

  useEffect(() => {
    if (loading) return;
    void loadFilteredHistory();
  }, [loadFilteredHistory, loading]);

  useEffect(() => {
    setElapsed(activeEntry ? elapsedSeconds(activeEntry) : 0);
    if (activeEntry?.status !== "running") return;

    const timer = window.setInterval(() => {
      setElapsed(elapsedSeconds(activeEntry));
    }, 1000);

    return () => window.clearInterval(timer);
  }, [activeEntry]);

  const currentJobId = activeEntry?.jobId ?? (mode === "job" ? selectedJob : "");

  useEffect(() => {
    if (!currentJobId) {
      setEscrow(null);
      setPayments([]);
      setContract(null);
      return;
    }

    const run = async () => {
      try {
        const [escrowResult, paymentsResult, contractResult] = await Promise.all([
          fetchJobEscrow(currentJobId).catch(() => null),
          fetchJobPayments(currentJobId).catch(() => []),
          fetchJobContract(currentJobId).catch(() => null),
        ]);
        setEscrow(escrowResult);
        setPayments(paymentsResult);
        setContract(contractResult);
      } catch {
        setEscrow(null);
        setPayments([]);
        setContract(null);
      }
    };

    void run();
  }, [currentJobId]);

  const currentJobRouteId = safeRouteId(currentJobId);
  const currentJob = jobs.find((job) => job.id === currentJobId) ?? null;
  const currentFreeProject = freeProjects.find((project) => project.id === (activeEntry?.freeProjectId ?? selectedFreeProject)) ?? null;
  const releasedAmount = payments.reduce((sum, item) => sum + (asString(item.type) === "RELEASE" ? asNumber(item.amount) ?? 0 : 0), 0);
  const fundedAmount = asNumber(escrow?.totalAmount);

  const entryTitle = useCallback((entry: TimeEntryView) => {
    if (entry.jobId) {
      return jobs.find((job) => job.id === entry.jobId)?.title ?? "Trabajo formal";
    }
    if (entry.freeProjectId) {
      return freeProjects.find((project) => project.id === entry.freeProjectId)?.name ?? "Proyecto libre";
    }
    return "Horas personales";
  }, [freeProjects, jobs]);

  const activeTitle = activeEntry ? entryTitle(activeEntry) : null;

  const entryElapsed = useCallback((entry: TimeEntryView) => (
    activeEntry?.id === entry.id ? elapsed : elapsedSeconds(entry)
  ), [activeEntry?.id, elapsed]);

  const displayedWeekSeconds = (weekSummary?.totalMinutes ?? 0) * 60 + (activeEntry ? elapsed : 0);
  const displayedMonthSeconds = (monthSummary?.totalMinutes ?? 0) * 60 + (activeEntry ? elapsed : 0);
  const daysWorkedThisWeek = weekSummary?.byDay.filter((day) => day.minutes > 0).length ?? 0;

  const filteredEntries = useMemo(() => entries.filter((entry) => {
    if (!isEntryInHistoryRange(entry, historyRange)) return false;
    if (historyStatus !== "all" && entry.status !== historyStatus) return false;
    if (historyTarget === "all") return true;
    return targetKeyForEntry(entry) === historyTarget;
  }), [entries, historyRange, historyStatus, historyTarget]);

  const filteredEntrySeconds = filteredEntries.reduce((sum, entry) => sum + entryElapsed(entry), 0);
  const filteredStatusCounts = filteredEntries.reduce<Record<TrackerHistoryStatus, number>>((counts, entry) => {
    if (entry.status === "running" || entry.status === "paused" || entry.status === "completed") {
      counts[entry.status] += 1;
    }
    return counts;
  }, { all: 0, running: 0, paused: 0, completed: 0 });
  const filteredEntriesLabel = historyRange === "week"
    ? "Últimos 7 días"
    : historyRange === "month"
      ? "Últimos 30 días"
      : "Todo el historial cargado";

  const recentNotes = useMemo(() => entries.filter((entry) => entry.notes?.trim()).slice(0, 4), [entries]);
  const weekByDay = weekSummary?.byDay ?? [];
  const maxDayMinutes = weekByDay.reduce((max, day) => Math.max(max, day.minutes), 0);

  const manualBreakMinutes = Math.max(0, Number.parseInt(manualBreak, 10) || 0);
  const manualPreviewSeconds = manualDurationSeconds(manualDate, manualStart, manualEnd, manualBreakMinutes);
  const pendingEventCount = trackerLocalState.pendingEvents.length;

  const startDisabled = saving
    || (mode === "job" && !selectedJob)
    || (mode === "free" && !selectedFreeProject);

  const syncBanner = useMemo(() => {
    if (!isOnline) {
      return {
        tone: "warning" as const,
        title: "Sin conexión",
        message: "Tu tiempo se sigue guardando en este dispositivo. SEMSE sincronizará los cambios cuando vuelva la señal.",
      };
    }
    if (trackerLocalState.syncStatus === "syncing") {
      return {
        tone: "info" as const,
        title: "Sincronizando",
        message: "Estamos enviando a SEMSE los cambios guardados localmente.",
      };
    }
    if (trackerLocalState.syncStatus === "failed") {
      return {
        tone: "danger" as const,
        title: "Sincronización pendiente",
        message: trackerLocalState.lastError
          ? `No pudimos sincronizar ahora: ${trackerLocalState.lastError}`
          : "No pudimos sincronizar ahora. Seguiremos intentando automáticamente.",
      };
    }
    if (pendingEventCount > 0) {
      return {
        tone: "warning" as const,
        title: "Cambios pendientes",
        message: `${pendingEventCount} ${pendingEventCount === 1 ? "acción está" : "acciones están"} guardadas localmente y pendientes de sincronizar.`,
      };
    }
    if (syncNotice) {
      return {
        tone: "success" as const,
        title: "Tracker protegido",
        message: syncNotice,
      };
    }
    return null;
  }, [isOnline, pendingEventCount, syncNotice, trackerLocalState.lastError, trackerLocalState.syncStatus]);

  async function refreshAfterMutation() {
    await loadTracker();
    await loadFilteredHistory();
    setShowForm(false);
    setManualNotes("");
  }

  async function handleStart() {
    if (startDisabled) return;
    if (activeEntry || trackerLocalState.activeSession) {
      setError("Ya hay una sesión activa. Pausa o detén la sesión actual antes de iniciar otra.");
      return;
    }
    setSaving(true);
    setError(null);
    const purpose = MODE_META[mode].purpose;
    const jobId = mode === "job" ? selectedJob : undefined;
    const freeProjectId = mode === "free" ? selectedFreeProject : undefined;
    const localStart = startTrackerLocalSession(readTrackerLocalState(window.localStorage), {
      purpose,
      jobId,
      jobTitle: jobId ? jobs.find((job) => job.id === jobId)?.title : undefined,
      freeProjectId,
      freeProjectName: freeProjectId ? freeProjects.find((project) => project.id === freeProjectId)?.name : undefined,
      notes,
    });
    persistTrackerLocalState(localStart.state);
    setActiveEntry(localSessionToEntry(localStart.localSession));
    setElapsed(0);
    try {
      const entry = await startLaborTimer({ purpose, jobId, freeProjectId, notes: notes.trim() || undefined, clientEventId: localStart.event.id });
      const remainingEvents = localStart.state.pendingEvents.filter((event) => event.id !== localStart.event.id);
      persistTrackerLocalState({
        ...localStart.state,
        activeSession: null,
        pendingEvents: remainingEvents,
        syncStatus: remainingEvents.length > 0 ? "pending" : "synced",
        lastSyncedAt: new Date().toISOString(),
        lastError: undefined,
      });
      setActiveEntry(entry);
      await refreshAfterMutation();
    } catch (caught) {
      if (shouldPreserveLocalEvent(caught)) {
        setSyncNotice(friendlyConnectionMessage("No pudimos iniciar en SEMSE ahora"));
      } else {
        const cleanState = markTrackerSynced(localStart.state);
        persistTrackerLocalState(cleanState);
        setActiveEntry(null);
        setElapsed(0);
        setError(caught instanceof Error ? caught.message : "No se pudo iniciar la sesión.");
      }
    } finally {
      setSaving(false);
    }
  }

  async function handlePause() {
    if (!activeEntry || saving) return;
    setSaving(true);
    setError(null);
    const localTimestamp = new Date().toISOString();
    const event: TrackerPendingEvent = {
      id: createTrackerEventId(),
      type: "pause",
      sessionId: activeEntry.id,
      notes,
      localTimestamp,
    };
    try {
      const entry = await pauseLaborTimer(activeEntry.id);
      setActiveEntry(entry);
      await refreshAfterMutation();
    } catch (caught) {
      if (shouldPreserveLocalEvent(caught)) {
        const baseState = ensureLocalStateForEntry(readTrackerLocalState(window.localStorage), activeEntry);
        const nextState = updateTrackerLocalSession(baseState, event);
        persistTrackerLocalState(nextState);
        if (nextState.activeSession) {
          setActiveEntry(localSessionToEntry(nextState.activeSession));
        }
        setSyncNotice(friendlyConnectionMessage("No pudimos pausar en SEMSE ahora"));
      } else {
        setError(caught instanceof Error ? caught.message : "No se pudo pausar la sesión.");
      }
    } finally {
      setSaving(false);
    }
  }

  async function handleResume() {
    if (!activeEntry || saving) return;
    setSaving(true);
    setError(null);
    const localTimestamp = new Date().toISOString();
    const event: TrackerPendingEvent = {
      id: createTrackerEventId(),
      type: "resume",
      sessionId: activeEntry.id,
      notes,
      localTimestamp,
    };
    try {
      const entry = await resumeLaborTimer(activeEntry.id);
      setActiveEntry(entry);
      await refreshAfterMutation();
    } catch (caught) {
      if (shouldPreserveLocalEvent(caught)) {
        const baseState = ensureLocalStateForEntry(readTrackerLocalState(window.localStorage), activeEntry);
        const nextState = updateTrackerLocalSession(baseState, event);
        persistTrackerLocalState(nextState);
        if (nextState.activeSession) {
          setActiveEntry(localSessionToEntry(nextState.activeSession));
        }
        setSyncNotice(friendlyConnectionMessage("No pudimos reanudar en SEMSE ahora"));
      } else {
        setError(caught instanceof Error ? caught.message : "No se pudo reanudar la sesión.");
      }
    } finally {
      setSaving(false);
    }
  }

  async function handleStop() {
    if (!activeEntry || saving) return;
    setSaving(true);
    setError(null);
    const localTimestamp = new Date().toISOString();
    const event: TrackerPendingEvent = {
      id: createTrackerEventId(),
      type: "stop",
      sessionId: activeEntry.id,
      notes,
      localTimestamp,
    };
    try {
      await stopLaborTimer(activeEntry.id, notes.trim() || undefined);
      setNotes("");
      setActiveEntry(null);
      await refreshAfterMutation();
    } catch (caught) {
      if (shouldPreserveLocalEvent(caught)) {
        const baseState = ensureLocalStateForEntry(readTrackerLocalState(window.localStorage), activeEntry);
        const nextState = updateTrackerLocalSession(baseState, event);
        persistTrackerLocalState(nextState);
        setNotes("");
        setActiveEntry(null);
        setSyncNotice(friendlyConnectionMessage("No pudimos detener en SEMSE ahora"));
      } else {
        setError(caught instanceof Error ? caught.message : "No se pudo detener la sesión.");
      }
    } finally {
      setSaving(false);
    }
  }

  async function handleSaveActiveNote() {
    if (!activeEntry || saving) return;
    setSaving(true);
    setError(null);
    const event: TrackerPendingEvent = {
      id: createTrackerEventId(),
      type: "update_note",
      sessionId: activeEntry.id,
      notes,
      localTimestamp: new Date().toISOString(),
    };
    try {
      const entry = await updateLaborTimerNotes(activeEntry.id, notes);
      setActiveEntry(entry);
      await loadTracker();
    } catch (caught) {
      if (shouldPreserveLocalEvent(caught)) {
        const baseState = ensureLocalStateForEntry(readTrackerLocalState(window.localStorage), activeEntry);
        const nextState = updateTrackerLocalSession(baseState, event);
        persistTrackerLocalState(nextState);
        if (nextState.activeSession) {
          setActiveEntry(localSessionToEntry(nextState.activeSession));
        }
        setSyncNotice(friendlyConnectionMessage("No pudimos guardar la nota en SEMSE ahora"));
      } else {
        setError(caught instanceof Error ? caught.message : "No se pudo guardar la nota.");
      }
    } finally {
      setSaving(false);
    }
  }

  async function handleManualSave() {
    if (saving) return;
    if (manualPreviewSeconds === null) {
      setError("La entrada manual necesita una hora final posterior a la hora inicial (descontando el descanso).");
      return;
    }
    const target = parseTargetKey(manualTarget);
    setSaving(true);
    setError(null);
    const localTimestamp = new Date().toISOString();
    const event: TrackerPendingEvent = {
      id: createTrackerEventId(),
      type: "manual_session",
      purpose: target.purpose,
      jobId: target.jobId,
      freeProjectId: target.freeProjectId,
      date: manualDate,
      startTime: manualStart,
      endTime: manualEnd,
      breakMinutes: manualBreakMinutes,
      notes: manualNotes,
      localTimestamp,
    };
    try {
      await createManualEntry({
        purpose: target.purpose,
        jobId: target.jobId,
        freeProjectId: target.freeProjectId,
        date: manualDate,
        startTime: manualStart,
        endTime: manualEnd,
        breakMinutes: manualBreakMinutes,
        notes: manualNotes.trim() || undefined,
        clientEventId: event.id,
      });
      await refreshAfterMutation();
    } catch (caught) {
      if (shouldPreserveLocalEvent(caught)) {
        const nextState = enqueueTrackerEvent(readTrackerLocalState(window.localStorage), event);
        persistTrackerLocalState(nextState);
        setShowForm(false);
        setManualNotes("");
        setSyncNotice(friendlyConnectionMessage("No pudimos guardar la entrada manual en SEMSE ahora"));
      } else {
        setError(caught instanceof Error ? caught.message : "No se pudo guardar la entrada manual.");
      }
    } finally {
      setSaving(false);
    }
  }

  function handleExportHistoryCsv() {
    if (filteredEntries.length === 0) return;

    const rows = [
      ["entry_id", "mode", "purpose", "target", "status", "started_at", "ended_at", "break_minutes", "duration_seconds", "duration_hhmmss", "notes"],
      ...filteredEntries.map((entry) => [
        entry.id,
        entry.mode,
        entry.purpose,
        entryTitle(entry),
        entry.status,
        entry.startedAt,
        entry.endedAt ?? entry.pausedAt ?? entry.updatedAt,
        String(entry.breakMinutes),
        String(entryElapsed(entry)),
        fmtSeconds(entryElapsed(entry)),
        entry.notes ?? "",
      ]),
    ];
    const csv = rows.map((row) => row.map(csvCell).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `semse-labor-tracker-${trackerHistoryFileLabel(historyRange, historyTarget)}.csv`;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    URL.revokeObjectURL(url);
  }

  const card: CSSProperties = {
    background: "var(--surface)",
    border: "1px solid var(--border)",
    borderRadius: "14px",
    padding: "20px",
  };

  const activeStatusMeta = activeEntry ? entryStatusMeta(activeEntry.status) : null;

  return (
    <div style={{ maxWidth: "980px", margin: "0 auto", display: "grid", gap: "18px" }}>
      <HtmlInCanvasPanel as="section" style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12 }} canvasClassName="rounded-2xl" minHeight={90}>
        <div>
          <Link href="/worker/dashboard" style={{ display: "inline-flex", alignItems: "center", gap: "5px", color: "var(--muted)", fontSize: "12px", fontWeight: 600, textDecoration: "none", marginBottom: "8px" }}><span style={{ fontSize: "14px" }}>←</span> Dashboard</Link>
          <h1 style={{ fontSize: "22px", fontWeight: 800, color: "var(--ink)", marginBottom: "4px" }}>{t("page.timeTracker")}</h1>
          <p style={{ fontSize: "13px", color: "var(--muted)" }}>
            Registra tiempo en jobs reales, proyectos libres o solo para ti. Si sales de la web, el tiempo sigue corriendo hasta pausar o detener.
          </p>
        </div>
        <NotificationBanner audience="worker" />
      </HtmlInCanvasPanel>

      <div
        data-testid="tracker-tabs"
        style={{
          display: "flex",
          gap: "6px",
          flexWrap: "wrap",
          background: "var(--surface)",
          border: "1px solid var(--border)",
          borderRadius: "12px",
          padding: "6px",
        }}
      >
        {TRACKER_TABS.map((item) => {
          const active = tab === item.value;
          return (
            <button
              key={item.value}
              type="button"
              data-testid={`tracker-tab-${item.value}`}
              onClick={() => setTab(item.value)}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "7px",
                flex: "1 1 auto",
                justifyContent: "center",
                padding: "9px 14px",
                borderRadius: "9px",
                border: "none",
                background: active ? "var(--brand)" : "transparent",
                color: active ? "#fff" : "var(--muted)",
                fontSize: "12px",
                fontWeight: 700,
                cursor: "pointer",
              }}
            >
              <item.icon size={14} />
              {item.label}
              {item.value === "timer" && activeEntry ? (
                <span
                  style={{
                    width: "7px",
                    height: "7px",
                    borderRadius: "999px",
                    background: activeEntry.status === "running" ? "#10b981" : "#f59e0b",
                    boxShadow: activeEntry.status === "running" ? "0 0 0 3px rgba(16,185,129,.25)" : "none",
                  }}
                />
              ) : null}
            </button>
          );
        })}
      </div>

      {syncBanner ? (
        <div data-testid="tracker-sync-banner" style={syncBannerStyle(syncBanner.tone)}>
          <strong style={{ color: "var(--ink)", fontSize: "13px" }}>{syncBanner.title}</strong>
          <span style={{ color: "var(--muted)", fontSize: "13px", lineHeight: 1.45 }}>{syncBanner.message}</span>
          {isOnline && pendingEventCount > 0 && trackerLocalState.syncStatus !== "syncing" ? (
            <button
              type="button"
              onClick={() => void syncPendingEvents(readTrackerLocalState(window.localStorage))}
              disabled={saving}
              style={{ ...linkButton(), marginLeft: "auto" }}
            >
              Reintentar ahora
            </button>
          ) : null}
        </div>
      ) : null}

      {error ? (
        <div style={{ ...syncBannerStyle("danger"), color: "#b91c1c" }}>
          <strong style={{ fontSize: "13px" }}>Acción no completada</strong>
          <span style={{ fontSize: "13px", lineHeight: 1.45 }}>{error}</span>
        </div>
      ) : null}

      {tab === "resumen" ? <ResumenTab jobs={jobs} /> : null}
      {tab === "registros" ? <RegistrosTab jobs={jobs} /> : null}
      {tab === "proyectos" ? <ProyectosTab jobs={jobs} /> : null}
      {tab === "reportes" ? <ReportesTab jobs={jobs} /> : null}
      {tab === "asistente" ? <AsistenteTab /> : null}

      <div style={{ display: tab === "timer" ? "grid" : "none", gap: "18px" }}>
      <HtmlInCanvasPanel as="section" style={{ ...card, textAlign: "center" }} canvasClassName="rounded-2xl" minHeight={340}>
        <div
          data-testid="tracker-elapsed"
          style={{
            fontSize: "52px",
            fontWeight: 800,
            fontVariantNumeric: "tabular-nums",
            color: activeEntry?.status === "running" ? "var(--brand)" : "var(--ink)",
            letterSpacing: "0.05em",
            marginBottom: "8px",
            fontFamily: "'Geist Mono', 'JetBrains Mono', monospace",
          }}
        >
          {fmtSeconds(elapsed)}
        </div>

        <p style={{ fontSize: "13px", color: "var(--muted)", marginBottom: "18px" }}>
          {activeEntry && activeStatusMeta
            ? `${activeStatusMeta.label}: ${activeTitle}`
            : "Elige el modo, selecciona el destino y presiona Iniciar"}
        </p>

        {!activeEntry ? (
          <div data-testid="tracker-mode-selector" style={{ display: "flex", justifyContent: "center", gap: "8px", flexWrap: "wrap", marginBottom: "16px" }}>
            {(Object.keys(MODE_META) as TrackerMode[]).map((value) => {
              const meta = MODE_META[value];
              const active = mode === value;
              return (
                <button
                  key={value}
                  type="button"
                  data-testid={`tracker-mode-${value}`}
                  onClick={() => setMode(value)}
                  title={meta.hint}
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: "7px",
                    padding: "9px 16px",
                    borderRadius: "10px",
                    border: active ? "1px solid var(--brand)" : "1px solid var(--border)",
                    background: active ? "var(--brand)" : "var(--bg)",
                    color: active ? "#fff" : "var(--muted)",
                    fontSize: "12px",
                    fontWeight: 700,
                    cursor: "pointer",
                  }}
                >
                  <meta.icon size={14} />
                  {meta.label}
                </button>
              );
            })}
          </div>
        ) : null}

        {!activeEntry && mode === "job" ? (
          <div style={{ marginBottom: "16px", maxWidth: "420px", marginInline: "auto" }}>
            {jobs.length === 0 && !loading ? (
              <div style={{ display: "grid", gap: "10px", justifyItems: "center" }}>
                <p style={{ fontSize: "13px", color: "var(--muted)", margin: 0 }}>Aún no tienes trabajos aceptados para registrar tiempo.</p>
                <Link href="/worker/opportunities" style={linkButton()}>
                  Buscar oportunidades
                </Link>
              </div>
            ) : (
              <div style={{ position: "relative" }}>
                <select
                  data-testid="tracker-job-select"
                  value={selectedJob}
                  onChange={(event) => setSelectedJob(event.target.value)}
                  style={{
                    width: "100%",
                    padding: "10px 36px 10px 14px",
                    borderRadius: "8px",
                    border: "1px solid var(--border)",
                    background: "var(--bg)",
                    color: "var(--ink)",
                    fontSize: "13px",
                    appearance: "none",
                    cursor: "pointer",
                    outline: "none",
                  }}
                >
                  {jobs.length === 0 ? (
                    <option value="">Sin trabajos aceptados</option>
                  ) : null}
                  {jobs.map((job) => (
                    <option key={job.id} value={job.id}>
                      {job.title}
                    </option>
                  ))}
                </select>
                <ChevronDown
                  size={14}
                  style={{
                    position: "absolute",
                    right: "12px",
                    top: "50%",
                    transform: "translateY(-50%)",
                    color: "var(--muted)",
                    pointerEvents: "none",
                  }}
                />
              </div>
            )}
          </div>
        ) : null}

        {!activeEntry && mode === "free" ? (
          <div style={{ marginBottom: "16px", maxWidth: "420px", marginInline: "auto" }}>
            {freeProjects.length === 0 && !loading ? (
              <div style={{ display: "grid", gap: "10px", justifyItems: "center" }}>
                <p style={{ fontSize: "13px", color: "var(--muted)", margin: 0 }}>Aún no tienes proyectos libres.</p>
                <button type="button" onClick={() => setTab("proyectos")} style={linkButton()}>
                  <Plus size={12} /> Crear proyecto libre
                </button>
              </div>
            ) : (
              <div style={{ position: "relative" }}>
                <select
                  data-testid="tracker-free-project-select"
                  value={selectedFreeProject}
                  onChange={(event) => setSelectedFreeProject(event.target.value)}
                  style={{
                    width: "100%",
                    padding: "10px 36px 10px 14px",
                    borderRadius: "8px",
                    border: "1px solid var(--border)",
                    background: "var(--bg)",
                    color: "var(--ink)",
                    fontSize: "13px",
                    appearance: "none",
                    cursor: "pointer",
                    outline: "none",
                  }}
                >
                  {freeProjects.map((project) => (
                    <option key={project.id} value={project.id}>
                      {project.name}
                    </option>
                  ))}
                </select>
                <ChevronDown
                  size={14}
                  style={{
                    position: "absolute",
                    right: "12px",
                    top: "50%",
                    transform: "translateY(-50%)",
                    color: "var(--muted)",
                    pointerEvents: "none",
                  }}
                />
              </div>
            )}
          </div>
        ) : null}

        {!activeEntry && mode === "personal" ? (
          <p style={{ fontSize: "12px", color: "var(--muted)", marginBottom: "16px" }}>
            Estas horas quedan solo para tu control personal. No se asocian a jobs ni pagos.
          </p>
        ) : null}

        <div style={{ marginBottom: "18px", maxWidth: "520px", marginInline: "auto", display: "grid", gridTemplateColumns: activeEntry ? "1fr auto" : "1fr", gap: "8px" }}>
          <input
            data-testid="tracker-notes-input"
            value={notes}
            onChange={(event) => setNotes(event.target.value)}
            placeholder="Nota rápida de la sesión..."
            style={{
              width: "100%",
              padding: "9px 13px",
              borderRadius: "8px",
              border: "1px solid var(--border)",
              background: "var(--bg)",
              color: "var(--ink)",
              fontSize: "13px",
              outline: "none",
              boxSizing: "border-box",
            }}
          />
          {activeEntry ? (
            <button
              data-testid="tracker-save-note-button"
              onClick={() => void handleSaveActiveNote()}
              disabled={saving}
              style={secondaryButton()}
            >
              {saving ? "Guardando..." : "Guardar nota"}
            </button>
          ) : null}
        </div>

        <div style={{ display: "flex", justifyContent: "center", gap: "12px", flexWrap: "wrap" }}>
          {!activeEntry ? (
            <button
              data-testid="tracker-start-button"
              onClick={() => void handleStart()}
              disabled={startDisabled}
              style={primaryButton("#10b981", startDisabled)}
            >
              <Play size={16} fill="#fff" /> {saving ? "Iniciando..." : "Iniciar"}
            </button>
          ) : activeEntry.status === "running" ? (
            <>
              <button data-testid="tracker-pause-button" onClick={() => void handlePause()} disabled={saving} style={secondaryButton()}>
                <Pause size={16} /> {saving ? "Pausando..." : "Pausar"}
              </button>
              <button data-testid="tracker-stop-button" onClick={() => void handleStop()} disabled={saving} style={dangerButton()}>
                <Square size={16} /> {saving ? "Deteniendo..." : "Guardar y detener"}
              </button>
            </>
          ) : (
            <>
              <button data-testid="tracker-resume-button" onClick={() => void handleResume()} disabled={saving} style={primaryButton("var(--brand)", saving)}>
                <Play size={16} fill="#fff" /> {saving ? "Reanudando..." : "Reanudar"}
              </button>
              <button data-testid="tracker-stop-button" onClick={() => void handleStop()} disabled={saving} style={dangerButton()}>
                <Square size={16} /> {saving ? "Deteniendo..." : "Detener"}
              </button>
            </>
          )}
        </div>
      </HtmlInCanvasPanel>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: "10px" }}>
        <MetricCard label="Esta semana" value={fmtSeconds(displayedWeekSeconds)} color="var(--brand)" />
        <MetricCard label="Este mes" value={fmtSeconds(displayedMonthSeconds)} color="#10b981" />
        <MetricCard label="Días trabajados" value={loading ? "—" : String(daysWorkedThisWeek)} color="#8b5cf6" />
        <MetricCard label="Liberado" value={formatMoney(releasedAmount)} color="var(--accent)" />
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px" }}>
        <div style={card}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: "12px", marginBottom: "12px" }}>
            <div>
              <p style={{ fontSize: "11px", fontWeight: 700, color: "var(--muted)", marginBottom: "4px" }}>RESUMEN SEMANAL</p>
              <h2 style={{ fontSize: "15px", fontWeight: 800, color: "var(--ink)" }}>Tiempo por día</h2>
            </div>
            <span style={{ fontSize: "11px", color: "var(--muted)" }}>
              {weekSummary?.totalEntries ?? 0} entradas
              {weekSummary?.changePercent != null ? ` · ${weekSummary.changePercent > 0 ? "+" : ""}${weekSummary.changePercent}% vs sem. anterior` : ""}
            </span>
          </div>

          <div style={{ display: "grid", gap: "10px" }}>
            {weekByDay.length > 0 ? (
              weekByDay.map((day) => {
                const pct = maxDayMinutes > 0 ? Math.min(100, Math.round((day.minutes / maxDayMinutes) * 100)) : 0;
                return (
                  <div key={day.date} style={{ display: "grid", gap: "6px" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", gap: "10px", fontSize: "12px" }}>
                      <span style={{ color: "var(--ink)", fontWeight: 700 }}>{formatEntryDate(day.date)}</span>
                      <span style={{ color: "var(--muted)", fontVariantNumeric: "tabular-nums" }}>{fmtSeconds(day.minutes * 60)}</span>
                    </div>
                    <div style={{ height: "7px", borderRadius: "999px", background: "rgba(148,163,184,.18)", overflow: "hidden" }}>
                      <div style={{ width: `${pct}%`, height: "100%", background: "var(--brand)" }} />
                    </div>
                  </div>
                );
              })
            ) : (
              <p style={{ fontSize: "13px", color: "var(--muted)", lineHeight: 1.6 }}>Sin tiempo registrado esta semana.</p>
            )}
          </div>
        </div>

        <div style={card}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: "12px", marginBottom: "12px" }}>
            <div>
              <p style={{ fontSize: "11px", fontWeight: 700, color: "var(--muted)", marginBottom: "4px" }}>LIBRETA</p>
              <h2 style={{ fontSize: "15px", fontWeight: 800, color: "var(--ink)" }}>Notas recientes</h2>
            </div>
            <span style={{ fontSize: "11px", color: "var(--muted)" }}>Últimas {recentNotes.length}</span>
          </div>

          <div style={{ display: "grid", gap: "10px" }}>
            {recentNotes.length > 0 ? (
              recentNotes.map((entry) => (
                <div key={entry.id} style={{ borderLeft: "3px solid var(--brand)", paddingLeft: "10px" }}>
                  <p style={{ margin: 0, fontSize: "12px", color: "var(--ink)", fontWeight: 700 }}>{entryTitle(entry)}</p>
                  <p style={{ margin: "3px 0", fontSize: "12px", color: "var(--muted)", lineHeight: 1.45 }}>{entry.notes}</p>
                  <p style={{ margin: 0, fontSize: "11px", color: "var(--muted)" }}>{formatEntryDate(entry.startedAt)}</p>
                </div>
              ))
            ) : (
              <p style={{ fontSize: "13px", color: "var(--muted)", lineHeight: 1.6 }}>Las entradas con nota aparecerán aquí para seguimiento y cierre semanal.</p>
            )}
          </div>
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1.2fr .8fr", gap: "16px" }}>
        <div style={card}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "12px" }}>
            <div>
              <p style={{ fontSize: "11px", fontWeight: 700, color: "var(--muted)", marginBottom: "4px" }}>
                {mode === "free" && !activeEntry?.jobId ? "PROYECTO LIBRE" : "TRABAJO CONECTADO"}
              </p>
              <h2 data-testid="tracker-current-job" style={{ fontSize: "16px", fontWeight: 700, color: "var(--ink)" }}>
                {currentJob?.title
                  ?? (mode === "free" ? currentFreeProject?.name ?? "Selecciona un proyecto" : mode === "personal" ? "Horas personales" : "Selecciona un trabajo")}
              </h2>
            </div>
            {activeEntry && activeStatusMeta ? (
              <span
                data-testid="tracker-status-chip"
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  padding: "4px 10px",
                  borderRadius: "999px",
                  background: activeStatusMeta.bg,
                  color: activeStatusMeta.color,
                  fontSize: "11px",
                  fontWeight: 700,
                }}
              >
                {activeStatusMeta.label}
              </span>
            ) : null}
          </div>

          {currentJobId ? (
            <>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "10px" }}>
                <MiniStat label="Estado job" value={currentJob?.status ?? "—"} icon={<Clock size={14} color="var(--brand)" />} />
                <MiniStat label="Escrow" value={String(escrow?.status ?? "—")} icon={<ShieldCheck size={14} color="#10b981" />} />
                <MiniStat label="Fondeado" value={formatMoney(fundedAmount)} icon={<Receipt size={14} color="var(--accent)" />} />
              </div>

              <div style={{ display: "flex", gap: "10px", flexWrap: "wrap", marginTop: "14px" }}>
                {currentJobRouteId ? (
                  <>
                    <Link href={`/jobs/${encodeURIComponent(currentJobRouteId)}`} style={linkButton()}>
                      Ver trabajo
                    </Link>
                    <Link href={`/jobs/${encodeURIComponent(currentJobRouteId)}/escrow`} style={linkButton()}>
                      Ver escrow
                    </Link>
                    <Link href={`/jobs/${encodeURIComponent(currentJobRouteId)}/evidence`} style={linkButton()}>
                      Ver evidencia
                    </Link>
                  </>
                ) : null}
              </div>
            </>
          ) : mode === "free" && currentFreeProject ? (
            <>
              <p style={{ fontSize: "13px", color: "var(--muted)", lineHeight: 1.6, margin: 0 }}>
                {currentFreeProject.description || "Proyecto libre sin cliente formal. Cuando lo formalices podrás convertirlo en job con escrow desde la pestaña Proyectos."}
              </p>
              <div style={{ display: "flex", gap: "10px", flexWrap: "wrap", marginTop: "14px" }}>
                <button type="button" onClick={() => setTab("proyectos")} style={linkButton()}>
                  Gestionar proyectos libres
                </button>
              </div>
            </>
          ) : (
            <p style={{ fontSize: "13px", color: "var(--muted)", lineHeight: 1.6, margin: 0 }}>
              {mode === "personal"
                ? "Modo personal: solo cuentas tus horas. Cambia a Job real o Proyecto libre para conectar escrow, pagos o clientes."
                : "Conecta un trabajo para ver escrow, pagos y contrato en tiempo real."}
            </p>
          )}
        </div>

        <div style={card}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "12px" }}>
            <h2 style={{ fontSize: "15px", fontWeight: 700, color: "var(--ink)" }}>Entrada manual</h2>
            <button onClick={() => setShowForm((current) => !current)} style={linkButton()}>
              <Plus size={12} /> Agregar
            </button>
          </div>

          {showForm ? (
            <div style={{ display: "grid", gap: "10px" }}>
              <div style={{ position: "relative" }}>
                <select
                  data-testid="tracker-manual-target-select"
                  value={manualTarget}
                  onChange={(event) => setManualTarget(event.target.value)}
                  style={{ ...inputStyle(), paddingRight: "32px", appearance: "none", cursor: "pointer" }}
                >
                  <option value="personal">Horas personales (solo calcular)</option>
                  {jobs.length > 0 ? (
                    <optgroup label="Jobs reales">
                      {jobs.map((job) => (
                        <option key={job.id} value={`job:${job.id}`}>{job.title}</option>
                      ))}
                    </optgroup>
                  ) : null}
                  {freeProjects.length > 0 ? (
                    <optgroup label="Proyectos libres">
                      {freeProjects.map((project) => (
                        <option key={project.id} value={`free:${project.id}`}>{project.name}</option>
                      ))}
                    </optgroup>
                  ) : null}
                </select>
                <ChevronDown size={13} style={{ position: "absolute", right: "10px", top: "50%", transform: "translateY(-50%)", color: "var(--muted)", pointerEvents: "none" }} />
              </div>
              <input value={manualDate} onChange={(event) => setManualDate(event.target.value)} type="date" style={inputStyle()} />
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px" }}>
                <input value={manualStart} onChange={(event) => setManualStart(event.target.value)} type="time" style={inputStyle()} />
                <input value={manualEnd} onChange={(event) => setManualEnd(event.target.value)} type="time" style={inputStyle()} />
              </div>
              <label style={{ display: "grid", gap: "4px", fontSize: "11px", color: "var(--muted)", fontWeight: 700 }}>
                Descanso (minutos)
                <input value={manualBreak} onChange={(event) => setManualBreak(event.target.value)} type="number" min="0" step="5" style={inputStyle()} />
              </label>
              <p style={{ fontSize: "12px", color: manualPreviewSeconds === null ? "#ef4444" : "var(--muted)", margin: 0 }}>
                Duración neta: {manualPreviewSeconds === null ? "rango inválido" : fmtSeconds(manualPreviewSeconds)}
              </p>
              <input value={manualNotes} onChange={(event) => setManualNotes(event.target.value)} placeholder="Descripción de la actividad" style={inputStyle()} />
              <div style={{ display: "flex", gap: "8px" }}>
                <button onClick={() => void handleManualSave()} disabled={manualPreviewSeconds === null || saving} style={primaryButton("var(--brand)", manualPreviewSeconds === null || saving)}>
                  {saving ? "Guardando..." : "Guardar"}
                </button>
                <button onClick={() => setShowForm(false)} style={secondaryButton()}>
                  Cancelar
                </button>
              </div>
            </div>
          ) : (
            <div style={{ color: "var(--muted)", fontSize: "13px", lineHeight: 1.6 }}>
              Registra horas pasadas (fecha, entrada, salida y descanso) en jobs, proyectos libres o solo para tu control.
            </div>
          )}

          <div style={{ marginTop: "16px", display: "grid", gap: "8px" }}>
            <MiniStat label="Pagos" value={String(payments.length)} icon={<Receipt size={14} color="var(--brand)" />} />
            <MiniStat label="Contrato" value={contract ? "Disponible" : "Sin contrato"} icon={<ShieldCheck size={14} color="#10b981" />} />
          </div>
        </div>
      </div>

      <div>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", gap: "12px", marginBottom: "12px", flexWrap: "wrap" }}>
          <div>
            <h2 style={{ fontSize: "15px", fontWeight: 700, color: "var(--ink)", marginBottom: "4px" }}>Entradas recientes</h2>
            <p style={{ margin: 0, fontSize: "12px", color: "var(--muted)" }}>
              {filteredEntries.length} entradas · {fmtSeconds(filteredEntrySeconds)} · {filteredEntriesLabel} · {trackerHistoryStatusLabel(historyStatus)}
            </p>
          </div>

          <div style={{ display: "flex", gap: "8px", flexWrap: "wrap", justifyContent: "flex-end" }}>
            <button
              type="button"
              onClick={handleExportHistoryCsv}
              disabled={filteredEntries.length === 0 || loading || historyLoading}
              style={historyActionButton(filteredEntries.length === 0 || loading || historyLoading)}
            >
              <Download size={13} /> CSV
            </button>
            <div style={{ position: "relative" }}>
              <select
                aria-label="Filtrar historial por rango"
                value={historyRange}
                onChange={(event) => setHistoryRange(event.target.value as TrackerHistoryRange)}
                style={{ ...compactSelect(), minWidth: "132px" }}
              >
                <option value="week">7 días</option>
                <option value="month">30 días</option>
                <option value="all">Todo</option>
              </select>
              <ChevronDown size={13} style={selectChevron()} />
            </div>
            <div style={{ position: "relative" }}>
              <select
                aria-label="Filtrar historial por estado"
                value={historyStatus}
                onChange={(event) => setHistoryStatus(event.target.value as TrackerHistoryStatus)}
                style={{ ...compactSelect(), minWidth: "154px" }}
              >
                <option value="all">Todos los estados</option>
                <option value="running">Corriendo</option>
                <option value="paused">En pausa</option>
                <option value="completed">Completadas</option>
              </select>
              <ChevronDown size={13} style={selectChevron()} />
            </div>
            <div style={{ position: "relative" }}>
              <select
                aria-label="Filtrar historial por destino"
                value={historyTarget}
                onChange={(event) => setHistoryTarget(event.target.value)}
                style={{ ...compactSelect(), minWidth: "190px", maxWidth: "260px" }}
              >
                <option value="all">Todos los destinos</option>
                <option value="personal">Horas personales</option>
                {jobs.length > 0 ? (
                  <optgroup label="Jobs reales">
                    {jobs.map((job) => (
                      <option key={job.id} value={`job:${job.id}`}>{job.title}</option>
                    ))}
                  </optgroup>
                ) : null}
                {freeProjects.length > 0 ? (
                  <optgroup label="Proyectos libres">
                    {freeProjects.map((project) => (
                      <option key={project.id} value={`free:${project.id}`}>{project.name}</option>
                    ))}
                  </optgroup>
                ) : null}
              </select>
              <ChevronDown size={13} style={selectChevron()} />
            </div>
          </div>
        </div>

        {filteredEntries.length > 0 ? (
          <div data-testid="tracker-history-status-summary" style={{ display: "flex", gap: "8px", flexWrap: "wrap", marginBottom: "10px" }}>
            {(["running", "paused", "completed"] as const).map((status) => (
              <span
                key={status}
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "6px",
                  padding: "5px 9px",
                  borderRadius: "8px",
                  background: entryStatusMeta(status).bg,
                  color: entryStatusMeta(status).color,
                  fontSize: "11px",
                  fontWeight: 800,
                }}
              >
                {entryStatusMeta(status).label}: {filteredStatusCounts[status]}
              </span>
            ))}
          </div>
        ) : null}

        <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
          {loading || historyLoading ? (
            <div style={{ ...card, color: "var(--muted)", fontSize: "13px" }}>
              {loading ? "Cargando tracker..." : "Cargando historial..."}
            </div>
          ) : error ? (
            <div style={{ ...card, color: "#ef4444", fontSize: "13px", background: "rgba(239,68,68,.08)", border: "1px solid rgba(239,68,68,.18)" }}>
              {error}
            </div>
          ) : entries.length === 0 ? (
            <div style={{ ...card, color: "var(--muted)", fontSize: "13px" }}>Todavía no hay entradas registradas.</div>
          ) : filteredEntries.length === 0 ? (
            <div style={{ ...card, color: "var(--muted)", fontSize: "13px" }}>
              No hay entradas que coincidan con estos filtros.
            </div>
          ) : (
            filteredEntries.map((entry) => {
              const meta = entryStatusMeta(entry.status);
              return (
                <div data-testid="tracker-session-card" key={entry.id} style={{ ...card, display: "flex", alignItems: "center", gap: "16px", padding: "14px 16px" }}>
                  <div style={{ width: "38px", height: "38px", borderRadius: "10px", background: `${meta.color}18`, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                    <Clock size={16} color={meta.color} />
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{ fontSize: "13px", fontWeight: 600, color: "var(--ink)", marginBottom: "2px" }}>{entryTitle(entry)}</p>
                    <p style={{ fontSize: "11px", color: "var(--muted)" }}>
                      {formatEntryDate(entry.startedAt)} · {formatEntryRange(entry)}
                      {entry.mode === "manual" ? " · manual" : ""}
                      {entry.breakMinutes > 0 ? ` · ${entry.breakMinutes}m descanso` : ""}
                      {entry.notes ? ` · ${entry.notes}` : ""}
                    </p>
                  </div>
                  <div style={{ textAlign: "right", flexShrink: 0 }}>
                    <p style={{ fontSize: "15px", fontWeight: 800, color: "var(--ink)" }}>{fmtSeconds(entryElapsed(entry))}</p>
                    <p style={{ fontSize: "11px", color: meta.color }}>{meta.label}</p>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
      </div>
    </div>
  );
}

function MetricCard({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: "14px", padding: "14px", textAlign: "center" }}>
      <p style={{ fontSize: "20px", fontWeight: 800, color }}>{value}</p>
      <p style={{ fontSize: "11px", color: "var(--muted)", marginTop: "2px" }}>{label}</p>
    </div>
  );
}

function MiniStat({ label, value, icon }: { label: string; value: string; icon: ReactNode }) {
  return (
    <div style={{ padding: "12px", borderRadius: "12px", border: "1px solid var(--border)", background: "var(--bg)" }}>
      <div style={{ display: "flex", alignItems: "center", gap: "6px", marginBottom: "8px" }}>
        {icon}
        <span style={{ fontSize: "11px", color: "var(--muted)", fontWeight: 700 }}>{label}</span>
      </div>
      <p style={{ fontSize: "14px", color: "var(--ink)", fontWeight: 700 }}>{value}</p>
    </div>
  );
}

function syncBannerStyle(tone: "info" | "success" | "warning" | "danger"): CSSProperties {
  const palette = {
    info: { background: "rgba(59,130,246,.08)", border: "rgba(59,130,246,.22)" },
    success: { background: "rgba(16,185,129,.08)", border: "rgba(16,185,129,.22)" },
    warning: { background: "rgba(245,158,11,.1)", border: "rgba(245,158,11,.28)" },
    danger: { background: "rgba(239,68,68,.08)", border: "rgba(239,68,68,.22)" },
  }[tone];

  return {
    display: "flex",
    alignItems: "center",
    gap: "10px",
    flexWrap: "wrap",
    padding: "12px 14px",
    borderRadius: "12px",
    background: palette.background,
    border: `1px solid ${palette.border}`,
  };
}

function primaryButton(background: string, disabled: boolean): CSSProperties {
  return {
    display: "flex",
    alignItems: "center",
    gap: "8px",
    padding: "12px 24px",
    borderRadius: "10px",
    border: "none",
    background,
    color: "#fff",
    fontSize: "14px",
    fontWeight: 700,
    cursor: disabled ? "not-allowed" : "pointer",
    opacity: disabled ? 0.6 : 1,
  };
}

function secondaryButton(): CSSProperties {
  return {
    display: "flex",
    alignItems: "center",
    gap: "8px",
    padding: "12px 22px",
    borderRadius: "10px",
    background: "var(--surface)",
    border: "1px solid var(--border)",
    color: "var(--ink)",
    fontSize: "14px",
    fontWeight: 600,
    cursor: "pointer",
  };
}

function dangerButton(): CSSProperties {
  return {
    display: "flex",
    alignItems: "center",
    gap: "8px",
    padding: "12px 22px",
    borderRadius: "10px",
    background: "#ef444415",
    border: "1px solid #ef444430",
    color: "#ef4444",
    fontSize: "14px",
    fontWeight: 600,
    cursor: "pointer",
  };
}

function linkButton(): CSSProperties {
  return {
    display: "inline-flex",
    alignItems: "center",
    gap: "6px",
    padding: "7px 12px",
    borderRadius: "8px",
    border: "1px solid var(--border)",
    color: "var(--muted)",
    background: "transparent",
    fontSize: "12px",
    fontWeight: 600,
    textDecoration: "none",
    cursor: "pointer",
  };
}

function inputStyle(): CSSProperties {
  return {
    width: "100%",
    padding: "8px 10px",
    borderRadius: "7px",
    border: "1px solid var(--border)",
    background: "var(--bg)",
    color: "var(--ink)",
    fontSize: "13px",
    outline: "none",
    boxSizing: "border-box",
  };
}

function compactSelect(): CSSProperties {
  return {
    height: "34px",
    padding: "0 30px 0 10px",
    borderRadius: "8px",
    border: "1px solid var(--border)",
    background: "var(--surface)",
    color: "var(--ink)",
    fontSize: "12px",
    fontWeight: 600,
    appearance: "none",
    cursor: "pointer",
    outline: "none",
  };
}

function historyActionButton(disabled: boolean): CSSProperties {
  return {
    height: "34px",
    display: "inline-flex",
    alignItems: "center",
    gap: "6px",
    padding: "0 11px",
    borderRadius: "8px",
    border: "1px solid var(--border)",
    background: "var(--surface)",
    color: "var(--ink)",
    fontSize: "12px",
    fontWeight: 700,
    cursor: disabled ? "not-allowed" : "pointer",
    opacity: disabled ? 0.55 : 1,
  };
}

function selectChevron(): CSSProperties {
  return {
    position: "absolute",
    right: "10px",
    top: "50%",
    transform: "translateY(-50%)",
    color: "var(--muted)",
    pointerEvents: "none",
  };
}
