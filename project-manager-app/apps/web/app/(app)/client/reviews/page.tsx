"use client";

import { useEffect, useMemo, useState } from "react";
import { Star, ChevronDown, MessageSquare, Inbox } from "lucide-react";
import { HtmlInCanvasPanel } from "@semse/ui";
import { ClientPageHeader } from "../../../components/client/ClientPageHeader";
import { fetchRatings, type RatingListItem } from "../../../semse-api";
import { NotificationBanner } from "../../../components/notifications/NotificationBanner";

type ReviewRow = {
  id: string;
  counterpartName: string;
  jobTitle: string;
  rating: number;
  comment?: string;
  dateLabel: string;
  dateRaw: string;
  direction: "given" | "received";
};

function StarRating({ rating, size = 14 }: { rating: number; size?: number }) {
  return (
    <div style={{ display: "flex", gap: "2px" }}>
      {[1, 2, 3, 4, 5].map((i) => (
        <Star key={i} size={size} fill={i <= rating ? "#fbbf24" : "none"} color={i <= rating ? "#fbbf24" : "var(--border)"} />
      ))}
    </div>
  );
}

function displayNameFromEmail(email?: string) {
  if (!email) return "Usuario";
  const local = email.split("@")[0] ?? email;
  return local
    .split(/[._-]/g)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function formatDate(value: string | Date) {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return String(value);
  return parsed.toLocaleDateString("es-MX", { day: "2-digit", month: "short", year: "numeric" });
}

function normalizeDateRaw(value: string | Date) {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return String(value);
  return parsed.toISOString();
}

function toReviewRows(input: { actorUserId: string | null; items: RatingListItem[] }): ReviewRow[] {
  return input.items
    .map((item) => {
      const actorIsAuthor = input.actorUserId !== null && item.fromUser.id === input.actorUserId;
      const counterpart = actorIsAuthor ? item.toUser : item.fromUser;
      return {
        id: item.id,
        counterpartName: displayNameFromEmail(counterpart.email),
        jobTitle: item.job.title,
        rating: item.score,
        comment: item.comment,
        dateLabel: formatDate(item.createdAt),
        dateRaw: normalizeDateRaw(item.createdAt),
        direction: actorIsAuthor ? "given" : "received",
      } satisfies ReviewRow;
    });
}

export default function ClientReviewsPage() {
  const [tab, setTab] = useState<"given" | "received">("given");
  const [sortBy, setSortBy] = useState<"recent" | "rating">("recent");
  const [reviews, setReviews] = useState<ReviewRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const payload = await fetchRatings();
        setReviews(toReviewRows(payload));
      } catch (caught) {
        setError(caught instanceof Error ? caught.message : "No se pudieron cargar las reseñas.");
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const givenReviews = useMemo(
    () => reviews.filter((item) => item.direction === "given"),
    [reviews]
  );
  const receivedReviews = useMemo(
    () => reviews.filter((item) => item.direction === "received"),
    [reviews]
  );
  const activeReviews = tab === "given" ? givenReviews : receivedReviews;
  const sorted = useMemo(
    () =>
      [...activeReviews].sort((a, b) =>
        sortBy === "rating" ? b.rating - a.rating : new Date(b.dateRaw).getTime() - new Date(a.dateRaw).getTime()
      ),
    [activeReviews, sortBy]
  );
  const avg = activeReviews.length > 0 ? activeReviews.reduce((sum, item) => sum + item.rating, 0) / activeReviews.length : 0;
  const subtitle = tab === "given"
    ? "Calificaciones que dejaste a profesionales después de cerrar trabajos."
    : "Calificaciones que otros actores te dejaron a ti dentro del flujo real.";

  const card: React.CSSProperties = {
    background: "var(--surface)",
    border: "1px solid var(--border)",
    borderRadius: "12px",
    padding: "18px",
  };

  return (
    <div style={{ maxWidth: "800px", margin: "0 auto" }}>
      <ClientPageHeader
        title="Reseñas"
        subtitle={subtitle}
        breadcrumbs={[{ label: "Reseñas" }]}
        minHeight={82}
        actions={<NotificationBanner audience="client" />}
      />

      {loading ? (
        <div style={{ display: "grid", gap: "10px" }}>
          {[1, 2, 3].map((item) => (
            <div key={item} style={{ height: "110px", borderRadius: "14px", background: "var(--raised)", animation: "pulse 1.5s ease-in-out infinite" }} />
          ))}
        </div>
      ) : error ? (
        <HtmlInCanvasPanel as="section" style={{ ...card, color: "#ef4444", background: "rgba(239,68,68,.06)", borderColor: "rgba(239,68,68,.2)" }} canvasClassName="rounded-2xl" minHeight={90}>
          {error}
        </HtmlInCanvasPanel>
      ) : reviews.length === 0 ? (
        <HtmlInCanvasPanel as="section" style={{ ...card, textAlign: "center", padding: "42px 24px" }} canvasClassName="rounded-2xl" minHeight={180}>
          <Inbox size={34} style={{ color: "var(--faint)", margin: "0 auto 12px" }} />
          <p style={{ fontSize: "14px", fontWeight: 700, color: "var(--ink)" }}>Aún no hay reseñas reales en tu historial</p>
          <p style={{ fontSize: "13px", color: "var(--muted)", marginTop: "4px" }}>
            Cuando cierres trabajos y existan calificaciones entre actores, aparecerán aquí.
          </p>
        </HtmlInCanvasPanel>
      ) : (
        <>
          <HtmlInCanvasPanel as="section" style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "12px", padding: "10px 12px", marginBottom: "16px", flexWrap: "wrap" }} canvasClassName="rounded-2xl" minHeight={58}>
            <div style={{ display: "flex", gap: "4px", background: "var(--surface)", padding: "4px", borderRadius: "10px", border: "1px solid var(--border)" }}>
              {[
                { key: "given" as const, label: "Emitidas", count: givenReviews.length },
                { key: "received" as const, label: "Recibidas", count: receivedReviews.length },
              ].map((item) => (
                <button
                  key={item.key}
                  onClick={() => setTab(item.key)}
                  style={{
                    padding: "6px 12px",
                    borderRadius: "7px",
                    border: "none",
                    background: tab === item.key ? "var(--brand)" : "transparent",
                    color: tab === item.key ? "#fff" : "var(--muted)",
                    fontSize: "12px",
                    fontWeight: 700,
                    cursor: "pointer",
                    display: "inline-flex",
                    alignItems: "center",
                    gap: "6px",
                  }}
                >
                  {item.label}
                  <span style={{ fontSize: "10px", fontWeight: 800, padding: "1px 6px", borderRadius: "999px", background: tab === item.key ? "rgba(255,255,255,.22)" : "var(--bg)", color: tab === item.key ? "#fff" : "var(--ink)" }}>
                    {item.count}
                  </span>
                </button>
              ))}
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: "8px", color: "var(--muted)", fontSize: "12px" }}>
              <MessageSquare size={14} />
              {tab === "given" ? "Lo que tú calificaste" : "Lo que te calificaron a ti"}
            </div>
          </HtmlInCanvasPanel>

          {activeReviews.length === 0 ? (
            <HtmlInCanvasPanel as="section" style={{ ...card, textAlign: "center", padding: "42px 24px", marginBottom: "18px" }} canvasClassName="rounded-2xl" minHeight={180}>
              <Inbox size={34} style={{ color: "var(--faint)", margin: "0 auto 12px" }} />
              <p style={{ fontSize: "14px", fontWeight: 700, color: "var(--ink)" }}>
                {tab === "given" ? "Aún no has emitido reseñas" : "Aún no has recibido reseñas"}
              </p>
              <p style={{ fontSize: "13px", color: "var(--muted)", marginTop: "4px" }}>
                {tab === "given"
                  ? "Cuando cierres trabajos y califiques profesionales, aparecerán aquí."
                  : "Cuando otros actores completen una calificación sobre tu trabajo, aparecerán aquí."}
              </p>
            </HtmlInCanvasPanel>
          ) : (
            <>
          <div style={{ display: "grid", gridTemplateColumns: "auto 1fr", gap: "16px", marginBottom: "20px" }}>
            <HtmlInCanvasPanel as="div" style={{ ...card, textAlign: "center", padding: "24px 32px" }} canvasClassName="rounded-2xl" minHeight={110}>
              <p style={{ fontSize: "42px", fontWeight: 900, color: "var(--ink)", lineHeight: 1 }}>{avg.toFixed(1)}</p>
              <StarRating rating={Math.round(avg)} size={16} />
              <p style={{ fontSize: "11px", color: "var(--muted)", marginTop: "6px" }}>
                {activeReviews.length} reseña{activeReviews.length === 1 ? "" : "s"} {tab === "given" ? "emitida" : "recibida"}{activeReviews.length === 1 ? "" : "s"}
              </p>
            </HtmlInCanvasPanel>
            <HtmlInCanvasPanel as="div" style={{ ...card, display: "flex", flexDirection: "column", justifyContent: "center", gap: "8px" }} canvasClassName="rounded-2xl" minHeight={110}>
              {[5, 4, 3, 2, 1].map((star) => {
                const count = activeReviews.filter((item) => item.rating === star).length;
                const pct = activeReviews.length > 0 ? Math.round((count / activeReviews.length) * 100) : 0;
                return (
                  <div key={star} style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                    <span style={{ fontSize: "12px", color: "var(--muted)", width: "20px", textAlign: "right" }}>{star}</span>
                    <Star size={12} fill="#fbbf24" color="#fbbf24" />
                    <div style={{ flex: 1, height: "6px", borderRadius: "3px", background: "var(--bg)", overflow: "hidden" }}>
                      <div style={{ width: `${pct}%`, height: "100%", background: "#fbbf24", borderRadius: "3px" }} />
                    </div>
                    <span style={{ fontSize: "11px", color: "var(--muted)", width: "28px" }}>{count}</span>
                  </div>
                );
              })}
            </HtmlInCanvasPanel>
          </div>

          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "12px", gap: "12px", flexWrap: "wrap" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "8px", color: "var(--muted)", fontSize: "12px" }}>
              <MessageSquare size={14} />
              {tab === "given" ? "Comentarios y score que dejaste a profesionales" : "Comentarios y score que otros actores dejaron sobre ti"}
            </div>
            <div style={{ position: "relative" }}>
              <select value={sortBy} onChange={(e) => setSortBy(e.target.value as typeof sortBy)} style={{ padding: "7px 28px 7px 12px", borderRadius: "8px", border: "1px solid var(--border)", background: "var(--surface)", color: "var(--ink)", fontSize: "12px", appearance: "none", outline: "none", cursor: "pointer" }}>
                <option value="recent">Más recientes</option>
                <option value="rating">Mayor calificación</option>
              </select>
              <ChevronDown size={12} style={{ position: "absolute", right: "8px", top: "50%", transform: "translateY(-50%)", color: "var(--muted)", pointerEvents: "none" }} />
            </div>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
            {sorted.map((review) => (
              <HtmlInCanvasPanel key={review.id} as="div" style={card} canvasClassName="rounded-2xl" minHeight={140}>
                <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: "12px", marginBottom: "10px" }}>
                  <div>
                    <p style={{ fontSize: "14px", fontWeight: 700, color: "var(--ink)", marginBottom: "2px" }}>{review.counterpartName}</p>
                    <p style={{ fontSize: "11px", color: "var(--muted)" }}>{review.jobTitle}</p>
                  </div>
                  <div style={{ textAlign: "right", flexShrink: 0 }}>
                    <StarRating rating={review.rating} />
                    <p style={{ fontSize: "11px", color: "var(--faint)", marginTop: "4px" }}>{review.dateLabel}</p>
                  </div>
                </div>
                <p style={{ fontSize: "13px", color: "var(--ink)", lineHeight: 1.6 }}>
                  {review.comment?.trim() ? review.comment : "Sin comentario adicional en esta reseña."}
                </p>
              </HtmlInCanvasPanel>
            ))}
          </div>
            </>
          )}
        </>
      )}
    </div>
  );
}
