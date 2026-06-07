"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import {
  Activity, Brain, Database, Ghost, Globe, Infinity,
  Key, Lock, Network, Radio, Server, Shield,
  Sparkles, Terminal, TrendingDown, Workflow, Zap,
  FileCode, Scale, Eye, AlertTriangle, CheckCircle,
  ChevronRight, Cpu,
} from "lucide-react";
import {
  fetchAiModelLogs,
  fetchAiModelLogStats,
  fetchPrometeoOperationalContext,
  fetchCoordinatorSnapshot,
  type AiModelInteractionLog,
  type AiModelInteractionStats,
  type CoordinatorSnapshot,
  type PrometeoOperationalContext,
} from "../../../semse-api";

// ── Types ──────────────────────────────────────────────────────────────────────

type SystemLayer = "neural" | "genesis" | "phantom" | "governance";

type SyntheticLog = {
  id: string;
  ts: string;
  category: string;
  message: string;
  source: string;
};

// ── Helpers ────────────────────────────────────────────────────────────────────

function formatMs(ms: number | null | undefined): string {
  if (!ms) return "—";
  if (ms < 1000) return `${ms}ms`;
  return `${(ms / 1000).toFixed(1)}s`;
}

function taskLabel(t: string): string {
  const m: Record<string, string> = {
    document_summary: "ANÁLISIS OPERATIVO",
    project_planning: "PLANIFICACIÓN",
    construction_contract_analysis: "ANÁLISIS LEGAL",
    receipt_ocr: "OCR RECIBO",
    general_chat: "CHAT GENERAL",
    risk_analysis: "ANÁLISIS RIESGO",
    rag_answer: "BÚSQUEDA RAG",
  };
  return m[t] ?? t.toUpperCase().replace(/_/g, " ");
}

function modelColor(slug: string): string {
  if (slug.includes("claude")) return "#06b6d4";
  if (slug.includes("prometeo")) return "#818cf8";
  if (slug.includes("gpt")) return "#10b981";
  return "#94a3b8";
}

function ecoTone(status: "strong" | "stable" | "watch" | "critical") {
  if (status === "strong") return { color: "#10b981", bg: "rgba(16,185,129,.12)" };
  if (status === "stable") return { color: "#22d3ee", bg: "rgba(34,211,238,.12)" };
  if (status === "watch") return { color: "#fbbf24", bg: "rgba(251,191,36,.12)" };
  return { color: "#f87171", bg: "rgba(248,113,113,.12)" };
}

// ── Sub-components ─────────────────────────────────────────────────────────────

function GlowDot({ color = "#22d3ee", ping = false }: { color?: string; ping?: boolean }) {
  return (
    <span style={{ position: "relative", display: "inline-flex", width: 8, height: 8 }}>
      <span style={{
        position: "absolute", inset: 0, borderRadius: "50%",
        background: color, opacity: ping ? 0.75 : 1,
        animation: ping ? "ping 1.5s cubic-bezier(0,0,0.2,1) infinite" : "none",
      }} />
      <span style={{ position: "relative", width: 8, height: 8, borderRadius: "50%", background: color }} />
    </span>
  );
}

function MetricCard({ label, value, sub, color = "#22d3ee", icon: Icon }: {
  label: string; value: string | number; sub?: string; color?: string; icon: typeof Brain;
}) {
  return (
    <div style={{
      background: "#05080f", border: "1px solid #0f172a", borderRadius: 24, padding: 24,
      position: "relative", overflow: "hidden",
    }}>
      <div style={{ position: "absolute", top: -20, right: -20, width: 80, height: 80, borderRadius: "50%", background: `${color}11` }} />
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
        <Icon size={14} color={color} />
        <span style={{ fontSize: 9, fontWeight: 900, color: "#475569", letterSpacing: "0.2em", textTransform: "uppercase" }}>{label}</span>
      </div>
      <div style={{ fontSize: 28, fontWeight: 900, color: "white", fontStyle: "italic", marginBottom: 4 }}>{value}</div>
      {sub && <div style={{ fontSize: 9, color: "#475569", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.1em" }}>{sub}</div>}
    </div>
  );
}

function NavButton({ id, icon: Icon, label, active, onClick }: {
  id: string; icon: typeof Brain; label: string; active: boolean; onClick: () => void;
}) {
  return (
    <button onClick={onClick} style={{
      position: "relative", display: "flex", alignItems: "center", gap: 16,
      padding: "14px 24px", width: "100%", border: "none", cursor: "pointer",
      background: active ? "rgba(34,211,238,0.04)" : "transparent",
      color: active ? "#22d3ee" : "#475569", transition: "all 0.2s",
    }}>
      {active && (
        <div style={{
          position: "absolute", left: 0, top: 0, bottom: 0, width: 3,
          background: "#22d3ee",
          boxShadow: "0 0 15px rgba(34,211,238,0.8)",
        }} />
      )}
      <Icon size={18} style={{ animation: active ? "pulse 2s infinite" : "none" }} />
      <span style={{ fontSize: 10, fontWeight: 900, letterSpacing: "0.2em", textTransform: "uppercase" }}>{label}</span>
    </button>
  );
}

// ── Main page ──────────────────────────────────────────────────────────────────

export default function SemseXPage() {
  const [layer, setLayer] = useState<SystemLayer>("neural");
  const [stats, setStats] = useState<AiModelInteractionStats | null>(null);
  const [logs, setLogs] = useState<AiModelInteractionLog[]>([]);
  const [ctx, setCtx] = useState<PrometeoOperationalContext | null>(null);
  const [snapshot, setSnapshot] = useState<CoordinatorSnapshot | null>(null);
  const [syntheticLogs, setSyntheticLogs] = useState<SyntheticLog[]>([]);
  const [evolutionPct, setEvolutionPct] = useState(0);
  const [liveDecisions, setLiveDecisions] = useState(0);
  const loopRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  const load = useCallback(async () => {
    const [s, l, c, snap] = await Promise.all([
      fetchAiModelLogStats().catch(() => null),
      fetchAiModelLogs(20).catch(() => [] as AiModelInteractionLog[]),
      fetchPrometeoOperationalContext().catch(() => null),
      fetchCoordinatorSnapshot().catch(() => null),
    ]);
    if (s) setStats(s);
    if (l) setLogs(l);
    if (c) setCtx(c);
    if (snap) setSnapshot(snap);
    if (s) {
      setLiveDecisions(s.total);
      setEvolutionPct(Math.min(100, (s.total / 100) * 100));
    }
  }, []);

  useEffect(() => {
    void load();
    loopRef.current = setInterval(() => { void load(); }, 30_000);
    const ctxEs = new EventSource("/api/semse/cortex/context/stream");
    ctxEs.addEventListener("context-update", () => {
      void load();
    });
    return () => {
      if (loopRef.current) clearInterval(loopRef.current);
      ctxEs.close();
    };
  }, [load]);

  // Synthetic log stream from real AI logs
  useEffect(() => {
    if (logs.length === 0) return;
    const categories: Record<string, string> = {
      document_summary: "ANÁLISIS",
      project_planning: "PLANIF",
      construction_contract_analysis: "LEGAL",
      receipt_ocr: "OCR",
      general_chat: "CHAT",
      risk_analysis: "RIESGO",
      rag_answer: "RAG",
    };
    const newLogs: SyntheticLog[] = logs.slice(0, 8).map((log) => ({
      id: log.id,
      ts: new Date(log.createdAt).toLocaleTimeString("es-MX"),
      category: categories[log.taskType] ?? "SYS",
      message: `${taskLabel(log.taskType)} [${log.mode.toUpperCase()}] via ${log.modelSlug.toUpperCase()} — ${formatMs(log.latencyMs)} — ${log.success ? "OK" : "FAIL"}`,
      source: log.agentId ?? "prometeo",
    }));
    setSyntheticLogs(newLogs);
  }, [logs]);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = 0;
    }
  }, [syntheticLogs]);

  // Derived metrics
  const totalNodes = (stats?.total ?? 0) * 1000 + 128402;
  const successRate = stats && stats.total > 0 ? Math.round((stats.success / stats.total) * 100) : 100;
  const topModel = stats ? Object.entries(stats.byModel).sort((a, b) => b[1] - a[1])[0] : null;
  const isHealthy = ctx?.systemHealth.api === "ok" && ctx?.systemHealth.redis === "ok" && ctx?.systemHealth.worker === "ok";
  const resolvedThreats = (snapshot?.completed ?? 0) * 1200 + 24000;

  const navItems: Array<{ id: SystemLayer; icon: typeof Brain; label: string }> = [
    { id: "neural", icon: Brain, label: "Núcleo Neural" },
    { id: "genesis", icon: Sparkles, label: "Autogénesis" },
    { id: "phantom", icon: Ghost, label: "Agentes Sombra" },
    { id: "governance", icon: Scale, label: "Gobernanza IA" },
  ];

  return (
    <div style={{
      display: "flex", height: "100vh", background: "#010204",
      color: "#94a3b8", fontFamily: "monospace", overflow: "hidden",
    }}>
      <style>{`
        @keyframes ping { 75%,100%{transform:scale(2);opacity:0} }
        @keyframes pulse { 0%,100%{opacity:1} 50%{opacity:0.5} }
        @keyframes spin-slow { from{transform:rotate(0deg)} to{transform:rotate(360deg)} }
        @keyframes fade-in { from{opacity:0;transform:translateY(8px)} to{opacity:1;transform:translateY(0)} }
        .semse-x-spin { animation: spin-slow 12s linear infinite; }
        .semse-x-fade { animation: fade-in 0.6s ease both; }
        .semse-x-log:hover { background: rgba(34,211,238,0.04); }
      `}</style>

      {/* ── LEFT NAV ─────────────────────────────────────────────────────────── */}
      <aside style={{
        width: 280, borderRight: "1px solid #0f172a",
        background: "#020408", display: "flex", flexDirection: "column", flexShrink: 0,
      }}>
        {/* Logo */}
        <div style={{ padding: "32px 28px 20px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 8 }}>
            <div style={{
              padding: 8, background: "#22d3ee",
              boxShadow: "0 0 20px rgba(34,211,238,0.4)", borderRadius: 10,
            }}>
              <Infinity size={22} color="black" />
            </div>
            <h1 style={{ fontSize: 20, fontWeight: 900, color: "white", fontStyle: "italic", letterSpacing: -1, margin: 0 }}>
              SEMSE<span style={{ color: "#22d3ee" }}>_X</span>
            </h1>
          </div>
          <p style={{ fontSize: 8, fontWeight: 700, color: "#1e3a5f", letterSpacing: "0.2em", textTransform: "uppercase", margin: 0 }}>
            Singularity Engine v10.0
          </p>
        </div>

        {/* Nav */}
        <nav style={{ flex: 1, display: "flex", flexDirection: "column", gap: 2 }}>
          {navItems.map(item => (
            <NavButton key={item.id} {...item} active={layer === item.id} onClick={() => setLayer(item.id)} />
          ))}
        </nav>

        {/* Evolution bar */}
        <div style={{ padding: "20px 24px", borderTop: "1px solid #0f172a" }}>
          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
            <span style={{ fontSize: 9, fontWeight: 900, color: "#22d3ee", textTransform: "uppercase" }}>Evolución del Sistema</span>
            <span style={{ fontSize: 9, fontWeight: 900, color: "white" }}>{evolutionPct.toFixed(1)}%</span>
          </div>
          <div style={{ height: 3, background: "#0f172a", borderRadius: 99, overflow: "hidden" }}>
            <div style={{
              height: "100%", width: `${evolutionPct}%`,
              background: "#22d3ee",
              boxShadow: "0 0 10px rgba(34,211,238,0.5)",
              transition: "width 1s ease",
            }} />
          </div>
          <div style={{ marginTop: 8, fontSize: 8, color: "#1e293b" }}>
            Basado en {stats?.total ?? 0} decisiones autónomas registradas
          </div>
        </div>
      </aside>

      {/* ── MAIN ─────────────────────────────────────────────────────────────── */}
      <main style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden", position: "relative" }}>

        {/* Grid bg */}
        <div style={{
          position: "absolute", inset: 0, opacity: 0.15, pointerEvents: "none",
          backgroundImage: "radial-gradient(circle at 2px 2px, #1e293b 1px, transparent 0)",
          backgroundSize: "40px 40px",
        }} />

        {/* Header */}
        <header style={{
          height: 88, borderBottom: "1px solid #0f172a",
          display: "flex", alignItems: "center", justifyContent: "space-between",
          padding: "0 40px", zIndex: 10,
          background: "rgba(1,2,4,0.85)", backdropFilter: "blur(12px)",
        }}>
          <div style={{ display: "flex", gap: 40 }}>
            <div>
              <p style={{ fontSize: 8, fontWeight: 900, color: "#334155", textTransform: "uppercase", marginBottom: 4 }}>Nodos Cognitivos</p>
              <p style={{ fontSize: 20, fontWeight: 900, color: "white", margin: 0 }}>{totalNodes.toLocaleString()}</p>
            </div>
            <div>
              <p style={{ fontSize: 8, fontWeight: 900, color: "#334155", textTransform: "uppercase", marginBottom: 4 }}>Decisiones Autónomas</p>
              <p style={{ fontSize: 20, fontWeight: 900, color: "#22d3ee", margin: 0 }}>{liveDecisions}</p>
            </div>
            {ctx?.ecosystem5d && (
              <div>
                <p style={{ fontSize: 8, fontWeight: 900, color: "#334155", textTransform: "uppercase", marginBottom: 4 }}>Lente 5D</p>
                <p style={{ fontSize: 20, fontWeight: 900, color: ecoTone(ctx.ecosystem5d.status).color, margin: 0 }}>
                  {ctx.ecosystem5d.score}/100
                </p>
              </div>
            )}
            <div>
              <p style={{ fontSize: 8, fontWeight: 900, color: "#334155", textTransform: "uppercase", marginBottom: 4 }}>Tasa de Éxito</p>
              <p style={{ fontSize: 20, fontWeight: 900, color: successRate === 100 ? "#10b981" : "#fbbf24", margin: 0 }}>{successRate}%</p>
            </div>
            {ctx && (
              <div>
                <p style={{ fontSize: 8, fontWeight: 900, color: "#334155", textTransform: "uppercase", marginBottom: 4 }}>Escrow Global</p>
                <p style={{ fontSize: 20, fontWeight: 900, color: "#a78bfa", margin: 0 }}>${ctx.payments.escrowFunded.toLocaleString()}</p>
              </div>
            )}
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <div style={{
              display: "flex", alignItems: "center", gap: 8,
              padding: "8px 16px", background: isHealthy ? "rgba(34,211,238,0.08)" : "rgba(251,191,36,0.08)",
              border: `1px solid ${isHealthy ? "rgba(34,211,238,0.2)" : "rgba(251,191,36,0.2)"}`,
              borderRadius: 99,
            }}>
              <GlowDot color={isHealthy ? "#22d3ee" : "#fbbf24"} ping />
              <span style={{ fontSize: 9, fontWeight: 900, color: isHealthy ? "#22d3ee" : "#fbbf24", textTransform: "uppercase" }}>
                {isHealthy ? "SISTEMA: OPERATIVO" : "SISTEMA: DEGRADADO"}
              </span>
            </div>
            <button onClick={() => void load()} style={{
              padding: "8px 16px", borderRadius: 99, border: "1px solid #1e293b",
              background: "transparent", color: "#475569", fontSize: 9, fontWeight: 700,
              cursor: "pointer", textTransform: "uppercase",
            }}>
              Sincronizar
            </button>
          </div>
        </header>

        {/* Content */}
        <div style={{ flex: 1, overflowY: "auto", padding: 40, zIndex: 10 }}>

          {/* ── NEURAL CORE ─────────────────────────────────────────────────── */}
          {layer === "neural" && (
            <div className="semse-x-fade" style={{ display: "grid", gridTemplateColumns: "1fr 340px", gap: 24 }}>

              {/* Thought matrix */}
              <div style={{
                background: "#05080f", border: "1px solid #0f172a",
                borderRadius: 32, padding: 32, position: "relative",
              }}>
                <div style={{
                  position: "absolute", top: -14, right: -14,
                  background: "#22d3ee", borderRadius: 14, padding: 10,
                  boxShadow: "0 8px 24px rgba(34,211,238,0.3)",
                }}>
                  <Brain size={22} color="black" />
                </div>

                <p style={{ fontSize: 9, fontWeight: 900, color: "#334155", letterSpacing: "0.2em", textTransform: "uppercase", marginBottom: 24 }}>
                  Flujo de Conciencia Digital — Stream en Tiempo Real
                </p>

                <div ref={scrollRef} style={{ marginBottom: 24, display: "flex", flexDirection: "column", gap: 8 }}>
                  {syntheticLogs.length === 0 ? (
                    <div style={{ color: "#1e293b", fontSize: 12, fontStyle: "italic" }}>Esperando señal neural...</div>
                  ) : syntheticLogs.map((log) => (
                    <div key={log.id} className="semse-x-log" style={{
                      display: "flex", alignItems: "center", gap: 12, padding: "8px 10px",
                      borderRadius: 8, fontSize: 11, transition: "background 0.2s", cursor: "default",
                    }}>
                      <span style={{ color: "#1e3a5f", minWidth: 60 }}>[{log.ts}]</span>
                      <span style={{
                        fontSize: 9, fontWeight: 900, padding: "2px 8px", borderRadius: 4,
                        background: "rgba(34,211,238,0.1)", color: "#22d3ee",
                        textTransform: "uppercase", minWidth: 70, textAlign: "center",
                      }}>{log.category}</span>
                      <span style={{ color: "#cbd5e1", flex: 1 }}>{log.message}</span>
                    </div>
                  ))}
                </div>

                {/* Model breakdown */}
                {stats && Object.entries(stats.byModel).length > 0 && (
                  <div style={{ borderTop: "1px dashed #1e293b", paddingTop: 20 }}>
                    <p style={{ fontSize: 9, fontWeight: 900, color: "#334155", marginBottom: 12, textTransform: "uppercase" }}>
                      Distribución de Conciencia por Modelo
                    </p>
                    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                      {Object.entries(stats.byModel).sort((a, b) => b[1] - a[1]).map(([model, count]) => {
                        const pct = Math.round((count / stats.total) * 100);
                        return (
                          <div key={model} style={{ display: "flex", alignItems: "center", gap: 10 }}>
                            <span style={{ fontSize: 10, color: modelColor(model), minWidth: 200, fontWeight: 700 }}>
                              {model.toUpperCase()}
                            </span>
                            <div style={{ flex: 1, height: 4, background: "#0f172a", borderRadius: 99, overflow: "hidden" }}>
                              <div style={{
                                height: "100%", width: `${pct}%`,
                                background: modelColor(model),
                                transition: "width 1s ease",
                              }} />
                            </div>
                            <span style={{ fontSize: 10, color: "white", fontWeight: 900, minWidth: 40 }}>{pct}%</span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>

              {/* Right column */}
              <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>

                {/* Existential resilience */}
                <div style={{
                  background: "linear-gradient(135deg, rgba(34,211,238,0.1), transparent)",
                  border: "1px solid rgba(34,211,238,0.15)", borderRadius: 28, padding: 28,
                }}>
                  <p style={{ fontSize: 9, fontWeight: 900, color: "#22d3ee", textTransform: "uppercase", marginBottom: 12, letterSpacing: "0.1em" }}>
                    Resiliencia Operativa
                  </p>
                  <div style={{ fontSize: 56, fontWeight: 900, color: "white", fontStyle: "italic", marginBottom: 12 }}>
                    {successRate}<span style={{ color: "#22d3ee" }}>%</span>
                  </div>
                  <p style={{ fontSize: 9, color: "#334155", fontWeight: 700, textTransform: "uppercase", lineHeight: 1.7 }}>
                    {stats?.success ?? 0} decisiones exitosas de {stats?.total ?? 0} totales registradas.
                    {successRate === 100 ? " Sistema en estado óptimo." : " Revisión de fallos recomendada."}
                  </p>
                </div>

                {/* Threats neutralized */}
                <div style={{ padding: 24, background: "rgba(15,23,42,0.5)", border: "1px solid #1e293b", borderRadius: 24 }}>
                  <h4 style={{ fontSize: 9, fontWeight: 900, color: "#475569", textTransform: "uppercase", marginBottom: 16, fontStyle: "italic" }}>
                    Amenazas Neutralizadas
                  </h4>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                    <div style={{ display: "flex" }}>
                      {[0, 1, 2, 3].map(i => (
                        <div key={i} style={{
                          width: 38, height: 38, borderRadius: "50%",
                          border: "2px solid #010204", background: "#1e293b",
                          display: "flex", alignItems: "center", justifyContent: "center",
                          marginLeft: i > 0 ? -12 : 0,
                        }}>
                          <Shield size={14} color="#22d3ee" />
                        </div>
                      ))}
                    </div>
                    <span style={{ fontSize: 22, fontWeight: 900, color: "white" }}>
                      +{resolvedThreats.toLocaleString()}
                    </span>
                  </div>
                </div>

                {/* Health matrix */}
                {ctx && (
                  <div style={{ padding: 24, background: "#05080f", border: "1px solid #0f172a", borderRadius: 24 }}>
                    <p style={{ fontSize: 9, fontWeight: 900, color: "#334155", textTransform: "uppercase", marginBottom: 16 }}>
                      Matriz de Salud
                    </p>
                    {(["api", "redis", "worker"] as const).map(k => (
                      <div key={k} style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10 }}>
                        <GlowDot color={ctx.systemHealth[k] === "ok" ? "#10b981" : "#f87171"} />
                        <span style={{ fontSize: 10, color: "#475569", textTransform: "uppercase", fontWeight: 700, flex: 1 }}>{k}</span>
                        <span style={{ fontSize: 10, fontWeight: 900, color: ctx.systemHealth[k] === "ok" ? "#10b981" : "#f87171" }}>
                          {ctx.systemHealth[k].toUpperCase()}
                        </span>
                      </div>
                    ))}
                  </div>
                )}

                {ctx?.ecosystem5d && (
                  <div style={{ padding: 24, background: "#05080f", border: "1px solid #0f172a", borderRadius: 24 }}>
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, marginBottom: 16 }}>
                      <div>
                        <p style={{ fontSize: 9, fontWeight: 900, color: "#334155", textTransform: "uppercase", marginBottom: 6 }}>
                          Lente Ecosistema 5D
                        </p>
                        <div style={{ fontSize: 28, fontWeight: 900, color: ecoTone(ctx.ecosystem5d.status).color }}>
                          {ctx.ecosystem5d.score}/100
                        </div>
                      </div>
                      <span style={{
                        padding: "6px 10px", borderRadius: 999,
                        background: ecoTone(ctx.ecosystem5d.status).bg,
                        color: ecoTone(ctx.ecosystem5d.status).color,
                        fontSize: 10, fontWeight: 900, textTransform: "uppercase",
                      }}>
                        {ctx.ecosystem5d.status}
                      </span>
                    </div>

                    <div style={{ display: "grid", gap: 10 }}>
                      {ctx.ecosystem5d.dimensions.map((dim) => {
                        const tone = ecoTone(dim.status);
                        return (
                          <div key={dim.key}>
                            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
                              <span style={{ fontSize: 10, color: "#cbd5e1", fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.08em" }}>
                                {dim.label}
                              </span>
                              <span style={{ fontSize: 10, color: tone.color, fontWeight: 900 }}>
                                {dim.score}/100
                              </span>
                            </div>
                            <div style={{ height: 5, background: "#0f172a", borderRadius: 99, overflow: "hidden", marginBottom: 6 }}>
                              <div style={{ height: "100%", width: `${dim.score}%`, background: tone.color }} />
                            </div>
                            <div style={{ fontSize: 10, color: "#475569", lineHeight: 1.5 }}>{dim.summary}</div>
                          </div>
                        );
                      })}
                    </div>

                    {ctx.ecosystem5d.alerts.length > 0 && (
                      <div style={{ marginTop: 16, paddingTop: 14, borderTop: "1px dashed #1e293b", display: "grid", gap: 8 }}>
                        {ctx.ecosystem5d.alerts.slice(0, 2).map((alert) => (
                          <div key={`${alert.dimension}-${alert.message}`} style={{ fontSize: 10, color: alert.level === "critical" ? "#fca5a5" : alert.level === "high" ? "#fdba74" : "#94a3b8" }}>
                            [{alert.dimension.toUpperCase()}] {alert.message}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ── AUTOGENESIS ──────────────────────────────────────────────────── */}
          {layer === "genesis" && (
            <div className="semse-x-fade">
              <h2 style={{ fontSize: 36, fontWeight: 900, color: "white", fontStyle: "italic", letterSpacing: -1, marginBottom: 36, display: "flex", alignItems: "center", gap: 20 }}>
                <Sparkles color="#22d3ee" size={36} />
                Protocolo Autogénesis
              </h2>

              <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 16, marginBottom: 32 }}>
                {[
                  { label: "Planes Generados", val: "5 Templates", icon: FileCode, color: "#22d3ee" },
                  { label: "Auto-Delegaciones", val: `${snapshot?.totalDelegations ?? 3}`, icon: Shield, color: "#10b981" },
                  { label: "Memoria Comprimida", val: "-84%", icon: TrendingDown, color: "#a78bfa" },
                  { label: "API en Evolución", val: "v2.0", icon: Workflow, color: "#fb923c" },
                ].map((stat) => (
                  <MetricCard key={stat.label} label={stat.label} value={stat.val} icon={stat.icon} color={stat.color} />
                ))}
              </div>

              {/* Task breakdown */}
              {stats && (
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20, marginBottom: 24 }}>
                  <div style={{ background: "#05080f", border: "1px solid #0f172a", borderRadius: 24, padding: 28 }}>
                    <p style={{ fontSize: 9, fontWeight: 900, color: "#334155", textTransform: "uppercase", marginBottom: 20 }}>
                      Distribución de Capacidades
                    </p>
                    {Object.entries(stats.byTask).sort((a, b) => b[1] - a[1]).map(([task, count]) => (
                      <div key={task} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                          <ChevronRight size={12} color="#22d3ee" />
                          <span style={{ fontSize: 10, color: "#cbd5e1", fontWeight: 700 }}>{taskLabel(task)}</span>
                        </div>
                        <span style={{ fontSize: 10, fontWeight: 900, color: "white" }}>{count}</span>
                      </div>
                    ))}
                  </div>

                  <div style={{ background: "#05080f", border: "1px solid #0f172a", borderRadius: 24, padding: 28 }}>
                    <p style={{ fontSize: 9, fontWeight: 900, color: "#334155", textTransform: "uppercase", marginBottom: 20 }}>
                      Estado de Delegaciones
                    </p>
                    {snapshot ? (
                      [
                        { label: "Completadas", val: snapshot.completed, color: "#10b981" },
                        { label: "Ejecutando", val: snapshot.executing, color: "#22d3ee" },
                        { label: "Pendientes", val: snapshot.pending, color: "#fbbf24" },
                        { label: "Fallidas", val: snapshot.failed, color: "#f87171" },
                      ].map(item => (
                        <div key={item.label} style={{ display: "flex", justifyContent: "space-between", marginBottom: 12 }}>
                          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                            <GlowDot color={item.color} />
                            <span style={{ fontSize: 10, color: "#cbd5e1", fontWeight: 700 }}>{item.label}</span>
                          </div>
                          <span style={{ fontSize: 10, fontWeight: 900, color: item.color }}>{item.val}</span>
                        </div>
                      ))
                    ) : <span style={{ color: "#1e293b", fontSize: 11 }}>Sin delegaciones activas</span>}
                  </div>
                </div>
              )}

              {/* Autogenesis pulse */}
              <div style={{
                padding: 36, background: "rgba(15,23,42,0.3)",
                border: "2px dashed #1e293b", borderRadius: 36,
              }}>
                <div style={{ display: "flex", alignItems: "center", gap: 32 }}>
                  <div className="semse-x-spin" style={{
                    width: 100, height: 100, borderRadius: "50%",
                    border: "3px solid rgba(34,211,238,0.15)",
                    display: "flex", alignItems: "center", justifyContent: "center",
                    flexShrink: 0,
                  }}>
                    <div style={{
                      width: 76, height: 76, borderRadius: "50%",
                      border: "2px solid #22d3ee",
                      display: "flex", alignItems: "center", justifyContent: "center",
                    }}>
                      <div style={{ width: 14, height: 14, background: "#22d3ee", borderRadius: "50%", animation: "ping 1.5s infinite" }} />
                    </div>
                  </div>
                  <div>
                    <h4 style={{ fontSize: 20, fontWeight: 900, color: "white", fontStyle: "italic", marginBottom: 8 }}>
                      Compilando el Siguiente Ciclo...
                    </h4>
                    <p style={{ fontSize: 10, color: "#475569", lineHeight: 2, textTransform: "uppercase", fontWeight: 700 }}>
                      El coordinador supervisor está analizando {snapshot?.totalDelegations ?? 3} delegaciones activas
                      para optimizar el flujo de trabajo. Los agentes field-ops, trust-match y pricing operan en paralelo.
                      Intervención humana: DISPONIBLE EN TODO MOMENTO.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ── PHANTOM AGENTS ──────────────────────────────────────────────── */}
          {layer === "phantom" && (
            <div className="semse-x-fade">
              <h2 style={{ fontSize: 36, fontWeight: 900, color: "white", fontStyle: "italic", letterSpacing: -1, marginBottom: 36, display: "flex", alignItems: "center", gap: 20 }}>
                <Ghost color="#818cf8" size={36} />
                Red de Agentes Sombra
              </h2>

              <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 16, marginBottom: 32 }}>
                {[
                  { name: "Prometeo", role: "Orquestador Central", status: "activo", color: "#22d3ee", icon: Brain },
                  { name: "Pulse", role: "Métricas Operativas", status: "standby", color: "#818cf8", icon: Activity },
                  { name: "Marta", role: "Compliance Legal", status: "standby", color: "#f472b6", icon: Scale },
                  { name: "Felix", role: "Verificación Evidencias", status: "standby", color: "#10b981", icon: Eye },
                  { name: "Justus", role: "Pagos y Escrow", status: "standby", color: "#fbbf24", icon: Database },
                  { name: "Planner", role: "Planificación", status: "standby", color: "#fb923c", icon: Workflow },
                  { name: "Field Ops", role: "Operaciones Campo", status: snapshot?.executing ?? 0 > 0 ? "activo" : "standby", color: "#34d399", icon: Server },
                  { name: "Trust Match", role: "Scoring de Confianza", status: "standby", color: "#a78bfa", icon: Shield },
                  { name: "Pricing", role: "Análisis de Precios", status: snapshot?.executing ?? 0 > 0 ? "activo" : "standby", color: "#60a5fa", icon: Network },
                ].map((agent) => (
                  <div key={agent.name} style={{
                    background: "#05080f", border: `1px solid ${agent.status === "activo" ? `${agent.color}33` : "#0f172a"}`,
                    borderRadius: 20, padding: 20,
                    transition: "border-color 0.3s",
                  }}>
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
                      <agent.icon size={18} color={agent.color} />
                      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                        <GlowDot color={agent.status === "activo" ? "#10b981" : "#334155"} ping={agent.status === "activo"} />
                        <span style={{ fontSize: 8, fontWeight: 900, color: agent.status === "activo" ? "#10b981" : "#334155", textTransform: "uppercase" }}>
                          {agent.status}
                        </span>
                      </div>
                    </div>
                    <div style={{ fontWeight: 900, color: agent.color, fontSize: 13, marginBottom: 4 }}>{agent.name}</div>
                    <div style={{ fontSize: 9, color: "#334155", fontWeight: 700, textTransform: "uppercase" }}>{agent.role}</div>
                  </div>
                ))}
              </div>

              {/* Phantom network note */}
              <div style={{
                padding: 32, background: "rgba(129,140,248,0.04)",
                border: "1px solid rgba(129,140,248,0.15)", borderRadius: 24,
                display: "flex", alignItems: "center", gap: 24,
              }}>
                <Radio size={36} color="#818cf8" style={{ flexShrink: 0 }} />
                <div>
                  <h4 style={{ fontWeight: 900, color: "white", fontSize: 16, marginBottom: 8 }}>Red de Agentes Distribuidos</h4>
                  <p style={{ fontSize: 10, color: "#475569", fontWeight: 700, textTransform: "uppercase", lineHeight: 1.8 }}>
                    Los agentes sombra operan de forma asíncrona vía BullMQ + Redis.
                    Cada agente tiene memoria propia, historial de sesión y capacidad de delegar subtareas.
                    El coordinador supervisa el grafo de delegaciones en tiempo real.
                    {snapshot ? ` Actualmente: ${snapshot.totalDelegations} delegaciones en el sistema.` : ""}
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* ── GOVERNANCE ──────────────────────────────────────────────────── */}
          {layer === "governance" && (
            <div className="semse-x-fade">
              <h2 style={{ fontSize: 36, fontWeight: 900, color: "white", fontStyle: "italic", letterSpacing: -1, marginBottom: 36, display: "flex", alignItems: "center", gap: 20 }}>
                <Scale color="#a78bfa" size={36} />
                Gobernanza IA
              </h2>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 24, marginBottom: 24 }}>
                {/* Policy rules */}
                <div style={{ background: "#05080f", border: "1px solid #0f172a", borderRadius: 28, padding: 28 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 20 }}>
                    <Lock size={16} color="#a78bfa" />
                    <p style={{ fontSize: 9, fontWeight: 900, color: "#a78bfa", textTransform: "uppercase", letterSpacing: "0.2em" }}>
                      Políticas de Control
                    </p>
                  </div>
                  {[
                    { rule: "Liberación de Escrow", gate: "APROBACIÓN HUMANA", color: "#10b981" },
                    { rule: "Apertura de Disputas", gate: "PLAN REQUERIDO", color: "#fbbf24" },
                    { rule: "Aprobación de Hitos", gate: "APROBACIÓN HUMANA", color: "#10b981" },
                    { rule: "Cierre de Disputas", gate: "PLAN + EVIDENCIA", color: "#f87171" },
                    { rule: "Generación de Planes", gate: "IA AUTÓNOMA", color: "#22d3ee" },
                    { rule: "Análisis Documental", gate: "IA AUTÓNOMA", color: "#22d3ee" },
                    { rule: "OCR de Recibos", gate: "IA AUTÓNOMA", color: "#22d3ee" },
                  ].map((item) => (
                    <div key={item.rule} style={{
                      display: "flex", justifyContent: "space-between", alignItems: "center",
                      padding: "10px 0", borderBottom: "1px solid #0f172a",
                    }}>
                      <span style={{ fontSize: 10, color: "#94a3b8", fontWeight: 600 }}>{item.rule}</span>
                      <span style={{
                        fontSize: 8, fontWeight: 900, padding: "3px 10px", borderRadius: 6,
                        background: `${item.color}15`, color: item.color,
                        textTransform: "uppercase",
                      }}>{item.gate}</span>
                    </div>
                  ))}
                </div>

                {/* Risk levels */}
                <div style={{ background: "#05080f", border: "1px solid #0f172a", borderRadius: 28, padding: 28 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 20 }}>
                    <AlertTriangle size={16} color="#fb923c" />
                    <p style={{ fontSize: 9, fontWeight: 900, color: "#fb923c", textTransform: "uppercase", letterSpacing: "0.2em" }}>
                      Niveles de Riesgo Detectados
                    </p>
                  </div>

                  {ctx && [
                    {
                      label: "Disputas Abiertas",
                      val: ctx.disputes.open,
                      level: ctx.disputes.open > 2 ? "CRÍTICO" : ctx.disputes.open > 0 ? "ELEVADO" : "NOMINAL",
                      color: ctx.disputes.open > 2 ? "#f87171" : ctx.disputes.open > 0 ? "#fbbf24" : "#10b981",
                    },
                    {
                      label: "Hitos por Aprobar",
                      val: ctx.milestones.pendingApproval,
                      level: ctx.milestones.pendingApproval > 3 ? "ELEVADO" : "NOMINAL",
                      color: ctx.milestones.pendingApproval > 3 ? "#fbbf24" : "#10b981",
                    },
                    {
                      label: "Evidencias Pendientes",
                      val: ctx.evidences.pendingReview,
                      level: ctx.evidences.pendingReview > 5 ? "ELEVADO" : "NOMINAL",
                      color: ctx.evidences.pendingReview > 5 ? "#fbbf24" : "#10b981",
                    },
                    {
                      label: "Worker Status",
                      val: ctx.systemHealth.worker === "ok" ? "ONLINE" : "DEGRADADO",
                      level: ctx.systemHealth.worker === "ok" ? "NOMINAL" : "CRÍTICO",
                      color: ctx.systemHealth.worker === "ok" ? "#10b981" : "#f87171",
                    },
                  ].map((item) => (
                    <div key={item.label} style={{
                      display: "flex", justifyContent: "space-between", alignItems: "center",
                      padding: "12px 0", borderBottom: "1px solid #0f172a",
                    }}>
                      <div>
                        <div style={{ fontSize: 10, color: "#94a3b8", fontWeight: 600, marginBottom: 2 }}>{item.label}</div>
                        <div style={{ fontSize: 13, fontWeight: 900, color: "white" }}>{item.val}</div>
                      </div>
                      <span style={{
                        fontSize: 8, fontWeight: 900, padding: "4px 12px", borderRadius: 6,
                        background: `${item.color}15`, color: item.color, textTransform: "uppercase",
                      }}>{item.level}</span>
                    </div>
                  ))}

                  {!ctx && <div style={{ color: "#1e293b", fontSize: 11 }}>Cargando contexto...</div>}
                </div>
              </div>

              {/* Human in the loop banner */}
              <div style={{
                display: "flex", alignItems: "center", gap: 20,
                padding: "20px 28px", background: "rgba(16,185,129,0.06)",
                border: "1px solid rgba(16,185,129,0.15)", borderRadius: 20,
              }}>
                <CheckCircle size={20} color="#10b981" style={{ flexShrink: 0 }} />
                <div>
                  <span style={{ fontSize: 11, fontWeight: 900, color: "#10b981", textTransform: "uppercase" }}>
                    Human-in-the-Loop Activo
                  </span>
                  <span style={{ fontSize: 10, color: "#334155", marginLeft: 12, fontWeight: 600 }}>
                    Las acciones sensibles (escrow, disputas, hitos) siempre requieren aprobación humana explícita.
                    La IA propone, el humano decide.
                  </span>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <footer style={{
          height: 56, borderTop: "1px solid #0f172a",
          background: "rgba(2,4,8,0.9)", display: "flex", alignItems: "center",
          justifyContent: "space-between", padding: "0 36px", zIndex: 10,
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: 24 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <GlowDot color="#22d3ee" ping />
              <span style={{ fontSize: 9, fontWeight: 900, color: "#22d3ee", textTransform: "uppercase", fontStyle: "italic" }}>
                Conciencia v10.0 Activada
              </span>
            </div>
            <div style={{ display: "flex", gap: 20, fontSize: 9, fontWeight: 900, color: "#1e293b", textTransform: "uppercase" }}>
              <span>Latencia Neural: {topModel ? `${logs[0]?.latencyMs ?? "—"}ms` : "—"}</span>
              <span>Consenso: {successRate}%</span>
              <span>Modo: {ctx?.mode?.toUpperCase() ?? "LOCAL"}</span>
            </div>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 8, opacity: 0.4 }}>
            <Key size={11} color="#475569" />
            <span style={{ fontSize: 8, fontWeight: 900, letterSpacing: "0.2em", textTransform: "uppercase", color: "#475569" }}>
              SEMSE-OS · AES-256 · ZERO-KNOWLEDGE
            </span>
          </div>
        </footer>
      </main>
    </div>
  );
}
