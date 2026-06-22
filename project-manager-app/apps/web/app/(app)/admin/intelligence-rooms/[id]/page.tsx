"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";

// ── Types ──────────────────────────────────────────────────────────────────────

type OperationalSignal = {
  id: string;
  type: string;
  severity: "low" | "medium" | "high" | "critical";
  status: "open" | "acknowledged" | "resolved" | "dismissed";
  title: string;
  message: string;
  recommendedAction?: string;
  milestoneId?: string;
  createdAt: string;
};

type PrometeoBrief = {
  generatedAt: string;
  openSignalCount: number;
  criticalCount: number;
  highCount: number;
  systemStatus: "healthy" | "attention" | "high_risk" | "critical";
  summary: string;
  nextAction: string | null;
  sections: Array<{
    priority: number;
    severity: string;
    headline: string;
    action: string;
  }>;
};

type BuildOpsProject = {
  id: string;
  title: string;
  trade?: string;
  projectType?: string;
  status?: string;
  riskLevel?: string;
  clientName?: string;
  professionalName?: string | null;
};

type IntelligenceRun = {
  id: string;
  triggerEvent: string;
  signalsCreated: string[];
  status: string;
  durationMs?: number;
  createdAt: string;
};

type ActivityEvent = {
  id: string;
  type: string;
  title: string;
  detail: string;
  severity: "info" | "warning" | "critical";
  occurredAt: string;
  entityType: string;
  entityId: string;
};

// ── Helpers ────────────────────────────────────────────────────────────────────

const SEVERITY_COLOR: Record<string, string> = {
  critical: "#ef4444", high: "#f97316", medium: "#eab308", low: "#3b82f6",
};

const STATUS_COLOR: Record<string, string> = {
  active: "#22c55e", in_review: "#3b82f6", paused: "#eab308",
  completed: "#22c55e", cancelled: "#ef4444",
};

const RISK_COLOR: Record<string, string> = {
  low: "#22c55e", medium: "#eab308", high: "#f97316", critical: "#ef4444",
};

function timeAgo(d: string): string {
  const mins = Math.floor((Date.now() - new Date(d).getTime()) / 60_000);
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

// ── Page ───────────────────────────────────────────────────────────────────────

export default function IntelligenceRoomPage() {
  const params = useParams();
  const projectId = params?.id as string;

  const [project, setProject] = useState<BuildOpsProject | null>(null);
  const [signals, setSignals] = useState<OperationalSignal[]>([]);
  const [brief, setBrief] = useState<PrometeoBrief | null>(null);
  const [runs, setRuns] = useState<IntelligenceRun[]>([]);
  const [activity, setActivity] = useState<ActivityEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    if (!projectId) return;
    setLoading(true);
    try {
      const [projRes, sigRes, briefRes, runRes, actRes] = await Promise.all([
        fetch(`/api/semse/buildops/projects/${projectId}`, { credentials: "include" }).catch(() => null),
        fetch(`/api/semse/operational-signals?buildOpsProjectId=${projectId}&limit=50`, { credentials: "include" }),
        fetch(`/api/semse/prometeo-brief?buildOpsProjectId=${projectId}`, { credentials: "include" }).catch(() => null),
        fetch(`/api/semse/intelligence-runs?limit=10`, { credentials: "include" }).catch(() => null),
        fetch(`/api/semse/buildops/projects/${projectId}/activity?limit=30`, { credentials: "include" }).catch(() => null),
      ]);

      if (projRes?.ok) {
        const p = (await projRes.json()) as { data?: BuildOpsProject };
        setProject(p.data ?? null);
      }
      if (sigRes.ok) {
        const s = (await sigRes.json()) as { data?: OperationalSignal[] };
        setSignals(s.data ?? []);
      }
      if (briefRes?.ok) {
        const b = (await briefRes.json()) as { data?: PrometeoBrief };
        setBrief(b.data ?? null);
      }
      if (runRes?.ok) {
        const r = (await runRes.json()) as { data?: IntelligenceRun[] };
        setRuns(r.data ?? []);
      }
      if (actRes?.ok) {
        const a = (await actRes.json()) as { data?: { events?: ActivityEvent[] } };
        setActivity(a.data?.events ?? []);
      }
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  useEffect(() => { void fetchData(); }, [fetchData]);

  async function handleAcknowledge(id: string) {
    setActionLoading(id);
    try {
      await fetch(`/api/semse/operational-signals/${id}/acknowledge`, { method: "PATCH", credentials: "include" });
      setSignals((prev) => prev.map((s) => s.id === id ? { ...s, status: "acknowledged" as const } : s));
    } finally { setActionLoading(null); }
  }

  async function handleResolve(id: string) {
    setActionLoading(id);
    try {
      await fetch(`/api/semse/operational-signals/${id}/resolve`, { method: "PATCH", credentials: "include" });
      setSignals((prev) => prev.map((s) => s.id === id ? { ...s, status: "resolved" as const } : s));
    } finally { setActionLoading(null); }
  }

  async function handleDismiss(id: string) {
    setActionLoading(id);
    try {
      await fetch(`/api/semse/operational-signals/${id}/dismiss`, { method: "PATCH", credentials: "include" });
      setSignals((prev) => prev.map((s) => s.id === id ? { ...s, status: "dismissed" as const } : s));
    } finally { setActionLoading(null); }
  }

  const openSignals = signals.filter((s) => s.status === "open" || s.status === "acknowledged");
  const riskColor = RISK_COLOR[project?.riskLevel ?? "low"] ?? "#94a3b8";
  const statusColor = STATUS_COLOR[project?.status ?? "active"] ?? "#94a3b8";

  return (
    <div style={{ padding: "24px", maxWidth: "900px", margin: "0 auto" }}>

      {/* Breadcrumb */}
      <div style={{ marginBottom: "20px", display: "flex", alignItems: "center", gap: "8px", fontSize: "12px", color: "var(--faint, #4b6280)" }}>
        <Link href="/admin/mission-control" style={{ color: "#93c5fd", textDecoration: "none" }}>
          Mission Control
        </Link>
        <span>›</span>
        <span>Intelligence Room</span>
      </div>

      {/* Project Header */}
      <div style={{
        background: "var(--surface, #0c1017)",
        border: "1px solid var(--border, #1f2d3d)",
        borderRadius: "14px",
        padding: "18px 20px",
        marginBottom: "18px",
      }}>
        {loading ? (
          <p style={{ color: "var(--muted, #94a3b8)", fontSize: "14px" }}>Cargando proyecto…</p>
        ) : (
          <>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "12px", marginBottom: "8px" }}>
              <div>
                <h1 style={{ fontSize: "18px", fontWeight: 800, color: "var(--ink, #f1f5f9)", margin: "0 0 4px" }}>
                  {project?.title ?? projectId}
                </h1>
                <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
                  {project?.trade && (
                    <span style={{ fontSize: "11px", color: "var(--muted, #94a3b8)", background: "var(--raised, #111827)", padding: "2px 8px", borderRadius: "4px" }}>
                      {project.trade}
                    </span>
                  )}
                  {project?.status && (
                    <span style={{ fontSize: "11px", color: statusColor, background: `${statusColor}15`, padding: "2px 8px", borderRadius: "4px", fontWeight: 600 }}>
                      {project.status}
                    </span>
                  )}
                  {project?.riskLevel && (
                    <span style={{ fontSize: "11px", color: riskColor, background: `${riskColor}15`, padding: "2px 8px", borderRadius: "4px", fontWeight: 600 }}>
                      Risk: {project.riskLevel}
                    </span>
                  )}
                </div>
              </div>
              <div style={{ display: "flex", gap: "8px" }}>
                <Link
                  href={`/buildops/projects/${projectId}`}
                  style={{ fontSize: "11px", color: "#93c5fd", textDecoration: "none", padding: "6px 12px", border: "1px solid rgba(59,130,246,.3)", borderRadius: "7px" }}
                >
                  Ver en BuildOps →
                </Link>
                <button onClick={() => void fetchData()} style={{ fontSize: "11px", color: "var(--muted, #94a3b8)", padding: "6px 12px", border: "1px solid var(--border, #1f2d3d)", borderRadius: "7px", background: "transparent", cursor: "pointer" }}>
                  ↻
                </button>
              </div>
            </div>
            {(project?.clientName || project?.professionalName) && (
              <div style={{ display: "flex", gap: "16px", fontSize: "12px", color: "var(--muted, #94a3b8)" }}>
                {project.clientName && <span>Cliente: {project.clientName}</span>}
                {project.professionalName && <span>Profesional: {project.professionalName}</span>}
              </div>
            )}
          </>
        )}
      </div>

      {/* Prometeo Brief */}
      {!loading && brief && (
        <div style={{
          background: "linear-gradient(135deg, rgba(139,92,246,.08), rgba(59,130,246,.08))",
          border: "1px solid rgba(139,92,246,.3)",
          borderRadius: "14px",
          padding: "16px 18px",
          marginBottom: "18px",
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "10px" }}>
            <div style={{ width: "26px", height: "26px", borderRadius: "7px", background: "linear-gradient(135deg, #8b5cf6, #3b82f6)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "13px" }}>⚡</div>
            <span style={{ fontSize: "13px", fontWeight: 700, color: "var(--ink, #f1f5f9)" }}>Prometeo Brief — Este proyecto</span>
            <span style={{ fontSize: "10px", color: "var(--faint, #4b6280)", marginLeft: "auto" }}>{new Date(brief.generatedAt).toLocaleTimeString()}</span>
          </div>
          <p style={{ fontSize: "13px", color: "var(--muted, #94a3b8)", lineHeight: 1.6, margin: "0 0 8px" }}>{brief.summary}</p>
          {brief.sections.map((sec) => (
            <div key={sec.priority} style={{ display: "flex", gap: "8px", fontSize: "11px", marginBottom: "4px" }}>
              <span style={{ color: SEVERITY_COLOR[sec.severity] ?? "#94a3b8", fontWeight: 700, minWidth: "60px", textTransform: "uppercase" as const, fontSize: "10px" }}>
                {sec.severity}
              </span>
              <span style={{ color: "var(--ink, #f1f5f9)" }}>{sec.headline}</span>
            </div>
          ))}
          {brief.nextAction && (
            <div style={{ background: "rgba(139,92,246,.1)", border: "1px solid rgba(139,92,246,.2)", borderRadius: "7px", padding: "8px 12px", fontSize: "11px", color: "#c4b5fd", marginTop: "10px" }}>
              🎯 {brief.nextAction}
            </div>
          )}
          {brief.systemStatus === "healthy" && (
            <div style={{ fontSize: "12px", color: "#22c55e" }}>✓ Sin señales activas para este proyecto.</div>
          )}
        </div>
      )}

      {/* Signals Feed */}
      <div style={{ marginBottom: "24px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "12px" }}>
          <p style={{ fontSize: "11px", fontWeight: 700, color: "var(--faint, #4b6280)", textTransform: "uppercase" as const, letterSpacing: "0.08em", margin: 0 }}>
            Señales operacionales
          </p>
          <span style={{ fontSize: "11px", color: "var(--faint, #4b6280)" }}>
            {openSignals.length} activa{openSignals.length !== 1 ? "s" : ""}
          </span>
        </div>

        {loading ? (
          <p style={{ color: "var(--muted, #94a3b8)", fontSize: "13px" }}>Cargando…</p>
        ) : openSignals.length === 0 ? (
          <div style={{ textAlign: "center", padding: "32px", background: "var(--surface, #0c1017)", border: "1px solid var(--border, #1f2d3d)", borderRadius: "12px" }}>
            <div style={{ fontSize: "28px", marginBottom: "8px" }}>✅</div>
            <p style={{ fontSize: "13px", color: "var(--muted, #94a3b8)" }}>Sin señales activas para este proyecto.</p>
          </div>
        ) : (
          openSignals.map((signal) => {
            const color = SEVERITY_COLOR[signal.severity] ?? "#94a3b8";
            const isLoading = actionLoading === signal.id;
            return (
              <div key={signal.id} style={{
                background: "var(--surface, #0c1017)",
                border: `1px solid ${color}35`,
                borderLeft: `3px solid ${color}`,
                borderRadius: "10px",
                padding: "12px 14px",
                marginBottom: "8px",
              }}>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "6px" }}>
                  <div style={{ display: "flex", gap: "6px", alignItems: "center" }}>
                    <span style={{ background: `${color}20`, color, border: `1px solid ${color}40`, borderRadius: "4px", padding: "1px 6px", fontSize: "9px", fontWeight: 700, textTransform: "uppercase" as const }}>{signal.severity}</span>
                    <span style={{ fontSize: "11px", color: "var(--muted, #94a3b8)" }}>{signal.type.replace(/_/g, " ")}</span>
                  </div>
                  <span style={{ fontSize: "10px", color: "var(--faint, #4b6280)" }}>{timeAgo(signal.createdAt)}</span>
                </div>
                <p style={{ fontSize: "13px", fontWeight: 700, color: "var(--ink, #f1f5f9)", margin: "0 0 4px" }}>{signal.title}</p>
                <p style={{ fontSize: "12px", color: "var(--muted, #94a3b8)", margin: "0 0 8px", lineHeight: 1.5 }}>{signal.message}</p>
                {signal.recommendedAction && (
                  <p style={{ fontSize: "11px", color: "#93c5fd", margin: "0 0 8px" }}>💡 {signal.recommendedAction}</p>
                )}
                <div style={{ display: "flex", gap: "6px", justifyContent: "flex-end" }}>
                  {signal.status === "open" && (
                    <button onClick={() => handleAcknowledge(signal.id)} disabled={isLoading} style={{ padding: "4px 10px", borderRadius: "6px", border: "1px solid var(--border, #1f2d3d)", background: "transparent", color: "var(--muted, #94a3b8)", fontSize: "11px", cursor: isLoading ? "not-allowed" : "pointer" }}>
                      {isLoading ? "…" : "Acknowledge"}
                    </button>
                  )}
                  <button onClick={() => handleResolve(signal.id)} disabled={isLoading} style={{ padding: "4px 10px", borderRadius: "6px", border: "1px solid rgba(34,197,94,.3)", background: "rgba(34,197,94,.08)", color: "#86efac", fontSize: "11px", cursor: isLoading ? "not-allowed" : "pointer" }}>
                    {isLoading ? "…" : "Resolve"}
                  </button>
                  {signal.status !== "dismissed" && (
                    <button onClick={() => handleDismiss(signal.id)} disabled={isLoading} style={{ padding: "4px 10px", borderRadius: "6px", border: "1px solid rgba(100,116,139,.3)", background: "rgba(100,116,139,.08)", color: "#94a3b8", fontSize: "11px", cursor: isLoading ? "not-allowed" : "pointer" }}>
                      {isLoading ? "…" : "Dismiss"}
                    </button>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Activity Feed */}
      {!loading && activity.length > 0 && (
        <div style={{ marginBottom: "24px" }}>
          <p style={{ fontSize: "11px", fontWeight: 700, color: "var(--faint, #4b6280)", textTransform: "uppercase" as const, letterSpacing: "0.08em", marginBottom: "10px" }}>
            Actividad del proyecto ({activity.length})
          </p>
          <div style={{ background: "var(--surface, #0c1017)", border: "1px solid var(--border, #1f2d3d)", borderRadius: "10px", overflow: "hidden" }}>
            {activity.slice(0, 15).map((ev, i) => {
              const sevColor = ev.severity === "critical" ? "#ef4444" : ev.severity === "warning" ? "#f97316" : "#3b82f6";
              const typeEmoji: Record<string, string> = {
                milestone: "🏁", change_order: "📋", signal: "🔔", algorithm: "🤖", evidence: "🖼️",
              };
              return (
                <div key={ev.id} style={{
                  padding: "9px 14px",
                  borderBottom: i < Math.min(activity.length, 15) - 1 ? "1px solid var(--border, #1f2d3d)" : "none",
                  display: "flex", gap: "10px", alignItems: "flex-start",
                }}>
                  <span style={{ fontSize: "14px", marginTop: "1px", flexShrink: 0 }}>
                    {typeEmoji[ev.entityType] ?? "●"}
                  </span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "8px" }}>
                      <span style={{ fontSize: "12px", fontWeight: 600, color: "var(--ink, #f1f5f9)" }}>{ev.title}</span>
                      <span style={{ fontSize: "10px", color: "var(--faint, #4b6280)", flexShrink: 0 }}>{timeAgo(ev.occurredAt)}</span>
                    </div>
                    <div style={{ display: "flex", gap: "6px", alignItems: "center", marginTop: "2px" }}>
                      <span style={{
                        fontSize: "9px", fontWeight: 700, textTransform: "uppercase" as const,
                        color: sevColor, background: `${sevColor}15`,
                        border: `1px solid ${sevColor}30`, borderRadius: "3px", padding: "1px 5px",
                      }}>
                        {ev.type.replace(/_/g, " ")}
                      </span>
                      <span style={{ fontSize: "11px", color: "var(--muted, #94a3b8)" }}>{ev.detail}</span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Recent Runs */}
      {!loading && runs.length > 0 && (
        <div>
          <p style={{ fontSize: "11px", fontWeight: 700, color: "var(--faint, #4b6280)", textTransform: "uppercase" as const, letterSpacing: "0.08em", marginBottom: "10px" }}>
            Intelligence Runs recientes
          </p>
          <div style={{ background: "var(--surface, #0c1017)", border: "1px solid var(--border, #1f2d3d)", borderRadius: "10px", overflow: "hidden" }}>
            {runs.slice(0, 6).map((run, i) => (
              <div key={run.id} style={{ padding: "8px 14px", borderBottom: i < 5 ? "1px solid var(--border, #1f2d3d)" : "none", display: "flex", justifyContent: "space-between", alignItems: "center", gap: "8px" }}>
                <div>
                  <span style={{ fontSize: "11px", color: "var(--ink, #f1f5f9)", fontWeight: 600 }}>BuildOpsIntelligenceAgent</span>
                  <span style={{ fontSize: "10px", color: "var(--muted, #94a3b8)", marginLeft: "8px" }}>{run.triggerEvent}</span>
                  {run.signalsCreated.length > 0 && <span style={{ fontSize: "10px", color: "#f97316", marginLeft: "6px" }}>+{run.signalsCreated.length}</span>}
                </div>
                <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
                  {run.durationMs != null && <span style={{ fontSize: "10px", color: "var(--faint, #4b6280)" }}>{run.durationMs}ms</span>}
                  <span style={{ fontSize: "10px", color: run.status === "completed" ? "#22c55e" : "#ef4444", fontWeight: 600 }}>{run.status}</span>
                  <span style={{ fontSize: "10px", color: "var(--faint, #4b6280)" }}>{timeAgo(run.createdAt)}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
