"use client";

import { useEffect, useState } from "react";

type VisionSummary = {
  milestoneId: string;
  totalAnalyzed: number;
  avgQualityScore: number | null;
  avgBlurScore: number | null;
  avgBrightnessScore: number | null;
  riskLevelCounts: Record<string, number>;
  requiresHumanReviewCount: number;
  canAutoApproveCount: number;
  overallVisionReady: boolean;
  blockers: string[];
  generatedAt: string;
};

function ScorePill({ label, value, good }: { label: string; value: number | null; good: boolean }) {
  if (value === null) return null;
  const pct = Math.round(value * 100);
  const color = good ? (pct >= 70 ? "#22c55e" : pct >= 45 ? "#eab308" : "#ef4444")
                     : (pct <= 30 ? "#22c55e" : pct <= 60 ? "#eab308" : "#ef4444");
  return (
    <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
      <span style={{ fontSize: "10px", color: "var(--muted, #94a3b8)" }}>{label}</span>
      <span style={{ fontSize: "11px", fontWeight: 700, color }}>{pct}%</span>
    </div>
  );
}

export function MilestoneVisionSummaryCard({ milestoneId }: { milestoneId: string }) {
  const [summary, setSummary] = useState<VisionSummary | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    fetch(`/api/semse/milestones/${milestoneId}/vision-summary`, { credentials: "include" })
      .then((r) => (r.ok ? r.json() : null))
      .then((d: { data?: VisionSummary } | null) => { if (alive) setSummary(d?.data ?? null); })
      .catch(() => { if (alive) setSummary(null); })
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, [milestoneId]);

  if (loading) return null;
  if (!summary || summary.totalAnalyzed === 0) return null;

  const riskColors: Record<string, string> = {
    critical: "#ef4444", high: "#f97316", medium: "#eab308", low: "#22c55e",
  };

  return (
    <div style={{
      background: summary.overallVisionReady
        ? "rgba(34,197,94,.05)"
        : "rgba(239,68,68,.05)",
      border: `1px solid ${summary.overallVisionReady ? "rgba(34,197,94,.2)" : "rgba(239,68,68,.2)"}`,
      borderRadius: "10px",
      padding: "10px 14px",
      fontSize: "12px",
    }}>
      <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "8px" }}>
        <span style={{ fontSize: "14px" }}>🔍</span>
        <span style={{ fontWeight: 700, color: "var(--ink, #f1f5f9)" }}>Vision AI</span>
        <span style={{
          fontSize: "10px", fontWeight: 700, textTransform: "uppercase",
          color: summary.overallVisionReady ? "#22c55e" : "#ef4444",
          background: summary.overallVisionReady ? "rgba(34,197,94,.12)" : "rgba(239,68,68,.12)",
          border: `1px solid ${summary.overallVisionReady ? "rgba(34,197,94,.3)" : "rgba(239,68,68,.3)"}`,
          borderRadius: "4px", padding: "1px 6px",
        }}>
          {summary.overallVisionReady ? "Ready" : "Blockers"}
        </span>
        <span style={{ fontSize: "10px", color: "var(--faint, #4b6280)", marginLeft: "auto" }}>
          {summary.totalAnalyzed} imagen{summary.totalAnalyzed !== 1 ? "es" : ""} analizadas
        </span>
      </div>

      <div style={{ display: "flex", flexWrap: "wrap", gap: "12px", marginBottom: "8px" }}>
        <ScorePill label="Calidad" value={summary.avgQualityScore} good />
        <ScorePill label="Blur" value={summary.avgBlurScore} good={false} />
        <ScorePill label="Brillo" value={summary.avgBrightnessScore} good />
        {summary.requiresHumanReviewCount > 0 && (
          <span style={{ fontSize: "10px", color: "#f97316" }}>
            ⚠️ {summary.requiresHumanReviewCount} requiere revisión manual
          </span>
        )}
        {summary.canAutoApproveCount > 0 && (
          <span style={{ fontSize: "10px", color: "#22c55e" }}>
            ✓ {summary.canAutoApproveCount} auto-aprobable{summary.canAutoApproveCount !== 1 ? "s" : ""}
          </span>
        )}
      </div>

      {Object.entries(summary.riskLevelCounts).length > 0 && (
        <div style={{ display: "flex", gap: "6px", flexWrap: "wrap", marginBottom: "6px" }}>
          {Object.entries(summary.riskLevelCounts).map(([level, count]) => (
            <span key={level} style={{
              fontSize: "10px", fontWeight: 600,
              color: riskColors[level] ?? "#94a3b8",
              background: `${riskColors[level] ?? "#94a3b8"}15`,
              border: `1px solid ${riskColors[level] ?? "#94a3b8"}30`,
              borderRadius: "4px", padding: "1px 7px",
            }}>
              {level}: {count}
            </span>
          ))}
        </div>
      )}

      {summary.blockers.length > 0 && (
        <div style={{ borderTop: "1px solid rgba(239,68,68,.15)", paddingTop: "6px", marginTop: "4px" }}>
          {summary.blockers.map((b) => (
            <div key={b} style={{ fontSize: "11px", color: "#f87171" }}>🚫 {b}</div>
          ))}
        </div>
      )}
    </div>
  );
}
