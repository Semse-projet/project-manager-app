"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  Activity, AlertTriangle, BadgeCheck, Clock, DollarSign, Pause, Play,
  RefreshCw, Search, ShieldAlert, Timer, Users,
} from "lucide-react";
import { AdminPageHeader } from "../../../components/admin/AdminPageHeader";
import { Pagination } from "../../../components/admin/Pagination";
import { fetchUsers, type UserView } from "../../../semse-api";

// ── Types (contrato del labor-engine admin overview) ─────────────────────────

type AdminTimeEntry = {
  id: string;
  createdBy: string;
  mode: string;
  purpose: string;
  jobId: string | null;
  freeProjectId: string | null;
  status: string;
  startedAt: string;
  resumedAt: string | null;
  pausedAt: string | null;
  accumulatedSeconds: number;
  hourlyRate: string | number | null;
  notes: string | null;
};

type TeamMember = {
  workerId: string;
  totalMinutes: number;
  totalEntries: number;
  knownCost: number;
  minutesWithoutRate: number;
};

type QualityAlert = {
  type: "stale_timer" | "overtime" | "long_entry";
  severity: "warning" | "critical";
  workerId: string;
  entryId?: string;
  detail: string;
};

type AdminOverview = {
  period: { from: string; to: string };
  activeTimers: AdminTimeEntry[];
  team: TeamMember[];
  alerts: QualityAlert[];
  thresholds: { staleTimerHours: number; overtimeWeekMinutes: number; longEntryMinutes: number };
  generatedAt: string;
};

type LaborRates = {
  nationalBaselineHourlyRate: number;
  override: { laborRatePerHr: string | number } | null;
};

type JobOption = { id: string; title: string; status?: string };

type MatchCandidate = {
  userId: string;
  email: string;
  score: number;
  percentileRank: number;
  verificationStatus: string;
  trustScore: number;
  avgRating: number;
  completedJobs: number;
};

type MatchResult = {
  jobId: string;
  jobTitle: string;
  candidatesEvaluated: number;
  candidates: MatchCandidate[];
  algorithmVersion: string;
};

// ── Helpers ───────────────────────────────────────────────────────────────────

async function fetchJson<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(path, init);
  const json = await response.json().catch(() => ({})) as { data?: T; error?: { message?: unknown } };
  if (!response.ok) {
    const message = typeof json.error?.message === "string" ? json.error.message : `HTTP ${response.status}`;
    throw new Error(message);
  }
  return json.data as T;
}

function fmtHours(minutes: number) {
  return `${(minutes / 60).toFixed(1)}h`;
}

function fmtMoney(value: number) {
  return `$${value.toLocaleString("en-US", { maximumFractionDigits: 0 })}`;
}

function entryElapsedSeconds(entry: AdminTimeEntry, nowMs: number) {
  if (entry.status !== "running") return entry.accumulatedSeconds;
  const anchor = entry.resumedAt ?? entry.startedAt;
  const anchorMs = new Date(anchor).getTime();
  if (Number.isNaN(anchorMs)) return entry.accumulatedSeconds;
  return entry.accumulatedSeconds + Math.max(0, Math.floor((nowMs - anchorMs) / 1000));
}

function fmtElapsed(seconds: number) {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

function entryTarget(entry: AdminTimeEntry, jobById: Map<string, JobOption>) {
  if (entry.jobId) {
    const job = jobById.get(entry.jobId);
    return { label: job ? job.title : `Job ${entry.jobId.slice(0, 10)}…`, color: "#3b82f6" };
  }
  if (entry.freeProjectId) return { label: "Proyecto libre", color: "#f59e0b" };
  return { label: "Personal", color: "#94a3b8" };
}

const ALERT_META: Record<QualityAlert["type"], { label: string; icon: typeof AlertTriangle }> = {
  stale_timer: { label: "Timer olvidado", icon: Timer },
  overtime: { label: "Overtime", icon: Clock },
  long_entry: { label: "Jornada excesiva", icon: ShieldAlert },
};

// ── Page ──────────────────────────────────────────────────────────────────────

export default function AdminLaborEnginePage() {
  const [overview, setOverview] = useState<AdminOverview | null>(null);
  const [rates, setRates] = useState<LaborRates | null>(null);
  const [jobs, setJobs] = useState<JobOption[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [nowMs, setNowMs] = useState(() => Date.now());

  const [matchJobId, setMatchJobId] = useState("");
  const [matchResult, setMatchResult] = useState<MatchResult | null>(null);
  const [matchLoading, setMatchLoading] = useState(false);
  const [matchError, setMatchError] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [users, setUsers] = useState<UserView[]>([]);
  const [timersPage, setTimersPage] = useState(0);
  const [teamPage, setTeamPage] = useState(0);
  const pageSize = 8;

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [overviewRes, ratesRes, jobsRes, usersRes] = await Promise.allSettled([
        fetchJson<AdminOverview>("/api/semse/labor/admin/overview"),
        fetchJson<LaborRates>("/api/semse/pricing/labor-rates"),
        fetchJson<JobOption[]>("/api/semse/jobs"),
        fetchUsers(),
      ]);
      if (overviewRes.status === "fulfilled") { setOverview(overviewRes.value); setTimersPage(0); setTeamPage(0); }
      else setOverview(null);
      if (ratesRes.status === "fulfilled") setRates(ratesRes.value);
      else setRates(null);
      if (jobsRes.status === "fulfilled") {
        setJobs(jobsRes.value);
        setMatchJobId((prev) => prev || jobsRes.value[0]?.id || "");
      } else {
        setJobs([]);
      }
      if (usersRes.status === "fulfilled") setUsers(usersRes.value);
      else setUsers([]);
      const failed: string[] = [];
      if (overviewRes.status === "rejected") failed.push("resumen");
      if (ratesRes.status === "rejected") failed.push("tarifas");
      if (jobsRes.status === "rejected") failed.push("jobs");
      if (usersRes.status === "rejected") failed.push("usuarios");
      if (failed.length > 0) {
        setError(`Falla parcial de carga: ${failed.join(", ")}.`);
      }
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "No se pudo cargar el Labor Engine.");
    } finally {
      setLoading(false);
    }
  }, []);

  async function handleAlertPause(entryId: string, workerLabel: string) {
    if (typeof window !== "undefined" && !window.confirm(`¿Pausar el timer de ${workerLabel}?`)) return;
    setActionLoading(true);
    setActionError(null);
    try {
      const res = await fetch(`/api/semse/labor/admin/timer/${encodeURIComponent(entryId)}/pause`, {
        method: "POST",
        credentials: "include",
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({ error: { message: "No se pudo pausar el timer." } }));
        throw new Error(d.error?.message ?? "No se pudo pausar el timer.");
      }
      await load();
    } catch (caught) {
      setActionError(caught instanceof Error ? caught.message : "No se pudo pausar el timer.");
    } finally {
      setActionLoading(false);
    }
  }

  async function handleAlertStop(entryId: string, workerLabel: string) {
    if (typeof window !== "undefined" && !window.confirm(`¿Detener el timer de ${workerLabel}?`)) return;
    setActionLoading(true);
    setActionError(null);
    try {
      const res = await fetch(`/api/semse/labor/admin/timer/${encodeURIComponent(entryId)}/stop`, {
        method: "POST",
        credentials: "include",
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({ error: { message: "No se pudo detener el timer." } }));
        throw new Error(d.error?.message ?? "No se pudo detener el timer.");
      }
      await load();
    } catch (caught) {
      setActionError(caught instanceof Error ? caught.message : "No se pudo detener el timer.");
    } finally {
      setActionLoading(false);
    }
  }

  useEffect(() => {
    void load();
    const refresh = setInterval(() => void load(), 30_000);
    return () => clearInterval(refresh);
  }, [load]);

  useEffect(() => {
    const tick = setInterval(() => setNowMs(Date.now()), 1000);
    return () => clearInterval(tick);
  }, []);

  const baselineRate = useMemo(() => {
    if (!rates) return null;
    const override = rates.override?.laborRatePerHr != null ? Number(rates.override.laborRatePerHr) : null;
    return override != null && Number.isFinite(override) ? override : rates.nationalBaselineHourlyRate;
  }, [rates]);

  const teamWithCost = useMemo(() => (overview?.team ?? []).map((member) => ({
    ...member,
    estimatedCost: member.knownCost + (baselineRate != null ? (member.minutesWithoutRate / 60) * baselineRate : 0),
  })), [overview?.team, baselineRate]);

  const totalTeamMinutes = teamWithCost.reduce((sum, member) => sum + member.totalMinutes, 0);
  const totalTeamCost = teamWithCost.reduce((sum, member) => sum + member.estimatedCost, 0);

  const userById = useMemo(() => {
    const map = new Map<string, UserView>();
    for (const user of users) map.set(user.id, user);
    return map;
  }, [users]);

  const jobById = useMemo(() => {
    const map = new Map<string, JobOption>();
    for (const job of jobs) map.set(job.id, job);
    return map;
  }, [jobs]);

  function displayName(userId: string) {
    const user = userById.get(userId);
    if (user) {
      const local = user.email.split("@")[0];
      return local ? local.charAt(0).toUpperCase() + local.slice(1) : user.email;
    }
    return userId.slice(0, 12);
  }

  const pagedTimers = useMemo(() => {
    const start = timersPage * pageSize;
    return (overview?.activeTimers ?? []).slice(start, start + pageSize);
  }, [overview?.activeTimers, timersPage, pageSize]);

  const pagedTeam = useMemo(() => {
    const start = teamPage * pageSize;
    return teamWithCost.slice(start, start + pageSize);
  }, [teamWithCost, teamPage, pageSize]);

  const runMatch = useCallback(async () => {
    if (!matchJobId) return;
    setMatchLoading(true);
    setMatchError(null);
    try {
      const result = await fetchJson<MatchResult>("/api/semse/matching", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ jobId: matchJobId, limit: 8 }),
      });
      setMatchResult(result);
    } catch (caught) {
      setMatchError(caught instanceof Error ? caught.message : "No se pudo ejecutar SmartMatch.");
    } finally {
      setMatchLoading(false);
    }
  }, [matchJobId]);

  return (
    <div style={{ maxWidth: 1080, margin: "0 auto", padding: "28px 20px", color: "var(--ink)" }}>
      <AdminPageHeader
        title="Labor Engine — Supervisión"
        subtitle={
          <>
            Timers del equipo en tiempo real, QualityGuard, costos y SmartMatch
            {overview ? ` · actualizado ${new Date(overview.generatedAt).toLocaleTimeString("es-MX")}` : ""}
          </>
        }
        icon={Activity}
        iconColor="#3b82f6"
        iconBg="rgba(59,130,246,.15)"
        actions={
          <button onClick={() => void load()} disabled={loading}
            style={{ padding: "8px 14px", borderRadius: 10, background: "rgba(255,255,255,.05)", border: "1px solid var(--border)", cursor: "pointer", color: "var(--muted)" }}>
            <RefreshCw size={13} style={{ animation: loading ? "spin 1s linear infinite" : "none" }} />
          </button>
        }
      />

      {error ? (
        <div style={{ padding: "10px 14px", background: "rgba(239,68,68,.1)", borderRadius: 10, fontSize: 12, color: "#fca5a5", marginBottom: 14 }}>{error}</div>
      ) : null}

      {/* Stats */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(170px, 1fr))", gap: 10, marginBottom: 22 }}>
        {[
          { label: "Timers activos", value: overview ? String(overview.activeTimers.length) : "—", icon: Timer, color: "#10b981" },
          { label: "Horas equipo (semana)", value: overview ? fmtHours(totalTeamMinutes) : "—", icon: Clock, color: "#3b82f6" },
          { label: "Workers con horas", value: overview ? String(overview.team.length) : "—", icon: Users, color: "#8b5cf6" },
          { label: "Costo estimado", value: overview ? fmtMoney(totalTeamCost) : "—", icon: DollarSign, color: "#f59e0b" },
          { label: "Alertas QualityGuard", value: overview ? String(overview.alerts.length) : "—", icon: AlertTriangle, color: overview && overview.alerts.length > 0 ? "#ef4444" : "#10b981" },
        ].map(({ label, value, icon: Icon, color }) => (
          <div key={label} style={{ padding: "14px 16px", background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 12 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
              <Icon size={13} color={color} />
              <span style={{ fontSize: 10, color: "var(--muted)", fontWeight: 700 }}>{label}</span>
            </div>
            <div style={{ fontSize: 22, fontWeight: 900, color }}>{value}</div>
          </div>
        ))}
      </div>

      {actionError ? (
        <div role="alert" style={{ padding: "10px 14px", background: "rgba(239,68,68,.1)", borderRadius: 10, fontSize: 12, color: "#fca5a5", marginBottom: 16 }}>{actionError}</div>
      ) : null}

      {/* QualityGuard alerts */}
      {overview && overview.alerts.length > 0 ? (
        <div style={{ background: "var(--surface)", border: "1px solid rgba(239,68,68,.25)", borderRadius: 14, overflow: "hidden", marginBottom: 22 }}>
          <div style={{ padding: "12px 18px", borderBottom: "1px solid var(--border)", display: "flex", alignItems: "center", gap: 8 }}>
            <ShieldAlert size={14} color="#ef4444" />
            <span style={{ fontSize: 12, fontWeight: 800 }}>QualityGuard — {overview.alerts.length} alerta(s)</span>
          </div>
          {overview.alerts.map((alert, index) => {
            const meta = ALERT_META[alert.type];
            const color = alert.severity === "critical" ? "#ef4444" : "#f59e0b";
            const workerLabel = displayName(alert.workerId);
            const canAct = Boolean(alert.entryId);
            return (
              <div key={`${alert.type}-${alert.entryId ?? alert.workerId}-${index}`} style={{ display: "flex", alignItems: "center", gap: 12, padding: "10px 18px", borderBottom: "1px solid var(--border)" }}>
                <meta.icon size={14} color={color} />
                <span style={{ fontSize: 10, fontWeight: 800, color, background: `${color}18`, padding: "2px 8px", borderRadius: 99, flexShrink: 0 }}>
                  {meta.label}
                </span>
                <span style={{ fontSize: 12, color: "var(--ink)", fontWeight: 600 }}>{workerLabel}…</span>
                <span style={{ fontSize: 12, color: "var(--muted)", flex: 1 }}>{alert.detail}</span>
                <div style={{ display: "flex", gap: 6 }}>
                  {canAct && alert.type === "stale_timer" && (
                    <>
                      <button
                        onClick={() => void handleAlertPause(alert.entryId!, `worker ${workerLabel}`)}
                        disabled={actionLoading}
                        style={{ padding: "4px 10px", borderRadius: 8, border: "1px solid var(--border)", background: "rgba(251,191,36,.1)", color: "#fbbf24", fontSize: 11, fontWeight: 700, cursor: actionLoading ? "not-allowed" : "pointer", opacity: actionLoading ? 0.6 : 1 }}
                      >
                        Pausar
                      </button>
                      <button
                        onClick={() => void handleAlertStop(alert.entryId!, `worker ${workerLabel}`)}
                        disabled={actionLoading}
                        style={{ padding: "4px 10px", borderRadius: 8, border: "1px solid var(--border)", background: "rgba(239,68,68,.1)", color: "#fca5a5", fontSize: 11, fontWeight: 700, cursor: actionLoading ? "not-allowed" : "pointer", opacity: actionLoading ? 0.6 : 1 }}
                      >
                        Detener
                      </button>
                    </>
                  )}
                  <Link href={`/admin/users/${alert.workerId}`} style={{ padding: "4px 10px", borderRadius: 8, border: "1px solid var(--border)", background: "rgba(255,255,255,.05)", color: "var(--muted)", fontSize: 11, fontWeight: 700, textDecoration: "none" }}>
                    Ver perfil
                  </Link>
                </div>
              </div>
            );
          })}
        </div>
      ) : null}

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 22 }}>
        {/* Active timers */}
        <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 14, overflow: "hidden" }}>
          <div style={{ padding: "12px 18px", borderBottom: "1px solid var(--border)", display: "flex", alignItems: "center", gap: 8 }}>
            <Timer size={14} color="#10b981" />
            <span style={{ fontSize: 12, fontWeight: 800 }}>Timers activos ({overview?.activeTimers.length ?? 0})</span>
          </div>
          {!overview || overview.activeTimers.length === 0 ? (
            <div style={{ padding: 24, textAlign: "center", fontSize: 12, color: "var(--muted)" }}>
              {overview ? "Nadie está trackeando tiempo ahora." : "Cargando…"}
            </div>
          ) : (
            pagedTimers.map((entry) => {
              const target = entryTarget(entry, jobById);
              const running = entry.status === "running";
              return (
                <div key={entry.id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 18px", borderBottom: "1px solid var(--border)" }}>
                  {running ? <Play size={13} color="#10b981" /> : <Pause size={13} color="#f59e0b" />}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{ margin: 0, fontSize: 12, fontWeight: 700, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {displayName(entry.createdBy)}
                    </p>
                    <p style={{ margin: 0, fontSize: 10, color: target.color, fontWeight: 700 }}>{target.label}</p>
                  </div>
                  <span style={{ fontSize: 14, fontWeight: 800, fontVariantNumeric: "tabular-nums", color: running ? "#10b981" : "#f59e0b" }}>
                    {fmtElapsed(entryElapsedSeconds(entry, nowMs))}
                  </span>
                </div>
              );
            })
          )}
          <Pagination page={timersPage} pageSize={pageSize} total={overview?.activeTimers.length ?? 0} onPageChange={setTimersPage} />
        </div>

        {/* Team hours + cost */}
        <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 14, overflow: "hidden" }}>
          <div style={{ padding: "12px 18px", borderBottom: "1px solid var(--border)", display: "flex", alignItems: "center", gap: 8 }}>
            <Users size={14} color="#8b5cf6" />
            <span style={{ fontSize: 12, fontWeight: 800 }}>Equipo — semana actual</span>
            {baselineRate != null ? (
              <span style={{ marginLeft: "auto", fontSize: 10, color: "var(--muted)" }}>
                Tarifa base pricing: ${baselineRate}/h
              </span>
            ) : null}
          </div>
          {teamWithCost.length === 0 ? (
            <div style={{ padding: 24, textAlign: "center", fontSize: 12, color: "var(--muted)" }}>
              {overview ? "Sin horas completadas esta semana." : "Cargando…"}
            </div>
          ) : (
            pagedTeam.map((member) => (
              <div key={member.workerId} style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 18px", borderBottom: "1px solid var(--border)" }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p style={{ margin: 0, fontSize: 12, fontWeight: 700, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {displayName(member.workerId)}
                  </p>
                  <p style={{ margin: 0, fontSize: 10, color: "var(--muted)" }}>{member.totalEntries} entrada(s)</p>
                </div>
                <span style={{ fontSize: 12, fontWeight: 800, color: "#3b82f6" }}>{fmtHours(member.totalMinutes)}</span>
                <span style={{ fontSize: 12, fontWeight: 800, color: "#f59e0b", minWidth: 64, textAlign: "right" }}>
                  {fmtMoney(member.estimatedCost)}
                </span>
              </div>
            ))
          )}
          <Pagination page={teamPage} pageSize={pageSize} total={teamWithCost.length} onPageChange={setTeamPage} />
        </div>
      </div>

      {/* SmartMatch */}
      <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 14, overflow: "hidden" }}>
        <div style={{ padding: "12px 18px", borderBottom: "1px solid var(--border)", display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
          <Search size={14} color="#3b82f6" />
          <span style={{ fontSize: 12, fontWeight: 800 }}>SmartMatch — candidatos para un job</span>
          <div style={{ marginLeft: "auto", display: "flex", gap: 8, alignItems: "center" }}>
            <select
              value={matchJobId}
              onChange={(event) => setMatchJobId(event.target.value)}
              style={{ padding: "7px 10px", borderRadius: 8, border: "1px solid var(--border)", background: "var(--bg)", color: "var(--ink)", fontSize: 12, maxWidth: 260 }}
            >
              {jobs.length === 0 ? <option value="">Sin jobs disponibles</option> : null}
              {jobs.map((job) => (
                <option key={job.id} value={job.id}>{job.title}</option>
              ))}
            </select>
            <button
              type="button"
              onClick={() => void runMatch()}
              disabled={!matchJobId || matchLoading}
              style={{ padding: "7px 14px", borderRadius: 8, border: "1px solid rgba(59,130,246,.4)", background: "rgba(59,130,246,.12)", color: "#3b82f6", fontSize: 11, fontWeight: 800, cursor: "pointer", opacity: !matchJobId || matchLoading ? 0.6 : 1 }}
            >
              {matchLoading ? "Calculando…" : "Ejecutar match"}
            </button>
          </div>
        </div>

        {matchError ? (
          <div style={{ padding: "10px 18px", fontSize: 12, color: "#fca5a5" }}>{matchError}</div>
        ) : null}

        {!matchResult ? (
          <div style={{ padding: 24, textAlign: "center", fontSize: 12, color: "var(--muted)" }}>
            Selecciona un job y ejecuta el match para ver los mejores candidatos según el algoritmo real (Jaccard + trust).
          </div>
        ) : (
          <>
            <div style={{ padding: "8px 18px", fontSize: 11, color: "var(--muted)", borderBottom: "1px solid var(--border)" }}>
              {matchResult.jobTitle} · {matchResult.candidatesEvaluated} candidato(s) evaluado(s) · algoritmo {matchResult.algorithmVersion}
            </div>
            {matchResult.candidates.length === 0 ? (
              <div style={{ padding: 24, textAlign: "center", fontSize: 12, color: "var(--muted)" }}>
                Sin candidatos que superen el umbral para este job.
              </div>
            ) : (
              matchResult.candidates.map((candidate, index) => (
                <div key={candidate.userId} style={{ display: "flex", alignItems: "center", gap: 12, padding: "10px 18px", borderBottom: "1px solid var(--border)" }}>
                  <span style={{ fontSize: 11, fontWeight: 900, color: "var(--muted)", width: 20 }}>#{index + 1}</span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{ margin: 0, fontSize: 12, fontWeight: 700, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {candidate.email}
                      {candidate.verificationStatus === "verified" ? (
                        <BadgeCheck size={12} color="#10b981" style={{ marginLeft: 6, verticalAlign: "-2px" }} />
                      ) : null}
                    </p>
                    <p style={{ margin: 0, fontSize: 10, color: "var(--muted)" }}>
                      trust {Math.round(candidate.trustScore * 100)} · ⭐ {candidate.avgRating.toFixed(1)} · {candidate.completedJobs} jobs
                    </p>
                  </div>
                  <div style={{ width: 120, display: "flex", alignItems: "center", gap: 8 }}>
                    <div style={{ flex: 1, height: 6, background: "rgba(148,163,184,.18)", borderRadius: 99, overflow: "hidden" }}>
                      <div style={{ width: `${Math.round(candidate.score * 100)}%`, height: "100%", background: "#3b82f6" }} />
                    </div>
                    <span style={{ fontSize: 11, fontWeight: 800, color: "#3b82f6", minWidth: 30, textAlign: "right" }}>
                      {Math.round(candidate.score * 100)}
                    </span>
                  </div>
                </div>
              ))
            )}
          </>
        )}
      </div>

      <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
