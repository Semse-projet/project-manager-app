"use client";

import { useEffect, useState } from "react";
import { TrendingUp, Clock, Layers, AlertTriangle, CheckCircle } from "lucide-react";

type ImpactResult = {
  changeOrderId:      string;
  status:             string;
  costDeltaMin:       number;
  costDeltaMax:       number;
  costDeltaAvg:       number;
  affectedMilestones: string[];
  riskLevel:          "low" | "medium" | "high" | "critical";
  paymentImpact:      "none" | "requires_approval" | "hold_required" | "already_applied";
  probability:        number | null;
  pricingMode:        string;
  auditReason:        string;
  computedAt:         string;
};

function riskColor(r: ImpactResult["riskLevel"]): string {
  if (r === "critical") return "#ef4444";
  if (r === "high")     return "#fb7185";
  if (r === "medium")   return "#fbbf24";
  return "#86efac";
}

function paymentImpactLabel(p: ImpactResult["paymentImpact"]): { label: string; color: string } {
  if (p === "already_applied")  return { label: "Ya aplicado",         color: "#6366f1" };
  if (p === "requires_approval") return { label: "Requiere aprobación", color: "#fbbf24" };
  if (p === "hold_required")    return { label: "Pago en espera",      color: "#ef4444" };
  return { label: "Sin impacto de pago", color: "#86efac" };
}

interface Props {
  changeOrderId: string;
  canApply?: boolean;
  onApplied?: () => void;
}

export function ChangeOrderImpactCard({ changeOrderId, canApply, onApplied }: Props) {
  const [impact, setImpact] = useState<ImpactResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [applying, setApplying] = useState(false);
  const [applyResult, setApplyResult] = useState<{ alreadyApplied?: boolean } | null>(null);

  useEffect(() => {
    setLoading(true);
    fetch(`/api/semse/change-orders/${changeOrderId}/impact`)
      .then((r) => r.json())
      .then((j: { data?: ImpactResult }) => setImpact(j.data ?? null))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [changeOrderId]);

  async function handleApply() {
    setApplying(true);
    try {
      const res = await fetch(`/api/semse/change-orders/${changeOrderId}/apply-to-buildops`, { method: "POST" });
      const json = await res.json() as { data?: { alreadyApplied?: boolean; applied?: boolean } };
      setApplyResult(json.data ?? null);
      onApplied?.();
      // Refresh impact
      const r2 = await fetch(`/api/semse/change-orders/${changeOrderId}/impact`);
      const j2 = await r2.json() as { data?: ImpactResult };
      if (j2.data) setImpact(j2.data);
    } catch { /* silent */ }
    finally { setApplying(false); }
  }

  if (loading) {
    return <div style={{ fontSize: 12, color: "var(--muted)", padding: 12 }}>Calculando impacto...</div>;
  }

  if (!impact) {
    return <div style={{ fontSize: 12, color: "var(--muted)", padding: 12 }}>Sin datos de impacto</div>;
  }

  const pImpact = paymentImpactLabel(impact.paymentImpact);
  const money = (n: number) => n > 0 ? `$${Math.round(n).toLocaleString()}` : "—";

  return (
    <div style={{ background: "rgba(255,255,255,.03)", border: `1px solid ${riskColor(impact.riskLevel)}33`, borderRadius: 14, padding: 14, display: "grid", gap: 12 }}>

      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <TrendingUp size={14} color={riskColor(impact.riskLevel)} />
        <span style={{ fontSize: 12, fontWeight: 800, color: "var(--ink)" }}>Impacto estimado</span>
        <span style={{ marginLeft: "auto", fontSize: 11, fontWeight: 800, color: riskColor(impact.riskLevel) }}>
          {impact.riskLevel.toUpperCase()}
        </span>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
        <div style={{ padding: "10px 12px", borderRadius: 10, background: "rgba(255,255,255,.03)", border: "1px solid var(--border)" }}>
          <div style={{ fontSize: 10, color: "var(--muted)", marginBottom: 3 }}>Costo delta</div>
          <div style={{ fontSize: 16, fontWeight: 800, color: "var(--ink)" }}>{money(impact.costDeltaAvg)}</div>
          <div style={{ fontSize: 10, color: "var(--muted)", marginTop: 2 }}>{money(impact.costDeltaMin)} – {money(impact.costDeltaMax)}</div>
        </div>
        <div style={{ padding: "10px 12px", borderRadius: 10, background: "rgba(255,255,255,.03)", border: "1px solid var(--border)" }}>
          <div style={{ fontSize: 10, color: "var(--muted)", marginBottom: 3 }}>Impacto en pago</div>
          <div style={{ fontSize: 12, fontWeight: 800, color: pImpact.color }}>{pImpact.label}</div>
          {impact.probability != null && (
            <div style={{ fontSize: 10, color: "var(--muted)", marginTop: 2 }}>Probabilidad: {impact.probability}%</div>
          )}
        </div>
      </div>

      {impact.affectedMilestones.length > 0 && (
        <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12, color: "var(--muted)" }}>
          <Layers size={12} />
          <span>{impact.affectedMilestones.length} milestone(s) afectado(s)</span>
        </div>
      )}

      {/* Apply to BuildOps button — only for approved, not yet applied */}
      {canApply && impact.paymentImpact !== "already_applied" && (
        <button
          type="button"
          onClick={() => void handleApply()}
          disabled={applying}
          style={{
            display: "inline-flex", alignItems: "center", gap: 8, padding: "10px 16px",
            borderRadius: 10, border: "none", cursor: applying ? "not-allowed" : "pointer",
            background: applying ? "rgba(99,102,241,.1)" : "rgba(99,102,241,.2)",
            color: "#818cf8", fontWeight: 700, fontSize: 12, opacity: applying ? 0.7 : 1,
          }}
        >
          <CheckCircle size={13} />
          {applying ? "Aplicando..." : "Aplicar a BuildOps"}
        </button>
      )}

      {applyResult?.alreadyApplied && (
        <div style={{ fontSize: 12, color: "#86efac", display: "flex", alignItems: "center", gap: 6 }}>
          <CheckCircle size={12} />
          Ya aplicado — sin cambios adicionales
        </div>
      )}

      <div style={{ fontSize: 10, color: "var(--muted)" }}>{impact.auditReason}</div>
    </div>
  );
}
