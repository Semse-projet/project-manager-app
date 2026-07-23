"use client";

import { useEffect, useState, useCallback } from "react";
import { Activity } from "lucide-react";
import { AdminPageHeader } from "../../../components/admin/AdminPageHeader";
import { ModuleCard } from "../../../../components/admin/module-card";
import { ADMIN_MODULES } from "../../../../lib/admin/admin-navigation";

// ── Types ──────────────────────────────────────────────────────────────────────

type PrometeoBrief = {
  generatedAt: string;
  openSignalCount: number;
  criticalCount: number;
  highCount: number;
  systemStatus: "healthy" | "attention" | "high_risk" | "critical";
  summary: string;
  topRecommendation: string | null;
  nextAction: string | null;
  sections: Array<{
    priority: number;
    severity: string;
    headline: string;
    action: string;
    signals: Array<{ id: string; title: string; type: string }>;
  }>;
};

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
};

type IntelligenceRun = {
  id: string;
  agentName: string;
  triggerEvent: string;
  signalsCreated: string[];
  status: "completed" | "failed";
  durationMs?: number;
  createdAt: string;
};

type BuildOpsOverview = {
  totalProjects?: number;
  activeProjects?: number;
  projectsByStatus?: Record<string, number>;
  projectsByRisk?: Record<string, number>;
  milestonesPendingReview?: number;
  milestonesSubmitted?: number;
  tasksDueToday?: number;
  tasksBlocked?: number;
  evidenceCount?: number;
  openDisputes?: number;
};

type MissionControlSummary = {
  openSignals: number;
  criticalSignals: number;
  blockedPayments: number;
  activeDisputes: number;
  pendingMilestones: number;
  pendingEvidence: number;
  openChangeOrders: number;
  nextAction: string | null;
  generatedAt: string;
};

// ── Constants ──────────────────────────────────────────────────────────────────

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

const TYPE_EMOJI: Record<string, string> = {
  EVIDENCE_GAP: "📷",
  PAYMENT_BLOCKED: "🔒",
  LOW_CONFIDENCE_ESTIMATE: "📊",
  CHANGE_ORDER_RECOMMENDED: "📋",
  DISPUTE_RISK_HIGH: "⚠️",
};

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60_000);
  if (mins < 2) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

// ── Stat Card ──────────────────────────────────────────────────────────────────

function StatCard({
  label,
  value,
  color = "#94a3b8",
  emoji,
  onClick,
}: {
  label: string;
  value: number | string;
  color?: string;
  emoji?: string;
  onClick?: () => void;
}) {
  return (
    <div
      onClick={onClick}
      style={{
        background: "var(--surface, #0c1017)",
        border: "1px solid var(--border, #1f2d3d)",
        borderRadius: "12px",
        padding: "14px 16px",
        cursor: onClick ? "pointer" : "default",
        transition: "border-color 0.15s",
        minWidth: "100px",
      }}
    >
      {emoji && <div style={{ fontSize: "18px", marginBottom: "4px" }}>{emoji}</div>}
      <div style={{ fontSize: "24px", fontWeight: 800, color, lineHeight: 1 }}>{value}</div>
      <div style={{ fontSize: "11px", color: "var(--muted, #94a3b8)", marginTop: "4px" }}>{label}</div>
    </div>
  );
}

// ── Signal Card ────────────────────────────────────────────────────────────────

function SignalCard({
  signal,
  onAcknowledge,
  onResolve,
  onDismiss,
  loading,
}: {
  signal: OperationalSignal;
  onAcknowledge: (id: string) => void;
  onResolve: (id: string) => void;
  onDismiss: (id: string) => void;
  loading: string | null;
}) {
  const color = SEVERITY_COLOR[signal.severity] ?? "#94a3b8";
  const bg = SEVERITY_BG[signal.severity] ?? "transparent";
  const isLoading = loading === signal.id;

  return (
    <div
      style={{
        background: "var(--surface, #0c1017)",
        border: `1px solid ${color}35`,
        borderLeft: `3px solid ${color}`,
        borderRadius: "12px",
        padding: "14px 16px",
        marginBottom: "8px",
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "8px", marginBottom: "8px" }}>
        <div style={{ display: "flex", gap: "6px", alignItems: "center", flexWrap: "wrap" }}>
          <span
            style={{
              background: bg,
              color,
              border: `1px solid ${color}40`,
              borderRadius: "5px",
              padding: "2px 7px",
              fontSize: "10px",
              fontWeight: 700,
              textTransform: "uppercase",
              letterSpacing: "0.06em",
            }}
          >
            {signal.severity}
          </span>
          <span style={{ fontSize: "12px", color: "var(--muted, #94a3b8)" }}>
            {TYPE_EMOJI[signal.type] ?? "●"} {TYPE_LABEL[signal.type] ?? signal.type}
          </span>
          {signal.status === "acknowledged" && (
            <span style={{ fontSize: "10px", color: "#eab308", fontWeight: 600 }}>● Acknowledged</span>
          )}
        </div>
        <span style={{ fontSize: "10px", color: "var(--faint, #4b6280)", flexShrink: 0 }}>
          {timeAgo(signal.createdAt)}
        </span>
      </div>

      <p style={{ fontSize: "14px", fontWeight: 700, color: "var(--ink, #f1f5f9)", margin: "0 0 4px" }}>
        {signal.title}
      </p>
      <p style={{ fontSize: "12px", color: "var(--muted, #94a3b8)", margin: "0 0 10px", lineHeight: 1.5 }}>
        {signal.message}
      </p>

      {signal.recommendedAction && (
        <div style={{
          background: "rgba(59,130,246,.08)",
          border: "1px solid rgba(59,130,246,.2)",
          borderRadius: "7px",
          padding: "7px 10px",
          fontSize: "11px",
          color: "#93c5fd",
          marginBottom: "10px",
        }}>
          💡 {signal.recommendedAction}
        </div>
      )}

      <div style={{ display: "flex", gap: "6px", alignItems: "center", flexWrap: "wrap" }}>
        {signal.buildOpsProjectId && (
          <a
            href={`/admin/intelligence-rooms/${signal.buildOpsProjectId}`}
            style={{ fontSize: "10px", color: "#93c5fd", textDecoration: "none", padding: "2px 8px", border: "1px solid rgba(59,130,246,.25)", borderRadius: "4px" }}
          >
            🏠 Room →
          </a>
        )}
        {signal.milestoneId && (
          <span style={{ fontSize: "10px", color: "var(--faint, #4b6280)" }}>
            Milestone · {signal.milestoneId.slice(-6)}
          </span>
        )}
        <div style={{ flex: 1 }} />
        {signal.status === "open" && (
          <button
            onClick={() => onAcknowledge(signal.id)}
            disabled={isLoading}
            style={{
              padding: "4px 10px",
              borderRadius: "6px",
              border: "1px solid var(--border, #1f2d3d)",
              background: "transparent",
              color: "var(--muted, #94a3b8)",
              fontSize: "11px",
              cursor: isLoading ? "not-allowed" : "pointer",
            }}
          >
            {isLoading ? "…" : "Acknowledge"}
          </button>
        )}
        {signal.status !== "resolved" && (
          <button
            onClick={() => {
              // resolve() only flips status server-side — it never checks
              // the real condition (payment released, evidence delivered)
              // was actually fixed. See docs/AUDIT_REMEDIATION_PLAN.md 3.17.
              if (window.confirm(`¿Confirmas que la condición real detrás de "${signal.title}" ya se corrigió? Esto solo marca la señal como resuelta, no verifica nada por sí mismo.`)) {
                onResolve(signal.id);
              }
            }}
            disabled={isLoading}
            style={{
              padding: "4px 10px",
              borderRadius: "6px",
              border: "1px solid rgba(34,197,94,.3)",
              background: "rgba(34,197,94,.08)",
              color: "#86efac",
              fontSize: "11px",
              cursor: isLoading ? "not-allowed" : "pointer",
            }}
          >
            {isLoading ? "…" : "Resolve"}
          </button>
        )}
        {signal.status !== "dismissed" && signal.status !== "resolved" && (
          <button
            onClick={() => {
              if (window.confirm(`¿Descartar "${signal.title}" sin resolverla? Esto la oculta de la vista activa.`)) {
                onDismiss(signal.id);
              }
            }}
            disabled={isLoading}
            style={{
              padding: "4px 10px",
              borderRadius: "6px",
              border: "1px solid rgba(100,116,139,.3)",
              background: "rgba(100,116,139,.08)",
              color: "#94a3b8",
              fontSize: "11px",
              cursor: isLoading ? "not-allowed" : "pointer",
            }}
          >
            {isLoading ? "…" : "Dismiss"}
          </button>
        )}
      </div>
    </div>
  );
}

// ── Main Page ──────────────────────────────────────────────────────────────────

export default function MissionControlPage() {
  const [signals, setSignals] = useState<OperationalSignal[]>([]);
  const [runs, setRuns] = useState<IntelligenceRun[]>([]);
  const [overview, setOverview] = useState<BuildOpsOverview | null>(null);
  const [brief, setBrief] = useState<PrometeoBrief | null>(null);
  const [mcSummary, setMcSummary] = useState<MissionControlSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [filter, setFilter] = useState<"open" | "critical" | "high" | "all">("open");
  const [error, setError] = useState<string | null>(null);
  const [liveAlert, setLiveAlert] = useState<{ type: string; severity: string; title: string } | null>(null);
  const [seeding, setSeeding] = useState(false);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [sigRes, runRes, ovRes, briefRes, mcRes] = await Promise.allSettled([
        fetch("/api/semse/operational-signals?limit=100", { credentials: "include" }),
        fetch("/api/semse/intelligence-runs?limit=10", { credentials: "include" }),
        fetch("/api/semse/buildops/overview", { credentials: "include" }),
        fetch("/api/semse/prometeo-brief", { credentials: "include" }),
        fetch("/api/semse/ops/mission-control/summary", { credentials: "include" }),
      ]);
      const failed: string[] = [];
      if (sigRes.status === "fulfilled" && sigRes.value.ok) {
        const sigData = (await sigRes.value.json()) as { data?: OperationalSignal[] };
        setSignals(sigData.data ?? []);
      } else {
        failed.push("señales");
        setSignals([]);
      }
      if (runRes.status === "fulfilled" && runRes.value.ok) {
        const runData = (await runRes.value.json()) as { data?: IntelligenceRun[] };
        setRuns(runData.data ?? []);
      } else {
        failed.push("runs");
        setRuns([]);
      }
      if (ovRes.status === "fulfilled" && ovRes.value.ok) {
        const ovData = (await ovRes.value.json()) as { data?: BuildOpsOverview };
        setOverview(ovData.data ?? null);
      } else {
        failed.push("buildops overview");
        setOverview(null);
      }
      if (briefRes.status === "fulfilled" && briefRes.value.ok) {
        const briefData = (await briefRes.value.json()) as { data?: PrometeoBrief };
        setBrief(briefData.data ?? null);
      } else {
        failed.push("prometeo brief");
        setBrief(null);
      }
      if (mcRes.status === "fulfilled" && mcRes.value.ok) {
        const mcData = (await mcRes.value.json()) as { data?: MissionControlSummary };
        setMcSummary(mcData.data ?? null);
      } else {
        failed.push("mission control summary");
        setMcSummary(null);
      }
      if (failed.length > 0) {
        setError(`Falla parcial de carga: ${failed.join(", ")}.`);
      }
    } catch {
      setError("No se pudieron cargar las señales operacionales.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void fetchData(); }, [fetchData]);

  // SSE: listen for new operational signals in real-time
  useEffect(() => {
    if (typeof window === "undefined") return;
    const es = new EventSource("/api/semse/sse/mission-control");
    es.addEventListener("operational-signal:created", (e: Event) => {
      try {
        const data = JSON.parse((e as MessageEvent).data) as OperationalSignal;
        setLiveAlert({ type: data.type, severity: data.severity, title: data.title });
        // Add to signals list so it appears immediately without full refresh
        setSignals((prev) => [data, ...prev.filter((s) => s.id !== data.id)]);
        // Auto-dismiss alert after 8 seconds
        setTimeout(() => setLiveAlert(null), 8_000);
      } catch { /* ignore */ }
    });
    return () => es.close();
  }, []);

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
  const criticalOpen = signals.filter((s) => s.severity === "critical" && s.status === "open");
  const highOpen = signals.filter((s) => (s.severity === "high" || s.severity === "critical") && s.status === "open");
  const evidenceGaps = signals.filter((s) => s.type === "EVIDENCE_GAP" && s.status === "open");
  const paymentBlocked = signals.filter((s) => s.type === "PAYMENT_BLOCKED" && s.status === "open");
  const disputeRisk = signals.filter((s) => s.type === "DISPUTE_RISK_HIGH" && s.status === "open");

  const filtered = signals.filter((s) => {
    if (filter === "open") return s.status === "open" || s.status === "acknowledged";
    if (filter === "critical") return s.severity === "critical";
    if (filter === "high") return s.severity === "high" || s.severity === "critical";
    return true;
  });

  const systemHealthColor = criticalOpen.length > 0 ? "#ef4444" : highOpen.length > 0 ? "#f97316" : openSignals.length > 0 ? "#eab308" : "#22c55e";
  const systemHealthLabel = criticalOpen.length > 0 ? "CRITICAL" : highOpen.length > 0 ? "HIGH RISK" : openSignals.length > 0 ? "ATTENTION" : "HEALTHY";

  return (
    <div style={{ padding: "24px", maxWidth: "1200px", margin: "0 auto" }}>

      <AdminPageHeader
        title="Mission Control"
        subtitle="Monitorea proyectos, evidencia, pagos, bloqueos y riesgos operativos en tiempo real."
        icon={Activity}
        iconColor={systemHealthColor}
        iconBg={`${systemHealthColor}15`}
        showBack={false}
        actions={
          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            <span style={{
              fontSize: "10px", fontWeight: 700, letterSpacing: "0.08em",
              color: systemHealthColor, padding: "2px 7px",
              background: `${systemHealthColor}15`, border: `1px solid ${systemHealthColor}30`,
              borderRadius: "4px",
            }}>
              {systemHealthLabel}
            </span>
            <button onClick={() => void fetchData()} style={{
              padding: "6px 12px", borderRadius: "7px",
              border: "1px solid var(--border, #1f2d3d)", background: "transparent",
              color: "var(--muted, #94a3b8)", fontSize: "12px", cursor: "pointer",
            }}>↻ Refresh</button>
          </div>
        }
      />

      <section className="mb-6">
        <div className="mb-3 flex items-center justify-between gap-4">
          <div>
            <h2 className="text-sm font-semibold uppercase tracking-widest text-muted">Modular ecosystem</h2>
            <p className="mt-1 text-sm text-muted">Entry points for the new Admin structure while legacy routes stay available.</p>
          </div>
        </div>
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {ADMIN_MODULES.map((module) => (
            <ModuleCard key={module.id} module={module} compact />
          ))}
        </div>
      </section>

      {/* Live alert toast */}
      {liveAlert && (
        <div style={{
          position: "fixed" as const, top: "20px", right: "20px", zIndex: 9999,
          background: liveAlert.severity === "critical" ? "rgba(239,68,68,.95)" : "rgba(249,115,22,.95)",
          border: `1px solid ${liveAlert.severity === "critical" ? "#ef4444" : "#f97316"}`,
          borderRadius: "12px", padding: "12px 16px", maxWidth: "320px",
          boxShadow: "0 4px 24px rgba(0,0,0,.4)",
          display: "flex", gap: "10px", alignItems: "flex-start",
        }}>
          <span style={{ fontSize: "18px" }}>{liveAlert.severity === "critical" ? "🚨" : "⚠️"}</span>
          <div style={{ flex: 1 }}>
            <p style={{ fontSize: "12px", fontWeight: 700, color: "#fff", margin: "0 0 2px" }}>
              Nueva señal {liveAlert.severity.toUpperCase()}
            </p>
            <p style={{ fontSize: "11px", color: "rgba(255,255,255,.85)", margin: 0 }}>{liveAlert.title}</p>
          </div>
          <button onClick={() => setLiveAlert(null)} style={{ background: "transparent", border: "none", color: "rgba(255,255,255,.7)", cursor: "pointer", fontSize: "16px", padding: 0 }}>×</button>
        </div>
      )}

      {/* Prometeo Brief */}
      {!loading && brief && (
        <div style={{
          background: "linear-gradient(135deg, rgba(139,92,246,.08), rgba(59,130,246,.08))",
          border: "1px solid rgba(139,92,246,.3)",
          borderRadius: "14px",
          padding: "16px 18px",
          marginBottom: "20px",
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "10px" }}>
            <div style={{
              width: "28px", height: "28px", borderRadius: "8px",
              background: "linear-gradient(135deg, #8b5cf6, #3b82f6)",
              display: "flex", alignItems: "center", justifyContent: "center",
              fontSize: "14px",
            }}>⚡</div>
            <span style={{ fontSize: "13px", fontWeight: 700, color: "var(--ink, #f1f5f9)" }}>
              Prometeo Brief
            </span>
            <span style={{ fontSize: "10px", color: "var(--faint, #4b6280)", marginLeft: "auto" }}>
              {new Date(brief.generatedAt).toLocaleTimeString()}
            </span>
          </div>

          <p style={{ fontSize: "13px", color: "var(--muted, #94a3b8)", lineHeight: 1.6, margin: "0 0 10px" }}>
            {brief.summary}
          </p>

          {brief.sections.length > 0 && (
            <div style={{ display: "flex", flexDirection: "column", gap: "6px", marginBottom: "10px" }}>
              {brief.sections.map((sec) => (
                <div key={sec.priority} style={{
                  display: "flex", gap: "8px", alignItems: "flex-start",
                  fontSize: "12px",
                }}>
                  <span style={{
                    color: sec.severity === "critical" ? "#ef4444" : sec.severity === "high" ? "#f97316" : "#eab308",
                    fontWeight: 700, flexShrink: 0, minWidth: "56px",
                    fontSize: "10px", textTransform: "uppercase",
                  }}>
                    {sec.priority}. {sec.severity}
                  </span>
                  <span style={{ color: "var(--ink, #f1f5f9)" }}>{sec.headline}</span>
                </div>
              ))}
            </div>
          )}

          {brief.nextAction && (
            <div style={{
              background: "rgba(139,92,246,.1)",
              border: "1px solid rgba(139,92,246,.2)",
              borderRadius: "8px",
              padding: "8px 12px",
              fontSize: "12px",
              color: "#c4b5fd",
            }}>
              🎯 <strong>Siguiente acción:</strong> {brief.nextAction}
            </div>
          )}

          {brief.systemStatus === "healthy" && (
            <div style={{ fontSize: "12px", color: "#22c55e" }}>
              ✓ Sistema operando sin señales activas.
            </div>
          )}
        </div>
      )}

      {/* Executive Summary */}
      <div style={{ marginBottom: "20px" }}>
        <p style={{ fontSize: "10px", fontWeight: 700, color: "var(--faint, #4b6280)", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: "10px" }}>
          Resumen Operacional
        </p>
        <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
          <StatCard label="Señales abiertas" value={openSignals.length} color="#3b82f6" emoji="🔔" onClick={() => setFilter("open")} />
          <StatCard label="Riesgo crítico" value={criticalOpen.length} color="#ef4444" emoji="🚨" onClick={() => setFilter("critical")} />
          <StatCard label="Evidence gaps" value={evidenceGaps.length} color="#f97316" emoji="📷" />
          <StatCard label="Pagos bloqueados" value={paymentBlocked.length} color="#eab308" emoji="🔒" />
          <StatCard label="Riesgo disputa" value={disputeRisk.length} color="#ef4444" emoji="⚠️" />
          {overview?.totalProjects !== undefined && (
            <StatCard label="Proyectos activos" value={overview.activeProjects ?? overview.totalProjects} color="#22c55e" emoji="🏗️" />
          )}
          {overview?.milestonesPendingReview !== undefined && (
            <StatCard label="Milestones pendientes" value={overview.milestonesPendingReview} color="#8b5cf6" emoji="✅" />
          )}
          {overview?.openDisputes !== undefined && overview.openDisputes > 0 && (
            <StatCard label="Disputas abiertas" value={overview.openDisputes} color="#ef4444" emoji="⚖️" />
          )}
          {mcSummary?.pendingEvidence !== undefined && mcSummary.pendingEvidence > 0 && (
            <StatCard label="Evidencia pendiente" value={mcSummary.pendingEvidence} color="#a78bfa" emoji="🖼️" />
          )}
          {mcSummary?.openChangeOrders !== undefined && mcSummary.openChangeOrders > 0 && (
            <StatCard label="Change orders" value={mcSummary.openChangeOrders} color="#fb923c" emoji="📋" />
          )}
        </div>
        {!brief && mcSummary?.nextAction && (
          <div style={{
            marginTop: "10px",
            padding: "8px 12px",
            background: "rgba(139,92,246,.08)",
            border: "1px solid rgba(139,92,246,.2)",
            borderRadius: "8px",
            fontSize: "12px",
            color: "#c4b5fd",
          }}>
            🎯 <strong>Siguiente acción:</strong> {mcSummary.nextAction}
          </div>
        )}
      </div>

      {/* SEMSE OS Modules */}
      <section style={{ marginBottom: "24px" }}>
        <div style={{ display: "flex", alignItems: "end", justifyContent: "space-between", gap: "16px", marginBottom: "12px" }}>
          <div>
            <p style={{ fontSize: "10px", fontWeight: 700, color: "var(--faint, #4b6280)", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: "6px" }}>
              SEMSE OS
            </p>
            <h2 style={{ margin: 0, fontSize: "18px", fontWeight: 800, color: "var(--ink, #f1f5f9)" }}>
              Ecosistema modular
            </h2>
          </div>
          <a href="/admin/tool-hub" style={{ color: "#93c5fd", fontSize: "12px", fontWeight: 700, textDecoration: "none" }}>
            Tool Hub →
          </a>
        </div>
        <div className="grid gap-3 md:grid-cols-2 2xl:grid-cols-3">
          {ADMIN_MODULES.filter((module) => module.id !== "settings").map((module) => (
            <ModuleCard key={module.id} module={module} compact />
          ))}
        </div>
      </section>

      {/* Filters */}
      <div style={{ display: "flex", gap: "6px", marginBottom: "14px", flexWrap: "wrap" }}>
        {(["open", "high", "critical", "all"] as const).map((f) => (
          <button key={f} onClick={() => setFilter(f)} style={{
            padding: "5px 12px", borderRadius: "6px",
            border: `1px solid ${filter === f ? "#3b82f6" : "var(--border, #1f2d3d)"}`,
            background: filter === f ? "rgba(59,130,246,.15)" : "transparent",
            color: filter === f ? "#93c5fd" : "var(--muted, #94a3b8)",
            fontSize: "11px", fontWeight: filter === f ? 700 : 400, cursor: "pointer",
          }}>
            {f === "open" ? `Abiertas (${openSignals.length})` : f === "high" ? `Alta prioridad (${highOpen.length})` : f === "critical" ? `Críticas (${criticalOpen.length})` : `Todas (${signals.length})`}
          </button>
        ))}
      </div>

      {/* Signals Feed */}
      {loading ? (
        <p style={{ color: "var(--muted, #94a3b8)", textAlign: "center", padding: "40px 0" }}>Cargando señales…</p>
      ) : error ? (
        <div style={{ color: "#ef4444", padding: "16px", textAlign: "center" }}>{error}</div>
      ) : filtered.length === 0 ? (
        <div style={{
          textAlign: "center", padding: "40px",
          background: "var(--surface, #0c1017)",
          border: "1px solid var(--border, #1f2d3d)", borderRadius: "12px",
        }}>
          <div style={{ fontSize: "32px", marginBottom: "8px" }}>✅</div>
          <p style={{ fontSize: "14px", color: "var(--muted, #94a3b8)", marginBottom: "16px" }}>
            {filter === "open" ? "No hay señales operacionales activas." : "No hay señales para este filtro."}
          </p>
          {filter === "open" && (
            <button
              onClick={async () => {
                setSeeding(true);
                try {
                  await fetch("/api/semse/operational-signals/seed-test", { method: "POST", credentials: "include" });
                  await fetchData();
                } finally { setSeeding(false); }
              }}
              disabled={seeding}
              style={{
                padding: "8px 16px", borderRadius: "8px",
                border: "1px solid rgba(139,92,246,.4)",
                background: "rgba(139,92,246,.1)", color: "#c4b5fd",
                fontSize: "12px", fontWeight: 600, cursor: seeding ? "not-allowed" : "pointer",
              }}
            >
              {seeding ? "Creando señales…" : "⚡ Crear señales de prueba"}
            </button>
          )}
        </div>
      ) : (
        <div>
          <p style={{ fontSize: "11px", color: "var(--faint, #4b6280)", marginBottom: "10px" }}>
            {filtered.length} señal{filtered.length !== 1 ? "es" : ""}
          </p>
          {filtered.map((signal) => (
            <SignalCard
              key={signal.id}
              signal={signal}
              onAcknowledge={handleAcknowledge}
              onResolve={handleResolve}
              onDismiss={handleDismiss}
              loading={actionLoading}
            />
          ))}
        </div>
      )}

      {/* Recent Intelligence Runs */}
      {!loading && runs.length > 0 && (
        <div style={{ marginTop: "28px" }}>
          <p style={{ fontSize: "10px", fontWeight: 700, color: "var(--faint, #4b6280)", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: "10px" }}>
            Recent Intelligence Runs
          </p>
          <div style={{
            background: "var(--surface, #0c1017)",
            border: "1px solid var(--border, #1f2d3d)", borderRadius: "12px", overflow: "hidden",
          }}>
            {runs.slice(0, 8).map((run, i) => (
              <div key={run.id} style={{
                padding: "9px 14px",
                borderBottom: i < Math.min(runs.length, 8) - 1 ? "1px solid var(--border, #1f2d3d)" : "none",
                display: "flex", justifyContent: "space-between", alignItems: "center", gap: "8px",
              }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <span style={{ fontSize: "12px", color: "var(--ink, #f1f5f9)", fontWeight: 600 }}>{run.agentName}</span>
                  <span style={{ fontSize: "11px", color: "var(--muted, #94a3b8)", marginLeft: "8px" }}>{run.triggerEvent}</span>
                  {run.signalsCreated.length > 0 && (
                    <span style={{ fontSize: "10px", color: "#f97316", marginLeft: "6px" }}>
                      +{run.signalsCreated.length} signal{run.signalsCreated.length > 1 ? "s" : ""}
                    </span>
                  )}
                </div>
                <div style={{ display: "flex", gap: "8px", alignItems: "center", flexShrink: 0 }}>
                  {run.durationMs != null && <span style={{ fontSize: "10px", color: "var(--faint, #4b6280)" }}>{run.durationMs}ms</span>}
                  <span style={{ fontSize: "10px", color: run.status === "completed" ? "#22c55e" : "#ef4444", fontWeight: 600 }}>{run.status}</span>
                  <span style={{ fontSize: "10px", color: "var(--faint, #4b6280)" }}>{timeAgo(run.createdAt)}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Separator from AI Mission Control */}
      <div style={{
        marginTop: "32px",
        padding: "12px 16px",
        background: "rgba(139,92,246,.05)",
        border: "1px solid rgba(139,92,246,.2)",
        borderRadius: "10px",
        fontSize: "11px",
        color: "var(--faint, #4b6280)",
      }}>
        💡 <strong style={{ color: "var(--muted, #94a3b8)" }}>Mission Control</strong> monitorea operaciones reales — proyectos, pagos, evidencia y riesgos. Para salud de modelos LLM ve a{" "}
        <a href="/admin/ai-mission-control" style={{ color: "#93c5fd", textDecoration: "none" }}>IA Mission Control →</a>
      </div>
    </div>
  );
}
