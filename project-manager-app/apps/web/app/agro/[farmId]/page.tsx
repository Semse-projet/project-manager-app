"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";

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
    animals: number;
    animalGroups: number;
    totalAnimals: number;
    pendingTasks: number;
    blockedTasks: number;
    overdueTasks: number;
    completedThisWeek: number;
    inventoryItems: number;
    lowStockItems: number;
  };
  monthCostSummary: { total: number; since: string; currency: string };
  alerts: Alert[];
  nextBestActions: { priority: number; action: string; detail: string }[];
}

const ALERT_SEVERITY_STYLES: Record<string, string> = {
  CRITICAL: "border-red-200 bg-red-50 text-red-700",
  WARNING:  "border-amber-200 bg-amber-50 text-amber-700",
  INFO:     "border-blue-200 bg-blue-50 text-blue-700",
};

export default function FarmDashboardPage() {
  const { farmId } = useParams<{ farmId: string }>();
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!farmId) return;
    void load();
  }, [farmId]);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/semse/agro/farms/${farmId}/dashboard`);
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error?.message ?? `HTTP ${res.status}`);
      setData(json.data as DashboardData);
    } catch (err: any) {
      setError(err?.message ?? "Error cargando dashboard");
    } finally {
      setLoading(false);
    }
  }

  if (loading) return <div className="p-8 text-sm text-[var(--muted)]">Cargando...</div>;
  if (error) return <div className="p-8 text-sm text-red-600">{error}</div>;
  if (!data) return null;

  const { farm, counts, monthCostSummary, alerts, nextBestActions } = data;

  return (
    <main className="mx-auto max-w-5xl px-4 py-8">
      {/* Breadcrumb */}
      <nav className="mb-6 flex items-center gap-2 text-xs text-[var(--muted)]">
        <Link href="/agro" className="hover:text-[var(--accent)]">Agro</Link>
        <span>/</span>
        <span className="text-[var(--ink)]">{farm.name}</span>
      </nav>

      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-xl font-semibold text-[var(--ink)]">{farm.name}</h1>
      </div>

      {/* Nav tabs */}
      <div className="mb-6 flex gap-1 overflow-x-auto">
        {[
          { href: `/agro/${farmId}`, label: "Dashboard" },
          { href: `/agro/${farmId}/animals`, label: "Animales" },
          { href: `/agro/${farmId}/tasks`, label: "Tareas" },
          { href: `/agro/${farmId}/inventory`, label: "Inventario" },
          { href: `/agro/${farmId}/evidence`, label: "Evidencia" },
          { href: `/agro/${farmId}/audit`, label: "Auditoría" },
        ].map((tab) => (
          <Link
            key={tab.href}
            href={tab.href}
            className="whitespace-nowrap rounded-lg px-3 py-1.5 text-xs font-medium text-[var(--muted)] hover:bg-[var(--surface)] hover:text-[var(--ink)]"
          >
            {tab.label}
          </Link>
        ))}
      </div>

      {/* Alerts */}
      {alerts.length > 0 && (
        <div className="mb-6 space-y-2">
          {alerts.map((alert, i) => (
            <div
              key={i}
              className={`rounded-lg border px-4 py-2.5 text-xs ${ALERT_SEVERITY_STYLES[alert.severity] ?? "border-[var(--border)] bg-[var(--surface)] text-[var(--ink)]"}`}
            >
              <span className="font-medium">[{alert.type}]</span> {alert.message}
            </div>
          ))}
        </div>
      )}

      {/* Stats grid */}
      <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
        {[
          { label: "Animales", value: counts.totalAnimals },
          { label: "Tareas pendientes", value: counts.pendingTasks },
          { label: "Tareas vencidas", value: counts.overdueTasks, danger: counts.overdueTasks > 0 },
          { label: "Completadas esta semana", value: counts.completedThisWeek },
          { label: "Items inventario", value: counts.inventoryItems },
          { label: "Stock bajo", value: counts.lowStockItems, danger: counts.lowStockItems > 0 },
          { label: "Costo del mes", value: `$${monthCostSummary.total.toFixed(2)} ${monthCostSummary.currency}` },
        ].map((stat) => (
          <div
            key={stat.label}
            className={`rounded-xl border p-4 ${stat.danger ? "border-red-200 bg-red-50" : "border-[var(--border)] bg-[var(--surface)]"}`}
          >
            <p className="text-xs text-[var(--muted)]">{stat.label}</p>
            <p className={`mt-1 text-xl font-bold ${stat.danger ? "text-red-700" : "text-[var(--ink)]"}`}>
              {stat.value}
            </p>
          </div>
        ))}
      </div>

      {/* Next best actions */}
      {nextBestActions.length > 0 && (
        <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4">
          <h2 className="mb-3 text-sm font-semibold text-[var(--ink)]">Próximas acciones</h2>
          <ol className="space-y-2">
            {nextBestActions.map((action, i) => (
              <li key={i} className="flex items-start gap-2 text-sm">
                <span className="flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full bg-[var(--accent)] text-xs text-white">
                  {action.priority}
                </span>
                <span>
                  <strong>{action.action.replace(/_/g, " ")}</strong> — {action.detail}
                </span>
              </li>
            ))}
          </ol>
        </div>
      )}
    </main>
  );
}
