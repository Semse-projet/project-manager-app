"use client";

import { useEffect, useMemo, useState } from "react";
import { BarChart2, Download, Calendar, TrendingUp, Users, Briefcase, DollarSign } from "lucide-react";
import { HtmlInCanvasPanel } from "@semse/ui";
import { fetchJobs, fetchJobPayments, fetchAutonomyRuns, fetchDisputes, type JobRecordView } from "../../../semse-api";
import { AdminPageHeader } from "../../../components/admin/AdminPageHeader";
import { NotificationBanner } from "../../../components/notifications/NotificationBanner";

// Only "Todo" reflects reality — none of the fetch calls below take a date
// range, so a period selector that claimed to filter by month/quarter/year
// would silently show the exact same numbers under a different label. See
// docs/AUDIT_REMEDIATION_PLAN.md 3.43. Real range filtering needs backend
// query-param support before more options can be added honestly.
const PERIODS = ["Todo"] as const;
type Period = typeof PERIODS[number];

const REPORT_TYPES = [
  { id: "ops",      label: "Operaciones",     description: "Trabajos creados, completados, tasa de cierre y tiempo promedio.", icon: Briefcase,   color: "#3b82f6" },
  { id: "finance",  label: "Financiero",      description: "Escrow total, comisiones, liberaciones y disputas por período.",   icon: DollarSign,  color: "#10b981" },
  { id: "agents",   label: "Rendimiento IA",  description: "Runs de agentes, tasas de confianza, revisión humana requerida.", icon: TrendingUp,  color: "#8b5cf6" },
  { id: "users",    label: "Usuarios",        description: "Nuevos registros, actividad por rol y retención.",                 icon: Users,       color: "#f59e0b" },
];

interface Metric { label: string; value: string; change: string; up: boolean }
type ReportRow = Record<string, string | number>;

const DEFAULT_METRICS: Metric[] = [
  { label: "Trabajos totales", value: "—", change: "—", up: true },
  { label: "Volumen escrow", value: "—", change: "—", up: true },
  { label: "Tiempo promedio cierre", value: "—", change: "—", up: true },
  { label: "Disputas abiertas", value: "—", change: "—", up: false },
  { label: "Trabajos en curso", value: "—", change: "—", up: true },
  { label: "Runs de agentes", value: "—", change: "—", up: true },
];

export default function AdminReportsPage() {
  const [period] = useState<Period>("Todo");
  const [selected, setSelected] = useState<string | null>(null);
  const [metrics, setMetrics] = useState<Metric[]>(DEFAULT_METRICS);
  const [reportRows, setReportRows] = useState<Record<string, ReportRow[]>>({
    ops: [],
    finance: [],
    agents: [],
    users: []
  });
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      setError(null);
      try {
        const [jobsRes, disputesRes, runsRes] = await Promise.allSettled([
          fetchJobs(),
          fetchDisputes(),
          fetchAutonomyRuns()
        ]);
        if (jobsRes.status === "rejected") {
          throw jobsRes.reason;
        }
        const jobs = jobsRes.value;
        const disputes = disputesRes.status === "fulfilled" ? disputesRes.value : [];
        const runsView = runsRes.status === "fulfilled" ? runsRes.value : { runs: [] };
        const warnings: string[] = [];
        if (disputesRes.status === "rejected") warnings.push("disputas");
        if (runsRes.status === "rejected") warnings.push("autonomy runs");

        const completed = jobs.filter(j => j.status === "completed").length;

        const paymentResults = await Promise.allSettled(
          jobs.map(async (job) => ({ job, txns: await fetchJobPayments(job.id) }))
        );
        const successfulPayments = paymentResults
          .filter((r): r is PromiseFulfilledResult<{ job: JobRecordView; txns: Record<string, unknown>[] }> => r.status === "fulfilled")
          .map(r => r.value);
        const failedPayments = paymentResults.filter(r => r.status === "rejected").length;
        if (failedPayments > 0) warnings.push(`${failedPayments} jobs sin pagos`);

        const totalEscrow = successfulPayments
          .flatMap(({ txns }) => txns)
          .reduce((sum, t) => {
            const row = t;
            if (row.status !== "SUCCEEDED") return sum;
            return sum + (typeof row.amount === "number" ? row.amount : Number(row.amount ?? 0));
          }, 0);

        const runCount = Array.isArray((runsView as Record<string, unknown>).runs)
          ? ((runsView as Record<string, unknown>).runs as unknown[]).length
          : 0;
        const openDisputes = disputes.filter((item) => {
          const row = item as Record<string, unknown>;
          return String(row.status ?? "").toUpperCase() === "OPEN";
        }).length;

        const financeRows = successfulPayments.flatMap(({ job, txns }) =>
          txns.map((txn) => {
            const row = txn;
            return {
              job: job.title,
              type: String(row.type ?? "UNKNOWN"),
              status: String(row.status ?? "UNKNOWN"),
              amount: typeof row.amount === "number" ? row.amount : Number(row.amount ?? 0),
              createdAt: typeof row.createdAt === "string" ? row.createdAt.slice(0, 10) : "—"
            } satisfies ReportRow;
          })
        );

        const runs = Array.isArray((runsView as Record<string, unknown>).runs)
          ? ((runsView as Record<string, unknown>).runs as Record<string, unknown>[])
          : [];
        setReportRows({
          ops: jobs.map((job) => ({
            title: job.title,
            status: job.status,
            budgetMin: job.budgetMin ?? 0,
            budgetMax: job.budgetMax ?? 0
          })),
          finance: financeRows,
          agents: runs.map((run) => ({
            id: String(run.id ?? ""),
            agentType: String(run.agentType ?? ""),
            status: String(run.status ?? ""),
            confidence: typeof run.confidence === "number" ? run.confidence : "",
            createdAt: typeof run.createdAt === "string" ? run.createdAt.slice(0, 10) : "—"
          })),
          users: disputes.map((item) => {
            const row = item as Record<string, unknown>;
            return {
              disputeId: String(row.id ?? ""),
              status: String(row.status ?? ""),
              reason: String(row.reason ?? row.reasonCode ?? "—"),
              createdAt: typeof row.createdAt === "string" ? row.createdAt.slice(0, 10) : "—"
            } satisfies ReportRow;
          })
        });
        setMetrics([
          { label: "Trabajos totales", value: String(jobs.length), change: `${completed} completados`, up: true },
          { label: "Volumen escrow", value: `$${totalEscrow.toLocaleString()}`, change: "acumulado", up: true },
          { label: "Tiempo promedio cierre", value: "—", change: "—", up: true },
          { label: "Disputas abiertas", value: String(openDisputes), change: "activas", up: false },
          { label: "Trabajos en curso", value: String(jobs.filter(j => j.status === "in_progress").length), change: "activos", up: true },
          { label: "Runs de agentes", value: runCount > 0 ? String(runCount) : "—", change: "total", up: true },
        ]);
        if (warnings.length > 0) {
          setError(`Falla parcial de carga: ${warnings.join(", ")}.`);
        }
      } catch (caught) {
        setError(caught instanceof Error ? caught.message : "No se pudieron cargar los reportes.");
      }
    })();
  }, []);

  const card: React.CSSProperties = {
    background: "var(--surface)", border: "1px solid var(--border)", borderRadius: "12px",
  };
  const activeRows = useMemo(
    () => selected ? reportRows[selected] ?? [] : [],
    [reportRows, selected]
  );

  function exportCsv() {
    if (!selected || activeRows.length === 0) return;
    const headers = Object.keys(activeRows[0]);
    const csv = [
      headers.join(","),
      ...activeRows.map((row) =>
        headers
          .map((header) => `"${String(row[header] ?? "").replaceAll('"', '""')}"`)
          .join(",")
      )
    ].join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `semse-${selected}-${period.toLowerCase().replaceAll(/\s+/g, "-")}.csv`;
    anchor.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div style={{ maxWidth: "1000px", margin: "0 auto" }}>
      <AdminPageHeader
        title="Reportes"
        subtitle="Métricas consolidadas del ecosistema SEMSE"
        icon={BarChart2}
        iconColor="#6366f1"
        iconBg="rgba(99,102,241,0.15)"
        panel
        actions={
          <>
            <NotificationBanner audience="admin" />
            <span style={{ padding: "6px 12px", borderRadius: "10px", background: "var(--surface)", border: "1px solid var(--border)", color: "var(--muted)", fontSize: "12px", fontWeight: 600, whiteSpace: "nowrap" }}>
              Histórico completo
            </span>
          </>
        }
      />

      {error ? (
        <div role="alert" style={{ background: "#450a0a", border: "1px solid #ef4444", borderRadius: "10px", padding: "12px 16px", marginBottom: "18px", color: "#fecaca", fontSize: "13px" }}>
          {error}
        </div>
      ) : null}

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(160px, 1fr))", gap: "12px", marginBottom: "24px" }}>
        {metrics.map(m => (
          <div key={m.label} style={{ ...card, padding: "14px 16px" }}>
            <p style={{ fontSize: "20px", fontWeight: 900, color: "var(--ink)" }}>{m.value}</p>
            <p style={{ fontSize: "11px", color: "var(--muted)", marginTop: "3px", marginBottom: "6px" }}>{m.label}</p>
            <span style={{ fontSize: "11px", fontWeight: 700, color: m.up ? "#10b981" : "#ef4444" }}>{m.change}</span>
            <span style={{ fontSize: "10px", color: "var(--faint)", marginLeft: "4px" }}>vs anterior</span>
          </div>
        ))}
      </div>

      <h2 style={{ fontSize: "14px", fontWeight: 700, color: "var(--ink)", marginBottom: "12px" }}>Tipos de reporte</h2>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))", gap: "12px", marginBottom: "24px" }}>
        {REPORT_TYPES.map(rt => {
          const Icon = rt.icon;
          const isSelected = selected === rt.id;
          return (
            <button
              key={rt.id}
              onClick={() => setSelected(isSelected ? null : rt.id)}
              style={{ ...card, padding: "16px", textAlign: "left", cursor: "pointer", border: `1px solid ${isSelected ? rt.color : "var(--border)"}`, background: isSelected ? `${rt.color}08` : "var(--surface)" }}
            >
              <div style={{ width: "36px", height: "36px", borderRadius: "10px", background: `${rt.color}18`, display: "flex", alignItems: "center", justifyContent: "center", marginBottom: "10px" }}>
                <Icon size={18} color={rt.color} />
              </div>
              <p style={{ fontSize: "13px", fontWeight: 700, color: "var(--ink)", marginBottom: "4px" }}>{rt.label}</p>
              <p style={{ fontSize: "11px", color: "var(--muted)", lineHeight: 1.5 }}>{rt.description}</p>
            </button>
          );
        })}
      </div>

      {selected && (
        <HtmlInCanvasPanel as="section" style={{ ...card, padding: "20px" }} canvasClassName="rounded-2xl" minHeight={160}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "16px" }}>
            <div>
              <h3 style={{ fontSize: "14px", fontWeight: 700, color: "var(--ink)" }}>
                Reporte: {REPORT_TYPES.find(r => r.id === selected)?.label} · {period}
              </h3>
              <p style={{ fontSize: "12px", color: "var(--muted)", marginTop: "3px", display: "flex", alignItems: "center", gap: "5px" }}><Calendar size={12} /> Generado: {new Date().toLocaleDateString("es")}</p>
            </div>
            <button
              onClick={exportCsv}
              disabled={activeRows.length === 0}
              style={{ display: "flex", alignItems: "center", gap: "6px", padding: "9px 16px", borderRadius: "8px", border: "1px solid var(--border)", background: "var(--bg)", color: activeRows.length === 0 ? "var(--faint)" : "var(--ink)", fontSize: "12px", fontWeight: 600, cursor: activeRows.length === 0 ? "not-allowed" : "pointer" }}
            >
              <Download size={14} />
              Exportar CSV
            </button>
          </div>
          {activeRows.length === 0 ? (
            <div style={{ padding: "48px 24px", textAlign: "center", borderRadius: "10px", border: "1px dashed var(--border)" }}>
              <BarChart2 size={32} style={{ color: "var(--faint)", margin: "0 auto 10px" }} />
              <p style={{ fontSize: "13px", color: "var(--muted)" }}>Sin filas para este reporte.</p>
            </div>
          ) : (
            <div style={{ overflowX: "auto", borderRadius: "10px", border: "1px solid var(--border)" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "12px" }}>
                <thead>
                  <tr style={{ background: "var(--raised)" }}>
                    {Object.keys(activeRows[0]).map((header) => (
                      <th key={header} style={{ textAlign: "left", padding: "10px 12px", color: "var(--muted)", fontWeight: 700, borderBottom: "1px solid var(--border)" }}>
                        {header}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {activeRows.slice(0, 12).map((row, index) => (
                    <tr key={index}>
                      {Object.keys(activeRows[0]).map((header) => (
                        <td key={header} style={{ padding: "10px 12px", color: "var(--ink)", borderBottom: "1px solid var(--border)" }}>
                          {String(row[header] ?? "—")}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </HtmlInCanvasPanel>
      )}
    </div>
  );
}
