"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { Bell, Clock3, Radar, Search, Send, Sparkles } from "lucide-react";
import { AdminPageHeader } from "../../../components/admin/AdminPageHeader";
import {
  emitDomainEvent,
  fetchDomainEventManualCatalog,
  fetchDomainEvents,
  fetchDomainEventTrace,
  semseRuntimeEnabled,
  type DomainEventListView,
  type DomainEventTraceView,
  type SemseEvent
} from "../../../semse-api";
import { NotificationBanner } from "../../../components/notifications/NotificationBanner";

const EMPTY_EVENT_ITEMS: DomainEventListView["items"] = [];

function isoNow() {
  return new Date().toISOString();
}

function formatTimestamp(value?: string) {
  if (!value) return "n/a";
  return new Date(value).toLocaleString("es-MX", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit"
  });
}

export default function AdminDomainEventsPage() {
  const runtimeEnabled = semseRuntimeEnabled();
  const [list, setList] = useState<DomainEventListView | null>(null);
  const [trace, setTrace] = useState<DomainEventTraceView | null>(null);
  const [allowedTypes, setAllowedTypes] = useState<SemseEvent["type"][]>([]);
  const [loading, setLoading] = useState(runtimeEnabled);
  const [traceLoading, setTraceLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [traceError, setTraceError] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [type, setType] = useState("all");
  const [selectedCorrelationId, setSelectedCorrelationId] = useState<string | null>(null);
  const [emitLoading, setEmitLoading] = useState(false);
  const [emitError, setEmitError] = useState<string | null>(null);
  const [emitSuccess, setEmitSuccess] = useState<string | null>(null);
  const [emitType, setEmitType] = useState<SemseEvent["type"] | "">("");
  const [emitCorrelationId, setEmitCorrelationId] = useState("");
  const [emitActorId, setEmitActorId] = useState("usr_ops_admin");
  const [emitPayload, setEmitPayload] = useState("{\n  \"subjectType\": \"job\",\n  \"subjectId\": \"job_demo\",\n  \"flagCode\": \"manual_watch\",\n  \"severity\": \"medium\",\n  \"source\": \"ops-console\"\n}");
  const [refreshToken, setRefreshToken] = useState(0);

  useEffect(() => {
    if (!runtimeEnabled) {
      return;
    }

    let cancelled = false;
    setLoading(true);
    setError(null);

    void Promise.all([
      fetchDomainEvents({ type: type === "all" ? undefined : type, limit: 50 }),
      fetchDomainEventManualCatalog()
    ])
      .then(([events, catalog]) => {
        if (cancelled) return;
        setList(events);
        setAllowedTypes(catalog.allowedTypes);
        setEmitType((current) => current || catalog.allowedTypes[0] || "");
        setSelectedCorrelationId((current) => {
          if (current && events.items.some((item) => item.correlationId === current)) {
            return current;
          }
          return events.items[0]?.correlationId ?? null;
        });
      })
      .catch((reason) => {
        if (!cancelled) {
          setError(reason instanceof Error ? reason.message : "No se pudieron cargar los domain events.");
        }
      })
      .finally(() => {
        if (!cancelled) {
          setLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [runtimeEnabled, type, refreshToken]);

  useEffect(() => {
    if (!runtimeEnabled || !selectedCorrelationId) {
      return;
    }

    let cancelled = false;
    const correlationId = selectedCorrelationId;
    setTraceLoading(true);
    setTraceError(null);

    void fetchDomainEventTrace(correlationId)
      .then((data) => {
        if (!cancelled) setTrace(data);
      })
      .catch((reason) => {
        if (!cancelled) {
          setTraceError(reason instanceof Error ? reason.message : "No se pudo cargar el trace.");
        }
      })
      .finally(() => {
        if (!cancelled) setTraceLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [runtimeEnabled, selectedCorrelationId, refreshToken]);

  const items = list?.items ?? EMPTY_EVENT_ITEMS;
  const visibleItems = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return items;
    return items.filter((item) =>
      item.type.toLowerCase().includes(needle) ||
      item.correlationId.toLowerCase().includes(needle) ||
      item.triggers.some((trigger) => trigger.toLowerCase().includes(needle))
    );
  }, [items, query]);

  function handleEmit(event: React.FormEvent) {
    event.preventDefault();
    if (!emitType) return;

    let parsedPayload: Record<string, unknown>;
    try {
      parsedPayload = JSON.parse(emitPayload) as Record<string, unknown>;
    } catch {
      setEmitError("El payload no es JSON válido.");
      return;
    }

    const correlationId = emitCorrelationId.trim() || `manual:${emitType}:${Date.now()}`;
    const domainEvent = {
      type: emitType,
      meta: {
        tenantId: "tnt_demo",
        correlationId,
        actorId: emitActorId.trim() || "usr_ops_admin",
        actorType: "user",
        occurredAt: isoNow(),
        version: 1
      },
      payload: parsedPayload,
      triggers: []
    } as unknown as SemseEvent;

    setEmitLoading(true);
    setEmitError(null);
    setEmitSuccess(null);

    void emitDomainEvent(domainEvent)
      .then(() => {
        setEmitSuccess(`Evento ${emitType} emitido.`);
        setSelectedCorrelationId(correlationId);
        setRefreshToken((current) => current + 1);
      })
      .catch((reason) => {
        setEmitError(reason instanceof Error ? reason.message : "No se pudo emitir el evento.");
      })
      .finally(() => {
        setEmitLoading(false);
      });
  }

  return (
    <div style={{ maxWidth: "1280px", margin: "0 auto", display: "grid", gap: "18px" }}>
      <section
        style={{
          border: "1px solid var(--border)",
          borderRadius: "18px",
          background: "linear-gradient(135deg, rgba(27,20,52,0.96), rgba(18,26,48,0.92))",
          padding: "22px"
        }}
      >
        <AdminPageHeader
          title="Plano causal del ecosistema"
          subtitle="Vista dedicada para inspeccionar eventos emitidos, seguir su timeline por correlationId y emitir eventos manuales permitidos por policy."
          icon={Radar}
          iconColor="#c4b5fd"
          iconBg="rgba(15,23,42,0.68)"
          backHref="/admin/dashboard"
          backLabel="Dashboard"
          showBack={true}
          actions={
            <div style={{ display: "grid", gap: "8px", minWidth: "260px", padding: "14px 16px", borderRadius: "14px", background: "rgba(15,23,42,0.68)", border: "1px solid rgba(196,181,253,0.18)" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "8px", color: "#c4b5fd" }}>
                <Radar size={14} />
                <span style={{ fontSize: "12px", fontWeight: 700 }}>{runtimeEnabled ? "Runtime activo" : "Modo desconectado"}</span>
              </div>
              <span style={{ fontSize: "12px", color: "var(--muted)" }}>
                {selectedCorrelationId ?? "Selecciona un evento para abrir el trace."}
              </span>
              <Link href="/admin/ops" style={{ fontSize: "12px", color: "#7dd3fc", textDecoration: "none" }}>
                Volver a Operaciones
              </Link>
              <NotificationBanner audience="admin" />
            </div>
          }
        />
        {!runtimeEnabled ? <p style={{ fontSize: "12px", color: "#fca5a5", marginTop: "10px" }}>Runtime SEMSE deshabilitado para esta sesión.</p> : null}
        {error ? <p style={{ fontSize: "12px", color: "#fca5a5", marginTop: "10px" }}>{error}</p> : null}
      </section>

      <section style={{ display: "grid", gridTemplateColumns: "minmax(0, 0.95fr) minmax(0, 1.05fr)", gap: "14px" }}>
        <article style={{ border: "1px solid var(--border)", borderRadius: "16px", background: "var(--surface)", padding: "18px" }}>
          <div style={{ display: "flex", justifyContent: "space-between", gap: "12px", flexWrap: "wrap", marginBottom: "14px" }}>
            <div>
              <h2 style={{ fontSize: "18px", fontWeight: 800, color: "var(--ink)" }}>Lista de eventos</h2>
              <p style={{ fontSize: "12px", color: "var(--muted)" }}>Eventos emitidos y listos para inspección causal.</p>
            </div>
            {loading ? <span style={{ fontSize: "12px", color: "var(--muted)" }}>Cargando...</span> : null}
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "minmax(220px, 1fr) minmax(180px, 0.6fr)", gap: "10px", marginBottom: "12px" }}>
            <label style={{ position: "relative" }}>
              <Search size={14} style={{ position: "absolute", left: "12px", top: "50%", transform: "translateY(-50%)", color: "var(--muted)" }} />
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Buscar tipo, correlationId o trigger"
                style={{ width: "100%", height: "40px", paddingLeft: "36px", paddingRight: "12px", borderRadius: "10px", border: "1px solid var(--border)", background: "var(--bg)", color: "var(--ink)" }}
              />
            </label>
            <select
              value={type}
              onChange={(event) => setType(event.target.value)}
              style={{ height: "40px", borderRadius: "10px", border: "1px solid var(--border)", background: "var(--bg)", color: "var(--ink)", padding: "0 12px" }}
            >
              <option value="all">Todos los tipos</option>
              {Array.from(new Set(items.map((item) => item.type))).map((option) => (
                <option key={option} value={option}>{option}</option>
              ))}
            </select>
          </div>

          <div style={{ display: "grid", gap: "10px" }}>
            {visibleItems.map((item) => {
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
                    padding: "14px"
                  }}
                >
                  <div style={{ display: "flex", justifyContent: "space-between", gap: "12px", alignItems: "center", flexWrap: "wrap" }}>
                    <strong style={{ fontSize: "14px", color: "var(--ink)" }}>{item.type}</strong>
                    <span style={{ fontSize: "11px", color: "#c4b5fd", fontWeight: 700 }}>{formatTimestamp(item.timestamp)}</span>
                  </div>
                  <p style={{ fontSize: "12px", color: "var(--muted)", marginTop: "6px", wordBreak: "break-word" }}>{item.correlationId}</p>
                </button>
              );
            })}
          </div>
        </article>

        <article style={{ border: "1px solid var(--border)", borderRadius: "16px", background: "var(--surface)", padding: "18px" }}>
          <div style={{ display: "flex", justifyContent: "space-between", gap: "12px", marginBottom: "12px", alignItems: "center" }}>
            <div>
              <h2 style={{ fontSize: "18px", fontWeight: 800, color: "var(--ink)" }}>Trace del evento</h2>
              <p style={{ fontSize: "12px", color: "var(--muted)" }}>Meta, payload, runs relacionados y timeline auditado.</p>
            </div>
            {traceLoading ? <span style={{ fontSize: "12px", color: "var(--muted)" }}>Cargando trace...</span> : null}
          </div>

          {traceError ? <p style={{ fontSize: "12px", color: "#fca5a5", marginBottom: "10px" }}>{traceError}</p> : null}

          {trace?.event ? (
            <div style={{ display: "grid", gap: "12px" }}>
              <div style={{ borderRadius: "14px", border: "1px solid rgba(196,181,253,0.2)", background: "rgba(76,29,149,0.12)", padding: "14px" }}>
                <div style={{ display: "flex", alignItems: "center", gap: "8px", color: "#c4b5fd", marginBottom: "8px" }}>
                  <Sparkles size={14} />
                  <span style={{ fontSize: "11px", textTransform: "uppercase", letterSpacing: "0.08em", fontWeight: 700 }}>Evento raíz</span>
                </div>
                <strong style={{ fontSize: "15px", color: "var(--ink)" }}>{trace.event.type}</strong>
                <p style={{ fontSize: "12px", color: "var(--muted)", marginTop: "6px" }}>{trace.event.correlationId}</p>
              </div>

              <div style={{ borderRadius: "14px", border: "1px solid rgba(148,163,184,0.16)", background: "rgba(15,23,42,0.28)", padding: "14px" }}>
                <p style={{ fontSize: "11px", color: "var(--muted)", textTransform: "uppercase", letterSpacing: "0.08em", fontWeight: 700, marginBottom: "10px" }}>Payload</p>
                <pre style={{ margin: 0, whiteSpace: "pre-wrap", wordBreak: "break-word", fontSize: "12px", color: "var(--ink)" }}>
                  {JSON.stringify(trace.event.payload ?? {}, null, 2)}
                </pre>
              </div>

              <div style={{ borderRadius: "14px", border: "1px solid rgba(148,163,184,0.16)", background: "rgba(15,23,42,0.28)", padding: "14px" }}>
                <p style={{ fontSize: "11px", color: "var(--muted)", textTransform: "uppercase", letterSpacing: "0.08em", fontWeight: 700, marginBottom: "10px" }}>Runs derivados</p>
                <div style={{ display: "grid", gap: "8px" }}>
                  {trace.runs.map((run) => (
                    <div key={run.id} style={{ borderRadius: "12px", border: "1px solid rgba(148,163,184,0.12)", padding: "10px 12px" }}>
                      <strong style={{ fontSize: "13px", color: "var(--ink)" }}>{run.agentType}</strong>
                      <p style={{ fontSize: "12px", color: "var(--muted)", marginTop: "4px" }}>{run.status} · {run.triggerType}</p>
                    </div>
                  ))}
                </div>
              </div>

              <div style={{ display: "grid", gap: "8px" }}>
                {trace.timeline.map((entry) => (
                  <div key={entry.id} style={{ display: "grid", gridTemplateColumns: "12px minmax(0, 1fr)", gap: "10px" }}>
                    <div style={{ width: "10px", height: "10px", borderRadius: "50%", background: "linear-gradient(135deg, #a78bfa, #c4b5fd)", marginTop: "6px" }} />
                    <div style={{ borderBottom: "1px solid rgba(148,163,184,0.12)", paddingBottom: "10px" }}>
                      <strong style={{ display: "block", fontSize: "13px", color: "var(--ink)" }}>{entry.action}</strong>
                      <p style={{ fontSize: "12px", color: "var(--muted)", marginTop: "4px" }}>{entry.entityType}:{entry.entityId}</p>
                      <div style={{ display: "flex", alignItems: "center", gap: "6px", fontSize: "11px", color: "var(--muted)", marginTop: "4px" }}>
                        <Clock3 size={12} />
                        <span>{formatTimestamp(entry.timestamp)}</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div style={{ borderRadius: "14px", border: "1px dashed rgba(148,163,184,0.24)", padding: "16px", color: "var(--muted)" }}>
              Selecciona un evento para abrir el trace.
            </div>
          )}
        </article>
      </section>

      <section style={{ border: "1px solid var(--border)", borderRadius: "16px", background: "var(--surface)", padding: "18px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", gap: "12px", marginBottom: "12px", alignItems: "center", flexWrap: "wrap" }}>
          <div>
            <h2 style={{ fontSize: "18px", fontWeight: 800, color: "var(--ink)" }}>Emit manual controlado</h2>
            <p style={{ fontSize: "12px", color: "var(--muted)" }}>Solo tipos permitidos por `domain-events.policy.ts`.</p>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: "8px", color: "#c4b5fd" }}>
            <Bell size={14} />
            <span style={{ fontSize: "12px", fontWeight: 700 }}>{allowedTypes.length} tipos permitidos</span>
          </div>
        </div>

        <form onSubmit={handleEmit} style={{ display: "grid", gap: "12px" }}>
          <div style={{ display: "grid", gridTemplateColumns: "minmax(220px, 0.8fr) minmax(220px, 1fr) minmax(180px, 0.7fr)", gap: "10px" }}>
            <select
              value={emitType}
              onChange={(event) => setEmitType(event.target.value as SemseEvent["type"])}
              style={{ height: "40px", borderRadius: "10px", border: "1px solid var(--border)", background: "var(--bg)", color: "var(--ink)", padding: "0 12px" }}
            >
              {allowedTypes.map((option) => (
                <option key={option} value={option}>{option}</option>
              ))}
            </select>
            <input
              value={emitCorrelationId}
              onChange={(event) => setEmitCorrelationId(event.target.value)}
              placeholder="correlationId opcional"
              style={{ height: "40px", borderRadius: "10px", border: "1px solid var(--border)", background: "var(--bg)", color: "var(--ink)", padding: "0 12px" }}
            />
            <input
              value={emitActorId}
              onChange={(event) => setEmitActorId(event.target.value)}
              placeholder="actorId"
              style={{ height: "40px", borderRadius: "10px", border: "1px solid var(--border)", background: "var(--bg)", color: "var(--ink)", padding: "0 12px" }}
            />
          </div>

          <textarea
            value={emitPayload}
            onChange={(event) => setEmitPayload(event.target.value)}
            style={{ minHeight: "180px", borderRadius: "12px", border: "1px solid var(--border)", background: "rgba(15,23,42,0.45)", color: "var(--ink)", padding: "12px", fontFamily: "monospace", fontSize: "12px" }}
          />

          <div style={{ display: "flex", gap: "10px", alignItems: "center", flexWrap: "wrap" }}>
            <button
              type="submit"
              disabled={emitLoading || !emitType}
              style={{ display: "inline-flex", alignItems: "center", gap: "8px", height: "38px", padding: "0 16px", borderRadius: "999px", border: "1px solid rgba(196,181,253,0.28)", background: "rgba(76,29,149,0.18)", color: "#c4b5fd", fontWeight: 700, cursor: emitLoading ? "not-allowed" : "pointer", opacity: emitLoading ? 0.6 : 1 }}
            >
              <Send size={14} />
              {emitLoading ? "Emitiendo..." : "Emitir evento"}
            </button>
            {emitSuccess ? <span style={{ fontSize: "12px", color: "#34d399" }}>{emitSuccess}</span> : null}
            {emitError ? <span style={{ fontSize: "12px", color: "#fca5a5" }}>{emitError}</span> : null}
          </div>
        </form>
      </section>
    </div>
  );
}
