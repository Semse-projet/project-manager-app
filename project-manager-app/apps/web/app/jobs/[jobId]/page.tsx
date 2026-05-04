"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { HtmlInCanvasPanel } from "@semse/ui";
import {
  createJobDispute,
  createJobMilestone,
  fetchDisputes,
  fetchJob,
  fetchJobEscrow,
  fetchJobEvidence,
  fetchJobMilestones,
  markDisputeUnderReview,
  mutateMilestone,
  releaseMilestoneEscrow,
  resolveDispute,
  semseRuntimeEnabled,
  submitDisputeEvidence,
  uploadEvidenceFile,
  type JobRecordView
} from "../../semse-api";
import { Badge, statusVariant } from "../../../components/ui/badge";
import { Button } from "../../../components/ui/button";
import { MetricCard } from "../../../components/ui/card";
import { Input, Textarea } from "../../../components/ui/input";
import { EmptyState } from "../../../components/ui/empty-state";
import { FeedbackBanner } from "../../../components/ui/error-state";
import { PageSpinner } from "../../../components/ui/spinner";

type JobDetailPageProps = { params: Promise<{ jobId: string }> };
type MilestoneAction = "submit" | "approve" | "reject" | "request-changes";

function formatStatus(status: string) {
  return status.replace(/_/g, " ").replace(/\b\w/g, (l) => l.toUpperCase());
}

function readNumber(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim()) {
    const p = Number(value);
    return Number.isFinite(p) ? p : null;
  }
  return null;
}

export default function JobDetailPage({ params }: JobDetailPageProps) {
  const runtimeEnabled = semseRuntimeEnabled();
  const [jobId, setJobId] = useState("");
  const [job, setJob] = useState<JobRecordView | null>(null);
  const [milestones, setMilestones] = useState<Record<string, unknown>[]>([]);
  const [disputes, setDisputes]     = useState<Record<string, unknown>[]>([]);
  const [evidence, setEvidence]     = useState<Record<string, unknown>[]>([]);
  const [escrow, setEscrow]         = useState<Record<string, unknown> | null>(null);
  const [loading, setLoading]       = useState(true);
  const [error, setError]           = useState<string | null>(null);
  const [feedback, setFeedback]     = useState<string | null>(null);
  const [creating, setCreating]     = useState(false);
  const [openingDispute, setOpeningDispute] = useState(false);
  const [actingMilestoneId, setActingMilestoneId]     = useState<string | null>(null);
  const [releasingMilestoneId, setReleasingMilestoneId] = useState<string | null>(null);
  const [resolvingDisputeId, setResolvingDisputeId]   = useState<string | null>(null);
  const [msTitle, setMsTitle]   = useState("Milestone 1");
  const [msAmount, setMsAmount] = useState("500");
  const [msSeq, setMsSeq]       = useState("1");
  const [disputeReason, setDisputeReason] = useState("Need ops review for this job.");
  const [uploadingEvidence, setUploadingEvidence] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<string | null>(null);

  async function refresh(id: string) {
    const [jobResult, milestonesResult, disputesResult, evidenceResult, escrowResult] = await Promise.allSettled([
      fetchJob(id),
      fetchJobMilestones(id),
      fetchDisputes(),
      fetchJobEvidence(id),
      fetchJobEscrow(id)
    ]);

    if (jobResult.status !== "fulfilled") {
      throw jobResult.reason instanceof Error ? jobResult.reason : new Error("No se pudo cargar el job principal.");
    }

    setJob(jobResult.value);
    setMilestones(milestonesResult.status === "fulfilled" ? milestonesResult.value : []);
    setDisputes(
      disputesResult.status === "fulfilled"
        ? disputesResult.value.filter((d) => String(d.jobId ?? "") === id)
        : []
    );
    setEvidence(evidenceResult.status === "fulfilled" ? evidenceResult.value : []);
    setEscrow(escrowResult.status === "fulfilled" ? escrowResult.value : null);

    const degraded = [milestonesResult, disputesResult, evidenceResult, escrowResult]
      .filter((result) => result.status === "rejected")
      .map((result) => (result as PromiseRejectedResult).reason instanceof Error ? (result as PromiseRejectedResult).reason.message : "fetch failed");

    if (degraded.length > 0) {
      console.warn("[JobDetailPage] degraded refresh", degraded);
      setFeedback("Algunos paneles secundarios no cargaron, pero el detalle principal sí está disponible.");
    }
  }

  useEffect(() => {
    let cancelled = false;

    async function boot() {
      const resolved = await params;
      if (cancelled) return;
      setJobId(resolved.jobId);
      try {
        await refresh(resolved.jobId);
        if (!cancelled) setError(null);
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : "No se pudo cargar el job.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void boot();
    return () => { cancelled = true; };
  }, [params]);

  const milestoneStats = useMemo(() => {
    const submitted = milestones.filter((m) => m.status === "SUBMITTED").length;
    const approved  = milestones.filter((m) => m.status === "APPROVED").length;
    const released  = milestones.filter((m) => m.status === "PAID").length;
    return { total: milestones.length, submitted, approved, released };
  }, [milestones]);

  const journey = useMemo(() => {
    const escrowFunded  = (readNumber(escrow?.totalAmount ?? escrow?.amount ?? escrow?.fundedAmount) ?? 0) > 0;
    const evidenceCount = evidence.length;
    const hasMilestones = milestones.length > 0;
    const hasSubmitted  = milestones.some((m) => m.status === "SUBMITTED");
    const hasApproved   = milestones.some((m) => m.status === "APPROVED");
    const hasReleased   = milestones.some((m) => m.status === "PAID");

    const checklist = [
      {
        key: "milestone",
        label: "Crear al menos un milestone",
        done: hasMilestones,
        hint: hasMilestones ? "Ya existe un entregable operativo." : "Define el primer entregable.",
        href: "#create-milestone"
      },
      {
        key: "escrow",
        label: "Fondear escrow",
        done: escrowFunded,
        hint: escrowFunded ? "Fondos visibles para este job." : "Fondea para demostrar el release.",
        href: `/jobs/${jobId}/escrow`
      },
      {
        key: "evidence",
        label: "Registrar evidencia",
        done: evidenceCount > 0,
        hint: evidenceCount > 0 ? `${evidenceCount} evidencia(s) trazando el avance.` : "Agrega prueba documental.",
        href: `/jobs/${jobId}/evidence`
      },
      {
        key: "review",
        label: "Completar review/release",
        done: hasReleased,
        hint: hasReleased
          ? "Al menos un milestone liberado."
          : hasApproved
          ? "Hay un milestone aprobado listo para release."
          : hasSubmitted
          ? "Un milestone en revisión esperando decisión."
          : "Falta mover un milestone por el flujo.",
        href: "#milestones-list"
      }
    ];

    const completed = checklist.filter((i) => i.done).length;
    return { checklist, completed, total: checklist.length };
  }, [escrow, evidence, jobId, milestones]);

  async function handleCreateMilestone() {
    if (!jobId || creating) return;
    const parsedAmount = Number(msAmount);
    const parsedSeq    = Number(msSeq);
    if (!Number.isFinite(parsedAmount) || !Number.isFinite(parsedSeq)) {
      setError("Monto y secuencia deben ser números válidos.");
      return;
    }
    setCreating(true);
    setError(null);
    setFeedback(null);
    try {
      await createJobMilestone(jobId, { title: msTitle.trim(), amount: parsedAmount, sequence: parsedSeq });
      await refresh(jobId);
      setFeedback("Milestone creado correctamente.");
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo crear el milestone.");
    } finally {
      setCreating(false);
    }
  }

  async function handleEvidenceUpload(event: React.ChangeEvent<HTMLInputElement>, milestoneId?: string) {
    const file = event.target.files?.[0];
    if (!file || !jobId || uploadingEvidence) return;
    event.target.value = "";

    setUploadingEvidence(true);
    setError(null);
    setFeedback(null);
    setUploadProgress(`Subiendo ${file.name}…`);

    try {
      const { evidenceId } = await uploadEvidenceFile(file, jobId, milestoneId);
      await refresh(jobId);
      setFeedback(`Evidencia "${file.name}" registrada (id: ${evidenceId}).`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo subir la evidencia.");
    } finally {
      setUploadingEvidence(false);
      setUploadProgress(null);
    }
  }

  async function handleMilestoneAction(milestoneId: string, action: MilestoneAction) {
    setActingMilestoneId(milestoneId);
    setError(null);
    setFeedback(null);
    try {
      await mutateMilestone(
        milestoneId,
        action,
        action === "reject" || action === "request-changes"
          ? { reason: action === "reject" ? "Rejected from shell" : "Changes requested from shell" }
          : undefined
      );
      await refresh(jobId);
      setFeedback(`Milestone: ${formatStatus(action)}.`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo ejecutar la acción.");
    } finally {
      setActingMilestoneId(null);
    }
  }

  async function handleReleaseMilestone(milestoneId: string) {
    setReleasingMilestoneId(milestoneId);
    setError(null);
    setFeedback(null);
    try {
      await releaseMilestoneEscrow(milestoneId, { provider: "mock", methodType: "bank_transfer" });
      await refresh(jobId);
      setFeedback("Release ejecutado correctamente.");
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo liberar el pago.");
    } finally {
      setReleasingMilestoneId(null);
    }
  }

  async function handleOpenDispute() {
    if (!jobId || openingDispute) return;
    setOpeningDispute(true);
    setError(null);
    setFeedback(null);
    try {
      await createJobDispute({ jobId, reason: disputeReason.trim() });
      await refresh(jobId);
      setFeedback("Dispute abierta y visible en el job.");
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo abrir la disputa.");
    } finally {
      setOpeningDispute(false);
    }
  }

  async function handleResolveDispute(disputeId: string) {
    if (resolvingDisputeId) return;
    setResolvingDisputeId(disputeId);
    setError(null);
    setFeedback(null);
    try {
      await resolveDispute(disputeId, { resolution: "Resolved from job shell" });
      await refresh(jobId);
      setFeedback("Dispute resuelta. El job volvió a estado operativo.");
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo resolver la disputa.");
    } finally {
      setResolvingDisputeId(null);
    }
  }

  const escrowTotal = readNumber(escrow?.totalAmount ?? escrow?.amount ?? escrow?.fundedAmount) ?? 0;
  const escrowCurrency = typeof escrow?.currency === "string" ? escrow.currency : "USD";

  return (
    <div className="mx-auto w-full max-w-5xl px-4 sm:px-6 py-8">
      {/* Breadcrumb */}
      <nav aria-label="Breadcrumb" className="mb-6 flex items-center gap-2 text-xs text-muted">
        <Link href="/" className="hover:text-brand transition-colors">Jobs</Link>
        <span aria-hidden className="text-white/20">/</span>
        <span className="text-ink font-medium truncate max-w-[200px]">
          {job ? job.title : "Detalle"}
        </span>
      </nav>

      {/* Page header */}
      <HtmlInCanvasPanel as="section" className="mb-6" canvasClassName="rounded-2xl" minHeight={96}>
        <p className="text-[0.68rem] font-semibold tracking-widest uppercase text-brand mb-1">
          Job detail
        </p>
        <h1 className="text-2xl font-bold tracking-tight text-ink">
          {loading ? "Cargando…" : (job?.title ?? "Job")}
        </h1>
        {job?.status ? (
          <div className="mt-2">
            <Badge variant={statusVariant(job.status)}>
              {formatStatus(job.status)}
            </Badge>
          </div>
        ) : null}
      </HtmlInCanvasPanel>

      {/* Runtime banner */}
      {!runtimeEnabled ? (
        <div className="mb-6 rounded-xl border border-amber-500/20 bg-amber-500/[0.07] px-4 py-3">
          <p className="text-xs font-semibold text-amber-300">Modo simulación</p>
          <p className="mt-0.5 text-xs text-amber-300/70">
            Configura las variables de entorno del servidor para usar esta vista.
          </p>
        </div>
      ) : null}

      {/* Feedback */}
      {error    ? <div className="mb-4"><FeedbackBanner type="error"   message={error} /></div> : null}
      {feedback ? <div className="mb-4"><FeedbackBanner type="success" message={feedback} /></div> : null}

      {loading ? (
        <PageSpinner />
      ) : job ? (
        <div className="grid gap-6">
          {/* Metrics */}
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
            <MetricCard label="Estado"     value={formatStatus(job.status)} />
            <MetricCard label="Budget"     value={`$${job.budgetMin ?? 0} – $${job.budgetMax ?? 0}`} />
            <MetricCard label="Milestones" value={milestoneStats.total}
              sub={`${milestoneStats.approved} aprobados · ${milestoneStats.released} liberados`} />
            <MetricCard label="Evidencia"  value={evidence.length} />
            <MetricCard label="Escrow"     value={`${escrowTotal} ${escrowCurrency}`}
              accent={escrowTotal > 0} />
          </div>

          {/* Scope + quick links */}
          <HtmlInCanvasPanel as="section" className="rounded-2xl border border-white/[0.08] bg-[#0d0d20] p-5" canvasClassName="rounded-2xl" minHeight={170}>
            <p className="text-[0.68rem] font-semibold tracking-widest uppercase text-muted mb-2">
              Alcance
            </p>
            <p className="text-sm text-ink/80 leading-relaxed whitespace-pre-wrap">{job.scope}</p>
            <div className="mt-4 flex gap-2 flex-wrap">
              <Link href={`/jobs/${job.id}/escrow`} className="ghost-action-button text-xs">
                Ver escrow
              </Link>
              <Link href={`/jobs/${job.id}/evidence`} className="ghost-action-button text-xs">
                Evidence
              </Link>
            </div>
          </HtmlInCanvasPanel>

          {/* Progress checklist */}
          <HtmlInCanvasPanel as="section" aria-labelledby="progress-heading" className="rounded-2xl border border-white/[0.08] bg-[#0d0d20] p-5" canvasClassName="rounded-2xl" minHeight={280}>
            <div className="mb-4 flex items-center justify-between gap-4">
              <h2 id="progress-heading" className="text-sm font-semibold text-ink">
                Progreso
              </h2>
              <span className="text-xs text-muted bg-white/[0.04] border border-white/[0.06] rounded px-2 py-0.5">
                {journey.completed}/{journey.total} pasos
              </span>
            </div>

            {/* Progress bar */}
            <div className="mb-4 h-1.5 w-full rounded-full bg-white/[0.06]" role="progressbar"
              aria-valuenow={journey.completed} aria-valuemin={0} aria-valuemax={journey.total}>
              <div
                className="h-full rounded-full bg-brand transition-all"
                style={{ width: `${(journey.completed / journey.total) * 100}%` }}
              />
            </div>

            <ul className="grid gap-2">
              {journey.checklist.map((item) => (
                <li key={item.key}>
                  <Link
                    href={item.href}
                    className="group flex items-center justify-between gap-3 rounded-xl border border-white/[0.07] bg-[#131328] px-4 py-3 hover:border-white/[0.12] transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      <span
                        aria-hidden
                        className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-xs ${
                          item.done
                            ? "bg-brand/20 text-brand"
                            : "border border-white/[0.1] text-faint"
                        }`}
                      >
                        {item.done ? "✓" : "○"}
                      </span>
                      <div>
                        <p className="text-xs font-semibold text-ink">{item.label}</p>
                        <p className="text-xs text-muted">{item.hint}</p>
                      </div>
                    </div>
                    <Badge variant={item.done ? "success" : "default"}>
                      {item.done ? "done" : "pending"}
                    </Badge>
                  </Link>
                </li>
              ))}
            </ul>
          </HtmlInCanvasPanel>

          {/* Create milestone */}
          <HtmlInCanvasPanel id="create-milestone" as="section" aria-labelledby="ms-create-heading"
            className="rounded-2xl border border-white/[0.08] bg-[#0d0d20] p-5" canvasClassName="rounded-2xl" minHeight={220}>
            <h2 id="ms-create-heading" className="mb-4 text-sm font-semibold text-ink">
              Nuevo milestone
            </h2>
            <div className="grid gap-4">
              <div className="grid grid-cols-2 gap-4">
                <Input
                  label="Título"
                  data-testid="milestone-title-input"
                  value={msTitle}
                  onChange={(e) => setMsTitle(e.target.value)}
                />
                <Input
                  label="Monto"
                  data-testid="milestone-amount-input"
                  inputMode="decimal"
                  value={msAmount}
                  onChange={(e) => setMsAmount(e.target.value)}
                />
              </div>
              <Input
                label="Secuencia"
                data-testid="milestone-sequence-input"
                inputMode="numeric"
                value={msSeq}
                onChange={(e) => setMsSeq(e.target.value)}
                className="max-w-xs"
              />
              <div className="flex justify-end">
                <Button
                  data-testid="create-milestone-button"
                  disabled={!runtimeEnabled}
                  loading={creating}
                  onClick={handleCreateMilestone}
                >
                  Crear milestone
                </Button>
              </div>
            </div>
          </HtmlInCanvasPanel>

          {/* Milestones list */}
          <HtmlInCanvasPanel id="milestones-list" as="section" aria-labelledby="ms-list-heading"
            className="rounded-2xl border border-white/[0.08] bg-[#0d0d20] p-5" canvasClassName="rounded-2xl" minHeight={320}>
            <div className="mb-4 flex items-center justify-between gap-4">
              <h2 id="ms-list-heading" className="text-sm font-semibold text-ink">
                Milestones
              </h2>
              {milestoneStats.submitted > 0 ? (
                <span className="text-xs text-muted bg-blue-500/10 border border-blue-500/20 text-blue-300 rounded px-2 py-0.5">
                  {milestoneStats.submitted} en revisión
                </span>
              ) : null}
            </div>

            {milestones.length === 0 ? (
              <EmptyState
                title="Sin milestones"
                description="Crea el primero para activar el flujo de review y pago."
              />
            ) : (
              <ul className="grid gap-2">
                {milestones.map((ms, i) => {
                  const id     = String(ms.id ?? i);
                  const status = String(ms.status ?? "unknown");
                  const busy   = actingMilestoneId === id || releasingMilestoneId === id;

                  return (
                    <li key={id}
                      className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-white/[0.07] bg-[#131328] px-4 py-3">
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-ink">
                          {String(ms.title ?? "Untitled")}
                        </p>
                        <p className="text-xs text-muted">
                          #{String(ms.sequence ?? "—")} · ${String(ms.amount ?? 0)} · {
                            ms.reviewDecision === "REQUEST_CHANGES" ? "Changes Requested" : formatStatus(status)
                          }
                          {Number(ms.evidenceCount) > 0 ? (
                            <span className="ml-2 inline-flex items-center gap-1 text-brand/80">
                              <span aria-hidden>📎</span> {Number(ms.evidenceCount)} evidence(s)
                            </span>
                          ) : null}
                        </p>
                        {ms.rejectionReason ? (
                          <div className="mt-2 rounded bg-red-500/10 border border-red-500/20 p-2 text-[0.7rem] text-red-300 italic">
                            <strong>Feedback:</strong> {String(ms.rejectionReason)}
                          </div>
                        ) : null}
                      </div>
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge variant={ms.reviewDecision === "REQUEST_CHANGES" ? "error" : statusVariant(status)}>
                          {ms.reviewDecision === "REQUEST_CHANGES" ? "CHANGES_REQUESTED" : status}
                        </Badge>
                        {/* Evidence upload for this milestone */}
                        <label
                          className={`ghost-action-button text-xs cursor-pointer ${uploadingEvidence || !runtimeEnabled ? "opacity-50 pointer-events-none" : ""}`}
                          title="Subir evidencia para este milestone"
                        >
                          {uploadingEvidence ? "Subiendo…" : "📎 Evidencia"}
                          <input
                            type="file"
                            accept="image/*,video/*,application/pdf"
                            className="sr-only"
                            disabled={uploadingEvidence || !runtimeEnabled}
                            onChange={(e) => handleEvidenceUpload(e, id)}
                          />
                        </label>
                        <button className="ghost-action-button text-xs" disabled={busy}
                          onClick={() => handleMilestoneAction(id, "submit")}>Submit</button>
                        <button className="ghost-action-button text-xs" disabled={busy}
                          onClick={() => handleMilestoneAction(id, "approve")}>Approve</button>
                        <button className="ghost-action-button text-xs" disabled={busy}
                          onClick={() => handleMilestoneAction(id, "request-changes")}>Changes</button>
                        <button className="ghost-action-button text-xs" disabled={busy}
                          onClick={() => handleMilestoneAction(id, "reject")}>Reject</button>
                        {status === "approved" ? (
                          <Button
                            size="sm"
                            disabled={busy}
                            loading={releasingMilestoneId === id}
                            onClick={() => handleReleaseMilestone(id)}
                          >
                            Release
                          </Button>
                        ) : null}
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </HtmlInCanvasPanel>

          {/* Disputes */}
          <HtmlInCanvasPanel as="section" aria-labelledby="disputes-heading"
            className="rounded-2xl border border-white/[0.08] bg-[#0d0d20] p-5" canvasClassName="rounded-2xl" minHeight={260}>
            <h2 id="disputes-heading" className="mb-4 text-sm font-semibold text-ink">
              Disputes
            </h2>
            <div className="grid gap-5 lg:grid-cols-[280px_1fr]">
              {/* Open dispute form */}
              <div className="grid gap-3 content-start">
                <Textarea
                  label="Motivo"
                  data-testid="dispute-reason-input"
                  maxLength={500}
                  rows={3}
                  value={disputeReason}
                  onChange={(e) => setDisputeReason(e.target.value)}
                />
                <Button
                  data-testid="open-dispute-button"
                  variant="destructive"
                  disabled={!runtimeEnabled}
                  loading={openingDispute}
                  onClick={handleOpenDispute}
                >
                  Abrir dispute
                </Button>
              </div>

              {/* Disputes list */}
              <div>
                {disputes.length === 0 ? (
                  <EmptyState
                    title="Sin disputes"
                    description="No hay disputes activas para este job."
                  />
                ) : (
                  <ul className="grid gap-2">
                    {disputes.map((d, i) => {
                      const dId    = String(d.id ?? i);
                      const status = String(d.status ?? "unknown");
                      return (
                        <li key={dId}
                          className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-white/[0.07] bg-[#131328] px-4 py-3">
                          <div className="min-w-0">
                            <p className="text-sm font-semibold text-ink">Dispute {dId}</p>
                            <p className="text-xs text-muted">{String(d.reason ?? "")}</p>
                          </div>
                          <div className="flex items-center gap-2">
                            <Badge variant={statusVariant(status)}>{formatStatus(status)}</Badge>
                            {status !== "resolved" ? (
                              <button
                                className="ghost-action-button text-xs"
                                disabled={resolvingDisputeId === dId}
                                onClick={() => handleResolveDispute(dId)}
                              >
                                {resolvingDisputeId === dId ? "Resolviendo…" : "Resolver"}
                              </button>
                            ) : null}
                          </div>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </div>
            </div>
          </HtmlInCanvasPanel>
        </div>
      ) : null}
    </div>
  );
}
