"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { AlertTriangle, ArrowUpRight, Bot, CheckCircle2, DollarSign, Eye, FileArchive, FileText, ImageIcon, MessageSquare, RefreshCw, Send, ShieldAlert, Video, Wallet } from "lucide-react";
import { HtmlInCanvasPanel } from "@semse/ui";
import {
  fetchAgentApproval,
  fetchPendingApprovals,
  decideAgentApproval,
  fetchJobEvidence,
  fetchJobMilestones,
  fetchDisputeComments,
  addDisputeComment,
  planUpload,
  registerJobEvidence,
  releaseMilestoneEscrow,
  runProjectCopilot,
  type AgentApprovalItem,
  type DisputeComment
} from "../../semse-api";

function mimeToEvidenceKind(mime: string): "PHOTO" | "VIDEO" | "DOCUMENT" {
  if (mime.startsWith("image/")) return "PHOTO";
  if (mime.startsWith("video/")) return "VIDEO";
  return "DOCUMENT";
}

type DisputeWorkspaceRow = {
  id: string;
  projectId: string;
  reason: string;
  status: "open" | "assigned" | "resolved" | "under_review" | "rejected";
  resolution?: string;
  jobId?: string;
  jobTitle: string;
  projectStatus?: string;
};

type UploadPlanView = Record<string, unknown> & {
  recommendedStrategy?: string;
  maxSingleUploadBytes?: number;
  uploadGuidance?: string;
  multipart?: {
    recommendedChunkSizeBytes?: number;
    recommendedPartCount?: number;
    requiresOutOfBandTransfer?: boolean;
  } | null;
};

type EvidenceView = Record<string, unknown>;
type MilestoneView = Record<string, unknown>;
type TraceEvent = {
  id: string;
  at: string;
  kind: "state" | "copilot" | "escalation" | "approval";
  title: string;
  detail: string;
  tone: string;
};

function asString(value: unknown): string | undefined {
  return typeof value === "string" && value.trim().length > 0 ? value : undefined;
}

function pickString(...values: unknown[]) {
  for (const value of values) {
    const resolved = asString(value);
    if (resolved) return resolved;
  }
  return undefined;
}

function toMetadata(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null;
}

function resolveEvidenceLinks(item: Record<string, unknown>) {
  const metadata = toMetadata(item.metadata);
  const previewUrl = pickString(
    item.previewUrl,
    item.preview_url,
    item.url,
    item.signedUrl,
    item.signed_url,
    item.viewUrl,
    metadata?.previewUrl,
    metadata?.preview_url,
    metadata?.url,
    metadata?.signedUrl,
    metadata?.viewUrl
  );
  const downloadUrl = pickString(
    item.downloadUrl,
    item.download_url,
    item.fileUrl,
    item.file_url,
    item.signedDownloadUrl,
    item.signed_download_url,
    previewUrl,
    metadata?.downloadUrl,
    metadata?.download_url,
    metadata?.fileUrl,
    metadata?.signedDownloadUrl
  );
  const sourceKey = pickString(item.bucketKey, item.key, metadata?.bucketKey, metadata?.key);
  return { previewUrl, downloadUrl, sourceKey };
}

function formatDate(value?: string) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString("es-MX", { day: "2-digit", month: "short", year: "numeric" });
}

function EvidenceKindIcon({ kind }: { kind?: string }) {
  if (kind === "PHOTO") return <ImageIcon size={14} color="var(--ok)" />;
  if (kind === "VIDEO") return <Video size={14} color="var(--brand)" />;
  return <FileText size={14} color="#8b5cf6" />;
}

function inferCopilotDecision(message: string): "self_resolve" | "needs_third_party" | "unclear" {
  const lower = message.toLowerCase();
  if (/(tercero|tercer|humano|ops|escalar|mediaci[oó]n|intervenci[oó]n)/.test(lower)) {
    return "needs_third_party";
  }
  if (/(acuerdo|entre las partes|autogesti[oó]n|resolver entre|ajuste directo|cerrar por acuerdo)/.test(lower)) {
    return "self_resolve";
  }
  return "unclear";
}

export function DisputeResolutionWorkspace({
  dispute,
  audience,
  canResolve,
  relatedHref,
  evidenceHref,
  documentsHref,
  onResolve,
  resolveBusy,
  onApprovalDecide,
}: {
  dispute: DisputeWorkspaceRow;
  audience: "client" | "worker" | "admin";
  canResolve: boolean;
  relatedHref?: string;
  evidenceHref?: string;
  documentsHref?: string;
  onResolve?: (resolution: string) => Promise<void>;
  resolveBusy?: boolean;
  onApprovalDecide?: (approvalId: string, decision: "approved" | "rejected") => Promise<void>;
}) {
  const [resolutionDraft, setResolutionDraft] = useState(dispute.resolution ?? "");
  const [copilotBusy, setCopilotBusy] = useState(false);
  const [copilotMessage, setCopilotMessage] = useState<string | null>(null);
  const [escalationBusy, setEscalationBusy] = useState(false);
  const [escalationMessage, setEscalationMessage] = useState<string | null>(null);
  const [packageFile, setPackageFile] = useState<File | null>(null);
  const [planningUpload, setPlanningUpload] = useState(false);
  const [uploadPlan, setUploadPlan] = useState<UploadPlanView | null>(null);
  const [uploadMessage, setUploadMessage] = useState<string | null>(null);
  const [approvalSummary, setApprovalSummary] = useState<string | null>(null);
  const [loadingApprovals, setLoadingApprovals] = useState(false);
  const [evidenceFeed, setEvidenceFeed] = useState<EvidenceView[]>([]);
  const [milestones, setMilestones] = useState<MilestoneView[]>([]);
  const [loadingEvidence, setLoadingEvidence] = useState(false);
  const [evidenceNote, setEvidenceNote] = useState<string | null>(null);
  const [registeringEvidence, setRegisteringEvidence] = useState(false);
  const [evidenceKey, setEvidenceKey] = useState("");
  const [evidenceKind, setEvidenceKind] = useState<"PHOTO" | "VIDEO" | "DOCUMENT">("DOCUMENT");
  const [evidenceMilestoneId, setEvidenceMilestoneId] = useState("");
  const [traceEvents, setTraceEvents] = useState<TraceEvent[]>([]);
  const [latestApproval, setLatestApproval] = useState<Record<string, unknown> | null>(null);
  const [relatedApprovals, setRelatedApprovals] = useState<AgentApprovalItem[]>([]);
  const [decidingApprovalId, setDecidingApprovalId] = useState<string | null>(null);
  const [approvalActionNote, setApprovalActionNote] = useState<{ id: string; message: string; ok: boolean } | null>(null);
  const [comments, setComments] = useState<DisputeComment[]>([]);
  const [loadingComments, setLoadingComments] = useState(false);
  const [commentDraft, setCommentDraft] = useState("");
  const [sendingComment, setSendingComment] = useState(false);
  const [commentNote, setCommentNote] = useState<string | null>(null);
  const [releasingMilestoneId, setReleasingMilestoneId] = useState<string | null>(null);
  const [releaseNote, setReleaseNote] = useState<{ milestoneId: string; message: string; ok: boolean } | null>(null);

  async function handleReleaseEscrow(milestoneId: string) {
    if (releasingMilestoneId) return;
    setReleasingMilestoneId(milestoneId);
    setReleaseNote(null);
    try {
      await releaseMilestoneEscrow(milestoneId);
      setReleaseNote({ milestoneId, message: "Escrow liberado correctamente.", ok: true });
      appendTrace({
        kind: "state",
        title: "Escrow liberado desde workspace",
        detail: `Milestone ${milestoneId} — fondos liberados al profesional.`,
        tone: "var(--ok)",
      });
      await refreshEvidenceContext();
    } catch (error) {
      setReleaseNote({ milestoneId, message: error instanceof Error ? error.message : "No se pudo liberar el escrow.", ok: false });
    } finally {
      setReleasingMilestoneId(null);
    }
  }

  const playbook = useMemo(() => {
    if (dispute.status === "resolved" || dispute.status === "rejected") {
      return {
        title: "Disputa cerrada",
        detail: "Verifica la resolución acordada y conserva el paquete de evidencia por trazabilidad.",
        tone: "var(--ok)"
      };
    }

    if (audience === "admin") {
      return {
        title: "Mesa de tercero — revisa evidencia antes de decidir",
        detail: "Lee la razón del bloqueo, revisa la evidencia aportada y el criterio del copiloto. Cuando tengas suficiente contexto, aprueba o rechaza la intervención desde el panel de aprobaciones pendientes.",
        tone: "var(--error)"
      };
    }

    if (audience === "client") {
      return {
        title: "Primero intenta cerrar por acuerdo verificable",
        detail: "Compara entregables, evidencia y fondos retenidos. Si sigue el bloqueo, pide criterio del copiloto y escala solo si persiste la fricción.",
        tone: "#6366f1"
      };
    }

    return {
      title: "Aporta pruebas concretas antes de escalar",
      detail: "Documenta avance real, entregables y contexto técnico. Si el bloqueo sigue, deja que el copiloto evalúe si ya requiere tercero humano.",
      tone: "#8b5cf6"
    };
  }, [audience, dispute.status]);

  const copilotDecision = copilotMessage ? inferCopilotDecision(copilotMessage) : null;

  function appendTrace(event: Omit<TraceEvent, "id" | "at">) {
    setTraceEvents((current) => [
      {
        ...event,
        id: `${event.kind}-${Date.now()}-${current.length}`,
        at: new Date().toISOString(),
      },
      ...current,
    ]);
  }

  useEffect(() => {
    setTraceEvents([
      {
        id: `state-${dispute.id}`,
        at: new Date().toISOString(),
        kind: "state",
        title: dispute.status === "resolved" ? "Disputa cerrada" : "Disputa activa",
        detail: dispute.status === "resolved"
          ? `La disputa ya figura resuelta. ${dispute.resolution ? `Resolución: ${dispute.resolution}` : ""}`.trim()
          : `Estado actual: ${dispute.status}. Razón base: ${dispute.reason}`,
        tone: dispute.status === "resolved" ? "var(--ok)" : "#f59e0b",
      }
    ]);
    setLatestApproval(null);
  }, [dispute.id, dispute.reason, dispute.resolution, dispute.status]);

  async function refreshApprovals() {
    setLoadingApprovals(true);
    try {
      const approvals = await fetchPendingApprovals();
      const related = approvals.filter((approval) => {
        const haystack = [
          approval.reason,
          approval.title,
          approval.contextSummary,
          approval.correlationId
        ]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();
        return haystack.includes(dispute.projectId.toLowerCase()) || haystack.includes(dispute.id.toLowerCase());
      });
      if (!related.length) {
        setApprovalSummary(null);
        setRelatedApprovals([]);
        return;
      }
      setRelatedApprovals(related);
      setApprovalSummary(
        `${related.length} aprobación(es) humana(s) pendiente(s) vinculadas a esta disputa. Última: ${related[0]?.title ?? "Sin título"}.`
      );
    } catch {
      setApprovalSummary(null);
    } finally {
      setLoadingApprovals(false);
    }
  }

  useEffect(() => {
    void refreshApprovals();
  }, [dispute.id, dispute.projectId]);

  async function refreshEvidenceContext() {
    if (!dispute.jobId) {
      setEvidenceFeed([]);
      setMilestones([]);
      return;
    }
    setLoadingEvidence(true);
    try {
      const [evidenceResult, milestonesResult] = await Promise.all([
        fetchJobEvidence(dispute.jobId),
        fetchJobMilestones(dispute.jobId).catch(() => [] as Record<string, unknown>[])
      ]);
      const nextEvidence = evidenceResult as EvidenceView[];
      const nextMilestones = milestonesResult as MilestoneView[];
      setEvidenceFeed(nextEvidence);
      setMilestones(nextMilestones);
      if (!evidenceMilestoneId) {
        const firstMilestoneId = nextMilestones.find((item) => asString(item.id))?.id;
        if (typeof firstMilestoneId === "string") setEvidenceMilestoneId(firstMilestoneId);
      }
    } catch {
      setEvidenceFeed([]);
      setMilestones([]);
    } finally {
      setLoadingEvidence(false);
    }
  }

  useEffect(() => {
    void refreshEvidenceContext();
  }, [dispute.jobId]);

  async function handleCopilotReview() {
    setCopilotBusy(true);
    setCopilotMessage(null);
    try {
      const result = await runProjectCopilot({
        kind: "chat",
        projectId: dispute.projectId,
        message: [
          `Analiza la disputa del proyecto ${dispute.projectId}.`,
          `Trabajo: ${dispute.jobTitle}.`,
          `Estado actual: ${dispute.status}.`,
          `Razón reportada: ${dispute.reason}.`,
          `Contexto del actor: ${audience === "client" ? "cliente" : "profesional"}.`,
          `Devuelve una recomendación breve con: veredicto, motivo y siguiente paso.`,
          `Si todavía puede resolverse entre las partes dilo explícitamente. Si ya requiere tercero humano/ops dilo explícitamente.`
        ].join(" ")
      });
      const message = typeof result.message === "string" ? result.message : "Sin recomendación explícita.";
      setCopilotMessage(message);
      const decision = inferCopilotDecision(message);
      appendTrace({
        kind: "copilot",
        title: decision === "needs_third_party"
          ? "Copiloto recomienda tercero"
          : decision === "self_resolve"
            ? "Copiloto recomienda autogestión"
            : "Copiloto deja señal mixta",
        detail: message,
        tone: decision === "needs_third_party" ? "var(--error)" : decision === "self_resolve" ? "var(--ok)" : "#f59e0b",
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "No se pudo obtener criterio del copiloto.";
      setCopilotMessage(message);
      appendTrace({
        kind: "copilot",
        title: "Falló el análisis del copiloto",
        detail: message,
        tone: "var(--error)",
      });
    } finally {
      setCopilotBusy(false);
    }
  }

  async function handleEscalateToThirdParty() {
    setEscalationBusy(true);
    setEscalationMessage(null);
    try {
      const rawResult = await runProjectCopilot({
        kind: "action",
        projectId: dispute.projectId,
        actionType: "PROPOSE_DISPUTE_RESOLVE",
        payload: {
          disputeId: dispute.id,
          source: `${audience}_dispute_workspace`,
          requestedEscalation: true
        }
      }) as Record<string, unknown>;
      const message = typeof rawResult["message"] === "string" ? rawResult["message"] : "Escalación registrada.";
      const approvalId = asString(rawResult["approvalId"]);
      const approvalStatus = asString(rawResult["approvalStatus"]) ?? "pending";
      const approvalMode = asString(rawResult["approvalMode"]) ?? "required";
      setEscalationMessage(message);
      appendTrace({
        kind: "escalation",
        title: "Escalación solicitada",
        detail: `${message}${approvalId ? ` Approval ${approvalId} · modo ${approvalMode} · estado ${approvalStatus}.` : ""}`,
        tone: approvalStatus === "approved" ? "var(--ok)" : approvalStatus === "rejected" ? "var(--error)" : "#f59e0b",
      });
      if (approvalId) {
        try {
          const approval = await fetchAgentApproval(approvalId);
          setLatestApproval(approval);
          appendTrace({
            kind: "approval",
            title: "Approval registrada",
            detail: `${approval.title}. Riesgo ${approval.riskLevel}. Estado ${approval.status}.`,
            tone: approval.status === "approved" ? "var(--ok)" : approval.status === "rejected" ? "var(--error)" : "#6366f1",
          });
        } catch {
          setLatestApproval({ id: approvalId, status: approvalStatus, approvalMode });
        }
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : "No se pudo solicitar intervención.";
      setEscalationMessage(message);
      appendTrace({
        kind: "escalation",
        title: "Falló la escalación",
        detail: message,
        tone: "var(--error)",
      });
    } finally {
      void refreshApprovals();
      setEscalationBusy(false);
    }
  }

  // Real upload, mirroring the pattern already fixed for /worker/evidence and
  // /worker/travel (0.34): plan → PUT the actual file bytes to the presigned
  // key → register it as real job evidence. The previous version declared a
  // filename/size by hand and never sent any bytes at all — for files over
  // the single-PUT limit it even "completed" a fake multipart session with
  // fabricated etags. There is no working large-file upload path server-side
  // yet, so that case fails clearly here instead of pretending to succeed.
  async function handleUploadEvidencePackage() {
    if (!packageFile || !dispute.jobId || planningUpload) return;
    setPlanningUpload(true);
    setUploadMessage(null);
    try {
      const file = packageFile;
      const contentType = file.type || "application/octet-stream";
      const plan = (await planUpload({
        domain: "dispute",
        filename: file.name,
        contentType,
        fileSizeBytes: file.size,
        source: "local_device"
      })) as UploadPlanView;
      setUploadPlan(plan);

      const key = String(plan.key ?? "");
      if (plan.recommendedStrategy === "external_transfer" || !key) {
        throw new Error(`"${file.name}" es demasiado grande para subir aquí todavía (límite temporal ~25MB). Usa un archivo más pequeño o divídelo.`);
      }

      const uploadRes = await fetch(`/api/semse/uploads/files/${encodeURIComponent(key)}`, {
        method: "PUT",
        headers: { "content-type": contentType, "content-length": String(file.size) },
        body: file
      });
      if (!uploadRes.ok) {
        const text = await uploadRes.text().catch(() => "");
        throw new Error(`No se pudo subir "${file.name}" (${uploadRes.status}).${text ? ` ${text}` : ""}`);
      }

      await registerJobEvidence(dispute.jobId, {
        key,
        kind: mimeToEvidenceKind(contentType),
        filename: file.name
      });

      setUploadMessage(`"${file.name}" se subió y quedó registrado como evidencia del trabajo.`);
      setPackageFile(null);
      await refreshEvidenceContext();
    } catch (error) {
      setUploadMessage(error instanceof Error ? error.message : "No se pudo subir el paquete de evidencia.");
    } finally {
      setPlanningUpload(false);
    }
  }

  async function loadComments() {
    setLoadingComments(true);
    try {
      const result = await fetchDisputeComments(dispute.id);
      setComments(result);
    } catch {
      setComments([]);
    } finally {
      setLoadingComments(false);
    }
  }

  useEffect(() => {
    void loadComments();
  }, [dispute.id]);

  async function handleSendComment() {
    const text = commentDraft.trim();
    if (!text || sendingComment) return;
    if (text.length < 2) {
      setCommentNote("Escribe al menos 2 caracteres.");
      return;
    }
    setSendingComment(true);
    setCommentNote(null);
    try {
      const authorLabel = audience === "client" ? "Cliente" : audience === "worker" ? "Profesional" : "Ops";
      await addDisputeComment(dispute.id, { text, author: authorLabel });
      setCommentDraft("");
      appendTrace({
        kind: "state",
        title: `${authorLabel} dejó un comentario`,
        detail: text.length > 80 ? text.slice(0, 80) + "…" : text,
        tone: audience === "admin" ? "var(--error)" : audience === "client" ? "#6366f1" : "#8b5cf6",
      });
      await loadComments();
    } catch (error) {
      setCommentNote(error instanceof Error ? error.message : "No se pudo enviar el comentario.");
    } finally {
      setSendingComment(false);
    }
  }

  async function handleApprovalDecision(approvalId: string, decision: "approved" | "rejected") {
    if (decidingApprovalId) return;
    setDecidingApprovalId(approvalId);
    setApprovalActionNote(null);
    try {
      if (onApprovalDecide) {
        await onApprovalDecide(approvalId, decision);
      } else {
        await decideAgentApproval(approvalId, decision);
      }
      appendTrace({
        kind: "approval",
        title: decision === "approved" ? "Tercero aprobó intervención" : "Tercero rechazó intervención",
        detail: `Aprobación ${approvalId} marcada como ${decision}.`,
        tone: decision === "approved" ? "var(--ok)" : "var(--error)",
      });
      setApprovalActionNote({ id: approvalId, message: decision === "approved" ? "Aprobado y ejecutado." : "Rechazado.", ok: true });
      await refreshApprovals();
    } catch (error) {
      setApprovalActionNote({ id: approvalId, message: error instanceof Error ? error.message : "Error al decidir.", ok: false });
    } finally {
      setDecidingApprovalId(null);
    }
  }

  async function handleRegisterEvidenceReference() {
    if (!dispute.jobId || registeringEvidence) return;
    const key = evidenceKey.trim();
    if (key.length < 4) {
      setEvidenceNote("Escribe una referencia de evidencia válida antes de registrarla.");
      return;
    }
    setRegisteringEvidence(true);
    setEvidenceNote(null);
    try {
      await registerJobEvidence(dispute.jobId, {
        key,
        kind: evidenceKind,
        milestoneId: evidenceMilestoneId || undefined
      });
      setEvidenceKey("");
      setEvidenceNote("Evidencia contextual registrada en el trabajo vinculado.");
      await refreshEvidenceContext();
    } catch (error) {
      setEvidenceNote(error instanceof Error ? error.message : "No se pudo registrar la evidencia.");
    } finally {
      setRegisteringEvidence(false);
    }
  }

  return (
    <div style={{ display: "grid", gap: 12 }}>
      <HtmlInCanvasPanel as="section" style={{ padding: "16px 18px" }} canvasClassName="rounded-2xl" minHeight={120}>
        <div style={{ display: "grid", gap: 8 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <ShieldAlert size={16} color={playbook.tone} />
            <strong style={{ fontSize: 14, color: playbook.tone }}>{playbook.title}</strong>
          </div>
          <p style={{ margin: 0, fontSize: 13, color: "var(--muted)", lineHeight: 1.6 }}>{playbook.detail}</p>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            {relatedHref ? (
              <Link href={relatedHref} style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "8px 11px", borderRadius: 10, border: "1px solid var(--border)", color: "var(--ink)", textDecoration: "none", fontSize: 12, fontWeight: 700 }}>
                Ver trabajo <ArrowUpRight size={13} />
              </Link>
            ) : null}
            {evidenceHref ? (
              <Link href={evidenceHref} style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "8px 11px", borderRadius: 10, border: "1px solid var(--border)", color: "var(--ink)", textDecoration: "none", fontSize: 12, fontWeight: 700 }}>
                Aportar evidencia
              </Link>
            ) : null}
            {documentsHref ? (
              <Link href={documentsHref} style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "8px 11px", borderRadius: 10, border: "1px solid var(--border)", color: "var(--ink)", textDecoration: "none", fontSize: 12, fontWeight: 700 }}>
                Ver documentos
              </Link>
            ) : null}
          </div>
        </div>
      </HtmlInCanvasPanel>

      <HtmlInCanvasPanel as="section" style={{ padding: "16px 18px" }} canvasClassName="rounded-2xl" minHeight={160}>
        <div style={{ display: "grid", gap: 10 }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, flexWrap: "wrap" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <Bot size={16} color="#818cf8" />
              <strong style={{ fontSize: 14, color: "var(--ink)" }}>Criterio del copiloto</strong>
            </div>
            <button
              onClick={() => void handleCopilotReview()}
              disabled={copilotBusy}
              style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "8px 12px", borderRadius: 10, border: "1px solid rgba(99,102,241,0.22)", background: "rgba(99,102,241,0.10)", color: "#818cf8", fontSize: 12, fontWeight: 700, cursor: "pointer" }}
            >
              {copilotBusy ? <RefreshCw size={13} style={{ animation: "spin 1s linear infinite" }} /> : <Bot size={13} />}
              {copilotBusy ? "Analizando..." : "Pedir criterio"}
            </button>
          </div>
          {copilotMessage ? (
            <div style={{ display: "grid", gap: 10 }}>
              <div style={{ padding: "12px 14px", borderRadius: 12, border: "1px solid var(--border)", background: "var(--bg)" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
                  {copilotDecision === "needs_third_party" ? (
                    <StatusPill color="var(--error)" label="Requiere tercero" />
                  ) : copilotDecision === "self_resolve" ? (
                    <StatusPill color="var(--ok)" label="Puede resolverse entre partes" />
                  ) : (
                    <StatusPill color="#f59e0b" label="Señal mixta" />
                  )}
                </div>
                <p style={{ margin: 0, fontSize: 13, color: "var(--ink)", lineHeight: 1.65 }}>{copilotMessage}</p>
              </div>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                {canResolve && onResolve ? (
                  <button
                    onClick={() => void onResolve(resolutionDraft.trim())}
                    disabled={resolveBusy || resolutionDraft.trim().length < 8}
                    style={{ padding: "8px 12px", borderRadius: 10, border: "1px solid rgba(16,185,129,.28)", background: "rgba(16,185,129,.09)", color: "var(--ok)", fontSize: 12, fontWeight: 700, cursor: "pointer", opacity: resolveBusy || resolutionDraft.trim().length < 8 ? 0.7 : 1 }}
                  >
                    {resolveBusy ? "Resolviendo..." : "Cerrar por acuerdo"}
                  </button>
                ) : null}
                <button
                  onClick={() => void handleEscalateToThirdParty()}
                  disabled={escalationBusy}
                  style={{ padding: "8px 12px", borderRadius: 10, border: "1px solid rgba(239,68,68,.26)", background: "rgba(239,68,68,.08)", color: "var(--error)", fontSize: 12, fontWeight: 700, cursor: "pointer" }}
                >
                  {escalationBusy ? "Escalando..." : "Pedir tercero humano"}
                </button>
              </div>
            </div>
          ) : (
            <p style={{ margin: 0, fontSize: 13, color: "var(--muted)" }}>
              Usa el copiloto para decidir si la disputa todavía puede cerrarse entre las partes o si ya amerita intervención de ops/tercero.
            </p>
          )}
          {canResolve && onResolve ? (
            <textarea
              value={resolutionDraft}
              onChange={(event) => setResolutionDraft(event.target.value)}
              rows={3}
              placeholder="Escribe una propuesta de acuerdo o resolución verificable."
              style={{ borderRadius: 10, border: "1px solid var(--border)", background: "var(--surface)", color: "var(--ink)", padding: "10px 12px", fontSize: 13, resize: "vertical" }}
            />
          ) : null}
          {escalationMessage ? (
            <p style={{ margin: 0, fontSize: 12, color: escalationMessage.toLowerCase().includes("error") ? "var(--error)" : "var(--muted)" }}>
              {escalationMessage}
            </p>
          ) : null}
          {loadingApprovals ? (
            <p style={{ margin: 0, fontSize: 12, color: "var(--faint)" }}>Revisando aprobaciones humanas pendientes...</p>
          ) : approvalSummary ? (
            <div style={{ padding: "10px 12px", borderRadius: 12, border: "1px solid rgba(239,68,68,.18)", background: "rgba(239,68,68,.06)", fontSize: 12, color: "var(--ink)" }}>
              {approvalSummary}
            </div>
          ) : null}
        </div>
      </HtmlInCanvasPanel>

      <HtmlInCanvasPanel as="section" style={{ padding: "16px 18px" }} canvasClassName="rounded-2xl" minHeight={170}>
        <div style={{ display: "grid", gap: 12 }}>
          <div>
            <strong style={{ fontSize: 14, color: "var(--ink)" }}>Traza de decisión</strong>
            <p style={{ margin: "4px 0 0", fontSize: 12, color: "var(--muted)" }}>
              Aquí queda visible cómo evolucionó la disputa: criterio del copiloto, escalación y approvals asociadas.
            </p>
          </div>

          {latestApproval ? (
            <div style={{ padding: "12px 14px", borderRadius: 12, border: "1px solid var(--border)", background: "var(--surface)", display: "grid", gap: 4 }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, flexWrap: "wrap" }}>
                <strong style={{ fontSize: 13, color: "var(--ink)" }}>
                  {asString(latestApproval.title) ?? `Approval ${asString(latestApproval.id) ?? "registrada"}`}
                </strong>
                <span style={{ fontSize: 11, fontWeight: 800, color: asString(latestApproval.status) === "approved" ? "var(--ok)" : asString(latestApproval.status) === "rejected" ? "var(--error)" : "#f59e0b" }}>
                  {asString(latestApproval.status) ?? "pending"}
                </span>
              </div>
              {asString(latestApproval.reason) ? (
                <p style={{ margin: 0, fontSize: 12, color: "var(--muted)", lineHeight: 1.55 }}>{asString(latestApproval.reason)}</p>
              ) : null}
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap", fontSize: 11, color: "var(--faint)" }}>
                {asString(latestApproval.id) ? <span>ID {asString(latestApproval.id)}</span> : null}
                {asString(latestApproval.riskLevel) ? <span>Riesgo {asString(latestApproval.riskLevel)}</span> : null}
                {asString(latestApproval.requestedAt) ? <span>Solicitada {formatDate(asString(latestApproval.requestedAt))}</span> : null}
              </div>
            </div>
          ) : null}

          {audience === "admin" && relatedApprovals.length > 0 ? (
            <div style={{ display: "grid", gap: 8 }}>
              <p style={{ margin: 0, fontSize: 12, fontWeight: 800, color: "#f59e0b" }}>APROBACIONES PENDIENTES — ACCIÓN REQUERIDA</p>
              {relatedApprovals.map((approval) => {
                const isBusy = decidingApprovalId === approval.id;
                const note = approvalActionNote?.id === approval.id ? approvalActionNote : null;
                return (
                  <div key={approval.id} style={{ padding: "12px 14px", borderRadius: 12, border: "1px solid rgba(245,158,11,.28)", background: "rgba(245,158,11,.06)", display: "grid", gap: 8 }}>
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, flexWrap: "wrap" }}>
                      <strong style={{ fontSize: 13, color: "var(--ink)" }}>{approval.title}</strong>
                      <span style={{ fontSize: 11, fontWeight: 800, color: "#f59e0b" }}>{approval.riskLevel} risk</span>
                    </div>
                    <p style={{ margin: 0, fontSize: 12, color: "var(--muted)", lineHeight: 1.5 }}>{approval.reason}</p>
                    {note ? (
                      <p style={{ margin: 0, fontSize: 12, color: note.ok ? "var(--ok)" : "var(--error)" }}>{note.message}</p>
                    ) : null}
                    <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                      <button
                        onClick={() => void handleApprovalDecision(approval.id, "approved")}
                        disabled={!!decidingApprovalId}
                        style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "7px 12px", borderRadius: 10, border: "1px solid rgba(16,185,129,.3)", background: "rgba(16,185,129,.10)", color: "var(--ok)", fontSize: 12, fontWeight: 700, cursor: "pointer", opacity: decidingApprovalId ? 0.5 : 1 }}
                      >
                        {isBusy ? <RefreshCw size={12} style={{ animation: "spin 1s linear infinite" }} /> : <CheckCircle2 size={12} />}
                        {isBusy ? "Procesando..." : "Aprobar y ejecutar"}
                      </button>
                      <button
                        onClick={() => void handleApprovalDecision(approval.id, "rejected")}
                        disabled={!!decidingApprovalId}
                        style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "7px 12px", borderRadius: 10, border: "1px solid rgba(239,68,68,.3)", background: "rgba(239,68,68,.08)", color: "var(--error)", fontSize: 12, fontWeight: 700, cursor: "pointer", opacity: decidingApprovalId ? 0.5 : 1 }}
                      >
                        <AlertTriangle size={12} />
                        Rechazar
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : null}

          <div style={{ display: "grid", gap: 8 }}>
            {traceEvents.map((event) => (
              <div key={event.id} style={{ padding: "12px 14px", borderRadius: 12, border: "1px solid var(--border)", background: "var(--surface)", display: "grid", gap: 4 }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, flexWrap: "wrap" }}>
                  <strong style={{ fontSize: 13, color: event.tone }}>{event.title}</strong>
                  <span style={{ fontSize: 11, color: "var(--faint)" }}>{formatDate(event.at)}</span>
                </div>
                <p style={{ margin: 0, fontSize: 12, color: "var(--muted)", lineHeight: 1.6 }}>{event.detail}</p>
              </div>
            ))}
          </div>
        </div>
      </HtmlInCanvasPanel>

      <HtmlInCanvasPanel as="section" style={{ padding: "16px 18px" }} canvasClassName="rounded-2xl" minHeight={170}>
        <div style={{ display: "grid", gap: 10 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <FileArchive size={16} color="#f59e0b" />
            <strong style={{ fontSize: 14, color: "var(--ink)" }}>Paquete de evidencia</strong>
          </div>
          <p style={{ margin: 0, fontSize: 13, color: "var(--muted)", lineHeight: 1.6 }}>
            Sube un archivo real (foto, documento o export) como evidencia de esta disputa — queda registrado en el trabajo vinculado.
          </p>
          <div style={{ display: "grid", gridTemplateColumns: "1fr auto", gap: 10, alignItems: "center" }}>
            <input
              type="file"
              onChange={(event) => setPackageFile(event.target.files?.[0] ?? null)}
              style={{ fontSize: 13, color: "var(--ink)" }}
            />
            <button
              onClick={() => void handleUploadEvidencePackage()}
              disabled={planningUpload || !packageFile || !dispute.jobId}
              style={{ height: 40, padding: "0 12px", borderRadius: 10, border: "1px solid var(--border)", background: "transparent", color: "var(--ink)", fontSize: 12, fontWeight: 700, cursor: "pointer" }}
            >
              {planningUpload ? "Subiendo..." : "Subir evidencia"}
            </button>
          </div>
          {!dispute.jobId ? (
            <p style={{ margin: 0, fontSize: 11, color: "var(--muted)" }}>Esta disputa no tiene un trabajo vinculado — no se puede registrar evidencia aquí.</p>
          ) : null}
          {uploadPlan?.recommendedStrategy === "external_transfer" ? (
            <div style={{ padding: "12px 14px", borderRadius: 12, border: "1px solid rgba(245,158,11,.22)", background: "rgba(245,158,11,.08)", fontSize: 12, color: "#f59e0b" }}>
              Archivos grandes (transferencia externa) todavía no tienen una ruta de subida real — usa un archivo más chico por ahora.
            </div>
          ) : null}
          {uploadMessage ? (
            <p style={{ margin: 0, fontSize: 12, color: uploadMessage.toLowerCase().includes("no se pudo") ? "var(--error)" : "var(--muted)" }}>
              {uploadMessage}
            </p>
          ) : null}
        </div>
      </HtmlInCanvasPanel>

      <HtmlInCanvasPanel as="section" style={{ padding: "16px 18px" }} canvasClassName="rounded-2xl" minHeight={220}>
        <div style={{ display: "grid", gap: 12 }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, flexWrap: "wrap" }}>
            <div>
              <strong style={{ fontSize: 14, color: "var(--ink)" }}>Evidencia contextual</strong>
              <p style={{ margin: "4px 0 0", fontSize: 12, color: "var(--muted)" }}>
                Mira el respaldo existente y registra prueba ligera sin salir del workspace.
              </p>
            </div>
            {evidenceHref ? (
              <Link href={evidenceHref} style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "8px 11px", borderRadius: 10, border: "1px solid var(--border)", color: "var(--ink)", textDecoration: "none", fontSize: 12, fontWeight: 700 }}>
                Flujo completo <ArrowUpRight size={13} />
              </Link>
            ) : null}
          </div>

          {dispute.jobId ? (
            <>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 130px minmax(160px, 220px) auto", gap: 10, alignItems: "start" }}>
                <input
                  value={evidenceKey}
                  onChange={(event) => setEvidenceKey(event.target.value)}
                  placeholder={audience === "client" ? "URL, key o referencia del respaldo del cliente" : "URL, key o referencia del respaldo del profesional"}
                  style={{ height: 40, borderRadius: 10, border: "1px solid var(--border)", background: "var(--surface)", color: "var(--ink)", padding: "0 12px", fontSize: 13 }}
                />
                <select
                  value={evidenceKind}
                  onChange={(event) => setEvidenceKind(event.target.value as "PHOTO" | "VIDEO" | "DOCUMENT")}
                  style={{ height: 40, borderRadius: 10, border: "1px solid var(--border)", background: "var(--surface)", color: "var(--ink)", padding: "0 12px", fontSize: 13 }}
                >
                  <option value="DOCUMENT">Documento</option>
                  <option value="PHOTO">Foto</option>
                  <option value="VIDEO">Video</option>
                </select>
                <select
                  value={evidenceMilestoneId}
                  onChange={(event) => setEvidenceMilestoneId(event.target.value)}
                  style={{ height: 40, borderRadius: 10, border: "1px solid var(--border)", background: "var(--surface)", color: "var(--ink)", padding: "0 12px", fontSize: 13 }}
                >
                  <option value="">Sin milestone específico</option>
                  {milestones.map((item, index) => (
                    <option key={asString(item.id) ?? `milestone-${index}`} value={asString(item.id) ?? ""}>
                      {asString(item.title) ?? `Milestone ${index + 1}`}{asString(item.status) ? ` · ${asString(item.status)}` : ""}
                    </option>
                  ))}
                </select>
                <button
                  onClick={() => void handleRegisterEvidenceReference()}
                  disabled={registeringEvidence}
                  style={{ height: 40, padding: "0 12px", borderRadius: 10, border: "1px solid rgba(16,185,129,.28)", background: "rgba(16,185,129,.08)", color: "var(--ok)", fontSize: 12, fontWeight: 700, cursor: "pointer" }}
                >
                  {registeringEvidence ? "Registrando..." : "Registrar"}
                </button>
              </div>

              {evidenceNote ? (
                <p style={{ margin: 0, fontSize: 12, color: evidenceNote.toLowerCase().includes("no se pudo") || evidenceNote.toLowerCase().includes("válida") ? "var(--error)" : "var(--muted)" }}>
                  {evidenceNote}
                </p>
              ) : null}

              {loadingEvidence ? (
                <div style={{ display: "grid", gap: 8 }}>
                  {[1, 2].map((item) => (
                    <div key={item} style={{ height: 64, borderRadius: 12, background: "var(--raised)", animation: "pulse 1.5s ease-in-out infinite" }} />
                  ))}
                </div>
              ) : evidenceFeed.length > 0 ? (
                <div style={{ display: "grid", gap: 8 }}>
                  {evidenceFeed
                    .slice()
                    .sort((left, right) => new Date(asString(right.createdAt) ?? asString(right.capturedAt) ?? 0).getTime() - new Date(asString(left.createdAt) ?? asString(left.capturedAt) ?? 0).getTime())
                    .slice(0, 4)
                    .map((item, index) => {
                      const links = resolveEvidenceLinks(item);
                      const displayName = pickString(item.filename, item.originalFilename, item.name, links.sourceKey) ?? `Evidencia ${index + 1}`;
                      const validation = pickString(item.validationStatus, item.validation_status) ?? "pending";
                      return (
                        <div key={String(item.id ?? index)} style={{ padding: "12px 14px", borderRadius: 12, border: "1px solid var(--border)", background: "var(--surface)", display: "grid", gap: 6 }}>
                          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
                            <div style={{ display: "flex", alignItems: "center", gap: 8, minWidth: 0 }}>
                              <EvidenceKindIcon kind={asString(item.kind)} />
                              <strong style={{ fontSize: 13, color: "var(--ink)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{displayName}</strong>
                            </div>
                            <span style={{ fontSize: 11, fontWeight: 700, color: validation === "approved" ? "var(--ok)" : validation === "rejected" ? "var(--error)" : "#f59e0b" }}>
                              {validation}
                            </span>
                          </div>
                          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", fontSize: 11, color: "var(--faint)" }}>
                            <span>{formatDate(asString(item.createdAt) ?? asString(item.capturedAt))}</span>
                            {links.sourceKey ? <span>{links.sourceKey}</span> : null}
                          </div>
                          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                            {links.previewUrl ? (
                              <Link href={links.previewUrl} target="_blank" rel="noreferrer" style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "6px 9px", borderRadius: 8, border: "1px solid var(--border)", color: "var(--ink)", textDecoration: "none", fontSize: 11, fontWeight: 700 }}>
                                <Eye size={12} /> Ver
                              </Link>
                            ) : null}
                            {links.downloadUrl ? (
                              <Link href={links.downloadUrl} target="_blank" rel="noreferrer" style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "6px 9px", borderRadius: 8, border: "1px solid var(--border)", color: "var(--ink)", textDecoration: "none", fontSize: 11, fontWeight: 700 }}>
                                <ArrowUpRight size={12} /> Abrir respaldo
                              </Link>
                            ) : documentsHref ? (
                              <Link href={documentsHref} style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "6px 9px", borderRadius: 8, border: "1px solid var(--border)", color: "var(--ink)", textDecoration: "none", fontSize: 11, fontWeight: 700 }}>
                                <ArrowUpRight size={12} /> Ver documentos
                              </Link>
                            ) : null}
                          </div>
                        </div>
                      );
                    })}
                </div>
              ) : (
                <div style={{ padding: "16px 14px", borderRadius: 12, border: "1px dashed var(--border)", background: "var(--bg)", fontSize: 12, color: "var(--muted)" }}>
                  No hay evidencia registrada todavía para este trabajo. Puedes registrar una referencia rápida aquí o abrir el flujo completo.
                </div>
              )}
            </>
          ) : (
            <div style={{ padding: "16px 14px", borderRadius: 12, border: "1px dashed var(--border)", background: "var(--bg)", fontSize: 12, color: "var(--muted)" }}>
              Esta disputa no tiene un trabajo enlazado de forma precisa, así que el panel no puede leer ni registrar evidencia contextual todavía.
            </div>
          )}
        </div>
      </HtmlInCanvasPanel>

      {audience === "admin" && dispute.jobId && milestones.length > 0 ? (
        <HtmlInCanvasPanel as="section" style={{ padding: "16px 18px" }} canvasClassName="rounded-2xl" minHeight={120}>
          <div style={{ display: "grid", gap: 12 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <Wallet size={16} color="var(--ok)" />
              <strong style={{ fontSize: 14, color: "var(--ink)" }}>Liberar escrow — milestones del trabajo</strong>
            </div>
            <p style={{ margin: 0, fontSize: 12, color: "var(--muted)", lineHeight: 1.55 }}>
              Libera los fondos retenidos de cada milestone una vez verificada la resolución. Esta acción es irreversible.
            </p>
            <div style={{ display: "grid", gap: 8 }}>
              {milestones.map((m, idx) => {
                const mid = asString(m.id) ?? `milestone-${idx}`;
                const title = asString(m.title) ?? `Milestone ${idx + 1}`;
                const status = asString(m.status) ?? "unknown";
                const escrowStatus = asString(m.escrowStatus) ?? asString((m.escrow as Record<string, unknown> | undefined)?.status) ?? "unknown";
                const amount = typeof m.amount === "number" ? m.amount : typeof m.escrowAmount === "number" ? m.escrowAmount : null;
                const isBusy = releasingMilestoneId === mid;
                const note = releaseNote?.milestoneId === mid ? releaseNote : null;
                const alreadyReleased = escrowStatus === "released" || status === "completed";
                return (
                  <div key={mid} style={{ display: "flex", alignItems: "center", gap: 12, padding: "12px 14px", borderRadius: 12, border: `1px solid ${alreadyReleased ? "rgba(16,185,129,.22)" : "var(--border)"}`, background: alreadyReleased ? "rgba(16,185,129,.04)" : "var(--surface)" }}>
                    <DollarSign size={16} color={alreadyReleased ? "var(--ok)" : "#fbbf24"} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <p style={{ margin: 0, fontSize: 13, fontWeight: 700, color: "var(--ink)" }}>{title}</p>
                      <p style={{ margin: "2px 0 0", fontSize: 11, color: "var(--faint)", display: "flex", gap: 8, flexWrap: "wrap" }}>
                        <span>Estado: {status}</span>
                        {escrowStatus !== "unknown" ? <span>Escrow: {escrowStatus}</span> : null}
                        {amount !== null ? <span>${amount.toLocaleString()}</span> : null}
                      </p>
                      {note ? <p style={{ margin: "4px 0 0", fontSize: 11, color: note.ok ? "var(--ok)" : "var(--error)" }}>{note.message}</p> : null}
                    </div>
                    {!alreadyReleased ? (
                      <button
                        onClick={() => void handleReleaseEscrow(mid)}
                        disabled={!!releasingMilestoneId}
                        style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "8px 12px", borderRadius: 10, border: "1px solid rgba(16,185,129,.3)", background: "rgba(16,185,129,.1)", color: "var(--ok)", fontSize: 12, fontWeight: 700, cursor: "pointer", opacity: releasingMilestoneId ? 0.5 : 1, whiteSpace: "nowrap" }}
                      >
                        {isBusy ? <RefreshCw size={12} style={{ animation: "spin 1s linear infinite" }} /> : <Wallet size={12} />}
                        {isBusy ? "Liberando..." : "Liberar escrow"}
                      </button>
                    ) : (
                      <span style={{ fontSize: 11, fontWeight: 800, color: "var(--ok)" }}>✓ Liberado</span>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </HtmlInCanvasPanel>
      ) : null}

      <HtmlInCanvasPanel as="section" style={{ padding: "16px 18px" }} canvasClassName="rounded-2xl" minHeight={180}>
        <div style={{ display: "grid", gap: 12 }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, flexWrap: "wrap" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <MessageSquare size={16} color="#6366f1" />
              <strong style={{ fontSize: 14, color: "var(--ink)" }}>Argumentos y acuerdos</strong>
            </div>
            <button
              onClick={() => void loadComments()}
              disabled={loadingComments}
              style={{ display: "inline-flex", alignItems: "center", gap: 5, padding: "6px 10px", borderRadius: 9, border: "1px solid var(--border)", background: "transparent", color: "var(--muted)", fontSize: 11, fontWeight: 700, cursor: "pointer" }}
            >
              <RefreshCw size={11} style={{ animation: loadingComments ? "spin 1s linear infinite" : "none" }} />
              Recargar
            </button>
          </div>
          <p style={{ margin: 0, fontSize: 12, color: "var(--muted)", lineHeight: 1.55 }}>
            {audience === "admin"
              ? "Lee los argumentos de ambas partes antes de decidir. Puedes dejar un comentario con la posición de ops."
              : "Deja tu argumento, contraargumento o propuesta de acuerdo. Queda visible para ambas partes y para ops."}
          </p>

          <div style={{ display: "flex", gap: 8, alignItems: "flex-start" }}>
            <textarea
              value={commentDraft}
              onChange={(event) => setCommentDraft(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter" && (event.metaKey || event.ctrlKey)) {
                  void handleSendComment();
                }
              }}
              rows={2}
              placeholder={
                audience === "admin"
                  ? "Posición de ops o instrucción para las partes..."
                  : "Tu argumento, evidencia resumida o propuesta de acuerdo..."
              }
              style={{ flex: 1, borderRadius: 10, border: "1px solid var(--border)", background: "var(--surface)", color: "var(--ink)", padding: "10px 12px", fontSize: 13, resize: "vertical" }}
            />
            <button
              onClick={() => void handleSendComment()}
              disabled={sendingComment || commentDraft.trim().length < 2}
              style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "10px 12px", borderRadius: 10, border: "1px solid rgba(99,102,241,.28)", background: "rgba(99,102,241,.10)", color: "#6366f1", fontSize: 12, fontWeight: 700, cursor: "pointer", opacity: sendingComment || commentDraft.trim().length < 2 ? 0.6 : 1, alignSelf: "flex-start", marginTop: 2 }}
            >
              {sendingComment ? <RefreshCw size={13} style={{ animation: "spin 1s linear infinite" }} /> : <Send size={13} />}
              {sendingComment ? "Enviando..." : "Enviar"}
            </button>
          </div>

          {commentNote ? (
            <p style={{ margin: 0, fontSize: 12, color: commentNote.toLowerCase().includes("no se pudo") ? "var(--error)" : "var(--muted)" }}>
              {commentNote}
            </p>
          ) : null}

          {loadingComments ? (
            <div style={{ display: "grid", gap: 8 }}>
              {[1, 2].map((item) => (
                <div key={item} style={{ height: 56, borderRadius: 12, background: "var(--raised)", animation: "pulse 1.5s ease-in-out infinite" }} />
              ))}
            </div>
          ) : comments.length > 0 ? (
            <div style={{ display: "grid", gap: 8 }}>
              {comments.map((comment, index) => {
                const roleColor = comment.role === "admin" ? "var(--error)" : comment.role === "client" ? "#6366f1" : comment.role === "worker" ? "#8b5cf6" : "var(--muted)";
                const roleLabel = comment.role === "admin" ? "Ops" : comment.role === "client" ? "Cliente" : comment.role === "worker" ? "Profesional" : comment.author ?? "Sistema";
                return (
                  <div key={comment.id ?? index} style={{ padding: "12px 14px", borderRadius: 12, border: "1px solid var(--border)", background: "var(--surface)", display: "grid", gap: 6 }}>
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, flexWrap: "wrap" }}>
                      <span style={{ fontSize: 12, fontWeight: 800, color: roleColor }}>{roleLabel}</span>
                      <span style={{ fontSize: 11, color: "var(--faint)" }}>{formatDate(comment.createdAt)}</span>
                    </div>
                    <p style={{ margin: 0, fontSize: 13, color: "var(--ink)", lineHeight: 1.6 }}>{comment.text}</p>
                  </div>
                );
              })}
            </div>
          ) : (
            <div style={{ padding: "14px", borderRadius: 12, border: "1px dashed var(--border)", background: "var(--bg)", fontSize: 12, color: "var(--muted)" }}>
              No hay argumentos registrados todavía. Sé el primero en dejar contexto verificable.
            </div>
          )}
        </div>
      </HtmlInCanvasPanel>
    </div>
  );
}

function StatusPill({ color, label }: { color: string; label: string }) {
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 6,
        padding: "4px 9px",
        borderRadius: 999,
        border: `1px solid ${color}35`,
        background: `${color}14`,
        color,
        fontSize: 11,
        fontWeight: 800
      }}
    >
      {color === "var(--ok)" ? <CheckCircle2 size={12} /> : color === "var(--error)" ? <AlertTriangle size={12} /> : <ShieldAlert size={12} />}
      {label}
    </span>
  );
}
