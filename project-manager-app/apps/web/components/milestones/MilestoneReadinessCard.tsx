"use client";

import { useEffect, useState } from "react";
import { AlertTriangle, CheckCircle, Clock, ShieldAlert } from "lucide-react";

type MilestoneReadiness = {
  milestoneId: string;
  status: string;
  evidenceReadiness: string;
  paymentReadiness: string;
  blockers: string[];
  reasons: string[];
  risk: "low" | "medium" | "high";
  nextAction: string;
  generatedAt: string;
};

const RISK_COLOR: Record<string, string> = {
  low: "#22c55e", medium: "#fbbf24", high: "#ef4444",
};

const PAYMENT_LABEL: Record<string, string> = {
  ready_to_release: "Listo para liberar",
  not_ready:        "No listo",
  disputed:         "En disputa",
  awaiting_approval:"Esperando aprobación",
  pending:          "Pendiente",
};

const EVIDENCE_LABEL: Record<string, string> = {
  complete:   "Completa",
  incomplete: "Incompleta",
  unknown:    "Desconocido",
};

export function MilestoneReadinessCard({ milestoneId }: { milestoneId: string }) {
  const [data, setData] = useState<MilestoneReadiness | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    fetch(`/api/semse/milestones/${milestoneId}/readiness`, { credentials: "include" })
      .then((r) => (r.ok ? r.json() : null))
      .then((d: { data?: MilestoneReadiness } | null) => { if (alive) setData(d?.data ?? null); })
      .catch(() => { if (alive) setData(null); })
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, [milestoneId]);

  if (loading || !data) return null;

  const isReady = data.paymentReadiness === "ready_to_release" && data.blockers.length === 0;
  const riskColor = RISK_COLOR[data.risk] ?? "#94a3b8";
  const Icon = isReady ? CheckCircle : data.risk === "high" ? ShieldAlert : data.risk === "medium" ? AlertTriangle : Clock;

  return (
    <div style={{
      background: isReady ? "rgba(34,197,94,.05)" : `${riskColor}08`,
      border: `1px solid ${isReady ? "rgba(34,197,94,.2)" : `${riskColor}25`}`,
      borderRadius: "10px",
      padding: "10px 14px",
      fontSize: "12px",
    }}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "8px" }}>
        <Icon size={13} color={isReady ? "#22c55e" : riskColor} />
        <span style={{ fontWeight: 700, color: "var(--ink, #f1f5f9)" }}>Readiness</span>
        <span style={{
          fontSize: "10px", fontWeight: 700, textTransform: "uppercase",
          color: riskColor,
          background: `${riskColor}15`,
          border: `1px solid ${riskColor}30`,
          borderRadius: "4px", padding: "1px 6px",
        }}>
          {data.risk.toUpperCase()}
        </span>
      </div>

      {/* Indicators row */}
      <div style={{ display: "flex", gap: "16px", flexWrap: "wrap", marginBottom: "6px" }}>
        <span style={{ fontSize: "11px", color: "var(--muted, #94a3b8)" }}>
          Evidencia:{" "}
          <b style={{ color: data.evidenceReadiness === "complete" ? "#22c55e" : "#fbbf24" }}>
            {EVIDENCE_LABEL[data.evidenceReadiness] ?? data.evidenceReadiness}
          </b>
        </span>
        <span style={{ fontSize: "11px", color: "var(--muted, #94a3b8)" }}>
          Pago:{" "}
          <b style={{ color: data.paymentReadiness === "ready_to_release" ? "#22c55e" : "#fbbf24" }}>
            {PAYMENT_LABEL[data.paymentReadiness] ?? data.paymentReadiness}
          </b>
        </span>
      </div>

      {/* Next action */}
      {data.nextAction && (
        <div style={{ fontSize: "11px", color: "#818cf8", marginBottom: data.blockers.length > 0 ? "6px" : 0 }}>
          → {data.nextAction}
        </div>
      )}

      {/* Blockers */}
      {data.blockers.length > 0 && (
        <div style={{ borderTop: "1px solid rgba(239,68,68,.15)", paddingTop: "6px", marginTop: "4px" }}>
          {data.blockers.map((b) => (
            <div key={b} style={{ fontSize: "11px", color: "#f87171" }}>🚫 {b}</div>
          ))}
        </div>
      )}

      {/* Reasons (positive) */}
      {isReady && data.reasons.length > 0 && (
        <div style={{ borderTop: "1px solid rgba(34,197,94,.15)", paddingTop: "6px", marginTop: "4px" }}>
          {data.reasons.map((r) => (
            <div key={r} style={{ fontSize: "11px", color: "#86efac" }}>✓ {r}</div>
          ))}
        </div>
      )}
    </div>
  );
}
