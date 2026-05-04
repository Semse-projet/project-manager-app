"use client";

/**
 * Admin — Disputas
 * Resolución de conflictos entre clientes y profesionales
 * Conectado a GET /api/semse/disputes y POST /api/semse/disputes/{id}/resolve
 */

import { useEffect, useState, useCallback, useMemo, useRef } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import {
  AlertTriangle, ArrowUpRight, Clock, DollarSign, User, MessageSquare,
  CheckCircle, XCircle, Scale, RefreshCw, ShieldAlert,
} from "lucide-react";
import { HtmlInCanvasPanel, StatusBadge } from "@semse/ui";
import {
  completeMultipartUploadSession,
  createMultipartUploadSession,
  decideAgentApproval,
  fetchPendingApprovals,
  addDisputeComment,
  fetchDisputeComments,
  sendNotification,
  planUpload,
  uploadMultipartPart,
  type AgentApprovalItem
} from "../../../semse-api";
import { DisputeResolutionWorkspace } from "../../../components/disputes/DisputeResolutionWorkspace";
import { NotificationBanner } from "../../../components/notifications/NotificationBanner";

// ─────────────────────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────────────────────

interface DisputeRecord {
  id: string;
  jobId?: string;
  jobTitle?: string;
  clientId?: string;
  client?: string;
  workerId?: string;
  worker?: string;
  amount?: number;
  reason: string;
  status: string;
  severity?: string;
  openedAt?: string;
  createdAt?: string;
  updatedAt?: string;
  lastUpdate?: string;
  messages?: number;
  resolution?: string;
  [key: string]: unknown;
}

type UploadPlanView = {
  recommendedStrategy?: string;
  uploadGuidance?: string;
  maxSingleUploadBytes?: number;
  multipart?: {
    recommendedChunkSizeBytes?: number;
    recommendedPartCount?: number;
  } | null;
};

type MultipartSessionView = UploadPlanView & {
  sessionId?: string;
  provider?: string;
  expiresAt?: string;
  parts?: Array<{
    partNumber?: number;
    startByte?: number;
    endByte?: number;
    uploadUrl?: string;
  }>;
};

// ─────────────────────────────────────────────────────────────
// CONFIG
// ─────────────────────────────────────────────────────────────

const STATUS_CONFIG: Record<string, { variant: "error" | "warning" | "success" | "neutral" | "info"; label: string }> = {
  escalated: { variant: "error",   label: "Escalada"  },
  open:      { variant: "warning", label: "Abierta"   },
  opened:    { variant: "warning", label: "Abierta"   },
  resolved:  { variant: "success", label: "Resuelta"  },
  pending:   { variant: "neutral", label: "Pendiente" },
  closed:    { variant: "neutral", label: "Cerrada"   },
};

const SEVERITY_COLOR: Record<string, string> = {
  high:   "#ef4444",
  medium: "#f59e0b",
  low:    "#10b981",
};

const RESOLVE_OPTIONS = [
  { label: "Resolver a favor del cliente",      value: "Resuelto a favor del cliente",      color: "#10b981", icon: CheckCircle },
  { label: "Resolver a favor del profesional",  value: "Resuelto a favor del profesional",  color: "#3b82f6", icon: CheckCircle },
  { label: "Solución parcial (50/50)",          value: "Solución parcial acordada: 50%/50% entre ambas partes", color: "#f59e0b", icon: Scale      },
  { label: "Escalar a legal",                   value: "Escalado al equipo legal para revisión",               color: "#ef4444", icon: XCircle    },
] as const;

// ─────────────────────────────────────────────────────────────
// PAGE
// ─────────────────────────────────────────────────────────────

export default function AdminDisputesPage() {
  const searchParams = useSearchParams();
  const [disputes, setDisputes]     = useState<DisputeRecord[]>([]);
  const [loading, setLoading]       = useState(true);
  const [apiError, setApiError]     = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  const [selected, setSelected]     = useState<string | null>(null);
  const [tab, setTab]               = useState<"all" | "open" | "resolved">("all");
  const [priorityFilter, setPriorityFilter] = useState<"all" | "pending_approval" | "with_comments">("all");
  const [workspaceDisputeId, setWorkspaceDisputeId] = useState<string | null>(() => searchParams?.get("workspaceId") ?? null);
  const [pendingApprovals, setPendingApprovals] = useState<AgentApprovalItem[]>([]);
  const [commentCounts, setCommentCounts] = useState<Record<string, number>>({});

  // Resolve panel state
  const [customResolution, setCustomResolution] = useState("");
  const [resolving, setResolving]   = useState(false);
  const [resolveError, setResolveError] = useState<string | null>(null);
  const [attachmentName, setAttachmentName] = useState("dispute-evidence-bundle.zip");
  const [attachmentSizeMb, setAttachmentSizeMb] = useState("80");
  const [uploadPlan, setUploadPlan] = useState<UploadPlanView | null>(null);
  const [planningUpload, setPlanningUpload] = useState(false);
  const [multipartSession, setMultipartSession] = useState<MultipartSessionView | null>(null);
  const [completingMultipart, setCompletingMultipart] = useState(false);
  const [multipartProgress, setMultipartProgress] = useState<Record<number, "pending" | "uploading" | "uploaded">>({});

  const loadDisputes = useCallback(async () => {
    setLoading(true);
    setApiError(null);
    try {
      const res = await fetch("/api/semse/disputes");
      const d = (await res.json()) as { data?: DisputeRecord[]; error?: { message: string } };
      if (d.error) { setApiError(d.error.message); return; }
      const rows = d.data ?? [];
      setDisputes(rows);
      setLastUpdated(new Date());

      // Cargar approvals pendientes y contadores de comentarios en paralelo
      void fetchPendingApprovals().then(setPendingApprovals).catch(() => {});
      void Promise.all(
        rows
          .filter(r => r.status !== "resolved" && r.status !== "closed")
          .slice(0, 12)
          .map(async (r) => {
            try {
              const comments = await fetchDisputeComments(r.id);
              return [r.id, comments.length] as [string, number];
            } catch {
              return [r.id, 0] as [string, number];
            }
          })
      ).then((entries) => {
        setCommentCounts(Object.fromEntries(entries));
      });
    } catch {
      setApiError("No se pudo conectar con el servidor");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadDisputes(); }, [loadDisputes]);

  const workspacePanelRef = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    if (!loading && workspaceDisputeId && workspacePanelRef.current) {
      workspacePanelRef.current.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  }, [loading, workspaceDisputeId]);

  const disputeIdsWithPendingApproval = useMemo(() => {
    const ids = new Set<string>();
    for (const approval of pendingApprovals) {
      let ctx: Record<string, unknown> = {};
      try { ctx = JSON.parse(approval.contextSummary ?? "{}") as Record<string, unknown>; } catch {}
      const projectId = typeof ctx.projectId === "string" ? ctx.projectId : "";
      const disputeId = typeof ctx.disputeId === "string" ? ctx.disputeId : "";
      if (disputeId) ids.add(disputeId);
      if (projectId) {
        for (const d of disputes) {
          if ((d.jobId ?? d.id) === projectId) ids.add(d.id);
        }
      }
      const haystack = [approval.reason, approval.title, approval.contextSummary].join(" ").toLowerCase();
      for (const d of disputes) {
        if (haystack.includes(d.id.toLowerCase()) || (d.jobId && haystack.includes(d.jobId.toLowerCase()))) {
          ids.add(d.id);
        }
      }
    }
    return ids;
  }, [pendingApprovals, disputes]);

  const filtered = useMemo(() => {
    return disputes.filter(d => {
      if (tab === "open")     { if (d.status === "resolved" || d.status === "closed") return false; }
      if (tab === "resolved") { if (d.status !== "resolved" && d.status !== "closed") return false; }
      if (priorityFilter === "pending_approval") return disputeIdsWithPendingApproval.has(d.id);
      if (priorityFilter === "with_comments")    return (commentCounts[d.id] ?? 0) > 0;
      return true;
    });
  }, [disputes, tab, priorityFilter, disputeIdsWithPendingApproval, commentCounts]);

  const selectedDispute = disputes.find(d => d.id === selected);

  const handleResolve = async (resolution: string) => {
    const targetId = workspaceDisputeId ?? selected;
    if (!targetId || !resolution.trim()) return;
    setResolving(true);
    setResolveError(null);
    try {
      const res = await fetch(`/api/semse/disputes/${targetId}/resolve`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ resolution: resolution.trim() }),
      });
      const data = (await res.json()) as { data?: unknown; error?: { message: string } };
      if (!res.ok || data.error) {
        setResolveError(data.error?.message ?? `Error ${res.status}`);
        return;
      }
      setDisputes(prev =>
        prev.map(d => d.id === targetId ? { ...d, status: "resolved", resolution: resolution.trim() } : d)
      );
      setCustomResolution("");

      // Auto-comment financiero: guía la siguiente acción según el tipo de resolución
      const lower = resolution.toLowerCase();
      let financeNote: string | null = null;
      if (/profesional|worker|proveedor/.test(lower)) {
        financeNote = `Disputa resuelta a favor del profesional. Acción sugerida: liberar escrow retenido al profesional. Ir a Pagos para confirmar la liberación.`;
      } else if (/cliente|client/.test(lower)) {
        financeNote = `Disputa resuelta a favor del cliente. Acción sugerida: reembolsar fondos retenidos al cliente. Ir a Pagos para confirmar el retorno.`;
      } else if (/parcial|50/.test(lower)) {
        financeNote = `Resolución parcial acordada. Acción sugerida: dividir el escrow retenido según el acuerdo. Confirmar montos en el módulo de Pagos.`;
      } else if (/legal/.test(lower)) {
        financeNote = `Disputa escalada a legal. Los fondos permanecen retenidos hasta resolución definitiva del equipo legal.`;
      }
      if (financeNote) {
        await addDisputeComment(targetId, { text: financeNote, author: "Sistema · Finanzas" }).catch(() => {});
      }

      // Notificaciones in-app para ambas partes
      const notifTitle = "Disputa resuelta";
      const notifBody = resolution.trim().slice(0, 120);
      const disputeLink = "/client/disputes";
      await Promise.all([
        sendNotification({ title: notifTitle, body: notifBody, kind: "dispute", targetRole: "client", linkHref: disputeLink }).catch(() => {}),
        sendNotification({ title: notifTitle, body: notifBody, kind: "dispute", targetRole: "worker", linkHref: "/worker/disputes" }).catch(() => {}),
      ]);
    } catch {
      setResolveError("Error al enviar la resolución");
    } finally {
      setResolving(false);
    }
  };

  const handlePlanAttachment = async () => {
    setPlanningUpload(true);
    try {
      const sizeMb = Math.max(1, Number(attachmentSizeMb || "0"));
      const result = (await planUpload({
        domain: "dispute",
        filename: attachmentName.trim() || "dispute-evidence-bundle.zip",
        contentType: /\.zip$/i.test(attachmentName) ? "application/zip" : "application/pdf",
        fileSizeBytes: sizeMb * 1024 * 1024,
        source: sizeMb > 25 ? "external_transfer" : "local_device"
      })) as UploadPlanView;
      setUploadPlan(result);
      if (result.recommendedStrategy === "external_transfer") {
        const session = (await createMultipartUploadSession({
          domain: "dispute",
          filename: attachmentName.trim() || "dispute-evidence-bundle.zip",
          contentType: /\.zip$/i.test(attachmentName) ? "application/zip" : "application/pdf",
          fileSizeBytes: sizeMb * 1024 * 1024,
          source: "external_transfer"
        })) as MultipartSessionView;
        setMultipartSession(session);
        setMultipartProgress(
          Object.fromEntries((session.parts ?? []).map((part, index) => [part.partNumber ?? index + 1, "pending"]))
        );
      } else {
        setMultipartSession(null);
        setMultipartProgress({});
      }
    } catch {
      setMultipartSession(null);
      setMultipartProgress({});
    } finally {
      setPlanningUpload(false);
    }
  };

  const handleCompleteMultipart = async () => {
    if (!multipartSession?.sessionId || !multipartSession.parts?.length || completingMultipart) return;
    setCompletingMultipart(true);
    try {
      for (const [index, part] of multipartSession.parts.entries()) {
        const partNumber = part.partNumber ?? index + 1;
        const bytes = typeof part.endByte === "number" && typeof part.startByte === "number"
          ? Math.max(1, part.endByte - part.startByte + 1)
          : 1024 * 1024;
        setMultipartProgress((current) => ({ ...current, [partNumber]: "uploading" }));
        await uploadMultipartPart({
          sessionId: multipartSession.sessionId,
          partNumber,
          contentLength: bytes
        });
        setMultipartProgress((current) => ({ ...current, [partNumber]: "uploaded" }));
      }
      await completeMultipartUploadSession({
        sessionId: multipartSession.sessionId,
        parts: multipartSession.parts.map((part, index) => ({
          partNumber: part.partNumber ?? index + 1,
          etag: `etag-part-${part.partNumber ?? index + 1}`
        }))
      });
    } finally {
      setCompletingMultipart(false);
    }
  };

  const workspaceDispute = useMemo(() => {
    const raw = disputes.find((d) => d.id === workspaceDisputeId);
    if (!raw) return null;
    return {
      id: raw.id,
      projectId: raw.jobId ?? raw.id,
      reason: raw.reason,
      status: (raw.status === "resolved" || raw.status === "closed" ? "resolved" : raw.status === "escalated" ? "assigned" : "open") as "open" | "assigned" | "resolved",
      resolution: raw.resolution,
      jobId: raw.jobId,
      jobTitle: raw.jobTitle ?? `Disputa #${raw.id.slice(0, 8)}`,
      projectStatus: raw.status,
    };
  }, [disputes, workspaceDisputeId]);

  async function handleApprovalDecide(approvalId: string, decision: "approved" | "rejected") {
    await decideAgentApproval(approvalId, decision);
    if (workspaceDisputeId) {
      const text = decision === "approved"
        ? `Ops aprobó la intervención solicitada (approval ${approvalId.slice(0, 8)}). El copiloto ejecutará la acción acordada.`
        : `Ops rechazó la intervención solicitada (approval ${approvalId.slice(0, 8)}). Las partes deben retomar negociación directa.`;
      await addDisputeComment(workspaceDisputeId, { text, author: "Sistema" }).catch(() => {});
    }
    // Notificaciones in-app
    const notifBody = decision === "approved"
      ? "Ops aprobó la intervención solicitada en tu disputa."
      : "Ops rechazó la intervención. Retoma la negociación directa con la otra parte.";
    await Promise.all([
      sendNotification({ title: "Decisión de ops", body: notifBody, kind: "approval", targetRole: "client", linkHref: "/client/disputes" }).catch(() => {}),
      sendNotification({ title: "Decisión de ops", body: notifBody, kind: "approval", targetRole: "worker", linkHref: "/worker/disputes" }).catch(() => {}),
    ]);
    await loadDisputes();
  }

  const card: React.CSSProperties = {
    background: "var(--surface)", border: "1px solid var(--border)", borderRadius: "12px",
  };

  // Derive KPIs from real data
  const openCount      = disputes.filter(d => d.status === "open" || d.status === "opened").length;
  const escalatedCount = disputes.filter(d => d.status === "escalated").length;
  const resolvedCount  = disputes.filter(d => d.status === "resolved" || d.status === "closed").length;
  const totalAmount    = disputes.reduce((a, d) => a + (d.amount ?? 0), 0);

  return (
    <div style={{ maxWidth: "1100px", margin: "0 auto" }}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: "24px", gap: "12px", flexWrap: "wrap" }}>
        <div>
          <Link href="/admin/dashboard" style={{ display: "inline-flex", alignItems: "center", gap: "5px", color: "var(--muted)", fontSize: "12px", fontWeight: 600, textDecoration: "none", marginBottom: "8px" }}>
            <span style={{ fontSize: "14px" }}>←</span> Dashboard
          </Link>
          <h1 style={{ fontSize: "22px", fontWeight: 800, color: "var(--ink)", marginBottom: "4px" }}>Disputas</h1>
          <p style={{ fontSize: "13px", color: "var(--muted)" }}>
            Resolución de conflictos entre clientes y profesionales
            {lastUpdated && <span> · actualizado {lastUpdated.toLocaleTimeString("es-ES", { hour: "2-digit", minute: "2-digit" })}</span>}
          </p>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <NotificationBanner audience="admin" />
          <button
            onClick={loadDisputes}
            disabled={loading}
            style={{
              display: "flex", alignItems: "center", gap: "6px",
              padding: "8px 14px", borderRadius: "8px",
              border: "1px solid var(--border)", background: "var(--surface)",
              color: "var(--muted)", fontSize: "12px", fontWeight: 600, cursor: "pointer",
            }}
          >
            <RefreshCw size={13} style={{ animation: loading ? "spin 1s linear infinite" : "none" }} />
            Refrescar
          </button>
        </div>
      </div>

      {/* API Error */}
      {apiError && (
        <div style={{ marginBottom: "16px", padding: "14px 16px", background: "rgba(239,68,68,.06)", border: "1px solid rgba(239,68,68,.2)", borderRadius: "10px", color: "#ef4444", fontSize: "13px", display: "flex", alignItems: "center", gap: "8px" }}>
          <AlertTriangle size={14} style={{ flexShrink: 0 }} />
          {apiError} — configura <code>SEMSE_API_BASE_URL</code> para conectar el backend.
        </div>
      )}

      {/* Summary KPIs */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: "10px", marginBottom: "20px" }}>
        {[
          { label: "Abiertas",          value: loading ? "—" : openCount,                          color: "#f59e0b", icon: AlertTriangle },
          { label: "Escaladas",         value: loading ? "—" : escalatedCount,                     color: "#ef4444", icon: ShieldAlert  },
          { label: "Approval pendiente",value: loading ? "—" : disputeIdsWithPendingApproval.size, color: "#f97316", icon: CheckCircle  },
          { label: "Resueltas",         value: loading ? "—" : resolvedCount,                      color: "#10b981", icon: CheckCircle  },
        ].map(kpi => {
          const Icon = kpi.icon;
          return (
            <div key={kpi.label} style={{ ...card, padding: "12px 14px" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 4 }}>
                <Icon size={13} color={kpi.color} />
                <p style={{ fontSize: "11px", color: "var(--muted)", fontWeight: 600, margin: 0 }}>{kpi.label.toUpperCase()}</p>
              </div>
              <p style={{ fontSize: "22px", fontWeight: 800, color: kpi.color, marginTop: "4px" }}>{kpi.value}</p>
            </div>
          );
        })}
      </div>

      <div style={{ display: "grid", gridTemplateColumns: workspaceDispute ? "minmax(0, 1fr) minmax(340px, .9fr)" : selected ? "1fr 420px" : "1fr", gap: "14px", alignItems: "start" }}>
        {/* Dispute List */}
        <div>
          <div style={{ display: "flex", gap: 10, marginBottom: 12, flexWrap: "wrap", alignItems: "center" }}>
            <div style={{ display: "flex", gap: "4px", background: "var(--surface)", padding: "4px", borderRadius: "10px", border: "1px solid var(--border)" }}>
              {(["all", "open", "resolved"] as const).map(t => (
                <button
                  key={t}
                  onClick={() => setTab(t)}
                  style={{
                    padding: "5px 14px", borderRadius: "7px", border: "none",
                    background: tab === t ? "#ef4444" : "transparent",
                    color: tab === t ? "#fff" : "var(--muted)",
                    fontSize: "12px", fontWeight: 600, cursor: "pointer",
                  }}
                >
                  {t === "all" ? "Todas" : t === "open" ? "Activas" : "Resueltas"}
                </button>
              ))}
            </div>
            <div style={{ display: "flex", gap: "4px", background: "var(--surface)", padding: "4px", borderRadius: "10px", border: "1px solid var(--border)" }}>
              {([
                { key: "all" as const, label: "Sin filtro" },
                { key: "pending_approval" as const, label: `Approval pendiente${disputeIdsWithPendingApproval.size > 0 ? ` (${disputeIdsWithPendingApproval.size})` : ""}` },
                { key: "with_comments" as const, label: "Con argumentos" },
              ]).map(f => (
                <button
                  key={f.key}
                  onClick={() => setPriorityFilter(f.key)}
                  style={{
                    padding: "5px 12px", borderRadius: "7px", border: "none",
                    background: priorityFilter === f.key ? "#f59e0b" : "transparent",
                    color: priorityFilter === f.key ? "#fff" : "var(--muted)",
                    fontSize: "11px", fontWeight: 700, cursor: "pointer", whiteSpace: "nowrap",
                  }}
                >
                  {f.label}
                </button>
              ))}
            </div>
          </div>

          {loading ? (
            <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
              {[1, 2, 3].map(i => (
                <div key={i} style={{ height: "88px", borderRadius: "12px", background: "var(--raised)", animation: "pulse 1.5s ease-in-out infinite" }} />
              ))}
            </div>
          ) : filtered.length === 0 ? (
            <div style={{ padding: "48px 24px", textAlign: "center", background: "var(--surface)", border: "1px solid var(--border)", borderRadius: "12px" }}>
              <Scale size={36} style={{ color: "var(--faint)", margin: "0 auto 12px" }} />
              <p style={{ fontSize: "14px", fontWeight: 700, color: "var(--ink)" }}>No hay disputas</p>
              <p style={{ fontSize: "13px", color: "var(--muted)", marginTop: "4px" }}>
                {disputes.length === 0 ? "No hay disputas registradas en el sistema." : "No hay disputas en esta categoría."}
              </p>
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
              {filtered.map(d => {
                const s = STATUS_CONFIG[d.status] ?? { variant: "neutral" as const, label: d.status };
                const severityColor = SEVERITY_COLOR[d.severity ?? "medium"] ?? "#f59e0b";
                return (
                  <button
                    key={d.id}
                    onClick={() => { setSelected(selected === d.id ? null : d.id); setResolveError(null); setCustomResolution(""); }}
                    style={{
                      ...card,
                      display: "flex", alignItems: "flex-start", gap: "14px",
                      padding: "15px 16px", textAlign: "left", cursor: "pointer",
                      borderColor: selected === d.id ? "#ef4444" : "var(--border)",
                      background: selected === d.id ? "#ef444408" : "var(--surface)",
                      width: "100%",
                    }}
                  >
                    <div style={{ width: "4px", alignSelf: "stretch", borderRadius: "2px", background: severityColor, flexShrink: 0 }} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "4px", flexWrap: "wrap" }}>
                        <p style={{ fontSize: "13px", fontWeight: 700, color: "var(--ink)" }}>
                          #{d.id.slice(0, 8)} {d.jobTitle ? `· ${d.jobTitle}` : d.jobId ? `· job ${d.jobId.slice(0, 8)}` : ""}
                        </p>
                        <StatusBadge variant={s.variant} text={s.label} size="sm" />
                        {disputeIdsWithPendingApproval.has(d.id) ? (
                          <span style={{ fontSize: "10px", fontWeight: 800, padding: "2px 7px", borderRadius: 999, background: "rgba(245,158,11,.15)", color: "#f59e0b", border: "1px solid rgba(245,158,11,.28)" }}>
                            APPROVAL PENDIENTE
                          </span>
                        ) : null}
                        {(commentCounts[d.id] ?? 0) > 0 ? (
                          <span style={{ fontSize: "10px", fontWeight: 700, padding: "2px 7px", borderRadius: 999, background: "rgba(99,102,241,.12)", color: "#818cf8", border: "1px solid rgba(99,102,241,.22)", display: "flex", alignItems: "center", gap: 4 }}>
                            <MessageSquare size={10} /> {commentCounts[d.id]}
                          </span>
                        ) : null}
                      </div>
                      <p style={{ fontSize: "12px", color: "var(--muted)", marginBottom: "6px", lineHeight: 1.4, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                        {d.reason}
                      </p>
                      <div style={{ display: "flex", gap: "12px", flexWrap: "wrap" }}>
                        {(d.client || d.worker) && (
                          <span style={{ fontSize: "11px", color: "var(--faint)", display: "flex", alignItems: "center", gap: "3px" }}>
                            <User size={10} /> {d.client ?? "—"} vs {d.worker ?? "—"}
                          </span>
                        )}
                        {d.amount != null && d.amount > 0 && (
                          <span style={{ fontSize: "11px", color: "var(--faint)", display: "flex", alignItems: "center", gap: "3px" }}>
                            <DollarSign size={10} /> ${d.amount.toLocaleString()}
                          </span>
                        )}
                        {(d.updatedAt || d.lastUpdate) && (
                          <span style={{ fontSize: "11px", color: "var(--faint)", display: "flex", alignItems: "center", gap: "3px" }}>
                            <Clock size={10} /> {d.lastUpdate ?? new Date(d.updatedAt as string).toLocaleDateString("es-ES")}
                          </span>
                        )}
                        {d.messages != null && (
                          <span style={{ fontSize: "11px", color: "var(--faint)", display: "flex", alignItems: "center", gap: "3px" }}>
                            <MessageSquare size={10} /> {d.messages} mensajes
                          </span>
                        )}
                      </div>
                      <div style={{ display: "flex", gap: 8, marginTop: 8, flexWrap: "wrap" }}>
                        <button
                          onClick={(e) => { e.stopPropagation(); setWorkspaceDisputeId(workspaceDisputeId === d.id ? null : d.id); }}
                          style={{ padding: "6px 10px", borderRadius: 8, border: workspaceDisputeId === d.id ? "1px solid rgba(239,68,68,.3)" : "1px solid var(--border)", background: workspaceDisputeId === d.id ? "rgba(239,68,68,.09)" : "transparent", color: workspaceDisputeId === d.id ? "#ef4444" : "var(--muted)", fontSize: 11, fontWeight: 700, cursor: "pointer" }}
                        >
                          {workspaceDisputeId === d.id ? "Workspace abierto" : "Abrir workspace"}
                        </button>
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* Workspace panel para admin */}
        {workspaceDispute ? (
          <div ref={workspacePanelRef} style={{ position: "sticky", top: 24, display: "grid", gap: 10 }}>
            <HtmlInCanvasPanel as="section" style={{ padding: "16px 18px" }} canvasClassName="rounded-2xl" minHeight={110}>
              <div style={{ display: "grid", gap: 6 }}>
                <p style={{ margin: 0, fontSize: 11, fontWeight: 800, color: "var(--muted)" }}>WORKSPACE TERCERO</p>
                <h3 style={{ margin: 0, fontSize: 15, fontWeight: 800, color: "var(--ink)" }}>{workspaceDispute.jobTitle}</h3>
                <p style={{ margin: 0, fontSize: 13, color: "var(--muted)", lineHeight: 1.55 }}>{workspaceDispute.reason}</p>
                {workspaceDispute.resolution ? (
                  <p style={{ margin: 0, fontSize: 12, color: "#10b981" }}>Resolución: {workspaceDispute.resolution}</p>
                ) : null}
                {workspaceDispute.status === "resolved" && workspaceDispute.jobId ? (
                  <div style={{ display: "flex", gap: 8, marginTop: 4 }}>
                    <Link
                      href={`/admin/finance`}
                      style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "7px 11px", borderRadius: 9, border: "1px solid rgba(16,185,129,.28)", background: "rgba(16,185,129,.08)", color: "#10b981", fontSize: 12, fontWeight: 700, textDecoration: "none" }}
                    >
                      <ArrowUpRight size={13} /> Confirmar en Pagos
                    </Link>
                  </div>
                ) : null}
              </div>
            </HtmlInCanvasPanel>
            <DisputeResolutionWorkspace
              dispute={workspaceDispute}
              audience="admin"
              canResolve={workspaceDispute.status !== "resolved"}
              relatedHref={workspaceDispute.jobId ? `/admin/dashboard` : undefined}
              evidenceHref="/admin/ops"
              onResolve={async (resolution) => {
                await handleResolve(resolution);
                setWorkspaceDisputeId(null);
              }}
              resolveBusy={resolving}
              onApprovalDecide={handleApprovalDecide}
            />
          </div>
        ) : null}

        {/* Detail / Resolve Panel (original) */}
        {selectedDispute && !workspaceDispute ? (
          <div style={{ ...card, padding: "20px", height: "fit-content", position: "sticky", top: "24px" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "16px" }}>
              <Scale size={16} color="#ef4444" />
              <h3 style={{ fontSize: "14px", fontWeight: 800, color: "var(--ink)" }}>Resolución</h3>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: "10px", marginBottom: "20px" }}>
              <div style={{ background: "var(--bg)", borderRadius: "8px", padding: "12px" }}>
                <p style={{ fontSize: "11px", color: "var(--muted)", fontWeight: 600, marginBottom: "4px" }}>MOTIVO</p>
                <p style={{ fontSize: "13px", color: "var(--ink)", lineHeight: 1.5 }}>{selectedDispute.reason}</p>
              </div>
              {(selectedDispute.client || selectedDispute.worker) && (
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px" }}>
                  <div style={{ background: "var(--bg)", borderRadius: "8px", padding: "10px" }}>
                    <p style={{ fontSize: "10px", color: "var(--muted)", fontWeight: 600 }}>CLIENTE</p>
                    <p style={{ fontSize: "13px", color: "var(--ink)", fontWeight: 600, marginTop: "2px" }}>{selectedDispute.client ?? "—"}</p>
                  </div>
                  <div style={{ background: "var(--bg)", borderRadius: "8px", padding: "10px" }}>
                    <p style={{ fontSize: "10px", color: "var(--muted)", fontWeight: 600 }}>PROFESIONAL</p>
                    <p style={{ fontSize: "13px", color: "var(--ink)", fontWeight: 600, marginTop: "2px" }}>{selectedDispute.worker ?? "—"}</p>
                  </div>
                </div>
              )}
              {selectedDispute.amount != null && selectedDispute.amount > 0 && (
                <div style={{ background: "var(--bg)", borderRadius: "8px", padding: "10px" }}>
                  <p style={{ fontSize: "10px", color: "var(--muted)", fontWeight: 600 }}>MONTO EN DISPUTA</p>
                  <p style={{ fontSize: "20px", color: "#ef4444", fontWeight: 800, marginTop: "3px" }}>${selectedDispute.amount.toLocaleString()}</p>
                </div>
              )}
            </div>

            {selectedDispute.resolution ? (
              <div style={{ padding: "12px", background: "#10b98110", border: "1px solid #10b98130", borderRadius: "8px" }}>
                <p style={{ fontSize: "11px", color: "#10b981", fontWeight: 700, marginBottom: "3px" }}>RESOLUCIÓN APLICADA</p>
                <p style={{ fontSize: "13px", color: "var(--ink)" }}>{selectedDispute.resolution}</p>
              </div>
            ) : (
              <>
                <p style={{ fontSize: "12px", fontWeight: 600, color: "var(--muted)", marginBottom: "8px" }}>ACCIONES RÁPIDAS</p>
                <div style={{ display: "flex", flexDirection: "column", gap: "6px", marginBottom: "14px" }}>
                  {RESOLVE_OPTIONS.map(opt => {
                    const Icon = opt.icon;
                    return (
                      <button
                        key={opt.value}
                        disabled={resolving}
                        onClick={() => handleResolve(opt.value)}
                        style={{
                          padding: "9px", borderRadius: "8px", border: "none",
                          background: opt.color, color: "#fff",
                          fontSize: "13px", fontWeight: 700, cursor: resolving ? "not-allowed" : "pointer",
                          display: "flex", alignItems: "center", justifyContent: "center", gap: "6px",
                          opacity: resolving ? 0.6 : 1,
                        }}
                      >
                        <Icon size={14} /> {opt.label}
                      </button>
                    );
                  })}
                </div>

                <p style={{ fontSize: "12px", fontWeight: 600, color: "var(--muted)", marginBottom: "6px" }}>RESOLUCIÓN PERSONALIZADA</p>
                <textarea
                  value={customResolution}
                  onChange={e => setCustomResolution(e.target.value)}
                  placeholder="Escribe una resolución personalizada..."
                  rows={3}
                  style={{
                    width: "100%", padding: "10px", borderRadius: "8px",
                    border: "1px solid var(--border)", background: "var(--bg)",
                    color: "var(--ink)", fontSize: "13px", outline: "none",
                    resize: "vertical", boxSizing: "border-box", marginBottom: "8px",
                  }}
                />
                <button
                  disabled={resolving || customResolution.trim().length < 5}
                  onClick={() => handleResolve(customResolution)}
                  style={{
                    width: "100%", padding: "9px", borderRadius: "8px",
                    border: "1px solid var(--border)",
                    background: customResolution.trim().length >= 5 && !resolving ? "#6366f1" : "var(--surface)",
                    color: customResolution.trim().length >= 5 && !resolving ? "#fff" : "var(--faint)",
                    fontSize: "13px", fontWeight: 700, cursor: customResolution.trim().length >= 5 && !resolving ? "pointer" : "not-allowed",
                  }}
                >
                  {resolving ? "Enviando..." : "Enviar resolución"}
                </button>

                {resolveError && (
                  <p style={{ marginTop: "8px", fontSize: "12px", color: "#ef4444", textAlign: "center" }}>{resolveError}</p>
                )}
              </>
            )}

            <div style={{ marginTop: "18px", paddingTop: "18px", borderTop: "1px solid var(--border)" }}>
              <p style={{ fontSize: "12px", fontWeight: 700, color: "var(--ink)", marginBottom: "8px" }}>
                Planificar adjuntos de disputa
              </p>
              <div style={{ display: "grid", gap: "8px" }}>
                <input
                  value={attachmentName}
                  onChange={e => setAttachmentName(e.target.value)}
                  placeholder="dispute-evidence-bundle.zip"
                  style={{
                    width: "100%", padding: "10px", borderRadius: "8px",
                    border: "1px solid var(--border)", background: "var(--bg)",
                    color: "var(--ink)", fontSize: "12px", boxSizing: "border-box"
                  }}
                />
                <input
                  value={attachmentSizeMb}
                  onChange={e => setAttachmentSizeMb(e.target.value)}
                  placeholder="80"
                  style={{
                    width: "100%", padding: "10px", borderRadius: "8px",
                    border: "1px solid var(--border)", background: "var(--bg)",
                    color: "var(--ink)", fontSize: "12px", boxSizing: "border-box"
                  }}
                />
                <button
                  type="button"
                  onClick={handlePlanAttachment}
                  disabled={planningUpload}
                  style={{
                    width: "100%", padding: "9px", borderRadius: "8px",
                    border: "1px solid var(--border)",
                    background: "#3b82f6", color: "#fff",
                    fontSize: "12px", fontWeight: 700,
                    cursor: planningUpload ? "not-allowed" : "pointer",
                    opacity: planningUpload ? 0.65 : 1
                  }}
                >
                  {planningUpload ? "Calculando..." : "Planificar carga"}
                </button>
              </div>

              {uploadPlan ? (
                <div style={{ marginTop: "10px", borderRadius: "10px", border: "1px solid rgba(59,130,246,.2)", background: "rgba(59,130,246,.08)", padding: "12px" }}>
                  <p style={{ fontSize: "12px", fontWeight: 700, color: "#dbeafe", marginBottom: "6px" }}>
                    Recomendación de transferencia
                  </p>
                  <div style={{ display: "grid", gap: "4px", fontSize: "12px", color: "#dbeafe" }}>
                    <p>Estrategia: {uploadPlan.recommendedStrategy ?? "single_put"}</p>
                    <p>{uploadPlan.uploadGuidance ?? "Sin guía adicional."}</p>
                    <p>
                      Límite simple:{" "}
                      {typeof uploadPlan.maxSingleUploadBytes === "number"
                        ? `${Math.round(uploadPlan.maxSingleUploadBytes / (1024 * 1024))} MB`
                        : "n/d"}
                    </p>
                    {uploadPlan.multipart ? (
                      <p>
                        Multipart: {uploadPlan.multipart.recommendedPartCount ?? "n/d"} partes de{" "}
                        {typeof uploadPlan.multipart.recommendedChunkSizeBytes === "number"
                          ? `${Math.round(uploadPlan.multipart.recommendedChunkSizeBytes / (1024 * 1024))} MB`
                          : "n/d"}
                      </p>
                    ) : null}
                  </div>
                </div>
              ) : null}

              {multipartSession?.sessionId ? (
                <div style={{ marginTop: "10px", borderRadius: "10px", border: "1px solid rgba(20,184,166,.25)", background: "rgba(20,184,166,.08)", padding: "12px" }}>
                  <p style={{ fontSize: "12px", fontWeight: 700, color: "#ccfbf1", marginBottom: "6px" }}>
                    Sesión multipart creada
                  </p>
                  <div style={{ display: "grid", gap: "4px", fontSize: "12px", color: "#ccfbf1" }}>
                    <p>ID: <span style={{ fontFamily: "monospace" }}>{multipartSession.sessionId}</span></p>
                    <p>Proveedor: {multipartSession.provider ?? "—"}</p>
                    <p>Partes: {multipartSession.parts?.length ?? 0}</p>
                    {(multipartSession.parts?.length ?? 0) > 0 ? (
                      <p>
                        Primer bloque: {Math.round((multipartSession.parts?.[0]?.startByte ?? 0) / (1024 * 1024))} MB -
                        {" "}
                        {Math.round((multipartSession.parts?.[0]?.endByte ?? 0) / (1024 * 1024))} MB
                      </p>
                    ) : null}
                    {multipartSession.parts?.slice(0, 4).map((part) => (
                      <p key={part.partNumber}>
                        Parte {part.partNumber}: {multipartProgress[part.partNumber ?? 0] ?? "pending"}
                      </p>
                    ))}
                  </div>
                  <button
                    type="button"
                    onClick={handleCompleteMultipart}
                    disabled={completingMultipart}
                    style={{
                      width: "100%", padding: "9px", borderRadius: "8px",
                      border: "1px solid rgba(20,184,166,.35)",
                      background: "#0f766e", color: "#fff",
                      fontSize: "12px", fontWeight: 700,
                      cursor: completingMultipart ? "not-allowed" : "pointer",
                      opacity: completingMultipart ? 0.65 : 1,
                      marginTop: "10px"
                    }}
                  >
                    {completingMultipart ? "Cerrando sesión..." : "Completar sesión multipart"}
                  </button>
                </div>
              ) : null}
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}
