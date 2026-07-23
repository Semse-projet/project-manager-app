"use client";

import { useCallback, useEffect, useState } from "react";
import {
  Activity, ArrowRight, Bot, Brain, Briefcase, CheckCircle2,
  Clock, DollarSign, Eye, RefreshCw, Shield, TrendingUp, Zap,
} from "lucide-react";
import { AdminPageHeader } from "../../../components/admin/AdminPageHeader";

// ── Types ─────────────────────────────────────────────────────────────────────

type EcosystemMetrics = {
  generatedAt: string;
  jobs:        { total: number; published: number; inProgress: number; completed: number; byCategory: Record<string, number> };
  bids:        { total: number; submitted: number; accepted: number; conversionRate: number };
  milestones:  { total: number; approved: number; pending: number; completionRate: number };
  evidence:    { total: number; approved: number; missing: number; rejected: number; completionRate: number };
  agents:      { active: number; totalMessages: number; totalErrors: number; byAgent: Array<{ name: string; active: boolean; messages: number; errors: number }> };
  rag:         { documents: number; chunks: number; retrievalMode: string };
  signals:     { open: number; critical: number; high: number };
};

// ── Helpers ───────────────────────────────────────────────────────────────────

function RingProgress({ value, size = 56, color = "#818cf8" }: { value: number; size?: number; color?: string }) {
  const r = (size - 8) / 2;
  const circ = 2 * Math.PI * r;
  const fill = circ - (value / 100) * circ;
  return (
    <svg width={size} height={size} style={{ flexShrink: 0 }}>
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="rgba(255,255,255,.08)" strokeWidth={6} />
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={color} strokeWidth={6}
        strokeDasharray={circ} strokeDashoffset={fill} strokeLinecap="round"
        transform={`rotate(-90 ${size / 2} ${size / 2})`} style={{ transition: "stroke-dashoffset .6s ease" }} />
      <text x={size / 2} y={size / 2 + 5} textAnchor="middle" fill={color} fontSize={13} fontWeight={800}>{value}%</text>
    </svg>
  );
}

function MetricCard({ label, value, sub, icon: Icon, color, ring }: {
  label: string; value: string | number; sub?: string;
  icon: typeof Briefcase; color: string; ring?: number;
}) {
  return (
    <div style={{ padding: "14px 16px", background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 14, display: "flex", alignItems: "center", gap: 12 }}>
      {ring !== undefined ? (
        <RingProgress value={ring} color={color} />
      ) : (
        <div style={{ width: 44, height: 44, borderRadius: 12, background: `${color}15`, display: "grid", placeItems: "center", flexShrink: 0 }}>
          <Icon size={18} color={color} />
        </div>
      )}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 10, color: "var(--muted)", fontWeight: 700 }}>{label}</div>
        <div style={{ fontSize: 22, fontWeight: 900, color }}>{value}</div>
        {sub && <div style={{ fontSize: 10, color: "var(--muted)", marginTop: 2 }}>{sub}</div>}
      </div>
    </div>
  );
}

// ── Flow diagram (simplified) ─────────────────────────────────────────────────

function FlowDiagram({ data }: { data: EcosystemMetrics }) {
  const steps = [
    { label: "Jobs",        value: data.jobs.total,         active: data.jobs.published,  color: "#818cf8", icon: Briefcase },
    { label: "Bids",        value: data.bids.total,         active: data.bids.submitted,  color: "#67e8f9", icon: DollarSign },
    { label: "Milestones",  value: data.milestones.total,   active: data.milestones.pending, color: "#fcd34d", icon: Activity },
    { label: "Evidencia",   value: data.evidence.total,     active: data.evidence.missing,   color: "#fb923c", icon: Eye },
    { label: "Completados", value: data.milestones.approved, active: data.milestones.approved, color: "#86efac", icon: CheckCircle2 },
  ];
  return (
    <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 16, padding: "18px 20px" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 16 }}>
        <TrendingUp size={15} color="#818cf8" />
        <h2 style={{ margin: 0, fontSize: 14, fontWeight: 800 }}>Flujo del ecosistema</h2>
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
        {steps.map((step, i) => (
          <div key={step.label} style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <div style={{ textAlign: "center" }}>
              <div style={{ width: 52, height: 52, borderRadius: 14, background: `${step.color}15`, border: `2px solid ${step.color}30`, display: "grid", placeItems: "center", margin: "0 auto 6px" }}>
                <step.icon size={20} color={step.color} />
              </div>
              <div style={{ fontSize: 10, fontWeight: 800, color: step.color }}>{step.value}</div>
              <div style={{ fontSize: 9, color: "var(--muted)", marginTop: 2 }}>{step.label}</div>
              <div style={{ fontSize: 9, color: "var(--muted)" }}>({step.active} activos)</div>
            </div>
            {i < steps.length - 1 && <ArrowRight size={14} color="var(--muted)" style={{ flexShrink: 0 }} />}
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function EcosystemPage() {
  const [data,    setData]    = useState<EcosystemMetrics | null>(null);
  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState<string | null>(null);
  const [lastAt,  setLastAt]  = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const res = await fetch("/api/semse/ops/ecosystem-metrics");
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json() as { data: EcosystemMetrics };
      setData(json.data ?? null);
      setLastAt(new Date().toLocaleTimeString("es-MX"));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error");
    } finally { setLoading(false); }
  }, []);

  useEffect(() => {
    void load();
    const t = setInterval(() => void load(), 30_000);
    return () => clearInterval(t);
  }, [load]);

  const topCategory = data ? Object.entries(data.jobs.byCategory).sort(([, a], [, b]) => b - a)[0] : null;

  return (
    <div style={{ maxWidth: 1100, margin: "0 auto", padding: "28px 20px", color: "var(--ink)" }}>
      <AdminPageHeader
        title="Ecosystem Metrics"
        subtitle={`Estado operativo completo del ecosistema SEMSE OS · ${lastAt ?? "cargando…"}`}
        icon={Zap}
        iconColor="#818cf8"
        iconBg="rgba(99,102,241,.15)"
        showBack={false}
        actions={
          <button onClick={load} disabled={loading}
            style={{ padding: "8px 14px", borderRadius: 10, background: "rgba(255,255,255,.05)", border: "1px solid var(--border)", cursor: "pointer", color: "var(--muted)" }}>
            <RefreshCw size={12} style={{ animation: loading ? "spin 1s linear infinite" : "none" }} />
          </button>
        }
      />

      {error && (
        <div style={{ padding: "10px 14px", background: "rgba(239,68,68,.1)", borderRadius: 10, fontSize: 12, color: "#fca5a5", marginBottom: 20 }}>{error}</div>
      )}

      {data && (
        <div style={{ display: "grid", gap: 20 }}>
          {/* Flow diagram */}
          <FlowDiagram data={data} />

          {/* Top metrics grid */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12 }}>
            <MetricCard label="Jobs publicados"    value={data.jobs.published}    sub={`${data.jobs.total} total`}          icon={Briefcase}    color="#818cf8" />
            <MetricCard label="Bids aceptados"     value={data.bids.accepted}     sub={`${data.bids.conversionRate}% conv.`} icon={DollarSign}   color="#86efac" />
            <MetricCard label="Evidencia OK"       value={data.evidence.approved} sub={`${data.evidence.missing} faltante`}  icon={Eye}          color="#67e8f9" ring={data.evidence.completionRate} />
            <MetricCard label="Milestones aprob."  value={data.milestones.approved} sub={`${data.milestones.completionRate}% completados`} icon={CheckCircle2} color="#fcd34d" ring={data.milestones.completionRate} />
          </div>

          {/* Second row */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12 }}>
            <MetricCard label="Señales abiertas"   value={data.signals.open}         sub={`${data.signals.critical} críticas`}   icon={Shield}       color={data.signals.critical > 0 ? "#fca5a5" : "#86efac"} />
            <MetricCard label="RAG documentos"     value={data.rag.documents}        sub={`${data.rag.chunks} chunks · ${data.rag.retrievalMode}`} icon={Brain} color="#c084fc" />
            <MetricCard label="Agentes activos"    value={`${data.agents.active}/6`} sub={`${data.agents.totalMessages} msgs`}   icon={Bot}          color="#67e8f9" />
            <MetricCard label="Top trade"          value={topCategory?.[0] ?? "—"}   sub={`${topCategory?.[1] ?? 0} publicados`}  icon={Activity}     color="#fb923c" />
          </div>

          {/* Trade distribution */}
          {Object.keys(data.jobs.byCategory).length > 0 && (
            <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 16, padding: "18px 20px" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 14 }}>
                <Briefcase size={14} color="#818cf8" />
                <h2 style={{ margin: 0, fontSize: 14, fontWeight: 800 }}>Distribución por trade</h2>
                <span style={{ marginLeft: "auto", fontSize: 11, color: "var(--muted)" }}>{data.jobs.published} trabajos publicados</span>
              </div>
              <div style={{ display: "grid", gap: 8 }}>
                {Object.entries(data.jobs.byCategory).sort(([, a], [, b]) => b - a).map(([cat, count]) => {
                  const pct = data.jobs.published > 0 ? Math.round((count / data.jobs.published) * 100) : 0;
                  return (
                    <div key={cat} style={{ display: "grid", gridTemplateColumns: "120px 1fr auto", gap: 10, alignItems: "center" }}>
                      <span style={{ fontSize: 12, color: "var(--ink)", textTransform: "capitalize" }}>{cat}</span>
                      <div style={{ height: 6, background: "rgba(255,255,255,.08)", borderRadius: 99, overflow: "hidden" }}>
                        <div style={{ width: `${pct}%`, height: "100%", background: "#818cf8", borderRadius: 99, transition: "width .5s" }} />
                      </div>
                      <span style={{ fontSize: 11, fontWeight: 700, color: "#818cf8" }}>{count}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Agents detail */}
          {data.agents.byAgent.length > 0 && (
            <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 16, padding: "18px 20px" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 14 }}>
                <Bot size={14} color="#67e8f9" />
                <h2 style={{ margin: 0, fontSize: 14, fontWeight: 800 }}>SEMSE Agents — actividad</h2>
                <span style={{ marginLeft: "auto", fontSize: 11, color: "var(--muted)" }}>{data.agents.totalMessages} msgs · {data.agents.totalErrors} errores</span>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 10 }}>
                {data.agents.byAgent.map((agent) => (
                  <div key={agent.name} style={{ padding: "10px 12px", background: "rgba(255,255,255,.03)", borderRadius: 10, border: `1px solid ${agent.active ? "rgba(103,232,249,.2)" : "var(--border)"}` }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 6 }}>
                      <span style={{ width: 6, height: 6, borderRadius: "50%", background: agent.active ? "#86efac" : "#475569" }} />
                      <span style={{ fontSize: 12, fontWeight: 700, textTransform: "capitalize", color: "var(--ink)" }}>{agent.name}</span>
                    </div>
                    <div style={{ display: "flex", gap: 12, fontSize: 10, color: "var(--muted)" }}>
                      <span>✉ {agent.messages}</span>
                      {agent.errors > 0 && <span style={{ color: "#fca5a5" }}>✗ {agent.errors}</span>}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Evidence detail */}
          {data.evidence.total > 0 && (
            <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 16, padding: "18px 20px" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 14 }}>
                <Eye size={14} color="#fb923c" />
                <h2 style={{ margin: 0, fontSize: 14, fontWeight: 800 }}>Evidencia</h2>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 10 }}>
                {[
                  { label: "Aprobada",  value: data.evidence.approved, color: "#86efac" },
                  { label: "Faltante",  value: data.evidence.missing,  color: "#fcd34d" },
                  { label: "Rechazada", value: data.evidence.rejected,  color: "#fca5a5" },
                  { label: "Total",     value: data.evidence.total,     color: "#94a3b8" },
                ].map(({ label, value, color }) => (
                  <div key={label} style={{ padding: "12px 14px", background: `${color}08`, borderRadius: 10, border: `1px solid ${color}25`, textAlign: "center" }}>
                    <div style={{ fontSize: 22, fontWeight: 900, color }}>{value}</div>
                    <div style={{ fontSize: 10, color: "var(--muted)", marginTop: 3 }}>{label}</div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Timestamp */}
          <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 10, color: "var(--muted)" }}>
            <Clock size={10} />
            Métricas generadas: {new Date(data.generatedAt).toLocaleString("es-MX")} · Auto-refresh cada 30s
          </div>
        </div>
      )}

      <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
