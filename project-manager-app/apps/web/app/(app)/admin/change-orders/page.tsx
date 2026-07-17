"use client";

import { useCallback, useEffect, useState } from "react";
import { AlertTriangle, CheckCircle, Clock, FilePlus, RefreshCw, Sparkles, XCircle, Zap } from "lucide-react";
import { ChangeOrderImpactCard } from "../../../../components/change-orders/ChangeOrderImpactCard";
import { useBuildOpsSSE } from "@/hooks/useBuildOpsSSE";

type COStatus = "predicted" | "submitted" | "approved" | "rejected" | "voided" | "applied" | "changes_requested";

type ChangeOrder = {
  id: string;
  title: string;
  description?: string | null;
  trigger: string;
  status: COStatus;
  estimatedMin?: string | number | null;
  estimatedMax?: string | number | null;
  probability?: number | null;
  clientNote?: string | null;
  buildOpsProjectId?: string | null;
  jobId?: string | null;
  milestoneId?: string | null;
  createdAt: string;
  updatedAt?: string;
};

type RiskResult = {
  riskLevel: "low" | "medium" | "high" | "critical";
  summary: string;
  flags: string[];
  recommendation: string;
  confidence: number;
};

const STATUS_META: Record<COStatus, { label: string; color: string; icon: typeof Clock }> = {
  predicted:         { label: "Predicho",         color: "#94a3b8", icon: Sparkles },
  submitted:         { label: "Enviado",           color: "#fbbf24", icon: Clock },
  approved:          { label: "Aprobado",          color: "#22c55e", icon: CheckCircle },
  rejected:          { label: "Rechazado",         color: "#ef4444", icon: XCircle },
  voided:            { label: "Anulado",           color: "#64748b", icon: XCircle },
  applied:           { label: "Aplicado",          color: "#818cf8", icon: Zap },
  changes_requested: { label: "Cambios pedidos",  color: "#fb923c", icon: AlertTriangle },
};

const RISK_COLORS: Record<string, string> = {
  low: "#22c55e", medium: "#fbbf24", high: "#fb923c", critical: "#ef4444",
};

function money(v: string | number | null | undefined) {
  if (v === null || v === undefined) return "—";
  return `$${Math.round(Number(v)).toLocaleString()}`;
}

function StatusBadge({ status }: { status: COStatus }) {
  const m = STATUS_META[status] ?? STATUS_META.predicted;
  return (
    <span style={{
      display: "inline-flex", alignItems: "center", gap: 4,
      padding: "2px 8px", borderRadius: 99, fontSize: 11, fontWeight: 700,
      background: `${m.color}22`, color: m.color, border: `1px solid ${m.color}44`,
    }}>
      <m.icon size={10} />
      {m.label}
    </span>
  );
}

function filterAllows(co: ChangeOrder, filter: string): boolean {
  if (filter === "all") return true;
  return co.status === filter;
}

export default function AdminChangeOrdersPage() {
  const [items, setItems] = useState<ChangeOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState("all");
  const [selected, setSelected] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [noteById, setNoteById] = useState<Record<string, string>>({});
  const [requiredActionsById, setRequiredActionsById] = useState<Record<string, string>>({});
  const [riskResults, setRiskResults] = useState<Record<string, RiskResult>>({});
  const [impactRefreshKey, setImpactRefreshKey] = useState(0);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = filter !== "all" ? `?status=${encodeURIComponent(filter)}` : "";
      const res = await fetch(`/api/semse/change-orders${params}`);
      const json = await res.json() as { data?: ChangeOrder[]; error?: { message: string } };
      if (!res.ok) throw new Error(json.error?.message ?? "Error al cargar");
      setItems(json.data ?? []);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error al cargar change orders");
    } finally {
      setLoading(false);
    }
  }, [filter]);

  useEffect(() => { void load(); }, [load]);

  useBuildOpsSSE({
    onEvent: (evt) => {
      if (evt.type === "change-order:updated" || evt.type === "change-order:applied") {
        void load();
        setImpactRefreshKey((k) => k + 1);
      }
    },
  });

  async function action(id: string, act: "submit" | "approve" | "reject", body?: Record<string, unknown>) {
    setBusyId(`${act}:${id}`);
    try {
      const res = await fetch(`/api/semse/change-orders/${id}/${act}`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body ?? {}),
      });
      if (res.ok) await load();
    } finally {
      setBusyId(null);
    }
  }

  async function requestChanges(id: string) {
    const raw = requiredActionsById[id] ?? "";
    const requiredActions = raw.split(",").map((s) => s.trim()).filter(Boolean);
    if (!requiredActions.length) return;
    setBusyId(`request-changes:${id}`);
    try {
      const note = noteById[id]?.trim();
      const res = await fetch(`/api/semse/change-orders/${id}/request-changes`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ requiredActions, note }),
      });
      if (res.ok) await load();
    } finally {
      setBusyId(null);
    }
  }

  async function runRiskAgent(id: string) {
    setBusyId(`risk:${id}`);
    try {
      const res = await fetch(`/api/semse/change-orders/${id}/run-risk-agent`, { method: "POST" });
      const json = await res.json() as { data?: RiskResult };
      if (json.data) setRiskResults((p) => ({ ...p, [id]: json.data! }));
    } finally {
      setBusyId(null);
    }
  }

  async function applyToBuildOps(id: string) {
    setBusyId(`apply:${id}`);
    try {
      await fetch(`/api/semse/change-orders/${id}/apply-to-buildops`, { method: "POST" });
      await load();
      setImpactRefreshKey((k) => k + 1);
    } finally {
      setBusyId(null);
    }
  }

  const filtered = items.filter((co) => filterAllows(co, filter));
  const selectedCo = filtered.find((co) => co.id === selected) ?? items.find((co) => co.id === selected);

  const counts: Record<string, number> = { all: items.length };
  for (const co of items) counts[co.status] = (counts[co.status] ?? 0) + 1;

  const surface: React.CSSProperties = {
    background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 12,
  };

  const btn = (color: string, disabled = false): React.CSSProperties => ({
    padding: "5px 12px", borderRadius: 7, border: `1px solid ${color}44`,
    background: `${color}18`, color, fontSize: 11, fontWeight: 700,
    cursor: disabled ? "not-allowed" : "pointer", opacity: disabled ? 0.5 : 1,
  });

  return (
    <div style={{ padding: "24px 28px", maxWidth: 1400, margin: "0 auto" }}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 20 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 800, color: "var(--ink)", margin: 0 }}>
            📋 Change Orders
          </h1>
          <p style={{ fontSize: 13, color: "var(--muted)", margin: 0 }}>
            Gestión completa del ciclo de vida de cambios de alcance
          </p>
        </div>
        <button onClick={() => void load()} style={{ marginLeft: "auto", ...btn("#818cf8") }}>
          <RefreshCw size={12} style={{ display: "inline", marginRight: 4 }} />
          Actualizar
        </button>
      </div>

      {/* Status filter tabs */}
      <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 16 }}>
        {["all", "predicted", "submitted", "approved", "changes_requested", "applied", "rejected", "voided"].map((s) => {
          const meta = s === "all" ? null : STATUS_META[s as COStatus];
          const count = counts[s] ?? 0;
          const active = filter === s;
          return (
            <button
              key={s}
              onClick={() => setFilter(s)}
              style={{
                padding: "4px 12px", borderRadius: 99, fontSize: 11, fontWeight: 700,
                border: `1px solid ${active ? (meta?.color ?? "#818cf8") : "var(--border)"}`,
                background: active ? `${meta?.color ?? "#818cf8"}22` : "var(--surface)",
                color: active ? (meta?.color ?? "#818cf8") : "var(--muted)",
                cursor: "pointer",
              }}
            >
              {meta?.label ?? "Todos"} {count > 0 && `(${count})`}
            </button>
          );
        })}
      </div>

      {error && (
        <div style={{ padding: 12, borderRadius: 8, background: "rgba(239,68,68,.1)", border: "1px solid rgba(239,68,68,.2)", color: "#f87171", fontSize: 13, marginBottom: 16 }}>
          {error}
        </div>
      )}

      <div style={{ display: "grid", gridTemplateColumns: "1fr 420px", gap: 16 }}>
        {/* List */}
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {loading ? (
            <div style={{ padding: 32, textAlign: "center", color: "var(--muted)", fontSize: 13 }}>Cargando…</div>
          ) : filtered.length === 0 ? (
            <div style={{ ...surface, padding: 32, textAlign: "center", color: "var(--muted)", fontSize: 13 }}>
              No hay change orders con estado &quot;{filter === "all" ? "cualquiera" : STATUS_META[filter as COStatus]?.label ?? filter}&quot;
            </div>
          ) : (
            filtered.map((co) => {
              const isSelected = selected === co.id;
              const risk = riskResults[co.id];
              return (
                <div
                  key={co.id}
                  onClick={() => setSelected(isSelected ? null : co.id)}
                  style={{
                    ...surface,
                    padding: "14px 16px",
                    cursor: "pointer",
                    border: isSelected ? "1px solid #818cf8" : "1px solid var(--border)",
                    background: isSelected ? "rgba(129,140,248,.06)" : "var(--surface)",
                  }}
                >
                  <div style={{ display: "flex", alignItems: "flex-start", gap: 10 }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
                        <StatusBadge status={co.status} />
                        {risk && (
                          <span style={{
                            padding: "2px 7px", borderRadius: 99, fontSize: 10, fontWeight: 700,
                            background: `${RISK_COLORS[risk.riskLevel]}22`, color: RISK_COLORS[risk.riskLevel],
                            border: `1px solid ${RISK_COLORS[risk.riskLevel]}44`,
                          }}>
                            🛡 {risk.riskLevel.toUpperCase()}
                          </span>
                        )}
                        <span style={{ fontSize: 10, color: "var(--faint, #4b6280)", marginLeft: "auto" }}>
                          {new Date(co.createdAt).toLocaleDateString("es-MX", { day: "2-digit", month: "short" })}
                        </span>
                      </div>
                      <div style={{ fontSize: 14, fontWeight: 700, color: "var(--ink)", marginBottom: 2 }}>{co.title}</div>
                      {co.description && (
                        <div style={{ fontSize: 12, color: "var(--muted)", marginBottom: 6, lineHeight: 1.4 }}>
                          {co.description.length > 100 ? co.description.slice(0, 100) + "…" : co.description}
                        </div>
                      )}
                      <div style={{ display: "flex", gap: 14, fontSize: 11, color: "var(--muted)" }}>
                        <span>Trigger: <b style={{ color: "var(--ink)" }}>{co.trigger}</b></span>
                        {(co.estimatedMin != null || co.estimatedMax != null) && (
                          <span>Estimado: <b style={{ color: "#22c55e" }}>{money(co.estimatedMin)} – {money(co.estimatedMax)}</b></span>
                        )}
                        {co.probability != null && (
                          <span>Prob: <b style={{ color: "#818cf8" }}>{Math.round(co.probability * 100)}%</b></span>
                        )}
                      </div>
                      {co.clientNote && (
                        <div style={{ marginTop: 6, fontSize: 11, color: "#fbbf24", fontStyle: "italic" }}>
                          💬 {co.clientNote}
                        </div>
                      )}
                    </div>
                  </div>

                  {isSelected && (
                    <div
                      onClick={(e) => e.stopPropagation()}
                      style={{ marginTop: 12, paddingTop: 12, borderTop: "1px solid var(--border)" }}
                    >
                      {/* Action buttons by status */}
                      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 10 }}>
                        {co.status === "predicted" && (
                          <button
                            disabled={busyId === `submit:${co.id}`}
                            onClick={() => action(co.id, "submit")}
                            style={btn("#fbbf24", busyId === `submit:${co.id}`)}
                          >
                            <FilePlus size={11} style={{ display: "inline", marginRight: 4 }} />
                            Enviar
                          </button>
                        )}
                        {(co.status === "submitted" || co.status === "changes_requested") && (
                          <>
                            <button
                              disabled={!!busyId}
                              onClick={() => action(co.id, "approve", { clientNote: noteById[co.id] })}
                              style={btn("#22c55e", !!busyId)}
                            >
                              <CheckCircle size={11} style={{ display: "inline", marginRight: 4 }} />
                              Aprobar
                            </button>
                            <button
                              disabled={!!busyId}
                              onClick={() => action(co.id, "reject", { clientNote: noteById[co.id], reason: noteById[co.id] })}
                              style={btn("#ef4444", !!busyId)}
                            >
                              <XCircle size={11} style={{ display: "inline", marginRight: 4 }} />
                              Rechazar
                            </button>
                          </>
                        )}
                        {co.status === "approved" && (
                          <button
                            disabled={busyId === `apply:${co.id}`}
                            onClick={() => applyToBuildOps(co.id)}
                            style={btn("#818cf8", busyId === `apply:${co.id}`)}
                          >
                            <Zap size={11} style={{ display: "inline", marginRight: 4 }} />
                            Aplicar a BuildOps
                          </button>
                        )}
                        <button
                          disabled={busyId === `risk:${co.id}`}
                          onClick={() => runRiskAgent(co.id)}
                          style={btn("#f59e0b", busyId === `risk:${co.id}`)}
                        >
                          <Sparkles size={11} style={{ display: "inline", marginRight: 4 }} />
                          {busyId === `risk:${co.id}` ? "Analizando…" : "Agente de riesgo"}
                        </button>
                      </div>

                      {/* Note input */}
                      {(co.status === "submitted" || co.status === "changes_requested" || co.status === "approved") && (
                        <input
                          value={noteById[co.id] ?? ""}
                          onChange={(e) => setNoteById((p) => ({ ...p, [co.id]: e.target.value }))}
                          placeholder="Nota para cliente (opcional)"
                          style={{
                            width: "100%", padding: "6px 10px", borderRadius: 7,
                            border: "1px solid var(--border)", background: "rgba(255,255,255,.04)",
                            color: "var(--ink)", fontSize: 12, marginBottom: 8, boxSizing: "border-box",
                          }}
                        />
                      )}

                      {/* Request-changes form */}
                      {co.status === "submitted" && (
                        <div style={{ display: "flex", gap: 6, marginBottom: 8 }}>
                          <input
                            value={requiredActionsById[co.id] ?? ""}
                            onChange={(e) => setRequiredActionsById((p) => ({ ...p, [co.id]: e.target.value }))}
                            placeholder="Acciones requeridas (separadas por coma)"
                            style={{
                              flex: 1, padding: "6px 10px", borderRadius: 7,
                              border: "1px solid var(--border)", background: "rgba(255,255,255,.04)",
                              color: "var(--ink)", fontSize: 12,
                            }}
                          />
                          <button
                            disabled={!!busyId}
                            onClick={() => requestChanges(co.id)}
                            style={btn("#fb923c", !!busyId)}
                          >
                            Pedir cambios
                          </button>
                        </div>
                      )}

                      {/* Risk result */}
                      {risk && (
                        <div style={{
                          padding: "10px 12px", borderRadius: 8, marginTop: 4,
                          background: `${RISK_COLORS[risk.riskLevel]}12`,
                          border: `1px solid ${RISK_COLORS[risk.riskLevel]}30`,
                        }}>
                          <div style={{ fontSize: 11, fontWeight: 700, color: RISK_COLORS[risk.riskLevel], marginBottom: 4 }}>
                            🛡 Riesgo {risk.riskLevel.toUpperCase()} — Confianza {Math.round(risk.confidence * 100)}%
                          </div>
                          <div style={{ fontSize: 12, color: "var(--ink)", marginBottom: 4 }}>{risk.summary}</div>
                          {risk.flags.length > 0 && (
                            <div style={{ fontSize: 11, color: "#fbbf24" }}>
                              ⚠ {risk.flags.join(" · ")}
                            </div>
                          )}
                          <div style={{ fontSize: 11, color: "var(--muted)", marginTop: 4 }}>
                            Recomendación: <span style={{ color: "var(--ink)" }}>{risk.recommendation}</span>
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>

        {/* Detail panel: impact card for selected CO */}
        <div style={{ position: "sticky", top: 80, alignSelf: "start", display: "flex", flexDirection: "column", gap: 12 }}>
          {selectedCo ? (
            <>
              <div style={{ ...surface, padding: "14px 16px" }}>
                <div style={{ fontSize: 12, color: "var(--muted)", marginBottom: 6, fontWeight: 700 }}>DETALLE</div>
                <div style={{ fontSize: 15, fontWeight: 800, color: "var(--ink)", marginBottom: 8 }}>{selectedCo.title}</div>
                <table style={{ width: "100%", fontSize: 12, borderCollapse: "collapse" }}>
                  <tbody>
                    {[
                      ["Estado", <StatusBadge key="s" status={selectedCo.status} />],
                      ["Trigger", selectedCo.trigger],
                      ["Prob.", selectedCo.probability != null ? `${Math.round(selectedCo.probability * 100)}%` : "—"],
                      ["Mín.", money(selectedCo.estimatedMin)],
                      ["Máx.", money(selectedCo.estimatedMax)],
                      ["Proyecto", selectedCo.buildOpsProjectId ?? selectedCo.jobId ?? "—"],
                      ["Hito", selectedCo.milestoneId ?? "—"],
                      ["Creado", new Date(selectedCo.createdAt).toLocaleString("es-MX", { dateStyle: "medium", timeStyle: "short" })],
                    ].map(([label, val]) => (
                      <tr key={String(label)}>
                        <td style={{ padding: "3px 0", color: "var(--muted)", width: 80 }}>{label}</td>
                        <td style={{ padding: "3px 0", color: "var(--ink)", fontWeight: 600 }}>{val}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {selectedCo.description && (
                  <div style={{ marginTop: 10, fontSize: 12, color: "var(--muted)", lineHeight: 1.5 }}>
                    {selectedCo.description}
                  </div>
                )}
              </div>

              <ChangeOrderImpactCard
                key={`${selectedCo.id}:${impactRefreshKey}`}
                changeOrderId={selectedCo.id}
                canApply={selectedCo.status === "approved"}
                onApplied={() => void load()}
              />
            </>
          ) : (
            <div style={{ ...surface, padding: 24, textAlign: "center", color: "var(--muted)", fontSize: 13 }}>
              Selecciona un change order para ver el análisis de impacto
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
