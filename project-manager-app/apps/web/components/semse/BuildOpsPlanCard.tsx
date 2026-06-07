"use client";
import { useCallback, useEffect, useState } from "react";
import { CheckCircle2, Clock, Layers, RefreshCw, Zap } from "lucide-react";

type Phase = {
  name: string;
  durationDays: number;
  tasks: string[];
  milestoneTitle?: string;
  evidenceRequired?: string[];
};

type PlanResult = {
  trade: string;
  phases: Phase[];
  totalDays: number;
  criticalPath: string[];
};

const PHASE_COLORS = ["#818cf8", "#67e8f9", "#86efac", "#fcd34d", "#fb923c"];

export function BuildOpsPlanCard({ trade, estimatedHours }: { trade: string; estimatedHours?: number }) {
  const [plan,    setPlan]    = useState<PlanResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const resp = await fetch("/api/semse/agents/plan", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ trade, estimatedHours: estimatedHours ?? 8 }),
      });
      const json = await resp.json() as { data: PlanResult };
      if (resp.ok && json.data) setPlan(json.data);
      else setError("No se pudo generar el plan");
    } catch (e) { setError(e instanceof Error ? e.message : "Error"); }
    finally { setLoading(false); }
  }, [trade, estimatedHours]);

  useEffect(() => { void load(); }, [load]);

  if (error) return (
    <div style={{ padding: "10px 14px", background: "rgba(239,68,68,.08)", borderRadius: 10, fontSize: 12, color: "#fca5a5" }}>{error}</div>
  );

  return (
    <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 14, overflow: "hidden" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "14px 16px", borderBottom: "1px solid var(--border)" }}>
        <Layers size={15} color="#67e8f9" />
        <span style={{ fontSize: 14, fontWeight: 800, flex: 1 }}>Plan BuildOps — {trade}</span>
        {plan && <span style={{ fontSize: 11, color: "var(--muted)" }}>{plan.totalDays} días · {plan.phases.length} fases</span>}
        <button onClick={load} disabled={loading}
          style={{ background: "none", border: "none", cursor: "pointer", color: "var(--muted)", padding: 4 }}>
          <RefreshCw size={11} style={{ animation: loading ? "spin 1s linear infinite" : "none" }} />
        </button>
      </div>

      {loading && !plan && (
        <div style={{ padding: "20px", textAlign: "center", fontSize: 12, color: "var(--muted)" }}>Generando plan…</div>
      )}

      {plan && (
        <div style={{ padding: "14px 16px", display: "grid", gap: 10 }}>
          {/* Timeline */}
          <div style={{ display: "flex", gap: 0, alignItems: "stretch" }}>
            {plan.phases.map((phase, i) => {
              const color = PHASE_COLORS[i % PHASE_COLORS.length]!;
              const width = `${Math.round((phase.durationDays / plan.totalDays) * 100)}%`;
              return (
                <div key={i} style={{ width, minWidth: 80, padding: "8px 10px", background: `${color}15`, borderLeft: `3px solid ${color}`, marginRight: i < plan.phases.length - 1 ? 4 : 0, borderRadius: 8 }}>
                  <div style={{ fontSize: 11, fontWeight: 800, color }}>{phase.name}</div>
                  <div style={{ fontSize: 10, color: "var(--muted)", marginTop: 2 }}>
                    <Clock size={8} style={{ verticalAlign: "middle" }} /> {phase.durationDays}d
                  </div>
                </div>
              );
            })}
          </div>

          {/* Phase details */}
          {plan.phases.map((phase, i) => {
            const color = PHASE_COLORS[i % PHASE_COLORS.length]!;
            return (
              <div key={i} style={{ padding: "10px 12px", background: "rgba(255,255,255,.03)", borderRadius: 10, border: "1px solid var(--border)" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
                  <span style={{ fontSize: 11, fontWeight: 800, color }}>{phase.name}</span>
                  {phase.milestoneTitle && (
                    <span style={{ fontSize: 9, color: "#818cf8", background: "rgba(99,102,241,.1)", padding: "1px 7px", borderRadius: 99 }}>
                      Milestone: {phase.milestoneTitle}
                    </span>
                  )}
                </div>
                <div style={{ display: "grid", gridTemplateColumns: phase.evidenceRequired?.length ? "1fr 1fr" : "1fr", gap: 8 }}>
                  <div>
                    <div style={{ fontSize: 9, fontWeight: 700, color: "var(--muted)", marginBottom: 4 }}>TAREAS</div>
                    {phase.tasks.map((t, j) => (
                      <div key={j} style={{ fontSize: 11, color: "var(--ink)", padding: "2px 0", display: "flex", gap: 6 }}>
                        <Zap size={9} color={color} style={{ flexShrink: 0, marginTop: 2 }} /> {t}
                      </div>
                    ))}
                  </div>
                  {phase.evidenceRequired && phase.evidenceRequired.length > 0 && (
                    <div>
                      <div style={{ fontSize: 9, fontWeight: 700, color: "var(--muted)", marginBottom: 4 }}>EVIDENCIA SEMSE</div>
                      {phase.evidenceRequired.map((e, j) => (
                        <div key={j} style={{ fontSize: 11, color: "#86efac", padding: "2px 0", display: "flex", gap: 6 }}>
                          <CheckCircle2 size={9} style={{ flexShrink: 0, marginTop: 2 }} /> {e}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
      <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
