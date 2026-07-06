"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { ChevronLeft, ChevronRight, Download } from "lucide-react";
import {
  fetchFreeProjects,
  fetchLaborEntries,
  fetchMonthlySummary,
  fetchWeeklySummary,
  type FreeProjectView,
  type MonthlySummaryView,
  type TimeEntryView,
  type WeeklySummaryView,
} from "../../../labor-api";
import type { JobRecordView } from "../../../../semse-api";
import {
  BarList,
  ChangeBadge,
  ChartCard,
  ColumnChart,
  KpiCard,
  PURPOSE_CHART_COLORS,
  PURPOSE_SHORT_LABELS,
  TrendChart,
  entryCost,
  entrySeconds,
  exportEntriesCsv,
  fmtHours,
  fmtMoney,
  resolveEntryProject,
  sectionCard,
} from "./trackerUi";

function weekRangeLabel(summary: WeeklySummaryView | null): string {
  if (!summary) return "";
  const from = new Date(summary.from);
  const to = new Date(summary.to);
  const fmt = (d: Date) => d.toLocaleDateString("es-MX", { day: "2-digit", month: "short" });
  if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime())) return "";
  return `${fmt(from)} – ${fmt(to)}`;
}

export function ReportesTab({ jobs }: { jobs: JobRecordView[] }) {
  const [weekOffset, setWeekOffset] = useState(0);
  const [weekly, setWeekly] = useState<WeeklySummaryView | null>(null);
  const [monthly, setMonthly] = useState<MonthlySummaryView | null>(null);
  const [entries, setEntries] = useState<TimeEntryView[]>([]);
  const [freeProjects, setFreeProjects] = useState<FreeProjectView[]>([]);
  const [loading, setLoading] = useState(true);
  const [weekLoading, setWeekLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    const run = async () => {
      setLoading(true);
      setError(null);
      try {
        const [monthlyResult, entriesResult, projectsResult] = await Promise.all([
          fetchMonthlySummary(),
          fetchLaborEntries({ range: "month", limit: 500 }),
          fetchFreeProjects(),
        ]);
        if (cancelled) return;
        setMonthly(monthlyResult);
        setEntries(entriesResult);
        setFreeProjects(projectsResult);
      } catch (caught) {
        if (!cancelled) setError(caught instanceof Error ? caught.message : "No se pudo cargar el reporte.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    void run();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    const run = async () => {
      setWeekLoading(true);
      try {
        const result = await fetchWeeklySummary(weekOffset);
        if (!cancelled) setWeekly(result);
      } catch (caught) {
        if (!cancelled) setError(caught instanceof Error ? caught.message : "No se pudo cargar la semana.");
      } finally {
        if (!cancelled) setWeekLoading(false);
      }
    };
    void run();
    return () => {
      cancelled = true;
    };
  }, [weekOffset]);

  const resolveProject = useCallback(
    (entry: TimeEntryView) => resolveEntryProject(entry, freeProjects, jobs),
    [freeProjects, jobs]
  );

  const weekEntries = useMemo(() => {
    if (!weekly) return [];
    const from = weekly.from.slice(0, 10);
    const to = weekly.to.slice(0, 10);
    return entries.filter((entry) => {
      const day = entry.startedAt.slice(0, 10);
      return day >= from && day <= to;
    });
  }, [entries, weekly]);

  const weekColumns = useMemo(() => (
    (weekly?.byDay ?? []).map((day) => ({
      label: new Date(`${day.date}T12:00:00`).toLocaleDateString("es-MX", { weekday: "short", day: "numeric" }),
      value: day.minutes * 60,
    }))
  ), [weekly]);

  const monthTrend = useMemo(() => (
    (monthly?.byDay ?? []).map((day) => ({
      label: new Date(`${day.date}T12:00:00`).toLocaleDateString("es-MX", { day: "numeric", month: "short" }),
      value: day.minutes * 60,
    }))
  ), [monthly]);

  const purposeBars = useMemo(() => (
    (Object.keys(PURPOSE_SHORT_LABELS) as TimeEntryView["purpose"][])
      .map((purpose) => ({
        label: PURPOSE_SHORT_LABELS[purpose],
        value: weekEntries.filter((entry) => entry.purpose === purpose).reduce((sum, entry) => sum + entrySeconds(entry), 0),
        color: PURPOSE_CHART_COLORS[purpose],
      }))
      .filter((item) => item.value > 0)
  ), [weekEntries]);

  const projectBars = useMemo(() => {
    const totals = new Map<string, { label: string; color: string; seconds: number }>();
    for (const entry of weekEntries) {
      const project = resolveProject(entry);
      const current = totals.get(project.label) ?? { ...project, seconds: 0 };
      current.seconds += entrySeconds(entry);
      totals.set(project.label, current);
    }
    return [...totals.values()]
      .sort((a, b) => b.seconds - a.seconds)
      .slice(0, 6)
      .map((item) => ({ label: item.label, value: item.seconds, color: item.color }));
  }, [resolveProject, weekEntries]);

  const weekCost = useMemo(
    () => weekEntries.reduce((sum, entry) => sum + (entryCost(entry) ?? 0), 0),
    [weekEntries]
  );

  const daysWorked = useMemo(
    () => (weekly?.byDay ?? []).filter((day) => day.minutes > 0).length,
    [weekly]
  );

  if (loading) {
    return <div style={{ ...sectionCard, color: "var(--muted)", fontSize: "13px" }}>Cargando reportes...</div>;
  }

  if (error && !weekly && !monthly) {
    return (
      <div style={{ ...sectionCard, color: "#ef4444", fontSize: "13px", background: "rgba(239,68,68,.08)", border: "1px solid rgba(239,68,68,.18)" }}>
        {error}
      </div>
    );
  }

  const weekSeconds = (weekly?.totalMinutes ?? 0) * 60;

  return (
    <div style={{ display: "grid", gap: "16px" }}>
      <div style={{ ...sectionCard, display: "flex", justifyContent: "space-between", alignItems: "center", gap: "12px", flexWrap: "wrap", padding: "14px 20px" }}>
        <div>
          <h3 style={{ fontSize: "14px", fontWeight: 800, color: "var(--ink)", margin: 0 }}>Reporte semanal</h3>
          <p style={{ fontSize: "11px", color: "var(--muted)", margin: "3px 0 0" }}>
            {weekOffset === 0 ? "Semana actual" : `Hace ${weekOffset} semana${weekOffset > 1 ? "s" : ""}`} · {weekRangeLabel(weekly)}
          </p>
        </div>
        <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
          <button type="button" onClick={() => setWeekOffset((current) => Math.min(current + 1, 11))} disabled={weekLoading || weekOffset >= 11} style={navButton(weekLoading || weekOffset >= 11)} aria-label="Semana anterior">
            <ChevronLeft size={14} />
          </button>
          <button type="button" onClick={() => setWeekOffset((current) => Math.max(current - 1, 0))} disabled={weekLoading || weekOffset === 0} style={navButton(weekLoading || weekOffset === 0)} aria-label="Semana siguiente">
            <ChevronRight size={14} />
          </button>
          <button
            type="button"
            onClick={() => exportEntriesCsv(weekEntries, resolveProject, `semse-reporte-semana-${weekly?.from.slice(0, 10) ?? weekOffset}.csv`)}
            disabled={weekEntries.length === 0}
            style={navButton(weekEntries.length === 0)}
            title={weekOffset > 0 ? "Exporta registros del mes cargado dentro de la semana seleccionada" : undefined}
          >
            <Download size={13} /> CSV semana
          </button>
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(170px, 1fr))", gap: "10px" }}>
        <KpiCard
          label="Total semana"
          value={fmtHours(weekSeconds)}
          color="#3b82f6"
          badge={<ChangeBadge value={weekly?.changePercent ?? null} />}
        />
        <KpiCard label="Días trabajados" value={String(daysWorked)} color="#059669" hint={daysWorked > 0 ? `${fmtHours(Math.round(weekSeconds / daysWorked))} promedio/día` : undefined} />
        <KpiCard label="Registros" value={String(weekly?.totalEntries ?? 0)} color="#8b5cf6" hint="en la semana" />
        <KpiCard label="Costo estimado" value={weekCost > 0 ? fmtMoney(weekCost) : "—"} color="var(--accent)" hint="según tarifas registradas" />
      </div>

      <ChartCard title="Horas por día" subtitle={`Semana ${weekRangeLabel(weekly)}`}>
        {weekLoading ? (
          <p style={{ fontSize: "13px", color: "var(--muted)", margin: 0 }}>Cargando semana...</p>
        ) : (
          <ColumnChart points={weekColumns} color="#3b82f6" valueFmt={fmtHours} />
        )}
      </ChartCard>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))", gap: "16px" }}>
        <ChartCard title="Por propósito" subtitle="Semana seleccionada (registros del mes cargado)">
          <BarList items={purposeBars} valueFmt={fmtHours} emptyText="Sin registros en esta semana." />
        </ChartCard>
        <ChartCard title="Por proyecto" subtitle="Semana seleccionada (registros del mes cargado)">
          <BarList items={projectBars} valueFmt={fmtHours} emptyText="Sin registros en esta semana." />
        </ChartCard>
      </div>

      <ChartCard title="Tendencia mensual" subtitle={`${monthly?.totalEntries ?? 0} registros · ${fmtHours((monthly?.totalMinutes ?? 0) * 60)} en el mes`}>
        <TrendChart points={monthTrend} color="#059669" valueFmt={fmtHours} />
      </ChartCard>
    </div>
  );
}

function navButton(disabled: boolean) {
  return {
    display: "inline-flex",
    alignItems: "center",
    gap: "6px",
    height: "32px",
    padding: "0 10px",
    borderRadius: "8px",
    border: "1px solid var(--border)",
    background: "var(--surface)",
    color: "var(--ink)",
    fontSize: "12px",
    fontWeight: 700,
    cursor: disabled ? "not-allowed" : "pointer",
    opacity: disabled ? 0.5 : 1,
  } as const;
}
