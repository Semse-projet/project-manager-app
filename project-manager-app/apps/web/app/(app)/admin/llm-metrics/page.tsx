"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Activity, AlertTriangle, CheckCircle, Clock, RefreshCw, Zap, XCircle, MinusCircle, Inbox, BarChart2 } from "lucide-react";
import { HtmlInCanvasPanel } from "@semse/ui";
import { fetchLLMMetrics, type LLMProviderMetric } from "../../../semse-api";
import { NotificationBanner } from "../../../components/notifications/NotificationBanner";

// ── Helpers ───────────────────────────────────────────────────────────────────

const PROVIDER_META: Record<string, { label: string; color: string; bg: string }> = {
  anthropic: { label: "Anthropic",  color: "#c084fc", bg: "rgba(192,132,252,.12)" },
  openai:    { label: "OpenAI",     color: "#34d399", bg: "rgba(52,211,153,.12)"  },
  ollama:    { label: "Ollama",     color: "#60a5fa", bg: "rgba(96,165,250,.12)"  },
  template:  { label: "Template",   color: "#94a3b8", bg: "rgba(148,163,184,.10)" },
};

const TASK_LABELS: Record<string, string> = {
  chat:             "Chat",
  tool_use:         "Tool Use",
  high_risk_action: "High Risk",
  low_risk_action:  "Low Risk",
  search:           "Search",
  unknown:          "Unknown",
};

function CircuitBadge({ state }: { state: LLMProviderMetric["circuitState"] }) {
  const meta = {
    closed:     { icon: CheckCircle,  color: "#10b981", label: "Cerrado"    },
    "half-open":{ icon: MinusCircle,  color: "#f59e0b", label: "Half-open"  },
    open:       { icon: XCircle,      color: "#ef4444", label: "Abierto"    },
  }[state];
  const Icon = meta.icon;
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 4, fontSize: 11, fontWeight: 700, color: meta.color }}>
      <Icon size={11} /> {meta.label}
    </span>
  );
}

function SuccessBar({ rate }: { rate: number }) {
  const pct = Math.round(rate * 100);
  const color = pct >= 90 ? "#10b981" : pct >= 70 ? "#f59e0b" : "#ef4444";
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
      <div style={{ width: 60, height: 6, borderRadius: 3, background: "var(--border)", overflow: "hidden", flexShrink: 0 }}>
        <div style={{ width: `${pct}%`, height: "100%", background: color, borderRadius: 3, transition: "width .3s" }} />
      </div>
      <span style={{ fontSize: 12, fontWeight: 700, color, minWidth: 32 }}>{pct}%</span>
    </div>
  );
}

function ScorePill({ score }: { score: number }) {
  const color = score >= 700 ? "#10b981" : score >= 400 ? "#f59e0b" : "#ef4444";
  return (
    <span style={{
      display: "inline-block", padding: "3px 8px", borderRadius: 6,
      background: `${color}18`, color, fontSize: 12, fontWeight: 800,
    }}>
      {score.toFixed(0)}
    </span>
  );
}

function deriveGlobalStats(data: LLMProviderMetric[]) {
  if (data.length === 0) return { totalCalls: 0, avgSuccessRate: 0, avgLatency: 0, openCircuits: 0 };
  const real = data.filter((d) => d.provider !== "template");
  const totalCalls = data.reduce((s, d) => s + d.successCount + d.failureCount, 0);
  const avgSuccessRate = real.length > 0
    ? real.reduce((s, d) => s + d.successRate, 0) / real.length : 0;
  const avgLatency = real.length > 0
    ? real.filter((d) => d.avgLatencyMs > 0).reduce((s, d) => s + d.avgLatencyMs, 0) /
      Math.max(1, real.filter((d) => d.avgLatencyMs > 0).length)
    : 0;
  const openCircuits = data.filter((d) => d.circuitState === "open").length;
  return { totalCalls, avgSuccessRate, avgLatency, openCircuits };
}

const REFRESH_INTERVAL_MS = 15_000;

// ── Page ──────────────────────────────────────────────────────────────────────

export default function AdminLLMMetricsPage() {
  const [data, setData] = useState<LLMProviderMetric[]>([]);
  const [loading, setLoading] = useState(true);
  const [lastRefresh, setLastRefresh] = useState<Date | null>(null);
  const [providerFilter, setProviderFilter] = useState<string>("all");
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const load = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const metrics = await fetchLLMMetrics();
      setData(metrics);
      setLastRefresh(new Date());
    } catch {
      // keep stale data
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
    intervalRef.current = setInterval(() => void load(true), REFRESH_INTERVAL_MS);
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, [load]);

  const stats = deriveGlobalStats(data);
  const providers = ["all", ...Array.from(new Set(data.map((d) => d.provider)))];
  const filtered = providerFilter === "all" ? data : data.filter((d) => d.provider === providerFilter);

  const card: React.CSSProperties = {
    background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 12,
  };

  const tabStyle = (active: boolean): React.CSSProperties => ({
    padding: "6px 14px", borderRadius: 8, border: "none", fontSize: 12, fontWeight: 700,
    cursor: "pointer", background: active ? "var(--brand)" : "transparent",
    color: active ? "#fff" : "var(--muted)", transition: "all .15s",
  });

  return (
    <div style={{ maxWidth: "1100px", margin: "0 auto" }}>
      {/* Header */}
      <HtmlInCanvasPanel
        as="section"
        style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12, marginBottom: 24 }}
        canvasClassName="rounded-2xl"
        minHeight={82}
      >
        <div>
          <Link
            href="/admin/dashboard"
            style={{ display: "inline-flex", alignItems: "center", gap: 5, color: "var(--muted)", fontSize: 12, fontWeight: 600, textDecoration: "none", marginBottom: 8 }}
          >
            <span style={{ fontSize: 14 }}>←</span> Dashboard
          </Link>
          <h1 style={{ fontSize: 22, fontWeight: 800, color: "var(--ink)", marginBottom: 4 }}>LLM Metrics</h1>
          <p style={{ fontSize: 13, color: "var(--muted)" }}>
            Rendimiento en vivo por provider × taskType — actualización cada {REFRESH_INTERVAL_MS / 1000}s
            {lastRefresh ? ` · última: ${lastRefresh.toLocaleTimeString("es-MX")}` : ""}
          </p>
        </div>
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <NotificationBanner audience="admin" />
          <button
            onClick={() => void load()}
            disabled={loading}
            style={{ padding: 8, borderRadius: 8, border: "1px solid var(--border)", background: "var(--surface)", color: "var(--muted)", cursor: "pointer", display: "flex" }}
            title="Recargar"
          >
            <RefreshCw size={15} style={{ animation: loading ? "spin 1s linear infinite" : "none" }} />
          </button>
        </div>
      </HtmlInCanvasPanel>

      {/* KPI row */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))", gap: 12, marginBottom: 24 }}>
        {[
          {
            label: "Llamadas totales",
            value: stats.totalCalls.toLocaleString(),
            icon: <Activity size={18} color="#6366f1" />,
            bg: "rgba(99,102,241,.08)", border: "rgba(99,102,241,.2)",
          },
          {
            label: "Éxito promedio",
            value: `${Math.round(stats.avgSuccessRate * 100)}%`,
            icon: <CheckCircle size={18} color="#10b981" />,
            bg: "rgba(16,185,129,.08)", border: "rgba(16,185,129,.2)",
          },
          {
            label: "Latencia media",
            value: stats.avgLatency > 0 ? `${Math.round(stats.avgLatency)}ms` : "—",
            icon: <Clock size={18} color="#f59e0b" />,
            bg: "rgba(245,158,11,.08)", border: "rgba(245,158,11,.2)",
          },
          {
            label: "Circuitos abiertos",
            value: stats.openCircuits,
            icon: <AlertTriangle size={18} color={stats.openCircuits > 0 ? "#ef4444" : "#10b981"} />,
            bg: stats.openCircuits > 0 ? "rgba(239,68,68,.08)" : "rgba(16,185,129,.06)",
            border: stats.openCircuits > 0 ? "rgba(239,68,68,.2)" : "rgba(16,185,129,.15)",
          },
        ].map((stat) => (
          <div key={stat.label} style={{ ...card, padding: "16px 18px", background: stat.bg, borderColor: stat.border }}>
            <div style={{ marginBottom: 8 }}>{stat.icon}</div>
            <p style={{ fontSize: 22, fontWeight: 900, color: "var(--ink)" }}>{stat.value}</p>
            <p style={{ fontSize: 11, color: "var(--muted)", marginTop: 4 }}>{stat.label}</p>
          </div>
        ))}
      </div>

      {/* Filter tabs */}
      <div style={{ display: "flex", gap: 4, background: "var(--surface)", padding: 4, borderRadius: 10, border: "1px solid var(--border)", width: "fit-content", marginBottom: 16 }}>
        {providers.map((p) => {
          const meta = PROVIDER_META[p];
          return (
            <button key={p} onClick={() => setProviderFilter(p)} style={tabStyle(providerFilter === p)}>
              {p === "all" ? "Todos" : meta?.label ?? p}
            </button>
          );
        })}
      </div>

      {/* Metrics table */}
      <HtmlInCanvasPanel as="section" canvasClassName="rounded-2xl" minHeight={360}>
        {loading && data.length === 0 ? (
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {[1, 2, 3].map((i) => (
              <div key={i} style={{ height: 64, borderRadius: 10, background: "var(--raised)", animation: "pulse 1.5s ease-in-out infinite" }} />
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div style={{ padding: "56px 24px", textAlign: "center" }}>
            <Inbox size={32} style={{ color: "var(--faint)", margin: "0 auto 12px" }} />
            <p style={{ fontSize: 14, fontWeight: 600, color: "var(--muted)" }}>Sin datos aún</p>
            <p style={{ fontSize: 12, color: "var(--faint)", marginTop: 4 }}>
              Las métricas aparecen después de la primera llamada al copiloto con LLM activo.
            </p>
          </div>
        ) : (
          <>
            {/* Table header */}
            <div style={{
              display: "grid",
              gridTemplateColumns: "140px 110px 90px 1fr 90px 90px 80px 100px",
              gap: 0, padding: "10px 16px",
              borderBottom: "1px solid var(--border)",
              background: "var(--bg)",
            }}>
              {["Provider", "Task Type", "Muestras", "Éxito", "Avg ms", "p95 ms", "Score", "Circuito"].map((h) => (
                <p key={h} style={{ fontSize: 11, fontWeight: 700, color: "var(--faint)", textTransform: "uppercase" }}>{h}</p>
              ))}
            </div>

            {/* Rows — sorted by score desc */}
            {[...filtered].sort((a, b) => b.score - a.score).map((row, idx) => {
              const pMeta = PROVIDER_META[row.provider] ?? { label: row.provider, color: "var(--muted)", bg: "var(--surface)" };
              const taskLabel = TASK_LABELS[row.taskType] ?? row.taskType;
              return (
                <div
                  key={`${row.provider}:${row.taskType}`}
                  style={{
                    display: "grid",
                    gridTemplateColumns: "140px 110px 90px 1fr 90px 90px 80px 100px",
                    gap: 0, padding: "14px 16px",
                    alignItems: "center",
                    borderBottom: idx < filtered.length - 1 ? "1px solid var(--border)" : "none",
                    background: row.circuitState === "open" ? "rgba(239,68,68,.03)" : "transparent",
                    transition: "background .15s",
                  }}
                >
                  {/* Provider */}
                  <div>
                    <span style={{
                      display: "inline-flex", alignItems: "center", gap: 5,
                      padding: "4px 10px", borderRadius: 999,
                      background: pMeta.bg, color: pMeta.color,
                      fontSize: 12, fontWeight: 700,
                    }}>
                      <Zap size={10} />
                      {pMeta.label}
                    </span>
                  </div>

                  {/* Task type */}
                  <p style={{ fontSize: 12, color: "var(--muted)", fontWeight: 600 }}>{taskLabel}</p>

                  {/* Samples */}
                  <div>
                    <p style={{ fontSize: 13, fontWeight: 700, color: "var(--ink)" }}>{row.sampleCount}</p>
                    <p style={{ fontSize: 10, color: "var(--faint)" }}>{row.successCount}✓ {row.failureCount}✗</p>
                  </div>

                  {/* Success bar */}
                  <SuccessBar rate={row.successRate} />

                  {/* Avg latency */}
                  <div>
                    <p style={{ fontSize: 13, fontWeight: 700, color: "var(--ink)" }}>
                      {row.avgLatencyMs > 0 ? `${row.avgLatencyMs}ms` : "—"}
                    </p>
                  </div>

                  {/* p95 */}
                  <div>
                    <p style={{ fontSize: 12, color: "var(--muted)" }}>
                      {row.p95LatencyMs > 0 ? `${row.p95LatencyMs}ms` : "—"}
                    </p>
                  </div>

                  {/* Score */}
                  <ScorePill score={row.score} />

                  {/* Circuit */}
                  <div>
                    <CircuitBadge state={row.circuitState} />
                    {row.consecutiveFailures > 0 && (
                      <p style={{ fontSize: 10, color: "var(--faint)", marginTop: 2 }}>
                        {row.consecutiveFailures} consec.
                      </p>
                    )}
                  </div>
                </div>
              );
            })}
          </>
        )}
      </HtmlInCanvasPanel>

      {/* Legend */}
      <HtmlInCanvasPanel
        as="section"
        style={{ ...card, padding: "14px 18px", marginTop: 16, display: "grid", gap: 6 }}
        canvasClassName="rounded-xl"
        minHeight={60}
      >
        <p style={{ fontSize: 11, fontWeight: 700, color: "var(--faint)", textTransform: "uppercase", marginBottom: 4 }}>
          Cómo leer esta tabla
        </p>
        <div style={{ display: "flex", gap: 20, flexWrap: "wrap" }}>
          {[
            { icon: <BarChart2 size={12} color="#6366f1" />, text: "Score = successRate² × 1000 / (latencia_s + 1). Más alto es mejor." },
            { icon: <CheckCircle size={12} color="#10b981" />, text: "Circuito cerrado: provider disponible." },
            { icon: <MinusCircle size={12} color="#f59e0b" />, text: "Half-open: 1 probe permitida después de 30s de fallo." },
            { icon: <XCircle size={12} color="#ef4444" />, text: "Circuito abierto: 3+ fallos consecutivos — skipped automáticamente." },
          ].map(({ icon, text }) => (
            <div key={text} style={{ display: "flex", alignItems: "flex-start", gap: 6, fontSize: 11, color: "var(--muted)", maxWidth: 240 }}>
              <span style={{ flexShrink: 0, marginTop: 1 }}>{icon}</span>
              {text}
            </div>
          ))}
        </div>
      </HtmlInCanvasPanel>
    </div>
  );
}
