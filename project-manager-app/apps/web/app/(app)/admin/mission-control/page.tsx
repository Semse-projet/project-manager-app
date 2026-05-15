"use client";

import { useEffect, useState, useCallback } from "react";

// ── Types ──────────────────────────────────────────────────────────────────────

type OperationalSignal = {
  id: string;
  type: string;
  severity: "low" | "medium" | "high" | "critical";
  status: "open" | "acknowledged" | "resolved" | "dismissed";
  title: string;
  message: string;
  recommendedAction?: string;
  sourceAgent?: string;
  entityType: string;
  entityId: string;
  jobId?: string;
  buildOpsProjectId?: string;
  milestoneId?: string;
  createdAt: string;
  acknowledgedAt?: string;
  resolvedAt?: string;
};

type IntelligenceRun = {
  id: string;
  agentName: string;
  triggerEvent: string;
  entityType: string;
  entityId: string;
  signalsCreated: string[];
  status: "completed" | "failed";
  durationMs?: number;
  createdAt: string;
};

// ── Helpers ────────────────────────────────────────────────────────────────────

const SEVERITY_COLOR: Record<string, string> = {
  critical: "#ef4444",
  high: "#f97316",
  medium: "#eab308",
  low: "#3b82f6",
};

const SEVERITY_BG: Record<string, string> = {
  critical: "rgba(239,68,68,.12)",
  high: "rgba(249,115,22,.12)",
  medium: "rgba(234,179,8,.12)",
  low: "rgba(59,130,246,.12)",
};

const TYPE_LABEL: Record<string, string> = {
  EVIDENCE_GAP: "Evidence Gap",
  PAYMENT_BLOCKED: "Payment Blocked",
  LOW_CONFIDENCE_ESTIMATE: "Low Confidence",
  CHANGE_ORDER_RECOMMENDED: "Change Order",
  DISPUTE_RISK_HIGH: "Dispute Risk",
};

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60_000);
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

// ── Signal Card ─────────────────────────────────────────────────────────────────

function SignalCard({
  signal,
  onAcknowledge,
  onResolve,
  loading,
}: {
  signal: OperationalSignal;
  onAcknowledge: (id: string) => void;
  onResolve: (id: string) => void;
  loading: string | null;
}) {
  const color = SEVERITY_COLOR[signal.severity] ?? "#94a3b8";
  const bg = SEVERITY_BG[signal.severity] ?? "transparent";

  return (
    <div
      style={{
        background: "var(--surface, #0c1017)",
        border: `1px solid ${color}40`,
        borderLeft: `3px solid ${color}`,
        borderRadius: "12px",
        padding: "16px",
        marginBottom: "10px",
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "8px" }}>
        <div style={{ display: "flex", gap: "8px", alignItems: "center", flexWrap: "wrap" }}>
          <span
            style={{
              background: bg,
              color,
              border: `1px solid ${color}40`,
              borderRadius: "6px",
              padding: "2px 8px",
              fontSize: "10px",
              fontWeight: 700,
              textTransform: "uppercase",
              letterSpacing: "0.06em",
            }}
          >
            {signal.severity.toUpperCase()}
          </span>
          <span
            style={{
              background: "var(--raised, #111827)",
              color: "var(--muted, #94a3b8)",
              borderRadius: "6px",
              padding: "2px 8px",
              fontSize: "10px",
              fontWeight: 600,
            }}
          >
            {TYPE_LABEL[signal.type] ?? signal.type}
          </span>
          {signal.status === "acknowledged" && (
            <span style={{ color: "#eab308", fontSize: "10px", fontWeight: 600 }}>● Acknowledged</span>
          )}
        </div>
        <span style={{ fontSize: "11px", color: "var(--faint, #4b6280)", whiteSpace: "nowrap" }}>
          {timeAgo(signal.createdAt)}
        </span>
      </div>

      <p style={{ fontSize: "14px", fontWeight: 700, color: "var(--ink, #f1f5f9)", marginBottom: "4px" }}>
        {signal.title}
      </p>
      <p style={{ fontSize: "13px", color: "var(--muted, #94a3b8)", marginBottom: "10px", lineHeight: 1.5 }}>
        {signal.message}
      </p>

      {signal.recommendedAction && (
        <div
          style={{
            background: "rgba(59,130,246,.08)",
            border: "1px solid rgba(59,130,246,.2)",
            borderRadius: "8px",
            padding: "8px 12px",
            fontSize: "12px",
            color: "#93c5fd",
            marginBottom: "12px",
          }}
        >
          💡 {signal.recommendedAction}
        </div>
      )}

      <div style={{ display: "flex", gap: "8px", flexWrap: "wrap", alignItems: "center" }}>
        {signal.entityType === "Milestone" && signal.milestoneId && (
          <span style={{ fontSize: "11px", color: "var(--faint, #4b6280)" }}>
            Milestone · {signal.milestoneId.slice(-8)}
          </span>
        )}
        {signal.buildOpsProjectId && (
          <span style={{ fontSize: "11px", color: "var(--faint, #4b6280)" }}>
            BuildOps · {signal.buildOpsProjectId.slice(-8)}
          </span>
        )}
        <div style={{ flex: 1 }} />
        {signal.status === "open" && (
          <button
            onClick={() => onAcknowledge(signal.id)}
            disabled={loading === signal.id}
            style={{
              padding: "5px 12px",
              borderRadius: "7px",
              border: "1px solid var(--border, #1f2d3d)",
              background: "transparent",
              color: "var(--muted, #94a3b8)",
              fontSize: "12px",
              cursor: loading === signal.id ? "not-allowed" : "pointer",
            }}
          >
            {loading === signal.id ? "…" : "Acknowledge"}
          </button>
        )}
        {signal.status !== "resolved" && (
          <button
            onClick={() => onResolve(signal.id)}
            disabled={loading === signal.id}
            style={{
              padding: "5px 12px",
              borderRadius: "7px",
              border: "1px solid rgba(34,197,94,.3)",
              background: "rgba(34,197,94,.08)",
              color: "#86efac",
              fontSize: "12px",
              cursor: loading === signal.id ? "not-allowed" : "pointer",
            }}
          >
            {loading === signal.id ? "…" : "Resolve"}
          </button>
        )}
      </div>
    </div>
  );
}

// ── Main Page ───────────────────────────────────────────────────────────────────

export default function MissionControlPage() {
  const [signals, setSignals] = useState<OperationalSignal[]>([]);
  const [runs, setRuns] = useState<IntelligenceRun[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [filter, setFilter] = useState<"all" | "open" | "critical" | "high">("open");
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [sigRes, runRes] = await Promise.all([
        fetch("/api/semse/operational-signals?limit=100", { credentials: "include" }),
        fetch("/api/semse/intelligence-runs?limit=10", { credentials: "include" }),
      ]);
      const sigData = (await sigRes.json()) as { data?: OperationalSignal[] };
      const runData = (await runRes.json()) as { data?: IntelligenceRun[] };
      setSignals(sigData.data ?? []);
      setRuns(runData.data ?? []);
    } catch {
      setError("No se pudieron cargar las señales operacionales.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void fetchData(); }, [fetchData]);

  async function handleAcknowledge(id: string) {
    setActionLoading(id);
    try {
      await fetch(`/api/semse/operational-signals/${id}/acknowledge`, {
        method: "PATCH",
        credentials: "include",
      });
      setSignals((prev) => prev.map((s) => s.id === id ? { ...s, status: "acknowledged" } : s));
    } finally {
      setActionLoading(null);
    }
  }

  async function handleResolve(id: string) {
    setActionLoading(id);
    try {
      await fetch(`/api/semse/operational-signals/${id}/resolve`, {
        method: "PATCH",
        credentials: "include",
      });
      setSignals((prev) => prev.map((s) => s.id === id ? { ...s, status: "resolved" } : s));
    } finally {
      setActionLoading(null);
    }
  }

  const filtered = signals.filter((s) => {
    if (filter === "open") return s.status === "open" || s.status === "acknowledged";
    if (filter === "critical") return s.severity === "critical";
    if (filter === "high") return s.severity === "high" || s.severity === "critical";
    return true;
  });

  const openCount = signals.filter((s) => s.status === "open").length;
  const criticalCount = signals.filter((s) => s.severity === "critical" && s.status === "open").length;
  const highCount = signals.filter((s) => (s.severity === "high" || s.severity === "critical") && s.status === "open").length;

  return (
    <div style={{ padding: "24px", maxWidth: "900px", margin: "0 auto" }}>
      {/* Header */}
      <div style={{ marginBottom: "28px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "6px" }}>
          <div
            style={{
              width: "10px",
              height: "10px",
              borderRadius: "50%",
              background: criticalCount > 0 ? "#ef4444" : highCount > 0 ? "#f97316" : "#22c55e",
              boxShadow: criticalCount > 0 ? "0 0 8px #ef4444" : "none",
            }}
          />
          <h1 style={{ fontSize: "20px", fontWeight: 800, color: "var(--ink, #f1f5f9)", margin: 0 }}>
            Mission Control
          </h1>
        </div>
        <p style={{ fontSize: "13px", color: "var(--muted, #94a3b8)", margin: 0 }}>
          Señales operacionales del ecosistema SEMSE
        </p>
      </div>

      {/* Stats */}
      <div style={{ display: "flex", gap: "10px", marginBottom: "20px", flexWrap: "wrap" }}>
        {[
          { label: "Abiertas", count: openCount, color: "#3b82f6" },
          { label: "Críticas", count: criticalCount, color: "#ef4444" },
          { label: "Altas", count: highCount, color: "#f97316" },
          { label: "Total", count: signals.length, color: "#94a3b8" },
        ].map((stat) => (
          <div
            key={stat.label}
            style={{
              background: "var(--surface, #0c1017)",
              border: "1px solid var(--border, #1f2d3d)",
              borderRadius: "10px",
              padding: "12px 16px",
              minWidth: "90px",
            }}
          >
            <div style={{ fontSize: "22px", fontWeight: 800, color: stat.color }}>
              {stat.count}
            </div>
            <div style={{ fontSize: "11px", color: "var(--muted, #94a3b8)" }}>{stat.label}</div>
          </div>
        ))}
        <button
          onClick={() => void fetchData()}
          style={{
            marginLeft: "auto",
            padding: "8px 14px",
            borderRadius: "8px",
            border: "1px solid var(--border, #1f2d3d)",
            background: "transparent",
            color: "var(--muted, #94a3b8)",
            fontSize: "12px",
            cursor: "pointer",
          }}
        >
          ↻ Refresh
        </button>
      </div>

      {/* Filters */}
      <div style={{ display: "flex", gap: "8px", marginBottom: "16px" }}>
        {(["open", "high", "critical", "all"] as const).map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            style={{
              padding: "6px 14px",
              borderRadius: "7px",
              border: `1px solid ${filter === f ? "#3b82f6" : "var(--border, #1f2d3d)"}`,
              background: filter === f ? "rgba(59,130,246,.15)" : "transparent",
              color: filter === f ? "#93c5fd" : "var(--muted, #94a3b8)",
              fontSize: "12px",
              fontWeight: filter === f ? 700 : 400,
              cursor: "pointer",
              textTransform: "capitalize",
            }}
          >
            {f === "open" ? "Abiertas" : f === "high" ? "Alta prioridad" : f === "critical" ? "Críticas" : "Todas"}
          </button>
        ))}
      </div>

      {/* Signals */}
      {loading ? (
        <p style={{ color: "var(--muted, #94a3b8)", textAlign: "center", padding: "40px 0" }}>
          Cargando señales…
        </p>
      ) : error ? (
        <div style={{ color: "#ef4444", textAlign: "center", padding: "20px" }}>{error}</div>
      ) : filtered.length === 0 ? (
        <div
          style={{
            textAlign: "center",
            padding: "40px",
            color: "var(--muted, #94a3b8)",
            background: "var(--surface, #0c1017)",
            border: "1px solid var(--border, #1f2d3d)",
            borderRadius: "12px",
          }}
        >
          <div style={{ fontSize: "32px", marginBottom: "8px" }}>✅</div>
          <p style={{ fontSize: "14px" }}>No hay señales operacionales activas.</p>
        </div>
      ) : (
        <div>
          {filtered.map((signal) => (
            <SignalCard
              key={signal.id}
              signal={signal}
              onAcknowledge={handleAcknowledge}
              onResolve={handleResolve}
              loading={actionLoading}
            />
          ))}
        </div>
      )}

      {/* Recent Agent Runs */}
      {runs.length > 0 && (
        <div style={{ marginTop: "32px" }}>
          <h2 style={{ fontSize: "14px", fontWeight: 700, color: "var(--ink, #f1f5f9)", marginBottom: "12px" }}>
            Recent Intelligence Runs
          </h2>
          <div
            style={{
              background: "var(--surface, #0c1017)",
              border: "1px solid var(--border, #1f2d3d)",
              borderRadius: "12px",
              overflow: "hidden",
            }}
          >
            {runs.slice(0, 8).map((run, i) => (
              <div
                key={run.id}
                style={{
                  padding: "10px 14px",
                  borderBottom: i < runs.length - 1 ? "1px solid var(--border, #1f2d3d)" : "none",
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  gap: "12px",
                }}
              >
                <div style={{ flex: 1, minWidth: 0 }}>
                  <span style={{ fontSize: "12px", color: "var(--ink, #f1f5f9)", fontWeight: 600 }}>
                    {run.agentName}
                  </span>
                  <span style={{ fontSize: "11px", color: "var(--muted, #94a3b8)", marginLeft: "8px" }}>
                    {run.triggerEvent}
                  </span>
                  {run.signalsCreated.length > 0 && (
                    <span style={{ fontSize: "10px", color: "#f97316", marginLeft: "8px" }}>
                      +{run.signalsCreated.length} signal{run.signalsCreated.length > 1 ? "s" : ""}
                    </span>
                  )}
                </div>
                <div style={{ display: "flex", gap: "8px", alignItems: "center", flexShrink: 0 }}>
                  {run.durationMs !== undefined && (
                    <span style={{ fontSize: "10px", color: "var(--faint, #4b6280)" }}>{run.durationMs}ms</span>
                  )}
                  <span
                    style={{
                      fontSize: "10px",
                      color: run.status === "completed" ? "#22c55e" : "#ef4444",
                      fontWeight: 600,
                    }}
                  >
                    {run.status}
                  </span>
                  <span style={{ fontSize: "10px", color: "var(--faint, #4b6280)" }}>
                    {timeAgo(run.createdAt)}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
