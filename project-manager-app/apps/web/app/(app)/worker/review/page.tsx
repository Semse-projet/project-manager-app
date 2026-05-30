"use client";

import { useCallback, useEffect, useState } from "react";
import { CheckCircle2, Inbox, MessageSquare, Star } from "lucide-react";
import { HtmlInCanvasPanel } from "@semse/ui";
import { createRating, fetchJobs, fetchRatings, type JobRecordView, type RatingListItem } from "../../../semse-api";
import { NotificationBanner } from "../../../components/notifications/NotificationBanner";

type ReviewableJob = {
  id: string;
  title: string;
  clientUserId: string | null;
  clientEmail: string | null;
  status: string;
  completedAt?: string | null;
  alreadyReviewed: boolean;
};

const card: React.CSSProperties = {
  background: "var(--surface)",
  border: "1px solid var(--border)",
  borderRadius: "12px",
  padding: "20px",
};

function StarPicker({ value, onChange }: { value: number; onChange: (v: number) => void }) {
  const [hover, setHover] = useState(0);
  return (
    <div style={{ display: "flex", gap: "4px" }}>
      {[1, 2, 3, 4, 5].map((i) => (
        <button
          key={i}
          type="button"
          onMouseEnter={() => setHover(i)}
          onMouseLeave={() => setHover(0)}
          onClick={() => onChange(i)}
          style={{ background: "none", border: "none", padding: "2px", cursor: "pointer" }}
        >
          <Star
            size={28}
            fill={(hover || value) >= i ? "#fbbf24" : "none"}
            color={(hover || value) >= i ? "#fbbf24" : "var(--border)"}
          />
        </button>
      ))}
    </div>
  );
}

export default function WorkerReviewPage() {
  const [jobs, setJobs] = useState<ReviewableJob[]>([]);
  const [myReviews, setMyReviews] = useState<RatingListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [activeJobId, setActiveJobId] = useState<string | null>(null);
  const [score, setScore] = useState(5);
  const [comment, setComment] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitDone, setSubmitDone] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [jobsData, ratingsData] = await Promise.all([
        fetchJobs(),
        fetchRatings(),
      ]);

      const myUserId = ratingsData.actorUserId;
      const reviewedJobIds = new Set(
        ratingsData.items
          .filter((r) => r.fromUser.id === myUserId)
          .map((r) => r.jobId),
      );

      const reviewable: ReviewableJob[] = (Array.isArray(jobsData) ? jobsData : [])
        .filter((j: JobRecordView) => j.status === "COMPLETED" || j.status === "REVIEW")
        .map((j: JobRecordView) => ({
          id: j.id,
          title: j.title,
          clientUserId: (j as any).clientUserId ?? null,
          clientEmail: (j as any).clientEmail ?? null,
          status: j.status,
          completedAt: (j as any).completedAt ?? null,
          alreadyReviewed: reviewedJobIds.has(j.id),
        }));

      const given = ratingsData.items.filter((r) => r.fromUser.id === myUserId);

      setJobs(reviewable);
      setMyReviews(given);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error al cargar datos");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  async function handleSubmit(job: ReviewableJob) {
    if (!job.clientUserId) {
      setSubmitError("No se encontró el ID del cliente para este trabajo.");
      return;
    }
    setSubmitting(true);
    setSubmitError(null);
    try {
      await createRating({ jobId: job.id, toUserId: job.clientUserId, score, comment: comment.trim() || undefined });
      setSubmitDone(true);
      setActiveJobId(null);
      setScore(5);
      setComment("");
      void load();
    } catch (e) {
      setSubmitError(e instanceof Error ? e.message : "Error al enviar la reseña");
    } finally {
      setSubmitting(false);
    }
  }

  const pending = jobs.filter((j) => !j.alreadyReviewed);
  const reviewed = jobs.filter((j) => j.alreadyReviewed);

  return (
    <div style={{ maxWidth: 720, margin: "0 auto", padding: "28px 20px", color: "var(--ink)" }}>
      <NotificationBanner />

      <div style={{ marginBottom: 28 }}>
        <h1 style={{ fontSize: 22, fontWeight: 800, margin: "0 0 6px" }}>Reseñas de clientes</h1>
        <p style={{ fontSize: 13, color: "var(--muted)", margin: 0 }}>
          Califica a los clientes con quienes trabajaste. Tus reseñas fortalecen la confianza del ecosistema.
        </p>
      </div>

      {submitDone && (
        <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "12px 16px", borderRadius: 10, background: "rgba(16,185,129,.08)", border: "1px solid rgba(16,185,129,.2)", marginBottom: 20 }}>
          <CheckCircle2 size={16} color="#10b981" />
          <p style={{ fontSize: 13, color: "#10b981", margin: 0 }}>Reseña enviada. ¡Gracias por tu valoración!</p>
        </div>
      )}

      {loading ? (
        <div style={{ display: "grid", gap: 10 }}>
          {[1, 2].map((i) => <div key={i} style={{ height: 80, borderRadius: 12, background: "var(--raised)" }} />)}
        </div>
      ) : error ? (
        <p style={{ fontSize: 13, color: "#ef4444" }}>{error}</p>
      ) : (
        <div style={{ display: "grid", gap: 24 }}>
          {/* Pending reviews */}
          <section>
            <h2 style={{ fontSize: 13, fontWeight: 700, color: "var(--muted)", textTransform: "uppercase", letterSpacing: ".06em", marginBottom: 12 }}>
              Pendientes de calificar ({pending.length})
            </h2>
            {pending.length === 0 ? (
              <HtmlInCanvasPanel as="div" style={{ ...card, textAlign: "center", padding: "32px 20px" }} canvasClassName="rounded-2xl" minHeight={80}>
                <Inbox size={28} style={{ color: "var(--faint)", margin: "0 auto 8px" }} />
                <p style={{ fontSize: 13, color: "var(--muted)" }}>No hay trabajos pendientes de calificar.</p>
              </HtmlInCanvasPanel>
            ) : (
              <div style={{ display: "grid", gap: 12 }}>
                {pending.map((job) => (
                  <HtmlInCanvasPanel key={job.id} as="div" style={card} canvasClassName="rounded-2xl" minHeight={80}>
                    <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12 }}>
                      <div>
                        <p style={{ fontSize: 14, fontWeight: 700, color: "var(--ink)", margin: "0 0 3px" }}>{job.title}</p>
                        <p style={{ fontSize: 12, color: "var(--muted)", margin: 0 }}>
                          {job.clientEmail ?? "Cliente"} · {job.status === "COMPLETED" ? "Completado" : "En revisión"}
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => { setActiveJobId(activeJobId === job.id ? null : job.id); setScore(5); setComment(""); setSubmitError(null); setSubmitDone(false); }}
                        style={{ padding: "7px 14px", borderRadius: 8, border: "none", background: activeJobId === job.id ? "rgba(239,68,68,.1)" : "var(--brand)", color: activeJobId === job.id ? "#ef4444" : "#fff", fontSize: 12, fontWeight: 700, cursor: "pointer", whiteSpace: "nowrap" }}
                      >
                        {activeJobId === job.id ? "Cancelar" : "Calificar"}
                      </button>
                    </div>

                    {activeJobId === job.id && (
                      <div style={{ marginTop: 16, display: "grid", gap: 14 }}>
                        <div>
                          <p style={{ fontSize: 11, fontWeight: 700, color: "var(--muted)", textTransform: "uppercase", letterSpacing: ".06em", marginBottom: 8 }}>Calificación</p>
                          <StarPicker value={score} onChange={setScore} />
                        </div>
                        <div>
                          <p style={{ fontSize: 11, fontWeight: 700, color: "var(--muted)", textTransform: "uppercase", letterSpacing: ".06em", marginBottom: 6 }}>Comentario (opcional)</p>
                          <textarea
                            value={comment}
                            onChange={(e) => setComment(e.target.value)}
                            rows={3}
                            placeholder="¿Cómo fue trabajar con este cliente? Comunicación, pagos, claridad del proyecto..."
                            style={{ width: "100%", padding: "10px 12px", borderRadius: 9, border: "1px solid var(--border)", background: "var(--bg)", color: "var(--ink)", fontSize: 13, outline: "none", resize: "vertical", boxSizing: "border-box" }}
                          />
                        </div>
                        {submitError && <p style={{ fontSize: 12, color: "#ef4444", margin: 0 }}>{submitError}</p>}
                        <button
                          type="button"
                          disabled={submitting || score === 0}
                          onClick={() => void handleSubmit(job)}
                          style={{ padding: "10px 20px", borderRadius: 9, border: "none", background: submitting ? "var(--muted)" : "#10b981", color: "#fff", fontSize: 13, fontWeight: 700, cursor: submitting ? "not-allowed" : "pointer" }}
                        >
                          {submitting ? "Enviando..." : "Enviar reseña"}
                        </button>
                      </div>
                    )}
                  </HtmlInCanvasPanel>
                ))}
              </div>
            )}
          </section>

          {/* Reviews I gave */}
          {reviewed.length > 0 && (
            <section>
              <h2 style={{ fontSize: 13, fontWeight: 700, color: "var(--muted)", textTransform: "uppercase", letterSpacing: ".06em", marginBottom: 12 }}>
                Ya calificados ({reviewed.length})
              </h2>
              <div style={{ display: "grid", gap: 10 }}>
                {reviewed.map((job) => {
                  const rev = myReviews.find((r) => r.jobId === job.id);
                  return (
                    <div key={job.id} style={{ ...card, display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, opacity: 0.7 }}>
                      <div>
                        <p style={{ fontSize: 14, fontWeight: 600, color: "var(--ink)", margin: "0 0 2px" }}>{job.title}</p>
                        {rev && <p style={{ fontSize: 12, color: "var(--muted)", margin: 0 }}>{rev.comment ?? "Sin comentario"}</p>}
                      </div>
                      {rev && (
                        <div style={{ display: "flex", gap: 2, flexShrink: 0 }}>
                          {[1, 2, 3, 4, 5].map((i) => (
                            <Star key={i} size={14} fill={i <= rev.score ? "#fbbf24" : "none"} color={i <= rev.score ? "#fbbf24" : "var(--border)"} />
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </section>
          )}

          {/* Reviews I received */}
          {myReviews.filter((r) => !jobs.find((j) => j.id === r.jobId && r.fromUser.id !== r.toUser.id)).length > 0 || (
            <section>
              <h2 style={{ fontSize: 13, fontWeight: 700, color: "var(--muted)", textTransform: "uppercase", letterSpacing: ".06em", marginBottom: 12 }}>
                Reseñas recibidas
              </h2>
              <div style={{ ...card, display: "flex", alignItems: "center", gap: 8 }}>
                <MessageSquare size={16} color="var(--muted)" />
                <p style={{ fontSize: 13, color: "var(--muted)", margin: 0 }}>Las reseñas recibidas se muestran en tu perfil.</p>
              </div>
            </section>
          )}
        </div>
      )}
    </div>
  );
}
