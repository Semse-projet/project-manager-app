"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Activity, Bot, BrainCircuit, Cpu, RefreshCw, Route, ShieldAlert } from "lucide-react";
import { HtmlInCanvasPanel } from "@semse/ui";
import {
  fetchAiModelLogs,
  fetchAiModelLogStats,
  fetchAiModelReadiness,
  fetchPrometeoOperationalContext,
  fetchAiMissionIncidents,
  postAiMissionIncident,
  subscribeToContextUpdates,
  type AiModelReadiness,
  type AiModelInteractionLog,
  type AiModelInteractionStats,
  type MissionIncident,
  type PrometeoOperationalContext,
} from "../../../semse-api";
import {
  buildAiMissionDiagnostics,
  buildAiMissionIncident,
  type AiMissionAlertSeverity,
  type AiMissionDiagnostics,
  type AiMissionIncident,
  type AiMissionSignalSource,
} from "../../../../lib/ai-mission-diagnostics";

function topEntry(record: Record<string, number>): [string, number] | null {
  const entries = Object.entries(record);
  if (entries.length === 0) return null;
  return entries.sort((a, b) => b[1] - a[1])[0] ?? null;
}

function StatCard({
  label,
  value,
  hint,
  icon: Icon,
}: {
  label: string;
  value: string;
  hint: string;
  icon: typeof Bot;
}) {
  return (
    <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 16, padding: 18 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10 }}>
        <div style={{ width: 36, height: 36, borderRadius: 12, background: "rgba(99,102,241,.15)", display: "grid", placeItems: "center" }}>
          <Icon size={18} color="#818cf8" />
        </div>
        <div style={{ fontSize: 12, color: "var(--muted)", fontWeight: 700 }}>{label}</div>
      </div>
      <div style={{ fontSize: 26, fontWeight: 800, color: "var(--ink)" }}>{value}</div>
      <div style={{ fontSize: 12, color: "var(--muted)", marginTop: 6 }}>{hint}</div>
    </div>
  );
}

function modeColor(mode: AiModelInteractionLog["mode"]): string {
  if (mode === "context_only") return "#fbbf24";
  if (mode === "report") return "#38bdf8";
  if (mode === "fallback") return "#f87171";
  return "#86efac";
}

function alertColor(severity: AiMissionAlertSeverity): string {
  if (severity === "critical") return "#ef4444";
  if (severity === "high") return "#fb7185";
  if (severity === "medium") return "#fbbf24";
  return "#38bdf8";
}

function postureColor(posture: ReturnType<typeof buildAiMissionDiagnostics>["posture"]): string {
  if (posture === "critical") return "#ef4444";
  if (posture === "degraded") return "#fb7185";
  if (posture === "watch") return "#fbbf24";
  return "#86efac";
}

export default function AiMissionControlPage() {
  const [stats, setStats] = useState<AiModelInteractionStats | null>(null);
  const [logs, setLogs] = useState<AiModelInteractionLog[]>([]);
  const [readiness, setReadiness] = useState<AiModelReadiness | null>(null);
  const [context, setContext] = useState<PrometeoOperationalContext | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastRefresh, setLastRefresh] = useState<string | null>(null);
  const [liveHealth, setLiveHealth] = useState<{ api: string; worker: string; redis: string } | null>(null);
  const [lastSignalSource, setLastSignalSource] = useState<AiMissionSignalSource>("bootstrap");
  const [incidentFeed, setIncidentFeed] = useState<(AiMissionIncident | MissionIncident)[]>([]);
  const [liveIncident, setLiveIncident] = useState<AiMissionIncident | MissionIncident | null>(null);
  const previousDiagnosticsRef = useRef<AiMissionDiagnostics | null>(null);

  async function load(source: AiMissionSignalSource = "manual") {
    setLoading(true);
    setError(null);
    try {
      const [nextStats, nextLogs, nextContext, nextReadiness] = await Promise.all([
        fetchAiModelLogStats(),
        fetchAiModelLogs(20),
        fetchPrometeoOperationalContext(),
        fetchAiModelReadiness(),
      ]);
      setStats(nextStats);
      setLogs(nextLogs);
      setContext(nextContext);
      setReadiness(nextReadiness);
      setLastSignalSource(source);
      setLastRefresh(new Date().toLocaleTimeString("es-MX"));
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo cargar AI Mission Control.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load("bootstrap");
    fetchAiMissionIncidents(20)
      .then((persisted) => {
        setIncidentFeed((current) => {
          const ids = new Set(current.map((i) => i.id));
          const toAdd = persisted.filter((i) => !ids.has(i.id));
          return [...current, ...toAdd].slice(0, 20);
        });
      })
      .catch(() => {});

    const intervalId = window.setInterval(() => {
      void load("poll");
    }, 30_000);

    const es = new EventSource("/api/semse/health/stream");
    es.addEventListener("health-update", (e) => {
      try {
        const data = JSON.parse(e.data) as { api: string; worker: string; redis: string };
        setLiveHealth(data);
        setLastSignalSource("health-stream");
        setLastRefresh(new Date().toLocaleTimeString("es-MX"));
      } catch { /* ignore parse errors */ }
    });
    const unsubscribeContext = subscribeToContextUpdates({
      onUpdate: () => {
        void load("context-stream");
      },
    });

    return () => {
      window.clearInterval(intervalId);
      es.close();
      unsubscribeContext();
    };
  }, []);

  const topModel = useMemo(() => (stats ? topEntry(stats.byModel) : null), [stats]);
  const topTask = useMemo(() => (stats ? topEntry(stats.byTask) : null), [stats]);
  const topMode = useMemo(() => (stats ? topEntry(stats.byMode) : null), [stats]);
  const successRate = useMemo(() => {
    if (!stats || stats.total === 0) return "0%";
    return `${Math.round((stats.success / stats.total) * 100)}%`;
  }, [stats]);
  const diagnostics = useMemo(() => buildAiMissionDiagnostics({
    stats,
    logs,
    readiness,
    context,
    liveHealth,
  }), [stats, logs, readiness, context, liveHealth]);

  useEffect(() => {
    const incident = buildAiMissionIncident({
      previous: previousDiagnosticsRef.current,
      current: diagnostics,
      source: lastSignalSource as AiMissionSignalSource,
    });
    previousDiagnosticsRef.current = diagnostics;
    if (!incident) return;
    setIncidentFeed((currentFeed) => [incident, ...currentFeed].slice(0, 20));
    setLiveIncident(incident);
    if (incident.severity === "critical" || incident.severity === "high") {
      postAiMissionIncident({
        source: incident.source,
        posture: incident.posture,
        severity: incident.severity,
        title: incident.title,
        detail: incident.detail,
        alertIds: incident.alertIds,
      }).catch(() => {});
    }
  }, [diagnostics, lastSignalSource]);

  useEffect(() => {
    if (!liveIncident) return;
    const timer = window.setTimeout(() => {
      setLiveIncident((currentIncident) => currentIncident?.id === liveIncident.id ? null : currentIncident);
    }, 12_000);
    return () => {
      window.clearTimeout(timer);
    };
  }, [liveIncident]);

  return (
    <HtmlInCanvasPanel>
      <div style={{ maxWidth: 1180, margin: "0 auto", display: "grid", gap: 18 }}>
        <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 18, padding: 22, display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12 }}>
          <div>
            <h1 style={{ margin: 0, fontSize: 22, fontWeight: 800, color: "var(--ink)" }}>AI Mission Control</h1>
            <p style={{ margin: "6px 0 0", fontSize: 12, color: "var(--muted)" }}>
              Prometeo operativo, routing multi-modelo y contexto real del sistema.
              {lastRefresh ? ` Actualizado ${lastRefresh}.` : ""}
            </p>
          </div>
          <button
            type="button"
            onClick={() => void load("manual")}
            disabled={loading}
            style={{ display: "inline-flex", alignItems: "center", gap: 8, padding: "10px 14px", borderRadius: 12, border: "none", background: "rgba(99,102,241,.15)", color: "#818cf8", fontWeight: 700, cursor: loading ? "not-allowed" : "pointer", opacity: loading ? 0.6 : 1 }}
          >
            <RefreshCw size={14} style={{ animation: loading ? "spin 1s linear infinite" : "none" }} />
            {loading ? "Cargando..." : "Actualizar"}
          </button>
        </div>

        {liveIncident && (
          <div style={{ background: `${alertColor(liveIncident.severity)}12`, border: `1px solid ${alertColor(liveIncident.severity)}44`, borderRadius: 14, padding: 14 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 4 }}>
              <ShieldAlert size={16} color={alertColor(liveIncident.severity)} />
              <strong style={{ color: alertColor(liveIncident.severity), fontSize: 13 }}>{liveIncident.title}</strong>
              <span style={{ marginLeft: "auto", fontSize: 10, color: "var(--muted)" }}>
                {liveIncident.source} · {new Date(liveIncident.createdAt).toLocaleTimeString("es-MX")}
              </span>
            </div>
            <div style={{ fontSize: 12, color: "var(--muted)" }}>{liveIncident.detail}</div>
          </div>
        )}

        {error && (
          <div style={{ background: "rgba(239,68,68,.08)", border: "1px solid rgba(239,68,68,.2)", borderRadius: 14, padding: 14, color: "#fca5a5", fontSize: 13 }}>
            {error}
          </div>
        )}

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 14 }}>
          <StatCard label="Interacciones AI" value={String(stats?.total ?? 0)} hint="Llamadas persistidas en AiInteractionLog" icon={Activity} />
          <StatCard label="Success Rate" value={successRate} hint={`${stats?.success ?? 0} exitosas`} icon={ShieldAlert} />
          <StatCard label="Postura" value={diagnostics.posture.toUpperCase()} hint={`${diagnostics.alerts.length} alertas activas`} icon={ShieldAlert} />
          <StatCard label="Modelo dominante" value={topModel ? topModel[0] : "n/a"} hint={topModel ? `${topModel[1]} llamadas` : "Sin datos"} icon={Cpu} />
          <StatCard label="Task dominante" value={topTask ? topTask[0] : "n/a"} hint={topTask ? `${topTask[1]} llamadas` : "Sin datos"} icon={Route} />
          <StatCard label="Modo dominante" value={topMode ? topMode[0] : "n/a"} hint={topMode ? `${topMode[1]} respuestas` : "Sin datos"} icon={BrainCircuit} />
        </div>

        <div style={{ background: "var(--surface)", border: `1px solid ${postureColor(diagnostics.posture)}44`, borderRadius: 16, padding: 18 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 14 }}>
            <ShieldAlert size={18} color={postureColor(diagnostics.posture)} />
            <h2 style={{ margin: 0, fontSize: 16, fontWeight: 800 }}>Stability Alerts</h2>
            <span style={{ marginLeft: "auto", fontSize: 11, fontWeight: 800, color: postureColor(diagnostics.posture) }}>
              {diagnostics.posture.toUpperCase()}
            </span>
          </div>
          {diagnostics.alerts.length === 0 ? (
            <div style={{ fontSize: 13, color: "#86efac" }}>Sin alertas activas. Gateway, logs y contexto se ven sanos.</div>
          ) : (
            <div style={{ display: "grid", gap: 10 }}>
              {diagnostics.alerts.map((alert) => (
                <div key={alert.id} style={{ padding: "12px 14px", borderRadius: 12, background: `${alertColor(alert.severity)}12`, border: `1px solid ${alertColor(alert.severity)}33` }}>
                  <div style={{ display: "flex", justifyContent: "space-between", gap: 8, alignItems: "center", marginBottom: 4 }}>
                    <span style={{ fontSize: 12, fontWeight: 800, color: alertColor(alert.severity) }}>{alert.title}</span>
                    <span style={{ fontSize: 10, fontWeight: 800, color: alertColor(alert.severity) }}>{alert.severity.toUpperCase()}</span>
                  </div>
                  <div style={{ fontSize: 12, color: "var(--muted)" }}>{alert.detail}</div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 16, padding: 18 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 14 }}>
            <Activity size={18} color="#818cf8" />
            <h2 style={{ margin: 0, fontSize: 16, fontWeight: 800 }}>Incident Feed</h2>
            <span style={{ marginLeft: "auto", fontSize: 11, color: "var(--muted)" }}>
              {incidentFeed.length} evento(s)
            </span>
          </div>
          {incidentFeed.length === 0 ? (
            <div style={{ fontSize: 13, color: "var(--muted)" }}>Sin incidentes recientes.</div>
          ) : (
            <div style={{ display: "grid", gap: 8 }}>
              {incidentFeed.map((incident) => (
                <div key={incident.id} style={{ padding: "12px 14px", borderRadius: 12, background: "rgba(255,255,255,.03)", border: `1px solid ${alertColor(incident.severity)}33` }}>
                  <div style={{ display: "flex", justifyContent: "space-between", gap: 10, alignItems: "center", marginBottom: 4 }}>
                    <span style={{ fontSize: 12, fontWeight: 800, color: alertColor(incident.severity) }}>{incident.title}</span>
                    <span style={{ fontSize: 10, color: "var(--muted)" }}>
                      {incident.source} · {new Date(incident.createdAt).toLocaleTimeString("es-MX")}
                    </span>
                  </div>
                  <div style={{ fontSize: 12, color: "var(--muted)" }}>{incident.detail}</div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1.3fr .9fr", gap: 14 }}>
          <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 16, padding: 18 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 14 }}>
              <BrainCircuit size={18} color="#818cf8" />
              <h2 style={{ margin: 0, fontSize: 16, fontWeight: 800 }}>Operational Context</h2>
            </div>
            {!context ? (
              <div style={{ fontSize: 13, color: "var(--muted)" }}>Sin contexto disponible.</div>
            ) : (
              <div style={{ display: "grid", gap: 10, fontSize: 13 }}>
                <div><strong>Modo:</strong> {context.mode.toUpperCase()}</div>
                <div><strong>Assistant:</strong> tono={context.assistantSettings.assistantTone ?? "default"} · idioma={context.assistantSettings.assistantLanguage ?? "default"} · verbosidad={context.assistantSettings.assistantVerbosity ?? "default"}{context.assistantSettings.expertMode ? " · expert=on" : ""}</div>
                <div><strong>Proyecto activo:</strong> {context.activeProject ? `${context.activeProject.title} (${context.activeProject.status})` : "Sin proyecto seleccionado"}</div>
                <div><strong>Trabajos:</strong> {context.jobs.active} activos · {context.jobs.waitingProposals} esperando · {context.jobs.completed} completados</div>
                <div><strong>Hitos:</strong> {context.milestones.pendingApproval} por aprobar · {context.milestones.submitted} enviados</div>
                <div><strong>Pagos:</strong> ${context.payments.pendingRelease.toLocaleString()} elegibles · ${context.payments.escrowFunded.toLocaleString()} fondeados</div>
                <div><strong>Evidencias:</strong> {context.evidences.pendingReview} por revisar de {context.evidences.total}</div>
                <div><strong>Disputas:</strong> {context.disputes.open} abiertas · {context.disputes.urgent} urgentes</div>
                {context.ecosystem5d && (
                  <div>
                    <strong>Lente 5D:</strong> {context.ecosystem5d.score}/100 · {context.ecosystem5d.status}
                    <span style={{ color: "var(--muted)" }}>
                      {" · "}
                      {context.ecosystem5d.dimensions.map((dim) => `${dim.label}=${dim.score}`).join(" · ")}
                    </span>
                  </div>
                )}
                {context.risk && (
                  <div>
                    <strong>Riesgo:</strong> {context.risk.level.toUpperCase()} · score={context.risk.overallScore}/100
                  </div>
                )}
                <div>
                  <strong>Sistema:</strong>{" "}
                  {(["api", "worker", "redis"] as const).map((k) => {
                    const val = liveHealth ? liveHealth[k] : context.systemHealth[k];
                    return (
                      <span key={k} style={{ color: val === "ok" ? "#86efac" : "#fca5a5", marginRight: 8 }}>
                        {k.toUpperCase()}={val}
                      </span>
                    );
                  })}
                  {liveHealth && <span style={{ fontSize: 10, color: "#6366f1", marginLeft: 4 }}>● live</span>}
                </div>
              </div>
            )}
          </div>

          <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 16, padding: 18 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 14 }}>
              <Bot size={18} color="#818cf8" />
              <h2 style={{ margin: 0, fontSize: 16, fontWeight: 800 }}>Top Routing</h2>
            </div>
            <div style={{ display: "grid", gap: 10 }}>
              {Object.entries(stats?.byTask ?? {}).slice(0, 6).map(([task, count]) => (
                <div key={task} style={{ display: "flex", justifyContent: "space-between", gap: 8, padding: "10px 12px", borderRadius: 12, background: "rgba(255,255,255,.03)", border: "1px solid var(--border)" }}>
                  <span style={{ fontSize: 12, color: "var(--ink)", fontWeight: 700 }}>{task}</span>
                  <span style={{ fontSize: 12, color: "var(--muted)" }}>{count}</span>
                </div>
              ))}
              {(!stats || Object.keys(stats.byTask).length === 0) && (
                <div style={{ fontSize: 13, color: "var(--muted)" }}>Sin historial de routing todavia.</div>
              )}
            </div>
          </div>
        </div>

        <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 16, padding: 18 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 14 }}>
            <Cpu size={18} color="#818cf8" />
            <h2 style={{ margin: 0, fontSize: 16, fontWeight: 800 }}>Gateway Readiness</h2>
          </div>
          {!readiness ? (
            <div style={{ fontSize: 13, color: "var(--muted)" }}>Sin readiness disponible.</div>
          ) : (
            <div style={{ display: "grid", gap: 14 }}>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 10 }}>
                {[
                  { label: "Anthropic", value: readiness.environment.anthropicConfigured },
                  { label: "OpenAI", value: readiness.environment.openaiConfigured },
                  { label: "DeepSeek", value: readiness.environment.deepseekConfigured },
                  { label: "Kimi", value: readiness.environment.kimiConfigured },
                  { label: "Open source", value: readiness.environment.openSourceEnabled },
                ].map((item) => (
                  <div key={item.label} style={{ padding: "12px 14px", borderRadius: 12, background: "rgba(255,255,255,.03)", border: "1px solid var(--border)" }}>
                    <div style={{ fontSize: 11, color: "var(--muted)", marginBottom: 5 }}>{item.label}</div>
                    <div style={{ fontSize: 15, fontWeight: 800, color: item.value ? "#86efac" : "#fca5a5" }}>
                      {item.value ? "configured" : "missing"}
                    </div>
                  </div>
                ))}
              </div>
              <div style={{ fontSize: 12, color: "var(--muted)" }}>
                Providers registrados en runtime:{" "}
                <strong style={{ color: "var(--ink)" }}>
                  {readiness.llmOrchestrator.providers.join(", ") || "ninguno"}
                </strong>
                {" · "}
                gateway activo={readiness.llmOrchestrator.hasProvider ? "sí" : "no"}
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 10 }}>
                {[
                  { label: "Providers configurados", value: String(diagnostics.counters.configuredProviders) },
                  { label: "Providers runtime", value: String(diagnostics.counters.runtimeProviders) },
                  { label: "Modelos reales", value: String(diagnostics.counters.enabledRealModels) },
                  { label: "Fallbacks recientes", value: String(diagnostics.counters.fallbackCount) },
                ].map((item) => (
                  <div key={item.label} style={{ padding: "10px 12px", borderRadius: 12, background: "rgba(255,255,255,.03)", border: "1px solid var(--border)" }}>
                    <div style={{ fontSize: 11, color: "var(--muted)", marginBottom: 4 }}>{item.label}</div>
                    <div style={{ fontSize: 15, color: "var(--ink)", fontWeight: 800 }}>{item.value}</div>
                  </div>
                ))}
              </div>
              <div style={{ display: "grid", gap: 8 }}>
                {readiness.routeSamples.map((sample) => (
                  <div key={sample.taskType} style={{ display: "grid", gridTemplateColumns: "1fr auto auto", gap: 10, padding: "10px 12px", borderRadius: 12, background: "rgba(255,255,255,.03)", border: "1px solid var(--border)", fontSize: 12 }}>
                    <div>
                      <div style={{ color: "var(--ink)", fontWeight: 800 }}>{sample.taskType}</div>
                      <div style={{ color: "var(--muted)", marginTop: 2 }}>{sample.route.reason}</div>
                    </div>
                    <div style={{ color: "#a5b4fc", fontWeight: 700 }}>{sample.route.primaryModelSlug}</div>
                    <div style={{ color: "var(--muted)" }}>{sample.route.fallbackModelSlug ?? "sin fallback"}</div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 16, padding: 18 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 14 }}>
            <Route size={18} color="#818cf8" />
            <h2 style={{ margin: 0, fontSize: 16, fontWeight: 800 }}>Execution Modes</h2>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 10 }}>
            {[
              { mode: "runtime", label: "runtime", note: "Paso real por gateway/modelo" },
              { mode: "report", label: "report", note: "Respuesta sintética basada en datos reales" },
              { mode: "context_only", label: "context_only", note: "Guardrail sin proyecto o sin ir al LLM" },
              { mode: "fallback", label: "fallback", note: "Respuesta con fallback o fallo controlado" },
            ].map((item) => (
              <div key={item.mode} style={{ padding: "12px 14px", borderRadius: 12, background: "rgba(255,255,255,.03)", border: "1px solid var(--border)" }}>
                <div style={{ display: "flex", justifyContent: "space-between", gap: 8, alignItems: "center", marginBottom: 6 }}>
                  <span style={{ fontSize: 12, fontWeight: 800, color: modeColor(item.mode as AiModelInteractionLog["mode"]) }}>{item.label}</span>
                  <span style={{ fontSize: 12, color: "var(--ink)", fontWeight: 800 }}>{stats?.byMode?.[item.mode] ?? 0}</span>
                </div>
                <div style={{ fontSize: 12, color: "var(--muted)" }}>{item.note}</div>
              </div>
            ))}
          </div>
          <div style={{ marginTop: 14, fontSize: 12, color: "var(--muted)" }}>
            Context mode actual del sistema: <strong style={{ color: "var(--ink)" }}>{context?.mode?.toUpperCase() ?? "N/A"}</strong>.
            {" "}`demo` = simulado, `local` = runtime real local, `live` = servicios productivos.
          </div>
        </div>

        <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 16, padding: 18 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 14 }}>
            <Activity size={18} color="#818cf8" />
            <h2 style={{ margin: 0, fontSize: 16, fontWeight: 800 }}>Recent AI Calls</h2>
          </div>
          {logs.length === 0 ? (
            <div style={{ fontSize: 13, color: "var(--muted)" }}>Sin llamadas registradas aun.</div>
          ) : (
            <div style={{ display: "grid", gap: 8 }}>
              {logs.map((log) => (
                <div key={log.id} style={{ display: "grid", gridTemplateColumns: "1.2fr .9fr .8fr .7fr .7fr", gap: 10, padding: "12px 14px", borderRadius: 12, background: "rgba(255,255,255,.03)", border: "1px solid var(--border)", fontSize: 12 }}>
                  <div>
                    <div style={{ fontWeight: 800, color: "var(--ink)" }}>{log.taskType}</div>
                    <div style={{ color: "var(--muted)", marginTop: 2 }}>{log.routeReason ?? "sin reason"}</div>
                  </div>
                  <div>
                    <div style={{ fontWeight: 700, color: "var(--ink)" }}>{log.modelSlug}</div>
                    <div style={{ color: "var(--muted)", marginTop: 2 }}>{log.provider}</div>
                  </div>
                  <div style={{ color: modeColor(log.mode), fontWeight: 700 }}>
                    {log.mode}
                    {log.fallbackUsed ? " · fallback" : ""}
                    <div style={{ color: log.success ? "#86efac" : "#fca5a5", fontWeight: 600, marginTop: 2 }}>
                      {log.success ? "success" : "failed"}
                    </div>
                  </div>
                  <div style={{ color: "var(--muted)" }}>{log.latencyMs ?? 0} ms</div>
                  <div style={{ color: "var(--muted)" }}>{new Date(log.createdAt).toLocaleTimeString("es-MX")}</div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </HtmlInCanvasPanel>
  );
}
