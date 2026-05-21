"use client";
import { useCallback, useEffect, useState } from "react";
import { AlertTriangle, Camera, CheckCircle2, FileText, RefreshCw, Shield } from "lucide-react";

type ChecklistItem = { label: string; kind: string; description: string };
type Checklist     = { milestoneTitle: string; required: ChecklistItem[]; disputeRisk: string };

const KIND_ICONS: Record<string, typeof Camera> = {
  photo:    Camera,
  test:     CheckCircle2,
  document: FileText,
};

const RISK_COLORS: Record<string, string> = {
  high:   "#fca5a5",
  medium: "#fcd34d",
  low:    "#86efac",
};

export function EvidenceChecklistCard({
  milestoneTitle,
  trade,
  compact = false,
}: {
  milestoneTitle: string;
  trade: string;
  compact?: boolean;
}) {
  const [data,    setData]    = useState<Checklist | null>(null);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const resp = await fetch("/api/semse/agents/evidence-checklist", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ milestoneTitle, trade }),
      });
      const json = await resp.json() as { data: Checklist };
      if (resp.ok && json.data) setData(json.data);
    } catch { /* silent */ } finally { setLoading(false); }
  }, [milestoneTitle, trade]);

  useEffect(() => { void load(); }, [load]);

  if (loading && !data) return (
    <div style={{ padding: "12px 14px", background: "var(--surface)", borderRadius: 10, fontSize: 12, color: "var(--muted)" }}>
      Generando checklist…
    </div>
  );

  if (!data) return null;

  const riskColor = RISK_COLORS[data.disputeRisk] ?? "#94a3b8";

  return (
    <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: compact ? 12 : 14, overflow: "hidden" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, padding: compact ? "10px 14px" : "14px 16px", borderBottom: "1px solid var(--border)" }}>
        <Shield size={compact ? 13 : 15} color="#86efac" />
        <span style={{ fontSize: compact ? 12 : 14, fontWeight: 800, flex: 1 }}>
          Evidencia requerida{!compact && ` — ${trade}`}
        </span>
        <span style={{ fontSize: 9, fontWeight: 800, color: riskColor, background: `${riskColor}15`, padding: "2px 8px", borderRadius: 99 }}>
          Riesgo disputa: {data.disputeRisk}
        </span>
        <button onClick={load} disabled={loading}
          style={{ background: "none", border: "none", cursor: "pointer", color: "var(--muted)", padding: 2 }}>
          <RefreshCw size={10} style={{ animation: loading ? "spin 1s linear infinite" : "none" }} />
        </button>
      </div>

      <div style={{ padding: compact ? "8px 14px" : "12px 16px", display: "grid", gap: 6 }}>
        {data.disputeRisk === "high" && (
          <div style={{ display: "flex", alignItems: "center", gap: 6, padding: "6px 10px", background: "rgba(239,68,68,.06)", borderRadius: 8, marginBottom: 4 }}>
            <AlertTriangle size={11} color="#fca5a5" />
            <span style={{ fontSize: 10, color: "#fca5a5" }}>Alto riesgo de disputa — evidencia completa es crítica para liberar el pago</span>
          </div>
        )}
        {data.required.map((item, i) => {
          const Icon = KIND_ICONS[item.kind] ?? Camera;
          return (
            <div key={i} style={{ display: "flex", alignItems: "flex-start", gap: 10, padding: "8px 10px", background: "rgba(134,239,172,.04)", borderRadius: 8, border: "1px solid rgba(134,239,172,.15)" }}>
              <div style={{ width: compact ? 22 : 28, height: compact ? 22 : 28, borderRadius: 7, background: "rgba(134,239,172,.12)", display: "grid", placeItems: "center", flexShrink: 0, marginTop: 1 }}>
                <Icon size={compact ? 11 : 13} color="#86efac" />
              </div>
              <div>
                <div style={{ fontSize: compact ? 11 : 12, fontWeight: 700, color: "var(--ink)" }}>{item.label}</div>
                {!compact && <div style={{ fontSize: 10, color: "var(--muted)", marginTop: 2 }}>{item.description}</div>}
              </div>
              <span style={{ marginLeft: "auto", fontSize: 9, color: "var(--muted)", background: "rgba(255,255,255,.06)", padding: "2px 6px", borderRadius: 99, flexShrink: 0 }}>
                {item.kind}
              </span>
            </div>
          );
        })}
        <div style={{ fontSize: 10, color: "var(--muted)", marginTop: 4, paddingTop: 4, borderTop: "1px solid var(--border)" }}>
          {data.required.length} item{data.required.length !== 1 ? "s" : ""} requerido{data.required.length !== 1 ? "s" : ""} · sin evidencia completa el pago queda bloqueado
        </div>
      </div>
      <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
