"use client";

import { useEffect, useRef, useState } from "react";
import { fetchControlSurfaceSnapshot, semseRuntimeEnabled, type ControlSurfaceSnapshot } from "./semse-api";

type TabKey = "orchestrator" | "topology" | "homeostasis" | "governance";
type TopologyKey = "edge" | "fog";

const tabItems: Array<{ key: TabKey; label: string }> = [
  { key: "orchestrator", label: "Orquestacion Hibrida" },
  { key: "topology", label: "Topologia Distribuida" },
  { key: "homeostasis", label: "Homeostasis y SLA" },
  { key: "governance", label: "Gobernanza y Auditoria" }
];

const hybridDimensions = [
  {
    label: "Velocidad operativa",
    think: 42,
    nonThink: 90
  },
  {
    label: "Precision de criterio",
    think: 92,
    nonThink: 56
  },
  {
    label: "Eficiencia de costo",
    think: 48,
    nonThink: 88
  },
  {
    label: "Gestion de riesgo",
    think: 95,
    nonThink: 40
  },
  {
    label: "Fluidez de respuesta",
    think: 62,
    nonThink: 91
  }
] as const;

const usageSegments = [
  { label: "Marketplace y matching", value: 28, tone: "emerald" },
  { label: "Ops y trazabilidad", value: 22, tone: "indigo" },
  { label: "Evidencia y milestones", value: 18, tone: "amber" },
  { label: "Disputas y scoring", value: 16, tone: "slate" },
  { label: "Agentes de apoyo", value: 16, tone: "teal" }
] as const;

const checklistSeed = [
  "Contrato de datos y fuente auditada",
  "Politica anti-destilacion y propiedad intelectual",
  "Rastro criptografico de decisiones Ops",
  "Reglas de competencia y no concentracion"
];

const latencySeed = [48, 51, 46, 55, 49, 53, 47, 51, 44, 50, 52, 48, 46, 54, 49, 51];

type LogEntry = {
  id: number;
  message: string;
};

type GovernanceEntry = {
  id: number;
  title: string;
  owner: string;
  status: "draft" | "approved";
};

const workerTypes = [
  { key: "pricing", label: "Pricing", throughput: 12 },
  { key: "jobPlanner", label: "Job Planner", throughput: 8 },
  { key: "evidenceCoach", label: "Evidence Coach", throughput: 14 },
  { key: "risk", label: "Risk", throughput: 6 },
  { key: "dispute", label: "Dispute", throughput: 5 }
] as const;

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

function telemetryPath(values: number[]) {
  const width = 100;
  const height = 100;
  return values
    .map((value, index) => {
      const x = values.length === 1 ? 0 : (index / (values.length - 1)) * width;
      const y = height - (clamp(value, 0, 200) / 200) * height;
      return `${index === 0 ? "M" : "L"} ${x.toFixed(2)} ${y.toFixed(2)}`;
    })
    .join(" ");
}

export function SemseControlSurface() {
  const runtimeEnabled = semseRuntimeEnabled();
  const [activeTab, setActiveTab] = useState<TabKey>("orchestrator");
  const [topology, setTopology] = useState<TopologyKey>("edge");
  const [checkedItems, setCheckedItems] = useState<boolean[]>(() => checklistSeed.map(() => false));
  const [latency, setLatency] = useState<number[]>(latencySeed);
  const [isSpiking, setIsSpiking] = useState(false);
  const [recoveryTicks, setRecoveryTicks] = useState(0);
  const [telemetryPaused, setTelemetryPaused] = useState(false);
  const [autoScaleEnabled, setAutoScaleEnabled] = useState(true);
  const [edgeShare, setEdgeShare] = useState(62);
  const [workerPlan, setWorkerPlan] = useState<Record<string, number>>({
    pricing: 2,
    jobPlanner: 1,
    evidenceCoach: 2,
    risk: 1,
    dispute: 1
  });
  const [policyDraft, setPolicyDraft] = useState("Activar aprobacion manual cuando risk score agregado supere 0.70.");
  const [governanceEntries, setGovernanceEntries] = useState<GovernanceEntry[]>([
    { id: 1, title: "Politica inicial de datos y trazabilidad", owner: "OPS_ADMIN", status: "approved" },
    { id: 2, title: "Umbral de escalado para workers de dispute", owner: "OPS_ADMIN", status: "draft" }
  ]);
  const [logs, setLogs] = useState<LogEntry[]>([
    { id: 1, message: "Prometheus inicializado. Recolectando metricas operativas." }
  ]);
  const [liveSnapshot, setLiveSnapshot] = useState<ControlSurfaceSnapshot | null>(null);
  const [liveConnected, setLiveConnected] = useState(false);
  const [liveError, setLiveError] = useState<string | null>(null);
  const nextLogIdRef = useRef(2);
  const nextGovernanceIdRef = useRef(3);
  const runtimeStatusRef = useRef<"unknown" | "connected" | "disconnected">("unknown");

  function appendLog(message: string) {
    const id = nextLogIdRef.current;
    nextLogIdRef.current += 1;
    setLogs((current) => [...current.slice(-4), { id, message }]);
  }

  useEffect(() => {
    if (!runtimeEnabled) {
      setLiveConnected(false);
      setLiveError("Runtime SEMSE deshabilitado. Activa NEXT_PUBLIC_SEMSE_RUNTIME_ENABLED y configura las credenciales en el servidor web.");
      return;
    }

    let cancelled = false;

    async function loadSnapshot() {
      try {
        const snapshot = await fetchControlSurfaceSnapshot();
        if (cancelled || !snapshot) {
          return;
        }

        setLiveSnapshot(snapshot);
        setLiveConnected(true);
        setLiveError(null);

        if (runtimeStatusRef.current !== "connected") {
          appendLog("API real conectada: dashboard, runs y capa operativa sincronizados.");
          runtimeStatusRef.current = "connected";
        }
      } catch (error) {
        if (cancelled) {
          return;
        }

        setLiveConnected(false);
        setLiveError(error instanceof Error ? error.message : "No se pudo consultar el API de SEMSE.");

        if (runtimeStatusRef.current !== "disconnected") {
          appendLog("Fallo la lectura del API real. Se mantiene modo de simulacion.");
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
    const timer = window.setInterval(() => {
      if (telemetryPaused) {
        return;
      }

      setLatency((previous) => {
        const last = previous[previous.length - 1] ?? 50;
        let next = last;

        if (isSpiking) {
          if (recoveryTicks > 10) {
            next = last + (Math.random() * 34 + 12);
          } else if (recoveryTicks === 10) {
            appendLog("Alertmanager activo: conmutacion a flujo non-think y redistribucion de carga.");
          } else {
            next = last - (Math.random() * 22 + 6);
          }
        } else {
          next = last * 0.78 + 50 * 0.22 + (Math.random() * 14 - 7);
        }

        return [...previous.slice(1), clamp(next, 22, 190)];
      });

      if (isSpiking) {
        setRecoveryTicks((current) => {
          const next = current - 1;
          if (next <= 0) {
            setIsSpiking(false);
            appendLog("Homeostasis restaurada. SLA dentro de umbral.");
            return 0;
          }
          return next;
        });
      }
    }, 600);

    return () => window.clearInterval(timer);
  }, [isSpiking, recoveryTicks, telemetryPaused]);

  useEffect(() => {
    if (!isSpiking || !autoScaleEnabled) {
      return;
    }

    setWorkerPlan((current) => ({
      ...current,
      risk: current.risk + 1,
      dispute: current.dispute + 1
    }));
    appendLog("Auto-scale activo: +1 worker en risk y dispute.");
  }, [isSpiking, autoScaleEnabled]);

  const checkedCount = checkedItems.filter(Boolean).length;
  const averageLatency = Math.round(latency.reduce((sum, value) => sum + value, 0) / latency.length);
  const systemHealthy = !isSpiking && averageLatency < 120;
  const telemetryD = telemetryPath(latency);
  const totalWorkers = Object.values(workerPlan).reduce((sum, value) => sum + value, 0);
  const estimatedThroughput = workerTypes.reduce(
    (sum, item) => sum + (workerPlan[item.key] ?? 0) * item.throughput,
    0
  );
  const fogShare = 100 - edgeShare;
  const monthlyInfraCost = edgeShare * 32 + fogShare * 54 + totalWorkers * 45;
  const liveRunsByType = liveSnapshot?.runs.reduce<Record<string, number>>((accumulator, run) => {
    accumulator[run.agentType] = (accumulator[run.agentType] ?? 0) + 1;
    return accumulator;
  }, {});
  const liveJobsTotal = liveSnapshot?.dashboard.jobs.total ?? null;
  const liveProjectsTotal = liveSnapshot?.dashboard.projects.total ?? null;
  const liveAgentsTotal = liveSnapshot?.dashboard.agents.totalRuns ?? null;
  const liveOpenProjects = liveSnapshot?.projects.filter((project) => project.status === "open").length ?? null;
  const liveWarnings = liveSnapshot?.warnings ?? [];

  function triggerSpike() {
    if (isSpiking) {
      return;
    }

    setIsSpiking(true);
    setRecoveryTicks(15);
    appendLog("Pico de demanda detectado en cola de agentes y aprobaciones Ops.");
  }

  function toggleChecklist(index: number) {
    setCheckedItems((current) => current.map((value, itemIndex) => (itemIndex === index ? !value : value)));
  }

  function adjustWorkers(type: string, delta: number) {
    setWorkerPlan((current) => ({
      ...current,
      [type]: Math.max(0, (current[type] ?? 0) + delta)
    }));
  }

  function recoverNow() {
    setIsSpiking(false);
    setRecoveryTicks(0);
    setLatency((current) => current.map((value) => Math.min(value, 82)));
    appendLog("Recuperacion manual aplicada desde Ops.");
  }

  function savePolicy(status: GovernanceEntry["status"]) {
    const trimmed = policyDraft.trim();
    if (!trimmed) {
      return;
    }

    const id = nextGovernanceIdRef.current;
    nextGovernanceIdRef.current += 1;
    setGovernanceEntries((current) => [
      { id, title: trimmed, owner: "OPS_ADMIN", status },
      ...current
    ]);
    appendLog(status === "approved" ? "Nueva politica aprobada y registrada." : "Nueva politica guardada como borrador.");
    setPolicyDraft("");
  }

  return (
    <main className="surface-shell">
      <section className="surface-hero">
        <div className="surface-hero-copy">
          <h1>Control surface</h1>
        </div>
        <div className="surface-summary">
          <div className={liveConnected ? "summary-chip summary-chip-ok" : "summary-chip"}>
            {liveConnected ? "API conectada" : "Simulacion"}
          </div>
          {liveJobsTotal !== null ? <div className="summary-chip">{liveJobsTotal} jobs</div> : null}
          {liveProjectsTotal !== null ? <div className="summary-chip">{liveProjectsTotal} ejecuciones</div> : null}
          {liveAgentsTotal !== null ? <div className="summary-chip">{liveAgentsTotal} runs</div> : null}
        </div>
      </section>

      <nav className="surface-tabs" aria-label="Secciones principales">
        {tabItems.map((tab) => (
          <button
            className={tab.key === activeTab ? "surface-tab active" : "surface-tab"}
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            type="button"
          >
            {tab.label}
          </button>
        ))}
      </nav>

      {activeTab === "orchestrator" ? (
        <section className="surface-panel">
          <div className="panel-heading">
            <h2>Think · Non-think</h2>
          </div>

          {!liveConnected ? <div className="simulation-banner">Modo simulacion — activa el runtime para datos reales.</div> : null}
          {liveError ? <p className="panel-note">{liveError}</p> : null}
          {liveWarnings.length > 0 ? <p className="panel-note">{liveWarnings.join(" ")}</p> : null}

          <div className="metric-grid">
            <article className="metric-card">
              <span className="metric-label">Agents</span>
              <strong>{liveConnected ? liveAgentsTotal ?? 0 : "—"}</strong>
              {liveConnected ? <p>{liveSnapshot?.dashboard.agents.running ?? 0} running · {liveSnapshot?.dashboard.agents.queued ?? 0} queued</p> : null}
            </article>
            <article className="metric-card">
              <span className="metric-label">Jobs</span>
              <strong>{liveConnected ? liveJobsTotal ?? 0 : "—"}</strong>
              {liveConnected ? <p>{liveOpenProjects ?? 0} ejecuciones abiertas</p> : null}
            </article>
            <article className="metric-card">
              <span className="metric-label">Runs running</span>
              <strong>{liveConnected ? liveSnapshot?.dashboard.agents.running ?? 0 : "—"}</strong>
              {liveConnected ? <p>{liveSnapshot?.dashboard.agents.failed ?? 0} failed</p> : null}
            </article>
            <article className="metric-card accent">
              <span className="metric-label">Estado</span>
              <strong>{liveConnected ? "Live" : "Simulado"}</strong>
            </article>
          </div>

          <div className="compare-grid">
            <article className="mode-card mode-card-think">
              <h3>Modo think</h3>
              <p>Scoring de riesgo, dispute resolution, compliance, release en escrow.</p>
              <ul>
                <li>Mayor precisión y trazabilidad.</li>
                <li>Para aprobaciones sensibles.</li>
              </ul>
            </article>

            <article className="hybrid-bars">
              <h3>Perfil comparativo</h3>
              {hybridDimensions.map((dimension) => (
                <div className="bar-row" key={dimension.label}>
                  <div className="bar-copy">
                    <span>{dimension.label}</span>
                    <small>{dimension.think}% think / {dimension.nonThink}% non-think</small>
                  </div>
                  <div className="bar-track">
                    <div className="bar-think" style={{ width: `${dimension.think}%` }} />
                    <div className="bar-nonthink" style={{ width: `${dimension.nonThink}%` }} />
                  </div>
                </div>
              ))}
            </article>

            <article className="mode-card mode-card-fast">
              <h3>Modo non-think</h3>
              <p>Claim loops, guidance de evidencia, operaciones repetitivas.</p>
              <ul>
                <li>Menor latencia, mayor throughput.</li>
                <li>No para decisiones regulatorias.</li>
              </ul>
            </article>
          </div>

          <div className="planner-grid">
            <article className="planner-card">
              <div className="planner-head">
                <div>
                  <p className="panel-eyebrow">Planner de workers</p>
                  <h3>Capacidad por tipo de agente</h3>
                </div>
                <div className="planner-summary">
                  <strong>{totalWorkers}</strong>
                  <span>workers activos</span>
                </div>
              </div>
              <div className="worker-list">
                {workerTypes.map((item) => (
                  <div className="worker-row" key={item.key}>
                    <div>
                      <strong>{item.label}</strong>
                      <span>
                        {item.throughput} runs/h por worker
                        {liveRunsByType?.[item.key] ? ` · ${liveRunsByType[item.key]} runs visibles` : ""}
                      </span>
                    </div>
                    <div className="worker-actions">
                      <button onClick={() => adjustWorkers(item.key, -1)} type="button">-</button>
                      <span>{workerPlan[item.key] ?? 0}</span>
                      <button onClick={() => adjustWorkers(item.key, 1)} type="button">+</button>
                    </div>
                  </div>
                ))}
              </div>
            </article>

            <article className="planner-card planner-card-accent">
              <h3>{estimatedThroughput} runs / hora</h3>
              <div className="capacity-strip">
                <div style={{ width: `${Math.min(estimatedThroughput / 2.2, 100)}%` }} />
              </div>
            </article>
          </div>
        </section>
      ) : null}

      {activeTab === "topology" ? (
        <section className="surface-panel">
          <div className="panel-heading">
            <h2>Edge · Fog</h2>
          </div>

          <div className="toggle-row">
            <button
              className={topology === "edge" ? "toggle-pill active-edge" : "toggle-pill"}
              onClick={() => setTopology("edge")}
              type="button"
            >
              Nodos edge
            </button>
            <button
              className={topology === "fog" ? "toggle-pill active-fog" : "toggle-pill"}
              onClick={() => setTopology("fog")}
              type="button"
            >
              Nodos fog y data plane
            </button>
          </div>

          <div className="topology-grid">
            <article className="topology-copy">
              {topology === "edge" ? (
                <>
                  <h3>Edge</h3>
                  <ul>
                    <li>Portal, guidance, evidencia asistida.</li>
                    <li>Baja latencia y menor costo.</li>
                  </ul>
                </>
              ) : (
                <>
                  <h3>Fog</h3>
                  <ul>
                    <li>Scoring, auditoria, workers especializados.</li>
                    <li>Disputes y payment release.</li>
                  </ul>
                </>
              )}
            </article>

            <article className={topology === "edge" ? "topology-card edge" : "topology-card fog"}>
              <div className="topology-illustration">
                <span>{topology === "edge" ? "Portal + API ligera" : "Workers + Ops + Prisma"}</span>
                <strong>{topology === "edge" ? "Respuesta inmediata" : "Procesamiento profundo"}</strong>
              </div>
            </article>
          </div>

          <div className="usage-panel">
            <div className="usage-chart">
              {usageSegments.map((segment) => (
                <div
                  className={`usage-segment tone-${segment.tone}`}
                  key={segment.label}
                  style={{ width: `${segment.value}%` }}
                  title={`${segment.label}: ${segment.value}%`}
                />
              ))}
            </div>
            <div className="usage-legend">
              {usageSegments.map((segment) => (
                <div className="usage-item" key={segment.label}>
                  <span className={`legend-dot tone-${segment.tone}`} />
                  <span>{segment.label}</span>
                  <strong>{segment.value}%</strong>
                </div>
              ))}
            </div>
          </div>

          <div className="allocation-panel">
            <div className="allocation-copy">
              <h3>Balance edge / fog</h3>
            </div>
            <div className="allocation-controls">
              <label className="allocation-label" htmlFor="edge-share">
                Edge {edgeShare}% / Fog {fogShare}%
              </label>
              <input
                id="edge-share"
                max={90}
                min={10}
                onChange={(event) => setEdgeShare(Number(event.target.value))}
                type="range"
                value={edgeShare}
              />
              <div className="allocation-stats">
                <div>
                  <span>Costo mensual estimado</span>
                  <strong>${monthlyInfraCost}</strong>
                </div>
                <div>
                  <span>Modo recomendado</span>
                  <strong>{edgeShare >= 60 ? "portal first" : "ops first"}</strong>
                </div>
              </div>
            </div>
          </div>
        </section>
      ) : null}

      {activeTab === "homeostasis" ? (
        <section className="surface-panel">
          <div className="panel-heading">
            <h2>Homeostasis · SLA</h2>
          </div>

          <div className="telemetry-shell">
            <div className="telemetry-head">
              <div>
                <h3>Latencia operativa</h3>
              </div>
              <div className={systemHealthy ? "status-badge ok" : "status-badge warn"}>
                {systemHealthy ? "Estado optimo" : "Violacion SLA"}
              </div>
            </div>

            <div className="telemetry-graph">
              <div className="telemetry-guides">
                <span>200ms</span>
                <span>120ms SLA</span>
                <span>0ms</span>
              </div>
              <svg aria-label="Grafico de latencia" className="telemetry-svg" viewBox="0 0 100 100">
                <line className="telemetry-threshold" x1="0" x2="100" y1="40" y2="40" />
                <path className={systemHealthy ? "telemetry-line ok" : "telemetry-line warn"} d={telemetryD} />
              </svg>
            </div>

            <div className="telemetry-actions">
              <button className="spike-button" onClick={triggerSpike} type="button">
                Simular anomalia de carga
              </button>
              <button className="ghost-action-button" onClick={() => setTelemetryPaused((current) => !current)} type="button">
                {telemetryPaused ? "Reanudar telemetria" : "Pausar telemetria"}
              </button>
              <button className="ghost-action-button" onClick={recoverNow} type="button">
                Recuperar ahora
              </button>
              <div className="telemetry-stat">
                <span>Latencia media</span>
                <strong>{averageLatency} ms</strong>
              </div>
            </div>

            <div className="log-panel">
              {logs.slice(-5).map((log) => (
                <p key={log.id}>{`> ${log.message}`}</p>
              ))}
            </div>
          </div>

          <div className="ops-grid">
            <article className="ops-card">
              <h3>Prometheus</h3>
              <p>Latencia, error rate, heartbeats, workers.</p>
            </article>
            <article className="ops-card">
              <h3>Grafana</h3>
              <p>Salud del marketplace y agentes.</p>
            </article>
            <article className="ops-card">
              <h3>Alertmanager</h3>
              <p>Reclaim, degradación y escalado automático.</p>
            </article>
          </div>

          <div className="incident-panel">
            <div className="incident-card">
              <span>Auto-scale</span>
              <strong>{autoScaleEnabled ? "Activo" : "Manual"}</strong>
              <button className="ghost-action-button" onClick={() => setAutoScaleEnabled((current) => !current)} type="button">
                {autoScaleEnabled ? "Desactivar" : "Activar"}
              </button>
            </div>
            <div className="incident-card">
              <span>Workers</span>
              <strong>{totalWorkers}</strong>
            </div>
            <div className="incident-card">
              <span>Estado</span>
              <strong>{systemHealthy ? "Normal" : "Incidente"}</strong>
            </div>
          </div>
        </section>
      ) : null}

      {activeTab === "governance" ? (
        <section className="surface-panel">
          <div className="panel-heading">
            <h2>Gobernanza</h2>
          </div>

          <div className="governance-grid">
            <div className="governance-copy">
              <article className="governance-card">
                <h3>Auditoria</h3>
                <p>Flujos sensibles trazados en audit log con request id.</p>
              </article>
              <article className="governance-card">
                <h3>Propiedad intelectual</h3>
                <p>Modelos y contenido importado con licencia y origen registrados.</p>
              </article>
              <article className="governance-card">
                <h3>Competencia</h3>
                <p>Scoring y escalado sin cajas negras — supervisión Ops requerida.</p>
              </article>
            </div>

            <div className="checklist-shell">
              <div className="checklist-head">
                <h3>Checklist de produccion</h3>
                <span>{checkedCount}/{checklistSeed.length}</span>
              </div>

              <div className="checklist-items">
                {checklistSeed.map((item, index) => (
                  <button className="check-item" key={item} onClick={() => toggleChecklist(index)} type="button">
                    <span className={checkedItems[index] ? "check-mark checked" : "check-mark"} />
                    <span>{item}</span>
                  </button>
                ))}
              </div>

              <div className={checkedCount === checklistSeed.length ? "deploy-state ok" : "deploy-state pending"}>
                {checkedCount === checklistSeed.length
                  ? "Kernel Ops aprobado. Listo para produccion."
                  : "Despliegue bloqueado. Auditoria pendiente."}
              </div>
            </div>
          </div>

          <div className="policy-panel">
            <article className="policy-editor">
              <h3>Nueva política</h3>
              <textarea
                onChange={(event) => setPolicyDraft(event.target.value)}
                placeholder="Describe la regla o decision que quieres registrar..."
                value={policyDraft}
              />
              <div className="policy-actions">
                <button className="ghost-action-button" onClick={() => savePolicy("draft")} type="button">
                  Guardar draft
                </button>
                <button className="spike-button" onClick={() => savePolicy("approved")} type="button">
                  Aprobar politica
                </button>
              </div>
            </article>

            <article className="policy-log">
              <h3>Decisiones recientes</h3>
              <div className="policy-log-list">
                {governanceEntries.map((entry) => (
                  <div className="policy-log-item" key={entry.id}>
                    <div>
                      <strong>{entry.title}</strong>
                      <span>{entry.owner}</span>
                    </div>
                    <b className={entry.status === "approved" ? "policy-badge approved" : "policy-badge"}>
                      {entry.status}
                    </b>
                  </div>
                ))}
              </div>
            </article>
          </div>
        </section>
      ) : null}
    </main>
  );
}
