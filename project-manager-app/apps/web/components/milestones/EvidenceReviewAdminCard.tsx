"use client";

/**
 * EvidenceReviewAdminCard
 *
 * Para admin/ops: revisar evidencia subida por cliente/profesional,
 * ver recomendación de IA y tomar decisión auditable.
 *
 * Acciones disponibles: aprobar / rechazar / pedir reupload / re-run IA
 * Permiso requerido: milestones:approve (ops/admin)
 */

import { useCallback, useEffect, useState } from "react";
import {
  AlertTriangle, Archive, Bot, Camera, CheckCircle, ChevronDown, ChevronUp, Clock,
  FileText, RefreshCw, RotateCcw, Upload, XCircle
} from "lucide-react";
import { EvidenceItemDetailPanel } from "./EvidenceItemDetailPanel";

// ── Types ─────────────────────────────────────────────────────────────────────

type ItemStatus = "missing" | "submitted" | "approved" | "rejected" | "needs_reupload" | "archived";

type EvidenceItem = {
  id:          string;
  label:       string;
  description?: string | null;
  kind:        string;
  phase:       string;
  required:    boolean;
  status:      ItemStatus;
  evidenceId?: string | null;
  reviewNote?: string | null;
  reviewedAt?: string | null;
};

type AgentReview = {
  reviewStatus?: string;
  confidence?:   number;
  riskLevel?:    string;
  findings?:     string[];
  requiredActions?: string[];
  disputeRisk?:  boolean;
  auditReason?:  string;
  provider?:     string;
  reviewedBy?:   string;
};

type AdminReview = {
  status:     string;
  reason:     string;
  reviewedAt: string;
};

type Action = "approve" | "reject" | "needs_reupload" | null;

// ── Helpers ───────────────────────────────────────────────────────────────────

function parseReviewNote(note: string | null | undefined): { agent?: AgentReview; admin?: AdminReview } {
  if (!note) return {};
  try {
    const parsed = JSON.parse(note);
    return {
      agent: parsed.__agentReview as AgentReview | undefined,
      admin: parsed.adminReview as AdminReview | undefined,
    };
  } catch {
    return {};
  }
}

function statusColor(s: ItemStatus): string {
  if (s === "approved")      return "#86efac";
  if (s === "submitted")     return "#fbbf24";
  if (s === "rejected")      return "#f87171";
  if (s === "needs_reupload") return "#fb923c";
  return "var(--muted)";
}

function confidenceColor(c: number): string {
  if (c >= 0.8) return "#86efac";
  if (c >= 0.5) return "#fbbf24";
  return "#f87171";
}

function StatusIcon({ status }: { status: ItemStatus }) {
  if (status === "approved")  return <CheckCircle size={13} color="#86efac" />;
  if (status === "submitted") return <Clock size={13} color="#fbbf24" />;
  if (status === "rejected")  return <XCircle size={13} color="#f87171" />;
  if (status === "needs_reupload") return <Upload size={13} color="#fb923c" />;
  return <Camera size={13} color="var(--muted)" />;
}

const STATUS_LABELS: Record<ItemStatus, string> = {
  approved:      "Aprobada",
  submitted:     "En revisión",
  rejected:      "Rechazada",
  needs_reupload: "Reupload requerido",
  missing:       "Faltante",
  archived:      "Archivada",
};

// ── Main component ─────────────────────────────────────────────────────────────

interface Props {
  milestoneId: string;
  onReviewed?: () => void;  // called after successful review action
}

export function EvidenceReviewAdminCard({ milestoneId, onReviewed }: Props) {
  const [items, setItems] = useState<EvidenceItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeAction, setActiveAction] = useState<Record<string, Action>>({});
  const [reasonText, setReasonText] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState<Record<string, boolean>>({});
  const [actionErrors, setActionErrors] = useState<Record<string, string>>({});
  const [runningReview, setRunningReview] = useState<Record<string, boolean>>({});
  const [expandedDetail, setExpandedDetail] = useState<Record<string, boolean>>({});
  const [archivingId, setArchivingId] = useState<string | null>(null);
  const [archiveReason, setArchiveReason] = useState<Record<string, string>>({});
  const [archiveErrors, setArchiveErrors] = useState<Record<string, string>>({});
  const [agentResults, setAgentResults] = useState<Record<string, AgentReview>>({});

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/semse/milestones/${milestoneId}/evidence-items`);
      const json = await res.json() as { data?: EvidenceItem[] };
      if (!res.ok) throw new Error("No se pudieron cargar los items");
      setItems(json.data ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al cargar evidencia");
    } finally {
      setLoading(false);
    }
  }, [milestoneId]);

  useEffect(() => { void load(); }, [load]);

  async function submitAction(item: EvidenceItem, action: NonNullable<Action>) {
    const reason = reasonText[item.id]?.trim();
    if ((action === "reject" || action === "needs_reupload") && !reason) {
      setActionErrors((e) => ({ ...e, [item.id]: "La razón es obligatoria para rechazar o pedir reupload" }));
      return;
    }
    setSubmitting((s) => ({ ...s, [item.id]: true }));
    setActionErrors((e) => { const n = { ...e }; delete n[item.id]; return n; });

    const status = action === "needs_reupload" ? "needs_reupload" : action;

    try {
      const res = await fetch(`/api/semse/milestones/${milestoneId}/evidence-items/${item.id}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          status,
          ...(reason ? { auditReason: reason } : {}),
        }),
      });
      if (!res.ok) {
        const json = await res.json() as { error?: { message?: string } };
        throw new Error(json?.error?.message ?? `Error ${res.status}`);
      }
      setActiveAction((a) => { const n = { ...a }; delete n[item.id]; return n; });
      setReasonText((r) => { const n = { ...r }; delete n[item.id]; return n; });
      await load();
      onReviewed?.();
    } catch (err) {
      setActionErrors((e) => ({ ...e, [item.id]: err instanceof Error ? err.message : "Error" }));
    } finally {
      setSubmitting((s) => ({ ...s, [item.id]: false }));
    }
  }

  async function runAgentReview(item: EvidenceItem) {
    setRunningReview((r) => ({ ...r, [item.id]: true }));
    try {
      const res = await fetch(`/api/semse/milestones/${milestoneId}/evidence-items/${item.id}/review`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ locale: "es" }),
      });
      const json = await res.json() as { data?: AgentReview };
      if (json.data) setAgentResults((r) => ({ ...r, [item.id]: json.data! }));
      await load(); // reload to get updated reviewNote
    } catch { /* silent */ }
    finally { setRunningReview((r) => ({ ...r, [item.id]: false })); }
  }

  if (loading) return <div style={{ padding: 14, borderRadius: 12, background: "var(--surface)", border: "1px solid var(--border)", fontSize: 12, color: "var(--muted)" }}>Cargando evidencia para revisión...</div>;
  if (error) return <div style={{ padding: 12, borderRadius: 12, background: "rgba(239,68,68,.06)", border: "1px solid rgba(239,68,68,.2)", color: "#fca5a5", fontSize: 12 }}>{error}</div>;

  const reviewableItems = items.filter((i) => i.status === "submitted" || i.status === "rejected");

  return (
    <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 14, padding: 14, display: "grid", gap: 12 }}>

      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", gap: 8, justifyContent: "space-between" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <FileText size={14} color="var(--muted)" />
          <span style={{ fontSize: 12, fontWeight: 800, color: "var(--ink)" }}>
            Revisión de evidencia (ops)
          </span>
          {reviewableItems.length > 0 && (
            <span style={{ padding: "2px 8px", borderRadius: 6, background: "rgba(251,191,36,.15)", border: "1px solid rgba(251,191,36,.3)", fontSize: 10, fontWeight: 800, color: "#fbbf24" }}>
              {reviewableItems.length} pendiente{reviewableItems.length > 1 ? "s" : ""}
            </span>
          )}
        </div>
        <button type="button" onClick={() => void load()} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--muted)" }}>
          <RefreshCw size={12} />
        </button>
      </div>

      {items.length === 0 && (
        <div style={{ fontSize: 12, color: "var(--muted)", textAlign: "center", padding: "8px 0" }}>
          Sin evidence items para este milestone
        </div>
      )}

      {/* Items */}
      {items.map((item) => {
        const parsed = parseReviewNote(item.reviewNote);
        const agentData = agentResults[item.id] ?? parsed.agent;
        const adminData = parsed.admin;
        const currentAction = activeAction[item.id] ?? null;
        const isBusy = submitting[item.id] ?? false;
        const isRunningReview = runningReview[item.id] ?? false;
        const canReview = item.status === "submitted" || item.status === "missing" || item.status === "rejected";

        return (
          <div
            key={item.id}
            style={{
              padding: "12px 14px",
              borderRadius: 12,
              background: "rgba(255,255,255,.03)",
              border: `1px solid ${statusColor(item.status)}33`,
              display: "grid",
              gap: 10,
            }}
          >
            {/* Item header */}
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <StatusIcon status={item.status} />
              <span style={{ fontSize: 12, fontWeight: 700, color: "var(--ink)", flex: 1 }}>{item.label}</span>
              <span style={{ fontSize: 10, fontWeight: 800, color: statusColor(item.status), textTransform: "uppercase" }}>
                {STATUS_LABELS[item.status]}
              </span>
              {item.required && (
                <span style={{ fontSize: 9, color: "var(--muted)", border: "1px solid var(--border)", borderRadius: 4, padding: "1px 4px" }}>
                  req.
                </span>
              )}
            </div>

            {item.description && (
              <div style={{ fontSize: 11, color: "var(--muted)", paddingLeft: 21 }}>{item.description}</div>
            )}

            {/* Agent review findings */}
            {agentData && (
              <div style={{ paddingLeft: 21, background: "rgba(99,102,241,.06)", border: "1px solid rgba(99,102,241,.2)", borderRadius: 10, padding: 10, display: "grid", gap: 6 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 11 }}>
                  <Bot size={11} color="#818cf8" />
                  <span style={{ fontWeight: 800, color: "#818cf8" }}>Revisión IA</span>
                  {agentData.confidence != null && (
                    <span style={{ marginLeft: "auto", fontSize: 10, color: confidenceColor(agentData.confidence) }}>
                      {Math.round(agentData.confidence * 100)}% confianza
                    </span>
                  )}
                </div>
                {agentData.reviewStatus && (
                  <div style={{ fontSize: 11 }}>
                    <strong>Estado recomendado:</strong>{" "}
                    <span style={{ color: agentData.reviewStatus === "approved_suggestion" ? "#86efac" : "#fbbf24" }}>
                      {agentData.reviewStatus.replace(/_/g, " ")}
                    </span>
                  </div>
                )}
                {agentData.findings && agentData.findings.length > 0 && (
                  <div style={{ fontSize: 11, color: "var(--muted)" }}>
                    {agentData.findings.slice(0, 2).map((f, i) => <div key={i}>• {f}</div>)}
                  </div>
                )}
                {agentData.auditReason && (
                  <div style={{ fontSize: 11, color: "var(--muted)", fontStyle: "italic" }}>{agentData.auditReason}</div>
                )}
                {agentData.disputeRisk && (
                  <div style={{ fontSize: 11, color: "#f87171", display: "flex", alignItems: "center", gap: 4 }}>
                    <AlertTriangle size={10} />
                    Riesgo de disputa detectado
                  </div>
                )}
              </div>
            )}

            {/* Previous admin review */}
            {adminData && (
              <div style={{ paddingLeft: 21, fontSize: 11, color: "var(--muted)", borderLeft: "2px solid var(--border)" }}>
                <strong>Revisión ops:</strong> {adminData.status} — {adminData.reason}
              </div>
            )}

            {/* Action buttons — only if submitted/reviewable */}
            {canReview && item.status === "submitted" && !currentAction && (
              <div style={{ paddingLeft: 21, display: "flex", flexWrap: "wrap", gap: 6 }}>
                <button
                  type="button"
                  disabled={isBusy}
                  onClick={() => setActiveAction((a) => ({ ...a, [item.id]: "approve" }))}
                  style={{ padding: "6px 12px", borderRadius: 8, border: "1px solid rgba(134,239,172,.4)", background: "rgba(134,239,172,.08)", color: "#86efac", fontSize: 11, fontWeight: 700, cursor: "pointer" }}
                >
                  <CheckCircle size={11} style={{ marginRight: 4, verticalAlign: "middle" }} />
                  Aprobar
                </button>
                <button
                  type="button"
                  disabled={isBusy}
                  onClick={() => setActiveAction((a) => ({ ...a, [item.id]: "reject" }))}
                  style={{ padding: "6px 12px", borderRadius: 8, border: "1px solid rgba(248,113,113,.4)", background: "rgba(248,113,113,.08)", color: "#f87171", fontSize: 11, fontWeight: 700, cursor: "pointer" }}
                >
                  <XCircle size={11} style={{ marginRight: 4, verticalAlign: "middle" }} />
                  Rechazar
                </button>
                <button
                  type="button"
                  disabled={isBusy}
                  onClick={() => setActiveAction((a) => ({ ...a, [item.id]: "needs_reupload" }))}
                  style={{ padding: "6px 12px", borderRadius: 8, border: "1px solid rgba(251,146,60,.4)", background: "rgba(251,146,60,.08)", color: "#fb923c", fontSize: 11, fontWeight: 700, cursor: "pointer" }}
                >
                  <Upload size={11} style={{ marginRight: 4, verticalAlign: "middle" }} />
                  Pedir reupload
                </button>
                {!agentData && (
                  <button
                    type="button"
                    disabled={isRunningReview}
                    onClick={() => void runAgentReview(item)}
                    style={{ padding: "6px 12px", borderRadius: 8, border: "1px solid rgba(99,102,241,.3)", background: "rgba(99,102,241,.06)", color: "#818cf8", fontSize: 11, fontWeight: 700, cursor: "pointer" }}
                  >
                    <Bot size={11} style={{ marginRight: 4, verticalAlign: "middle" }} />
                    {isRunningReview ? "Analizando..." : "Revisar con IA"}
                  </button>
                )}
              </div>
            )}

            {/* Confirm action panel */}
            {currentAction && (
              <div style={{ paddingLeft: 21, display: "grid", gap: 8 }}>
                {currentAction === "approve" ? (
                  <div style={{ fontSize: 12, color: "#86efac" }}>¿Confirmar aprobación de esta evidencia?</div>
                ) : (
                  <>
                    <div style={{ fontSize: 12, color: currentAction === "reject" ? "#f87171" : "#fb923c" }}>
                      {currentAction === "reject" ? "Razón del rechazo (obligatorio):" : "Indicar qué falta o qué corregir (obligatorio):"}
                    </div>
                    <textarea
                      rows={3}
                      value={reasonText[item.id] ?? ""}
                      onChange={(e) => setReasonText((r) => ({ ...r, [item.id]: e.target.value }))}
                      placeholder={currentAction === "reject" ? "Ej: La foto está borrosa..." : "Ej: Subir foto del panel completo..."}
                      style={{ width: "100%", padding: "8px 10px", borderRadius: 8, border: "1px solid var(--border)", background: "var(--surface)", color: "var(--ink)", fontSize: 12, resize: "none", outline: "none" }}
                    />
                  </>
                )}

                {actionErrors[item.id] && (
                  <div style={{ fontSize: 11, color: "#fca5a5" }}>{actionErrors[item.id]}</div>
                )}

                <div style={{ display: "flex", gap: 8 }}>
                  <button
                    type="button"
                    disabled={isBusy}
                    onClick={() => void submitAction(item, currentAction)}
                    style={{
                      padding: "6px 14px", borderRadius: 8, border: "none", fontSize: 11, fontWeight: 700, cursor: isBusy ? "not-allowed" : "pointer",
                      background: currentAction === "approve" ? "#16a34a" : currentAction === "reject" ? "#dc2626" : "#ea580c",
                      color: "#fff", opacity: isBusy ? 0.7 : 1,
                    }}
                  >
                    {isBusy ? "Guardando..." : currentAction === "approve" ? "Confirmar aprobación" : currentAction === "reject" ? "Confirmar rechazo" : "Confirmar reupload"}
                  </button>
                  <button
                    type="button"
                    onClick={() => { setActiveAction((a) => { const n = { ...a }; delete n[item.id]; return n; }); setActionErrors((e) => { const n = { ...e }; delete n[item.id]; return n; }); }}
                    style={{ padding: "6px 12px", borderRadius: 8, border: "1px solid var(--border)", background: "none", color: "var(--muted)", fontSize: 11, cursor: "pointer" }}
                  >
                    Cancelar
                  </button>
                </div>
              </div>
            )}

            {/* Re-run review option for already reviewed items */}
            {item.status === "submitted" && agentData && (
              <div style={{ paddingLeft: 21 }}>
                <button type="button" disabled={isRunningReview} onClick={() => void runAgentReview(item)}
                  style={{ fontSize: 10, color: "var(--muted)", background: "none", border: "none", cursor: "pointer", textDecoration: "underline" }}>
                  {isRunningReview ? "Analizando..." : "Re-run revisión IA"}
                </button>
              </div>
            )}

            {/* Archive button — ops only, any non-archived status */}
            {item.status !== "archived" && archivingId !== item.id && (
              <div style={{ paddingLeft: 21 }}>
                <button type="button" onClick={() => setArchivingId(item.id)}
                  style={{ fontSize: 10, color: "#f87171", background: "none", border: "none", cursor: "pointer", display: "flex", alignItems: "center", gap: 4 }}>
                  <Archive size={10} /> Archivar evidencia
                </button>
              </div>
            )}
            {archivingId === item.id && (
              <div style={{ paddingLeft: 21, display: "grid", gap: 6 }}>
                <textarea rows={2} value={archiveReason[item.id] ?? ""}
                  onChange={(e) => setArchiveReason((r) => ({ ...r, [item.id]: e.target.value }))}
                  placeholder="Razón del archivado (obligatorio)"
                  style={{ width: "100%", padding: "6px 8px", borderRadius: 6, border: "1px solid var(--border)", background: "var(--surface)", color: "var(--ink)", fontSize: 11, resize: "none" }} />
                {archiveErrors[item.id] && <div style={{ fontSize: 10, color: "#fca5a5" }}>{archiveErrors[item.id]}</div>}
                <div style={{ display: "flex", gap: 6 }}>
                  <button type="button" onClick={async () => {
                    const reason = archiveReason[item.id]?.trim();
                    if (!reason) { setArchiveErrors((e) => ({ ...e, [item.id]: "La razón es obligatoria" })); return; }
                    try {
                      const res = await fetch(`/api/semse/milestones/${milestoneId}/evidence-items/${item.id}/archive`,
                        { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ archiveReason: reason }) });
                      if (!res.ok) throw new Error("Error al archivar");
                      setArchivingId(null); setArchiveReason((r) => { const n = { ...r }; delete n[item.id]; return n; });
                      await load(); onReviewed?.();
                    } catch (err) { setArchiveErrors((e) => ({ ...e, [item.id]: (err as Error).message })); }
                  }} style={{ padding: "4px 10px", borderRadius: 6, border: "none", background: "#dc2626", color: "#fff", fontSize: 10, fontWeight: 700, cursor: "pointer" }}>
                    Confirmar archivado
                  </button>
                  <button type="button" onClick={() => { setArchivingId(null); setArchiveErrors({}); }}
                    style={{ padding: "4px 10px", borderRadius: 6, border: "1px solid var(--border)", background: "none", color: "var(--muted)", fontSize: 10, cursor: "pointer" }}>
                    Cancelar
                  </button>
                </div>
              </div>
            )}

            {/* Ver detalle expandible */}
            <div style={{ paddingLeft: 21 }}>
              <button type="button" onClick={() => setExpandedDetail((d) => ({ ...d, [item.id]: !d[item.id] }))}
                style={{ display: "flex", alignItems: "center", gap: 4, background: "none", border: "none", cursor: "pointer", color: "var(--muted)", fontSize: 10 }}>
                {expandedDetail[item.id] ? <ChevronUp size={10} /> : <ChevronDown size={10} />}
                {expandedDetail[item.id] ? "Ocultar detalle" : "Ver detalle / historial"}
              </button>
            </div>
            {expandedDetail[item.id] && (
              <EvidenceItemDetailPanel milestoneId={milestoneId} itemId={item.id} onReplaced={() => { void load(); onReviewed?.(); }} />
            )}
          </div>
        );
      })}
    </div>
  );
}
