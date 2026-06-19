"use client";

import Link from "next/link";
import { useLanguage } from "../../../../lib/language-context";
import { useCallback, useEffect, useState, type CSSProperties, type ReactNode } from "react";
import { HtmlInCanvasPanel } from "@semse/ui";
import { ChevronDown, Clock, Pause, Play, Plus, Receipt, ShieldCheck, Square } from "lucide-react";
import {
  createManualTrackerSession,
  fetchJobContract,
  fetchJobEscrow,
  fetchJobPayments,
  fetchTimeTrackerJobs,
  fetchTimeTrackerSummary,
  fetchTrackerSnapshot,
  pauseTrackerSession,
  resumeTrackerSession,
  startTrackerSession,
  stopTrackerSession,
  updateTimeTrackerSessionNotes,
  type JobRecordView,
  type TimeTrackerSummaryView,
  type TrackerSessionView
} from "../../../semse-api";
import { NotificationBanner } from "../../../components/notifications/NotificationBanner";

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

function formatSessionDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString("es-MX", { day: "2-digit", month: "short", year: "numeric" });
}

function formatSessionRange(session: TrackerSessionView) {
  const startedAt = new Date(session.startedAt);
  const endedAt = new Date(session.stoppedAt ?? session.pausedAt ?? session.updatedAt);
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

function elapsedFromSession(session: TrackerSessionView | null): number {
  if (!session) return 0;
  if (session.status !== "RUNNING" || !session.resumedAt) {
    return session.elapsedSeconds;
  }

  const resumedAt = new Date(session.resumedAt).getTime();
  if (Number.isNaN(resumedAt)) {
    return session.elapsedSeconds;
  }

  return session.accumulatedSeconds + Math.max(0, Math.floor((Date.now() - resumedAt) / 1000));
}

function manualDurationSeconds(date: string, startTime: string, endTime: string): number | null {
  const startedAt = new Date(`${date}T${startTime}:00`);
  const endedAt = new Date(`${date}T${endTime}:00`);
  if (Number.isNaN(startedAt.getTime()) || Number.isNaN(endedAt.getTime()) || endedAt <= startedAt) {
    return null;
  }
  return Math.floor((endedAt.getTime() - startedAt.getTime()) / 1000);
}

const STATUS_META: Record<TrackerSessionView["status"], { label: string; color: string; bg: string }> = {
  RUNNING: { label: "Corriendo", color: "#10b981", bg: "rgba(16,185,129,.12)" },
  PAUSED: { label: "En pausa", color: "#f59e0b", bg: "rgba(245,158,11,.12)" },
  STOPPED: { label: "Detenida", color: "#64748b", bg: "rgba(100,116,139,.12)" },
};

export default function WorkerTrackerPage() {
  const { t } = useLanguage();
  const [jobs, setJobs] = useState<JobRecordView[]>([]);
  const [sessions, setSessions] = useState<TrackerSessionView[]>([]);
  const [activeSession, setActiveSession] = useState<TrackerSessionView | null>(null);
  const [selectedJob, setSelectedJob] = useState("");
  const [notes, setNotes] = useState("");
  const [elapsed, setElapsed] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [manualDate, setManualDate] = useState(new Date().toISOString().slice(0, 10));
  const [manualStart, setManualStart] = useState("09:00");
  const [manualEnd, setManualEnd] = useState("13:00");
  const [manualNotes, setManualNotes] = useState("");
  const [escrow, setEscrow] = useState<Record<string, unknown> | null>(null);
  const [payments, setPayments] = useState<Record<string, unknown>[]>([]);
  const [contract, setContract] = useState<Record<string, unknown> | null>(null);
  const [weekSummary, setWeekSummary] = useState<TimeTrackerSummaryView | null>(null);
  const [monthSummary, setMonthSummary] = useState<TimeTrackerSummaryView | null>(null);

  const loadTracker = useCallback(async () => {
    const [assignedJobs, snapshot, weekResult, monthResult] = await Promise.all([
      fetchTimeTrackerJobs(),
      fetchTrackerSnapshot(),
      fetchTimeTrackerSummary("week"),
      fetchTimeTrackerSummary("month"),
    ]);

    const preferredJobId = snapshot.activeSession?.jobId ?? assignedJobs[0]?.id ?? "";

    setJobs(assignedJobs);
    setSessions(snapshot.recentSessions);
    setActiveSession(snapshot.activeSession);
    setSelectedJob(snapshot.activeSession?.jobId ?? preferredJobId);
    setNotes(snapshot.activeSession?.notes ?? "");
    setElapsed(elapsedFromSession(snapshot.activeSession));
    setWeekSummary(weekResult);
    setMonthSummary(monthResult);
  }, []);

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

  useEffect(() => {
    setElapsed(elapsedFromSession(activeSession));
    if (activeSession?.status !== "RUNNING") return;

    const timer = window.setInterval(() => {
      setElapsed(elapsedFromSession(activeSession));
    }, 1000);

    return () => window.clearInterval(timer);
  }, [activeSession]);

  useEffect(() => {
    const jobId = activeSession?.jobId ?? selectedJob;
    if (!jobId) {
      setEscrow(null);
      setPayments([]);
      setContract(null);
      return;
    }

    const run = async () => {
      try {
        const [escrowResult, paymentsResult, contractResult] = await Promise.all([
          fetchJobEscrow(jobId).catch(() => null),
          fetchJobPayments(jobId).catch(() => []),
          fetchJobContract(jobId).catch(() => null),
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
  }, [selectedJob, activeSession?.jobId]);

  const currentJobId = activeSession?.jobId ?? selectedJob;
  const currentJobRouteId = safeRouteId(currentJobId);
  const currentJob = activeSession?.job
    ?? jobs.find((job) => job.id === currentJobId)
    ?? null;
  const releasedAmount = payments.reduce((sum, item) => sum + (asString(item.type) === "RELEASE" ? asNumber(item.amount) ?? 0 : 0), 0);
  const fundedAmount = asNumber(escrow?.totalAmount);
  const sessionElapsed = (session: TrackerSessionView) => (
    activeSession?.id === session.id ? elapsed : session.elapsedSeconds
  );
  const weekSeconds = sessions
    .filter((item) => Date.now() - new Date(item.startedAt).getTime() <= 7 * 24 * 3600 * 1000)
    .reduce((sum, item) => sum + sessionElapsed(item), 0);
  const monthSeconds = sessions
    .filter((item) => Date.now() - new Date(item.startedAt).getTime() <= 30 * 24 * 3600 * 1000)
    .reduce((sum, item) => sum + sessionElapsed(item), 0);
  const displayedWeekSeconds = Math.max(weekSummary?.totalSeconds ?? 0, weekSeconds);
  const displayedMonthSeconds = Math.max(monthSummary?.totalSeconds ?? 0, monthSeconds);
  const manualPreviewSeconds = manualDurationSeconds(manualDate, manualStart, manualEnd);

  async function refreshAfterMutation() {
    await loadTracker();
    setShowForm(false);
    setManualNotes("");
  }

  async function handleStart() {
    if (!selectedJob || saving) return;
    setSaving(true);
    setError(null);
    try {
      const session = await startTrackerSession({ jobId: selectedJob, notes });
      setActiveSession(session);
      await refreshAfterMutation();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "No se pudo iniciar la sesión.");
    } finally {
      setSaving(false);
    }
  }

  async function handlePause() {
    if (!activeSession || saving) return;
    setSaving(true);
    setError(null);
    try {
      const session = await pauseTrackerSession(activeSession.id, { notes });
      setActiveSession(session);
      await refreshAfterMutation();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "No se pudo pausar la sesión.");
    } finally {
      setSaving(false);
    }
  }

  async function handleResume() {
    if (!activeSession || saving) return;
    setSaving(true);
    setError(null);
    try {
      const session = await resumeTrackerSession(activeSession.id, { notes });
      setActiveSession(session);
      await refreshAfterMutation();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "No se pudo reanudar la sesión.");
    } finally {
      setSaving(false);
    }
  }

  async function handleStop() {
    if (!activeSession || saving) return;
    setSaving(true);
    setError(null);
    try {
      await stopTrackerSession(activeSession.id, { notes });
      setNotes("");
      setActiveSession(null);
      await refreshAfterMutation();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "No se pudo detener la sesión.");
    } finally {
      setSaving(false);
    }
  }

  async function handleSaveActiveNote() {
    if (!activeSession || saving) return;
    setSaving(true);
    setError(null);
    try {
      const session = await updateTimeTrackerSessionNotes(activeSession.id, { notes });
      setActiveSession(session);
      await loadTracker();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "No se pudo guardar la nota.");
    } finally {
      setSaving(false);
    }
  }

  async function handleManualSave() {
    if (!selectedJob || saving) return;
    if (manualPreviewSeconds === null) {
      setError("La entrada manual necesita una hora final posterior a la hora inicial.");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await createManualTrackerSession({
        jobId: selectedJob,
        date: manualDate,
        startTime: manualStart,
        endTime: manualEnd,
        notes: manualNotes,
      });
      await refreshAfterMutation();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "No se pudo guardar la entrada manual.");
    } finally {
      setSaving(false);
    }
  }

  const card: CSSProperties = {
    background: "var(--surface)",
    border: "1px solid var(--border)",
    borderRadius: "14px",
    padding: "20px",
  };

  return (
    <div style={{ maxWidth: "980px", margin: "0 auto", display: "grid", gap: "18px" }}>
      <HtmlInCanvasPanel as="section" style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12 }} canvasClassName="rounded-2xl" minHeight={90}>
        <div>
          <Link href="/worker/dashboard" style={{ display: "inline-flex", alignItems: "center", gap: "5px", color: "var(--muted)", fontSize: "12px", fontWeight: 600, textDecoration: "none", marginBottom: "8px" }}><span style={{ fontSize: "14px" }}>←</span> Dashboard</Link>
          <h1 style={{ fontSize: "22px", fontWeight: 800, color: "var(--ink)", marginBottom: "4px" }}>{t("page.timeTracker")}</h1>
          <p style={{ fontSize: "13px", color: "var(--muted)" }}>
            Sesión persistente por trabajo. Si sales de la web, el tiempo sigue corriendo hasta pausar o detener.
          </p>
        </div>
        <NotificationBanner audience="worker" />
      </HtmlInCanvasPanel>

      <HtmlInCanvasPanel as="section" style={{ ...card, textAlign: "center" }} canvasClassName="rounded-2xl" minHeight={340}>
        <div
          data-testid="tracker-elapsed"
          style={{
            fontSize: "52px",
            fontWeight: 800,
            fontVariantNumeric: "tabular-nums",
            color: activeSession?.status === "RUNNING" ? "var(--brand)" : "var(--ink)",
            letterSpacing: "0.05em",
            marginBottom: "8px",
            fontFamily: "'Geist Mono', 'JetBrains Mono', monospace",
          }}
        >
          {fmtSeconds(elapsed)}
        </div>

        <p style={{ fontSize: "13px", color: "var(--muted)", marginBottom: "18px" }}>
          {activeSession
            ? `${STATUS_META[activeSession.status].label}: ${activeSession.job.title}`
            : jobs.length === 0 && !loading
              ? "Aún no tienes trabajos aceptados para registrar tiempo."
              : "Selecciona un trabajo y presiona Iniciar"}
        </p>

        {!activeSession && jobs.length === 0 && !loading ? (
          <div style={{ marginBottom: "18px" }}>
            <Link href="/worker/opportunities" style={linkButton()}>
              Buscar oportunidades
            </Link>
          </div>
        ) : null}

        {!activeSession ? (
          <div style={{ marginBottom: "16px", maxWidth: "420px", marginInline: "auto" }}>
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
          </div>
        ) : null}

        <div style={{ marginBottom: "18px", maxWidth: "520px", marginInline: "auto", display: "grid", gridTemplateColumns: activeSession ? "1fr auto" : "1fr", gap: "8px" }}>
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
          {activeSession ? (
            <button
              data-testid="tracker-save-note-button"
              onClick={() => void handleSaveActiveNote()}
              disabled={saving}
              style={secondaryButton()}
            >
              Guardar nota
            </button>
          ) : null}
        </div>

        <div style={{ display: "flex", justifyContent: "center", gap: "12px", flexWrap: "wrap" }}>
          {!activeSession ? (
            <button
              data-testid="tracker-start-button"
              onClick={() => void handleStart()}
              disabled={!selectedJob || saving}
              style={primaryButton("#10b981", !selectedJob || saving)}
            >
              <Play size={16} fill="#fff" /> Iniciar
            </button>
          ) : activeSession.status === "RUNNING" ? (
            <>
              <button data-testid="tracker-pause-button" onClick={() => void handlePause()} disabled={saving} style={secondaryButton()}>
                <Pause size={16} /> Pausar
              </button>
              <button data-testid="tracker-stop-button" onClick={() => void handleStop()} disabled={saving} style={dangerButton()}>
                <Square size={16} /> Guardar y detener
              </button>
            </>
          ) : (
            <>
              <button data-testid="tracker-resume-button" onClick={() => void handleResume()} disabled={saving} style={primaryButton("var(--brand)", saving)}>
                <Play size={16} fill="#fff" /> Reanudar
              </button>
              <button data-testid="tracker-stop-button" onClick={() => void handleStop()} disabled={saving} style={dangerButton()}>
                <Square size={16} /> Detener
              </button>
            </>
          )}
        </div>
      </HtmlInCanvasPanel>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: "10px" }}>
        <MetricCard label="Esta semana" value={fmtSeconds(displayedWeekSeconds)} color="var(--brand)" />
        <MetricCard label="Este mes" value={fmtSeconds(displayedMonthSeconds)} color="#10b981" />
        <MetricCard label="Días trabajados" value={String(weekSummary?.daysWorked ?? "—")} color="#8b5cf6" />
        <MetricCard label="Liberado" value={formatMoney(releasedAmount)} color="var(--accent)" />
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px" }}>
        <div style={card}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: "12px", marginBottom: "12px" }}>
            <div>
              <p style={{ fontSize: "11px", fontWeight: 700, color: "var(--muted)", marginBottom: "4px" }}>RESUMEN SEMANAL</p>
              <h2 style={{ fontSize: "15px", fontWeight: 800, color: "var(--ink)" }}>Tiempo por trabajo</h2>
            </div>
            <span style={{ fontSize: "11px", color: "var(--muted)" }}>
              {weekSummary?.sessionCount ?? 0} sesiones · {weekSummary?.sessionsWithoutNotes ?? 0} sin nota
            </span>
          </div>

          <div style={{ display: "grid", gap: "10px" }}>
            {weekSummary?.byJob.length ? (
              weekSummary.byJob.slice(0, 5).map((item) => {
                const pct = displayedWeekSeconds > 0 ? Math.min(100, Math.round((item.seconds / displayedWeekSeconds) * 100)) : 0;
                return (
                  <div key={item.jobId} style={{ display: "grid", gap: "6px" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", gap: "10px", fontSize: "12px" }}>
                      <span style={{ color: "var(--ink)", fontWeight: 700, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{item.jobTitle}</span>
                      <span style={{ color: "var(--muted)", fontVariantNumeric: "tabular-nums" }}>{fmtSeconds(item.seconds)}</span>
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
            <span style={{ fontSize: "11px", color: "var(--muted)" }}>Últimas 10</span>
          </div>

          <div style={{ display: "grid", gap: "10px" }}>
            {weekSummary?.recentNotes.length ? (
              weekSummary.recentNotes.slice(0, 4).map((item) => (
                <div key={item.sessionId} style={{ borderLeft: "3px solid var(--brand)", paddingLeft: "10px" }}>
                  <p style={{ margin: 0, fontSize: "12px", color: "var(--ink)", fontWeight: 700 }}>{item.jobTitle}</p>
                  <p style={{ margin: "3px 0", fontSize: "12px", color: "var(--muted)", lineHeight: 1.45 }}>{item.note}</p>
                  <p style={{ margin: 0, fontSize: "11px", color: "var(--muted)" }}>{formatSessionDate(item.startedAt)}</p>
                </div>
              ))
            ) : (
              <p style={{ fontSize: "13px", color: "var(--muted)", lineHeight: 1.6 }}>Las sesiones con nota aparecerán aquí para seguimiento y cierre semanal.</p>
            )}
          </div>
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1.2fr .8fr", gap: "16px" }}>
        <div style={card}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "12px" }}>
            <div>
              <p style={{ fontSize: "11px", fontWeight: 700, color: "var(--muted)", marginBottom: "4px" }}>TRABAJO CONECTADO</p>
              <h2 data-testid="tracker-current-job" style={{ fontSize: "16px", fontWeight: 700, color: "var(--ink)" }}>{currentJob?.title ?? "Selecciona un trabajo"}</h2>
            </div>
            {activeSession ? (
              <span
                data-testid="tracker-status-chip"
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  padding: "4px 10px",
                  borderRadius: "999px",
                  background: STATUS_META[activeSession.status].bg,
                  color: STATUS_META[activeSession.status].color,
                  fontSize: "11px",
                  fontWeight: 700,
                }}
              >
                {STATUS_META[activeSession.status].label}
              </span>
            ) : null}
          </div>

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
              <input value={manualDate} onChange={(event) => setManualDate(event.target.value)} type="date" style={inputStyle()} />
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px" }}>
                <input value={manualStart} onChange={(event) => setManualStart(event.target.value)} type="time" style={inputStyle()} />
                <input value={manualEnd} onChange={(event) => setManualEnd(event.target.value)} type="time" style={inputStyle()} />
              </div>
              <p style={{ fontSize: "12px", color: manualPreviewSeconds === null ? "#ef4444" : "var(--muted)", margin: 0 }}>
                Duración: {manualPreviewSeconds === null ? "rango inválido" : fmtSeconds(manualPreviewSeconds)}
              </p>
              <input value={manualNotes} onChange={(event) => setManualNotes(event.target.value)} placeholder="Descripción de la actividad" style={inputStyle()} />
              <div style={{ display: "flex", gap: "8px" }}>
                <button onClick={() => void handleManualSave()} disabled={!selectedJob || manualPreviewSeconds === null || saving} style={primaryButton("var(--brand)", !selectedJob || manualPreviewSeconds === null || saving)}>
                  Guardar
                </button>
                <button onClick={() => setShowForm(false)} style={secondaryButton()}>
                  Cancelar
                </button>
              </div>
            </div>
          ) : (
            <div style={{ color: "var(--muted)", fontSize: "13px", lineHeight: 1.6 }}>
              Crea sesiones cerradas por trabajo para cuadrar horas, escrow y seguimiento operativo sin depender del reloj activo.
            </div>
          )}

          <div style={{ marginTop: "16px", display: "grid", gap: "8px" }}>
            <MiniStat label="Pagos" value={String(payments.length)} icon={<Receipt size={14} color="var(--brand)" />} />
            <MiniStat label="Contrato" value={contract ? "Disponible" : "Sin contrato"} icon={<ShieldCheck size={14} color="#10b981" />} />
          </div>
        </div>
      </div>

      <div>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "12px" }}>
          <h2 style={{ fontSize: "15px", fontWeight: 700, color: "var(--ink)" }}>Sesiones recientes</h2>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
          {loading ? (
            <div style={{ ...card, color: "var(--muted)", fontSize: "13px" }}>Cargando tracker...</div>
          ) : error ? (
            <div style={{ ...card, color: "#ef4444", fontSize: "13px", background: "rgba(239,68,68,.08)", border: "1px solid rgba(239,68,68,.18)" }}>
              {error}
            </div>
          ) : sessions.length === 0 ? (
            <div style={{ ...card, color: "var(--muted)", fontSize: "13px" }}>Todavía no hay sesiones registradas.</div>
          ) : (
            sessions.map((session) => (
              <div data-testid="tracker-session-card" key={session.id} style={{ ...card, display: "flex", alignItems: "center", gap: "16px", padding: "14px 16px" }}>
                <div style={{ width: "38px", height: "38px", borderRadius: "10px", background: `${STATUS_META[session.status].color}18`, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                  <Clock size={16} color={STATUS_META[session.status].color} />
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p style={{ fontSize: "13px", fontWeight: 600, color: "var(--ink)", marginBottom: "2px" }}>{session.job.title}</p>
                  <p style={{ fontSize: "11px", color: "var(--muted)" }}>
                    {formatSessionDate(session.startedAt)} · {formatSessionRange(session)}
                    {session.notes ? ` · ${session.notes}` : ""}
                  </p>
                </div>
                <div style={{ textAlign: "right", flexShrink: 0 }}>
                  <p style={{ fontSize: "15px", fontWeight: 800, color: "var(--ink)" }}>{fmtSeconds(session.elapsedSeconds)}</p>
                  <p style={{ fontSize: "11px", color: STATUS_META[session.status].color }}>{STATUS_META[session.status].label}</p>
                </div>
              </div>
            ))
          )}
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
