"use client";

import { useState } from "react";
import Link from "next/link";
import { useParams, usePathname } from "next/navigation";
import { ChevronRight, ClipboardList, AlertTriangle, Info, TrendingUp } from "lucide-react";
import { farmTabs } from "../farm-tabs";

interface AuditReport {
  farmId: string;
  farmName: string;
  period: { from: string; to: string };
  score: number;
  summary: {
    totalTasks: number;
    completedTasks: number;
    overdueTasks: number;
    blockedTasks: number;
    activeAnimals: number;
    lowStockItems: number;
    weekCost: number;
    eventCount: number;
  };
  findings: { type: "CRITICAL" | "WARNING" | "INFO"; area: string; message: string }[];
  recommendations: string[];
}

const FINDING_CONFIG: Record<string, { color: string; bg: string; Icon: typeof AlertTriangle }> = {
  CRITICAL: { color: "#fca5a5", bg: "rgba(239,68,68,.1)",    Icon: AlertTriangle },
  WARNING:  { color: "#fcd34d", bg: "rgba(245,158,11,.08)",  Icon: AlertTriangle },
  INFO:     { color: "#93c5fd", bg: "rgba(59,130,246,.08)",  Icon: Info },
};

function scoreColor(score: number) {
  if (score >= 80) return "#6ee7b7";
  if (score >= 50) return "#fcd34d";
  return "#fca5a5";
}


export default function AuditPage() {
  const { farmId } = useParams<{ farmId: string }>();
  const pathname  = usePathname();
  const [report, setReport]   = useState<AuditReport | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState<string | null>(null);

  async function generate() {
    setLoading(true); setError(null);
    try {
      const res  = await fetch(`/api/semse/agro/farms/${farmId}/audit-report`, { method: "POST" });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error?.message ?? "Error");
      setReport((json.data as any)?.report ?? json.data);
    } catch (err: any) { setError(err?.message ?? "Error generando reporte"); }
    finally { setLoading(false); }
  }

  const tabs = farmId ? farmTabs(farmId) : [];

  return (
    <div className="agro-shell">
      <nav className="bread">
        <Link href="/agro">Agro</Link>
        <ChevronRight size={12} color="var(--faint)" />
        <Link href={`/agro/${farmId}`}>Finca</Link>
        <ChevronRight size={12} color="var(--faint)" />
        <span style={{ color: "var(--ink)" }}>Auditoría</span>
      </nav>

      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, marginBottom: 20 }}>
        <div>
          <h1 style={{ fontSize: 20, fontWeight: 800, color: "var(--ink)", letterSpacing: "-0.03em" }}>Auditoría semanal</h1>
          <p style={{ fontSize: 12, color: "var(--muted)", marginTop: 3 }}>Reporte automático de salud operativa, hallazgos y recomendaciones</p>
        </div>
        <button className="btn-accent" onClick={() => void generate()} disabled={loading}>
          {loading ? "Generando…" : "Generar reporte"}
        </button>
      </div>

      <nav className="tab-bar">
        {tabs.map(tab => (
          <Link key={tab.href} href={tab.href} className="tab-item"
            data-active={pathname === tab.href ? "true" : "false"}>{tab.label}</Link>
        ))}
      </nav>

      {error && <div className="alert-banner alert-critical" style={{ marginBottom: 16 }}>{error}</div>}

      {!report && !loading && (
        <div className="empty-state">
          <ClipboardList size={36} className="empty-icon" />
          <p className="empty-title">Sin reporte generado</p>
          <p className="empty-desc">Genera un reporte para ver el estado operativo de la finca: tareas, animales, costos, inventario y hallazgos.</p>
          <button className="btn-accent" onClick={() => void generate()} disabled={loading}>
            Generar reporte
          </button>
        </div>
      )}

      {loading && (
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <div className="skel" style={{ height: 100 }} />
          <div style={{ display: "grid", gap: 10, gridTemplateColumns: "repeat(auto-fill, minmax(140px, 1fr))" }}>
            {[1,2,3,4].map(i => <div key={i} className="skel" style={{ height: 70 }} />)}
          </div>
          <div className="skel" style={{ height: 120 }} />
        </div>
      )}

      {report && !loading && (
        <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>

          {/* Score strip */}
          <div style={{
            borderRadius: 14,
            border: "1px solid var(--border)",
            background: "var(--surface)",
            padding: "20px 24px",
            display: "flex",
            alignItems: "center",
            gap: 24,
          }}>
            <div style={{ textAlign: "center", flexShrink: 0 }}>
              <p style={{ fontSize: 52, fontWeight: 900, color: scoreColor(report.score), lineHeight: 1 }}>{report.score}</p>
              <p style={{ fontSize: 11, color: "var(--faint)", marginTop: 4 }}>/ 100</p>
            </div>
            <div style={{ width: 1, height: 56, background: "var(--border)", flexShrink: 0 }} />
            <div>
              <p style={{ fontSize: 16, fontWeight: 800, color: "var(--ink)" }}>{report.farmName}</p>
              <p style={{ fontSize: 12, color: "var(--muted)", marginTop: 3 }}>
                {new Date(report.period.from).toLocaleDateString("es-MX")} —{" "}
                {new Date(report.period.to).toLocaleDateString("es-MX")}
              </p>
            </div>
            <div style={{ marginLeft: "auto" }}>
              <span className={
                report.score >= 80 ? "badge badge-green" :
                report.score >= 50 ? "badge badge-amber" : "badge badge-red"
              }>
                {report.score >= 80 ? "Excelente" : report.score >= 50 ? "Regular" : "Crítico"}
              </span>
            </div>
          </div>

          {/* Summary grid */}
          <div style={{ display: "grid", gap: 10, gridTemplateColumns: "repeat(auto-fill, minmax(150px, 1fr))" }}>
            {[
              { label: "Tareas totales",    value: report.summary.totalTasks,     color: "#93c5fd" },
              { label: "Completadas",       value: report.summary.completedTasks,  color: "#6ee7b7" },
              { label: "Vencidas",          value: report.summary.overdueTasks,    color: report.summary.overdueTasks > 0 ? "#fca5a5" : "#6ee7b7" },
              { label: "Animales activos",  value: report.summary.activeAnimals,   color: "#6ee7b7" },
              { label: "Stock bajo",        value: report.summary.lowStockItems,   color: report.summary.lowStockItems > 0 ? "#fcd34d" : "#6ee7b7" },
              { label: "Costo semana",      value: `$${report.summary.weekCost.toFixed(2)}`, color: "#fcd34d" },
              { label: "Eventos",           value: report.summary.eventCount,      color: "#93c5fd" },
            ].map(s => (
              <div key={s.label} style={{
                borderRadius: 10,
                border: "1px solid var(--border)",
                borderTop: `3px solid ${s.color}`,
                background: "var(--surface)",
                padding: "12px 14px",
              }}>
                <p style={{ fontSize: 11, color: "var(--muted)", marginBottom: 4 }}>{s.label}</p>
                <p style={{ fontSize: 20, fontWeight: 800, color: s.color }}>{s.value}</p>
              </div>
            ))}
          </div>

          {/* Findings */}
          {report.findings.length > 0 && (
            <div>
              <h2 style={{ fontSize: 13, fontWeight: 700, color: "var(--ink)", marginBottom: 10, textTransform: "uppercase", letterSpacing: "0.06em" }}>
                Hallazgos ({report.findings.length})
              </h2>
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {report.findings.map((f, i) => {
                  const cfg = FINDING_CONFIG[f.type] ?? FINDING_CONFIG.INFO;
                  const FindingIcon = cfg.Icon;
                  return (
                    <div key={i} style={{
                      borderRadius: 10,
                      border: `1px solid ${cfg.color}30`,
                      borderLeft: `3px solid ${cfg.color}`,
                      background: cfg.bg,
                      padding: "10px 14px",
                      display: "flex",
                      gap: 10,
                      alignItems: "flex-start",
                    }}>
                      <FindingIcon size={14} color={cfg.color} style={{ flexShrink: 0, marginTop: 2 }} />
                      <div>
                        <span style={{ fontSize: 11, fontWeight: 700, color: cfg.color, textTransform: "uppercase", letterSpacing: "0.06em" }}>
                          {f.type} · {f.area}
                        </span>
                        <p style={{ fontSize: 13, color: "var(--ink)", marginTop: 3, lineHeight: 1.45 }}>{f.message}</p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Recommendations */}
          {report.recommendations.length > 0 && (
            <div style={{
              borderRadius: 12,
              border: "1px solid rgba(110,231,183,.2)",
              background: "rgba(16,185,129,.05)",
              padding: "16px 18px",
            }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
                <TrendingUp size={15} color="#6ee7b7" />
                <h2 style={{ fontSize: 13, fontWeight: 700, color: "#6ee7b7", textTransform: "uppercase", letterSpacing: "0.06em" }}>
                  Recomendaciones
                </h2>
              </div>
              <ul style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {report.recommendations.map((r, i) => (
                  <li key={i} style={{ display: "flex", gap: 8, alignItems: "flex-start" }}>
                    <span style={{ color: "#6ee7b7", fontSize: 14, flexShrink: 0, marginTop: 1 }}>→</span>
                    <span style={{ fontSize: 13, color: "var(--ink)", lineHeight: 1.5 }}>{r}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
