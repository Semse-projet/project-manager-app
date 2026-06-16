"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { AlertCircle, ArrowLeft, CheckCircle, Loader2, Star } from "lucide-react";
import { createRating, fetchJob } from "../../../../../../semse-api";
import { NotificationBanner } from "../../../../../../components/notifications/NotificationBanner";

type Phase = "loading" | "form" | "submitting" | "success" | "error" | "already_rated" | "not_eligible";

function StarPicker({ value, onChange }: { value: number; onChange: (n: number) => void }) {
  const [hovered, setHovered] = useState(0);
  const LABELS = ["Muy malo", "Malo", "Regular", "Bueno", "Excelente"];
  const active = hovered || value;
  return (
    <div>
      <div style={{ display: "flex", gap: "10px", justifyContent: "center", marginBottom: "10px" }}>
        {[1, 2, 3, 4, 5].map((n) => (
          <button
            key={n}
            type="button"
            onMouseEnter={() => setHovered(n)}
            onMouseLeave={() => setHovered(0)}
            onClick={() => onChange(n)}
            style={{
              background: "none",
              border: "none",
              cursor: "pointer",
              padding: "4px",
              transition: "transform 0.1s",
              transform: active >= n ? "scale(1.15)" : "scale(1)",
            }}
            aria-label={`${n} estrellas`}
          >
            <Star
              size={36}
              fill={active >= n ? "#fbbf24" : "none"}
              color={active >= n ? "#fbbf24" : "var(--border)"}
            />
          </button>
        ))}
      </div>
      {active > 0 && (
        <p style={{ textAlign: "center", fontSize: "13px", color: "#fbbf24", fontWeight: 700, minHeight: "18px" }}>
          {LABELS[active - 1]}
        </p>
      )}
    </div>
  );
}

export default function WorkerRateJobPage() {
  const { jobId } = useParams<{ jobId: string }>();

  const [phase, setPhase] = useState<Phase>("loading");
  const [jobTitle, setJobTitle] = useState("");
  const [clientUserId, setClientUserId] = useState<string | null>(null);
  const [score, setScore] = useState(0);
  const [comment, setComment] = useState("");
  const [errorMsg, setErrorMsg] = useState("");

  useEffect(() => {
    if (!jobId) return;
    (async () => {
      try {
        const job = await fetchJob(jobId);
        setJobTitle((job as any).title ?? "");

        const status = String((job as any).status ?? "").toLowerCase();
        if (status !== "completed") {
          setPhase("not_eligible");
          return;
        }

        const uid = (job as any).clientUserId ?? null;
        if (!uid) {
          setPhase("not_eligible");
          return;
        }

        setClientUserId(uid);
        setPhase("form");
      } catch {
        setErrorMsg("No se pudo cargar la información del trabajo.");
        setPhase("error");
      }
    })();
  }, [jobId]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (score < 1 || score > 5 || !clientUserId) return;

    setPhase("submitting");
    try {
      await createRating({ jobId, toUserId: clientUserId, score, comment: comment.trim() || undefined });
      setPhase("success");
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Error al enviar la calificación.";
      const isAlready = msg.toLowerCase().includes("already") || msg.toLowerCase().includes("duplicate");
      setErrorMsg(isAlready ? "Ya calificaste a este cliente." : msg);
      setPhase(isAlready ? "already_rated" : "error");
    }
  }

  const card: React.CSSProperties = {
    background: "var(--surface)",
    border: "1px solid var(--border)",
    borderRadius: "16px",
    padding: "32px",
  };

  const isLoading = phase === "loading" || phase === "submitting";

  return (
    <div style={{ maxWidth: "560px", margin: "0 auto", padding: "24px 16px" }}>
      <NotificationBanner audience="worker" />

      <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "20px" }}>
        <Link
          href={`/worker/jobs/${jobId}`}
          style={{ display: "flex", alignItems: "center", gap: "4px", fontSize: "13px", color: "var(--muted)", textDecoration: "none" }}
        >
          <ArrowLeft size={14} />
          Volver al trabajo
        </Link>
      </div>

      <div style={{ marginBottom: "24px" }}>
        <h1 style={{ fontSize: "20px", fontWeight: 800, color: "var(--ink)", margin: "0 0 4px" }}>
          Califica al cliente
        </h1>
        {jobTitle && (
          <p style={{ fontSize: "13px", color: "var(--muted)", margin: 0 }}>{jobTitle}</p>
        )}
      </div>

      {phase === "loading" && (
        <div style={{ ...card, display: "flex", alignItems: "center", justifyContent: "center", gap: "12px", minHeight: "180px", color: "var(--muted)" }}>
          <Loader2 size={20} style={{ animation: "spin 1s linear infinite" }} />
          Cargando…
        </div>
      )}

      {phase === "not_eligible" && (
        <div style={{ ...card, textAlign: "center", padding: "48px 32px" }}>
          <AlertCircle size={40} style={{ color: "var(--muted)", margin: "0 auto 16px" }} />
          <p style={{ fontSize: "15px", fontWeight: 700, color: "var(--ink)", marginBottom: "8px" }}>
            No disponible
          </p>
          <p style={{ fontSize: "13px", color: "var(--muted)", marginBottom: "24px" }}>
            Solo puedes calificar trabajos completados.
          </p>
          <Link href={`/worker/jobs/${jobId}`} style={{ fontSize: "13px", color: "var(--brand)", fontWeight: 600, textDecoration: "none" }}>
            ← Ver trabajo
          </Link>
        </div>
      )}

      {phase === "already_rated" && (
        <div style={{ ...card, textAlign: "center", padding: "48px 32px" }}>
          <CheckCircle size={40} style={{ color: "#10b981", margin: "0 auto 16px" }} />
          <p style={{ fontSize: "15px", fontWeight: 700, color: "var(--ink)", marginBottom: "8px" }}>
            Ya calificaste este trabajo
          </p>
          <p style={{ fontSize: "13px", color: "var(--muted)", marginBottom: "24px" }}>
            Tu calificación ya fue registrada anteriormente.
          </p>
          <Link href="/worker/review" style={{ fontSize: "13px", color: "var(--brand)", fontWeight: 600, textDecoration: "none" }}>
            Ver mis reseñas →
          </Link>
        </div>
      )}

      {phase === "error" && (
        <div style={{ ...card, textAlign: "center", padding: "48px 32px" }}>
          <AlertCircle size={40} style={{ color: "#ef4444", margin: "0 auto 16px" }} />
          <p style={{ fontSize: "15px", fontWeight: 700, color: "var(--ink)", marginBottom: "8px" }}>
            Error
          </p>
          <p style={{ fontSize: "13px", color: "var(--muted)", marginBottom: "24px" }}>{errorMsg}</p>
          <Link href={`/worker/jobs/${jobId}`} style={{ fontSize: "13px", color: "var(--brand)", fontWeight: 600, textDecoration: "none" }}>
            ← Regresar al trabajo
          </Link>
        </div>
      )}

      {phase === "success" && (
        <div style={{ ...card, textAlign: "center", padding: "48px 32px" }}>
          <CheckCircle size={48} style={{ color: "#10b981", margin: "0 auto 20px" }} />
          <p style={{ fontSize: "18px", fontWeight: 800, color: "var(--ink)", marginBottom: "8px" }}>
            ¡Gracias por calificar!
          </p>
          <p style={{ fontSize: "13px", color: "var(--muted)", marginBottom: "20px" }}>
            Tu reseña fortalece la confianza en la comunidad SEMSE.
          </p>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: "4px", marginBottom: "28px" }}>
            {[1, 2, 3, 4, 5].map((n) => (
              <Star key={n} size={22} fill={n <= score ? "#fbbf24" : "none"} color={n <= score ? "#fbbf24" : "var(--border)"} />
            ))}
          </div>
          <div style={{ display: "flex", gap: "12px", justifyContent: "center", flexWrap: "wrap" }}>
            <Link
              href="/worker/review"
              style={{ padding: "8px 20px", borderRadius: "8px", background: "var(--brand)", color: "#fff", fontSize: "13px", fontWeight: 700, textDecoration: "none" }}
            >
              Ver mis reseñas
            </Link>
            <Link
              href="/worker/jobs"
              style={{ padding: "8px 20px", borderRadius: "8px", border: "1px solid var(--border)", color: "var(--ink)", fontSize: "13px", fontWeight: 600, textDecoration: "none" }}
            >
              Mis trabajos
            </Link>
          </div>
        </div>
      )}

      {(phase === "form" || phase === "submitting") && (
        <form onSubmit={handleSubmit}>
          <div style={card}>
            <p style={{ fontSize: "15px", fontWeight: 700, color: "var(--ink)", textAlign: "center", marginBottom: "6px" }}>
              ¿Cómo fue tu experiencia con este cliente?
            </p>
            <p style={{ fontSize: "13px", color: "var(--muted)", textAlign: "center", marginBottom: "28px" }}>
              Comunicación, pagos, claridad del proyecto y respeto por el trabajo.
            </p>

            <StarPicker value={score} onChange={setScore} />

            <div style={{ marginTop: "28px" }}>
              <label style={{ fontSize: "13px", color: "var(--muted)", fontWeight: 600, display: "block", marginBottom: "8px" }}>
                Comentario (opcional)
              </label>
              <textarea
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                maxLength={500}
                rows={4}
                placeholder="¿Hubo claridad en los requisitos? ¿El cliente fue puntual en sus pagos y comunicación?"
                style={{
                  width: "100%",
                  padding: "12px",
                  borderRadius: "10px",
                  border: "1px solid var(--border)",
                  background: "var(--bg)",
                  color: "var(--ink)",
                  fontSize: "13px",
                  resize: "vertical",
                  outline: "none",
                  boxSizing: "border-box",
                }}
              />
              <p style={{ fontSize: "11px", color: "var(--faint)", textAlign: "right", marginTop: "4px" }}>
                {comment.length}/500
              </p>
            </div>

            <div style={{ display: "flex", gap: "12px", marginTop: "24px", alignItems: "center" }}>
              <Link
                href={`/worker/jobs/${jobId}`}
                style={{ display: "flex", alignItems: "center", gap: "6px", fontSize: "13px", color: "var(--muted)", textDecoration: "none", flexShrink: 0 }}
              >
                <ArrowLeft size={14} />
                Atrás
              </Link>
              <button
                type="submit"
                disabled={score < 1 || isLoading}
                style={{
                  flex: 1,
                  padding: "12px",
                  borderRadius: "10px",
                  border: "none",
                  background: score >= 1 ? "var(--brand)" : "var(--raised)",
                  color: score >= 1 ? "#fff" : "var(--faint)",
                  fontSize: "14px",
                  fontWeight: 700,
                  cursor: score >= 1 && !isLoading ? "pointer" : "not-allowed",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: "8px",
                  transition: "background 0.2s",
                }}
              >
                {isLoading ? (
                  <>
                    <Loader2 size={16} style={{ animation: "spin 1s linear infinite" }} />
                    Enviando…
                  </>
                ) : (
                  "Enviar calificación"
                )}
              </button>
            </div>
          </div>
        </form>
      )}
    </div>
  );
}
