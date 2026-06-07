"use client";

import type { ProjectMilestone } from "../../lib/smart-intake";

export function MilestonePreview({ milestones }: { milestones: ProjectMilestone[] }) {
  if (milestones.length === 0) {
    return null;
  }

  return (
    <div style={{ padding: 16, borderRadius: 16, background: "#fff", border: "1px solid rgba(37,99,235,.12)" }}>
      <div style={{ fontSize: 12, fontWeight: 800, color: "#0f172a", marginBottom: 10 }}>Milestone preview</div>
      <div style={{ display: "grid", gap: 10 }}>
        {milestones.map((milestone) => (
          <div key={milestone.id} style={{ padding: 12, borderRadius: 12, background: "rgba(148,163,184,.06)", border: "1px solid rgba(148,163,184,.12)" }}>
            <div style={{ display: "flex", justifyContent: "space-between", gap: 10, alignItems: "center" }}>
              <div style={{ fontSize: 13, fontWeight: 800, color: "#0f172a" }}>{milestone.title.es}</div>
              <div style={{ fontSize: 11, color: "#475569", fontWeight: 700 }}>{milestone.paymentPercentage ?? 0}%</div>
            </div>
            {milestone.description ? (
              <div style={{ fontSize: 12, color: "#64748b", lineHeight: 1.6, marginTop: 4 }}>
                {milestone.description.es}
              </div>
            ) : null}
          </div>
        ))}
      </div>
    </div>
  );
}

