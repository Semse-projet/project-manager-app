"use client";

import { useEffect, useState, useCallback } from "react";
import { Activity, AlertTriangle, CheckCircle, RefreshCw, ShieldAlert } from "lucide-react";

type ProjectHealth = {
  projectId:           string;
  title:               string;
  trade:               string;
  status:              string;
  completion:          number;
  riskLevel:           string;
  riskScore:           number;
  openSignals:         number;
  criticalSignals:     number;
  openChangeCandidates: number;
  algorithmConfidence: number | null;
  algorithmRisk:       number | null;
  nextBestAction:      string;
  generatedAt:         string;
};

function riskColor(r: string): string {
  if (r === "critical") return "#ef4444";
  if (r === "high")     return "#fb7185";
  if (r === "medium")   return "#fbbf24";
  return "#86efac";
}

interface Props {
  projectId: string;
}

export function BuildOpsProjectHealthPanel({ projectId }: Props) {
  const [data, setData] = useState<ProjectHealth | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/semse/buildops/projects/${projectId}/health`);
      const json = await res.json() as { data?: ProjectHealth; error?: { message?: string } };
      if (!res.ok) throw new Error(json?.error?.message ?? "No se pudo cargar el estado del proyecto.");
      setData(json.data ?? null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al cargar health.");
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  useEffect(() => { void load(); }, [load]);

  if (loading) {
    return <div style={{ padding: 14, borderRadius: 12, background: "var(--surface)", border: "1px solid var(--border)", fontSize: 12, color: "var(--muted)" }}>Analizando salud del proyecto...</div>;
  }

  if (error || !data) {
    return (
      <div style={{ padding: 12, borderRadius: 12, background: "rgba(239,68,68,.06)", border: "1px solid rgba(239,68,68,.2)", color: "#fca5a5", fontSize: 12 }}>
        {error ?? "Sin datos de salud"}
      </div>
    );
  }

  const isHealthy = data.criticalSignals === 0 && data.openChangeCandidates === 0;

  return (
    <div style={{ background: "var(--surface)", border: `1px solid ${riskColor(data.riskLevel)}33`, borderRadius: 14, padding: 16, display: "grid", gap: 12 }}>

      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", gap: 10, justifyContent: "space-between" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <Activity size={15} color={riskColor(data.riskLevel)} />
          <span style={{ fontSize: 13, fontWeight: 800, color: "var(--ink)" }}>Salud del proyecto</span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <span style={{ fontSize: 11, fontWeight: 800, color: riskColor(data.riskLevel), textTransform: "uppercase" }}>
            Riesgo {data.riskLevel}
          </span>
          <button type="button" onClick={() => void load()} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--muted)" }}>
            <RefreshCw size={12} />
          </button>
        </div>
      </div>

      {/* Counters */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(100px, 1fr))", gap: 8 }}>
        {[
          { label: "Señales críticas", value: data.criticalSignals, color: data.criticalSignals > 0 ? "#ef4444" : "#86efac" },
          { label: "Señales abiertas", value: data.openSignals, color: data.openSignals > 0 ? "#fbbf24" : "var(--muted)" },
          { label: "Change orders", value: data.openChangeCandidates, color: data.openChangeCandidates > 0 ? "#fbbf24" : "var(--muted)" },
          { label: "Completado", value: `${data.completion}%`, color: data.completion >= 80 ? "#86efac" : "var(--ink)" },
        ].map((item) => (
          <div key={item.label} style={{ padding: "8px 10px", borderRadius: 10, background: "rgba(255,255,255,.03)", border: "1px solid var(--border)", textAlign: "center" }}>
            <div style={{ fontSize: 17, fontWeight: 800, color: item.color }}>{item.value}</div>
            <div style={{ fontSize: 9, color: "var(--muted)", marginTop: 2, textTransform: "uppercase", letterSpacing: 0.5 }}>{item.label}</div>
          </div>
        ))}
      </div>

      {/* Next best action */}
      <div style={{ display: "flex", alignItems: "flex-start", gap: 8, padding: "10px 12px", borderRadius: 10, background: "rgba(99,102,241,.06)", border: "1px solid rgba(99,102,241,.2)" }}>
        {isHealthy ? <CheckCircle size={13} color="#86efac" style={{ flexShrink: 0, marginTop: 1 }} /> : <AlertTriangle size={13} color="#fbbf24" style={{ flexShrink: 0, marginTop: 1 }} />}
        <span style={{ fontSize: 12, color: "var(--ink)" }}>{data.nextBestAction}</span>
      </div>

      {/* Algorithm confidence */}
      {data.algorithmConfidence != null && (
        <div style={{ fontSize: 11, color: "var(--muted)", display: "flex", gap: 12 }}>
          <span>Confianza estimado: <strong style={{ color: "var(--ink)" }}>{data.algorithmConfidence}/100</strong></span>
          {data.algorithmRisk != null && <span>Riesgo algoritmo: <strong style={{ color: riskColor(data.algorithmRisk > 60 ? "high" : data.algorithmRisk > 30 ? "medium" : "low") }}>{data.algorithmRisk}/100</strong></span>}
        </div>
      )}
    </div>
  );
}
