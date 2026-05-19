"use client";

import { useCallback, useEffect, useState } from "react";
import {
  AlertTriangle, BookOpen, Brain, CheckCircle2, ChevronDown, ChevronUp,
  Clock, Cpu, Eye, GitBranch, RefreshCw, Shield, Sparkles, Zap,
} from "lucide-react";

// ── Types ─────────────────────────────────────────────────────────────────────

type ModuleStatus = "mature" | "functional" | "partial" | "minimal" | "missing";

type ModuleMaturity = {
  module: string;
  score: number;
  status: ModuleStatus;
  gaps: string[];
};

type Risk = {
  severity: "critical" | "high" | "medium" | "low";
  area: string;
  message: string;
  recommendation?: string;
};

type ConsciousnessIndex = {
  generatedAt: string;
  version: string;
  identity: {
    name: string;
    purpose: string;
    coreLoop: string[];
    operatingPrinciples: string[];
    autonomyLevel: number;
    autonomyDescription: string;
  };
  memory: {
    ragStatus: { provider: string; model: string; available: boolean; totalDocuments: number; totalChunks: number; chunksWithEmbeddings: number; retrievalMode: string };
    auditLogActive: boolean;
    operationalSignalsActive: boolean;
    memoryLayers: string[];
  };
  brains: {
    providers: Array<{ name: string; available: boolean; isDefault: boolean; successCount: number; failureCount: number; role: string }>;
    routingPolicy: { defaultProvider: string; fallbackChain: string[] };
    totalLLMCalls: number;
    totalFallbacks: number;
  };
  maturity: {
    globalScore: number;
    byModule: ModuleMaturity[];
    strongestAreas: string[];
    weakestAreas: string[];
  };
  risks: { critical: Risk[]; high: Risk[]; medium: Risk[]; low: Risk[] };
  operationalState: { openSignals: number; criticalSignals: number; monetizableFlowReady: boolean; monetizableFlowStatus: string };
  recommendations: { nextBestActions: string[]; doNotDoYet: string[]; strategicWarnings: string[] };
  observation: {
    observedAt: string; healthScore: number; infraHealthy: boolean;
    alertCount: number; alertSummary: string[]; ragMode: string; ollamaAvailable: boolean;
  };
};

// ── Helpers ───────────────────────────────────────────────────────────────────

const STATUS_COLORS: Record<ModuleStatus, string> = {
  mature:     "#86efac",
  functional: "#67e8f9",
  partial:    "#fcd34d",
  minimal:    "#fb923c",
  missing:    "#475569",
};

function scoreBar(score: number) {
  const color = score >= 90 ? "#86efac" : score >= 70 ? "#67e8f9" : score >= 45 ? "#fcd34d" : score >= 20 ? "#fb923c" : "#475569";
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
      <div style={{ flex: 1, height: 6, background: "rgba(255,255,255,.08)", borderRadius: 99, overflow: "hidden" }}>
        <div style={{ width: `${score}%`, height: "100%", background: color, borderRadius: 99, transition: "width .5s ease" }} />
      </div>
      <span style={{ fontSize: 11, fontWeight: 800, color, minWidth: 28, textAlign: "right" }}>{score}</span>
    </div>
  );
}

function globalRing(score: number) {
  const r = 42; const circ = 2 * Math.PI * r;
  const fill = circ - (score / 100) * circ;
  const color = score >= 80 ? "#86efac" : score >= 60 ? "#fcd34d" : "#fb923c";
  return (
    <svg width={100} height={100}>
      <circle cx={50} cy={50} r={r} fill="none" stroke="rgba(255,255,255,.08)" strokeWidth={8} />
      <circle cx={50} cy={50} r={r} fill="none" stroke={color} strokeWidth={8}
        strokeDasharray={circ} strokeDashoffset={fill} strokeLinecap="round"
        transform="rotate(-90 50 50)" style={{ transition: "stroke-dashoffset .8s ease" }} />
      <text x={50} y={46} textAnchor="middle" fill={color} fontSize={20} fontWeight={800}>{score}</text>
      <text x={50} y={62} textAnchor="middle" fill="var(--muted)" fontSize={9}>/100</text>
    </svg>
  );
}

function RiskGroup({ label, items, color }: { label: string; items: Risk[]; color: string }) {
  const [open, setOpen] = useState(label === "medium" || label === "critical" || label === "high");
  if (!items.length) return null;
  return (
    <div style={{ borderRadius: 12, border: `1px solid ${color}30`, overflow: "hidden" }}>
      <button onClick={() => setOpen((p) => !p)}
        style={{ width: "100%", display: "flex", alignItems: "center", gap: 10, padding: "12px 16px", background: `${color}10`, border: "none", cursor: "pointer", textAlign: "left" }}>
        <AlertTriangle size={13} color={color} />
        <span style={{ fontSize: 12, fontWeight: 800, color }}>{label.toUpperCase()}</span>
        <span style={{ fontSize: 11, color, background: `${color}25`, padding: "1px 8px", borderRadius: 99 }}>{items.length}</span>
        <div style={{ flex: 1 }} />
        {open ? <ChevronUp size={12} color="var(--muted)" /> : <ChevronDown size={12} color="var(--muted)" />}
      </button>
      {open && (
        <div style={{ padding: "8px 16px 12px", display: "grid", gap: 8 }}>
          {items.map((r, i) => (
            <div key={i} style={{ padding: "10px 12px", background: "rgba(255,255,255,.02)", borderRadius: 10, border: "1px solid var(--border)" }}>
              <div style={{ display: "flex", gap: 8, alignItems: "flex-start" }}>
                <span style={{ fontSize: 10, fontWeight: 800, color, background: `${color}20`, padding: "2px 8px", borderRadius: 6, whiteSpace: "nowrap", marginTop: 1 }}>{r.area}</span>
                <div>
                  <div style={{ fontSize: 12, color: "var(--ink)" }}>{r.message}</div>
                  {r.recommendation && <div style={{ fontSize: 11, color: "#818cf8", marginTop: 4 }}>→ {r.recommendation}</div>}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function ConsciousnessPage() {
  const [data, setData]       = useState<ConsciousnessIndex | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState<string | null>(null);
  const [lastAt, setLastAt]   = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const res = await fetch("/api/semse/ops/consciousness");
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json() as { data: ConsciousnessIndex };
      setData(json.data);
      setLastAt(new Date().toLocaleTimeString("es-MX"));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const allRisks = data ? [
    ...data.risks.critical, ...data.risks.high, ...data.risks.medium, ...data.risks.low,
  ] : [];

  return (
    <div style={{ maxWidth: 1100, margin: "0 auto", padding: "28px 20px", color: "var(--ink)" }}>

      {/* Header */}
      <div style={{ display: "flex", alignItems: "flex-start", gap: 16, marginBottom: 28 }}>
        <div style={{ width: 44, height: 44, borderRadius: 14, background: "rgba(99,102,241,.15)", display: "grid", placeItems: "center", flexShrink: 0 }}>
          <Eye size={20} color="#818cf8" />
        </div>
        <div style={{ flex: 1 }}>
          <h1 style={{ margin: 0, fontSize: 22, fontWeight: 900 }}>SEMSE Consciousness</h1>
          <p style={{ margin: "4px 0 0", fontSize: 12, color: "var(--muted)" }}>
            {data?.identity.autonomyDescription ?? "Cargando…"}
            {lastAt && <> · {lastAt}</>}
          </p>
        </div>
        <button onClick={load} disabled={loading}
          style={{ display: "flex", alignItems: "center", gap: 6, padding: "8px 16px", borderRadius: 10, background: "rgba(99,102,241,.15)", border: "none", cursor: loading ? "wait" : "pointer", fontSize: 12, color: "#818cf8", fontWeight: 700 }}>
          <RefreshCw size={12} style={{ animation: loading ? "spin 1s linear infinite" : "none" }} />
          Actualizar
        </button>
      </div>

      {error && (
        <div style={{ padding: "14px 18px", background: "rgba(239,68,68,.1)", border: "1px solid rgba(239,68,68,.3)", borderRadius: 12, fontSize: 13, color: "#fca5a5", marginBottom: 20 }}>
          {error} — verifica que la API esté corriendo y autenticada.
        </div>
      )}

      {data && (
        <div style={{ display: "grid", gap: 20 }}>

          {/* Row 1: Maturity + Live Observation */}
          <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: 20, alignItems: "start" }}>

            {/* Module Maturity */}
            <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 16, padding: 20 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 16 }}>
                <GitBranch size={15} color="#818cf8" />
                <h2 style={{ margin: 0, fontSize: 14, fontWeight: 800 }}>Madurez de Módulos</h2>
                <span style={{ fontSize: 11, color: "var(--muted)", marginLeft: "auto" }}>
                  {data.maturity.globalScore}/100 global
                </span>
              </div>
              <div style={{ display: "grid", gap: 8 }}>
                {data.maturity.byModule.map((m) => (
                  <div key={m.module} style={{ display: "grid", gridTemplateColumns: "140px 1fr auto", gap: 10, alignItems: "center" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                      <span style={{ width: 7, height: 7, borderRadius: "50%", background: STATUS_COLORS[m.status], flexShrink: 0 }} />
                      <span style={{ fontSize: 12, color: "var(--ink)", overflow: "hidden", whiteSpace: "nowrap", textOverflow: "ellipsis" }}>{m.module}</span>
                    </div>
                    {scoreBar(m.score)}
                    <span style={{ fontSize: 10, color: STATUS_COLORS[m.status], fontWeight: 700, minWidth: 60, textAlign: "right" }}>{m.status}</span>
                  </div>
                ))}
              </div>
              <div style={{ marginTop: 14, paddingTop: 12, borderTop: "1px solid var(--border)", display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                <div>
                  <div style={{ fontSize: 10, color: "var(--muted)", fontWeight: 700, marginBottom: 6 }}>MÁS MADUROS</div>
                  {data.maturity.strongestAreas.map((a) => (
                    <div key={a} style={{ fontSize: 11, color: "#86efac", padding: "2px 0" }}>✓ {a}</div>
                  ))}
                </div>
                <div>
                  <div style={{ fontSize: 10, color: "var(--muted)", fontWeight: 700, marginBottom: 6 }}>NECESITAN TRABAJO</div>
                  {data.maturity.weakestAreas.map((a) => (
                    <div key={a} style={{ fontSize: 11, color: "#fb923c", padding: "2px 0" }}>△ {a}</div>
                  ))}
                </div>
              </div>
            </div>

            {/* Live Observation */}
            <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 16, padding: 20, display: "grid", gap: 16 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <Sparkles size={15} color="#818cf8" />
                <h2 style={{ margin: 0, fontSize: 14, fontWeight: 800 }}>Observación Live</h2>
              </div>
              <div style={{ display: "flex", justifyContent: "center" }}>
                {globalRing(data.observation.healthScore)}
              </div>
              {[
                { label: "Infraestructura",  value: data.observation.infraHealthy ? "✅ sana" : "⚠ issues",  color: data.observation.infraHealthy ? "#86efac" : "#fca5a5" },
                { label: "RAG mode",         value: data.observation.ragMode,                                  color: data.observation.ragMode === "hybrid" ? "#86efac" : "#fcd34d" },
                { label: "Ollama",           value: data.observation.ollamaAvailable ? "activo" : "inactivo", color: data.observation.ollamaAvailable ? "#86efac" : "#fb923c" },
                { label: "Alertas",          value: `${data.observation.alertCount}`,                          color: data.observation.alertCount === 0 ? "#86efac" : "#fcd34d" },
                { label: "Señales abiertas", value: `${data.operationalState.openSignals}`,                   color: data.operationalState.criticalSignals > 0 ? "#fca5a5" : "#86efac" },
              ].map(({ label, value, color }) => (
                <div key={label} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "6px 0", borderBottom: "1px solid var(--border)" }}>
                  <span style={{ fontSize: 12, color: "var(--muted)" }}>{label}</span>
                  <span style={{ fontSize: 12, fontWeight: 700, color }}>{value}</span>
                </div>
              ))}
              <div style={{ fontSize: 10, color: "var(--muted)" }}>
                <Clock size={9} style={{ verticalAlign: "middle", marginRight: 4 }} />
                {new Date(data.observation.observedAt).toLocaleString("es-MX")}
              </div>
            </div>
          </div>

          {/* Row 2: Identity */}
          <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 16, padding: 20 }}>
            <div style={{ display: "flex", gap: 16, flexWrap: "wrap" }}>
              <div style={{ flex: 2, minWidth: 260 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
                  <Brain size={14} color="#818cf8" />
                  <span style={{ fontSize: 12, fontWeight: 800 }}>Identidad</span>
                  <span style={{ fontSize: 10, color: "#818cf8", background: "rgba(99,102,241,.15)", padding: "2px 8px", borderRadius: 99 }}>Nivel {data.identity.autonomyLevel}</span>
                </div>
                <p style={{ margin: "0 0 12px", fontSize: 12, color: "var(--muted)", lineHeight: 1.5 }}>{data.identity.purpose}</p>
                <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                  {data.identity.coreLoop.map((step, i) => (
                    <span key={step} style={{ fontSize: 10, padding: "3px 10px", borderRadius: 99, background: "rgba(99,102,241,.12)", color: "#818cf8", fontWeight: 700, display: "flex", alignItems: "center", gap: 4 }}>
                      {i > 0 && <span style={{ color: "rgba(129,140,248,.4)" }}>›</span>}
                      {step}
                    </span>
                  ))}
                </div>
              </div>
              <div style={{ flex: 1, minWidth: 220 }}>
                <div style={{ fontSize: 10, fontWeight: 800, color: "var(--muted)", marginBottom: 8 }}>PRINCIPIOS OPERATIVOS</div>
                {data.identity.operatingPrinciples.map((p, i) => (
                  <div key={i} style={{ fontSize: 11, color: "var(--ink)", padding: "4px 0", borderBottom: "1px solid var(--border)", opacity: 0.8 }}>{p}</div>
                ))}
              </div>
            </div>
          </div>

          {/* Row 3: Risks */}
          {allRisks.length > 0 && (
            <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 16, padding: 20 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 14 }}>
                <Shield size={14} color="#818cf8" />
                <h2 style={{ margin: 0, fontSize: 14, fontWeight: 800 }}>Riesgos detectados</h2>
                <span style={{ fontSize: 11, color: "var(--muted)", marginLeft: "auto" }}>{allRisks.length} total</span>
              </div>
              <div style={{ display: "grid", gap: 8 }}>
                <RiskGroup label="critical" items={data.risks.critical} color="#ef4444" />
                <RiskGroup label="high"     items={data.risks.high}     color="#f97316" />
                <RiskGroup label="medium"   items={data.risks.medium}   color="#eab308" />
                <RiskGroup label="low"      items={data.risks.low}      color="#64748b" />
              </div>
            </div>
          )}

          {/* Row 4: Recommendations + Memory */}
          <div style={{ display: "grid", gridTemplateColumns: "3fr 2fr", gap: 20, alignItems: "start" }}>

            {/* Recommendations */}
            <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 16, padding: 20 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 14 }}>
                <Zap size={14} color="#818cf8" />
                <h2 style={{ margin: 0, fontSize: 14, fontWeight: 800 }}>Recomendaciones</h2>
              </div>

              <div style={{ marginBottom: 14 }}>
                <div style={{ fontSize: 10, fontWeight: 800, color: "#86efac", marginBottom: 8 }}>PRÓXIMAS ACCIONES</div>
                {data.recommendations.nextBestActions.map((a, i) => (
                  <div key={i} style={{ display: "flex", gap: 8, padding: "8px 0", borderBottom: "1px solid var(--border)" }}>
                    <span style={{ fontSize: 11, color: "#818cf8", fontWeight: 800, minWidth: 16 }}>{i + 1}.</span>
                    <span style={{ fontSize: 12, color: "var(--ink)" }}>{a}</span>
                  </div>
                ))}
              </div>

              <div style={{ marginBottom: 14 }}>
                <div style={{ fontSize: 10, fontWeight: 800, color: "#fcd34d", marginBottom: 8 }}>ADVERTENCIAS ESTRATÉGICAS</div>
                {data.recommendations.strategicWarnings.map((w, i) => (
                  <div key={i} style={{ fontSize: 11, color: "var(--muted)", padding: "5px 0", borderBottom: "1px solid var(--border)" }}>
                    ⚠ {w}
                  </div>
                ))}
              </div>

              <div>
                <div style={{ fontSize: 10, fontWeight: 800, color: "#94a3b8", marginBottom: 8 }}>NO HACER TODAVÍA</div>
                {data.recommendations.doNotDoYet.map((d, i) => (
                  <div key={i} style={{ fontSize: 11, color: "var(--muted)", padding: "5px 0", borderBottom: "1px solid var(--border)" }}>
                    ⏸ {d}
                  </div>
                ))}
              </div>
            </div>

            {/* Memory + Brains */}
            <div style={{ display: "grid", gap: 16 }}>
              <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 16, padding: 18 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
                  <BookOpen size={13} color="#818cf8" />
                  <span style={{ fontSize: 13, fontWeight: 800 }}>Memoria</span>
                </div>
                {[
                  { label: "RAG provider", value: data.memory.ragStatus.provider },
                  { label: "Documentos",   value: String(data.memory.ragStatus.totalDocuments) },
                  { label: "Chunks",       value: `${data.memory.ragStatus.chunksWithEmbeddings}/${data.memory.ragStatus.totalChunks}` },
                  { label: "Retrieval",    value: data.memory.ragStatus.retrievalMode },
                  { label: "AuditLog",     value: data.memory.auditLogActive ? "activo" : "vacío" },
                  { label: "Signals",      value: data.memory.operationalSignalsActive ? "activos" : "vacíos" },
                ].map(({ label, value }) => (
                  <div key={label} style={{ display: "flex", justifyContent: "space-between", padding: "5px 0", borderBottom: "1px solid var(--border)" }}>
                    <span style={{ fontSize: 11, color: "var(--muted)" }}>{label}</span>
                    <span style={{ fontSize: 11, fontWeight: 700, color: "var(--ink)" }}>{value}</span>
                  </div>
                ))}
              </div>

              <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 16, padding: 18 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
                  <Cpu size={13} color="#818cf8" />
                  <span style={{ fontSize: 13, fontWeight: 800 }}>Cerebros LLM</span>
                </div>
                {data.brains.providers.map((p) => (
                  <div key={p.name} style={{ display: "flex", alignItems: "center", gap: 8, padding: "5px 0", borderBottom: "1px solid var(--border)" }}>
                    <span style={{ fontSize: 10, fontWeight: 800, color: p.isDefault ? "#818cf8" : "var(--muted)", background: p.isDefault ? "rgba(99,102,241,.15)" : "transparent", padding: "1px 6px", borderRadius: 6 }}>
                      {p.name}{p.isDefault ? " ★" : ""}
                    </span>
                    <span style={{ fontSize: 10, color: "var(--muted)", flex: 1 }}>{p.successCount}✓ {p.failureCount}✗</span>
                  </div>
                ))}
                <div style={{ marginTop: 8, fontSize: 10, color: "var(--muted)" }}>
                  Total: {data.brains.totalLLMCalls} calls · {data.brains.totalFallbacks} fallbacks cloud
                </div>
              </div>

              {/* Monetizable flow status */}
              <div style={{ padding: "12px 16px", background: data.operationalState.criticalSignals > 0 ? "rgba(239,68,68,.08)" : "rgba(134,239,172,.06)", border: `1px solid ${data.operationalState.criticalSignals > 0 ? "rgba(239,68,68,.3)" : "rgba(134,239,172,.25)"}`, borderRadius: 12 }}>
                <div style={{ fontSize: 10, fontWeight: 800, color: "var(--muted)", marginBottom: 4 }}>CICLO MONETIZABLE</div>
                <div style={{ fontSize: 13, fontWeight: 700, color: data.operationalState.criticalSignals > 0 ? "#fca5a5" : "#86efac" }}>
                  {data.operationalState.monetizableFlowStatus}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
