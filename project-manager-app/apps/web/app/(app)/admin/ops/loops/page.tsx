"use client";

/**
 * SPEC-AUT-001 (bloque AUT-001-E) — Panel OMEGA de Permanent Loops.
 * Métricas por loop, presupuesto consumido, pause/resume y revisión humana
 * de propuestas (aceptar/rechazar alimenta la memoria de rechazos).
 */
import { useCallback, useEffect, useState } from "react";
import { Pause, Play, RefreshCw, Repeat } from "lucide-react";

type LoopState = {
  paused: boolean;
  lastCycleAt: string | null;
  lastCycleStatus: string | null;
  cyclesCompleted: number;
  cyclesSkipped: number;
  findingsRecorded: number;
  proposalsOpened: number;
  tokensConsumed: number;
} | null;

type LoopView = {
  definition: {
    id: string;
    agentType: string;
    schedule: string;
    successMetric: string;
    budgetPerCycle: { maxTokens: number; maxProposals: number; timeoutMs: number };
    stopCriteria: { maxOpenProposals: number; cooldownDays: number; minConfidence: number };
  };
  state: LoopState;
  openProposals: number;
};

type LoopDecision = {
  id: string;
  target: string;
  kind: string;
  decision: string;
  outcome: string | null;
  rationale: string;
  confidence: number | null;
  createdAt: string;
};

function formatTimestamp(value?: string | null) {
  if (!value) return "—";
  return new Date(value).toLocaleString("es-MX", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" });
}

const cardStyle: React.CSSProperties = {
  border: "1px solid rgba(148,163,184,0.2)",
  borderRadius: 12,
  padding: 16,
  marginBottom: 16,
  background: "rgba(15,23,42,0.4)"
};

export default function PermanentLoopsPage() {
  const [enabled, setEnabled] = useState<boolean | null>(null);
  const [loops, setLoops] = useState<LoopView[]>([]);
  const [decisions, setDecisions] = useState<Record<string, LoopDecision[]>>({});
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setError(null);
      const res = await fetch("/api/semse/ops/loops");
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const payload = await res.json();
      setEnabled(Boolean(payload?.data?.enabled));
      setLoops(payload?.data?.loops ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  }, []);

  const loadDecisions = useCallback(async (loopId: string) => {
    const res = await fetch(`/api/semse/ops/loops/${encodeURIComponent(loopId)}`);
    if (res.ok) {
      const payload = await res.json();
      setDecisions((prev) => ({ ...prev, [loopId]: payload?.data ?? [] }));
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const togglePause = async (loop: LoopView) => {
    setBusy(loop.definition.id);
    try {
      await fetch(`/api/semse/ops/loops/${encodeURIComponent(loop.definition.id)}`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ action: loop.state?.paused ? "resume" : "pause" })
      });
      await load();
    } finally {
      setBusy(null);
    }
  };

  const resolveDecision = async (loopId: string, decisionId: string, outcome: "accepted" | "rejected") => {
    setBusy(decisionId);
    try {
      await fetch(`/api/semse/ops/loops/decisions/${encodeURIComponent(decisionId)}`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ outcome })
      });
      await loadDecisions(loopId);
      await load();
    } finally {
      setBusy(null);
    }
  };

  return (
    <div style={{ padding: 24, maxWidth: 960 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 8 }}>
        <Repeat size={22} />
        <h1 style={{ fontSize: 22, fontWeight: 700, margin: 0 }}>Permanent Loops</h1>
        <button onClick={() => void load()} title="Refrescar" style={{ marginLeft: "auto", background: "none", border: "none", cursor: "pointer", color: "inherit" }}>
          <RefreshCw size={18} />
        </button>
      </div>
      <p style={{ opacity: 0.7, marginBottom: 4 }}>
        Agentes de fondo que detectan problemas y proponen — nunca mergean (ADR-021 P4).
      </p>
      <p style={{ marginBottom: 20 }}>
        Kill switch global:{" "}
        <strong style={{ color: enabled ? "#34d399" : "#fbbf24" }}>
          {enabled === null ? "…" : enabled ? "ACTIVO (AUTONOMY_LOOPS_ENABLED=true)" : "APAGADO"}
        </strong>
      </p>
      {error ? <p style={{ color: "#f87171" }}>Error: {error}</p> : null}

      {loops.map((loop) => {
        const loopDecisions = decisions[loop.definition.id];
        return (
          <div key={loop.definition.id} style={cardStyle}>
            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <h2 style={{ fontSize: 16, fontWeight: 600, margin: 0, fontFamily: "monospace" }}>{loop.definition.id}</h2>
              <span style={{ fontSize: 12, opacity: 0.7 }}>cron {loop.definition.schedule}</span>
              {loop.state?.paused ? (
                <span style={{ fontSize: 12, color: "#fbbf24" }}>PAUSADO</span>
              ) : null}
              <button
                onClick={() => void togglePause(loop)}
                disabled={busy === loop.definition.id}
                style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 6, padding: "6px 12px", borderRadius: 8, border: "1px solid rgba(148,163,184,0.3)", background: "none", color: "inherit", cursor: "pointer" }}
              >
                {loop.state?.paused ? <Play size={14} /> : <Pause size={14} />}
                {loop.state?.paused ? "Reanudar" : "Pausar"}
              </button>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", gap: 12, marginTop: 12, fontSize: 13 }}>
              <div>Último ciclo<br /><strong>{formatTimestamp(loop.state?.lastCycleAt)}</strong> {loop.state?.lastCycleStatus ? `(${loop.state.lastCycleStatus})` : ""}</div>
              <div>Ciclos ✓ / skip<br /><strong>{loop.state?.cyclesCompleted ?? 0} / {loop.state?.cyclesSkipped ?? 0}</strong></div>
              <div>Hallazgos<br /><strong>{loop.state?.findingsRecorded ?? 0}</strong></div>
              <div>Propuestas abiertas<br /><strong>{loop.openProposals} / {loop.definition.stopCriteria.maxOpenProposals}</strong></div>
              <div>Tokens consumidos<br /><strong>{loop.state?.tokensConsumed ?? 0} / {loop.definition.budgetPerCycle.maxTokens} por ciclo</strong></div>
              <div>Métrica de éxito<br /><strong style={{ fontFamily: "monospace" }}>{loop.definition.successMetric}</strong></div>
            </div>

            <div style={{ marginTop: 12 }}>
              {loopDecisions ? (
                loopDecisions.length === 0 ? (
                  <p style={{ fontSize: 13, opacity: 0.6 }}>Sin hallazgos registrados.</p>
                ) : (
                  <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "grid", gap: 8 }}>
                    {loopDecisions.map((decision) => (
                      <li key={decision.id} style={{ fontSize: 13, border: "1px solid rgba(148,163,184,0.15)", borderRadius: 8, padding: 10 }}>
                        <div style={{ display: "flex", gap: 8, alignItems: "baseline", flexWrap: "wrap" }}>
                          <span style={{ fontFamily: "monospace", fontSize: 11, opacity: 0.7 }}>[{decision.kind}]</span>
                          <span>{decision.rationale}</span>
                          {decision.confidence !== null ? <span style={{ opacity: 0.6 }}>conf {decision.confidence}</span> : null}
                          <span style={{ marginLeft: "auto", opacity: 0.6 }}>{formatTimestamp(decision.createdAt)}</span>
                        </div>
                        {decision.decision === "proposed" && decision.outcome === "pending_review" ? (
                          <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
                            <button
                              onClick={() => void resolveDecision(loop.definition.id, decision.id, "accepted")}
                              disabled={busy === decision.id}
                              style={{ padding: "4px 10px", borderRadius: 6, border: "1px solid rgba(16,185,129,0.4)", background: "rgba(16,185,129,0.12)", color: "#34d399", cursor: "pointer" }}
                            >
                              Aceptar
                            </button>
                            <button
                              onClick={() => void resolveDecision(loop.definition.id, decision.id, "rejected")}
                              disabled={busy === decision.id}
                              style={{ padding: "4px 10px", borderRadius: 6, border: "1px solid rgba(239,68,68,0.4)", background: "rgba(239,68,68,0.12)", color: "#f87171", cursor: "pointer" }}
                            >
                              Rechazar
                            </button>
                          </div>
                        ) : (
                          <div style={{ marginTop: 4, fontSize: 12, opacity: 0.6 }}>
                            {decision.decision}{decision.outcome ? ` → ${decision.outcome}` : ""}
                          </div>
                        )}
                      </li>
                    ))}
                  </ul>
                )
              ) : (
                <button
                  onClick={() => void loadDecisions(loop.definition.id)}
                  style={{ fontSize: 13, background: "none", border: "none", color: "#60a5fa", cursor: "pointer", padding: 0 }}
                >
                  Ver hallazgos y propuestas →
                </button>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
