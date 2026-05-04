"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { HtmlInCanvasPanel } from "@semse/ui";
import {
  acknowledgeOpsAlert,
  executeOpsRunbook,
  fetchCortexSnapshot,
  fetchCortexRuntimeTrace,
  reportOpsIncident,
  semseRuntimeEnabled,
  type AgentRuntimeTrace,
  type CortexSnapshot
} from "../semse-api";

type ModelKey = "champion" | "challenger";
type Severity = "info" | "warning" | "critical";

type AlertItem = {
  id: number;
  title: string;
  detail: string;
  severity: Severity;
  acknowledged?: boolean;
};

type RunbookItem = {
  id: number;
  title: string;
  status: "ready" | "executing" | "completed";
  result: string;
};

type MetricPoint = {
  latency: number;
  prediction: number;
  cpu: number;
  memory: number;
  risk: number;
};

const initialSeries: MetricPoint[] = [
  { latency: 72, prediction: 78, cpu: 44, memory: 62, risk: 0.31 },
  { latency: 75, prediction: 82, cpu: 46, memory: 61, risk: 0.33 },
  { latency: 70, prediction: 76, cpu: 48, memory: 62, risk: 0.28 },
  { latency: 78, prediction: 84, cpu: 49, memory: 63, risk: 0.35 },
  { latency: 74, prediction: 81, cpu: 45, memory: 60, risk: 0.32 },
  { latency: 80, prediction: 86, cpu: 52, memory: 64, risk: 0.37 },
  { latency: 77, prediction: 83, cpu: 47, memory: 63, risk: 0.34 },
  { latency: 73, prediction: 79, cpu: 44, memory: 61, risk: 0.3 }
];

const initialAlerts: AlertItem[] = [
  {
    id: 1,
    title: "Queue pressure",
    detail: "La cola de agent runs subio por encima del umbral operativo.",
    severity: "warning"
  },
  {
    id: 2,
    title: "Risk spike detected",
    detail: "El score agregado de disputas entro en zona de observacion.",
    severity: "critical"
  }
];

const initialRunbooks: RunbookItem[] = [
  {
    id: 1,
    title: "Redistribucion de workers por tipo",
    status: "completed",
    result: "2 workers movidos a risk/dispute."
  },
  {
    id: 2,
    title: "Conmutacion a champion",
    status: "ready",
    result: "Lista para reducir falsos positivos."
  },
  {
    id: 3,
    title: "Reclaim de runs stale",
    status: "completed",
    result: "3 runs recuperados y 1 dead-lettered."
  }
];

function nextActionForAgent(agentType: string, status: string, requiresHumanReview: boolean): string | null {
  if (status !== "completed") return null;
  if (requiresHumanReview) return "Requiere revisión humana antes de continuar.";
  const map: Record<string, string> = {
    pricing: "Revisar estimado y aprobar presupuesto del job.",
    risk: "Revisar score de riesgo y decidir si procede el trabajo.",
    "trust-match": "Revisar candidatos rankeados y seleccionar profesional.",
    dispute: "Revisar resolución propuesta y cerrar o escalar disputa.",
    "evidence-coach": "Verificar evidencia requerida y aprobar milestone.",
    "job-planner": "Revisar plan de milestones y confirmar con el profesional.",
    orchestrator: "Revisar decisión orquestada y ejecutar siguiente paso.",
    ecv: "Validar estado del contrato y confirmar vigencia."
  };
  return map[agentType] ?? "Revisar resultado del agente y tomar acción.";
}

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

function buildPath(values: number[], max = 160) {
  return values
    .map((value, index) => {
      const x = values.length === 1 ? 0 : (index / (values.length - 1)) * 100;
      const y = 100 - (clamp(value, 0, max) / max) * 100;
      return `${index === 0 ? "M" : "L"} ${x.toFixed(2)} ${y.toFixed(2)}`;
    })
    .join(" ");
}

function severityClass(severity: Severity) {
  if (severity === "critical") {
    return "alert-card critical";
  }
  if (severity === "warning") {
    return "alert-card warning";
  }
  return "alert-card";
}

function runbookClass(status: RunbookItem["status"]) {
  if (status === "completed") {
    return "runbook-card done";
  }
  if (status === "executing") {
    return "runbook-card executing";
  }
  return "runbook-card";
}

export function CortexConsole() {
  const runtimeEnabled = semseRuntimeEnabled();
  const [model, setModel] = useState<ModelKey>("champion");
  const [series, setSeries] = useState<MetricPoint[]>(initialSeries);
  const [alerts, setAlerts] = useState<AlertItem[]>(initialAlerts);
  const [runbooks, setRunbooks] = useState<RunbookItem[]>(initialRunbooks);
  const [connected, setConnected] = useState(true);
  const [incidentMode, setIncidentMode] = useState<"nominal" | "watch" | "critical">("watch");
  const [trafficSplit, setTrafficSplit] = useState(85);
  const [logs, setLogs] = useState<string[]>([
    "Secure uplink established with SEMSE control plane.",
    "Audit bridge online. Ops feed receiving agent telemetry."
  ]);
  const [liveSnapshot, setLiveSnapshot] = useState<CortexSnapshot | null>(null);
  const [selectedCorrelationId, setSelectedCorrelationId] = useState<string | null>(null);
  const [runtimeTrace, setRuntimeTrace] = useState<AgentRuntimeTrace | null>(null);
  const [runtimeTraceLoading, setRuntimeTraceLoading] = useState(false);
  const [runtimeTraceError, setRuntimeTraceError] = useState<string | null>(null);
  const [liveError, setLiveError] = useState<string | null>(null);
  const [ackedLiveAlerts, setAckedLiveAlerts] = useState<number[]>([]);
  const tickRef = useRef(0);
  const nextAlertIdRef = useRef(Math.max(...initialAlerts.map((alert) => alert.id)) + 1);
  const runtimeStatusRef = useRef<"unknown" | "connected" | "disconnected">("unknown");

  useEffect(() => {
    if (!runtimeEnabled) {
      // Demo mode: el badge "Degradado" ya comunica el estado, no necesitamos un error verbose
      setLiveError(null);
      return;
    }

    let cancelled = false;

    async function loadSnapshot() {
      try {
        const snapshot = await fetchCortexSnapshot();
        if (cancelled || !snapshot) {
          return;
        }

        setLiveSnapshot(snapshot);
        setConnected(true);
        setLiveError(null);
        setSelectedCorrelationId((current) => current ?? snapshot.agentRuntime.items[0]?.correlationId ?? null);

        if (runtimeStatusRef.current !== "connected") {
          setLogs((current) => [...current.slice(-5), "Cortex conectado a ops/audit/risk reales."]);
          runtimeStatusRef.current = "connected";
        }
      } catch (error) {
        if (cancelled) {
          return;
        }

        setLiveError(error instanceof Error ? error.message : "No se pudo consultar el API real de Cortex.");

        if (runtimeStatusRef.current !== "disconnected") {
          setLogs((current) => [...current.slice(-5), "Cortex volvio a modo sintetico por error de API."]);
          runtimeStatusRef.current = "disconnected";
        }
      }
    }

    void loadSnapshot();
    const timer = window.setInterval(() => {
      void loadSnapshot();
    }, 15000);

    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, [runtimeEnabled]);

  useEffect(() => {
    if (!runtimeEnabled || !selectedCorrelationId) {
      setRuntimeTrace(null);
      setRuntimeTraceError(null);
      setRuntimeTraceLoading(false);
      return;
    }

    let cancelled = false;
    const correlationId = selectedCorrelationId;
    setRuntimeTraceLoading(true);
    setRuntimeTraceError(null);

    async function loadTrace() {
      try {
        const trace = await fetchCortexRuntimeTrace(correlationId);
        if (cancelled) {
          return;
        }

        setRuntimeTrace(trace);
      } catch (error) {
        if (cancelled) {
          return;
        }

        setRuntimeTraceError(error instanceof Error ? error.message : "No se pudo cargar el trace del runtime.");
      } finally {
        if (!cancelled) {
          setRuntimeTraceLoading(false);
        }
      }
    }

    void loadTrace();

    return () => {
      cancelled = true;
    };
  }, [runtimeEnabled, selectedCorrelationId]);

  useEffect(() => {
    const timer = window.setInterval(() => {
      tickRef.current += 1;
      const tick = tickRef.current;

      setSeries((current) => {
        const last = current[current.length - 1] ?? initialSeries[initialSeries.length - 1];
        const multiplier = model === "challenger" ? 1.14 : 1;
        const latency = clamp(last.latency * 0.72 + 76 * 0.28 + (Math.random() * 20 - 10) * multiplier, 34, 155);
        const prediction = clamp(latency + (model === "challenger" ? 14 : 7), 36, 160);
        const cpu = clamp(last.cpu * 0.64 + 48 * 0.36 + (Math.random() * 10 - 5), 18, 97);
        const memory = clamp(last.memory * 0.8 + 63 * 0.2 + (Math.random() * 6 - 3), 30, 96);
        const risk = clamp(last.risk * 0.7 + (latency > 105 ? 0.58 : model === "challenger" ? 0.44 : 0.32) * 0.3, 0.08, 0.96);

        return [...current.slice(1), { latency, prediction, cpu, memory, risk }];
      });

      if (tick % 8 === 0) {
        setConnected((current) => current);
        setLogs((current) => [...current.slice(-5), "Heartbeat recibido desde worker orchestration loop."]);
      }

      if (tick % 11 === 0) {
        setAlerts((current) => {
          const nextId = nextAlertIdRef.current;
          nextAlertIdRef.current += 1;
          const extra: AlertItem = model === "challenger"
            ? {
                id: nextId,
                title: "Challenger sensitivity",
                detail: "El modelo challenger elevo la tasa de deteccion temprana.",
                severity: "warning",
                acknowledged: false
              }
            : {
                id: nextId,
                title: "Champion stabilized",
                detail: "Se redujo volatilidad de scoring en el plano Ops.",
                severity: "info",
                acknowledged: false
              };

          return [extra, ...current].slice(0, 4);
        });
      }

      if (tick % 13 === 0) {
        setRunbooks((current) =>
          current.map((runbook, index) => {
            if (index !== 1) {
              return runbook;
            }

            if (model === "challenger") {
              return {
                ...runbook,
                status: "executing",
                result: "Evaluando rollback automatico al champion si el riesgo agregado sigue subiendo."
              };
            }

            return {
              ...runbook,
              status: "ready",
              result: "Lista para reducir falsos positivos."
            };
          })
        );
      }
    }, 1400);

    return () => window.clearInterval(timer);
  }, [model]);

  const liveRiskScore = liveSnapshot?.riskScores[0]?.score ?? null;
  const liveLatest = liveSnapshot?.dashboard;
  const latest = series[series.length - 1] ?? initialSeries[initialSeries.length - 1];
  const effectiveRisk = liveRiskScore ?? latest.risk;
  const effectiveAlerts: AlertItem[] = liveSnapshot
    ? [
        {
          id: 10_001,
          title: "Agent backlog",
          detail: `${liveLatest?.agents.queued ?? 0} runs en cola y ${liveLatest?.agents.running ?? 0} corriendo.`,
          severity: (liveLatest?.agents.failed ?? 0) > 0 ? "warning" : "info",
          acknowledged: ackedLiveAlerts.includes(10_001)
        },
        {
          id: 10_002,
          title: "Dispute pressure",
          detail: `${liveLatest?.disputes.open ?? 0} disputas abiertas y ${liveLatest?.disputes.assigned ?? 0} asignadas.`,
          severity: (liveLatest?.disputes.open ?? 0) > 0 ? "warning" : "info",
          acknowledged: ackedLiveAlerts.includes(10_002)
        },
        {
          id: 10_003,
          title: "Dead-letter watch",
          detail: `${liveLatest?.agents.deadLettered ?? 0} runs en dead-letter y ${liveLatest?.agents.maxAttemptsReached ?? 0} al limite de intentos.`,
          severity: (liveLatest?.agents.deadLettered ?? 0) > 0 ? "critical" : "info",
          acknowledged: ackedLiveAlerts.includes(10_003)
        }
      ]
    : alerts;
  const effectiveLogs = liveSnapshot
    ? liveSnapshot.audit.slice(0, 6).map((entry) => `${entry.action} ${entry.entityType}:${entry.entityId}`)
    : logs;
  const acknowledgedCount = effectiveAlerts.filter((alert) => alert.acknowledged).length;
  const liveWarnings = liveSnapshot?.warnings ?? [];
  const liveRuntime = liveSnapshot?.agentRuntime.items ?? [];
  const effectiveTrace = runtimeTrace;

  const latencyPath = useMemo(() => buildPath(series.map((item) => item.latency)), [series]);
  const predictionPath = useMemo(() => buildPath(series.map((item) => item.prediction)), [series]);

  async function acknowledgeAlert(alertId: number) {
    if (liveSnapshot && runtimeEnabled) {
      try {
        await acknowledgeOpsAlert(String(alertId));
        setAckedLiveAlerts((current) => (current.includes(alertId) ? current : [...current, alertId]));
        setLogs((current) => [...current.slice(-5), `Alert ${alertId} acknowledged via Ops API.`]);
        return;
      } catch (error) {
        setLiveError(error instanceof Error ? error.message : "No se pudo registrar el ack en Ops.");
      }
    }

    setAlerts((current) =>
      current.map((alert) => (alert.id === alertId ? { ...alert, acknowledged: true } : alert))
    );
    setLogs((current) => [...current.slice(-5), `Alert ${alertId} acknowledged by Ops.`]);
  }

  async function executeRunbook(runbookId: number) {
    if (runtimeEnabled) {
      try {
        await executeOpsRunbook(String(runbookId));
        setLogs((current) => [...current.slice(-5), `Runbook ${runbookId} ejecutado via Ops API.`]);
      } catch (error) {
        setLiveError(error instanceof Error ? error.message : "No se pudo ejecutar el runbook en Ops.");
      }
    }

    setRunbooks((current) =>
      current.map((runbook) =>
        runbook.id === runbookId
          ? {
              ...runbook,
              status: "completed",
              result: "Runbook ejecutado manualmente desde la consola Cortex."
            }
          : runbook
      )
    );
    setLogs((current) => [...current.slice(-5), `Runbook ${runbookId} ejecutado manualmente.`]);
  }

  async function injectCriticalAlert() {
    const nextId = nextAlertIdRef.current;
    nextAlertIdRef.current += 1;
    const criticalAlert: AlertItem = {
      id: nextId,
      title: "Manual critical incident",
      detail: "Evento critico inyectado para ensayo de respuesta y runbooks.",
      severity: "critical",
      acknowledged: false
    };

    if (runtimeEnabled) {
      try {
        await reportOpsIncident({
          severity: "critical",
          title: "Manual critical incident injected from Cortex"
        });
        setLogs((current) => [...current.slice(-5), "Incidente critico registrado via Ops API."]);
      } catch (error) {
        setLiveError(error instanceof Error ? error.message : "No se pudo registrar el incidente en Ops.");
      }
    }

    setAlerts((current) => [criticalAlert, ...current].slice(0, 5));
    setIncidentMode("critical");
    setLogs((current) => [...current.slice(-5), "Incidente critico inyectado desde War Room."]);
  }

  return (
    <main className="cortex-shell">
      <HtmlInCanvasPanel as="section" className="cortex-hero" canvasClassName="rounded-[32px]" minHeight={212}>
        <div>
          <h1>Cortex</h1>
          {liveError ? <p className="panel-note">{liveError}</p> : null}
          {liveWarnings.length > 0 ? <p className="panel-note">{liveWarnings.join(" ")}</p> : null}
          <div className="cortex-hero-actions">
            <Link className="cortex-link" href="/">
              Volver
            </Link>
            <span className={connected ? "cortex-badge connected" : "cortex-badge"}>
              {connected ? "Conectado" : "Degradado"}
            </span>
            <button className="registry-button" onClick={() => setConnected((current) => !current)} type="button">
              {connected ? "Simular degradacion" : "Restaurar canal"}
            </button>
          </div>
        </div>

        <div className="cortex-hero-side">
          <HtmlInCanvasPanel as="article" className="cortex-stat-card" canvasClassName="rounded-[24px]" minHeight={84}>
            <span>Modelo activo</span>
            <strong>{model === "champion" ? "Champion v2.4" : "Challenger v3.0"}</strong>
          </HtmlInCanvasPanel>
          <HtmlInCanvasPanel as="article" className="cortex-stat-card" canvasClassName="rounded-[24px]" minHeight={84}>
            <span>Risk score</span>
            <strong>{effectiveRisk.toFixed(2)}</strong>
          </HtmlInCanvasPanel>
          <HtmlInCanvasPanel as="article" className="cortex-stat-card" canvasClassName="rounded-[24px]" minHeight={84}>
            <span>Incidente</span>
            <strong>{liveSnapshot ? (effectiveRisk > 0.7 ? "critical" : effectiveRisk > 0.45 ? "watch" : "nominal") : incidentMode}</strong>
          </HtmlInCanvasPanel>
        </div>
      </HtmlInCanvasPanel>

      <section className="cortex-grid">
        <HtmlInCanvasPanel as="article" className="cortex-panel" canvasClassName="rounded-[28px]" minHeight={520}>
          <div className="cortex-panel-head">
            <div>
              <h2>Champion vs Challenger</h2>
            </div>
            <div className="registry-actions">
              <button
                className={model === "champion" ? "registry-button active" : "registry-button"}
                onClick={() => setModel("champion")}
                type="button"
              >
                Champion
              </button>
              <button
                className={model === "challenger" ? "registry-button active alt" : "registry-button"}
                onClick={() => setModel("challenger")}
                type="button"
              >
                Challenger
              </button>
            </div>
          </div>

          <div className="split-panel">
            <div>
              <span className="panel-eyebrow">Traffic split</span>
              <h3>{trafficSplit}% champion / {100 - trafficSplit}% challenger</h3>
            </div>
            <input
              max={95}
              min={5}
              onChange={(event) => setTrafficSplit(Number(event.target.value))}
              type="range"
              value={trafficSplit}
            />
          </div>

          <div className="cortex-metrics">
            <div className="cortex-mini-card">
              <span>Latencia actual</span>
              <strong>{Math.round(latest.latency)} ms</strong>
            </div>
            <div className="cortex-mini-card">
              <span>Prediccion AI</span>
              <strong>{Math.round(latest.prediction)} ms</strong>
            </div>
            <div className="cortex-mini-card">
              <span>Runs corriendo</span>
              <strong>{liveSnapshot ? liveLatest?.agents.running ?? 0 : Math.round(latest.cpu)}{liveSnapshot ? "" : "%"}</strong>
            </div>
            <div className="cortex-mini-card">
              <span>{liveSnapshot ? "Disputas open" : "Memoria"}</span>
              <strong>{liveSnapshot ? liveLatest?.disputes.open ?? 0 : Math.round(latest.memory)}{liveSnapshot ? "" : "%"}</strong>
            </div>
          </div>

          <div className="cortex-chart-shell">
            <svg aria-label="Cortex chart" className="cortex-chart" viewBox="0 0 100 100">
              <line className="cortex-threshold" x1="0" x2="100" y1="25" y2="25" />
              <path className="cortex-line primary" d={latencyPath} />
              <path className="cortex-line secondary" d={predictionPath} />
            </svg>
            <div className="cortex-chart-legend">
              <span><i className="dot primary" /> Latencia real</span>
              <span><i className="dot secondary" /> Prediccion del modelo</span>
            </div>
          </div>
        </HtmlInCanvasPanel>

        <HtmlInCanvasPanel as="article" className="cortex-panel" canvasClassName="rounded-[28px]" minHeight={520}>
          <div className="cortex-panel-head">
            <div>
              <h2>Alertas y runbooks</h2>
            </div>
          </div>

          <div className="alert-stack">
            {effectiveAlerts.map((alert) => (
              <div className={severityClass(alert.severity)} key={alert.id}>
                <div className="alert-head">
                  <strong>{alert.title}</strong>
                  <button className="ghost-action-button" onClick={() => acknowledgeAlert(alert.id)} type="button">
                    {alert.acknowledged ? "Acked" : "Ack"}
                  </button>
                </div>
                <p>{alert.detail}</p>
              </div>
            ))}
          </div>

          <div className="runbook-stack">
            {runbooks.map((runbook) => (
              <div className={runbookClass(runbook.status)} key={runbook.id}>
                <div>
                  <strong>{runbook.title}</strong>
                  <p>{runbook.result}</p>
                </div>
                <div className="runbook-actions">
                  <span>{runbook.status}</span>
                  <button className="ghost-action-button" onClick={() => executeRunbook(runbook.id)} type="button">
                    Ejecutar
                  </button>
                </div>
              </div>
            ))}
          </div>

          <div className="cortex-tools">
            <button className="spike-button" onClick={injectCriticalAlert} type="button">
              Inyectar incidente
            </button>
            <button className="ghost-action-button" onClick={() => setIncidentMode("watch")} type="button">
              Volver a watch
            </button>
            <div className="tool-stat">
              <span>Alerts acked</span>
              <strong>{acknowledgedCount}</strong>
            </div>
          </div>
        </HtmlInCanvasPanel>
      </section>

      <section className="cortex-bottom-grid">
        <HtmlInCanvasPanel as="article" className="cortex-panel" canvasClassName="rounded-[28px]" minHeight={280}>
          <div className="cortex-panel-head">
            <div>
              <h2>Logs</h2>
            </div>
          </div>

          <div className="cortex-log-panel">
            {effectiveLogs.slice(-6).map((log, index) => (
              <p key={`${index}-${log}`}>{`> ${log}`}</p>
            ))}
          </div>
        </HtmlInCanvasPanel>

        <HtmlInCanvasPanel as="article" className="cortex-panel" canvasClassName="rounded-[28px]" minHeight={280}>
          <div className="cortex-panel-head">
            <div>
              <h2>Componentes</h2>
            </div>
          </div>

          <div className="mapping-grid">
            <div className="mapping-card">
              <strong>Agent runs</strong>
              <p>Cola, running, dead-letter y max-attempts.</p>
            </div>
            <div className="mapping-card">
              <strong>Model Registry</strong>
              <p>Champion/Challenger · traffic split · risk scoring.</p>
            </div>
            <div className="mapping-card">
              <strong>Runbooks</strong>
              <p>Reclaim, retry, rebalanceo de workers.</p>
            </div>
            <div className="mapping-card">
              <strong>War Room</strong>
              <p>Alertas, incidents y ack desde la consola Ops.</p>
            </div>
          </div>
        </HtmlInCanvasPanel>
      </section>

      <section className="cortex-grid">
        <HtmlInCanvasPanel as="article" className="cortex-panel" canvasClassName="rounded-[28px]" minHeight={420}>
          <div className="cortex-panel-head">
            <div>
              <h2>Agent Runtime</h2>
              <p className="panel-note">Vista viva de corridas por correlationId inspirada en la trazabilidad de estado de infclaude.</p>
            </div>
          </div>

          <div className="runtime-list">
            {liveRuntime.length > 0 ? liveRuntime.map((run) => {
              const active = run.correlationId === selectedCorrelationId;
              return (
                <button
                  className={active ? "runtime-row active" : "runtime-row"}
                  key={run.id}
                  onClick={() => setSelectedCorrelationId(run.correlationId)}
                  type="button"
                >
                  <div className="runtime-row-head">
                    <strong>{run.eventType ?? "event.unknown"}</strong>
                    <span className={`status-pill status-${run.status.replaceAll("_", "-")}`}>{run.status}</span>
                  </div>
                  <p>{run.correlationId}</p>
                  <div className="runtime-row-meta">
                    <span>{run.agentType}</span>
                    <span>{run.triggerType}</span>
                    <span>{run.workerId ?? "worker-pending"}</span>
                    {run.operatorContext?.workspaceId ? <span>{`workspace:${run.operatorContext.workspaceId}`}</span> : null}
                  </div>
                  {run.outputSummary ? (
                    <p style={{ fontSize: "11px", color: "#a5f3fc", marginTop: "4px", fontStyle: "italic", textAlign: "left" }}>{run.outputSummary}</p>
                  ) : null}
                  {(() => {
                    const next = nextActionForAgent(run.agentType, run.status, run.requiresHumanReview);
                    return next ? <p style={{ fontSize: "11px", color: "#fbbf24", marginTop: "2px", fontWeight: 600, textAlign: "left" }}>▶ {next}</p> : null;
                  })()}
                </button>
              );
            }) : (
              <div className="runtime-empty">
                <strong>Sin runtime visible</strong>
                <p>No hay AgentRun recientes en el snapshot actual.</p>
              </div>
            )}
          </div>
        </HtmlInCanvasPanel>

        <HtmlInCanvasPanel as="article" className="cortex-panel" canvasClassName="rounded-[28px]" minHeight={520}>
          <div className="cortex-panel-head">
            <div>
              <h2>Trace</h2>
              {effectiveTrace?.summary.eventType ? <p className="panel-note">{effectiveTrace.summary.eventType}</p> : null}
            </div>
          </div>

          {runtimeTraceLoading ? <p className="panel-note">Cargando trace operativo...</p> : null}
          {runtimeTraceError ? <p className="panel-note">{runtimeTraceError}</p> : null}

          {effectiveTrace ? (
            <>
              <div className="runtime-summary-grid">
                <div className="runtime-summary-card">
                  <span>Correlation</span>
                  <strong>{effectiveTrace.correlationId}</strong>
                </div>
                <div className="runtime-summary-card">
                  <span>Triggers</span>
                  <strong>{effectiveTrace.summary.triggerCount}</strong>
                </div>
                <div className="runtime-summary-card">
                  <span>Completed</span>
                  <strong>{effectiveTrace.summary.completed}</strong>
                </div>
                <div className="runtime-summary-card">
                  <span>Failed</span>
                  <strong>{effectiveTrace.summary.failed}</strong>
                </div>
              </div>

              {effectiveTrace.event ? (
                <div className="runtime-event-card">
                  <span className="panel-eyebrow">Domain Event</span>
                  <strong>{effectiveTrace.event.eventType ?? effectiveTrace.event.action}</strong>
                  <p>Triggers: {effectiveTrace.event.triggers.join(", ") || "n/a"}</p>
                </div>
              ) : null}

              {effectiveTrace.workspaceMemory.length > 0 ? (
                <div className="runtime-event-card">
                  <span className="panel-eyebrow">Workspace Memory</span>
                  <strong>{effectiveTrace.workspaceMemory.length} registros contextuales</strong>
                  {effectiveTrace.workspaceMemory.slice(0, 3).map((memory) => (
                    <p key={memory.id}>{memory.title}: {memory.summary}</p>
                  ))}
                </div>
              ) : null}

              {effectiveTrace.runs.some((run) => run.operatorContext) ? (
                <div className="runtime-event-card">
                  <span className="panel-eyebrow">Operator Context</span>
                  {effectiveTrace.runs.filter((run) => run.operatorContext).slice(0, 3).map((run) => (
                    <p key={`${run.id}-operator-context`}>
                      {run.agentType}: {run.operatorContext?.source}/{run.operatorContext?.scope}
                      {run.operatorContext?.workspaceId ? ` · workspace:${run.operatorContext.workspaceId}` : ""}
                    </p>
                  ))}
                </div>
              ) : null}

              {effectiveTrace.runs.some((run) => run.status === "completed") ? (
                <div className="runtime-event-card">
                  <span className="panel-eyebrow">Resultados y siguientes pasos</span>
                  {effectiveTrace.runs.filter((run) => run.status === "completed").map((run) => {
                    const next = nextActionForAgent(run.agentType, run.status, run.requiresHumanReview);
                    return (
                      <div key={`${run.id}-next`} style={{ marginBottom: "8px" }}>
                        <strong style={{ fontSize: "12px" }}>{run.agentType}</strong>
                        {run.outputSummary ? <p style={{ fontSize: "11px", color: "#a5f3fc", fontStyle: "italic" }}>{run.outputSummary}</p> : null}
                        {next ? <p style={{ fontSize: "11px", color: "#fbbf24", fontWeight: 600 }}>▶ {next}</p> : null}
                      </div>
                    );
                  })}
                </div>
              ) : null}

              <div className="runtime-timeline">
                {effectiveTrace.timeline.map((entry) => (
                  <div className="runtime-timeline-item" key={entry.id}>
                    <div className="runtime-timeline-dot" />
                    <div>
                      <strong>{entry.action}</strong>
                      <p>{entry.entityType}:{entry.entityId}</p>
                      <span>{new Date(entry.timestamp).toLocaleString()}</span>
                    </div>
                  </div>
                ))}
              </div>
            </>
          ) : (
            <div className="runtime-empty">
              <strong>Selecciona un correlationId</strong>
              <p>El trace detallado aparecerá aquí con la línea completa de auditoría.</p>
            </div>
          )}
        </HtmlInCanvasPanel>
      </section>
    </main>
  );
}
