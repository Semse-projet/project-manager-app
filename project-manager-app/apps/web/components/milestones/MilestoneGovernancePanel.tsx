"use client";

import { useEffect, useState, useCallback } from "react";
import { AlertTriangle, CheckCircle, Clock, ShieldAlert, XCircle } from "lucide-react";
import { CrowdDecisionBadge } from "@/components/semse/CrowdDecisionBadge";
import { useLanguage } from "../../lib/language-context";
import { messageFromError, messageTextOr, renderMessage, UiMessageError, type UiMessage } from "../../lib/ui-message";

// ── Types ─────────────────────────────────────────────────────────────────────

type ReleaseStatus = "ready" | "blocked" | "needs_review" | "released" | "disputed";
type RiskLevel = "low" | "medium" | "high" | "critical";

type GovernanceResult = {
  milestoneId:        string;
  projectId:          string | null;
  milestoneStatus:    string;
  evidenceReadiness:  string;
  paymentReadiness:   string;
  releaseStatus:      ReleaseStatus;
  canRelease:         boolean;
  blockers:           string[];
  requiredActions:    string[];
  riskLevel:          RiskLevel;
  evidenceSummary: {
    total:     number;
    required:  number;
    approved:  number;
    missing:   number;
    rejected:  number;
    submitted: number;
  };
  changeOrderBlockers: number;
  openSignals:        number;
  criticalSignals:    number;
  disputeRisk:        boolean;
  nextBestAction:     string;
  auditReason:        string;
  governedAt:         string;
};

// ── Colors ────────────────────────────────────────────────────────────────────

function releaseStatusColor(s: ReleaseStatus): string {
  if (s === "ready")       return "#86efac";
  if (s === "released")    return "#6366f1";
  if (s === "needs_review") return "#fbbf24";
  if (s === "disputed")    return "var(--error)";
  return "#f87171"; // blocked
}

function riskColor(r: RiskLevel): string {
  if (r === "critical") return "var(--error)";
  if (r === "high")     return "#fb7185";
  if (r === "medium")   return "#fbbf24";
  return "#86efac";
}

function ReleaseStatusBadge({ status }: { status: ReleaseStatus }) {
  const { t } = useLanguage();
  const color = releaseStatusColor(status);
  const Icon = status === "ready" ? CheckCircle
    : status === "released" ? CheckCircle
    : status === "disputed" ? XCircle
    : status === "needs_review" ? Clock
    : AlertTriangle;

  return (
    <div style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "5px 10px", borderRadius: 8, background: `${color}18`, border: `1px solid ${color}44` }}>
      <Icon size={13} color={color} />
      <span style={{ fontSize: 12, fontWeight: 800, color }}>{t(`governance.status.${status}`)}</span>
    </div>
  );
}

// ── Main component ─────────────────────────────────────────────────────────────

interface Props {
  milestoneId: string;
  onReleaseReady?: () => void;
}

export function MilestoneGovernancePanel({ milestoneId, onReleaseReady }: Props) {
  const { t, language } = useLanguage();
  const [data, setData] = useState<GovernanceResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<UiMessage | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/semse/milestones/${milestoneId}/payment-governance`);
      const json = await res.json() as { data?: GovernanceResult; error?: { message?: string } };
      if (!res.ok) throw new UiMessageError(messageTextOr(json?.error?.message, "governance.error.load"));
      setData(json.data ?? null);
      if (json.data?.canRelease) onReleaseReady?.();
    } catch (err) {
      setError(messageFromError(err, "governance.error.fallback"));
    } finally {
      setLoading(false);
    }
  }, [milestoneId, onReleaseReady]);

  useEffect(() => { void load(); }, [load]);

  if (loading) {
    return (
      <div style={{ padding: 18, borderRadius: 14, background: "var(--surface)", border: "1px solid var(--border)", fontSize: 13, color: "var(--muted)" }}>
        {t("governance.loading")}
      </div>
    );
  }

  if (error || !data) {
    return (
      <div style={{ padding: 18, borderRadius: 14, background: "rgba(239,68,68,.08)", border: "1px solid rgba(239,68,68,.2)", color: "#fca5a5", fontSize: 13 }}>
        {renderMessage(error, t) ?? t("governance.empty")}
      </div>
    );
  }

  return (
    <div style={{ background: "var(--surface)", border: `1px solid ${releaseStatusColor(data.releaseStatus)}33`, borderRadius: 16, padding: 18, display: "grid", gap: 14 }}>

      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <ShieldAlert size={18} color={releaseStatusColor(data.releaseStatus)} />
          <h3 style={{ margin: 0, fontSize: 15, fontWeight: 800, color: "var(--ink)" }}>{t("governance.title")}</h3>
        </div>
        <ReleaseStatusBadge status={data.releaseStatus} />
      </div>

      {/* Crowd Agent decision */}
      <CrowdDecisionBadge
        evidenceApproved={data.evidenceSummary.approved > 0 && data.evidenceSummary.missing === 0 && data.evidenceSummary.rejected === 0}
        changeOrdersPending={data.changeOrderBlockers}
        disputeOpen={data.releaseStatus === "disputed"}
        milestoneStatus={data.releaseStatus === "ready" ? "submitted" : data.releaseStatus === "released" ? "approved" : "draft"}
      />

      {/* Bloqueadores */}
      {data.blockers.length > 0 && (
        <div style={{ background: "rgba(239,68,68,.06)", border: "1px solid rgba(239,68,68,.2)", borderRadius: 12, padding: 14 }}>
          <div style={{ fontSize: 11, fontWeight: 800, color: "#fca5a5", marginBottom: 8, textTransform: "uppercase", letterSpacing: 1 }}>
            {t("governance.blockers")} ({data.blockers.length})
          </div>
          {data.blockers.map((b, i) => (
            <div key={i} style={{ display: "flex", gap: 8, alignItems: "flex-start", marginBottom: i < data.blockers.length - 1 ? 6 : 0 }}>
              <XCircle size={12} color="#f87171" style={{ marginTop: 2, flexShrink: 0 }} />
              <span style={{ fontSize: 12, color: "var(--muted)" }}>{b}</span>
            </div>
          ))}
        </div>
      )}

      {/* Next best action */}
      <div style={{ background: "rgba(99,102,241,.06)", border: "1px solid rgba(99,102,241,.2)", borderRadius: 12, padding: 12 }}>
        <div style={{ fontSize: 11, fontWeight: 800, color: "#a5b4fc", marginBottom: 4, textTransform: "uppercase", letterSpacing: 1 }}>
          {t("governance.nextAction")}
        </div>
        <div style={{ fontSize: 13, color: "var(--ink)" }}>{data.nextBestAction}</div>
      </div>

      {/* Evidence summary + counters */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(110px, 1fr))", gap: 10 }}>
        {[
          { label: t("governance.evidence.approved"), value: data.evidenceSummary.approved, color: "#86efac" },
          { label: t("governance.evidence.missing"), value: data.evidenceSummary.missing, color: data.evidenceSummary.missing > 0 ? "#fbbf24" : "var(--muted)" },
          { label: t("governance.evidence.rejected"), value: data.evidenceSummary.rejected, color: data.evidenceSummary.rejected > 0 ? "#f87171" : "var(--muted)" },
          { label: t("governance.changeOrders"), value: data.changeOrderBlockers, color: data.changeOrderBlockers > 0 ? "#fbbf24" : "var(--muted)" },
          { label: t("governance.criticalSignals"), value: data.criticalSignals, color: data.criticalSignals > 0 ? "var(--error)" : "var(--muted)" },
        ].map((item) => (
          <div key={item.label} style={{ padding: "10px 12px", borderRadius: 12, background: "rgba(255,255,255,.03)", border: "1px solid var(--border)", textAlign: "center" }}>
            <div style={{ fontSize: 20, fontWeight: 800, color: item.color }}>{item.value}</div>
            <div style={{ fontSize: 10, color: "var(--muted)", marginTop: 3 }}>{item.label}</div>
          </div>
        ))}
      </div>

      {/* Risk level */}
      <div style={{ display: "flex", alignItems: "center", gap: 10, fontSize: 12 }}>
        <span style={{ color: "var(--muted)" }}>{t("governance.risk")}:</span>
        <span style={{ fontWeight: 800, color: riskColor(data.riskLevel) }}>
          {t(`risk.${data.riskLevel}`).toUpperCase()}
        </span>
        {data.disputeRisk && (
          <span style={{ padding: "2px 8px", borderRadius: 6, background: "rgba(239,68,68,.12)", border: "1px solid rgba(239,68,68,.3)", fontSize: 10, fontWeight: 800, color: "#fca5a5" }}>
            ⚠ {t("governance.disputeRisk")}
          </span>
        )}
        <span style={{ marginLeft: "auto", fontSize: 11, color: "var(--muted)" }}>
          {new Date(data.governedAt).toLocaleTimeString(language === "en" ? "en-US" : "es-MX")}
        </span>
      </div>

      {/* Audit reason */}
      <div style={{ fontSize: 11, color: "var(--muted)", borderTop: "1px solid var(--border)", paddingTop: 10 }}>
        <strong>{t("governance.auditReason")}:</strong> {data.auditReason}
      </div>

      {/* Refresh */}
      <button
        type="button"
        onClick={() => void load()}
        style={{ alignSelf: "flex-end", fontSize: 11, color: "#818cf8", background: "none", border: "none", cursor: "pointer", textDecoration: "underline" }}
      >
        {t("governance.refresh")}
      </button>
    </div>
  );
}
