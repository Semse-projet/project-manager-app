"use client";

import type { ProjectEstimate } from "../../lib/smart-intake";

function money(value: number): string {
  return value.toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });
}

export function PreliminaryEstimateCard({ estimate }: { estimate: ProjectEstimate | null }) {
  if (!estimate) {
    return (
      <div style={{ padding: 16, borderRadius: 16, background: "rgba(255,255,255,.72)", border: "1px dashed rgba(37,99,235,.16)", fontSize: 13, color: "#64748b", lineHeight: 1.6 }}>
        Cuando desbloquees el estimate, aqui aparecera el rango preliminar con supuestos y exclusiones.
      </div>
    );
  }

  const breakdown = [
    estimate.breakdown.labor ? { label: "Labor", value: `${money(estimate.breakdown.labor.min)} - ${money(estimate.breakdown.labor.max)}` } : null,
    estimate.breakdown.materials ? { label: "Materials", value: `${money(estimate.breakdown.materials.min)} - ${money(estimate.breakdown.materials.max)}` } : null,
    estimate.breakdown.preparation ? { label: "Preparation", value: `${money(estimate.breakdown.preparation.min)} - ${money(estimate.breakdown.preparation.max)}` } : null,
    estimate.breakdown.contingency ? { label: "Contingency", value: `${money(estimate.breakdown.contingency.min)} - ${money(estimate.breakdown.contingency.max)}` } : null,
  ].filter(Boolean) as Array<{ label: string; value: string }>;

  return (
    <div style={{ padding: 16, borderRadius: 16, background: "#fff", border: "1px solid rgba(37,99,235,.12)", display: "grid", gap: 12 }}>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 10, alignItems: "center" }}>
        <div>
          <div style={{ fontSize: 12, fontWeight: 800, color: "#4f46e5", marginBottom: 4 }}>Preliminary estimate</div>
          <div style={{ fontSize: 24, fontWeight: 900, color: "#0f172a" }}>
            {money(estimate.totalRange.min)} - {money(estimate.totalRange.max)}
          </div>
        </div>
        <div style={{ padding: "4px 8px", borderRadius: 999, background: "rgba(37,99,235,.08)", color: "#2563eb", fontSize: 10, fontWeight: 800 }}>
          {estimate.confidence} confidence
        </div>
      </div>

      <div style={{ display: "grid", gap: 6 }}>
        {breakdown.map((item) => (
          <div key={item.label} style={{ display: "flex", justifyContent: "space-between", gap: 10, fontSize: 12 }}>
            <span style={{ color: "#64748b" }}>{item.label}</span>
            <span style={{ color: "#0f172a", fontWeight: 700 }}>{item.value}</span>
          </div>
        ))}
      </div>

      <div style={{ fontSize: 12, color: "#475569", lineHeight: 1.6 }}>
        {estimate.confidenceReasons.join(" ")}
      </div>

      {estimate.assumptions.length > 0 ? (
        <div style={{ fontSize: 11, color: "#64748b", lineHeight: 1.6 }}>
          Assumptions: {estimate.assumptions.join(" ")}
        </div>
      ) : null}
    </div>
  );
}

