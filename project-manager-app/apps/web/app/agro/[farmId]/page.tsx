"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams, usePathname } from "next/navigation";
import {
  AlertTriangle, Info, AlertCircle, Beef, CheckSquare, Package,
  DollarSign, TrendingUp, Leaf, ChevronRight,
} from "lucide-react";

interface Alert {
  type: string;
  severity: "CRITICAL" | "WARNING" | "INFO";
  entityType: string;
  entityId: string;
  message: string;
}

interface DashboardData {
  farm: { id: string; name: string; operationType: string };
  counts: {
    animals: number; animalGroups: number; totalAnimals: number;
    pendingTasks: number; blockedTasks: number; overdueTasks: number;
    completedThisWeek: number; inventoryItems: number; lowStockItems: number;
  };
  monthCostSummary: { total: number; since: string; currency: string };
  alerts: Alert[];
  nextBestActions: { priority: number; action: string; detail: string }[];
}

const ALERT_CFG: Record<string, { cls: string; Icon: typeof AlertTriangle }> = {
  CRITICAL: { cls: "alert-critical", Icon: AlertCircle },
  WARNING:  { cls: "alert-warning",  Icon: AlertTriangle },
  INFO:     { cls: "alert-info",     Icon: Info },
};

function farmTabs(farmId: string) {
  return [
    { href: `/agro/${farmId}`,            label: "Dashboard"  },
    { href: `/agro/${farmId}/animals`,    label: "Animales"   },
    { href: `/agro/${farmId}/tasks`,      label: "Tareas"     },
    { href: `/agro/${farmId}/inventory`,  label: "Inventario" },
    { href: `/agro/${farmId}/costs`,      label: "Costos"     },
    { href: `/agro/${farmId}/evidence`,   label: "Evidencia"  },
    { href: `/agro/${farmId}/audit`,      label: "Auditoría"  },
  ];
}

function StatCard({ label, value, icon: Icon, danger }: {
  label: string; value: string | number; icon?: typeof Beef; danger?: boolean;
}) {
  return (
    <div
      className={danger ? "stat-danger" : ""}
      style={{
        borderRadius: 12,
        border: "1px solid var(--border)",
        background: "var(--surface)",
        padding: "14px 16px",
        display: "flex",
        flexDirection: "column",
        gap: 6,
      }}
    >
      {Icon && <Icon size={14} color={danger ? "#fca5a5" : "var(--muted)"} />}
      <p style={{ fontSize: 11, color: "var(--muted)", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em" }}>{label}</p>
      <p className={danger ? "sv" : ""} style={{ fontSize: 22, fontWeight: 800, color: danger ? "#fca5a5" : "var(--ink)", letterSpacing: "-0.03em", lineHeight: 1 }}>
        {value}
      </p>
    </div>
  );
}

function SkeletonDash() {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <div className="skel" style={{ height: 28, width: 200 }} />
      <div style={{ display: "grid", gap: 10, gridTemplateColumns: "repeat(auto-fill, minmax(140px, 1fr))" }}>
        {[1,2,3,4,5,6,7].map(i => <div key={i} className="skel" style={{ height: 78 }} />)}
      </div>
    </div>
  );
}

export default function FarmDashboardPage() {
  const { farmId } = useParams<{ farmId: string }>();
  const pathname   = usePathname();
  const [data, setData]     = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState<string | null>(null);

  useEffect(() => { if (farmId) void load(); }, [farmId]);

  async function load() {
    setLoading(true); setError(null);
    try {
      const res  = await fetch(`/api/semse/agro/farms/${farmId}/dashboard`);
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error?.message ?? `HTTP ${res.status}`);
      setData(json.data as DashboardData);
    } catch (err: any) { setError(err?.message ?? "Error cargando dashboard"); }
    finally { setLoading(false); }
  }

  const tabs = farmId ? farmTabs(farmId) : [];

  return (
    <div className="agro-shell">
      {/* Breadcrumb */}
      <nav className="bread">
        <Link href="/agro">Agro</Link>
        <ChevronRight size={12} color="var(--faint)" />
        <span style={{ color: "var(--ink)" }}>{data?.farm.name ?? "Finca"}</span>
      </nav>

      {/* Farm title */}
      {data && (
        <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 20 }}>
          <div style={{ width: 40, height: 40, borderRadius: 10, background: "rgba(16,185,129,.14)", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <Leaf size={20} color="#6ee7b7" />
          </div>
          <div>
            <h1 style={{ fontSize: 20, fontWeight: 800, color: "var(--ink)", letterSpacing: "-0.03em", lineHeight: 1.1 }}>
              {data.farm.name}
            </h1>
            <p style={{ fontSize: 12, color: "var(--muted)", marginTop: 2 }}>{data.farm.operationType}</p>
          </div>
        </div>
      )}

      {/* Tab bar */}
      <nav className="tab-bar">
        {tabs.map(tab => (
          <Link
            key={tab.href}
            href={tab.href}
            className="tab-item"
            data-active={pathname === tab.href ? "true" : "false"}
          >
            {tab.label}
          </Link>
        ))}
      </nav>

      {loading && <SkeletonDash />}
      {error && <div className="alert-banner alert-critical">{error}</div>}

      {!loading && !error && data && (() => {
        const { counts, monthCostSummary, alerts, nextBestActions } = data;
        return (
          <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>

            {/* Alerts */}
            {alerts.length > 0 && (
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {alerts.map((alert, i) => {
                  const cfg = ALERT_CFG[alert.severity] ?? ALERT_CFG.INFO;
                  const Icon = cfg.Icon;
                  return (
                    <div key={i} className={`alert-banner ${cfg.cls}`} style={{ display: "flex", alignItems: "flex-start", gap: 10 }}>
                      <Icon size={14} style={{ flexShrink: 0, marginTop: 1 }} />
                      <span>
                        <strong style={{ textTransform: "capitalize", marginRight: 4 }}>{alert.type.replace(/_/g, " ")}</strong>
                        {alert.message}
                      </span>
                    </div>
                  );
                })}
              </div>
            )}

            {/* Stat grid */}
            <div style={{ display: "grid", gap: 10, gridTemplateColumns: "repeat(auto-fill, minmax(138px, 1fr))" }}>
              <StatCard label="Animales"            value={counts.totalAnimals}           icon={Beef} />
              <StatCard label="Pend. tareas"        value={counts.pendingTasks}            icon={CheckSquare} />
              <StatCard label="Vencidas"            value={counts.overdueTasks}            icon={AlertTriangle} danger={counts.overdueTasks > 0} />
              <StatCard label="Completadas / sem."  value={counts.completedThisWeek}       icon={TrendingUp} />
              <StatCard label="Inventario"          value={counts.inventoryItems}          icon={Package} />
              <StatCard label="Stock bajo"          value={counts.lowStockItems}           icon={Package} danger={counts.lowStockItems > 0} />
              <StatCard
                label="Costo del mes"
                value={`$${monthCostSummary.total.toLocaleString("es-CO", { minimumFractionDigits: 0 })} ${monthCostSummary.currency}`}
                icon={DollarSign}
              />
            </div>

            {/* Next best actions */}
            {nextBestActions.length > 0 && (
              <div style={{ borderRadius: 14, border: "1px solid var(--border)", background: "var(--surface)", padding: "18px 20px" }}>
                <h2 style={{ fontSize: 13, fontWeight: 700, color: "var(--ink)", marginBottom: 14, letterSpacing: "-0.01em" }}>
                  Próximas acciones recomendadas
                </h2>
                <ol style={{ listStyle: "none", margin: 0, padding: 0, display: "flex", flexDirection: "column", gap: 10 }}>
                  {nextBestActions.map((action, i) => (
                    <li key={i} style={{ display: "flex", alignItems: "flex-start", gap: 12 }}>
                      <span style={{
                        flexShrink: 0, width: 22, height: 22,
                        borderRadius: "50%", background: "var(--accent-dim)",
                        color: "var(--accent)", fontSize: 11, fontWeight: 800,
                        display: "flex", alignItems: "center", justifyContent: "center",
                      }}>
                        {action.priority}
                      </span>
                      <div>
                        <p style={{ fontSize: 13, fontWeight: 600, color: "var(--ink)", lineHeight: 1.3, marginBottom: 2 }}>
                          {action.action.replace(/_/g, " ")}
                        </p>
                        <p style={{ fontSize: 12, color: "var(--muted)" }}>{action.detail}</p>
                      </div>
                    </li>
                  ))}
                </ol>
              </div>
            )}
          </div>
        );
      })()}
    </div>
  );
}
