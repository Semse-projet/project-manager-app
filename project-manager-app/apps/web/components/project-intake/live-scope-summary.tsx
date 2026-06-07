"use client";

import type { LiveSummary } from "../../lib/smart-intake";

export function LiveScopeSummary({ summary }: { summary: LiveSummary | null }) {
  const rows = summary ? [
    { label: "Category", value: summary.category },
    { label: "Area", value: summary.area },
    { label: "Condition", value: summary.condition },
    { label: "Coats", value: summary.coats },
    { label: "Materials", value: summary.materials },
    { label: "Duration", value: summary.duration },
    { label: "Images", value: String(summary.imageCount) },
  ].filter((row) => row.value) : [];

  return (
    <div style={{ padding: 16, borderRadius: 16, background: "#fff", border: "1px solid rgba(37,99,235,.12)" }}>
      <div style={{ fontSize: 12, fontWeight: 800, color: "#0f172a", marginBottom: 8 }}>Live summary</div>
      {rows.length === 0 ? (
        <div style={{ fontSize: 13, color: "#64748b", lineHeight: 1.6 }}>
          Aun no hay suficiente informacion estructurada para resumir el alcance.
        </div>
      ) : (
        <div style={{ display: "grid", gap: 8 }}>
          {rows.map((row) => (
            <div key={row.label} style={{ display: "flex", justifyContent: "space-between", gap: 10, fontSize: 12 }}>
              <span style={{ color: "#64748b" }}>{row.label}</span>
              <span style={{ color: "#0f172a", fontWeight: 700, textAlign: "right" }}>{row.value}</span>
            </div>
          ))}
          {summary?.pendingFields?.length ? (
            <div style={{ fontSize: 11, color: "#64748b", lineHeight: 1.6, marginTop: 4 }}>
              Pending: {summary.pendingFields.join(", ")}
            </div>
          ) : null}
        </div>
      )}
    </div>
  );
}

