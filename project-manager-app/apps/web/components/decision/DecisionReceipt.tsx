"use client";

export interface DecisionReceiptProps {
  id: string;
  decidedAt: string;
  actorId: string;
  actorRole: string;
  action: string;
  entityType: string;
  entityId: string;
  evidenceReviewed: string[];
  aiRecommendationShown: boolean;
  confidenceAtDecisionTime: number | null;
  riskAtDecisionTime: "low" | "medium" | "high" | "critical";
  moneyImpact: number | null;
  affectedEntities: string[];
  rollbackOrEscalationPath: string;
}

export function DecisionReceipt(props: DecisionReceiptProps) {
  return (
    <article style={{ display: "grid", gap: "8px", padding: "12px", borderRadius: "12px", border: "1px solid rgba(148,163,184,0.18)" }}>
      <header style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "10px" }}>
        <strong style={{ fontSize: "12px", color: "var(--ink)" }}>{props.action}</strong>
        <span style={{ fontSize: "10px", color: "var(--muted)" }}>{props.decidedAt}</span>
      </header>
      <div style={{ fontSize: "11px", color: "var(--muted)" }}>
        {props.actorRole}:{props.actorId} on {props.entityType}:{props.entityId}
      </div>
      <div style={{ fontSize: "11px", color: "var(--muted)" }}>
        Evidence: {props.evidenceReviewed.length} | AI shown: {props.aiRecommendationShown ? "yes" : "no"} | Risk: {props.riskAtDecisionTime}
      </div>
      <div style={{ fontSize: "11px", color: "var(--muted)" }}>
        Rollback: {props.rollbackOrEscalationPath}
      </div>
    </article>
  );
}
