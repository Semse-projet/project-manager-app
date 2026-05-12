"use client";

import type { AccuracyLevel } from "../../lib/smart-intake";

const LEVEL_META: Record<AccuracyLevel, { label: string; color: string; bg: string }> = {
  low: { label: "Informacion insuficiente", color: "#b91c1c", bg: "rgba(239,68,68,.12)" },
  medium: { label: "Presupuesto disponible con huecos", color: "#a16207", bg: "rgba(245,158,11,.12)" },
  good: { label: "Buen nivel de detalle", color: "#047857", bg: "rgba(16,185,129,.12)" },
  high: { label: "Proyecto bien definido", color: "#1d4ed8", bg: "rgba(37,99,235,.12)" },
};

export function AccuracyMeter({
  score,
  level,
  missingFields,
  estimateUnlocked,
}: {
  score: number;
  level: AccuracyLevel;
  missingFields: string[];
  estimateUnlocked: boolean;
}) {
  const meta = LEVEL_META[level];

  return (
    <div style={{ padding: 16, borderRadius: 16, background: "#fff", border: "1px solid rgba(37,99,235,.12)" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, marginBottom: 10 }}>
        <span style={{ fontSize: 12, fontWeight: 800, color: "#0f172a" }}>Accuracy score</span>
        <span style={{ padding: "4px 8px", borderRadius: 999, background: meta.bg, color: meta.color, fontSize: 10, fontWeight: 800 }}>
          {estimateUnlocked ? "Estimate unlocked" : "Estimate locked"}
        </span>
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
        <div style={{ flex: 1, height: 10, borderRadius: 999, background: "rgba(148,163,184,.18)", overflow: "hidden" }}>
          <div
            style={{
              width: `${Math.max(4, Math.min(score, 100))}%`,
              height: "100%",
              borderRadius: 999,
              background: `linear-gradient(90deg, ${meta.color}, #7c3aed)`,
              transition: "width .25s ease",
            }}
          />
        </div>
        <div style={{ minWidth: 48, textAlign: "right", fontSize: 18, fontWeight: 900, color: "#0f172a" }}>{score}%</div>
      </div>
      <div style={{ fontSize: 12, color: "#475569", lineHeight: 1.6 }}>{meta.label}</div>
      {missingFields.length > 0 ? (
        <div style={{ marginTop: 10, fontSize: 11, color: "#64748b", lineHeight: 1.6 }}>
          Faltan: {missingFields.join(", ")}
        </div>
      ) : null}
    </div>
  );
}

