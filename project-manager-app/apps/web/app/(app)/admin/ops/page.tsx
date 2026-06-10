"use client";

import { useCallback, useEffect, useState } from "react";
import { useLanguage } from "../../../../lib/language-context";
import Link from "next/link";
import {
  Activity,
  Bot,
  CheckCircle,
  Clock3,
  Filter,
  Radar,
  Search,
  ShieldAlert,
  Sparkles,
  Workflow,
  XCircle,
} from "lucide-react";
import {
  fetchDomainEventTrace,
  fetchDomainEvents,
  fetchOpsAgentRuntime,
  fetchOpsAgentRuntimeTrace,
  fetchPendingApprovals,
  decideAgentApproval,
  retryAgentRun,
  requeueAgentRun,
  openIncident,
  semseRuntimeEnabled,
  type AgentApprovalItem,
  type AgentRuntimeList,
  type AgentRuntimeTrace,
  type DomainEventListView,
  type DomainEventTraceView,
} from "../../../semse-api";
import { NotificationBanner } from "../../../components/notifications/NotificationBanner";
import { SemseContextPanel } from "@/components/context-panel/SemseContextPanel";

const EMPTY_RUNTIME_ITEMS: AgentRuntimeList["items"] = [];
const EMPTY_DOMAIN_EVENT_ITEMS: DomainEventListView["items"] = [];

function formatTimestamp(value?: string) {
  if (!value) {
    return "n/a";
  }

  return new Date(value).toLocaleString("es-MX", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function statusTone(status: string) {
  const normalized = status.toLowerCase();
  if (normalized === "completed") return { bg: "rgba(16,185,129,0.12)", border: "rgba(16,185,129,0.28)", color: "#34d399" };
  if (normalized === "failed") return { bg: "rgba(239,68,68,0.12)", border: "rgba(239,68,68,0.28)", color: "#f87171" };
  if (normalized === "running") return { bg: "rgba(59,130,246,0.12)", border: "rgba(59,130,246,0.28)", color: "#60a5fa" };
  return { bg: "rgba(245,158,11,0.12)", border: "rgba(245,158,11,0.28)", color: "#fbbf24" };
}

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
    ecv: "Validar estado del contrato y confirmar vigencia.",
  };
  return map[agentType] ?? "Revisar resultado del agente y tomar acción.";
}

export default function AdminOpsPage() {
  const { t } = useLanguage();
  const runtimeEnabled = semseRuntimeEnabled();
  const [runtime, setRuntime] = useState<AgentRuntimeList | null>(null);
  const [runtimeTrace, setRuntimeTrace] = useState<AgentRuntimeTrace | null>(null);
  const [domainEvents, setDomainEvents] = useState<DomainEventListView | null>(null);
  const [domainEventTrace, setDomainEventTrace] = useState<DomainEventTraceView | null>(null);
  const [loading, setLoading] = useState(runtimeEnabled);
  const [traceLoading, setTraceLoading] = useState(false);
  const [domainEventsLoading, setDomainEventsLoading] = useState(runtimeEnabled);
  const [domainEventTraceLoading, setDomainEventTraceLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [traceError, setTraceError] = useState<string | null>(null);
  const [domainEventsError, setDomainEventsError] = useState<string | null>(null);
  const [domainEventTraceError, setDomainEventTraceError] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [eventType, setEventType] = useState("all");
  const [status, setStatus] = useState("all");
  const [agentType, setAgentType] = useState("all");
  const [workspaceId, setWorkspaceId] = useState("");
  const [operatorId, setOperatorId] = useState("");
  const [memoryTag, setMemoryTag] = useState("");
  const [selectedCorrelationId, setSelectedCorrelationId] = useState<string | null>(null);
  const [refreshTrace, setRefreshTrace] = useState(0);

  // Tab state for the context panel
  const [activeTab, setActiveTab] = useState("summary");

  // Per-run action state: keyed by run.id
  const [runActionLoading, setRunActionLoading] = useState<Record<string, boolean>>({});
  const [runActionError, setRunActionError] = useState<Record<string, string>>({});

  // Pending approvals
  const [pendingApprovals, setPendingApprovals] = useState<AgentApprovalItem[]>([]);
  const [approvalsLoading, setApprovalsLoading] = useState(false);
  const [approvalDecidingId, setApprovalDecidingId] = useState<string | null>(null);
  const [approvalFeedback, setApprovalFeedback] = useState<{ id: string; message: string; kind: "ok" | "error" } | null>(null);

  const loadPendingApprovals = useCallback(async () => {
    setApprovalsLoading(true);
    try {
      const items = await fetchPendingApprovals();
      setPendingApprovals(items);
    } catch {
      // silently ignore — non-critical panel
    } finally {
      setApprovalsLoading(false);
    }
  }, []);

  useEffect(() => { void loadPendingApprovals(); }, [loadPendingApprovals]);

  async function handleApprovalDecision(approvalId: string, decision: "approved" | "rejected") {
    setApprovalDecidingId(approvalId);
    setApprovalFeedback(null);
    try {
      const result = await decideAgentApproval(approvalId, decision);
      const executed = (result as Record<string, unknown>).executionResult as Record<string, unknown> | undefined;
      const summary = executed?.summary ? String(executed.summary) : decision === "approved" ? "Aprobado y ejecutado." : "Rechazado.";
      setApprovalFeedback({ id: approvalId, message: summary, kind: "ok" });
      await loadPendingApprovals();
    } catch (err) {
      setApprovalFeedback({ id: approvalId, message: err instanceof Error ? err.message : "Error al decidir.", kind: "error" });
    } finally {
      setApprovalDecidingId(null);
    }
  }

  // Incident form state
  const [showIncidentForm, setShowIncidentForm] = useState(false);
  const [incidentTitle, setIncidentTitle] = useState("");
  const [incidentSeverity, setIncidentSeverity] = useState<"watch" | "critical">("watch");
  const [incidentLoading, setIncidentLoading] = useState(false);
  const [incidentError, setIncidentError] = useState<string | null>(null);
  const [incidentSuccess, setIncidentSuccess] = useState<string | null>(null);

  // Reset tab to summary on correlation ID change
  useEffect(() => {
    setActiveTab("summary");
    setShowIncidentForm(false);
    setIncidentSuccess(null);
    setIncidentError(null);
  }, [selectedCorrelationId]);

  useEffect(() => {
    if (!runtimeEnabled) {
      return;
    }

    let cancelled = false;
    setLoading(true);
    setError(null);

    void fetchOpsAgentRuntime({
      eventType: eventType === "all" ? undefined : eventType,
      status: status === "all" ? undefined : status,
      agentType: agentType === "all" ? undefined : agentType,
      workspaceId: workspaceId.trim() || undefined,
      operatorId: operatorId.trim() || undefined,
      memoryTag: memoryTag.trim() || undefined,
      limit: 40,
    })
      .then((data) => {
        if (cancelled) return;
        setRuntime(data);
        setSelectedCorrelationId((current) => {
          if (current && data.items.some((item) => item.correlationId === current)) {
            return current;
          }
          return data.items[0]?.correlationId ?? null;
        });
      })
      .catch((reason) => {
        if (cancelled) return;
        setError(reason instanceof Error ? reason.message : "No se pudo cargar el runtime.");
      })
      .finally(() => {
        if (!cancelled) {
          setLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [runtimeEnabled, eventType, status, agentType, workspaceId, operatorId, memoryTag]);

  useEffect(() => {
    if (!runtimeEnabled) {
      return;
    }

    let cancelled = false;
    setDomainEventsLoading(true);
    setDomainEventsError(null);

    void fetchDomainEvents({
      type: eventType === "all" ? undefined : eventType,
      limit: 30,
    })
      .then((data) => {
        if (!cancelled) {
          setDomainEvents(data);
        }
      })
      .catch((reason) => {
        if (!cancelled) {
          setDomainEventsError(reason instanceof Error ? reason.message : "No se pudieron cargar los domain events.");
        }
      })
      .finally(() => {
        if (!cancelled) {
          setDomainEventsLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [runtimeEnabled, eventType]);

  useEffect(() => {
    if (!runtimeEnabled || !selectedCorrelationId) {
      return;
    }

    let cancelled = false;
    const correlationId = selectedCorrelationId;
    setTraceLoading(true);
    setTraceError(null);

    void fetchOpsAgentRuntimeTrace(correlationId)
      .then((data) => {
        if (!cancelled) {
          setRuntimeTrace(data);
        }
      })
      .catch((reason) => {
        if (!cancelled) {
          setTraceError(reason instanceof Error ? reason.message : "No se pudo cargar el trace.");
        }
      })
      .finally(() => {
        if (!cancelled) {
          setTraceLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [runtimeEnabled, selectedCorrelationId, refreshTrace]);

  useEffect(() => {
    if (!runtimeEnabled || !selectedCorrelationId) {
      return;
    }

    let cancelled = false;
    const correlationId = selectedCorrelationId;
    setDomainEventTraceLoading(true);
    setDomainEventTraceError(null);

    void fetchDomainEventTrace(correlationId)
      .then((data) => {
        if (!cancelled) {
          setDomainEventTrace(data);
        }
      })
      .catch((reason) => {
        if (!cancelled) {
          setDomainEventTraceError(reason instanceof Error ? reason.message : "No se pudo cargar el trace del evento.");
        }
      })
      .finally(() => {
        if (!cancelled) {
          setDomainEventTraceLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [runtimeEnabled, selectedCorrelationId, refreshTrace]);

  const items = runtime?.items ?? EMPTY_RUNTIME_ITEMS;
  const visibleItems = items.filter((item) => {
    if (!query.trim()) {
      return true;
    }

    const needle = query.trim().toLowerCase();
    return (
      item.correlationId.toLowerCase().includes(needle) ||
      item.agentType.toLowerCase().includes(needle) ||
      (item.eventType ?? "").toLowerCase().includes(needle) ||
      (item.inputSummary ?? "").toLowerCase().includes(needle)
    );
  });

  const filterOptions = {
    eventTypes: Array.from(new Set(items.map((item) => item.eventType).filter(Boolean))) as string[],
    agentTypes: Array.from(new Set(items.map((item) => item.agentType))),
    statuses: Array.from(new Set(items.map((item) => item.status))),
  };

  const summary = {
    total: items.length,
    running: items.filter((item) => item.status === "running").length,
    failed: items.filter((item) => item.status === "failed").length,
    review: items.filter((item) => item.requiresHumanReview).length,
  };

  // Workers activos: runs en running con heartbeat reciente (< 30s)
  const activeWorkers = Array.from(
    new Map(
      items
        .filter((item) => item.status === "running" && item.workerId && item.heartbeatAt)
        .filter((item) => Date.now() - new Date(item.heartbeatAt!).getTime() < 30_000)
        .map((item) => [item.workerId!, item])
    ).values()
  );

  // Runs divergentes: status running pero heartbeat > 30s (probablemente muertos)
  const staleRunning = items.filter(
    (item) =>
      item.status === "running" &&
      item.heartbeatAt &&
      Date.now() - new Date(item.heartbeatAt).getTime() > 30_000
  );

  const traceRuns = runtimeTrace?.runs ?? [];
  const traceHasFailures = traceRuns.some((run) => run.status === "failed");
  const domainEventItems = domainEvents?.items ?? EMPTY_DOMAIN_EVENT_ITEMS;
  const selectedEvent = domainEventTrace?.event;

  function handleRetry(runId: string) {
    setRunActionLoading((prev) => ({ ...prev, [runId]: true }));
    setRunActionError((prev) => ({ ...prev, [runId]: "" }));
    void retryAgentRun(runId)
      .then(() => {
        setRefreshTrace((n) => n + 1);
      })
      .catch((reason: unknown) => {
        setRunActionError((prev) => ({
          ...prev,
          [runId]: reason instanceof Error ? reason.message : "Error al reintentar.",
        }));
      })
      .finally(() => {
        setRunActionLoading((prev) => ({ ...prev, [runId]: false }));
      });
  }

  function handleRequeue(runId: string) {
    setRunActionLoading((prev) => ({ ...prev, [runId]: true }));
    setRunActionError((prev) => ({ ...prev, [runId]: "" }));
    void requeueAgentRun(runId)
      .then(() => {
        setRefreshTrace((n) => n + 1);
      })
      .catch((reason: unknown) => {
        setRunActionError((prev) => ({
          ...prev,
          [runId]: reason instanceof Error ? reason.message : "Error al reencolar.",
        }));
      })
      .finally(() => {
        setRunActionLoading((prev) => ({ ...prev, [runId]: false }));
      });
  }

  function handleOpenIncident(event: React.FormEvent) {
    event.preventDefault();
    if (!incidentTitle.trim()) return;
    setIncidentLoading(true);
    setIncidentError(null);
    setIncidentSuccess(null);
    void openIncident({ title: incidentTitle.trim(), severity: incidentSeverity })
      .then(() => {
        setIncidentSuccess("Incidente abierto correctamente.");
        setIncidentTitle("");
        setShowIncidentForm(false);
      })
      .catch((reason: unknown) => {
        setIncidentError(reason instanceof Error ? reason.message : "Error al abrir el incidente.");
      })
      .finally(() => {
        setIncidentLoading(false);
      });
  }

  // Context Panel status badge helper
  const activeTraceStatusTag = (() => {
    if (!runtimeTrace) return undefined;
    const hasFailures = runtimeTrace.runs.some((run) => run.status === "failed");
    const hasStale = runtimeTrace.runs.some((run) => run.requiresHumanReview);
    if (hasFailures) {
      return { label: "Fallo", bg: "rgba(239,68,68,0.12)", border: "rgba(239,68,68,0.28)", color: "#f87171" };
    }
    if (hasStale) {
      return { label: "Review", bg: "rgba(245,158,11,0.12)", border: "rgba(245,158,11,0.28)", color: "#fbbf24" };
    }
    const allCompleted = runtimeTrace.runs.every((run) => run.status === "completed");
    if (allCompleted) {
      return { label: "Completado", bg: "rgba(16,185,129,0.12)", border: "rgba(16,185,129,0.28)", color: "#34d399" };
    }
    return { label: "Activo", bg: "rgba(59,130,246,0.12)", border: "rgba(59,130,246,0.28)", color: "#60a5fa" };
  })();

  const contextTabs = [
    { id: "summary", label: "Resumen" },
    { id: "event", label: "Evento" },
    { id: "timeline", label: "Timeline" },
    { id: "payload", label: "Payload" },
    { id: "actions", label: "Acciones" },
  ];

  const renderContextPanelContent = () => {
    switch (activeTab) {
      case "summary":
        return (
          <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
            {/* Trace runs stats summary */}
            {runtimeTrace && (
              <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: "10px" }}>
                {[
                  { label: "Triggers", value: runtimeTrace.summary.triggerCount, color: "#7dd3fc" },
                  { label: "Queued", value: runtimeTrace.summary.queued, color: "#60a5fa" },
                  { label: "Completed", value: runtimeTrace.summary.completed, color: "#34d399" },
                  { label: "Failed", value: runtimeTrace.summary.failed, color: "#f87171" },
                ].map((card) => (
                  <div
                    key={card.label}
                    style={{
                      borderRadius: "12px",
                      border: "1px solid rgba(148,163,184,0.16)",
                      background: "rgba(15,23,42,0.44)",
                      padding: "10px 12px",
                    }}
                  >
                    <span style={{ display: "block", fontSize: "11px", color: "var(--muted)", textTransform: "uppercase", letterSpacing: "0.06em" }}>
                      {card.label}
                    </span>
                    <strong style={{ display: "block", marginTop: "4px", fontSize: "20px", color: card.color }}>
                      {card.value}
                    </strong>
                  </div>
                ))}
              </div>
            )}

            {/* List of Runs in Trace */}
            <div style={{ borderRadius: "14px", border: "1px solid rgba(148,163,184,0.16)", background: "rgba(15,23,42,0.28)", padding: "14px" }}>
              <p style={{ fontSize: "11px", color: "var(--muted)", letterSpacing: "0.08em", textTransform: "uppercase", fontWeight: 700, marginBottom: "10px" }}>
                Runs dentro del trace
              </p>
              {traceRuns.length === 0 ? (
                <p style={{ fontSize: "12px", color: "var(--muted)" }}>No hay runs registrados para este trace.</p>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                  {traceRuns.map((run) => {
                    const isActing = runActionLoading[run.id] ?? false;
                    const actErr = runActionError[run.id] ?? "";
                    return (
                      <div
                        key={run.id}
                        style={{
                          borderRadius: "12px",
                          border: "1px solid rgba(148,163,184,0.12)",
                          background: "rgba(15,23,42,0.2)",
                          padding: "12px",
                        }}
                      >
                        <div style={{ display: "flex", justifyContent: "space-between", gap: "10px", flexWrap: "wrap", alignItems: "center" }}>
                          <strong style={{ fontSize: "13px", color: "var(--ink)" }}>{run.agentType}</strong>
                          <div style={{ display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap" }}>
                            <span style={{ fontSize: "11px", color: "var(--muted)" }}>{run.status}</span>
                            {run.status === "failed" ? (
                              <button
                                type="button"
                                disabled={isActing}
                                onClick={() => handleRetry(run.id)}
                                style={{
                                  fontSize: "11px",
                                  fontWeight: 700,
                                  padding: "3px 10px",
                                  borderRadius: "999px",
                                  border: "1px solid rgba(251,191,36,0.38)",
                                  background: "rgba(245,158,11,0.12)",
                                  color: "#fbbf24",
                                  cursor: isActing ? "not-allowed" : "pointer",
                                  opacity: isActing ? 0.6 : 1,
                                }}
                              >
                                {isActing ? "..." : t("ops.retry")}
                              </button>
                            ) : null}
                            {run.deadLettered ? (
                              <button
                                type="button"
                                disabled={isActing}
                                onClick={() => handleRequeue(run.id)}
                                style={{
                                  fontSize: "11px",
                                  fontWeight: 700,
                                  padding: "3px 10px",
                                  borderRadius: "999px",
                                  border: "1px solid rgba(59,130,246,0.38)",
                                  background: "rgba(59,130,246,0.12)",
                                  color: "#60a5fa",
                                  cursor: isActing ? "not-allowed" : "pointer",
                                  opacity: isActing ? 0.6 : 1,
                                }}
                              >
                                {isActing ? "..." : t("ops.requeue")}
                              </button>
                            ) : null}
                          </div>
                        </div>
                        <p style={{ fontSize: "12px", color: "var(--muted)", marginTop: "4px", margin: "4px 0 0" }}>
                          {run.triggerType} · {run.workerId ?? "worker-pending"}
                        </p>
                        {run.outputSummary ? (
                          <p style={{ fontSize: "12px", color: "#a5f3fc", marginTop: "6px", fontStyle: "italic", margin: "6px 0 0" }}>
                            {run.outputSummary}
                          </p>
                        ) : null}
                        {(() => {
                          const next = nextActionForAgent(run.agentType, run.status, run.requiresHumanReview);
                          return next ? (
                            <p style={{ fontSize: "11px", color: "#fbbf24", marginTop: "4px", fontWeight: 600, margin: "4px 0 0" }}>
                              ▶ {next}
                            </p>
                          ) : null;
                        })()}
                        {actErr ? <p style={{ fontSize: "11px", color: "#fca5a5", marginTop: "4px", margin: "4px 0 0" }}>{actErr}</p> : null}
                        {run.operatorContext ? (
                          <div style={{ display: "flex", gap: "6px", flexWrap: "wrap", marginTop: "8px" }}>
                            {[
                              run.operatorContext.source,
                              run.operatorContext.scope,
                              run.operatorContext.workspaceId ? `workspace:${run.operatorContext.workspaceId}` : undefined,
                              run.operatorContext.repoId ? `repo:${run.operatorContext.repoId}` : undefined,
                            ].filter((value): value is string => Boolean(value)).map((value) => (
                              <span
                                key={`${run.id}-${value}`}
                                style={{
                                  fontSize: "10px",
                                  color: "#7dd3fc",
                                  border: "1px solid rgba(125,211,252,0.2)",
                                  borderRadius: "999px",
                                  padding: "3px 7px",
                                }}
                              >
                                {value}
                              </span>
                            ))}
                          </div>
                        ) : null}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Workspace memory */}
            {runtimeTrace && runtimeTrace.workspaceMemory.length > 0 && (
              <div style={{ borderRadius: "14px", border: "1px solid rgba(34,211,238,0.18)", background: "rgba(8,47,73,0.18)", padding: "14px" }}>
                <p style={{ fontSize: "11px", color: "#7dd3fc", letterSpacing: "0.08em", textTransform: "uppercase", fontWeight: 700, marginBottom: "10px" }}>
                  Workspace memory
                </p>
                <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                  {runtimeTrace.workspaceMemory.map((memory) => (
                    <div key={memory.id} style={{ borderRadius: "12px", border: "1px solid rgba(125,211,252,0.12)", padding: "10px 12px", background: "rgba(8,47,73,0.1)" }}>
                      <strong style={{ display: "block", fontSize: "13px", color: "var(--ink)" }}>{memory.title}</strong>
                      <p style={{ fontSize: "12px", color: "var(--muted)", marginTop: "4px", margin: "4px 0 0" }}>{memory.summary}</p>
                      <div style={{ display: "flex", gap: "6px", flexWrap: "wrap", marginTop: "8px" }}>
                        {[memory.kind, memory.scope, ...(memory.tags ?? []).slice(0, 3)].map((tag) => (
                          <span
                            key={`${memory.id}-${tag}`}
                            style={{
                              fontSize: "10px",
                              color: "#bae6fd",
                              border: "1px solid rgba(125,211,252,0.16)",
                              borderRadius: "999px",
                              padding: "3px 7px",
                            }}
                          >
                            {tag}
                          </span>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        );
      case "event":
        return (
          <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
            {selectedEvent ? (
              <div style={{ borderRadius: "14px", border: "1px solid rgba(196,181,253,0.2)", background: "rgba(76,29,149,0.12)", padding: "14px" }}>
                <div style={{ display: "flex", alignItems: "center", gap: "8px", color: "#c4b5fd", marginBottom: "8px" }}>
                  <Sparkles size={14} />
                  <span style={{ fontSize: "11px", textTransform: "uppercase", letterSpacing: "0.08em", fontWeight: 700 }}>Evento raíz</span>
                </div>
                <strong style={{ fontSize: "15px", color: "var(--ink)" }}>{selectedEvent.type}</strong>
                <p style={{ fontSize: "12px", color: "var(--muted)", marginTop: "6px", wordBreak: "break-word", margin: "6px 0 0" }}>
                  {selectedEvent.correlationId}
                </p>
                <p style={{ fontSize: "12px", color: "var(--muted)", marginTop: "6px", margin: "6px 0 0" }}>
                  Actor: {selectedEvent.meta?.actorType ?? "n/a"} · {selectedEvent.actorUserId ?? selectedEvent.meta?.actorId ?? "system"}
                </p>
              </div>
            ) : runtimeTrace?.event ? (
              <div style={{ borderRadius: "14px", border: "1px solid rgba(125,211,252,0.18)", background: "rgba(8,47,73,0.25)", padding: "14px" }}>
                <p style={{ fontSize: "11px", color: "#7dd3fc", letterSpacing: "0.08em", textTransform: "uppercase", fontWeight: 700, marginBottom: "6px" }}>
                  Domain Event
                </p>
                <strong style={{ fontSize: "15px", color: "var(--ink)" }}>{runtimeTrace.event.eventType ?? runtimeTrace.event.action}</strong>
                <p style={{ fontSize: "12px", color: "var(--muted)", marginTop: "6px", margin: "6px 0 0" }}>
                  Triggers: {runtimeTrace.event.triggers.join(", ") || "n/a"}
                </p>
              </div>
            ) : (
              <div style={{ padding: "16px", color: "var(--muted)", textAlign: "center" }}>
                No hay información del evento raíz disponible.
              </div>
            )}
          </div>
        );
      case "timeline":
        const hasTimelines = (runtimeTrace?.timeline && runtimeTrace.timeline.length > 0) || (domainEventTrace?.timeline && domainEventTrace.timeline.length > 0);
        return (
          <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
            {!hasTimelines && (
              <div style={{ padding: "16px", color: "var(--muted)", textAlign: "center" }}>
                Línea temporal vacía.
              </div>
            )}

            {/* Event trace timeline */}
            {domainEventTrace?.timeline && domainEventTrace.timeline.length > 0 && (
              <div>
                <p style={{ fontSize: "11px", color: "#c4b5fd", letterSpacing: "0.08em", textTransform: "uppercase", fontWeight: 700, marginBottom: "12px" }}>
                  Historial Causal (Eventos)
                </p>
                <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                  {domainEventTrace.timeline.map((entry) => (
                    <div key={entry.id} style={{ display: "grid", gridTemplateColumns: "12px minmax(0, 1fr)", gap: "10px" }}>
                      <div style={{ width: "10px", height: "10px", borderRadius: "50%", background: "linear-gradient(135deg, #a78bfa, #c4b5fd)", marginTop: "6px" }} />
                      <div style={{ borderBottom: "1px solid rgba(148,163,184,0.12)", paddingBottom: "10px" }}>
                        <strong style={{ display: "block", fontSize: "13px", color: "var(--ink)" }}>{entry.action}</strong>
                        <p style={{ fontSize: "12px", color: "var(--muted)", marginTop: "4px", margin: "4px 0 0" }}>{entry.entityType}:{entry.entityId}</p>
                        <div style={{ display: "flex", alignItems: "center", gap: "6px", fontSize: "11px", color: "var(--muted)", marginTop: "4px" }}>
                          <Clock3 size={12} />
                          <span>{formatTimestamp(entry.timestamp)}</span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Agent runtime timeline */}
            {runtimeTrace?.timeline && runtimeTrace.timeline.length > 0 && (
              <div>
                <p style={{ fontSize: "11px", color: "#22d3ee", letterSpacing: "0.08em", textTransform: "uppercase", fontWeight: 700, marginBottom: "12px" }}>
                  Historial de Ejecución (Agentes)
                </p>
                <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                  {runtimeTrace.timeline.map((entry) => (
                    <div key={entry.id} style={{ display: "grid", gridTemplateColumns: "12px minmax(0, 1fr)", gap: "10px" }}>
                      <div style={{ width: "10px", height: "10px", borderRadius: "50%", background: "linear-gradient(135deg, #22d3ee, #38bdf8)", marginTop: "6px" }} />
                      <div style={{ borderBottom: "1px solid rgba(148,163,184,0.12)", paddingBottom: "10px" }}>
                        <strong style={{ display: "block", fontSize: "13px", color: "var(--ink)" }}>{entry.action}</strong>
                        <p style={{ fontSize: "12px", color: "var(--muted)", marginTop: "4px", margin: "4px 0 0" }}>{entry.entityType}:{entry.entityId}</p>
                        <div style={{ display: "flex", alignItems: "center", gap: "6px", fontSize: "11px", color: "var(--muted)", marginTop: "4px" }}>
                          <Clock3 size={12} />
                          <span>{formatTimestamp(entry.timestamp)}</span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        );
      case "payload":
        return (
          <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
            {selectedEvent ? (
              <div style={{ borderRadius: "14px", border: "1px solid rgba(148,163,184,0.16)", background: "rgba(15,23,42,0.28)", padding: "14px" }}>
                <p style={{ fontSize: "11px", color: "var(--muted)", letterSpacing: "0.08em", textTransform: "uppercase", fontWeight: 700, marginBottom: "10px" }}>
                  Event Payload JSON
                </p>
                <pre style={{ margin: 0, whiteSpace: "pre-wrap", wordBreak: "break-all", fontSize: "12px", color: "var(--ink)", fontFamily: "monospace", overflowX: "auto" }}>
                  {JSON.stringify(selectedEvent.payload ?? {}, null, 2)}
                </pre>
              </div>
            ) : (
              <div style={{ padding: "16px", color: "var(--muted)", textAlign: "center" }}>
                No hay payload de evento disponible.
              </div>
            )}
          </div>
        );
      case "actions":
        return (
          <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
            <div style={{ borderRadius: "14px", border: "1px solid rgba(148,163,184,0.16)", background: "rgba(15,23,42,0.28)", padding: "16px", display: "grid", gap: "12px" }}>
              <h4 style={{ margin: 0, fontSize: "14px", fontWeight: 700, color: "var(--ink)" }}>Gestión de Incidentes</h4>
              <p style={{ margin: 0, fontSize: "12px", color: "var(--muted)" }}>
                Si esta corrida contiene fallos críticos de orquestación, abre un incidente para alertar a los administradores.
              </p>

              {incidentSuccess && (
                <div style={{ padding: "10px", borderRadius: "8px", background: "rgba(16,185,129,0.08)", border: "1px solid rgba(16,185,129,0.2)", color: "#34d399", fontSize: "12px" }}>
                  {incidentSuccess}
                </div>
              )}

              {incidentError && (
                <div style={{ padding: "10px", borderRadius: "8px", background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.2)", color: "#f87171", fontSize: "12px" }}>
                  {incidentError}
                </div>
              )}

              {!showIncidentForm ? (
                <button
                  type="button"
                  onClick={() => { setShowIncidentForm(true); setIncidentSuccess(null); setIncidentError(null); }}
                  style={{
                    fontSize: "12px",
                    fontWeight: 700,
                    padding: "8px 16px",
                    borderRadius: "8px",
                    border: "1px solid rgba(239,68,68,0.38)",
                    background: "rgba(239,68,68,0.14)",
                    color: "#f87171",
                    cursor: "pointer",
                    textAlign: "center",
                  }}
                >
                  Abrir Nuevo Incidente
                </button>
              ) : (
                <form onSubmit={handleOpenIncident} style={{ display: "grid", gap: "10px" }}>
                  <input
                    required
                    value={incidentTitle}
                    onChange={(e) => setIncidentTitle(e.target.value)}
                    placeholder="Título descriptivo del incidente"
                    style={{
                      height: "36px",
                      borderRadius: "8px",
                      border: "1px solid rgba(239,68,68,0.28)",
                      background: "rgba(15,23,42,0.6)",
                      color: "var(--ink)",
                      padding: "0 12px",
                      fontSize: "13px",
                    }}
                  />
                  <div style={{ display: "flex", gap: "10px", alignItems: "center", flexWrap: "wrap" }}>
                    <select
                      value={incidentSeverity}
                      onChange={(e) => setIncidentSeverity(e.target.value as "watch" | "critical")}
                      style={{
                        height: "36px",
                        borderRadius: "8px",
                        border: "1px solid rgba(239,68,68,0.28)",
                        background: "rgba(15,23,42,0.6)",
                        color: "var(--ink)",
                        padding: "0 12px",
                        fontSize: "13px",
                      }}
                    >
                      <option value="watch">watch (Monitoreo)</option>
                      <option value="critical">critical (Crítico)</option>
                    </select>
                    <button
                      type="submit"
                      disabled={incidentLoading}
                      style={{
                        fontSize: "12px",
                        fontWeight: 700,
                        padding: "0 16px",
                        height: "36px",
                        borderRadius: "8px",
                        border: "1px solid rgba(239,68,68,0.38)",
                        background: "rgba(239,68,68,0.18)",
                        color: "#f87171",
                        cursor: incidentLoading ? "not-allowed" : "pointer",
                        opacity: incidentLoading ? 0.6 : 1,
                      }}
                    >
                      {incidentLoading ? "Abriendo..." : "Confirmar"}
                    </button>
                    <button
                      type="button"
                      onClick={() => { setShowIncidentForm(false); setIncidentError(null); }}
                      style={{
                        fontSize: "12px",
                        padding: "0 12px",
                        height: "36px",
                        borderRadius: "8px",
                        border: "1px solid rgba(148,163,184,0.22)",
                        background: "transparent",
                        color: "var(--muted)",
                        cursor: "pointer",
                      }}
                    >
                      Cancelar
                    </button>
                  </div>
                </form>
              )}
            </div>
          </div>
        );
      default:
        return null;
    }
  };

  return (
    <div style={{ maxWidth: "1400px", margin: "0 auto", display: "grid", gap: "18px", padding: "0 10px" }}>
      {/* Top Banner and Summary Stats */}
      <section
        style={{
          border: "1px solid var(--border)",
          borderRadius: "18px",
          background: "linear-gradient(135deg, rgba(12,16,34,0.96), rgba(18,26,48,0.92))",
          padding: "22px",
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", gap: "16px", flexWrap: "wrap", alignItems: "flex-start" }}>
          <div>
            <Link href="/admin/dashboard" style={{ display: "inline-flex", alignItems: "center", gap: "5px", color: "#7dd3fc", fontSize: "12px", fontWeight: 600, textDecoration: "none", marginBottom: "8px", opacity: 0.7 }}>
              <span style={{ fontSize: "14px" }}>←</span> Dashboard
            </Link>
            <p style={{ fontSize: "11px", letterSpacing: "0.14em", textTransform: "uppercase", color: "#7dd3fc", fontWeight: 700, marginBottom: "8px" }}>
              Ops Runtime
            </p>
            <h1 style={{ fontSize: "28px", fontWeight: 800, color: "var(--ink)", marginBottom: "6px" }}>
              {t("page.operations")}
            </h1>
            <p style={{ fontSize: "14px", color: "var(--muted)", maxWidth: "760px" }}>
              Seguimiento vivo de eventos, disparos de agentes y auditoría por correlationId. El enfoque visual toma ideas del `web-assistant-portal`: layout modular, foco en selección rápida y lectura limpia del detalle.
            </p>
            {error ? <p style={{ fontSize: "12px", color: "#fca5a5", marginTop: "10px" }}>{error}</p> : null}
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: "8px", alignItems: "flex-end" }}>
            <NotificationBanner audience="admin" />
            <div
              style={{
                display: "grid",
                gap: "8px",
                minWidth: "220px",
                padding: "14px 16px",
                borderRadius: "14px",
                background: "rgba(15,23,42,0.68)",
                border: "1px solid rgba(125,211,252,0.16)",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: "8px", color: "#7dd3fc" }}>
                <Radar size={14} />
                <span style={{ fontSize: "12px", fontWeight: 700 }}>
                  {runtimeEnabled ? "Runtime activo" : "Modo desconectado"}
                </span>
              </div>
              <span style={{ fontSize: "12px", color: "var(--muted)", wordBreak: "break-all", fontFamily: "monospace" }}>
                {selectedCorrelationId ? selectedCorrelationId : "Selecciona una corrida para inspeccionar trace."}
              </span>
            </div>
          </div>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: "12px", marginTop: "18px" }}>
          {[
            { label: "Runs cargados", value: summary.total, tone: "#7dd3fc", icon: Activity },
            { label: "Running", value: summary.running, tone: "#60a5fa", icon: Workflow },
            { label: "Failed", value: summary.failed, tone: "#f87171", icon: ShieldAlert },
            { label: "Human review", value: summary.review, tone: "#fbbf24", icon: Bot },
          ].map((card) => {
            const Icon = card.icon;
            return (
              <div
                key={card.label}
                style={{
                  borderRadius: "14px",
                  border: "1px solid rgba(148,163,184,0.16)",
                  background: "rgba(15,23,42,0.6)",
                  padding: "14px 16px",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: "8px", color: card.tone, marginBottom: "8px" }}>
                  <Icon size={14} />
                  <span style={{ fontSize: "11px", textTransform: "uppercase", letterSpacing: "0.08em", fontWeight: 700 }}>{card.label}</span>
                </div>
                <strong style={{ fontSize: "28px", lineHeight: 1, color: "var(--ink)" }}>{card.value}</strong>
              </div>
            );
          })}
        </div>

        {/* Workers activos y runs divergentes */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: "12px", marginTop: "12px" }}>
          <div style={{ borderRadius: "12px", border: "1px solid rgba(52,211,153,0.2)", background: "rgba(16,185,129,0.06)", padding: "12px 14px" }}>
            <p style={{ fontSize: "11px", color: "#34d399", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.07em", marginBottom: "8px" }}>
              Workers activos ({activeWorkers.length})
            </p>
            {activeWorkers.length === 0 ? (
              <p style={{ fontSize: "12px", color: "var(--muted)" }}>Ningún worker reportando heartbeat.</p>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
                {activeWorkers.map((w) => (
                  <div key={w.workerId} style={{ fontSize: "12px", color: "var(--ink)", display: "flex", gap: "8px", alignItems: "center" }}>
                    <span style={{ width: "8px", height: "8px", borderRadius: "50%", background: "#34d399", flexShrink: 0 }} />
                    <span style={{ fontFamily: "monospace" }}>{w.workerId}</span>
                    <span style={{ fontSize: "11px", color: "var(--muted)" }}>heartbeat {w.heartbeatAt ? new Date(w.heartbeatAt).toLocaleTimeString("es-MX", { hour: "2-digit", minute: "2-digit", second: "2-digit" }) : "—"}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
          <div style={{ borderRadius: "12px", border: `1px solid ${staleRunning.length > 0 ? "rgba(239,68,68,0.25)" : "rgba(148,163,184,0.14)"}`, background: staleRunning.length > 0 ? "rgba(239,68,68,0.06)" : "rgba(15,23,42,0.3)", padding: "12px 14px" }}>
            <p style={{ fontSize: "11px", color: staleRunning.length > 0 ? "#f87171" : "var(--muted)", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.07em", marginBottom: "8px" }}>
              Runs divergentes ({staleRunning.length})
            </p>
            {staleRunning.length === 0 ? (
              <p style={{ fontSize: "12px", color: "var(--muted)" }}>Sin divergencia Redis/DB detectada.</p>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
                {staleRunning.slice(0, 5).map((r) => (
                  <div key={r.id} style={{ fontSize: "12px", color: "#fca5a5", display: "flex", gap: "8px" }}>
                    <span>{r.agentType}</span>
                    <span style={{ fontSize: "11px", color: "var(--muted)", fontFamily: "monospace" }}>{r.id.slice(-8)}</span>
                  </div>
                ))}
                {staleRunning.length > 5 ? <p style={{ fontSize: "11px", color: "var(--muted)" }}>+{staleRunning.length - 5} más</p> : null}
              </div>
            )}
          </div>
        </div>
      </section>

      {/* Two-Zone Layout */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: selectedCorrelationId ? "1fr 480px" : "1fr",
          gap: "18px",
          alignItems: "start",
        }}
      >
        {/* Left Workspace Column */}
        <div style={{ display: "flex", flexDirection: "column", gap: "18px" }}>
          
          {/* Active Filters */}
          <section
            style={{
              display: "grid",
              gridTemplateColumns: selectedCorrelationId ? "1fr" : "minmax(0, 1fr) minmax(300px, 0.9fr)",
              gap: "14px",
            }}
          >
            <article style={{ border: "1px solid var(--border)", borderRadius: "16px", background: "var(--surface)", padding: "18px" }}>
              <div style={{ display: "flex", justifyContent: "space-between", gap: "12px", flexWrap: "wrap", marginBottom: "14px" }}>
                <div>
                  <h2 style={{ fontSize: "18px", fontWeight: 800, color: "var(--ink)", margin: 0 }}>Filtros activos</h2>
                  <p style={{ fontSize: "12px", color: "var(--muted)", margin: "4px 0 0" }}>Controla el runtime por evento, estado y agente.</p>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: "8px", color: "var(--muted)" }}>
                  <Filter size={14} />
                  <span style={{ fontSize: "12px" }}>{visibleItems.length} visibles</span>
                </div>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", gap: "10px" }}>
                <label style={{ position: "relative", gridColumn: selectedCorrelationId ? "span 1" : "span 2" }}>
                  <Search size={14} style={{ position: "absolute", left: "12px", top: "50%", transform: "translateY(-50%)", color: "var(--muted)" }} />
                  <input
                    value={query}
                    onChange={(event) => setQuery(event.target.value)}
                    placeholder="Buscar correlationId o agente"
                    style={{
                      width: "100%",
                      height: "40px",
                      paddingLeft: "36px",
                      paddingRight: "12px",
                      borderRadius: "10px",
                      border: "1px solid var(--border)",
                      background: "var(--bg)",
                      color: "var(--ink)",
                    }}
                  />
                </label>

                {[
                  {
                    value: eventType,
                    onChange: setEventType,
                    options: filterOptions.eventTypes,
                    allLabel: "Todos los eventos",
                  },
                  {
                    value: status,
                    onChange: setStatus,
                    options: filterOptions.statuses,
                    allLabel: "Todos los estados",
                  },
                  {
                    value: agentType,
                    onChange: setAgentType,
                    options: filterOptions.agentTypes,
                    allLabel: "Todos los agentes",
                  },
                ].map((filterConfig, index) => (
                  <select
                    key={index}
                    value={filterConfig.value}
                    onChange={(event) => filterConfig.onChange(event.target.value)}
                    style={{
                      height: "40px",
                      borderRadius: "10px",
                      border: "1px solid var(--border)",
                      background: "var(--bg)",
                      color: "var(--ink)",
                      padding: "0 12px",
                    }}
                  >
                    <option value="all">{filterConfig.allLabel}</option>
                    {filterConfig.options.map((option) => (
                      <option key={option} value={option}>{option}</option>
                    ))}
                  </select>
                ))}
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", gap: "10px", marginTop: "10px" }}>
                {[
                  { label: "workspaceId", value: workspaceId, onChange: setWorkspaceId, placeholder: "Filtrar por workspace" },
                  { label: "operatorId", value: operatorId, onChange: setOperatorId, placeholder: "Filtrar por operador" },
                  { label: "memoryTag", value: memoryTag, onChange: setMemoryTag, placeholder: "Tag de memoria" },
                ].map((filterConfig) => (
                  <label key={filterConfig.label} style={{ display: "grid", gap: "5px" }}>
                    <span style={{ fontSize: "10px", color: "var(--muted)", textTransform: "uppercase", letterSpacing: "0.08em", fontWeight: 700 }}>
                      {filterConfig.label}
                    </span>
                    <input
                      value={filterConfig.value}
                      onChange={(event) => filterConfig.onChange(event.target.value)}
                      placeholder={filterConfig.placeholder}
                      style={{
                        width: "100%",
                        height: "38px",
                        padding: "0 12px",
                        borderRadius: "10px",
                        border: "1px solid var(--border)",
                        background: "var(--bg)",
                        color: "var(--ink)",
                      }}
                    />
                  </label>
                ))}
              </div>
            </article>

            {(!selectedCorrelationId) && (
              <article style={{ border: "1px solid var(--border)", borderRadius: "16px", background: "var(--surface)", padding: "18px" }}>
                <h2 style={{ fontSize: "18px", fontWeight: 800, color: "var(--ink)", margin: 0, marginBottom: "10px" }}>Lectura operativa</h2>
                <div style={{ display: "grid", gap: "10px" }}>
                  {[
                    "Prioriza correlationId con failed o requiresHumanReview.",
                    "Usa eventType para aislar rutas como dispute.opened o milestone.submitted.",
                    "El trace muestra la cadena completa desde domain.event.emit hasta complete/failed.",
                  ].map((note) => (
                    <div
                      key={note}
                      style={{
                        borderRadius: "12px",
                        border: "1px solid rgba(148,163,184,0.16)",
                        background: "rgba(15,23,42,0.45)",
                        padding: "10px 12px",
                        fontSize: "13px",
                        color: "var(--muted)",
                      }}
                    >
                      {note}
                    </div>
                  ))}
                </div>
              </article>
            )}
          </section>

          {/* Queue Lists Workspace */}
          <div
            style={{
              display: "grid",
              gridTemplateColumns: selectedCorrelationId ? "1fr" : "1fr 1fr",
              gap: "18px",
            }}
          >
            {/* Domain Events Queue */}
            <article style={{ border: "1px solid var(--border)", borderRadius: "16px", background: "var(--surface)", padding: "18px" }}>
              <div style={{ display: "flex", justifyContent: "space-between", gap: "12px", marginBottom: "12px", alignItems: "center" }}>
                <div>
                  <h2 style={{ fontSize: "18px", fontWeight: 800, color: "var(--ink)", margin: 0 }}>Domain events</h2>
                  <p style={{ fontSize: "12px", color: "var(--muted)", margin: "4px 0 0" }}>Eventos emitidos antes del runtime de agentes.</p>
                </div>
                {domainEventsLoading ? <span style={{ fontSize: "12px", color: "var(--muted)" }}>Cargando...</span> : null}
              </div>

              {domainEventsError ? <p style={{ fontSize: "12px", color: "#fca5a5", marginBottom: "10px" }}>{domainEventsError}</p> : null}

              <div style={{ display: "grid", gap: "10px", maxHeight: "650px", overflowY: "auto", paddingRight: "4px" }}>
                {domainEventItems.map((item) => {
                  const active = item.correlationId === selectedCorrelationId;
                  return (
                    <button
                      key={item.auditId}
                      onClick={() => setSelectedCorrelationId(item.correlationId)}
                      type="button"
                      style={{
                        textAlign: "left",
                        borderRadius: "14px",
                        border: active ? "1px solid rgba(196,181,253,0.38)" : "1px solid rgba(148,163,184,0.16)",
                        background: active ? "rgba(76,29,149,0.18)" : "rgba(15,23,42,0.44)",
                        padding: "14px",
                        cursor: "pointer",
                        width: "100%",
                      }}
                    >
                      <div style={{ display: "flex", justifyContent: "space-between", gap: "12px", alignItems: "center", flexWrap: "wrap" }}>
                        <strong style={{ fontSize: "14px", color: "var(--ink)" }}>{item.type}</strong>
                        <span style={{ fontSize: "11px", color: "#c4b5fd", fontWeight: 700, textTransform: "uppercase" }}>
                          {item.triggers.length} triggers
                        </span>
                      </div>
                      <p style={{ fontSize: "12px", color: "var(--muted)", marginTop: "6px", wordBreak: "break-word", margin: "6px 0 0", fontFamily: "monospace" }}>
                        {item.correlationId}
                      </p>
                      <div style={{ display: "flex", gap: "8px", flexWrap: "wrap", marginTop: "10px" }}>
                        {item.triggers.slice(0, 4).map((trigger) => (
                          <span
                            key={trigger}
                            style={{
                              fontSize: "11px",
                              color: "var(--muted)",
                              border: "1px solid rgba(148,163,184,0.16)",
                              borderRadius: "999px",
                              padding: "4px 8px",
                            }}
                          >
                            {trigger}
                          </span>
                        ))}
                      </div>
                    </button>
                  );
                })}
              </div>
            </article>

            {/* Corridas Recientes Queue */}
            <article style={{ border: "1px solid var(--border)", borderRadius: "16px", background: "var(--surface)", padding: "18px" }}>
              <div style={{ display: "flex", justifyContent: "space-between", gap: "12px", marginBottom: "12px", alignItems: "center" }}>
                <div>
                  <h2 style={{ fontSize: "18px", fontWeight: 800, color: "var(--ink)", margin: 0 }}>Corridas recientes</h2>
                  <p style={{ fontSize: "12px", color: "var(--muted)", margin: "4px 0 0" }}>Runs cargados desde la Ops API de agentes.</p>
                </div>
                {loading ? <span style={{ fontSize: "12px", color: "var(--muted)" }}>Cargando...</span> : null}
              </div>

              <div style={{ display: "grid", gap: "10px", maxHeight: "650px", overflowY: "auto", paddingRight: "4px" }}>
                {visibleItems.map((item) => {
                  const tone = statusTone(item.status);
                  const active = item.correlationId === selectedCorrelationId;
                  return (
                    <button
                      key={item.id}
                      onClick={() => setSelectedCorrelationId(item.correlationId)}
                      type="button"
                      style={{
                        textAlign: "left",
                        borderRadius: "14px",
                        border: active ? "1px solid rgba(125,211,252,0.38)" : "1px solid rgba(148,163,184,0.16)",
                        background: active ? "rgba(8,47,73,0.36)" : "rgba(15,23,42,0.44)",
                        padding: "14px",
                        cursor: "pointer",
                        width: "100%",
                      }}
                    >
                      <div style={{ display: "flex", justifyContent: "space-between", gap: "12px", alignItems: "center", flexWrap: "wrap" }}>
                        <strong style={{ fontSize: "14px", color: "var(--ink)" }}>{item.eventType ?? "event.unknown"}</strong>
                        <span
                          style={{
                            padding: "4px 10px",
                            borderRadius: "999px",
                            fontSize: "11px",
                            fontWeight: 700,
                            background: tone.bg,
                            border: `1px solid ${tone.border}`,
                            color: tone.color,
                            textTransform: "uppercase",
                          }}
                        >
                          {item.status}
                        </span>
                      </div>
                      <p style={{ fontSize: "12px", color: "var(--muted)", marginTop: "6px", wordBreak: "break-word", margin: "6px 0 0", fontFamily: "monospace" }}>
                        {item.correlationId}
                      </p>
                      <div style={{ display: "flex", gap: "8px", flexWrap: "wrap", marginTop: "10px" }}>
                        {[
                          item.agentType,
                          item.triggerType,
                          item.workerId ?? "worker-pending",
                          item.operatorContext?.workspaceId ? `workspace:${item.operatorContext.workspaceId}` : undefined,
                        ].filter((value): value is string => Boolean(value)).map((value) => (
                          <span
                            key={value}
                            style={{
                              fontSize: "11px",
                              color: "var(--muted)",
                              border: "1px solid rgba(148,163,184,0.16)",
                              borderRadius: "999px",
                              padding: "4px 8px",
                            }}
                          >
                            {value}
                          </span>
                        ))}
                      </div>
                      <div style={{ display: "flex", justifyContent: "space-between", gap: "10px", marginTop: "10px", fontSize: "11px", color: "var(--muted)", flexWrap: "wrap", margin: "10px 0 0" }}>
                        <span>Intentos {item.attempts}/{item.maxAttempts}</span>
                        <span>{item.requiresHumanReview ? "Human review" : "Auto-flow"}</span>
                        <span>{formatTimestamp(item.updatedAt)}</span>
                      </div>
                      {item.outputSummary ? (
                        <p style={{ fontSize: "11px", color: "#a5f3fc", marginTop: "6px", fontStyle: "italic", textAlign: "left", margin: "6px 0 0" }}>
                          {item.outputSummary}
                        </p>
                      ) : null}
                      {(() => {
                        const next = nextActionForAgent(item.agentType, item.status, item.requiresHumanReview);
                        return next ? (
                          <p style={{ fontSize: "11px", color: "#fbbf24", marginTop: "4px", fontWeight: 600, textAlign: "left", margin: "4px 0 0" }}>
                            ▶ {next}
                          </p>
                        ) : null;
                      })()}
                    </button>
                  );
                })}

                {!loading && visibleItems.length === 0 ? (
                  <div style={{ borderRadius: "14px", border: "1px dashed rgba(148,163,184,0.24)", padding: "16px", color: "var(--muted)", textAlign: "center" }}>
                    No hay corridas que coincidan con los filtros activos.
                  </div>
                ) : null}
              </div>
            </article>
          </div>

          {/* Pending Approvals Section */}
          <section style={{ display: "flex", flexDirection: "column", gap: "16px", marginTop: "10px" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
              <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                <ShieldAlert size={18} color="#f59e0b" />
                <h2 style={{ margin: 0, fontSize: "1rem", fontWeight: 700 }}>Aprobaciones Pendientes</h2>
                {pendingApprovals.length > 0 && (
                  <span style={{ padding: "2px 8px", borderRadius: 999, background: "rgba(245,158,11,0.15)", color: "#fbbf24", fontSize: 11, fontWeight: 800 }}>
                    {pendingApprovals.length}
                  </span>
                )}
              </div>
              <button
                onClick={() => void loadPendingApprovals()}
                disabled={approvalsLoading}
                style={{ padding: "6px 12px", borderRadius: 8, border: "1px solid var(--border)", background: "transparent", color: "var(--muted)", fontSize: 12, cursor: "pointer", opacity: approvalsLoading ? 0.5 : 1 }}
              >
                {approvalsLoading ? "Cargando..." : t("ui.refresh")}
              </button>
            </div>

            {pendingApprovals.length === 0 && !approvalsLoading && (
              <div style={{ padding: "14px 16px", borderRadius: 12, border: "1px dashed rgba(148,163,184,0.24)", color: "var(--muted)", fontSize: 13 }}>
                No hay aprobaciones pendientes.
              </div>
            )}

            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))", gap: "12px" }}>
              {pendingApprovals.map((approval) => {
                const isBusy = approvalDecidingId === approval.id;
                const feedback = approvalFeedback?.id === approval.id ? approvalFeedback : null;
                const context = (() => {
                  try { return JSON.parse(approval.contextSummary ?? "{}") as Record<string, unknown>; } catch { return {}; }
                })();

                return (
                  <article key={approval.id} style={{ padding: "14px 16px", borderRadius: 14, border: "1px solid rgba(245,158,11,0.25)", background: "rgba(245,158,11,0.04)", display: "grid", gap: 10 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12 }}>
                      <div>
                        <strong style={{ fontSize: 13 }}>{approval.title}</strong>
                        <p style={{ margin: "4px 0 0", fontSize: 12, color: "var(--muted)" }}>{approval.reason}</p>
                      </div>
                      <span style={{ padding: "3px 8px", borderRadius: 999, background: "rgba(245,158,11,0.15)", color: "#fbbf24", fontSize: 11, fontWeight: 700, whiteSpace: "nowrap" }}>
                        {approval.riskLevel} risk
                      </span>
                    </div>

                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, fontSize: 11, color: "var(--muted)" }}>
                      <span>Acción: <code style={{ fontSize: 11 }}>{String(context.actionType ?? "—")}</code></span>
                      <span>Proyecto: <code style={{ fontSize: 11 }}>{String(context.projectId ?? "—")}</code></span>
                      <span>Solicitado: {new Date(approval.requestedAt).toLocaleString("es-MX", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })}</span>
                      <span>ID: <code style={{ fontSize: 10 }}>{approval.id}</code></span>
                    </div>

                    {feedback && (
                      <div style={{ padding: "8px 10px", borderRadius: 8, fontSize: 12, background: feedback.kind === "ok" ? "rgba(16,185,129,.08)" : "rgba(239,68,68,.08)", color: feedback.kind === "ok" ? "#34d399" : "#ef4444", border: `1px solid ${feedback.kind === "ok" ? "rgba(16,185,129,.2)" : "rgba(239,68,68,.2)"}` }}>
                        {feedback.message}
                      </div>
                    )}

                    <div style={{ display: "flex", gap: 8 }}>
                      <button
                        onClick={() => void handleApprovalDecision(approval.id, "approved")}
                        disabled={isBusy}
                        style={{ display: "flex", alignItems: "center", gap: 6, padding: "8px 14px", borderRadius: 10, border: "1px solid rgba(16,185,129,0.3)", background: "rgba(16,185,129,0.1)", color: "#34d399", fontSize: 12, fontWeight: 700, cursor: "pointer", opacity: isBusy ? 0.5 : 1 }}
                      >
                        <CheckCircle size={13} />
                        {isBusy ? "Procesando..." : t("ops.approve")}
                      </button>
                      <button
                        onClick={() => void handleApprovalDecision(approval.id, "rejected")}
                        disabled={isBusy}
                        style={{ display: "flex", alignItems: "center", gap: 6, padding: "8px 14px", borderRadius: 10, border: "1px solid rgba(239,68,68,0.3)", background: "rgba(239,68,68,0.08)", color: "#f87171", fontSize: 12, fontWeight: 700, cursor: "pointer", opacity: isBusy ? 0.5 : 1 }}
                      >
                        <XCircle size={13} />
                        Rechazar
                      </button>
                    </div>
                  </article>
                );
              })}
            </div>
          </section>

        </div>

        {/* Right-Anchored Context Panel Column */}
        {selectedCorrelationId && (
          <div style={{ position: "sticky", top: "18px", height: "calc(100vh - 36px)", maxHeight: "900px" }}>
            <SemseContextPanel
              isOpen={!!selectedCorrelationId}
              onClose={() => setSelectedCorrelationId(null)}
              title={selectedCorrelationId}
              subtitle={runtimeTrace?.event?.eventType ?? runtimeTrace?.event?.action ?? "Trace de operaciones"}
              statusTag={activeTraceStatusTag}
              tabs={contextTabs}
              activeTab={activeTab}
              onTabChange={setActiveTab}
              isLoading={traceLoading || domainEventTraceLoading}
              actions={
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", width: "100%" }}>
                  <span style={{ fontSize: "11px", color: "var(--muted)" }}>
                    Presiona ESC o el botón superior para cerrar
                  </span>
                  <button
                    onClick={() => setSelectedCorrelationId(null)}
                    style={{
                      padding: "6px 14px",
                      borderRadius: "8px",
                      border: "1px solid rgba(255,255,255,0.08)",
                      background: "rgba(255,255,255,0.04)",
                      color: "var(--ink)",
                      fontSize: "12px",
                      cursor: "pointer",
                    }}
                  >
                    Cerrar Detalle
                  </button>
                </div>
              }
            >
              {renderContextPanelContent()}
            </SemseContextPanel>
          </div>
        )}
      </div>
    </div>
  );
}
