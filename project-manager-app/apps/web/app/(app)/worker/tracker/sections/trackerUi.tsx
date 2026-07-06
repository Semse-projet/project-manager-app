"use client";

import type { CSSProperties, ReactNode } from "react";
import type { FreeProjectView, TimeEntryView } from "../../../labor-api";
import type { JobRecordView } from "../../../../semse-api";

// Paleta categórica por propósito, validada (contraste/CVD) sobre superficie clara y oscura.
export const PURPOSE_CHART_COLORS: Record<TimeEntryView["purpose"], string> = {
  job_linked: "#3b82f6",
  payable: "#d97706",
  personal: "#8b5cf6",
};

export const PURPOSE_SHORT_LABELS: Record<TimeEntryView["purpose"], string> = {
  job_linked: "Job formal",
  payable: "Facturable",
  personal: "Personal",
};

export const FREE_PROJECT_SWATCHES = ["#3b82f6", "#d97706", "#059669", "#dc2626", "#8b5cf6", "#0891b2"];

export const sectionCard: CSSProperties = {
  background: "var(--surface)",
  border: "1px solid var(--border)",
  borderRadius: "14px",
  padding: "20px",
};

export function fieldInput(): CSSProperties {
  return {
    width: "100%",
    padding: "8px 10px",
    borderRadius: "7px",
    border: "1px solid var(--border)",
    background: "var(--bg)",
    color: "var(--ink)",
    fontSize: "13px",
    outline: "none",
    boxSizing: "border-box",
  };
}

export function fieldLabel(): CSSProperties {
  return { fontSize: "11px", fontWeight: 700, color: "var(--muted)", marginBottom: "4px", display: "block" };
}

export function entrySeconds(entry: TimeEntryView): number {
  if (typeof entry.durationMinutes === "number") return entry.durationMinutes * 60;
  return entry.accumulatedSeconds;
}

export function entryCost(entry: TimeEntryView): number | null {
  if (typeof entry.hourlyRate !== "number" || entry.hourlyRate <= 0) return null;
  return Math.round((entrySeconds(entry) / 3600) * entry.hourlyRate * 100) / 100;
}

export function fmtHours(seconds: number): string {
  return `${(Math.round((seconds / 3600) * 100) / 100).toLocaleString("es-MX")}h`;
}

export function fmtMoney(value: number, currency = "USD"): string {
  return value.toLocaleString("en-US", { style: "currency", currency, maximumFractionDigits: 0 });
}

export function entryDateLabel(entry: TimeEntryView): string {
  const date = new Date(entry.startedAt);
  if (Number.isNaN(date.getTime())) return entry.startedAt;
  return date.toLocaleDateString("es-MX", { day: "2-digit", month: "short" });
}

export function entryTimeRange(entry: TimeEntryView): string {
  const start = new Date(entry.startedAt);
  const end = entry.endedAt ? new Date(entry.endedAt) : null;
  const fmt = (d: Date) => d.toLocaleTimeString("es-MX", { hour: "2-digit", minute: "2-digit" });
  if (Number.isNaN(start.getTime())) return "—";
  return `${fmt(start)} – ${end && !Number.isNaN(end.getTime()) ? fmt(end) : "…"}`;
}

export type ProjectRef = { label: string; color: string };

export function resolveEntryProject(
  entry: TimeEntryView,
  freeProjects: FreeProjectView[],
  jobs: JobRecordView[]
): ProjectRef {
  if (entry.freeProjectId) {
    const project = freeProjects.find((item) => item.id === entry.freeProjectId);
    if (project) return { label: project.name, color: project.color || PURPOSE_CHART_COLORS.personal };
  }
  if (entry.jobId) {
    const job = jobs.find((item) => item.id === entry.jobId);
    return { label: job?.title ?? "Job vinculado", color: PURPOSE_CHART_COLORS.job_linked };
  }
  return { label: PURPOSE_SHORT_LABELS[entry.purpose], color: PURPOSE_CHART_COLORS[entry.purpose] };
}

export function exportEntriesCsv(
  entries: TimeEntryView[],
  resolveProject: (entry: TimeEntryView) => ProjectRef,
  filename: string
) {
  const cell = (value: unknown) => `"${String(value ?? "").replaceAll('"', '""')}"`;
  const rows = [
    ["id", "fecha", "inicio", "fin", "modo", "proposito", "proyecto", "descanso_min", "duracion_seg", "duracion_h", "tarifa", "moneda", "costo", "ubicacion", "notas"],
    ...entries.map((entry) => {
      const seconds = entrySeconds(entry);
      const cost = entryCost(entry);
      return [
        entry.id,
        entry.startedAt.slice(0, 10),
        entry.startedAt,
        entry.endedAt ?? "",
        entry.mode,
        entry.purpose,
        resolveProject(entry).label,
        String(entry.breakMinutes ?? 0),
        String(seconds),
        String(Math.round((seconds / 3600) * 100) / 100),
        entry.hourlyRate != null ? String(entry.hourlyRate) : "",
        entry.currency,
        cost != null ? String(cost) : "",
        entry.location ?? "",
        entry.notes ?? "",
      ];
    }),
  ];
  const csv = "﻿" + rows.map((row) => row.map(cell).join(",")).join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}

// ── Componentes visuales ─────────────────────────────────────────────────────

export function KpiCard({ label, value, hint, color, badge }: {
  label: string;
  value: string;
  hint?: string;
  color: string;
  badge?: ReactNode;
}) {
  return (
    <div style={{ ...sectionCard, padding: "14px 16px", borderLeft: `4px solid ${color}` }}>
      <p style={{ fontSize: "11px", fontWeight: 700, color: "var(--muted)", textTransform: "uppercase", letterSpacing: "0.04em" }}>{label}</p>
      <p style={{ fontSize: "22px", fontWeight: 800, color: "var(--ink)", margin: "4px 0 0", fontVariantNumeric: "tabular-nums" }}>{value}</p>
      <div style={{ display: "flex", alignItems: "center", gap: "6px", marginTop: "4px", minHeight: "16px" }}>
        {badge}
        {hint ? <span style={{ fontSize: "11px", color: "var(--muted)" }}>{hint}</span> : null}
      </div>
    </div>
  );
}

export function ChangeBadge({ value }: { value: number | null }) {
  if (value === null || !Number.isFinite(value)) return null;
  const positive = value >= 0;
  const color = positive ? "#059669" : "#dc2626";
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: "3px",
        padding: "2px 7px",
        borderRadius: "999px",
        background: positive ? "rgba(16,185,129,.12)" : "rgba(239,68,68,.12)",
        color,
        fontSize: "11px",
        fontWeight: 800,
      }}
    >
      {positive ? "▲" : "▼"} {positive ? "+" : ""}{Math.round(value)}% vs anterior
    </span>
  );
}

export function ChartCard({ title, subtitle, children }: { title: string; subtitle?: string; children: ReactNode }) {
  return (
    <div style={sectionCard}>
      <div style={{ marginBottom: "14px" }}>
        <h3 style={{ fontSize: "14px", fontWeight: 800, color: "var(--ink)", margin: 0 }}>{title}</h3>
        {subtitle ? <p style={{ fontSize: "11px", color: "var(--muted)", margin: "3px 0 0" }}>{subtitle}</p> : null}
      </div>
      {children}
    </div>
  );
}

export function BarList({ items, valueFmt, emptyText }: {
  items: { label: string; value: number; color: string; hint?: string }[];
  valueFmt: (value: number) => string;
  emptyText: string;
}) {
  const max = Math.max(...items.map((item) => item.value), 1);
  if (items.length === 0) {
    return <p style={{ fontSize: "13px", color: "var(--muted)", margin: 0, lineHeight: 1.6 }}>{emptyText}</p>;
  }
  return (
    <div style={{ display: "grid", gap: "10px" }}>
      {items.map((item) => (
        <div key={item.label} style={{ display: "grid", gap: "5px" }}>
          <div style={{ display: "flex", justifyContent: "space-between", gap: "10px", fontSize: "12px" }}>
            <span style={{ display: "inline-flex", alignItems: "center", gap: "6px", color: "var(--ink)", fontWeight: 700, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              <span style={{ width: "8px", height: "8px", borderRadius: "999px", background: item.color, flexShrink: 0 }} />
              {item.label}
            </span>
            <span style={{ color: "var(--muted)", fontVariantNumeric: "tabular-nums", flexShrink: 0 }}>
              {valueFmt(item.value)}{item.hint ? ` · ${item.hint}` : ""}
            </span>
          </div>
          <div style={{ height: "7px", borderRadius: "999px", background: "rgba(148,163,184,.18)", overflow: "hidden" }}>
            <div style={{ width: `${Math.round((item.value / max) * 100)}%`, height: "100%", background: item.color, borderRadius: "999px" }} />
          </div>
        </div>
      ))}
    </div>
  );
}

export function DonutChart({ segments, valueFmt }: {
  segments: { label: string; value: number; color: string }[];
  valueFmt: (value: number) => string;
}) {
  const total = segments.reduce((sum, segment) => sum + segment.value, 0);
  if (total <= 0) {
    return <p style={{ fontSize: "13px", color: "var(--muted)", margin: 0, lineHeight: 1.6 }}>Sin datos en este período.</p>;
  }

  const radius = 52;
  const circumference = 2 * Math.PI * radius;
  const gap = 2;
  let offset = 0;

  return (
    <div style={{ display: "flex", alignItems: "center", gap: "20px", flexWrap: "wrap" }}>
      <svg width="132" height="132" viewBox="0 0 132 132" role="img" aria-label="Distribución de horas">
        {segments.filter((segment) => segment.value > 0).map((segment) => {
          const fraction = segment.value / total;
          const length = Math.max(0, fraction * circumference - gap);
          const dashOffset = -offset;
          offset += fraction * circumference;
          return (
            <circle
              key={segment.label}
              cx="66"
              cy="66"
              r={radius}
              fill="none"
              stroke={segment.color}
              strokeWidth="14"
              strokeDasharray={`${length} ${circumference - length}`}
              strokeDashoffset={dashOffset}
              strokeLinecap="butt"
              transform="rotate(-90 66 66)"
            >
              <title>{`${segment.label}: ${valueFmt(segment.value)} (${Math.round(fraction * 100)}%)`}</title>
            </circle>
          );
        })}
        <text x="66" y="62" textAnchor="middle" style={{ fill: "var(--ink)", fontSize: "16px", fontWeight: 800 }}>
          {valueFmt(total)}
        </text>
        <text x="66" y="78" textAnchor="middle" style={{ fill: "var(--muted)", fontSize: "10px", fontWeight: 600 }}>
          total
        </text>
      </svg>
      <div style={{ display: "grid", gap: "7px", minWidth: "160px" }}>
        {segments.map((segment) => (
          <div key={segment.label} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "12px", fontSize: "12px" }}>
            <span style={{ display: "inline-flex", alignItems: "center", gap: "6px", color: "var(--ink)", fontWeight: 700 }}>
              <span style={{ width: "9px", height: "9px", borderRadius: "3px", background: segment.color }} />
              {segment.label}
            </span>
            <span style={{ color: "var(--muted)", fontVariantNumeric: "tabular-nums" }}>
              {valueFmt(segment.value)} · {Math.round((segment.value / total) * 100)}%
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

export function TrendChart({ points, color, valueFmt, height = 150 }: {
  points: { label: string; value: number }[];
  color: string;
  valueFmt: (value: number) => string;
  height?: number;
}) {
  if (points.length === 0) {
    return <p style={{ fontSize: "13px", color: "var(--muted)", margin: 0, lineHeight: 1.6 }}>Sin datos en este período.</p>;
  }

  const width = 560;
  const padX = 6;
  const padTop = 14;
  const padBottom = 20;
  const max = Math.max(...points.map((point) => point.value), 1);
  const innerWidth = width - padX * 2;
  const innerHeight = height - padTop - padBottom;
  const stepX = points.length > 1 ? innerWidth / (points.length - 1) : 0;
  const coord = (index: number, value: number) => ({
    x: padX + index * stepX,
    y: padTop + innerHeight - (value / max) * innerHeight,
  });
  const linePath = points.map((point, index) => {
    const { x, y } = coord(index, point.value);
    return `${index === 0 ? "M" : "L"}${x.toFixed(1)},${y.toFixed(1)}`;
  }).join(" ");
  const areaPath = `${linePath} L${(padX + (points.length - 1) * stepX).toFixed(1)},${padTop + innerHeight} L${padX},${padTop + innerHeight} Z`;
  const maxIndex = points.reduce((best, point, index) => (point.value > points[best].value ? index : best), 0);
  const maxCoord = coord(maxIndex, points[maxIndex].value);
  const labelEvery = Math.max(1, Math.ceil(points.length / 7));

  return (
    <svg width="100%" viewBox={`0 0 ${width} ${height}`} role="img" aria-label="Tendencia" style={{ display: "block" }}>
      <line x1={padX} y1={padTop + innerHeight} x2={width - padX} y2={padTop + innerHeight} stroke="rgba(148,163,184,.28)" strokeWidth="1" />
      <path d={areaPath} fill={color} opacity="0.14" />
      <path d={linePath} fill="none" stroke={color} strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
      <circle cx={maxCoord.x} cy={maxCoord.y} r="3.5" fill={color} />
      <text x={Math.min(Math.max(maxCoord.x, 24), width - 30)} y={Math.max(maxCoord.y - 7, 10)} textAnchor="middle" style={{ fill: "var(--ink)", fontSize: "10px", fontWeight: 700 }}>
        {valueFmt(points[maxIndex].value)}
      </text>
      {points.map((point, index) => {
        const { x } = coord(index, point.value);
        return (
          <g key={`${point.label}-${index}`}>
            <rect x={x - stepX / 2} y={padTop} width={Math.max(stepX, 8)} height={innerHeight} fill="transparent">
              <title>{`${point.label}: ${valueFmt(point.value)}`}</title>
            </rect>
            {index % labelEvery === 0 ? (
              <text x={x} y={height - 6} textAnchor="middle" style={{ fill: "var(--muted)", fontSize: "9px" }}>
                {point.label}
              </text>
            ) : null}
          </g>
        );
      })}
    </svg>
  );
}

export function ColumnChart({ points, color, valueFmt, height = 150 }: {
  points: { label: string; value: number }[];
  color: string;
  valueFmt: (value: number) => string;
  height?: number;
}) {
  if (points.length === 0) {
    return <p style={{ fontSize: "13px", color: "var(--muted)", margin: 0, lineHeight: 1.6 }}>Sin datos en este período.</p>;
  }

  const width = 560;
  const padTop = 16;
  const padBottom = 20;
  const max = Math.max(...points.map((point) => point.value), 1);
  const innerHeight = height - padTop - padBottom;
  const slot = width / points.length;
  const barWidth = Math.min(38, slot - 10);
  const maxIndex = points.reduce((best, point, index) => (point.value > points[best].value ? index : best), 0);

  return (
    <svg width="100%" viewBox={`0 0 ${width} ${height}`} role="img" aria-label="Horas por día" style={{ display: "block" }}>
      <line x1="0" y1={padTop + innerHeight} x2={width} y2={padTop + innerHeight} stroke="rgba(148,163,184,.28)" strokeWidth="1" />
      {points.map((point, index) => {
        const barHeight = Math.max(point.value > 0 ? 3 : 0, (point.value / max) * innerHeight);
        const x = index * slot + (slot - barWidth) / 2;
        const y = padTop + innerHeight - barHeight;
        return (
          <g key={`${point.label}-${index}`}>
            <rect x={x} y={y} width={barWidth} height={barHeight} rx="4" fill={color}>
              <title>{`${point.label}: ${valueFmt(point.value)}`}</title>
            </rect>
            {index === maxIndex && point.value > 0 ? (
              <text x={x + barWidth / 2} y={y - 5} textAnchor="middle" style={{ fill: "var(--ink)", fontSize: "10px", fontWeight: 700 }}>
                {valueFmt(point.value)}
              </text>
            ) : null}
            <text x={x + barWidth / 2} y={height - 6} textAnchor="middle" style={{ fill: "var(--muted)", fontSize: "9px" }}>
              {point.label}
            </text>
          </g>
        );
      })}
    </svg>
  );
}

export function PurposeChip({ purpose }: { purpose: TimeEntryView["purpose"] }) {
  const color = PURPOSE_CHART_COLORS[purpose];
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: "5px",
        padding: "3px 8px",
        borderRadius: "999px",
        border: `1px solid ${color}44`,
        color,
        fontSize: "10px",
        fontWeight: 800,
        whiteSpace: "nowrap",
      }}
    >
      <span style={{ width: "6px", height: "6px", borderRadius: "999px", background: color }} />
      {PURPOSE_SHORT_LABELS[purpose]}
    </span>
  );
}
