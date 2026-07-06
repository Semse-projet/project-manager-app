"use client";

import { useEffect, useMemo, useState } from "react";
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
  DonutChart,
  KpiCard,
  PURPOSE_CHART_COLORS,
  PURPOSE_SHORT_LABELS,
  PurposeChip,
  TrendChart,
  entryCost,
  entrySeconds,
  entryDateLabel,
  fmtHours,
  fmtMoney,
  resolveEntryProject,
  sectionCard,
} from "./trackerUi";

export function ResumenTab({ jobs }: { jobs: JobRecordView[] }) {
  const [weekly, setWeekly] = useState<WeeklySummaryView | null>(null);
  const [monthly, setMonthly] = useState<MonthlySummaryView | null>(null);
  const [entries, setEntries] = useState<TimeEntryView[]>([]);
  const [freeProjects, setFreeProjects] = useState<FreeProjectView[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    const run = async () => {
      setLoading(true);
      setError(null);
      try {
        const [weeklyResult, monthlyResult, entriesResult, projectsResult] = await Promise.all([
          fetchWeeklySummary(0),
          fetchMonthlySummary(),
          fetchLaborEntries({ range: "month", limit: 500 }),
          fetchFreeProjects(),
        ]);
        if (cancelled) return;
        setWeekly(weeklyResult);
        setMonthly(monthlyResult);
        setEntries(entriesResult);
        setFreeProjects(projectsResult);
      } catch (caught) {
        if (!cancelled) setError(caught instanceof Error ? caught.message : "No se pudo cargar el resumen.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    void run();
    return () => {
      cancelled = true;
    };
  }, []);

  const todayKey = new Date().toISOString().slice(0, 10);
  const todayMinutes = monthly?.byDay.find((day) => day.date === todayKey)?.minutes ?? 0;

  const purposeSeconds = useMemo(() => {
    const totals: Record<TimeEntryView["purpose"], number> = { personal: 0, payable: 0, job_linked: 0 };
    for (const entry of entries) totals[entry.purpose] += entrySeconds(entry);
    return totals;
  }, [entries]);

  const estimatedCost = useMemo(
    () => entries.reduce((sum, entry) => sum + (entryCost(entry) ?? 0), 0),
    [entries]
  );

  const projectBars = useMemo(() => {
    const totals = new Map<string, { label: string; color: string; seconds: number }>();
    for (const entry of entries) {
      const project = resolveEntryProject(entry, freeProjects, jobs);
      const current = totals.get(project.label) ?? { ...project, seconds: 0 };
      current.seconds += entrySeconds(entry);
      totals.set(project.label, current);
    }
    return [...totals.values()]
      .sort((a, b) => b.seconds - a.seconds)
      .slice(0, 6)
      .map((item) => ({ label: item.label, value: item.seconds, color: item.color }));
  }, [entries, freeProjects, jobs]);

  const trendPoints = useMemo(() => (
    (monthly?.byDay ?? []).map((day) => ({
      label: new Date(`${day.date}T12:00:00`).toLocaleDateString("es-MX", { day: "numeric", month: "short" }),
      value: day.minutes * 60,
    }))
  ), [monthly]);

  const latestEntries = useMemo(
    () => [...entries]
      .sort((a, b) => b.startedAt.localeCompare(a.startedAt))
      .slice(0, 8),
    [entries]
  );

  if (loading) {
    return <div style={{ ...sectionCard, color: "var(--muted)", fontSize: "13px" }}>Cargando resumen...</div>;
  }

  if (error) {
    return (
      <div style={{ ...sectionCard, color: "#ef4444", fontSize: "13px", background: "rgba(239,68,68,.08)", border: "1px solid rgba(239,68,68,.18)" }}>
        {error}
      </div>
    );
  }

  const activeProjects = freeProjects.filter((project) => project.status === "active").length;

  return (
    <div style={{ display: "grid", gap: "16px" }}>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(170px, 1fr))", gap: "10px" }}>
        <KpiCard label="Horas hoy" value={fmtHours(todayMinutes * 60)} color="#3b82f6" hint={`${monthly?.totalEntries ?? 0} registros en el mes`} />
        <KpiCard
          label="Esta semana"
          value={fmtHours((weekly?.totalMinutes ?? 0) * 60)}
          color="#059669"
          badge={<ChangeBadge value={weekly?.changePercent ?? null} />}
        />
        <KpiCard label="Este mes" value={fmtHours((monthly?.totalMinutes ?? 0) * 60)} color="#d97706" hint={`${monthly?.from.slice(0, 10) ?? ""} → hoy`} />
        <KpiCard label="Proyectos libres" value={String(activeProjects)} color="#8b5cf6" hint="activos en tu espacio" />
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(170px, 1fr))", gap: "10px" }}>
        <KpiCard label="Facturable (mes)" value={fmtHours(purposeSeconds.payable + purposeSeconds.job_linked)} color={PURPOSE_CHART_COLORS.payable} hint="pago potencial + jobs" />
        <KpiCard label="Personal (mes)" value={fmtHours(purposeSeconds.personal)} color={PURPOSE_CHART_COLORS.personal} hint="cálculo propio" />
        <KpiCard label="Costo estimado" value={estimatedCost > 0 ? fmtMoney(estimatedCost) : "—"} color="var(--accent)" hint="según tarifas registradas" />
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))", gap: "16px" }}>
        <ChartCard title="Tendencia del mes" subtitle="Horas registradas por día">
          <TrendChart points={trendPoints} color="#3b82f6" valueFmt={fmtHours} />
        </ChartCard>
        <ChartCard title="Horas por propósito" subtitle="Distribución del mes">
          <DonutChart
            segments={(Object.keys(purposeSeconds) as TimeEntryView["purpose"][]).map((purpose) => ({
              label: PURPOSE_SHORT_LABELS[purpose],
              value: purposeSeconds[purpose],
              color: PURPOSE_CHART_COLORS[purpose],
            }))}
            valueFmt={fmtHours}
          />
        </ChartCard>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))", gap: "16px" }}>
        <ChartCard title="Horas por proyecto" subtitle="Top del mes (jobs y proyectos libres)">
          <BarList items={projectBars} valueFmt={fmtHours} emptyText="Registra tiempo para ver la distribución por proyecto." />
        </ChartCard>
        <ChartCard title="Últimos registros" subtitle="Actividad más reciente">
          {latestEntries.length === 0 ? (
            <p style={{ fontSize: "13px", color: "var(--muted)", margin: 0, lineHeight: 1.6 }}>Todavía no hay registros este mes.</p>
          ) : (
            <div style={{ display: "grid", gap: "8px" }}>
              {latestEntries.map((entry) => {
                const project = resolveEntryProject(entry, freeProjects, jobs);
                const cost = entryCost(entry);
                return (
                  <div key={entry.id} style={{ display: "flex", alignItems: "center", gap: "10px", fontSize: "12px", padding: "8px 10px", borderRadius: "10px", border: "1px solid var(--border)", background: "var(--bg)" }}>
                    <span style={{ color: "var(--muted)", flexShrink: 0, width: "52px" }}>{entryDateLabel(entry)}</span>
                    <span style={{ display: "inline-flex", alignItems: "center", gap: "6px", color: "var(--ink)", fontWeight: 700, flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      <span style={{ width: "8px", height: "8px", borderRadius: "999px", background: project.color, flexShrink: 0 }} />
                      {project.label}
                    </span>
                    <PurposeChip purpose={entry.purpose} />
                    <span style={{ color: "var(--ink)", fontWeight: 800, fontVariantNumeric: "tabular-nums", flexShrink: 0 }}>{fmtHours(entrySeconds(entry))}</span>
                    {cost != null ? <span style={{ color: "var(--muted)", fontVariantNumeric: "tabular-nums", flexShrink: 0 }}>{fmtMoney(cost, entry.currency)}</span> : null}
                  </div>
                );
              })}
            </div>
          )}
        </ChartCard>
      </div>
    </div>
  );
}
