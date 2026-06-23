"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";

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

const SCORE_COLOR = (score: number) =>
  score >= 80 ? "text-green-600" : score >= 50 ? "text-amber-500" : "text-red-600";

const FINDING_STYLES: Record<string, string> = {
  CRITICAL: "border-red-200 bg-red-50 text-red-700",
  WARNING:  "border-amber-200 bg-amber-50 text-amber-700",
  INFO:     "border-blue-200 bg-blue-50 text-blue-700",
};

export default function AuditPage() {
  const { farmId } = useParams<{ farmId: string }>();
  const [report, setReport] = useState<AuditReport | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function generate() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/semse/agro/farms/${farmId}/audit-report`, { method: "POST" });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error?.message ?? "Error");
      setReport((json.data as any)?.report ?? json.data);
    } catch (err: any) {
      setError(err?.message ?? "Error generando reporte");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="mx-auto max-w-5xl px-4 py-8">
      <nav className="mb-6 flex items-center gap-2 text-xs text-[var(--muted)]">
        <Link href="/agro" className="hover:text-[var(--accent)]">Agro</Link>
        <span>/</span>
        <Link href={`/agro/${farmId}`} className="hover:text-[var(--accent)]">Finca</Link>
        <span>/</span>
        <span className="text-[var(--ink)]">Auditoría semanal</span>
      </nav>

      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-xl font-semibold text-[var(--ink)]">Reporte de auditoría</h1>
        <button
          onClick={() => void generate()}
          disabled={loading}
          className="rounded-lg bg-[var(--accent)] px-4 py-2 text-sm font-medium text-white hover:opacity-90 disabled:opacity-50"
        >
          {loading ? "Generando..." : "Generar reporte"}
        </button>
      </div>

      {error && <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}

      {!report ? (
        <div className="rounded-xl border border-dashed border-[var(--border)] py-16 text-center">
          <p className="text-sm text-[var(--muted)]">Haz clic en "Generar reporte" para analizar la semana.</p>
        </div>
      ) : (
        <div className="space-y-6">
          {/* Score */}
          <div className="flex items-center gap-6 rounded-xl border border-[var(--border)] bg-[var(--surface)] p-6">
            <div className="text-center">
              <p className={`text-5xl font-bold ${SCORE_COLOR(report.score)}`}>{report.score}</p>
              <p className="mt-1 text-xs text-[var(--muted)]">/ 100</p>
            </div>
            <div>
              <h2 className="text-base font-semibold text-[var(--ink)]">{report.farmName}</h2>
              <p className="text-xs text-[var(--muted)]">
                {new Date(report.period.from).toLocaleDateString("es-MX")} —{" "}
                {new Date(report.period.to).toLocaleDateString("es-MX")}
              </p>
            </div>
          </div>

          {/* Summary */}
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {[
              { label: "Tareas completadas", value: `${report.summary.completedTasks} / ${report.summary.totalTasks}` },
              { label: "Tareas vencidas", value: report.summary.overdueTasks, danger: report.summary.overdueTasks > 0 },
              { label: "Animales activos", value: report.summary.activeAnimals },
              { label: "Costo semana (USD)", value: `$${report.summary.weekCost.toFixed(2)}` },
            ].map((s) => (
              <div key={s.label} className={`rounded-xl border p-3 ${(s as any).danger ? "border-red-200 bg-red-50" : "border-[var(--border)] bg-[var(--surface)]"}`}>
                <p className="text-xs text-[var(--muted)]">{s.label}</p>
                <p className={`text-lg font-bold ${(s as any).danger ? "text-red-700" : "text-[var(--ink)]"}`}>{s.value}</p>
              </div>
            ))}
          </div>

          {/* Findings */}
          {report.findings.length > 0 && (
            <div>
              <h2 className="mb-3 text-sm font-semibold text-[var(--ink)]">Hallazgos</h2>
              <div className="space-y-2">
                {report.findings.map((f, i) => (
                  <div key={i} className={`rounded-lg border px-4 py-2.5 text-xs ${FINDING_STYLES[f.type] ?? ""}`}>
                    <span className="font-medium">[{f.type}] [{f.area}]</span> {f.message}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Recommendations */}
          {report.recommendations.length > 0 && (
            <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4">
              <h2 className="mb-3 text-sm font-semibold text-[var(--ink)]">Recomendaciones</h2>
              <ul className="space-y-1">
                {report.recommendations.map((r, i) => (
                  <li key={i} className="flex gap-2 text-sm text-[var(--ink)]">
                    <span className="text-[var(--accent)]">→</span> {r}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </main>
  );
}
