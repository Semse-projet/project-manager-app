"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { JobRecordView } from "@semse/schemas";
import { useParams } from "next/navigation";
import Link from "next/link";
import {
  AlertCircle,
  ArrowUpRight,
  Clock3,
  Download,
  Eye,
  FileText,
  ImageIcon,
  MapPin,
  ShieldCheck,
  Video
} from "lucide-react";
import {
  acceptBid,
  fetchJob,
  fetchJobAgentSignals,
  fetchJobBids,
  fetchJobEscrow,
  fetchJobEvidence,
  fetchJobMilestones,
  fetchJobPayments,
  fundJobEscrow,
  mutateMilestone,
  releaseMilestoneEscrow,
  type BidView,
  sendNotification,
  type JobAgentSignal
} from "../../../../semse-api";
import { JobDisputeHistory } from "../../../../components/disputes/JobDisputeHistory";
import { ClientDetailDrawer } from "../../../../components/client/ClientDetailDrawer";
import { ClientPageHeader } from "../../../../components/client/ClientPageHeader";
import { NotificationBanner } from "../../../../components/notifications/NotificationBanner";
import { CLIENT_ROUTES, clientDisputesHref } from "../../../../lib/client-routes";

type JobDetail = JobRecordView & Record<string, unknown>;
type JobMilestone = Record<string, unknown>;
type JobEvidence = Record<string, unknown>;
type JobPayment = Record<string, unknown>;
type InsightPanelId = "escrow" | "milestones" | "evidence" | "signals";
type PreferredProfessional = NonNullable<JobRecordView["preferredProfessional"]>;

const JOB_STATUS_META: Record<string, { label: string; color: string; bg: string }> = {
  draft: { label: "Borrador", color: "#64748b", bg: "rgba(100,116,139,.12)" },
  posted: { label: "Publicado", color: "#3b82f6", bg: "rgba(59,130,246,.12)" },
  published: { label: "Publicado", color: "#3b82f6", bg: "rgba(59,130,246,.12)" },
  reserved: { label: "Reservado", color: "#f59e0b", bg: "rgba(245,158,11,.12)" },
  accepted: { label: "Aceptado", color: "#8b5cf6", bg: "rgba(139,92,246,.12)" },
  in_progress: { label: "En progreso", color: "#06b6d4", bg: "rgba(6,182,212,.12)" },
  review: { label: "En revisión", color: "#f59e0b", bg: "rgba(245,158,11,.12)" },
  dispute: { label: "En disputa", color: "#ef4444", bg: "rgba(239,68,68,.12)" },
  completed: { label: "Completado", color: "#10b981", bg: "rgba(16,185,129,.12)" },
  awarded: { label: "Adjudicado", color: "#6366f1", bg: "rgba(99,102,241,.12)" },
  cancelled: { label: "Cancelado", color: "#64748b", bg: "rgba(100,116,139,.12)" }
};

const MILESTONE_STATUS_META: Record<string, { label: string; color: string; bg: string }> = {
  DRAFT: { label: "Borrador", color: "#64748b", bg: "rgba(100,116,139,.12)" },
  AWAITING_REVIEW: { label: "En revisión", color: "#f59e0b", bg: "rgba(245,158,11,.12)" },
  SUBMITTED: { label: "Enviado", color: "#06b6d4", bg: "rgba(6,182,212,.12)" },
  APPROVED: { label: "Aprobado", color: "#10b981", bg: "rgba(16,185,129,.12)" },
  REJECTED: { label: "Rechazado", color: "#ef4444", bg: "rgba(239,68,68,.12)" },
  PAID: { label: "Pagado", color: "#22c55e", bg: "rgba(34,197,94,.12)" }
};

const PAYMENT_TYPE_META: Record<string, { label: string; color: string; bg: string }> = {
  DEPOSIT: { label: "Depósito", color: "var(--brand)", bg: "rgba(59,130,246,.12)" },
  RELEASE: { label: "Liberación", color: "#10b981", bg: "rgba(16,185,129,.12)" },
  HOLDBACK: { label: "Retención", color: "#f59e0b", bg: "rgba(245,158,11,.12)" },
  FEE: { label: "Fee", color: "#8b5cf6", bg: "rgba(139,92,246,.12)" },
  REFUND: { label: "Reembolso", color: "#ef4444", bg: "rgba(239,68,68,.12)" }
};

const BID_STATUS_META: Record<BidView["status"], { label: string; color: string; bg: string }> = {
  submitted: { label: "Enviada", color: "#3b82f6", bg: "rgba(59,130,246,.12)" },
  accepted: { label: "Aceptada", color: "#10b981", bg: "rgba(16,185,129,.12)" },
  rejected: { label: "Rechazada", color: "#ef4444", bg: "rgba(239,68,68,.12)" },
  withdrawn: { label: "Retirada", color: "#64748b", bg: "rgba(100,116,139,.12)" },
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

function asNumber(value: unknown): number | undefined {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim().length > 0) {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return undefined;
}

function readPreferredProfessional(value: unknown): PreferredProfessional | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }

  const candidate = value as Record<string, unknown>;
  const userId = asString(candidate.userId);
  const displayName = asString(candidate.displayName);
  if (!userId || !displayName) {
    return null;
  }

  return {
    userId,
    displayName,
    publicSlug: asString(candidate.publicSlug),
  };
}

function formatMoney(value?: number): string {
  if (value === undefined) return "—";
  return value.toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0
  });
}

function formatDate(value?: string): string {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString("es-MX", { day: "2-digit", month: "short", year: "numeric" });
}

function formatBidBudget(bid: BidView): string {
  return formatMoney(bid.amount);
}

function EvidenceIcon({ kind }: { kind: string }) {
  if (kind === "PHOTO") return <ImageIcon size={15} color="var(--brand)" />;
  if (kind === "VIDEO") return <Video size={15} color="var(--accent)" />;
  return <FileText size={15} color="var(--muted)" />;
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
    item.view_url,
    metadata?.previewUrl,
    metadata?.preview_url,
    metadata?.url,
    metadata?.signedUrl,
    metadata?.signed_url,
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
  return {
    previewUrl,
    downloadUrl,
    sourceKey: pickString(item.bucketKey, item.key, metadata?.bucketKey, metadata?.key),
  };
}

function presentValidationStatus(value?: string) {
  const normalized = (value ?? "").toLowerCase();
  if (normalized === "passed") return "approved";
  if (normalized === "failed") return "rejected";
  if (normalized === "manual_review") return "under_review";
  return normalized || "pending";
}

export default function ClientJobDetailPage() {
  const params = useParams<{ jobId: string }>();
  const jobId = typeof params?.jobId === "string" ? params.jobId : "";

  const [job, setJob] = useState<JobDetail | null>(null);
  const [bids, setBids] = useState<BidView[]>([]);
  const [acceptingBidId, setAcceptingBidId] = useState<string | null>(null);
  const [milestones, setMilestones] = useState<JobMilestone[]>([]);
  const [escrow, setEscrow] = useState<Record<string, unknown> | null>(null);
  const [payments, setPayments] = useState<JobPayment[]>([]);
  const [evidence, setEvidence] = useState<JobEvidence[]>([]);
  const [agentSignals, setAgentSignals] = useState<JobAgentSignal[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [pendingAction, setPendingAction] = useState<string | null>(null);
  const [changeReasons, setChangeReasons] = useState<Record<string, string>>({});
  const [showChangeForm, setShowChangeForm] = useState<Record<string, boolean>>({});
  const [activeInsight, setActiveInsight] = useState<InsightPanelId | null>(null);

  const loadDetail = useCallback(async () => {
    if (!jobId) return;
    setLoading(true);
    setError(null);
    try {
      const [jobResult, milestonesResult, escrowResult, evidenceResult, paymentsResult, signalsResult, bidsResult] = await Promise.all([
        fetchJob(jobId),
        fetchJobMilestones(jobId).catch(() => []),
        fetchJobEscrow(jobId).catch(() => null),
        fetchJobEvidence(jobId).catch(() => []),
        fetchJobPayments(jobId).catch(() => []),
        fetchJobAgentSignals(jobId).catch(() => []),
        fetchJobBids(jobId).catch(() => []),
      ]);
      setJob(jobResult as unknown as JobDetail);
      setBids(bidsResult);
      setMilestones(milestonesResult);
      setEscrow(escrowResult);
      setEvidence(evidenceResult);
      setPayments(paymentsResult);
      setAgentSignals(signalsResult);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "No se pudo cargar el detalle del trabajo.");
    } finally {
      setLoading(false);
    }
  }, [jobId]);

  useEffect(() => {
    void loadDetail();
  }, [loadDetail]);

  const milestoneSummary = useMemo(() => {
    const approved = milestones.filter((item) => asString(item.status) === "APPROVED").length;
    const total = milestones.length;
    return { approved, total };
  }, [milestones]);

  const escrowStatus = String(escrow?.status ?? "").toUpperCase();
  const fundedAmount = asNumber(escrow?.totalAmount);
  const holdbackPct = asNumber(escrow?.holdbackPct);
  const releasedAmount = payments
    .filter((payment) => asString(payment.type) === "RELEASE")
    .reduce((sum, payment) => sum + (asNumber(payment.amount) ?? 0), 0);
  const holdbackAmount = fundedAmount !== undefined && holdbackPct !== undefined
    ? fundedAmount * (holdbackPct / 100)
    : undefined;
  const acceptedBid = bids.find((bid) => bid.status === "accepted");
  const submittedBidCount = bids.filter((bid) => bid.status === "submitted").length;
  const approvedSignals = agentSignals.filter((signal) => signal.status === "completed");
  const latestEvidence = evidence
    .slice()
    .sort((left, right) =>
      new Date(asString(right.createdAt) ?? asString(right.capturedAt) ?? 0).getTime() -
      new Date(asString(left.createdAt) ?? asString(left.capturedAt) ?? 0).getTime()
    )[0];
  const nextReviewMilestone = milestones.find((milestone) => {
    const status = asString(milestone.status) ?? "";
    return status === "SUBMITTED" || status === "AWAITING_REVIEW" || status === "APPROVED";
  });
  const preferredProfessional = readPreferredProfessional(job?.preferredProfessional);

  async function handleFundEscrow() {
    if (!jobId || pendingAction) return;
    const amount = asNumber(job?.budgetMax) ?? asNumber(job?.budgetMin);
    if (!amount) return;
    setPendingAction("fund-escrow");
    try {
      await fundJobEscrow(jobId, { amount });
      await loadDetail();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "No se pudo fondear el escrow.");
    } finally {
      setPendingAction(null);
    }
  }

  async function handleMilestoneAction(
    milestoneId: string,
    action: "approve" | "request-changes"
  ) {
    if (pendingAction) return;
    if (action === "request-changes") {
      const reason = changeReasons[milestoneId]?.trim();
      if (!reason) {
        setError("Escribe una razón para pedir cambios.");
        return;
      }
    }

    setPendingAction(`${action}:${milestoneId}`);
    setError(null);
    try {
      await mutateMilestone(
        milestoneId,
        action,
        action === "request-changes" ? { reason: changeReasons[milestoneId] } : undefined
      );
      setShowChangeForm((current) => ({ ...current, [milestoneId]: false }));
      await loadDetail();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "No se pudo actualizar el milestone.");
    } finally {
      setPendingAction(null);
    }
  }

  async function handleRelease(milestoneId: string) {
    if (pendingAction) return;
    setPendingAction(`release:${milestoneId}`);
    setError(null);
    try {
      await releaseMilestoneEscrow(milestoneId);
      const ms = milestones.find(m => asString(m.id) === milestoneId);
      const msTitle = ms ? (asString(ms.title) ?? "Milestone") : "Milestone";
      const jobTitle = asString(job?.title) ?? "trabajo";
      sendNotification({
        title: "Pago liberado",
        body: `El cliente aprobó "${msTitle}" — ${jobTitle}. Los fondos están en camino.`,
        kind: "payment",
        targetRole: "worker",
        linkHref: "/worker/payments",
      }).catch(() => {});
      await loadDetail();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "No se pudo liberar el pago.");
    } finally {
      setPendingAction(null);
    }
  }

  async function handleAcceptBid(bid: BidView) {
    if (pendingAction || acceptingBidId || bid.status !== "submitted") return;
    setAcceptingBidId(bid.id);
    setError(null);
    try {
      await acceptBid(bid.id);
      const proName = bid.proEmail ?? bid.professionalUserId ?? "Profesional";
      const jobTitle = asString(job?.title) ?? "trabajo";
      sendNotification({
        title: "Propuesta aceptada",
        body: `El cliente aceptó la propuesta de ${proName} para "${jobTitle}".`,
        kind: "job",
        targetRole: "worker",
        linkHref: `/worker/jobs/${jobId}`,
      }).catch(() => {});
      await loadDetail();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "No se pudo aceptar la propuesta.");
    } finally {
      setAcceptingBidId(null);
    }
  }

  const normalizedJobStatus = String(job?.status ?? "").toLowerCase();
  const jobStatusMeta = JOB_STATUS_META[normalizedJobStatus] ?? JOB_STATUS_META.posted;

  const JOB_NEXT_ACTION: Record<string, { label: string; detail: string; tone: string }> = {
    posted:      { label: "Esperando candidatos", detail: "El trabajo está publicado. Revisa propuestas cuando lleguen.", tone: "#60a5fa" },
    reserved:    { label: "Acepta o rechaza la reserva", detail: "Un profesional reservó el trabajo. Acepta para avanzar o libera la reserva.", tone: "#fbbf24" },
    accepted:    { label: "Fondea el escrow", detail: "El trabajo fue aceptado. Fondea el escrow para que el profesional pueda comenzar.", tone: "#f59e0b" },
    in_progress: { label: "Revisa el avance", detail: "El profesional está trabajando. Revisa milestones y evidencia.", tone: "#06b6d4" },
    review:      { label: "Aprueba o pide cambios", detail: "El profesional envió para revisión. Aprueba el milestone o solicita cambios.", tone: "#8b5cf6" },
    dispute:     { label: "Disputa activa", detail: "Hay una disputa abierta. El equipo de ops está revisando. Puedes aportar evidencia.", tone: "#ef4444" },
    completed:   { label: "Trabajo completado", detail: "El trabajo se cerró correctamente. Puedes dejar una calificación.", tone: "#10b981" },
    cancelled:   { label: "Trabajo cancelado", detail: "Este trabajo fue cancelado.", tone: "#64748b" }
  };
  const nextActionGuide = job ? (JOB_NEXT_ACTION[normalizedJobStatus] ?? null) : null;

  function scrollToSection(sectionId: string) {
    document.getElementById(sectionId)?.scrollIntoView({ behavior: "smooth", block: "start" });
    setActiveInsight(null);
  }

  const summaryButtonStyle = (accent: string): React.CSSProperties => ({
    textDecoration: "none",
    padding: "12px 14px",
    borderRadius: "12px",
    background: "var(--bg)",
    border: "1px solid var(--border)",
    transition: "border-color .15s, box-shadow .15s",
    cursor: "pointer",
    display: "block",
    textAlign: "left",
  });

  const drawerCard: React.CSSProperties = {
    borderRadius: "14px",
    border: "1px solid var(--border)",
    background: "var(--bg)",
    padding: "14px 16px",
  };

  const drawerMetricStyle: React.CSSProperties = {
    padding: "12px 13px",
    borderRadius: "12px",
    border: "1px solid var(--border)",
    background: "var(--surface)",
  };

  return (
    <div style={{ maxWidth: "1024px", margin: "0 auto", display: "grid", gap: "18px" }}>
      <ClientPageHeader
        title={asString(job?.title) ?? "Detalle del trabajo"}
        subtitle={asString(job?.scope) ?? asString(job?.description) ?? "Sin descripción disponible."}
        breadcrumbs={[{ label: "Trabajos", href: CLIENT_ROUTES.jobs }, { label: asString(job?.title) ?? "Detalle" }]}
        actions={
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <NotificationBanner audience="client" />
            <span
              style={{
                display: "inline-flex",
                alignItems: "center",
                padding: "4px 10px",
                borderRadius: "999px",
                background: jobStatusMeta.bg,
                color: jobStatusMeta.color,
                fontSize: "11px",
                fontWeight: 700,
                border: `1px solid ${jobStatusMeta.color}30`
              }}
            >
              {jobStatusMeta.label}
            </span>
          </div>
        }
      />

      {loading ? (
        <div style={{ display: "grid", gap: "12px" }}>
          {[1, 2, 3].map((item) => (
            <div
              key={item}
              style={{
                height: "120px",
                borderRadius: "16px",
                border: "1px solid var(--border)",
                background: "var(--surface)",
                animation: "pulse 1.5s ease-in-out infinite"
              }}
            />
          ))}
        </div>
      ) : error ? (
        <div style={{ padding: "18px 20px", background: "rgba(239,68,68,.08)", border: "1px solid rgba(239,68,68,.18)", borderRadius: "14px", color: "#ef4444", fontSize: "13px" }}>
          {error}
        </div>
      ) : (
        <>
          {nextActionGuide ? (
            <div style={{ borderRadius: "14px", border: `1px solid ${nextActionGuide.tone}44`, background: `${nextActionGuide.tone}11`, padding: "14px 18px", display: "flex", gap: "10px", alignItems: "flex-start" }}>
              <span style={{ fontSize: "16px", lineHeight: 1 }}>▶</span>
              <div style={{ flex: 1 }}>
                <strong style={{ fontSize: "14px", color: nextActionGuide.tone, display: "block", marginBottom: "2px" }}>{nextActionGuide.label}</strong>
                <span style={{ fontSize: "12px", color: "var(--muted)" }}>{nextActionGuide.detail}</span>
                {normalizedJobStatus === "dispute" ? (
                  <div style={{ marginTop: 10 }}>
                    <Link
                      href={clientDisputesHref({ status: "open" })}
                      style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "8px 11px", borderRadius: 10, border: "1px solid rgba(239,68,68,.26)", background: "rgba(239,68,68,.08)", color: "#ef4444", fontSize: 12, fontWeight: 700, textDecoration: "none" }}
                    >
                      Abrir panel de disputas
                    </Link>
                  </div>
                ) : null}
                {normalizedJobStatus === "completed" && jobId ? (
                  <div style={{ marginTop: 10 }}>
                    <Link
                      href={`/client/jobs/${jobId}/rate`}
                      style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "8px 14px", borderRadius: 10, border: "1px solid rgba(16,185,129,.35)", background: "rgba(16,185,129,.1)", color: "#10b981", fontSize: 12, fontWeight: 700, textDecoration: "none" }}
                    >
                      ⭐ Calificar al profesional
                    </Link>
                  </div>
                ) : null}
              </div>
            </div>
          ) : null}

          {preferredProfessional ? (
            <section style={{ background: "var(--surface)", border: "1px solid rgba(129,140,248,.24)", borderRadius: "16px", padding: "18px 20px" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
                <div>
                  <div style={{ fontSize: "11px", color: "#a5b4fc", fontWeight: 800, marginBottom: 6 }}>PROFESIONAL OBJETIVO</div>
                  <div style={{ fontSize: "18px", fontWeight: 800, color: "var(--ink)" }}>{preferredProfessional.displayName}</div>
                  <div style={{ fontSize: "12px", color: "var(--muted)", marginTop: 4 }}>
                    Este trabajo conserva una preferencia explícita. El matching ya usa esta señal, pero no fuerza resultados sin mérito real.
                  </div>
                </div>
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                  <Link
                    href={`/client/professionals?jobId=${encodeURIComponent(jobId)}`}
                    style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "9px 12px", borderRadius: 10, background: "rgba(129,140,248,.12)", border: "1px solid rgba(129,140,248,.24)", color: "#a5b4fc", textDecoration: "none", fontSize: 12, fontWeight: 700 }}
                  >
                    Abrir matching <ArrowUpRight size={13} />
                  </Link>
                  {preferredProfessional.publicSlug ? (
                    <Link
                      href={`/pro/${preferredProfessional.publicSlug}`}
                      style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "9px 12px", borderRadius: 10, background: "var(--bg)", border: "1px solid var(--border)", color: "var(--ink)", textDecoration: "none", fontSize: 12, fontWeight: 700 }}
                    >
                      Ver perfil publico <Eye size={13} />
                    </Link>
                  ) : null}
                </div>
              </div>
            </section>
          ) : null}

          {bids.length > 0 || normalizedJobStatus === "posted" || normalizedJobStatus === "published" ? (
            <section style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: "16px", padding: "20px 22px" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "12px", flexWrap: "wrap", marginBottom: "14px" }}>
                <div>
                  <h2 style={{ margin: 0, fontSize: "16px", fontWeight: 800, color: "var(--ink)" }}>Propuestas</h2>
                  <p style={{ margin: "4px 0 0", fontSize: "12px", color: "var(--muted)" }}>
                    {bids.length > 0
                      ? `${submittedBidCount} por revisar · ${acceptedBid ? "1 aceptada" : "sin adjudicar"}`
                      : "Aún no hay propuestas para este trabajo."}
                  </p>
                </div>
                <Link
                  href={`/client/professionals?jobId=${encodeURIComponent(jobId)}`}
                  style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "9px 12px", borderRadius: 10, background: "var(--bg)", border: "1px solid var(--border)", color: "var(--ink)", textDecoration: "none", fontSize: 12, fontWeight: 700 }}
                >
                  Buscar profesionales <ArrowUpRight size={13} />
                </Link>
              </div>

              {bids.length === 0 ? (
                <div style={{ padding: "14px 16px", borderRadius: "12px", border: "1px dashed var(--border)", color: "var(--muted)", fontSize: "12px" }}>
                  Cuando un profesional envíe una propuesta, podrás revisar presupuesto, disponibilidad y aceptarla desde aquí.
                </div>
              ) : (
                <div style={{ display: "grid", gap: "10px" }}>
                  {bids.map((bid) => {
                    const meta = BID_STATUS_META[bid.status] ?? BID_STATUS_META.submitted;
                    const isAccepted = bid.status === "accepted";
                    const isActionable = bid.status === "submitted" && !acceptedBid;
                    const isBusy = acceptingBidId === bid.id;
                    return (
                      <div key={bid.id} style={{ padding: "14px 16px", borderRadius: "14px", background: "var(--bg)", border: `1px solid ${isAccepted ? "rgba(16,185,129,.28)" : "var(--border)"}` }}>
                        <div style={{ display: "grid", gridTemplateColumns: "1fr auto", gap: "12px", alignItems: "start" }}>
                          <div>
                            <div style={{ display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap", marginBottom: "4px" }}>
                              <strong style={{ fontSize: "14px", color: "var(--ink)" }}>{bid.proEmail ?? bid.professionalUserId ?? "Profesional"}</strong>
                              <span style={{ display: "inline-flex", padding: "4px 9px", borderRadius: "999px", background: meta.bg, color: meta.color, fontSize: "11px", fontWeight: 700 }}>
                                {meta.label}
                              </span>
                            </div>
                            <div style={{ fontSize: "11px", color: "var(--muted)" }}>
                              {bid.proEmail ?? bid.proUserId} · enviada {formatDate(bid.createdAt)}
                            </div>
                          </div>
                          <div style={{ textAlign: "right" }}>
                            <div style={{ fontSize: "14px", fontWeight: 800, color: "var(--ink)" }}>{formatBidBudget(bid)}</div>
                            <div style={{ fontSize: "11px", color: "var(--muted)", marginTop: 2 }}>
                              Entrega estimada: {bid.etaDays} día{bid.etaDays !== 1 ? 's' : ''}
                            </div>
                          </div>
                        </div>

                        {bid.note ? (
                          <p style={{ margin: "10px 0 0", fontSize: "12px", color: "var(--muted)", lineHeight: 1.5 }}>
                            {bid.note}
                          </p>
                        ) : null}

                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: "10px", flexWrap: "wrap", marginTop: "12px" }}>
                          <span style={{ fontSize: "11px", color: isAccepted ? "#10b981" : "var(--faint)" }}>
                            {isAccepted ? "Este profesional quedó adjudicado al trabajo." : acceptedBid ? "Ya hay una propuesta aceptada." : "Lista para decisión del cliente."}
                          </span>
                          {isActionable ? (
                            <button
                              onClick={() => void handleAcceptBid(bid)}
                              disabled={isBusy}
                              style={{ padding: "8px 12px", borderRadius: "8px", border: "none", background: "#10b981", color: "#fff", fontSize: "12px", fontWeight: 700, cursor: isBusy ? "wait" : "pointer", opacity: isBusy ? 0.75 : 1 }}
                            >
                              {isBusy ? "Aceptando..." : "Aceptar propuesta"}
                            </button>
                          ) : null}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </section>
          ) : null}

          <section style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: "16px", padding: "20px 22px" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "10px", marginBottom: "14px", flexWrap: "wrap" }}>
              <div>
                <h2 style={{ margin: 0, fontSize: "16px", fontWeight: 800, color: "var(--ink)" }}>Resumen del proyecto</h2>
                <p style={{ margin: "4px 0 0", fontSize: "12px", color: "var(--muted)" }}>Cuatro puntos vivos para bajar al detalle operativo.</p>
              </div>
              <div style={{ display: "flex", gap: 10 }}>
                <Link href={`/client/jobs/${jobId}/timeline`} style={{ display: "inline-flex", alignItems: "center", gap: "5px", color: "#22d3ee", fontSize: "12px", fontWeight: 700, textDecoration: "none" }}>
                  Ver timeline →
                </Link>
                <Link href="/client/jobs" style={{ display: "inline-flex", alignItems: "center", gap: "5px", color: "var(--brand)", fontSize: "12px", fontWeight: 700, textDecoration: "none" }}>
                  Volver al listado
                </Link>
              </div>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: "14px" }}>
              <button type="button" onClick={() => setActiveInsight("escrow")} style={summaryButtonStyle("var(--brand)")} onMouseOver={e => { e.currentTarget.style.borderColor = "var(--brand)"; e.currentTarget.style.boxShadow = "0 2px 8px rgba(59,130,246,.12)"; }} onMouseOut={e => { e.currentTarget.style.borderColor = "var(--border)"; e.currentTarget.style.boxShadow = ""; }}>
                <div style={{ fontSize: "11px", color: "var(--muted)", marginBottom: "4px" }}>Presupuesto y escrow</div>
                <div style={{ fontSize: "18px", fontWeight: 800, color: "var(--ink)" }}>
                  {formatMoney(asNumber(job?.budgetMin))} {asNumber(job?.budgetMax) ? `- ${formatMoney(asNumber(job?.budgetMax))}` : ""}
                </div>
                <div style={{ fontSize: "11px", color: "var(--brand)", marginTop: "4px" }}>
                  {escrowStatus || "PENDING"} · abrir contexto →
                </div>
              </button>
              <button type="button" onClick={() => setActiveInsight("milestones")} style={summaryButtonStyle("var(--accent)")} onMouseOver={e => { e.currentTarget.style.borderColor = "var(--accent)"; e.currentTarget.style.boxShadow = "0 2px 8px rgba(255,106,0,.1)"; }} onMouseOut={e => { e.currentTarget.style.borderColor = "var(--border)"; e.currentTarget.style.boxShadow = ""; }}>
                <div style={{ fontSize: "11px", color: "var(--muted)", marginBottom: "4px" }}>Milestones</div>
                <div style={{ fontSize: "18px", fontWeight: 800, color: "var(--ink)" }}>{milestoneSummary.approved}/{milestoneSummary.total}</div>
                <div style={{ fontSize: "11px", color: "var(--accent)", marginTop: "4px" }}>
                  {asString(job?.urgency) ?? "normal"} · abrir contexto →
                </div>
              </button>
              <button type="button" onClick={() => setActiveInsight("evidence")} style={summaryButtonStyle("#10b981")} onMouseOver={e => { e.currentTarget.style.borderColor = "#10b981"; e.currentTarget.style.boxShadow = "0 2px 8px rgba(16,185,129,.1)"; }} onMouseOut={e => { e.currentTarget.style.borderColor = "var(--border)"; e.currentTarget.style.boxShadow = ""; }}>
                <div style={{ fontSize: "11px", color: "var(--muted)", marginBottom: "4px" }}>Evidencias</div>
                <div style={{ fontSize: "18px", fontWeight: 800, color: "var(--ink)" }}>{evidence.length}</div>
                <div style={{ fontSize: "11px", color: "#10b981", marginTop: "4px" }}>
                  {(asString(job?.location) ?? asString(job?.city)) ? `${asString(job?.city) ?? asString(job?.location)} · ` : ""}abrir contexto →
                </div>
              </button>
              <button type="button" onClick={() => setActiveInsight("signals")} style={summaryButtonStyle("#8b5cf6")} onMouseOver={e => { e.currentTarget.style.borderColor = "#8b5cf6"; e.currentTarget.style.boxShadow = "0 2px 8px rgba(139,92,246,.1)"; }} onMouseOut={e => { e.currentTarget.style.borderColor = "var(--border)"; e.currentTarget.style.boxShadow = ""; }}>
                <div style={{ fontSize: "11px", color: "var(--muted)", marginBottom: "4px" }}>Operación y agentes</div>
                <div style={{ fontSize: "18px", fontWeight: 800, color: "var(--ink)" }}>{approvedSignals.length}</div>
                <div style={{ fontSize: "11px", color: "#8b5cf6", marginTop: "4px" }}>
                  {formatDate(asString(job?.deadline))} · abrir contexto →
                </div>
              </button>
            </div>
          </section>

          <section id="escrow-section" style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: "16px", padding: "20px 22px", scrollMarginTop: "80px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: "12px", flexWrap: "wrap", marginBottom: "16px" }}>
              <div>
                <h2 style={{ fontSize: "16px", fontWeight: 800, color: "var(--ink)", margin: 0 }}>Escrow</h2>
                <p style={{ fontSize: "12px", color: "var(--muted)", margin: "4px 0 0" }}>
                  Estado actual del fondeo y movimientos del trabajo.
                </p>
              </div>
              {escrowStatus !== "FUNDED" && escrowStatus !== "ACTIVE" ? (
                <button
                  onClick={() => void handleFundEscrow()}
                  disabled={pendingAction !== null}
                  style={{
                    padding: "9px 14px",
                    borderRadius: "10px",
                    border: "none",
                    background: "var(--brand)",
                    color: "#fff",
                    fontSize: "13px",
                    fontWeight: 700,
                    cursor: "pointer"
                  }}
                >
                  Fondear escrow
                </button>
              ) : null}
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: "10px", marginBottom: "14px" }}>
              {[
                { label: "Estado", value: escrowStatus || "PENDING" },
                { label: "Total", value: formatMoney(fundedAmount) },
                { label: "Holdback", value: holdbackPct !== undefined ? `${holdbackPct}%` : "—" },
                { label: "Retenido", value: formatMoney(holdbackAmount) },
                { label: "Liberado", value: formatMoney(releasedAmount) }
              ].map((item) => (
                <div key={item.label} style={{ padding: "12px 14px", borderRadius: "12px", background: "var(--bg)", border: "1px solid var(--border)" }}>
                  <div style={{ fontSize: "11px", color: "var(--muted)", marginBottom: "5px" }}>{item.label}</div>
                  <div style={{ fontSize: "16px", fontWeight: 800, color: "var(--ink)" }}>{item.value}</div>
                </div>
              ))}
            </div>

            <div style={{ display: "grid", gap: "8px" }}>
              {payments.length === 0 ? (
                <div style={{ padding: "14px 16px", borderRadius: "12px", border: "1px dashed var(--border)", color: "var(--muted)", fontSize: "12px" }}>
                  No hay transacciones registradas todavía.
                </div>
              ) : (
                payments.map((payment) => {
                  const type = asString(payment.type) ?? "DEPOSIT";
                  const meta = PAYMENT_TYPE_META[type] ?? PAYMENT_TYPE_META.DEPOSIT;
                  return (
                    <div key={asString(payment.id) ?? `${type}-${asString(payment.createdAt)}`} style={{ display: "grid", gridTemplateColumns: "1fr auto auto", gap: "10px", alignItems: "center", padding: "12px 14px", borderRadius: "12px", background: "var(--bg)", border: "1px solid var(--border)" }}>
                      <div>
                        <div style={{ fontSize: "13px", fontWeight: 700, color: "var(--ink)" }}>{meta.label}</div>
                        <div style={{ fontSize: "11px", color: "var(--muted)" }}>
                          {asString(payment.providerRef) ?? "Sin referencia"} · {formatDate(asString(payment.createdAt))}
                        </div>
                      </div>
                      <span style={{ display: "inline-flex", padding: "4px 10px", borderRadius: "999px", background: meta.bg, color: meta.color, fontSize: "11px", fontWeight: 700 }}>
                        {asString(payment.status) ?? "PENDING"}
                      </span>
                      <div style={{ fontSize: "14px", fontWeight: 800, color: "var(--ink)" }}>
                        {formatMoney(asNumber(payment.amount))}
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </section>

          <section id="milestones-section" style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: "16px", padding: "20px 22px", scrollMarginTop: "80px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: "12px", marginBottom: "16px", flexWrap: "wrap" }}>
              <div>
                <h2 style={{ fontSize: "16px", fontWeight: 800, color: "var(--ink)", margin: 0 }}>Milestones</h2>
                <p style={{ fontSize: "12px", color: "var(--muted)", margin: "4px 0 0" }}>
                  {milestoneSummary.approved}/{milestoneSummary.total} hitos aprobados
                </p>
              </div>
            </div>
            <div style={{ display: "grid", gap: "10px" }}>
              {milestones
                .slice()
                .sort((left, right) => (asNumber(left.sequence) ?? 0) - (asNumber(right.sequence) ?? 0))
                .map((milestone, index) => {
                  const status = asString(milestone.status) ?? "DRAFT";
                  const meta = MILESTONE_STATUS_META[status] ?? MILESTONE_STATUS_META.DRAFT;
                  const milestoneId = asString(milestone.id) ?? `milestone-${index}`;
                  const canReview = status === "SUBMITTED" || status === "AWAITING_REVIEW";
                  const canRelease = status === "APPROVED";
                  const isBusy = pendingAction?.includes(milestoneId);
                  return (
                    <div key={milestoneId} style={{ padding: "14px 16px", borderRadius: "14px", background: "var(--bg)", border: "1px solid var(--border)" }}>
                      <div style={{ display: "grid", gridTemplateColumns: "auto 1fr auto", gap: "12px", alignItems: "center" }}>
                        <div style={{ width: "30px", height: "30px", borderRadius: "999px", background: "var(--surface)", border: "1px solid var(--border)", display: "grid", placeItems: "center", fontSize: "12px", fontWeight: 800, color: "var(--muted)" }}>
                          {index + 1}
                        </div>
                        <div>
                          <div style={{ fontSize: "13px", fontWeight: 700, color: "var(--ink)" }}>{asString(milestone.title) ?? "Milestone"}</div>
                          <div style={{ fontSize: "11px", color: "var(--muted)" }}>
                            Secuencia {asNumber(milestone.sequence) ?? index + 1} · {formatMoney(asNumber(milestone.amount))}
                          </div>
                        </div>
                        <span style={{ display: "inline-flex", padding: "4px 10px", borderRadius: "999px", background: meta.bg, color: meta.color, fontSize: "11px", fontWeight: 700 }}>
                          {meta.label}
                        </span>
                      </div>

                      {canReview ? (
                        <div style={{ marginTop: "12px", display: "grid", gap: "10px" }}>
                          <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
                            <button
                              onClick={() => void handleMilestoneAction(milestoneId, "approve")}
                              disabled={isBusy}
                              style={{ padding: "8px 12px", borderRadius: "8px", border: "none", background: "#10b981", color: "#fff", fontSize: "12px", fontWeight: 700, cursor: "pointer" }}
                            >
                              Aprobar
                            </button>
                            <button
                              onClick={() => setShowChangeForm((current) => ({ ...current, [milestoneId]: !current[milestoneId] }))}
                              disabled={isBusy}
                              style={{ padding: "8px 12px", borderRadius: "8px", border: "1px solid var(--border)", background: "var(--surface)", color: "var(--ink)", fontSize: "12px", fontWeight: 700, cursor: "pointer" }}
                            >
                              Pedir cambios
                            </button>
                          </div>
                          {showChangeForm[milestoneId] ? (
                            <div style={{ display: "grid", gap: "8px" }}>
                              <input
                                value={changeReasons[milestoneId] ?? ""}
                                onChange={(event) =>
                                  setChangeReasons((current) => ({ ...current, [milestoneId]: event.target.value }))
                                }
                                placeholder="Razón para pedir cambios"
                                style={{ width: "100%", padding: "10px 12px", borderRadius: "10px", border: "1px solid var(--border)", background: "var(--surface)", color: "var(--ink)", fontSize: "12px", outline: "none", boxSizing: "border-box" }}
                              />
                              <button
                                onClick={() => void handleMilestoneAction(milestoneId, "request-changes")}
                                disabled={isBusy}
                                style={{ width: "fit-content", padding: "8px 12px", borderRadius: "8px", border: "none", background: "var(--accent)", color: "#fff", fontSize: "12px", fontWeight: 700, cursor: "pointer" }}
                              >
                                Confirmar cambios
                              </button>
                            </div>
                          ) : null}
                        </div>
                      ) : null}

                      {canRelease ? (
                        <div style={{ marginTop: "12px" }}>
                          <button
                            onClick={() => void handleRelease(milestoneId)}
                            disabled={isBusy}
                            style={{ padding: "8px 12px", borderRadius: "8px", border: "none", background: "var(--brand)", color: "#fff", fontSize: "12px", fontWeight: 700, cursor: "pointer" }}
                          >
                            Liberar pago
                          </button>
                        </div>
                      ) : null}
                    </div>
                  );
                })}
            </div>
          </section>

          <section id="evidence-section" style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: "16px", padding: "20px 22px", scrollMarginTop: "80px" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "16px" }}>
              <ShieldCheck size={16} color="var(--brand)" />
              <h2 style={{ fontSize: "16px", fontWeight: 800, color: "var(--ink)", margin: 0 }}>Evidencias</h2>
            </div>
            {evidence.length === 0 ? (
              <div style={{ padding: "18px 20px", borderRadius: "14px", border: "1px dashed var(--border)", color: "var(--muted)", fontSize: "12px" }}>
                Aún no hay evidencias registradas para este trabajo.
              </div>
            ) : (
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: "10px" }}>
                {evidence.map((item, index) => {
                  const kind = asString(item.kind) ?? "DOCUMENT";
                  const links = resolveEvidenceLinks(item);
                  const key = pickString(item.filename, item.originalFilename, links.sourceKey, item.id) ?? `evidence-${index}`;
                  const validationStatus = presentValidationStatus(asString(item.validationStatus));
                  const accessMode = links.previewUrl || links.downloadUrl ? "direct" : "project";
                  return (
                    <div key={key} style={{ padding: "14px 16px", borderRadius: "14px", border: "1px solid var(--border)", background: "var(--bg)" }}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: "10px", marginBottom: "12px" }}>
                        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                          <EvidenceIcon kind={kind} />
                          <span style={{ fontSize: "12px", fontWeight: 700, color: "var(--ink)" }}>{kind}</span>
                        </div>
                        <span style={{ display: "inline-flex", padding: "4px 8px", borderRadius: "999px", background: "var(--surface)", border: "1px solid var(--border)", fontSize: "10px", fontWeight: 700, color: "var(--muted)" }}>
                          {validationStatus}
                        </span>
                      </div>
                      <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "2px", flexWrap: "wrap" }}>
                        <div style={{ fontSize: "12px", fontWeight: 600, color: "var(--ink)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: "210px" }}>
                          {key}
                        </div>
                        <span style={{ fontSize: "10px", padding: "2px 6px", borderRadius: "4px", background: accessMode === "direct" ? "rgba(16,185,129,.12)" : "rgba(100,116,139,.12)", color: accessMode === "direct" ? "#10b981" : "#64748b", fontWeight: 700 }}>
                          {accessMode === "direct" ? "Acceso directo" : "Desde proyecto"}
                        </span>
                      </div>
                      {links.sourceKey ? (
                        <div style={{ fontSize: "11px", color: "var(--faint)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                          {links.sourceKey}
                        </div>
                      ) : null}
                      <div style={{ display: "flex", alignItems: "center", gap: "6px", fontSize: "11px", color: "var(--muted)", marginTop: "6px" }}>
                        <Clock3 size={12} />
                        {formatDate(asString(item.createdAt) ?? asString(item.capturedAt))}
                      </div>
                      <div style={{ display: "flex", gap: "6px", marginTop: "10px" }}>
                        {links.previewUrl ? (
                          <a
                            href={links.previewUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            title="Ver archivo"
                            style={{ padding: "6px", borderRadius: "7px", border: "1px solid var(--border)", background: "transparent", color: "var(--muted)", display: "flex", textDecoration: "none" }}
                          >
                            <Eye size={14} />
                          </a>
                        ) : (
                          <Link
                            href={`/client/jobs/${jobId}`}
                            title="Abrir proyecto para revisar el archivo"
                            style={{ padding: "6px", borderRadius: "7px", border: "1px solid var(--border)", background: "transparent", color: "var(--muted)", display: "flex", textDecoration: "none" }}
                          >
                            <Eye size={14} />
                          </Link>
                        )}
                        {links.downloadUrl ? (
                          <a
                            href={links.downloadUrl}
                            download
                            title="Descargar archivo"
                            style={{ padding: "6px", borderRadius: "7px", border: "1px solid var(--border)", background: "transparent", color: "var(--muted)", display: "flex", textDecoration: "none" }}
                          >
                            <Download size={14} />
                          </a>
                        ) : (
                          <Link
                            href={CLIENT_ROUTES.documents}
                            title="Abrir documentos para más contexto"
                            style={{ padding: "6px", borderRadius: "7px", border: "1px solid var(--border)", background: "transparent", color: "var(--muted)", display: "flex", textDecoration: "none" }}
                          >
                            <Download size={14} />
                          </Link>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </section>

          {agentSignals.length > 0 ? (
            <section id="signals-section" style={{ background: "var(--surface)", border: "1px solid rgba(251,191,36,0.28)", borderRadius: "16px", padding: "20px 22px", scrollMarginTop: "80px" }}>
              <h3 style={{ fontSize: "13px", fontWeight: 800, color: "#fbbf24", textTransform: "uppercase", letterSpacing: "0.07em", marginBottom: "12px" }}>
                Señales de agentes
              </h3>
              <div style={{ display: "grid", gap: "10px" }}>
                {agentSignals.filter((s) => s.status === "completed").map((signal) => (
                  <div key={signal.id} style={{ borderRadius: "12px", border: "1px solid rgba(148,163,184,0.16)", padding: "12px 14px" }}>
                    <div style={{ display: "flex", gap: "8px", alignItems: "center", flexWrap: "wrap", marginBottom: "4px" }}>
                      <strong style={{ fontSize: "13px", color: "var(--ink)" }}>{signal.agentType}</strong>
                      {signal.confidence != null ? (
                        <span style={{ fontSize: "11px", color: "var(--muted)", border: "1px solid rgba(148,163,184,0.18)", borderRadius: "999px", padding: "2px 7px" }}>
                          confianza {Math.round(signal.confidence * 100)}%
                        </span>
                      ) : null}
                      {signal.requiresHumanReview ? (
                        <span style={{ fontSize: "11px", color: "#fbbf24", border: "1px solid rgba(251,191,36,0.3)", borderRadius: "999px", padding: "2px 7px" }}>
                          revisión requerida
                        </span>
                      ) : null}
                    </div>
                    {signal.outputSummary ? (
                      <p style={{ fontSize: "12px", color: "#a5f3fc", fontStyle: "italic", marginBottom: "4px" }}>{signal.outputSummary}</p>
                    ) : null}
                    {signal.requiresHumanReview ? (
                      <p style={{ fontSize: "12px", color: "#fbbf24", fontWeight: 600 }}>▶ Revisar antes de continuar.</p>
                    ) : signal.agentType === "pricing" ? (
                      <p style={{ fontSize: "12px", color: "#fbbf24", fontWeight: 600 }}>▶ Revisar estimado y confirmar presupuesto.</p>
                    ) : signal.agentType === "risk" ? (
                      <p style={{ fontSize: "12px", color: "#fbbf24", fontWeight: 600 }}>▶ Revisar score de riesgo antes de adjudicar.</p>
                    ) : (
                      <p style={{ fontSize: "12px", color: "#fbbf24", fontWeight: 600 }}>▶ Revisar resultado del agente.</p>
                    )}
                  </div>
                ))}
              </div>
            </section>
          ) : null}
        </>
      )}

      {pendingAction ? (
        <div style={{ position: "sticky", bottom: "18px", display: "flex", justifyContent: "center" }}>
          <div style={{ display: "inline-flex", alignItems: "center", gap: "8px", padding: "10px 14px", borderRadius: "999px", background: "var(--ink)", color: "#fff", fontSize: "12px", fontWeight: 700, boxShadow: "0 10px 30px rgba(0,0,0,.25)" }}>
            <AlertCircle size={14} />
            Procesando acción...
          </div>
        </div>
      ) : null}

      {jobId ? (
        <JobDisputeHistory
          jobId={jobId}
          audience="client"
          projectId={typeof job?.projectId === "string" ? job.projectId : undefined}
        />
      ) : null}

      <ClientDetailDrawer
        open={activeInsight === "escrow"}
        onClose={() => setActiveInsight(null)}
        title="Escrow y presupuesto"
        subtitle="Lectura rápida del fondeo, liberaciones y brecha pendiente antes de seguir operando."
        tone="var(--brand)"
      >
        <div style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: "10px" }}>
          {[
            { label: "Estado", value: escrowStatus || "PENDING" },
            { label: "Total fondeado", value: formatMoney(fundedAmount) },
            { label: "Retenido", value: formatMoney(holdbackAmount) },
            { label: "Liberado", value: formatMoney(releasedAmount) },
          ].map((item) => (
            <div key={item.label} style={drawerMetricStyle}>
              <div style={{ fontSize: "11px", color: "var(--muted)", marginBottom: "4px" }}>{item.label}</div>
              <div style={{ fontSize: "16px", fontWeight: 800, color: "var(--ink)" }}>{item.value}</div>
            </div>
          ))}
        </div>
        <div style={drawerCard}>
          <p style={{ fontSize: "11px", fontWeight: 800, color: "var(--brand)", textTransform: "uppercase", letterSpacing: ".06em", marginBottom: "8px" }}>Lectura operativa</p>
          <p style={{ fontSize: "13px", color: "var(--ink)", lineHeight: 1.6 }}>
            {escrowStatus === "FUNDED" || escrowStatus === "ACTIVE"
              ? `El trabajo ya tiene fondos protegidos. Quedan ${formatMoney((fundedAmount ?? 0) - releasedAmount)} por liberar según aprobación de hitos.`
              : "El trabajo todavía no está fondeado. Sin escrow activo, el profesional no debería arrancar hitos que impliquen compromiso financiero."}
          </p>
        </div>
        <div style={drawerCard}>
          <p style={{ fontSize: "12px", fontWeight: 700, color: "var(--ink)", marginBottom: "10px" }}>Últimos movimientos</p>
          <div style={{ display: "grid", gap: "8px" }}>
            {payments.slice(0, 3).map((payment, index) => {
              const type = asString(payment.type) ?? "DEPOSIT";
              const meta = PAYMENT_TYPE_META[type] ?? PAYMENT_TYPE_META.DEPOSIT;
              return (
                <div key={asString(payment.id) ?? `${type}-${index}`} style={{ padding: "10px 12px", borderRadius: "10px", border: "1px solid var(--border)", background: "var(--surface)" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", gap: "8px", marginBottom: "4px" }}>
                    <span style={{ fontSize: "12px", fontWeight: 700, color: meta.color }}>{meta.label}</span>
                    <span style={{ fontSize: "12px", fontWeight: 800, color: "var(--ink)" }}>{formatMoney(asNumber(payment.amount))}</span>
                  </div>
                  <p style={{ fontSize: "11px", color: "var(--muted)" }}>{formatDate(asString(payment.createdAt))}</p>
                </div>
              );
            })}
            {payments.length === 0 ? <p style={{ fontSize: "12px", color: "var(--muted)" }}>Aún no hay transacciones registradas.</p> : null}
          </div>
        </div>
        <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
          <button onClick={() => scrollToSection("escrow-section")} style={{ padding: "9px 12px", borderRadius: "10px", border: "none", background: "var(--brand)", color: "#fff", fontSize: "12px", fontWeight: 700, cursor: "pointer" }}>
            Ir al bloque escrow
          </button>
          <Link href={`${CLIENT_ROUTES.payments}?jobId=${jobId}&tab=escrow`} style={{ padding: "9px 12px", borderRadius: "10px", border: "1px solid var(--border)", background: "transparent", color: "var(--ink)", fontSize: "12px", fontWeight: 700, textDecoration: "none", display: "inline-flex", alignItems: "center", gap: "6px" }}>
            Ver pagos del proyecto <ArrowUpRight size={13} />
          </Link>
        </div>
      </ClientDetailDrawer>

      <ClientDetailDrawer
        open={activeInsight === "milestones"}
        onClose={() => setActiveInsight(null)}
        title="Milestones y aprobaciones"
        subtitle="Qué hitos están pendientes, cuáles ya liberaste y cuál es el siguiente cuello de botella."
        tone="var(--accent)"
      >
        <div style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: "10px" }}>
          {[
            { label: "Aprobados", value: String(milestoneSummary.approved) },
            { label: "Totales", value: String(milestoneSummary.total) },
            { label: "Pendientes de review", value: String(milestones.filter((item) => ["SUBMITTED", "AWAITING_REVIEW"].includes(asString(item.status) ?? "")).length) },
            { label: "Listos para release", value: String(milestones.filter((item) => (asString(item.status) ?? "") === "APPROVED").length) },
          ].map((item) => (
            <div key={item.label} style={drawerMetricStyle}>
              <div style={{ fontSize: "11px", color: "var(--muted)", marginBottom: "4px" }}>{item.label}</div>
              <div style={{ fontSize: "16px", fontWeight: 800, color: "var(--ink)" }}>{item.value}</div>
            </div>
          ))}
        </div>
        <div style={drawerCard}>
          <p style={{ fontSize: "12px", fontWeight: 700, color: "var(--ink)", marginBottom: "10px" }}>Siguiente punto a resolver</p>
          {nextReviewMilestone ? (
            <>
              <p style={{ fontSize: "13px", fontWeight: 700, color: "var(--ink)", marginBottom: "4px" }}>{asString(nextReviewMilestone.title) ?? "Milestone"}</p>
              <p style={{ fontSize: "12px", color: "var(--muted)", lineHeight: 1.5 }}>
                Estado {asString(nextReviewMilestone.status) ?? "DRAFT"} · monto {formatMoney(asNumber(nextReviewMilestone.amount))}. Si ya tienes evidencia suficiente, puedes aprobar o pedir cambios desde el bloque principal.
              </p>
            </>
          ) : (
            <p style={{ fontSize: "12px", color: "var(--muted)" }}>No hay milestones esperando tu decisión ahora mismo.</p>
          )}
        </div>
        <div style={drawerCard}>
          <p style={{ fontSize: "12px", fontWeight: 700, color: "var(--ink)", marginBottom: "10px" }}>Secuencia reciente</p>
          <div style={{ display: "grid", gap: "8px" }}>
            {milestones.slice(0, 4).map((milestone, index) => (
              <div key={asString(milestone.id) ?? `drawer-ms-${index}`} style={{ display: "flex", justifyContent: "space-between", gap: "8px", padding: "10px 12px", borderRadius: "10px", border: "1px solid var(--border)", background: "var(--surface)" }}>
                <div>
                  <p style={{ fontSize: "12px", fontWeight: 700, color: "var(--ink)" }}>{asString(milestone.title) ?? "Milestone"}</p>
                  <p style={{ fontSize: "11px", color: "var(--muted)" }}>{formatMoney(asNumber(milestone.amount))}</p>
                </div>
                <span style={{ fontSize: "11px", color: "var(--muted)", whiteSpace: "nowrap" }}>{asString(milestone.status) ?? "DRAFT"}</span>
              </div>
            ))}
          </div>
        </div>
        <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
          <button onClick={() => scrollToSection("milestones-section")} style={{ padding: "9px 12px", borderRadius: "10px", border: "none", background: "var(--accent)", color: "#fff", fontSize: "12px", fontWeight: 700, cursor: "pointer" }}>
            Ir al bloque milestones
          </button>
          <Link href={CLIENT_ROUTES.milestones} style={{ padding: "9px 12px", borderRadius: "10px", border: "1px solid var(--border)", background: "transparent", color: "var(--ink)", fontSize: "12px", fontWeight: 700, textDecoration: "none", display: "inline-flex", alignItems: "center", gap: "6px" }}>
            Ver todos los hitos <ArrowUpRight size={13} />
          </Link>
        </div>
      </ClientDetailDrawer>

      <ClientDetailDrawer
        open={activeInsight === "evidence"}
        onClose={() => setActiveInsight(null)}
        title="Evidencias y respaldo"
        subtitle="Estado de archivos, última captura y si tienes material suficiente para aprobar con menos fricción."
        tone="#10b981"
      >
        <div style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: "10px" }}>
          {[
            { label: "Archivos totales", value: String(evidence.length) },
            { label: "Última carga", value: formatDate(asString(latestEvidence?.createdAt) ?? asString(latestEvidence?.capturedAt)) },
            { label: "Ciudad", value: asString(job?.city) ?? asString(job?.location) ?? "—" },
            { label: "Con validación", value: String(evidence.filter((item) => ["approved", "valid"].includes((asString(item.validationStatus) ?? "").toLowerCase())).length) },
          ].map((item) => (
            <div key={item.label} style={drawerMetricStyle}>
              <div style={{ fontSize: "11px", color: "var(--muted)", marginBottom: "4px" }}>{item.label}</div>
              <div style={{ fontSize: "16px", fontWeight: 800, color: "var(--ink)" }}>{item.value}</div>
            </div>
          ))}
        </div>
        <div style={drawerCard}>
          <p style={{ fontSize: "12px", fontWeight: 700, color: "var(--ink)", marginBottom: "10px" }}>Última evidencia registrada</p>
          {latestEvidence ? (
            <>
              {(() => {
                const latestLinks = resolveEvidenceLinks(latestEvidence);
                return (
                  <>
              <p style={{ fontSize: "13px", fontWeight: 700, color: "var(--ink)", marginBottom: "4px" }}>
                {pickString(latestEvidence.filename, latestEvidence.originalFilename, latestLinks.sourceKey, latestEvidence.id) ?? "Archivo"}
              </p>
              <p style={{ fontSize: "12px", color: "var(--muted)", lineHeight: 1.5 }}>
                Tipo {(asString(latestEvidence.kind) ?? "DOCUMENT").toUpperCase()} · validación {presentValidationStatus(asString(latestEvidence.validationStatus))}.
              </p>
              {latestLinks.sourceKey ? (
                <p style={{ fontSize: "11px", color: "var(--faint)", marginTop: "6px" }}>{latestLinks.sourceKey}</p>
              ) : null}
              {latestLinks.previewUrl ? (
                <a
                  href={latestLinks.previewUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{ marginTop: "10px", width: "fit-content", padding: "8px 10px", borderRadius: "8px", border: "1px solid var(--border)", background: "transparent", color: "var(--ink)", fontSize: "12px", fontWeight: 700, textDecoration: "none", display: "inline-flex", alignItems: "center", gap: "6px" }}
                >
                  Ver archivo <ArrowUpRight size={13} />
                </a>
              ) : null}
                  </>
                );
              })()}
            </>
          ) : (
            <p style={{ fontSize: "12px", color: "var(--muted)" }}>No hay archivos registrados todavía.</p>
          )}
        </div>
        <div style={drawerCard}>
          <p style={{ fontSize: "12px", fontWeight: 700, color: "var(--ink)", marginBottom: "10px" }}>Señal operativa</p>
          <p style={{ fontSize: "12px", color: "var(--muted)", lineHeight: 1.6 }}>
            {evidence.length === 0
              ? "Todavía no tienes respaldo visual o documental. Si el profesional ya dijo que terminó algo, pide evidencia antes de aprobar."
              : evidence.length < 3
                ? "Hay algo de material, pero todavía el contexto es corto. Conviene revisar fechas, secuencia y tipos de archivo."
                : "Ya tienes material suficiente para revisar con mejor criterio. Cruza evidencia con milestone y pagos antes de liberar."}
          </p>
        </div>
        <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
          <button onClick={() => scrollToSection("evidence-section")} style={{ padding: "9px 12px", borderRadius: "10px", border: "none", background: "#10b981", color: "#fff", fontSize: "12px", fontWeight: 700, cursor: "pointer" }}>
            Ir al bloque evidencias
          </button>
          <Link href={CLIENT_ROUTES.documents} style={{ padding: "9px 12px", borderRadius: "10px", border: "1px solid var(--border)", background: "transparent", color: "var(--ink)", fontSize: "12px", fontWeight: 700, textDecoration: "none", display: "inline-flex", alignItems: "center", gap: "6px" }}>
            Abrir documentos <ArrowUpRight size={13} />
          </Link>
        </div>
      </ClientDetailDrawer>

      <ClientDetailDrawer
        open={activeInsight === "signals"}
        onClose={() => setActiveInsight(null)}
        title="Operación y agentes"
        subtitle="Señales de copilotos, confianza y foco humano antes de tomar decisiones de costo, riesgo o cierre."
        tone="#8b5cf6"
      >
        <div style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: "10px" }}>
          {[
            { label: "Señales completadas", value: String(approvedSignals.length) },
            { label: "Revisión humana", value: String(agentSignals.filter((signal) => signal.requiresHumanReview).length) },
            { label: "Deadline", value: formatDate(asString(job?.deadline)) },
            { label: "Estado del trabajo", value: jobStatusMeta.label },
          ].map((item) => (
            <div key={item.label} style={drawerMetricStyle}>
              <div style={{ fontSize: "11px", color: "var(--muted)", marginBottom: "4px" }}>{item.label}</div>
              <div style={{ fontSize: "16px", fontWeight: 800, color: "var(--ink)" }}>{item.value}</div>
            </div>
          ))}
        </div>
        <div style={drawerCard}>
          <p style={{ fontSize: "12px", fontWeight: 700, color: "var(--ink)", marginBottom: "10px" }}>Lectura de agentes</p>
          {approvedSignals.length > 0 ? (
            <div style={{ display: "grid", gap: "8px" }}>
              {approvedSignals.slice(0, 4).map((signal) => (
                <div key={signal.id} style={{ padding: "10px 12px", borderRadius: "10px", border: "1px solid var(--border)", background: "var(--surface)" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", gap: "8px", marginBottom: "4px" }}>
                    <span style={{ fontSize: "12px", fontWeight: 700, color: "#8b5cf6" }}>{signal.agentType}</span>
                    <span style={{ fontSize: "11px", color: "var(--muted)" }}>{signal.confidence != null ? `${Math.round(signal.confidence * 100)}%` : "sin score"}</span>
                  </div>
                  <p style={{ fontSize: "12px", color: "var(--muted)", lineHeight: 1.5 }}>
                    {signal.outputSummary ?? "Sin resumen generado."}
                  </p>
                </div>
              ))}
            </div>
          ) : (
            <p style={{ fontSize: "12px", color: "var(--muted)" }}>No hay señales completadas para este trabajo todavía.</p>
          )}
        </div>
        <div style={drawerCard}>
          <p style={{ fontSize: "12px", fontWeight: 700, color: "var(--ink)", marginBottom: "10px" }}>Siguiente chequeo humano</p>
          <p style={{ fontSize: "12px", color: "var(--muted)", lineHeight: 1.6 }}>
            {nextActionGuide?.detail ?? "Revisa milestones, evidencia y fondos antes de mover el trabajo al siguiente estado."}
          </p>
        </div>
        <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
          <button onClick={() => scrollToSection("signals-section")} style={{ padding: "9px 12px", borderRadius: "10px", border: "none", background: "#8b5cf6", color: "#fff", fontSize: "12px", fontWeight: 700, cursor: "pointer" }}>
            Ir al bloque señales
          </button>
          <Link href={CLIENT_ROUTES.projects} style={{ padding: "9px 12px", borderRadius: "10px", border: "1px solid var(--border)", background: "transparent", color: "var(--ink)", fontSize: "12px", fontWeight: 700, textDecoration: "none", display: "inline-flex", alignItems: "center", gap: "6px" }}>
            Abrir proyectos disponibles <ArrowUpRight size={13} />
          </Link>
        </div>
      </ClientDetailDrawer>
    </div>
  );
}
