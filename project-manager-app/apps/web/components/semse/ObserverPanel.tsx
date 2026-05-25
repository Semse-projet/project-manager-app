"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  Activity, AlertTriangle, Brain, CheckCircle2, ChevronDown, ChevronUp,
  Clock, Cpu, Database, Eye, RefreshCw, Server, Users, Wifi, Zap,
} from "lucide-react";
import { BehavioralHealthSection, type BehavioralHealth } from "./BehavioralHealthSection";

// ── Types ─────────────────────────────────────────────────────────────────────

type InfraItem = { name: string; healthy: boolean; latencyMs?: number; detail?: string };
type Alert     = { level: "critical" | "high" | "medium" | "info"; area: string; message: string; recommendation: string };
type Pattern   = { type: string; count: number; severity: string; interpretation: string };

type ObserverSnap = {
  observedAt:    string;
  healthScore:   number;
  autonomyNote:  string;
  infrastructure: { items: InfraItem[]; allHealthy: boolean; unhealthyCount: number };
  operationalHealth: {
    openSignals: number; criticalSignals: number; highSignals: number;
    milestones: { total: number; blockedPayment: number; readyPayment: number };
    changeOrders: { pendingCount: number };
  };
  intelligenceHealth: {
    llmTotalCalls: number; llmFallbacks: number; fallbackRate: number;
    ollamaAvailable: boolean; embeddingsMode: string;
    ragDocuments: number; ragChunks: number; ragEmbedded: number; ragMissingEmbeddings: number;
  };
  patterns: Pattern[];
  alerts: Alert[];
  behavioralHealth?: BehavioralHealth | null;
};

// ── Helpers ───────────────────────────────────────────────────────────────────

function scoreColor(n: number) {
  if (n >= 85) return "#86efac"; // green
  if (n >= 65) return "#fcd34d"; // yellow
  return "#fca5a5"; // red
}

function alertColor(level: Alert["level"]) {
  return level === "critical" ? "#fca5a5" : level === "high" ? "#fb923c" : level === "medium" ? "#fcd34d" : "#94a3b8";
}

function alertBg(level: Alert["level"]) {
  return level === "critical" ? "rgba(239,68,68,.12)" : level === "high" ? "rgba(251,146,60,.10)" : level === "medium" ? "rgba(234,179,8,.08)" : "rgba(148,163,184,.08)";
}

// ── Sub-components ────────────────────────────────────────────────────────────

function ScoreRing({ score }: { score: number }) {
  const r = 28; const circ = 2 * Math.PI * r;
  const fill = circ - (score / 100) * circ;
  return (
    <svg width={70} height={70} style={{ flexShrink: 0 }}>
      <circle cx={35} cy={35} r={r} fill="none" stroke="rgba(255,255,255,.08)" strokeWidth={6} />
      <circle cx={35} cy={35} r={r} fill="none" stroke={scoreColor(score)} strokeWidth={6}
        strokeDasharray={circ} strokeDashoffset={fill}
        strokeLinecap="round" transform="rotate(-90 35 35)" style={{ transition: "stroke-dashoffset .6s ease" }} />
      <text x={35} y={40} textAnchor="middle" fill={scoreColor(score)} fontSize={15} fontWeight={800}>{score}</text>
    </svg>
  );
}

function InfraRow({ item }: { item: InfraItem }) {
  const icon = item.name.toLowerCase().includes("postgres") || item.name.toLowerCase().includes("data") ? Database
    : item.name.toLowerCase().includes("llm") || item.name.toLowerCase().includes("embed") ? Brain
    : item.name.toLowerCase().includes("ollama") ? Cpu
    : Server;
  const Icon = icon;
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 12px", borderRadius: 10, background: "rgba(255,255,255,.03)", border: "1px solid var(--border)" }}>
      <Icon size={14} color={item.healthy ? "#86efac" : "#fca5a5"} />
      <span style={{ fontSize: 12, fontWeight: 700, color: "var(--ink)", flex: 1 }}>{item.name}</span>
      <span style={{ fontSize: 11, color: item.healthy ? "#86efac" : "#fca5a5", fontWeight: 600 }}>
        {item.healthy ? "✓" : "✗"}{item.latencyMs ? ` ${item.latencyMs}ms` : ""}
      </span>
      {item.detail && <span style={{ fontSize: 10, color: "var(--muted)", maxWidth: 160, overflow: "hidden", whiteSpace: "nowrap", textOverflow: "ellipsis" }}>{item.detail}</span>}
    </div>
  );
}

function AlertRow({ alert }: { alert: Alert }) {
  const [expanded, setExpanded] = useState(false);
  return (
    <div style={{ borderRadius: 10, background: alertBg(alert.level), border: `1px solid ${alertColor(alert.level)}30`, overflow: "hidden" }}>
      <button onClick={() => setExpanded((p) => !p)}
        style={{ width: "100%", display: "flex", alignItems: "center", gap: 10, padding: "10px 14px", background: "none", border: "none", cursor: "pointer", textAlign: "left" }}>
        <AlertTriangle size={13} color={alertColor(alert.level)} />
        <span style={{ fontSize: 11, fontWeight: 700, color: alertColor(alert.level), minWidth: 55 }}>{alert.level.toUpperCase()}</span>
        <span style={{ fontSize: 12, color: "var(--muted)", fontWeight: 600, flex: 1 }}>{alert.area}</span>
        <span style={{ fontSize: 12, color: "var(--ink)", flex: 3 }}>{alert.message}</span>
        {expanded ? <ChevronUp size={12} color="var(--muted)" /> : <ChevronDown size={12} color="var(--muted)" />}
      </button>
      {expanded && (
        <div style={{ padding: "0 14px 12px", fontSize: 11, color: "#94a3b8" }}>
          <span style={{ color: "#818cf8", fontWeight: 600 }}>→ </span>{alert.recommendation}
        </div>
      )}
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export function ObserverPanel() {
  const [snap, setSnap]       = useState<ObserverSnap | null>(null);
  const [loading, setLoading] = useState(false);
  const [lastFetch, setLastFetch] = useState<string | null>(null);
  const [error, setError]     = useState<string | null>(null);
  const timerRef              = useRef<ReturnType<typeof setInterval> | null>(null);

  const fetch = useCallback(async (fresh = false) => {
    setLoading(true);
    setError(null);
    try {
      const endpoint = fresh ? "/api/semse/ops/observer/snapshot" : "/api/semse/ops/observer/latest";
      const res = await window.fetch(endpoint);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json() as { data: ObserverSnap };
      setSnap(json.data);
      setLastFetch(new Date().toLocaleTimeString("es-MX"));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error al cargar snapshot");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetch(false);
    timerRef.current = setInterval(() => void fetch(false), 60_000); // refresh every 60s
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [fetch]);

  const intel = snap?.intelligenceHealth;
  const op    = snap?.operationalHealth;

  return (
    <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 16, padding: 20 }}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 20 }}>
        <div style={{ width: 38, height: 38, borderRadius: 12, background: "rgba(99,102,241,.15)", display: "grid", placeItems: "center" }}>
          <Eye size={18} color="#818cf8" />
        </div>
        <div style={{ flex: 1 }}>
          <h2 style={{ margin: 0, fontSize: 15, fontWeight: 800 }}>Internal Observer</h2>
          <p style={{ margin: 0, fontSize: 11, color: "var(--muted)" }}>
            {snap?.autonomyNote ?? "Nivel 0-1 — Solo lectura"}
            {lastFetch && <> · actualizado {lastFetch}</>}
          </p>
        </div>
        <button onClick={() => fetch(true)} disabled={loading}
          style={{ display: "flex", alignItems: "center", gap: 6, padding: "7px 14px", borderRadius: 10, background: "rgba(99,102,241,.15)", border: "none", cursor: loading ? "wait" : "pointer", fontSize: 12, color: "#818cf8", fontWeight: 700 }}>
          <RefreshCw size={13} style={{ animation: loading ? "spin 1s linear infinite" : "none" }} />
          Observar ahora
        </button>
      </div>

      {error && (
        <div style={{ padding: "12px 16px", background: "rgba(239,68,68,.1)", border: "1px solid rgba(239,68,68,.3)", borderRadius: 10, fontSize: 12, color: "#fca5a5", marginBottom: 16 }}>
          {error}
        </div>
      )}

      {!snap && !loading && !error && (
        <div style={{ fontSize: 13, color: "var(--muted)", textAlign: "center", padding: 24 }}>Cargando snapshot…</div>
      )}

      {snap && (
        <div style={{ display: "grid", gap: 16 }}>

          {/* Score + quick stats */}
          <div style={{ display: "grid", gridTemplateColumns: "auto 1fr 1fr 1fr 1fr", gap: 12, alignItems: "center" }}>
            <ScoreRing score={snap.healthScore} />
            {[
              { label: "Señales", value: String(op!.openSignals), sub: `${op!.criticalSignals} críticas`, icon: Activity },
              { label: "Milestones", value: String(op!.milestones.total), sub: `${op!.milestones.blockedPayment} bloqueados`, icon: Zap },
              { label: "RAG docs", value: String(intel!.ragDocuments), sub: intel!.embeddingsMode, icon: Brain },
              { label: "Ollama", value: intel!.ollamaAvailable ? "activo" : "inactivo", sub: `${Math.round(intel!.fallbackRate * 100)}% fallback`, icon: Cpu },
            ].map(({ label, value, sub, icon: Icon }) => (
              <div key={label} style={{ padding: "12px 14px", background: "rgba(255,255,255,.03)", borderRadius: 12, border: "1px solid var(--border)" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 4 }}>
                  <Icon size={12} color="#818cf8" />
                  <span style={{ fontSize: 10, color: "var(--muted)", fontWeight: 700 }}>{label}</span>
                </div>
                <div style={{ fontSize: 18, fontWeight: 800, color: "var(--ink)" }}>{value}</div>
                <div style={{ fontSize: 10, color: "var(--muted)", marginTop: 2 }}>{sub}</div>
              </div>
            ))}
          </div>

          {/* Infrastructure */}
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
              <Server size={13} color="#818cf8" />
              <span style={{ fontSize: 12, fontWeight: 800 }}>Infraestructura</span>
              <span style={{ fontSize: 11, color: snap.infrastructure.allHealthy ? "#86efac" : "#fca5a5", fontWeight: 600 }}>
                {snap.infrastructure.allHealthy ? "· todo sano" : `· ${snap.infrastructure.unhealthyCount} con problemas`}
              </span>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6 }}>
              {snap.infrastructure.items.map((item) => (
                <InfraRow key={item.name} item={item} />
              ))}
            </div>
          </div>

          {/* Alerts */}
          {snap.alerts.length > 0 && (
            <div>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
                <AlertTriangle size={13} color="#fcd34d" />
                <span style={{ fontSize: 12, fontWeight: 800 }}>Alertas ({snap.alerts.length})</span>
              </div>
              <div style={{ display: "grid", gap: 6 }}>
                {snap.alerts.map((a, i) => <AlertRow key={i} alert={a} />)}
              </div>
            </div>
          )}

          {snap.alerts.length === 0 && (
            <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "12px 16px", background: "rgba(134,239,172,.06)", border: "1px solid rgba(134,239,172,.25)", borderRadius: 12 }}>
              <CheckCircle2 size={14} color="#86efac" />
              <span style={{ fontSize: 12, color: "#86efac", fontWeight: 600 }}>Sistema estable — sin alertas activas</span>
            </div>
          )}

          {/* Patterns */}
          {snap.patterns.length > 0 && (
            <div>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
                <Wifi size={13} color="#818cf8" />
                <span style={{ fontSize: 12, fontWeight: 800 }}>Patrones detectados</span>
              </div>
              <div style={{ display: "grid", gap: 6 }}>
                {snap.patterns.map((p, i) => (
                  <div key={i} style={{ padding: "10px 14px", background: "rgba(255,255,255,.03)", borderRadius: 10, border: "1px solid var(--border)" }}>
                    <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
                      <span style={{ fontSize: 10, fontWeight: 800, color: "#818cf8", background: "rgba(99,102,241,.15)", padding: "2px 8px", borderRadius: 6 }}>{p.type}</span>
                      <span style={{ fontSize: 11, color: "var(--ink)" }}>{p.interpretation}</span>
                      <span style={{ fontSize: 10, color: "var(--muted)", marginLeft: "auto" }}>×{p.count}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Behavioral Health — human behavior layer (P3 MCA) */}
          {snap.behavioralHealth && (
            <div style={{ borderTop: "1px solid var(--border)", paddingTop: 16 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
                <Users size={13} color="#818cf8" />
                <span style={{ fontSize: 12, fontWeight: 800 }}>Salud Social</span>
                <span style={{ fontSize: 10, color: "var(--muted)", background: "rgba(99,102,241,.12)", padding: "2px 8px", borderRadius: 99, marginLeft: "auto" }}>
                  behavioral · score {snap.behavioralHealth.behavioralScore}/100
                </span>
              </div>
              <BehavioralHealthSection health={snap.behavioralHealth} />
            </div>
          )}

          {/* Observed at */}
          <div style={{ display: "flex", alignItems: "center", gap: 6, paddingTop: 4, borderTop: "1px solid var(--border)" }}>
            <Clock size={10} color="var(--muted)" />
            <span style={{ fontSize: 10, color: "var(--muted)" }}>
              Observado: {new Date(snap.observedAt).toLocaleString("es-MX")}
            </span>
          </div>
        </div>
      )}

      <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
