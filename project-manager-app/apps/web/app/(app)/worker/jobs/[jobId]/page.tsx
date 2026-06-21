"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import {
  AlertCircle,
  Camera,
  ChevronLeft,
  Clock3,
  MapPin,
  ShieldCheck,
  CheckCircle,
  FileText,
  ImageIcon,
  Video,
} from "lucide-react";
import {
  fetchJob,
  fetchJobMilestones,
  fetchJobEvidence,
  mutateMilestone,
  transitionJobStatus,
} from "../../../../semse-api";
import { JobDisputeHistory } from "../../../../components/disputes/JobDisputeHistory";
import { NotificationBanner } from "../../../../components/notifications/NotificationBanner";
import { EvidenceChecklistCard } from "@/components/semse/EvidenceChecklistCard";

type JobDetail = Record<string, unknown>;
type JobMilestone = Record<string, unknown>;
type JobEvidence = Record<string, unknown>;

function asString(v: unknown): string | undefined {
  return typeof v === "string" && v.trim().length > 0 ? v : undefined;
}
function asNumber(v: unknown): number | undefined {
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (typeof v === "string") { const n = Number(v); if (Number.isFinite(n)) return n; }
  return undefined;
}
function formatMoney(v?: number) {
  if (v === undefined) return "—";
  return v.toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });
}
function formatDate(s?: string) {
  if (!s) return "—";
  try { return new Date(s).toLocaleDateString("es-US", { year: "numeric", month: "short", day: "numeric" }); }
  catch { return s; }
}

const JOB_STATUS_META: Record<string, { label: string; color: string; bg: string }> = {
  draft:       { label: "Borrador",    color: "#64748b", bg: "rgba(100,116,139,.12)" },
  posted:      { label: "Publicado",   color: "#3b82f6", bg: "rgba(59,130,246,.12)"  },
  reserved:    { label: "Reservado",   color: "#f59e0b", bg: "rgba(245,158,11,.12)"  },
  accepted:    { label: "Aceptado",    color: "#8b5cf6", bg: "rgba(139,92,246,.12)"  },
  in_progress: { label: "En progreso", color: "#06b6d4", bg: "rgba(6,182,212,.12)"   },
  review:      { label: "En revisión", color: "#f59e0b", bg: "rgba(245,158,11,.12)"  },
  dispute:     { label: "En disputa",  color: "#ef4444", bg: "rgba(239,68,68,.12)"   },
  completed:   { label: "Completado",  color: "#10b981", bg: "rgba(16,185,129,.12)"  },
  cancelled:   { label: "Cancelado",   color: "#64748b", bg: "rgba(100,116,139,.12)" },
};

const MILESTONE_META: Record<string, { label: string; color: string; bg: string }> = {
  DRAFT:           { label: "Pendiente",   color: "#64748b", bg: "rgba(100,116,139,.12)" },
  AWAITING_REVIEW: { label: "En revisión", color: "#f59e0b", bg: "rgba(245,158,11,.12)"  },
  SUBMITTED:       { label: "Enviado",     color: "#06b6d4", bg: "rgba(6,182,212,.12)"   },
  APPROVED:        { label: "Aprobado",    color: "#10b981", bg: "rgba(16,185,129,.12)"  },
  REJECTED:        { label: "Rechazado",   color: "#ef4444", bg: "rgba(239,68,68,.12)"   },
  PAID:            { label: "Pagado",      color: "#22c55e", bg: "rgba(34,197,94,.12)"   },
};

const WORKER_NEXT_ACTION: Record<string, { label: string; detail: string; tone: string }> = {
  reserved:    { label: "Reservado — confirma tu disponibilidad",           detail: "El cliente aún no acepta. Puedes esperar o contactarlo.",           tone: "#f59e0b" },
  accepted:    { label: "Aceptado — inicia el trabajo cuando el escrow esté activo", detail: "Presiona 'Iniciar trabajo' para comenzar. El cliente debe fondear el escrow primero.", tone: "#8b5cf6" },
  in_progress: { label: "En progreso — avanza y envía los milestones",      detail: "Sube evidencia y marca cada milestone como completado.",            tone: "#06b6d4" },
  review:      { label: "En revisión — el cliente está evaluando tu entrega", detail: "Espera aprobación. Puedes subir evidencia adicional si hace falta.", tone: "#f59e0b" },
  dispute:     { label: "Disputa activa — aporta evidencia",                detail: "El equipo de ops está revisando. Sube pruebas de tu trabajo.",      tone: "#ef4444" },
  completed:   { label: "Trabajo completado",                               detail: "El trabajo se cerró correctamente.",                                tone: "#10b981" },
};

function EvidenceIcon({ kind }: { kind: string }) {
  if (kind === "PHOTO") return <ImageIcon size={13} color="#10b981" />;
  if (kind === "VIDEO") return <Video size={13} color="#3b82f6" />;
  return <FileText size={13} color="#8b5cf6" />;
}

export default function WorkerJobDetailPage() {
  const params = useParams<{ jobId: string }>();
  const jobId = params?.jobId ?? "";

  const [job,        setJob]        = useState<JobDetail | null>(null);
  const [milestones, setMilestones] = useState<JobMilestone[]>([]);
  const [evidence,   setEvidence]   = useState<JobEvidence[]>([]);
  const [loading,    setLoading]    = useState(true);
  const [error,      setError]      = useState<string | null>(null);
  const [pendingAction, setPendingAction] = useState<string | null>(null);
  const [submitNote, setSubmitNote] = useState<Record<string, string>>({});

  const load = useCallback(async () => {
    if (!jobId) return;
    setLoading(true);
    setError(null);
    try {
      const [jobResult, milestonesResult, evidenceResult] = await Promise.all([
        fetchJob(jobId),
        fetchJobMilestones(jobId),
        fetchJobEvidence(jobId).catch(() => [] as Record<string, unknown>[]),
      ]);
      setJob(jobResult as unknown as JobDetail);
      setMilestones(milestonesResult);
      setEvidence(evidenceResult);
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo cargar el trabajo.");
    } finally {
      setLoading(false);
    }
  }, [jobId]);

  useEffect(() => { void load(); }, [load]);

  const handleStartJob = async () => {
    if (pendingAction) return;
    setPendingAction("start-job");
    try {
      await transitionJobStatus(jobId, "in_progress");
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo iniciar el trabajo.");
    } finally {
      setPendingAction(null);
    }
  };

  const handleSubmitMilestone = async (milestoneId: string) => {
    if (pendingAction) return;
    setPendingAction(milestoneId);
    try {
      const note = submitNote[milestoneId]?.trim();
      await mutateMilestone(milestoneId, "submit", note ? { note } : undefined);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo enviar el milestone.");
    } finally {
      setPendingAction(null);
    }
  };

  const normalizedStatus = asString(job?.status) ?? "posted";
  const jobStatusMeta = JOB_STATUS_META[normalizedStatus] ?? JOB_STATUS_META.posted;
  const nextAction = WORKER_NEXT_ACTION[normalizedStatus] ?? null;

  const milestoneSummary = {
    approved: milestones.filter(m => ["APPROVED", "PAID"].includes(String(m.status))).length,
    total: milestones.length,
  };

  return (
    <div style={{ maxWidth: "1024px", margin: "0 auto", display: "grid", gap: "18px" }}>
      {/* Breadcrumb */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "10px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
          <Link href="/worker/dashboard" style={{ display: "inline-flex", alignItems: "center", gap: "4px", color: "var(--muted)", fontSize: "12px", fontWeight: 600, textDecoration: "none" }}>
            <ChevronLeft size={13} /> Dashboard
          </Link>
          <span style={{ color: "var(--faint)", fontSize: "12px" }}>/</span>
          <Link href="/worker/jobs" style={{ color: "var(--muted)", fontSize: "12px", fontWeight: 600, textDecoration: "none" }}>
            Mis trabajos
          </Link>
        </div>
        <NotificationBanner audience="worker" />
      </div>

      {/* Title */}
      <div>
        <span style={{ display: "inline-flex", alignItems: "center", padding: "4px 10px", borderRadius: "999px", background: jobStatusMeta.bg, color: jobStatusMeta.color, fontSize: "11px", fontWeight: 700, border: `1px solid ${jobStatusMeta.color}30` }}>
          {jobStatusMeta.label}
        </span>
        <h1 style={{ fontSize: "22px", fontWeight: 800, color: "var(--ink)", margin: "10px 0 4px" }}>
          {asString(job?.title) ?? "Detalle del trabajo"}
        </h1>
        <p style={{ fontSize: "13px", color: "var(--muted)", maxWidth: "720px", lineHeight: 1.6 }}>
          {asString(job?.scope) ?? asString(job?.description) ?? ""}
        </p>
      </div>

      {loading ? (
        <div style={{ display: "grid", gap: "12px" }}>
          {[1, 2, 3].map(i => <div key={i} style={{ height: "120px", borderRadius: "16px", border: "1px solid var(--border)", background: "var(--surface)", animation: "pulse 1.5s ease-in-out infinite" }} />)}
        </div>
      ) : error ? (
        <div style={{ padding: "18px 20px", background: "rgba(239,68,68,.08)", border: "1px solid rgba(239,68,68,.18)", borderRadius: "14px", color: "#ef4444", fontSize: "13px" }}>{error}</div>
      ) : (
        <>
          {/* Next action banner */}
          {nextAction && (
            <div style={{ borderRadius: "14px", border: `1px solid ${nextAction.tone}44`, background: `${nextAction.tone}11`, padding: "14px 18px", display: "flex", gap: "10px", alignItems: "flex-start" }}>
              <span style={{ fontSize: "16px", lineHeight: 1 }}>▶</span>
              <div>
                <strong style={{ fontSize: "14px", color: nextAction.tone, display: "block", marginBottom: "2px" }}>{nextAction.label}</strong>
                <span style={{ fontSize: "12px", color: "var(--muted)" }}>{nextAction.detail}</span>
                {normalizedStatus === "accepted" ? (
                  <div style={{ marginTop: 10 }}>
                    <button
                      onClick={() => void handleStartJob()}
                      disabled={pendingAction !== null}
                      style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "8px 14px", borderRadius: 10, border: "none", background: "#8b5cf6", color: "#fff", fontSize: 12, fontWeight: 700, cursor: "pointer", opacity: pendingAction ? 0.7 : 1 }}
                    >
                      ▶ Iniciar trabajo
                    </button>
                  </div>
                ) : null}
                {normalizedStatus === "in_progress" ? (
                  <div style={{ marginTop: 10 }}>
                    <button
                      onClick={async () => {
                        if (pendingAction) return;
                        setPendingAction("send-review");
                        try { await transitionJobStatus(jobId, "review"); await load(); }
                        catch (e) { setError(e instanceof Error ? e.message : "Error al enviar para revisión."); }
                        finally { setPendingAction(null); }
                      }}
                      disabled={pendingAction !== null}
                      style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "8px 14px", borderRadius: 10, border: "none", background: "#06b6d4", color: "#fff", fontSize: 12, fontWeight: 700, cursor: "pointer", opacity: pendingAction ? 0.7 : 1 }}
                    >
                      Enviar para revisión →
                    </button>
                  </div>
                ) : null}
                {normalizedStatus === "dispute" ? (
                  <div style={{ marginTop: 10 }}>
                    <Link
                      href={`/worker/disputes?status=open`}
                      style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "8px 12px", borderRadius: 10, border: "1px solid rgba(239,68,68,.25)", background: "rgba(239,68,68,.08)", color: "#ef4444", fontSize: 12, fontWeight: 700, textDecoration: "none" }}
                    >
                      <AlertCircle size={13} />
                      Abrir panel de disputas
                    </Link>
                  </div>
                ) : null}
                {normalizedStatus === "completed" && jobId ? (
                  <div style={{ marginTop: 10 }}>
                    <Link
                      href={`/worker/jobs/${jobId}/rate`}
                      style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "8px 14px", borderRadius: 10, border: "1px solid rgba(16,185,129,.35)", background: "rgba(16,185,129,.1)", color: "#10b981", fontSize: 12, fontWeight: 700, textDecoration: "none" }}
                    >
                      ⭐ Calificar al cliente
                    </Link>
                  </div>
                ) : null}
              </div>
            </div>
          )}

          {/* Info summary */}
          <section style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: "16px", padding: "20px 22px" }}>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: "14px" }}>
              <a href="#milestones-section" style={{ textDecoration: "none", padding: "12px 14px", borderRadius: "12px", background: "var(--bg)", border: "1px solid var(--border)", display: "block", transition: "border-color .15s" }} onMouseOver={e => { e.currentTarget.style.borderColor = "var(--brand)"; }} onMouseOut={e => { e.currentTarget.style.borderColor = "var(--border)"; }}>
                <div style={{ fontSize: "11px", color: "var(--muted)", marginBottom: "4px" }}>Presupuesto</div>
                <div style={{ fontSize: "18px", fontWeight: 800, color: "var(--ink)" }}>{formatMoney(asNumber(job?.budgetMin))} {asNumber(job?.budgetMax) ? `- ${formatMoney(asNumber(job?.budgetMax))}` : ""}</div>
                <div style={{ fontSize: "11px", color: "var(--brand)", marginTop: "4px" }}>Ver hitos →</div>
              </a>
              <div style={{ padding: "12px 14px", borderRadius: "12px", background: "var(--bg)", border: "1px solid var(--border)" }}>
                <div style={{ fontSize: "11px", color: "var(--muted)", marginBottom: "4px" }}>Categoría</div>
                <div style={{ fontSize: "13px", color: "var(--ink)" }}>{asString(job?.category) ?? "—"}</div>
              </div>
              {(asString(job?.location) ?? asString(job?.city)) ? (
                <a href={`https://maps.google.com/?q=${encodeURIComponent(asString(job?.location) ?? asString(job?.city) ?? "")}`} target="_blank" rel="noopener noreferrer" style={{ textDecoration: "none", padding: "12px 14px", borderRadius: "12px", background: "var(--bg)", border: "1px solid var(--border)", display: "block", transition: "border-color .15s" }} onMouseOver={e => { e.currentTarget.style.borderColor = "#10b981"; }} onMouseOut={e => { e.currentTarget.style.borderColor = "var(--border)"; }}>
                  <div style={{ fontSize: "11px", color: "var(--muted)", marginBottom: "4px" }}>Ubicación</div>
                  <div style={{ fontSize: "13px", color: "var(--ink)", display: "flex", alignItems: "center", gap: "6px" }}><MapPin size={13} color="var(--muted)" />{asString(job?.location) ?? asString(job?.city)}</div>
                  <div style={{ fontSize: "11px", color: "#10b981", marginTop: "4px" }}>Ver en mapa →</div>
                </a>
              ) : (
                <div style={{ padding: "12px 14px", borderRadius: "12px", background: "var(--bg)", border: "1px solid var(--border)" }}>
                  <div style={{ fontSize: "11px", color: "var(--muted)", marginBottom: "4px" }}>Ubicación</div>
                  <div style={{ fontSize: "13px", color: "var(--ink)", display: "flex", alignItems: "center", gap: "6px" }}><MapPin size={13} color="var(--muted)" />—</div>
                </div>
              )}
              <div style={{ padding: "12px 14px", borderRadius: "12px", background: "var(--bg)", border: "1px solid var(--border)" }}>
                <div style={{ fontSize: "11px", color: "var(--muted)", marginBottom: "4px" }}>Urgencia</div>
                <div style={{ fontSize: "13px", color: "var(--ink)" }}>{asString(job?.urgency) ?? "—"}</div>
              </div>
              <div style={{ padding: "12px 14px", borderRadius: "12px", background: "var(--bg)", border: "1px solid var(--border)" }}>
                <div style={{ fontSize: "11px", color: "var(--muted)", marginBottom: "4px" }}>Deadline</div>
                <div style={{ fontSize: "13px", color: "var(--ink)" }}>{formatDate(asString(job?.deadline))}</div>
              </div>
            </div>
          </section>

          {/* Evidence Checklist — what the worker needs to upload */}
          {job && (asString(job?.category) || asString(job?.title)) && (
            <EvidenceChecklistCard
              milestoneTitle={asString(job?.title) ?? "Milestone"}
              trade={asString(job?.category) ?? "general"}
            />
          )}

          {/* Milestones */}
          <section id="milestones-section" style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: "16px", padding: "20px 22px", scrollMarginTop: "80px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: "12px", flexWrap: "wrap", marginBottom: "16px" }}>
              <div>
                <h2 style={{ fontSize: "16px", fontWeight: 800, color: "var(--ink)", margin: 0 }}>Milestones</h2>
                <p style={{ fontSize: "12px", color: "var(--muted)", margin: "4px 0 0" }}>{milestoneSummary.approved}/{milestoneSummary.total} hitos aprobados</p>
              </div>
              <Link href={`/worker/evidence?jobId=${jobId}`} style={{ display: "inline-flex", alignItems: "center", gap: "6px", padding: "8px 14px", borderRadius: "9px", background: "rgba(16,185,129,.12)", color: "#10b981", fontSize: "12px", fontWeight: 700, textDecoration: "none" }}>
                <Camera size={13} /> Subir evidencia
              </Link>
            </div>
            <div style={{ display: "grid", gap: "10px" }}>
              {milestones.length === 0 ? (
                <div style={{ padding: "20px", borderRadius: "12px", border: "1px dashed var(--border)", color: "var(--muted)", fontSize: "12px" }}>Aún no hay milestones para este trabajo.</div>
              ) : (
                milestones
                  .slice()
                  .sort((a, b) => (asNumber(a.sequence) ?? 0) - (asNumber(b.sequence) ?? 0))
                  .map((milestone, index) => {
                    const status = asString(milestone.status) ?? "DRAFT";
                    const meta = MILESTONE_META[status] ?? MILESTONE_META.DRAFT;
                    const milestoneId = asString(milestone.id) ?? `m-${index}`;
                    const canSubmit = status === "DRAFT" || status === "REJECTED";
                    const isBusy = pendingAction === milestoneId;
                    return (
                      <div key={milestoneId} style={{ padding: "14px 16px", borderRadius: "14px", background: "var(--bg)", border: "1px solid var(--border)" }}>
                        <div style={{ display: "grid", gridTemplateColumns: "auto 1fr auto", gap: "12px", alignItems: "center" }}>
                          <div style={{ width: "30px", height: "30px", borderRadius: "999px", background: "var(--surface)", border: "1px solid var(--border)", display: "grid", placeItems: "center", fontSize: "12px", fontWeight: 800, color: "var(--muted)" }}>
                            {index + 1}
                          </div>
                          <div>
                            <p style={{ fontSize: "13px", fontWeight: 700, color: "var(--ink)" }}>{asString(milestone.title) ?? `Milestone ${index + 1}`}</p>
                            <p style={{ fontSize: "11px", color: "var(--muted)", marginTop: "2px" }}>{formatMoney(asNumber(milestone.amount))}</p>
                          </div>
                          <span style={{ fontSize: "11px", fontWeight: 700, padding: "3px 10px", borderRadius: "999px", background: meta.bg, color: meta.color, whiteSpace: "nowrap", border: `1px solid ${meta.color}30` }}>
                            {meta.label}
                          </span>
                        </div>
                        {canSubmit && (
                          <div style={{ marginTop: "12px", display: "grid", gap: "8px" }}>
                            <textarea
                              value={submitNote[milestoneId] ?? ""}
                              onChange={e => setSubmitNote(n => ({ ...n, [milestoneId]: e.target.value }))}
                              placeholder="Nota de entrega (opcional)..."
                              rows={2}
                              style={{ width: "100%", padding: "8px 12px", borderRadius: "8px", border: "1px solid var(--border)", background: "var(--surface)", color: "var(--ink)", fontSize: "12px", outline: "none", resize: "vertical", boxSizing: "border-box" }}
                            />
                            <button
                              onClick={() => void handleSubmitMilestone(milestoneId)}
                              disabled={isBusy}
                              style={{ alignSelf: "start", padding: "7px 16px", borderRadius: "8px", border: "none", background: isBusy ? "var(--muted)" : "#06b6d4", color: "#fff", fontSize: "12px", fontWeight: 700, cursor: isBusy ? "not-allowed" : "pointer" }}
                            >
                              {isBusy ? "Enviando..." : "Marcar como completado"}
                            </button>
                          </div>
                        )}
                        {status === "REJECTED" && asString(milestone.rejectionReason) && (
                          <p style={{ fontSize: "11px", color: "#ef4444", marginTop: "8px" }}>Razón de rechazo: {asString(milestone.rejectionReason)}</p>
                        )}
                      </div>
                    );
                  })
              )}
            </div>
          </section>

          {/* Evidence */}
          <section style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: "16px", padding: "20px 22px" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "12px", marginBottom: "16px" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                <ShieldCheck size={16} color="var(--brand)" />
                <h2 style={{ fontSize: "16px", fontWeight: 800, color: "var(--ink)", margin: 0 }}>Evidencias</h2>
              </div>
              <Link href={`/worker/evidence?jobId=${jobId}`} style={{ display: "inline-flex", alignItems: "center", gap: "6px", padding: "8px 14px", borderRadius: "9px", background: "rgba(59,130,246,.1)", color: "var(--brand)", fontSize: "12px", fontWeight: 700, textDecoration: "none" }}>
                <Camera size={13} /> Subir
              </Link>
            </div>
            {evidence.length === 0 ? (
              <div style={{ padding: "18px 20px", borderRadius: "14px", border: "1px dashed var(--border)", color: "var(--muted)", fontSize: "12px" }}>Aún no hay evidencias para este trabajo.</div>
            ) : (
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: "10px" }}>
                {evidence.map((item, index) => {
                  const kind = asString(item.kind) ?? "DOCUMENT";
                  const key = asString(item.bucketKey) ?? asString(item.filename) ?? `ev-${index}`;
                  return (
                    <div key={key} style={{ padding: "14px 16px", borderRadius: "14px", border: "1px solid var(--border)", background: "var(--bg)" }}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "10px" }}>
                        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                          <EvidenceIcon kind={kind} />
                          <span style={{ fontSize: "12px", fontWeight: 700, color: "var(--ink)" }}>{kind}</span>
                        </div>
                        <span style={{ fontSize: "10px", fontWeight: 700, padding: "2px 7px", borderRadius: "999px", background: "var(--surface)", border: "1px solid var(--border)", color: "var(--muted)" }}>
                          {asString(item.validationStatus) ?? "pending"}
                        </span>
                      </div>
                      <div style={{ fontSize: "12px", color: "var(--ink)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{key}</div>
                      <div style={{ display: "flex", alignItems: "center", gap: "6px", fontSize: "11px", color: "var(--muted)", marginTop: "6px" }}>
                        <Clock3 size={11} />
                        {formatDate(asString(item.createdAt) ?? asString(item.capturedAt))}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </section>
        </>
      )}

      {jobId ? (
        <JobDisputeHistory
          jobId={jobId}
          audience="worker"
          projectId={typeof job?.projectId === "string" ? job.projectId : undefined}
        />
      ) : null}

      {pendingAction && (
        <div style={{ position: "sticky", bottom: "18px", display: "flex", justifyContent: "center" }}>
          <div style={{ display: "inline-flex", alignItems: "center", gap: "8px", padding: "10px 14px", borderRadius: "999px", background: "var(--ink)", color: "#fff", fontSize: "12px", fontWeight: 700, boxShadow: "0 10px 30px rgba(0,0,0,.25)" }}>
            <AlertCircle size={14} /> Procesando...
          </div>
        </div>
      )}
    </div>
  );
}
