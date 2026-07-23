"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  AlertTriangle, CheckCircle, Clock, DollarSign,
  RefreshCw, Shield, TrendingUp, Zap, Building2, Info,
} from "lucide-react";
import { AdminPageHeader } from "../../../components/admin/AdminPageHeader";
import {
  fetchPmoDashboard,
  subscribeToContextUpdates,
  type PmoAlert,
  type PmoDashboard,
  type PmoProjectCard,
} from "../../../semse-api";

const LEVEL_CONFIG: Record<string, { color: string; bg: string; icon: typeof AlertTriangle }> = {
  critical: { color: "#f87171", bg: "rgba(248,113,113,.1)", icon: Zap },
  high:     { color: "#fb923c", bg: "rgba(251,146,60,.1)",  icon: AlertTriangle },
  medium:   { color: "#fbbf24", bg: "rgba(251,191,36,.1)",  icon: Clock },
  info:     { color: "#60a5fa", bg: "rgba(96,165,250,.1)",  icon: Info },
};

const RISK_COLOR: Record<string, string> = {
  low: "#10b981", medium: "#fbbf24", high: "#fb923c", critical: "#f87171",
};

function fmt(n: number) {
  return new Intl.NumberFormat("es-MX", { style: "currency", currency: "MXN", minimumFractionDigits: 0 }).format(n);
}

function KpiCard({ label, value, sub, icon: Icon, color = "#818cf8", alert = false }: {
  label: string; value: string | number; sub?: string; icon: typeof DollarSign; color?: string; alert?: boolean;
}) {
  return (
    <div style={{
      background: "var(--surface)", borderRadius: 16, padding: 20,
      border: `1px solid ${alert ? "rgba(248,113,113,.3)" : "var(--border)"}`,
    }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10 }}>
        <div style={{ width: 32, height: 32, borderRadius: 9, background: `${color}22`, display: "grid", placeItems: "center" }}>
          <Icon size={15} color={color} />
        </div>
        <span style={{ fontSize: 10, color: "var(--muted)", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.1em" }}>{label}</span>
      </div>
      <div style={{ fontSize: 24, fontWeight: 900, color: alert ? "#fca5a5" : "var(--ink)" }}>{value}</div>
      {sub && <div style={{ fontSize: 11, color: "var(--muted)", marginTop: 4 }}>{sub}</div>}
    </div>
  );
}

function AlertBadge({ level, message }: { level: string; message: string }) {
  const cfg = LEVEL_CONFIG[level] ?? LEVEL_CONFIG.info;
  const Icon = cfg.icon;
  return (
    <div style={{
      display: "flex", alignItems: "flex-start", gap: 10,
      padding: "10px 14px", borderRadius: 12,
      background: cfg.bg, border: `1px solid ${cfg.color}33`,
    }}>
      <Icon size={14} color={cfg.color} style={{ flexShrink: 0, marginTop: 1 }} />
      <span style={{ fontSize: 12, color: "var(--ink)", lineHeight: 1.5 }}>{message}</span>
    </div>
  );
}

function ProjectRow({ project }: { project: PmoProjectCard }) {
  const [expanded, setExpanded] = useState(false);
  const riskColor = RISK_COLOR[project.riskLevel] ?? "#94a3b8";

  return (
    <div style={{
      background: "var(--surface)", borderRadius: 14,
      border: `1px solid ${project.riskLevel === "critical" ? "rgba(248,113,113,.3)" : project.riskLevel === "high" ? "rgba(251,146,60,.2)" : "var(--border)"}`,
      overflow: "hidden",
    }}>
      <button
        onClick={() => setExpanded(e => !e)}
        style={{
          width: "100%", display: "grid",
          gridTemplateColumns: "1fr 90px 90px 80px 80px 80px 90px",
          gap: 16, padding: "14px 18px", border: "none",
          background: "transparent", cursor: "pointer", textAlign: "left",
          alignItems: "center",
        }}
      >
        <div>
          <div style={{ fontWeight: 700, fontSize: 13, color: "var(--ink)", marginBottom: 2 }}>{project.jobTitle}</div>
          <div style={{ fontSize: 11, color: "var(--muted)" }}>{project.contractorOrg}</div>
        </div>
        <div style={{ textAlign: "center" }}>
          <div style={{
            display: "inline-flex", alignItems: "center", gap: 5,
            padding: "4px 10px", borderRadius: 99,
            background: `${riskColor}15`, border: `1px solid ${riskColor}33`,
          }}>
            <div style={{ width: 7, height: 7, borderRadius: "50%", background: riskColor }} />
            <span style={{ fontSize: 11, fontWeight: 700, color: riskColor }}>{project.riskScore}</span>
          </div>
        </div>
        <div style={{ fontSize: 12, color: "var(--muted)", textAlign: "right" }}>{fmt(project.escrowFunded)}</div>
        <div style={{ fontSize: 12, color: project.openDisputes > 0 ? "#f87171" : "var(--muted)", textAlign: "center", fontWeight: project.openDisputes > 0 ? 700 : 400 }}>
          {project.openDisputes > 0 ? `⚠ ${project.openDisputes}` : "—"}
        </div>
        <div style={{ fontSize: 12, color: project.pendingMilestones > 0 ? "#fbbf24" : "var(--muted)", textAlign: "center" }}>
          {project.pendingMilestones > 0 ? project.pendingMilestones : "—"}
        </div>
        <div style={{ fontSize: 11, color: project.daysSinceActivity > 14 ? "#f87171" : "var(--muted)", textAlign: "center" }}>
          {project.daysSinceActivity}d
        </div>
        <div style={{ fontSize: 11, color: "#818cf8", textAlign: "right" }}>
          {project.alerts.length > 0 ? `${project.alerts.length} alerta(s)` : "Sin alertas"}
        </div>
      </button>

      {expanded && project.alerts.length > 0 && (
        <div style={{ padding: "0 18px 14px", display: "grid", gap: 8 }}>
          {project.alerts.map(a => (
            <div key={a.id} style={{ display: "grid", gridTemplateColumns: "1fr auto", gap: 10, alignItems: "start" }}>
              <AlertBadge level={a.level} message={a.message} />
              <span style={{ fontSize: 11, color: "#818cf8", padding: "10px 0", whiteSpace: "nowrap" }}>{a.action}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function AlertFeed({ alerts }: { alerts: PmoAlert[] }) {
  if (alerts.length === 0) {
    return (
      <div style={{ textAlign: "center", padding: 32, color: "var(--muted)", fontSize: 13 }}>
        <CheckCircle size={32} color="#10b981" style={{ margin: "0 auto 12px", display: "block" }} />
        Sin alertas críticas activas
      </div>
    );
  }
  return (
    <div style={{ display: "grid", gap: 10 }}>
      {alerts.map(alert => {
        const cfg = LEVEL_CONFIG[alert.level] ?? LEVEL_CONFIG.info;
        const Icon = cfg.icon;
        return (
          <div key={alert.id} style={{
            display: "flex", gap: 14, padding: "14px 16px", borderRadius: 14,
            background: cfg.bg, border: `1px solid ${cfg.color}33`,
          }}>
            <Icon size={18} color={cfg.color} style={{ flexShrink: 0, marginTop: 1 }} />
            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: 700, fontSize: 12, color: "var(--ink)", marginBottom: 2 }}>{alert.projectTitle}</div>
              <div style={{ fontSize: 12, color: "var(--muted)", marginBottom: 4 }}>{alert.message}</div>
              <div style={{ fontSize: 11, color: cfg.color, fontWeight: 600 }}>→ {alert.action}</div>
            </div>
            <span style={{
              alignSelf: "flex-start", fontSize: 9, fontWeight: 900, padding: "3px 8px",
              borderRadius: 6, background: `${cfg.color}20`, color: cfg.color, textTransform: "uppercase",
            }}>{alert.level}</span>
          </div>
        );
      })}
    </div>
  );
}

export default function PmoPage() {
  const [dashboard, setDashboard] = useState<PmoDashboard | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<"projects" | "alerts">("alerts");
  const dashboardRef = useRef<PmoDashboard | null>(null);
  const loadInFlightRef = useRef(false);
  const pendingLoadRef = useRef(false);
  const reloadTimerRef = useRef<number | null>(null);

  useEffect(() => {
    dashboardRef.current = dashboard;
  }, [dashboard]);

  const load = useCallback(async (options?: { silent?: boolean }) => {
    if (loadInFlightRef.current) {
      pendingLoadRef.current = true;
      return;
    }

    loadInFlightRef.current = true;
    if (!options?.silent || !dashboardRef.current) {
      setLoading(true);
    }
    if (!options?.silent) {
      setError(null);
    }

    try {
      setDashboard(await fetchPmoDashboard());
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error al cargar PMO");
    } finally {
      loadInFlightRef.current = false;
      if (!options?.silent || !dashboardRef.current) {
        setLoading(false);
      }
      if (pendingLoadRef.current) {
        pendingLoadRef.current = false;
        void load({ silent: true });
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
    }, 500);
  }, [load]);

  useEffect(() => {
    void load();
    const unsubscribe = subscribeToContextUpdates({
      onUpdate: () => {
        scheduleReload();
      },
    });

    return () => {
      unsubscribe();
      if (reloadTimerRef.current) {
        window.clearTimeout(reloadTimerRef.current);
        reloadTimerRef.current = null;
      }
    };
  }, [load, scheduleReload]);

  return (
    <div style={{ maxWidth: 1200, margin: "0 auto", padding: "24px 20px", display: "grid", gap: 20 }}>
      <AdminPageHeader
        title="PMO Automatizado"
        subtitle={
          <>
            Supervisión inteligente de proyectos · alertas predictivas en tiempo real
            {dashboard && <span style={{ marginLeft: 8, color: "#475569" }}>actualizado {new Date(dashboard.generatedAt).toLocaleTimeString("es-MX")}</span>}
          </>
        }
        icon={Building2}
        iconColor="#818cf8"
        iconBg="rgba(99,102,241,.12)"
        showBack={false}
        actions={
          <button onClick={() => void load()} disabled={loading} style={{
            display: "inline-flex", alignItems: "center", gap: 8, padding: "10px 14px",
            borderRadius: 12, border: "none", background: "rgba(99,102,241,.15)", color: "#818cf8", fontWeight: 700, cursor: "pointer",
          }}>
            <RefreshCw size={14} style={{ animation: loading ? "spin 1s linear infinite" : "none" }} />
            {loading ? "Analizando..." : "Actualizar"}
          </button>
        }
      />

      {error && <div style={{ background: "rgba(239,68,68,.08)", border: "1px solid rgba(239,68,68,.2)", borderRadius: 12, padding: 12, color: "#fca5a5", fontSize: 13 }}>{error}</div>}

      {/* KPIs */}
      {dashboard && (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: 14 }}>
          <KpiCard label="Proyectos activos" value={dashboard.summary.activeProjects} sub={`de ${dashboard.summary.totalProjects} totales`} icon={Building2} />
          <KpiCard label="Escrow total" value={fmt(dashboard.summary.totalEscrow)} sub="en custodia" icon={DollarSign} color="#a78bfa" />
          <KpiCard label="Por liberar" value={fmt(dashboard.summary.pendingRelease)} sub="elegibles" icon={TrendingUp} color="#10b981" />
          <KpiCard label="En riesgo alto" value={dashboard.summary.highRiskProjects} sub="proyectos" icon={AlertTriangle} color="#fb923c" alert={dashboard.summary.highRiskProjects > 0} />
          <KpiCard label="Disputas abiertas" value={dashboard.summary.openDisputes} sub="requieren atención" icon={Shield} color="#f87171" alert={dashboard.summary.openDisputes > 0} />
          <KpiCard label="Alertas activas" value={dashboard.summary.totalAlerts} sub="del sistema" icon={Zap} color="#fbbf24" alert={dashboard.summary.totalAlerts > 3} />
        </div>
      )}

      {/* Tabs */}
      <div style={{ display: "flex", gap: 4, borderBottom: "1px solid var(--border)" }}>
        {(["alerts", "projects"] as const).map(t => (
          <button key={t} onClick={() => setTab(t)} style={{
            padding: "10px 18px", fontSize: 13, fontWeight: 700, border: "none", cursor: "pointer",
            background: "transparent", color: tab === t ? "var(--ink)" : "var(--muted)",
            borderBottom: tab === t ? "2px solid #818cf8" : "2px solid transparent",
          }}>
            {t === "alerts"
              ? `Alertas predictivas (${dashboard?.topAlerts.length ?? 0})`
              : `Proyectos (${dashboard?.projects.length ?? 0})`}
          </button>
        ))}
      </div>

      {/* Alerts tab */}
      {tab === "alerts" && dashboard && (
        <AlertFeed alerts={dashboard.topAlerts} />
      )}

      {/* Projects tab */}
      {tab === "projects" && dashboard && (
        <div style={{ display: "grid", gap: 10 }}>
          {/* Header row */}
          <div style={{
            display: "grid", gridTemplateColumns: "1fr 90px 90px 80px 80px 80px 90px",
            gap: 16, padding: "0 18px", fontSize: 10, color: "var(--muted)", fontWeight: 700, textTransform: "uppercase",
          }}>
            <span>Proyecto / Contratista</span>
            <span style={{ textAlign: "center" }}>Riesgo</span>
            <span style={{ textAlign: "right" }}>Escrow</span>
            <span style={{ textAlign: "center" }}>Disputas</span>
            <span style={{ textAlign: "center" }}>Hitos</span>
            <span style={{ textAlign: "center" }}>Actividad</span>
            <span style={{ textAlign: "right" }}>Alertas</span>
          </div>
          {dashboard.projects.length === 0 && !loading && (
            <div style={{ textAlign: "center", padding: 40, color: "var(--muted)", fontSize: 13 }}>
              Sin proyectos activos.
            </div>
          )}
          {dashboard.projects.map(p => <ProjectRow key={p.projectId} project={p} />)}
        </div>
      )}

      {loading && !dashboard && (
        <div style={{ textAlign: "center", padding: 60, color: "var(--muted)", fontSize: 13 }}>
          Analizando proyectos y calculando riesgo...
        </div>
      )}
    </div>
  );
}
