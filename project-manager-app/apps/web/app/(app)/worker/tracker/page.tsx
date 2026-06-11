"use client";

import Link from "next/link";
import { useLanguage } from "../../../../lib/language-context";
import { useCallback, useEffect, useState, type CSSProperties, type ReactNode } from "react";
import { HtmlInCanvasPanel } from "@semse/ui";
import { ChevronDown, Clock, Pause, Play, Plus, Receipt, ShieldCheck, Square } from "lucide-react";
import {
  completeMultipartUploadSession,
  createMultipartUploadSession,
  createManualTrackerSession,
  fetchJobContract,
  fetchJobEscrow,
  fetchJobPayments,
  fetchJobs,
  fetchTrackerSnapshot,
  pauseTrackerSession,
  planUpload,
  resumeTrackerSession,
  startTrackerSession,
  stopTrackerSession,
  uploadMultipartPart,
  type JobRecordView,
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
  const [contractFilename, setContractFilename] = useState("contrato-operativo.pdf");
  const [contractSizeMb, setContractSizeMb] = useState("8");
  const [planningContract, setPlanningContract] = useState(false);
  const [contractUploadPlan, setContractUploadPlan] = useState<Record<string, unknown> | null>(null);
  const [contractMultipartSession, setContractMultipartSession] = useState<Record<string, unknown> | null>(null);
  const [completingContractMultipart, setCompletingContractMultipart] = useState(false);
  const [contractMultipartProgress, setContractMultipartProgress] = useState<Record<number, "pending" | "uploading" | "uploaded">>({});

  const loadTracker = useCallback(async () => {
    const [jobsResult, snapshot] = await Promise.all([
      fetchJobs(),
      fetchTrackerSnapshot(),
    ]);

    const activeJobs = jobsResult.filter((job) => ["accepted", "in_progress", "review"].includes(job.status));
    const preferredJobId = snapshot.activeSession?.jobId ?? activeJobs[0]?.id ?? "";

    setJobs(activeJobs);
    setSessions(snapshot.recentSessions);
    setActiveSession(snapshot.activeSession);
    setSelectedJob(snapshot.activeSession?.jobId ?? preferredJobId);
    setNotes(snapshot.activeSession?.notes ?? "");
    setElapsed(elapsedFromSession(snapshot.activeSession));
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
  const weekSeconds = sessions
    .filter((item) => Date.now() - new Date(item.startedAt).getTime() <= 7 * 24 * 3600 * 1000)
    .reduce((sum, item) => sum + item.elapsedSeconds, 0);
  const monthSeconds = sessions
    .filter((item) => Date.now() - new Date(item.startedAt).getTime() <= 30 * 24 * 3600 * 1000)
    .reduce((sum, item) => sum + item.elapsedSeconds, 0);

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

  async function handlePlanContractUpload() {
    const sizeMb = Number(contractSizeMb);
    if (!contractFilename.trim() || !Number.isFinite(sizeMb) || sizeMb <= 0) {
      setError("Define un nombre y tamaño válidos para planificar el documento contractual.");
      return;
    }

    setPlanningContract(true);
    setError(null);
    try {
      const lowerName = contractFilename.toLowerCase();
      const contentType = lowerName.endsWith(".pdf")
        ? "application/pdf"
        : lowerName.endsWith(".docx")
          ? "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
          : lowerName.endsWith(".doc")
            ? "application/msword"
            : "application/octet-stream";

      const result = await planUpload({
        domain: "contract",
        filename: contractFilename.trim(),
        contentType,
        fileSizeBytes: Math.round(sizeMb * 1024 * 1024),
        source: sizeMb > 25 ? "external_transfer" : "project_copilot",
      });
      setContractUploadPlan(result);
      if (asString(result.recommendedStrategy) === "external_transfer") {
        const session = await createMultipartUploadSession({
          domain: "contract",
          filename: contractFilename.trim(),
          contentType,
          fileSizeBytes: Math.round(sizeMb * 1024 * 1024),
          source: "external_transfer"
        });
        setContractMultipartSession(session);
        const parts = Array.isArray(session.parts) ? session.parts as Array<Record<string, unknown>> : [];
        setContractMultipartProgress(
          Object.fromEntries(parts.map((part, index) => [asNumber(part.partNumber) ?? index + 1, "pending"]))
        );
      } else {
        setContractMultipartSession(null);
        setContractMultipartProgress({});
      }
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "No se pudo planificar la carga contractual.");
      setContractUploadPlan(null);
      setContractMultipartSession(null);
      setContractMultipartProgress({});
    } finally {
      setPlanningContract(false);
    }
  }

  async function handleCompleteContractMultipart() {
    const sessionId = asString(contractMultipartSession?.sessionId);
    const parts = Array.isArray(contractMultipartSession?.parts)
      ? contractMultipartSession.parts as Array<Record<string, unknown>>
      : [];
    if (!sessionId || parts.length === 0 || completingContractMultipart) return;

    setCompletingContractMultipart(true);
    setError(null);
    try {
      for (const [index, part] of parts.entries()) {
        const partNumber = asNumber(part.partNumber) ?? index + 1;
        const bytes = typeof asNumber(part.endByte) === "number" && typeof asNumber(part.startByte) === "number"
          ? Math.max(1, (asNumber(part.endByte) ?? 0) - (asNumber(part.startByte) ?? 0) + 1)
          : 1024 * 1024;
        setContractMultipartProgress((current) => ({ ...current, [partNumber]: "uploading" }));
        await uploadMultipartPart({
          sessionId,
          partNumber,
          contentLength: bytes
        });
        setContractMultipartProgress((current) => ({ ...current, [partNumber]: "uploaded" }));
      }
      await completeMultipartUploadSession({
        sessionId,
        parts: parts.map((part, index) => ({
          partNumber: asNumber(part.partNumber) ?? index + 1,
          etag: `etag-part-${asNumber(part.partNumber) ?? index + 1}`
        }))
      });
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "No se pudo completar la sesión multipart contractual.");
    } finally {
      setCompletingContractMultipart(false);
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

  async function handleManualSave() {
    if (!selectedJob || saving) return;
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
            : "Selecciona un trabajo y presiona Iniciar"}
        </p>

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

        <div style={{ marginBottom: "18px", maxWidth: "420px", marginInline: "auto" }}>
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
        </div>

        <div style={{ display: "flex", justifyContent: "center", gap: "12px", flexWrap: "wrap" }}>
          {!activeSession ? (
            <button
              data-testid="tracker-start-button"
              onClick={() => void handleStart()}
              disabled={!selectedJob || saving}
              style={primaryButton("#10b981", saving)}
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
        <MetricCard label="Esta semana" value={fmtSeconds(weekSeconds)} color="var(--brand)" />
        <MetricCard label="Este mes" value={fmtSeconds(monthSeconds)} color="#10b981" />
        <MetricCard label="Sesiones" value={String(sessions.length)} color="#8b5cf6" />
        <MetricCard label="Liberado" value={formatMoney(releasedAmount)} color="var(--accent)" />
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
              <input value={manualNotes} onChange={(event) => setManualNotes(event.target.value)} placeholder="Descripción de la actividad" style={inputStyle()} />
              <div style={{ display: "flex", gap: "8px" }}>
                <button onClick={() => void handleManualSave()} disabled={!selectedJob || saving} style={primaryButton("var(--brand)", saving)}>
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

          <div style={{ marginTop: "16px", paddingTop: "16px", borderTop: "1px solid var(--border)", display: "grid", gap: "10px" }}>
            <div>
              <p style={{ fontSize: "13px", fontWeight: 700, color: "var(--ink)" }}>Planificar documento contractual</p>
              <p style={{ fontSize: "12px", color: "var(--muted)", lineHeight: 1.5, marginTop: "4px" }}>
                Calcula si el contrato debe subirse directo o por transferencia externa antes de adjuntarlo al trabajo.
              </p>
            </div>
            <input
              value={contractFilename}
              onChange={(event) => setContractFilename(event.target.value)}
              placeholder="contrato-operativo.pdf"
              style={inputStyle()}
            />
            <input
              value={contractSizeMb}
              onChange={(event) => setContractSizeMb(event.target.value)}
              type="number"
              min="1"
              step="1"
              placeholder="Tamaño en MB"
              style={inputStyle()}
            />
            <button onClick={() => void handlePlanContractUpload()} disabled={planningContract} style={primaryButton("#0f766e", planningContract)}>
              {planningContract ? "Planificando..." : "Planificar carga contractual"}
            </button>
            {contractUploadPlan ? (
              <div style={{ padding: "12px", borderRadius: "12px", border: "1px solid rgba(15,118,110,.18)", background: "rgba(15,118,110,.06)", display: "grid", gap: "6px" }}>
                <p style={{ fontSize: "12px", fontWeight: 700, color: "#0f766e" }}>
                  Estrategia: {asString(contractUploadPlan.recommendedStrategy) ?? "—"}
                </p>
                <p style={{ fontSize: "12px", color: "var(--muted)" }}>
                  {asString(contractUploadPlan.uploadGuidance) ?? "Sin guía operativa"}
                </p>
                <p style={{ fontSize: "11px", color: "var(--muted)" }}>
                  Límite simple: {Math.round((asNumber(contractUploadPlan.maxSingleUploadBytes) ?? 0) / (1024 * 1024))} MB
                </p>
              </div>
            ) : null}
            {contractMultipartSession ? (
              <div style={{ padding: "12px", borderRadius: "12px", border: "1px solid rgba(20,184,166,.22)", background: "rgba(20,184,166,.08)", display: "grid", gap: "6px" }}>
                <p style={{ fontSize: "12px", fontWeight: 700, color: "#0f766e" }}>
                  Sesión multipart contractual
                </p>
                <p style={{ fontSize: "12px", color: "var(--muted)" }}>
                  ID: {asString(contractMultipartSession.sessionId) ?? "—"} · proveedor: {asString(contractMultipartSession.provider) ?? "—"}
                </p>
                <p style={{ fontSize: "11px", color: "var(--muted)" }}>
                  Partes: {Array.isArray(contractMultipartSession.parts) ? contractMultipartSession.parts.length : 0}
                </p>
                {Array.isArray(contractMultipartSession.parts)
                  ? (contractMultipartSession.parts as Array<Record<string, unknown>>).slice(0, 4).map((part, index) => {
                      const partNumber = asNumber(part.partNumber) ?? index + 1;
                      return (
                        <p key={partNumber} style={{ fontSize: "11px", color: "var(--muted)" }}>
                          Parte {partNumber}: {contractMultipartProgress[partNumber] ?? "pending"}
                        </p>
                      );
                    })
                  : null}
                <button
                  onClick={() => void handleCompleteContractMultipart()}
                  disabled={completingContractMultipart}
                  style={primaryButton("#0f766e", completingContractMultipart)}
                >
                  {completingContractMultipart ? "Cerrando sesión..." : "Completar sesión multipart"}
                </button>
              </div>
            ) : null}
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
