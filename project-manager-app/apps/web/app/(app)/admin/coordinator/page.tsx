"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Activity, AlertTriangle, CheckCircle, Clock, GitBranch, RefreshCw, XCircle, Zap } from "lucide-react";
import { HtmlInCanvasPanel } from "@semse/ui";
import {
  fetchDelegations,
  type DelegationRecord,
  type DelegationStatus,
} from "../../../semse-api";

// ── Constants ──────────────────────────────────────────────────────────────────

const STATUS_META: Record<DelegationStatus, { label: string; color: string; bg: string; icon: typeof CheckCircle }> = {
  pending:   { label: "Pendiente",  color: "#94a3b8", bg: "rgba(148,163,184,.1)",  icon: Clock        },
  executing: { label: "Ejecutando", color: "#6366f1", bg: "rgba(99,102,241,.12)",  icon: Activity     },
  completed: { label: "Completado", color: "#10b981", bg: "rgba(16,185,129,.12)",  icon: CheckCircle  },
  failed:    { label: "Fallido",    color: "#ef4444", bg: "rgba(239,68,68,.12)",    icon: XCircle      },
  rejected:  { label: "Rechazado",  color: "#f59e0b", bg: "rgba(245,158,11,.12)",  icon: AlertTriangle },
};

const AGENT_COLORS: Record<string, string> = {
  "field-ops":        "#10b981",
  "trust-match":      "#818cf8",
  "pricing":          "#f59e0b",
  "evidence-coach":   "#06b6d4",
  "dispute":          "#ef4444",
  "project-copilot":  "#c084fc",
  "backend-agent":    "#34d399",
  "frontend-agent":   "#60a5fa",
  "qa-agent":         "#f472b6",
  "doc-agent":        "#a78bfa",
};

// ── Sub-components ─────────────────────────────────────────────────────────────

function StatusBadge({ status }: { status: DelegationStatus }) {
  const meta = STATUS_META[status] ?? STATUS_META.pending;
  const Icon = meta.icon;
  return (
    <span style={{
      display: "inline-flex", alignItems: "center", gap: 4,
      padding: "3px 8px", borderRadius: 6, fontSize: 11, fontWeight: 700,
      background: meta.bg, color: meta.color,
    }}>
      <Icon size={10} /> {meta.label}
    </span>
  );
}

function AgentBadge({ agentId }: { agentId: string }) {
  const color = AGENT_COLORS[agentId] ?? "#94a3b8";
  return (
    <span style={{
      padding: "2px 7px", borderRadius: 5, fontSize: 11, fontWeight: 700,
      background: `${color}18`, color,
    }}>
      {agentId}
    </span>
  );
}

function DelegationRow({ d }: { d: DelegationRecord }) {
  const [expanded, setExpanded] = useState(false);
  const hasResult = d.status === "completed" && d.resultJson;
  const hasError  = d.status === "failed" && d.error;
  const elapsed = d.createdAt
    ? Math.round((Date.now() - new Date(d.createdAt).getTime()) / 1000)
    : null;

  return (
    <div style={{
      borderRadius: 10, border: "1px solid var(--border)",
      background: "var(--surface)", overflow: "hidden",
    }}>
      <div
        role="button"
        onClick={() => (hasResult || hasError) && setExpanded((v) => !v)}
        style={{
          display: "grid", gridTemplateColumns: "1fr auto auto auto",
          gap: 12, alignItems: "center",
          padding: "12px 14px",
          cursor: (hasResult || hasError) ? "pointer" : "default",
        }}
      >
        <div>
          <div style={{ fontSize: 13, fontWeight: 700, color: "var(--ink)", marginBottom: 3 }}>
            {d.taskTitle}
          </div>
          <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
            <AgentBadge agentId={d.targetAgentId} />
            {d.projectId && (
              <span style={{ fontSize: 10, color: "var(--muted)" }}>proyecto: {d.projectId.slice(0, 8)}…</span>
            )}
          </div>
        </div>
        <StatusBadge status={d.status} />
        {elapsed !== null && (
          <span style={{ fontSize: 11, color: "var(--muted)" }}>
            {elapsed < 60 ? `${elapsed}s` : elapsed < 3600 ? `${Math.floor(elapsed / 60)}m` : `${Math.floor(elapsed / 3600)}h`}
          </span>
        )}
        <span style={{ fontSize: 10, color: "var(--faint)" }}>
          {(hasResult || hasError) ? (expanded ? "▲" : "▼") : ""}
        </span>
      </div>

      {expanded && hasResult ? (
        <div style={{
          padding: "10px 14px", borderTop: "1px solid var(--border)",
          background: "rgba(16,185,129,.04)",
          fontSize: 12, color: "var(--ink)", lineHeight: 1.6,
        }}>
          <span style={{ fontSize: 10, fontWeight: 700, color: "#10b981", textTransform: "uppercase", letterSpacing: ".06em" }}>Resultado</span>
          <pre style={{ margin: "6px 0 0", fontSize: 11, color: "var(--muted)", whiteSpace: "pre-wrap", wordBreak: "break-all" }}>
            {JSON.stringify(d.resultJson as object, null, 2).slice(0, 1200)}
          </pre>
        </div>
      ) : null}

      {expanded && hasError ? (
        <div style={{
          padding: "10px 14px", borderTop: "1px solid var(--border)",
          background: "rgba(239,68,68,.04)",
          fontSize: 12, color: "#ef4444", lineHeight: 1.6,
        }}>
          <span style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: ".06em" }}>Error</span>
          <p style={{ margin: "6px 0 0", fontSize: 11 }}>{d.error}</p>
        </div>
      ) : null}
    </div>
  );
}

// ── Page ───────────────────────────────────────────────────────────────────────

export default function CoordinatorDashboardPage() {
  const [delegations, setDelegations] = useState<DelegationRecord[]>([]);
  const [filterStatus, setFilterStatus] = useState<DelegationStatus | "all">("all");
  const [filterAgent, setFilterAgent] = useState("all");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastRefresh, setLastRefresh] = useState(new Date());
  const [liveMode, setLiveMode] = useState(true);
  const reloadTimerRef = useRef<number | null>(null);

  const load = useCallback(async (options?: { silent?: boolean }) => {
    if (!options?.silent) {
      setLoading(true);
    }
    setError(null);
    try {
      const data = await fetchDelegations();
      setDelegations(data);
      setLastRefresh(new Date());
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al cargar delegaciones.");
    } finally {
      if (!options?.silent) {
        setLoading(false);
      }
    }
  }, []);

  const scheduleReload = useCallback(() => {
    if (reloadTimerRef.current) {
      window.clearTimeout(reloadTimerRef.current);
    }
    reloadTimerRef.current = window.setTimeout(() => {
      reloadTimerRef.current = null;
      void load({ silent: true });
    }, 350);
  }, [load]);

  // SSE live updates
  useEffect(() => {
    void load(); // initial load

    if (!liveMode) {
      return () => {
        if (reloadTimerRef.current) {
          window.clearTimeout(reloadTimerRef.current);
          reloadTimerRef.current = null;
        }
      };
    }

    const es = new EventSource("/api/semse/agents/delegations/stream");

    es.addEventListener("delegations-update", (e) => {
      try {
        const data = JSON.parse(e.data) as DelegationRecord[] | Record<string, unknown>;
        if (Array.isArray(data)) {
          setDelegations(data);
          setLastRefresh(new Date());
          setLoading(false);
          return;
        }
        scheduleReload();
      } catch {
        scheduleReload();
      }
    });

    es.addEventListener("stream-error", () => {
      es.close();
    });

    return () => {
      es.close();
      if (reloadTimerRef.current) {
        window.clearTimeout(reloadTimerRef.current);
        reloadTimerRef.current = null;
      }
    };
  }, [liveMode, load, scheduleReload]);

  // Counters
  const counts = {
    all:       delegations.length,
    pending:   delegations.filter((d) => d.status === "pending").length,
    executing: delegations.filter((d) => d.status === "executing").length,
    completed: delegations.filter((d) => d.status === "completed").length,
    failed:    delegations.filter((d) => d.status === "failed").length,
    rejected:  delegations.filter((d) => d.status === "rejected").length,
  };

  const agents = Array.from(new Set(delegations.map((d) => d.targetAgentId))).sort();

  const filtered = delegations.filter((d) => {
    if (filterStatus !== "all" && d.status !== filterStatus) return false;
    if (filterAgent  !== "all" && d.targetAgentId !== filterAgent)   return false;
    return true;
  });

  const card: React.CSSProperties = {
    border: "1px solid var(--border)", borderRadius: 16,
    background: "var(--surface)", padding: "18px 20px",
  };

  return (
    <div style={{ maxWidth: "880px", margin: "0 auto", display: "grid", gap: 16 }}>

      {/* Header */}
      <div style={{ ...card, display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <div style={{ width: 42, height: 42, borderRadius: 14, background: "rgba(99,102,241,.15)", display: "grid", placeItems: "center" }}>
            <GitBranch size={20} color="#818cf8" />
          </div>
          <div>
            <h1 style={{ margin: 0, fontSize: 18, fontWeight: 800, color: "var(--ink)" }}>Coordinator Dashboard</h1>
            <p style={{ margin: 0, fontSize: 12, color: "var(--muted)" }}>
              {liveMode ? "🔴 Live" : "Delegaciones"} · actualizado {lastRefresh.toLocaleTimeString("es-MX")}
            </p>
          </div>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <button
            onClick={() => setLiveMode((v) => !v)}
            style={{
              display: "flex", alignItems: "center", gap: 6,
              padding: "9px 14px", borderRadius: 10, border: "none",
              background: liveMode ? "rgba(16,185,129,.15)" : "rgba(148,163,184,.1)",
              color: liveMode ? "#10b981" : "var(--muted)",
              fontSize: 12, fontWeight: 700, cursor: "pointer",
            }}
          >
            {liveMode ? "Live ON" : "Live OFF"}
          </button>
          <button
            onClick={() => void load()}
            disabled={loading}
            style={{
              display: "flex", alignItems: "center", gap: 6,
              padding: "9px 14px", borderRadius: 10, border: "none",
              background: "rgba(99,102,241,.15)", color: "#818cf8",
              fontSize: 12, fontWeight: 700, cursor: loading ? "not-allowed" : "pointer",
              opacity: loading ? 0.6 : 1,
            }}
          >
            <RefreshCw size={13} style={{ animation: loading ? "spin 1s linear infinite" : "none" }} />
            {loading ? "Cargando…" : "Actualizar"}
          </button>
        </div>
      </div>

      {/* KPI row */}
      <HtmlInCanvasPanel style={{ border: "1px solid var(--border)", borderRadius: 16, background: "var(--surface)", padding: "14px 18px" }} minHeight={60}>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: 12 }}>
          {(["executing", "pending", "completed", "failed", "rejected"] as const).map((s) => {
            const meta = STATUS_META[s];
            const Icon = meta.icon;
            return (
              <div
                key={s}
                role="button"
                onClick={() => setFilterStatus(filterStatus === s ? "all" : s)}
                style={{
                  padding: "10px 12px", borderRadius: 10,
                  background: filterStatus === s ? meta.bg : "var(--bg)",
                  border: `1px solid ${filterStatus === s ? meta.color + "40" : "var(--border)"}`,
                  cursor: "pointer", textAlign: "center",
                }}
              >
                <div style={{ display: "flex", justifyContent: "center", marginBottom: 4 }}>
                  <Icon size={14} color={meta.color} />
                </div>
                <div style={{ fontSize: 20, fontWeight: 900, color: meta.color }}>{counts[s]}</div>
                <div style={{ fontSize: 10, color: "var(--muted)", fontWeight: 700, textTransform: "uppercase" }}>{meta.label}</div>
              </div>
            );
          })}
        </div>
      </HtmlInCanvasPanel>

      {/* Filters */}
      {agents.length > 0 && (
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
          <span style={{ fontSize: 11, color: "var(--muted)", fontWeight: 700 }}>Agente:</span>
          {["all", ...agents].map((a) => (
            <button
              key={a}
              onClick={() => setFilterAgent(a)}
              style={{
                padding: "5px 10px", borderRadius: 999,
                border: filterAgent === a ? "1px solid rgba(99,102,241,.4)" : "1px solid var(--border)",
                background: filterAgent === a ? "rgba(99,102,241,.2)" : "var(--surface)",
                color: filterAgent === a ? "#818cf8" : "var(--muted)",
                fontWeight: filterAgent === a ? 700 : 400, fontSize: 11, cursor: "pointer",
              }}
            >
              {a === "all" ? "Todos" : a}
            </button>
          ))}
        </div>
      )}

      {/* Error */}
      {error && (
        <div style={{ padding: "12px 16px", background: "rgba(239,68,68,.08)", border: "1px solid rgba(239,68,68,.18)", borderRadius: 12, color: "#ef4444", fontSize: 13 }}>
          {error}
        </div>
      )}

      {/* Delegation list */}
      <div style={{ display: "grid", gap: 8 }}>
        {loading && delegations.length === 0 ? (
          <div style={{ padding: "24px", textAlign: "center", color: "var(--muted)", fontSize: 13 }}>
            Cargando delegaciones…
          </div>
        ) : filtered.length === 0 ? (
          <div style={{ padding: "28px", textAlign: "center", color: "var(--muted)", border: "1px dashed var(--border)", borderRadius: 14, fontSize: 13 }}>
            <Zap size={20} color="var(--faint)" style={{ display: "block", margin: "0 auto 10px" }} />
            {delegations.length === 0
              ? "No hay delegaciones registradas todavía."
              : "No hay delegaciones que coincidan con el filtro."}
          </div>
        ) : (
          <>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
              <span style={{ fontSize: 12, color: "var(--muted)" }}>
                {filtered.length} delegación{filtered.length !== 1 ? "es" : ""}
                {filterStatus !== "all" ? ` · ${STATUS_META[filterStatus as DelegationStatus]?.label}` : ""}
              </span>
            </div>
            {filtered.map((d) => <DelegationRow key={d.id} d={d} />)}
          </>
        )}
      </div>
    </div>
  );
}
