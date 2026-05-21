"use client";
import { useCallback, useEffect, useState } from "react";
import { CheckCircle2, Lock, RefreshCw } from "lucide-react";

type CrowdDecision = {
  canRelease: boolean;
  blockers: string[];
  escrowStatus: string;
  requiredActions: string[];
};

/** Minimal badge showing Crowd Agent payment decision for a milestone */
export function CrowdDecisionBadge({
  evidenceApproved,
  changeOrdersPending = 0,
  disputeOpen = false,
  milestoneStatus,
}: {
  evidenceApproved: boolean;
  changeOrdersPending?: number;
  disputeOpen?: boolean;
  milestoneStatus: string;
}) {
  const [decision, setDecision] = useState<CrowdDecision | null>(null);
  const [loading,  setLoading]  = useState(false);

  const evaluate = useCallback(async () => {
    setLoading(true);
    try {
      const resp = await fetch("/api/semse/agents/payment-readiness", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ evidenceApproved, changeOrdersPending, disputeOpen, milestoneStatus }),
      });
      const json = await resp.json() as { data: CrowdDecision };
      if (resp.ok && json.data) setDecision(json.data);
    } catch { /* silent */ } finally { setLoading(false); }
  }, [evidenceApproved, changeOrdersPending, disputeOpen, milestoneStatus]);

  useEffect(() => { void evaluate(); }, [evaluate]);

  if (!decision) return null;

  const color = decision.canRelease ? "#86efac" : "#fca5a5";
  const Icon  = decision.canRelease ? CheckCircle2 : Lock;

  return (
    <div style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "4px 10px", borderRadius: 99, background: `${color}15`, border: `1px solid ${color}30`, fontSize: 11 }}>
      {loading
        ? <RefreshCw size={10} color="var(--muted)" style={{ animation: "spin 1s linear infinite" }} />
        : <Icon size={10} color={color} />
      }
      <span style={{ fontWeight: 700, color }}>
        Crowd: {decision.canRelease ? "listo para pago" : decision.escrowStatus}
      </span>
      {decision.blockers.length > 0 && (
        <span style={{ color: "var(--muted)", fontSize: 9 }}>({decision.blockers.length} bloq.)</span>
      )}
      <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
