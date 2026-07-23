"use client";

import { useCallback, useEffect, useState } from "react";
import {
  Activity, CheckCircle2, Clock, Cpu, RefreshCw,
  AlertTriangle, Layers, XCircle, Zap,
} from "lucide-react";
import { AdminPageHeader } from "../../../components/admin/AdminPageHeader";

// ── Types ─────────────────────────────────────────────────────────────────────

type QueueMetrics = {
  connected: boolean; queueName: string;
  waiting: number; active: number; completed: number; failed: number; delayed: number;
};

type IntelligenceRun = {
  id: string; agentName: string; triggerEvent: string;
  entityType: string; entityId: string; status: string;
  durationMs?: number; signalsCreated: string[];
  error?: string; createdAt: string;
};

// ── Static job type registry ──────────────────────────────────────────────────

const JOB_HANDLERS = [
  { type: "agent-run",         handler: "AgentRunHandler",         description: "Ejecución de agentes IA (delegación, copiloto, coordinador)", priority: 1 },
  { type: "dispute",           handler: "DisputeHandler",           description: "Resolución de disputas entre cliente y profesional", priority: 1 },
  { type: "trust-match",       handler: "TrustMatchHandler",        description: "Cálculo de compatibilidad profesional-trabajo", priority: 4 },
  { type: "curator",           handler: "CuratorHandler",           description: "Curación de conocimiento y memoria de agentes", priority: 4 },
  { type: "field-ops",         handler: "FieldOpsHandler",          description: "Operaciones de campo y asignación de recursos", priority: 5 },
  { type: "pricing",           handler: "PricingHandler",           description: "Sugerencia de precios por trade y zona geográfica", priority: 5 },
  { type: "intake-ops-bridge", handler: "IntakeOpsBridgeHandler",   description: "Puente entre el smart intake y las operaciones", priority: 6 },
];

// ── Helpers ───────────────────────────────────────────────────────────────────

function statusColor(s: string) {
  return s === "completed" ? "#86efac" : s === "failed" ? "#fca5a5" : s === "running" ? "#67e8f9" : "#94a3b8";
}

function MetricCard({ label, value, icon: Icon, color, sub }: { label: string; value: string | number; icon: typeof Activity; color: string; sub?: string }) {
  return (
    <div style={{ padding: "14px 16px", background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 12 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
        <Icon size={13} color={color} />
        <span style={{ fontSize: 10, color: "var(--muted)", fontWeight: 700 }}>{label}</span>
      </div>
      <div style={{ fontSize: 22, fontWeight: 900, color }}>{value}</div>
      {sub && <div style={{ fontSize: 10, color: "var(--muted)", marginTop: 2 }}>{sub}</div>}
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function WorkerPage() {
  const [metrics, setMetrics] = useState<QueueMetrics | null>(null);
  const [runs,    setRuns]    = useState<IntelligenceRun[]>([]);
  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState<string | null>(null);
  const [lastAt,  setLastAt]  = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const [mRes, rRes] = await Promise.all([
        fetch("/api/semse/ops/worker-metrics").then((r) => r.json()) as Promise<{ data: QueueMetrics }>,
        fetch("/api/semse/ops/intelligence-runs?limit=15").then((r) => r.json()) as Promise<{ data: IntelligenceRun[] }>,
      ]);
      setMetrics(mRes.data ?? null);
      setRuns(rRes.data ?? []);
      setLastAt(new Date().toLocaleTimeString("es-MX"));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
    const t = setInterval(() => void load(), 30_000);
    return () => clearInterval(t);
  }, [load]);

  const totalActive = (metrics?.waiting ?? 0) + (metrics?.active ?? 0);

  return (
    <div style={{ maxWidth: 1100, margin: "0 auto", padding: "28px 20px", color: "var(--ink)" }}>

      <AdminPageHeader
        title="Worker — BullMQ"
        subtitle={`Cola de jobs IA · ${lastAt ? `actualizado ${lastAt}` : "cargando…"}`}
        icon={Cpu}
        iconColor="#818cf8"
        iconBg="rgba(99,102,241,.15)"
        showBack={false}
        actions={
          <>
            <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "6px 12px", borderRadius: 99, background: metrics?.connected ? "rgba(134,239,172,.1)" : "rgba(239,68,68,.1)", border: `1px solid ${metrics?.connected ? "rgba(134,239,172,.3)" : "rgba(239,68,68,.3)"}` }}>
              <span style={{ width: 7, height: 7, borderRadius: "50%", background: metrics?.connected ? "#86efac" : "#fca5a5" }} />
              <span style={{ fontSize: 11, fontWeight: 700, color: metrics?.connected ? "#86efac" : "#fca5a5" }}>
                {metrics?.connected ? "Redis conectado" : "Redis desconectado"}
              </span>
            </div>
            <button onClick={load} disabled={loading}
              style={{ display: "flex", alignItems: "center", gap: 6, padding: "8px 14px", borderRadius: 10, background: "rgba(255,255,255,.05)", border: "1px solid var(--border)", cursor: "pointer", fontSize: 12, color: "var(--muted)" }}>
              <RefreshCw size={12} style={{ animation: loading ? "spin 1s linear infinite" : "none" }} />
            </button>
          </>
        }
      />

      {error && (
        <div style={{ padding: "10px 14px", background: "rgba(239,68,68,.1)", borderRadius: 10, fontSize: 12, color: "#fca5a5", marginBottom: 16 }}>{error}</div>
      )}

      {/* Queue Metrics */}
      {metrics && (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: 10, marginBottom: 20 }}>
          <MetricCard label="En espera"   value={metrics.waiting}   icon={Clock}         color={metrics.waiting > 0 ? "#fcd34d" : "#94a3b8"} />
          <MetricCard label="Activos"     value={metrics.active}    icon={Activity}      color={metrics.active > 0 ? "#67e8f9" : "#94a3b8"} />
          <MetricCard label="Completados" value={metrics.completed} icon={CheckCircle2}  color="#86efac" sub="últimos 500 guardados" />
          <MetricCard label="Fallidos"    value={metrics.failed}    icon={XCircle}       color={metrics.failed > 0 ? "#fca5a5" : "#94a3b8"} sub="últimos 1000" />
          <MetricCard label="Diferidos"   value={metrics.delayed}   icon={Layers}        color="#818cf8" />
        </div>
      )}

      {/* Alert banner if jobs pending */}
      {totalActive > 0 && (
        <div style={{ padding: "10px 16px", background: "rgba(234,179,8,.08)", border: "1px solid rgba(234,179,8,.3)", borderRadius: 10, marginBottom: 16, display: "flex", alignItems: "center", gap: 10 }}>
          <Zap size={13} color="#fcd34d" />
          <span style={{ fontSize: 12, color: "#fcd34d", fontWeight: 600 }}>{totalActive} job(s) en proceso ahora</span>
        </div>
      )}

      {/* Handler Registry */}
      <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 14, padding: 18, marginBottom: 20 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 14 }}>
          <Layers size={14} color="#818cf8" />
          <h2 style={{ margin: 0, fontSize: 14, fontWeight: 800 }}>Handlers registrados</h2>
          <span style={{ fontSize: 11, color: "var(--muted)", marginLeft: "auto" }}>{JOB_HANDLERS.length} tipos</span>
        </div>
        <div style={{ display: "grid", gap: 6 }}>
          {JOB_HANDLERS.map((h) => (
            <div key={h.type} style={{ display: "grid", gridTemplateColumns: "auto 1fr auto auto", gap: 12, padding: "10px 12px", background: "rgba(255,255,255,.03)", borderRadius: 10, border: "1px solid var(--border)", alignItems: "center" }}>
              <span style={{ fontSize: 10, fontWeight: 800, color: "#818cf8", background: "rgba(99,102,241,.15)", padding: "2px 8px", borderRadius: 6, fontFamily: "monospace" }}>{h.type}</span>
              <span style={{ fontSize: 11, color: "var(--muted)" }}>{h.description}</span>
              <span style={{ fontSize: 10, color: "#94a3b8" }}>{h.handler}</span>
              <span style={{ fontSize: 10, color: "#94a3b8" }}>P{h.priority}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Intelligence Runs */}
      <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 14, overflow: "hidden" }}>
        <div style={{ padding: "14px 18px", borderBottom: "1px solid var(--border)", display: "flex", alignItems: "center", gap: 8 }}>
          <Activity size={14} color="#818cf8" />
          <h2 style={{ margin: 0, fontSize: 14, fontWeight: 800 }}>Runs de inteligencia recientes</h2>
          <span style={{ fontSize: 11, color: "var(--muted)", marginLeft: "auto" }}>{runs.length} más recientes</span>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1.5fr 1fr 1fr 0.8fr 0.7fr", gap: 10, padding: "8px 18px", borderBottom: "1px solid var(--border)", fontSize: 10, fontWeight: 800, color: "var(--muted)" }}>
          <span>AGENTE</span><span>TRIGGER</span><span>ENTIDAD</span><span>STATUS</span><span>DURACIÓN</span>
        </div>

        {runs.length === 0 && (
          <div style={{ padding: "24px", textAlign: "center", fontSize: 13, color: "var(--muted)" }}>Sin runs registrados</div>
        )}

        {runs.map((run) => (
          <div key={run.id} style={{ display: "grid", gridTemplateColumns: "1.5fr 1fr 1fr 0.8fr 0.7fr", gap: 10, padding: "10px 18px", borderBottom: "1px solid var(--border)", alignItems: "center" }}>
            <div>
              <div style={{ fontSize: 12, fontWeight: 700, color: "var(--ink)" }}>{run.agentName}</div>
              {run.signalsCreated.length > 0 && (
                <div style={{ fontSize: 10, color: "#818cf8" }}>{run.signalsCreated.length} señal(es) creada(s)</div>
              )}
            </div>
            <div style={{ fontSize: 11, color: "var(--muted)", overflow: "hidden", whiteSpace: "nowrap", textOverflow: "ellipsis" }}>{run.triggerEvent}</div>
            <div style={{ fontSize: 10, color: "var(--muted)", overflow: "hidden", whiteSpace: "nowrap", textOverflow: "ellipsis" }}>{run.entityType}:{run.entityId.slice(0, 8)}</div>
            <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
              {run.status === "completed" ? <CheckCircle2 size={11} color="#86efac" /> : run.status === "failed" ? <AlertTriangle size={11} color="#fca5a5" /> : <Activity size={11} color="#67e8f9" />}
              <span style={{ fontSize: 10, fontWeight: 600, color: statusColor(run.status) }}>{run.status}</span>
            </div>
            <div style={{ fontSize: 10, color: "var(--muted)" }}>
              {run.durationMs != null ? `${run.durationMs}ms` : "—"}
            </div>
          </div>
        ))}
      </div>

      <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
