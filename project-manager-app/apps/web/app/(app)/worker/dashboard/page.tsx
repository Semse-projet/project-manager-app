"use client";

import { useEffect, useMemo, useState } from "react";
import type { ElementType } from "react";
import Link from "next/link";
import {
  AlertTriangle,
  ArrowRight,
  Briefcase,
  Camera,
  CheckSquare,
  Clock,
  DollarSign,
  Package,
  Search,
  Star,
  Wallet,
  Wrench,
} from "lucide-react";
import { HtmlInCanvasPanel, JobCard, StatCard } from "@semse/ui";
import { NotificationBanner } from "../../../components/notifications/NotificationBanner";
import { WorkerEvidenceSummary } from "../../../../components/semse/WorkerEvidenceSummary";
import type { Job, JobRecordView } from "@semse/schemas";
import { useLanguage } from "../../../../lib/language-context";
import { fetchRatings, fetchMyBids, type RatingListItem, type MyBidView } from "../../../semse-api";

function formatMoney(value: number) {
  return new Intl.NumberFormat("es-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(value);
}

function toUiJob(record: JobRecordView): Job {
  return {
    id: record.id,
    title: record.title,
    description: record.scope,
    scope: record.scope,
    budget: {
      min: record.budgetMin ?? record.budgetMax ?? 0,
      max: record.budgetMax,
      type: record.budgetMax ? "range" : "fixed",
    },
    location: {
      type: "remote",
    },
    status: record.status === "published" || record.status === "awarded" ? "posted" : record.status,
    clientId: record.tenantId,
    tenantId: record.tenantId,
    createdAt: new Date(),
    attachments: [],
    proposals: [],
  };
}

function bidToUiJob(bid: MyBidView): Job {
  return {
    id: bid.jobId,
    title: bid.jobTitle,
    description: bid.jobCategory ?? "",
    scope: bid.jobCategory ?? "",
    budget: {
      min: bid.amount,
      max: undefined,
      type: "fixed" as const,
    },
    location: { type: "remote" as const },
    status: (bid.jobStatus === "published" || bid.jobStatus === "awarded" ? "posted" : bid.jobStatus) as Job["status"],
    clientId: "",
    tenantId: "",
    createdAt: new Date(),
    attachments: [],
    proposals: [],
  };
}

function EmptyPanel({
  title,
  description,
  icon: Icon,
}: {
  title: string;
  description: string;
  icon: ElementType;
}) {
  return (
    <div
      style={{
        padding: "40px 24px",
        textAlign: "center",
        background: "var(--surface)",
        border: "1px solid var(--border)",
        borderRadius: "14px",
      }}
    >
      <Icon size={34} style={{ color: "var(--faint)", margin: "0 auto 12px" }} />
      <p style={{ color: "var(--ink)", fontSize: "14px", fontWeight: 700, marginBottom: "6px" }}>{title}</p>
      <p style={{ color: "var(--muted)", fontSize: "13px" }}>{description}</p>
    </div>
  );
}

const TRUST_TIER: Record<string, { label: string; color: string }> = {
  emerging:    { label: "Emergente",    color: "#64748b" },
  growing:     { label: "En crecimiento", color: "#3b82f6" },
  established: { label: "Establecido", color: "#8b5cf6" },
  trusted:     { label: "De confianza", color: "#10b981" },
};

function reputationTier(totalRatings: number, avg: number): string {
  if (totalRatings === 0) return "emerging";
  if (totalRatings < 5 || avg < 3.5) return "emerging";
  if (totalRatings < 10 || avg < 4.0) return "growing";
  if (totalRatings < 25 || avg < 4.5) return "established";
  return "trusted";
}

export default function WorkerDashboardPage() {
  const { t } = useLanguage();
  const [jobs, setJobs] = useState<JobRecordView[]>([]);
  const [loading, setLoading] = useState(true);
  const [apiError, setApiError] = useState<string | null>(null);
  const [receivedRatings, setReceivedRatings] = useState<RatingListItem[]>([]);
  const [myBids, setMyBids] = useState<MyBidView[]>([]);

  useEffect(() => {
    void Promise.all([
      fetch("/api/semse/jobs")
        .then((r) => r.json())
        .then((payload: { data?: JobRecordView[]; error?: { message: string } }) => {
          if (payload.error) { setApiError(payload.error.message); return; }
          setJobs(payload.data ?? []);
        })
        .catch(() => setApiError("No se pudo conectar con el servidor")),
      fetchRatings()
        .then(({ actorUserId, items }) => {
          setReceivedRatings(items.filter((r) => r.toUser.id === actorUserId));
        })
        .catch(() => undefined),
      fetchMyBids().then(setMyBids).catch(() => undefined),
    ]).finally(() => setLoading(false));
  }, []);

  const metrics = useMemo(() => {
    const acceptedBids = myBids.filter((b) => b.status === "accepted");
    const active = acceptedBids.filter((b) => ["in_progress", "reserved", "accepted", "review"].includes(b.jobStatus));
    const completed = acceptedBids.filter((b) => b.jobStatus === "completed");
    const review = acceptedBids.filter((b) => b.jobStatus === "review");
    const disputes = acceptedBids.filter((b) => b.jobStatus === "dispute");
    const opportunities = jobs.filter((job) => ["posted", "published"].includes(job.status));
    const activeBudget = active.reduce((total, b) => total + (b.amount ?? 0), 0);
    const completionRate = acceptedBids.length > 0 ? Math.round((completed.length / acceptedBids.length) * 100) : 0;
    const reviewRate = active.length > 0 ? Math.round((review.length / active.length) * 100) : 0;

    return {
      active,
      completed,
      review,
      disputes,
      opportunities,
      activeBudget,
      completionRate,
      reviewRate,
    };
  }, [myBids, jobs]);

  return (
    <div style={{ maxWidth: "1120px", margin: "0 auto", display: "grid", gap: "28px" }}>
      <HtmlInCanvasPanel
        as="section"
        style={{
          display: "flex",
          alignItems: "flex-start",
          justifyContent: "space-between",
          gap: "16px",
          flexWrap: "wrap",
        }}
        canvasClassName="rounded-2xl"
        minHeight={96}
      >
        <div>
          <h1 style={{ fontSize: "24px", fontWeight: 800, color: "var(--ink)", marginBottom: "4px" }}>Mi Panel</h1>
          <p style={{ color: "var(--muted)", fontSize: "14px" }}>
            Resumen operativo de tus trabajos, revisiones y oportunidades activas.
          </p>
        </div>

        <div style={{ display: "flex", gap: "10px", flexWrap: "wrap", alignItems: "center" }}>
          <NotificationBanner audience="worker" />
          <Link
            href="/worker/jobs"
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "7px",
              padding: "10px 16px",
              borderRadius: "10px",
              border: "1px solid var(--border)",
              color: "var(--ink)",
              textDecoration: "none",
              background: "var(--surface)",
              fontSize: "13px",
              fontWeight: 700,
            }}
          >
            <Briefcase size={15} />
            Ver mis trabajos
          </Link>
          <Link
            href="/worker/evidence"
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "7px",
              padding: "10px 16px",
              borderRadius: "10px",
              color: "#fff",
              textDecoration: "none",
              background: "linear-gradient(135deg, var(--brand), #2563eb)",
              fontSize: "13px",
              fontWeight: 700,
            }}
          >
            <Camera size={15} />
            Subir evidencia
          </Link>
          <Link
            href="/worker/travel"
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "7px",
              padding: "10px 16px",
              borderRadius: "10px",
              border: "1px solid rgba(124,58,237,.22)",
              color: "#c4b5fd",
              textDecoration: "none",
              background: "rgba(124,58,237,.1)",
              fontSize: "13px",
              fontWeight: 700,
            }}
          >
            <Wallet size={15} />
            Movilidad y estancia
          </Link>
          <Link
            href="/worker/disputes?status=open"
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "7px",
              padding: "10px 16px",
              borderRadius: "10px",
              border: "1px solid rgba(239,68,68,.22)",
              color: "#ef4444",
              textDecoration: "none",
              background: "rgba(239,68,68,.08)",
              fontSize: "13px",
              fontWeight: 700,
            }}
          >
            <AlertTriangle size={15} />
            Ver disputas
          </Link>
        </div>
      </HtmlInCanvasPanel>

      {/* Evidence pending summary */}
      <WorkerEvidenceSummary />

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))", gap: "12px" }}>
        <Link href="/worker/jobs?tab=Activos" style={{ textDecoration: "none", display: "block", borderRadius: "16px", transition: "transform .12s, box-shadow .12s" }} onMouseOver={e => { e.currentTarget.style.transform = "translateY(-2px)"; e.currentTarget.style.boxShadow = "0 6px 20px rgba(59,130,246,.18)"; }} onMouseOut={e => { e.currentTarget.style.transform = ""; e.currentTarget.style.boxShadow = ""; }}>
          <StatCard label="Trabajos activos" value={loading ? "—" : metrics.active.length} icon={Briefcase} color="blue" loading={loading} />
        </Link>
        <Link href="/worker/jobs?tab=Completados" style={{ textDecoration: "none", display: "block", borderRadius: "16px", transition: "transform .12s, box-shadow .12s" }} onMouseOver={e => { e.currentTarget.style.transform = "translateY(-2px)"; e.currentTarget.style.boxShadow = "0 6px 20px rgba(16,185,129,.18)"; }} onMouseOut={e => { e.currentTarget.style.transform = ""; e.currentTarget.style.boxShadow = ""; }}>
          <StatCard label="Completados" value={loading ? "—" : metrics.completed.length} icon={CheckSquare} color="green" loading={loading} />
        </Link>
        <Link href="/worker/jobs?tab=Activos" style={{ textDecoration: "none", display: "block", borderRadius: "16px", transition: "transform .12s, box-shadow .12s" }} onMouseOver={e => { e.currentTarget.style.transform = "translateY(-2px)"; e.currentTarget.style.boxShadow = "0 6px 20px rgba(245,158,11,.18)"; }} onMouseOut={e => { e.currentTarget.style.transform = ""; e.currentTarget.style.boxShadow = ""; }}>
          <StatCard label="En revisión" value={loading ? "—" : metrics.review.length} icon={Star} color="amber" loading={loading} />
        </Link>
        <Link href="/worker/disputes?status=open" style={{ textDecoration: "none", display: "block", borderRadius: "16px", transition: "transform .12s, box-shadow .12s" }} onMouseOver={e => { e.currentTarget.style.transform = "translateY(-2px)"; e.currentTarget.style.boxShadow = "0 6px 20px rgba(239,68,68,.18)"; }} onMouseOut={e => { e.currentTarget.style.transform = ""; e.currentTarget.style.boxShadow = ""; }}>
          <StatCard label="Disputas abiertas" value={loading ? "—" : metrics.disputes.length} icon={AlertTriangle} color="red" loading={loading} />
        </Link>
        <Link href="/worker/payments" style={{ textDecoration: "none", display: "block", borderRadius: "16px", transition: "transform .12s, box-shadow .12s" }} onMouseOver={e => { e.currentTarget.style.transform = "translateY(-2px)"; e.currentTarget.style.boxShadow = "0 6px 20px rgba(255,106,0,.18)"; }} onMouseOut={e => { e.currentTarget.style.transform = ""; e.currentTarget.style.boxShadow = ""; }}>
          <StatCard label="Presupuesto activo" value={loading ? "—" : metrics.activeBudget > 0 ? formatMoney(metrics.activeBudget) : "—"} icon={DollarSign} color="orange" loading={loading} />
        </Link>
        <Link href="/worker/travel" style={{ textDecoration: "none", display: "block", borderRadius: "16px", transition: "transform .12s, box-shadow .12s" }} onMouseOver={e => { e.currentTarget.style.transform = "translateY(-2px)"; e.currentTarget.style.boxShadow = "0 6px 20px rgba(139,92,246,.18)"; }} onMouseOut={e => { e.currentTarget.style.transform = ""; e.currentTarget.style.boxShadow = ""; }}>
          <StatCard label="Viajes y viáticos" value={loading ? "—" : "Abrir"} icon={Wallet} color="violet" loading={loading} />
        </Link>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))", gap: "16px" }}>
        <HtmlInCanvasPanel
          as="section"
          style={{
            background: "var(--surface)",
            border: "1px solid var(--border)",
            borderRadius: "16px",
            padding: "18px",
          }}
          canvasClassName="rounded-2xl"
          minHeight={260}
        >
          <div style={{ marginBottom: "14px" }}>
            <h2 style={{ fontSize: "15px", fontWeight: 700, color: "var(--ink)" }}>Resumen operativo</h2>
            <p style={{ fontSize: "12px", color: "var(--muted)", marginTop: "4px" }}>
              Lectura rápida de tu cartera activa y del estado del pipeline.
            </p>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: "10px" }}>
            {[
              {
                label: "Oportunidades abiertas",
                value: metrics.opportunities.length,
                tone: "rgba(59,130,246,.12)",
                color: "#60a5fa",
              },
              {
                label: "Aceptados o reservados",
                value: metrics.active.filter((job) => ["accepted", "reserved"].includes(job.status)).length,
                tone: "rgba(16,185,129,.12)",
                color: "#34d399",
              },
              {
                label: "Tasa de cierre",
                value: `${metrics.completionRate}%`,
                tone: "rgba(249,115,22,.12)",
                color: "#fb923c",
              },
              {
                label: "Carga en revisión",
                value: `${metrics.reviewRate}%`,
                tone: "rgba(245,158,11,.12)",
                color: "#fbbf24",
              },
            ].map((item) => (
              <div
                key={item.label}
                style={{
                  borderRadius: "12px",
                  padding: "14px",
                  background: item.tone,
                  border: "1px solid color-mix(in srgb, white 10%, transparent)",
                }}
              >
                <p style={{ fontSize: "11px", textTransform: "uppercase", letterSpacing: "0.08em", color: "var(--muted)" }}>
                  {item.label}
                </p>
                <p style={{ fontSize: "24px", fontWeight: 800, color: item.color, marginTop: "8px" }}>{item.value}</p>
              </div>
            ))}
          </div>
        </HtmlInCanvasPanel>

        <HtmlInCanvasPanel
          as="section"
          style={{
            background: "var(--surface)",
            border: "1px solid var(--border)",
            borderRadius: "16px",
            padding: "18px",
          }}
          canvasClassName="rounded-2xl"
          minHeight={260}
        >
          <div style={{ marginBottom: "14px" }}>
            <h2 style={{ fontSize: "15px", fontWeight: 700, color: "var(--ink)" }}>Acciones rápidas</h2>
            <p style={{ fontSize: "12px", color: "var(--muted)", marginTop: "4px" }}>
              Accesos directos para la ejecución diaria del profesional.
            </p>
          </div>

          <div style={{ display: "grid", gap: "10px" }}>
            {[
              { href: "/worker/tracker", label: "Registrar horas", description: "Abrir control de jornada", icon: Clock, color: "#06b6d4" },
              { href: "/worker/evidence", label: "Subir evidencia", description: "Enviar fotos y documentos", icon: Camera, color: "#10b981" },
              { href: "/worker/materials", label: "Materiales", description: "Solicitar o rastrear materiales", icon: Package, color: "#f59e0b" },
              { href: "/worker/incidents", label: "Incidencias", description: "Reportar un problema en campo", icon: AlertTriangle, color: "#ef4444" },
              { href: "/worker/payments", label: "Ver mis pagos", description: "Revisar escrow y liberaciones", icon: Wallet, color: "#ff6a00" },
              { href: "/worker/field-ops", label: t("nav.fieldOps"), description: t("dash.fieldOpsDesc"), icon: Wrench, color: "#a78bfa" },
              { href: "/worker/review", label: "Calificar clientes", description: "Enviar reseñas de trabajos completados", icon: Star, color: "#fbbf24" },
              { href: "/worker/opportunities", label: "Ver oportunidades", description: "Trabajos disponibles — envía propuestas", icon: Briefcase, color: "#6366f1" },
            ].map((action) => {
              const Icon = action.icon;
              return (
                <Link
                  key={action.href}
                  href={action.href}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "12px",
                    padding: "14px",
                    borderRadius: "12px",
                    border: "1px solid var(--border)",
                    background: "#0d1220",
                    textDecoration: "none",
                    color: "var(--ink)",
                  }}
                >
                  <div
                    style={{
                      width: "36px",
                      height: "36px",
                      borderRadius: "10px",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      background: `${action.color}18`,
                      color: action.color,
                      flexShrink: 0,
                    }}
                  >
                    <Icon size={16} />
                  </div>
                  <div style={{ flex: 1 }}>
                    <p style={{ fontSize: "13px", fontWeight: 700, color: "var(--ink)" }}>{action.label}</p>
                    <p style={{ fontSize: "12px", color: "var(--muted)" }}>{action.description}</p>
                  </div>
                  <ArrowRight size={14} style={{ color: "var(--muted)", flexShrink: 0 }} />
                </Link>
              );
            })}
          </div>
        </HtmlInCanvasPanel>
      </div>

      {/* Reputation widget */}
      {!loading && (() => {
        const avgScore = receivedRatings.length > 0
          ? receivedRatings.reduce((s, r) => s + r.score, 0) / receivedRatings.length
          : 0;
        const tier = reputationTier(receivedRatings.length, avgScore);
        const tierMeta = TRUST_TIER[tier] ?? TRUST_TIER.emerging!;
        return (
          <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: "16px", padding: "18px 20px" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "12px", marginBottom: "14px", flexWrap: "wrap" }}>
              <div>
                <h2 style={{ fontSize: "15px", fontWeight: 700, color: "var(--ink)" }}>Mi reputación</h2>
                <p style={{ fontSize: "12px", color: "var(--muted)", marginTop: "2px" }}>Basada en calificaciones recibidas de clientes.</p>
              </div>
              <Link href="/worker/review" style={{ fontSize: "12px", color: "var(--brand)", fontWeight: 700, textDecoration: "none", display: "inline-flex", alignItems: "center", gap: "4px" }}>
                Ver reseñas <ArrowRight size={13} />
              </Link>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(130px, 1fr))", gap: "10px" }}>
              <div style={{ background: "var(--raised)", borderRadius: "12px", padding: "14px 12px", textAlign: "center" }}>
                <div style={{ display: "flex", gap: "2px", justifyContent: "center", marginBottom: "6px" }}>
                  {[1,2,3,4,5].map((n) => (
                    <Star key={n} size={14} fill={n <= Math.round(avgScore) ? "#fbbf24" : "none"} color={n <= Math.round(avgScore) ? "#fbbf24" : "var(--border)"} />
                  ))}
                </div>
                <p style={{ fontSize: "20px", fontWeight: 800, color: "var(--ink)", margin: "0 0 2px" }}>
                  {receivedRatings.length === 0 ? "—" : avgScore.toFixed(1)}
                </p>
                <p style={{ fontSize: "11px", color: "var(--muted)" }}>Promedio</p>
              </div>
              <div style={{ background: "var(--raised)", borderRadius: "12px", padding: "14px 12px", textAlign: "center" }}>
                <p style={{ fontSize: "20px", fontWeight: 800, color: "var(--ink)", margin: "0 0 2px" }}>{receivedRatings.length}</p>
                <p style={{ fontSize: "11px", color: "var(--muted)" }}>Reseñas recibidas</p>
              </div>
              <div style={{ background: "var(--raised)", borderRadius: "12px", padding: "14px 12px", textAlign: "center" }}>
                <span style={{ display: "inline-block", padding: "3px 10px", borderRadius: 99, fontSize: "11px", fontWeight: 700, background: `${tierMeta.color}22`, color: tierMeta.color, border: `1px solid ${tierMeta.color}44`, marginBottom: "6px" }}>
                  {tierMeta.label}
                </span>
                <p style={{ fontSize: "11px", color: "var(--muted)" }}>Nivel de confianza</p>
              </div>
            </div>
          </div>
        );
      })()}

      {/* Mis propuestas */}
      {!loading && myBids.length > 0 && (
        <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: "16px", padding: "18px 20px" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "12px", marginBottom: "14px", flexWrap: "wrap" }}>
            <div>
              <h2 style={{ fontSize: "15px", fontWeight: 700, color: "var(--ink)" }}>Mis propuestas</h2>
              <p style={{ fontSize: "12px", color: "var(--muted)", marginTop: "2px" }}>Últimas propuestas enviadas.</p>
            </div>
            <Link href="/worker/opportunities" style={{ fontSize: "12px", color: "var(--brand)", fontWeight: 700, textDecoration: "none", display: "inline-flex", alignItems: "center", gap: "4px" }}>
              Ver oportunidades <ArrowRight size={13} />
            </Link>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {myBids.slice(0, 5).map(bid => {
              const BID_STATUS: Record<string, { label: string; color: string; bg: string }> = {
                submitted: { label: "Enviada",   color: "#3b82f6", bg: "rgba(59,130,246,.1)" },
                accepted:  { label: "Aceptada",  color: "#10b981", bg: "rgba(16,185,129,.1)" },
                rejected:  { label: "Rechazada", color: "#ef4444", bg: "rgba(239,68,68,.1)"  },
              };
              const s = BID_STATUS[bid.status] ?? BID_STATUS["submitted"]!;
              const amt = new Intl.NumberFormat("es-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(bid.amount);
              return (
                <div key={bid.id} style={{ display: "flex", alignItems: "center", gap: 12, padding: "10px 14px", background: "var(--raised)", borderRadius: 10 }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{ fontSize: 13, fontWeight: 700, color: "var(--ink)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{bid.jobTitle}</p>
                    <p style={{ fontSize: 11, color: "var(--muted)" }}>{amt} · {bid.etaDays} días</p>
                  </div>
                  <span style={{ fontSize: 11, fontWeight: 700, padding: "2px 8px", borderRadius: 999, background: s.bg, color: s.color, whiteSpace: "nowrap" }}>{s.label}</span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      <section>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: "12px",
            marginBottom: "14px",
            flexWrap: "wrap",
          }}
        >
          <div>
            <h2 style={{ fontSize: "15px", fontWeight: 700, color: "var(--ink)" }}>Trabajos en curso</h2>
            <p style={{ fontSize: "12px", color: "var(--muted)", marginTop: "4px" }}>
              Base activa de ejecución para el profesional.
            </p>
          </div>
          <Link
            href="/worker/jobs"
            style={{ display: "inline-flex", alignItems: "center", gap: "5px", fontSize: "12px", color: "var(--brand)", textDecoration: "none", fontWeight: 700 }}
          >
            Ver todos <ArrowRight size={13} />
          </Link>
        </div>

        {loading ? (
          <div style={{ display: "grid", gap: "12px", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))" }}>
            {[1, 2, 3].map((item) => (
              <div key={item} style={{ height: "190px", borderRadius: "16px", background: "var(--raised)", animation: "pulse 1.5s ease-in-out infinite" }} />
            ))}
          </div>
        ) : apiError ? (
          <div style={{ padding: "16px", background: "rgba(239,68,68,.06)", border: "1px solid rgba(239,68,68,.2)", borderRadius: "10px", color: "#ef4444", fontSize: "13px" }}>
            {apiError}
          </div>
        ) : metrics.active.length === 0 ? (
          <div style={{ textAlign: "center", padding: "32px 24px", borderRadius: "16px", border: "1px solid var(--border)", background: "var(--surface)" }}>
            <Briefcase size={32} style={{ color: "var(--faint)", margin: "0 auto 14px", display: "block" }} />
            <p style={{ fontSize: "14px", fontWeight: 700, color: "var(--ink)", marginBottom: 8 }}>No tienes trabajos activos</p>
            <p style={{ fontSize: "13px", color: "var(--muted)", marginBottom: 20 }}>
              Explora las oportunidades disponibles y envía propuestas para comenzar.
            </p>
            <Link
              href="/worker/opportunities"
              style={{ display: "inline-flex", alignItems: "center", gap: "8px", padding: "10px 22px", borderRadius: "9px", background: "var(--brand)", textDecoration: "none", color: "#fff", fontSize: "13px", fontWeight: 700 }}
            >
              Ver oportunidades →
            </Link>
          </div>
        ) : (
          <div style={{ display: "grid", gap: "12px", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))" }}>
            {metrics.active.slice(0, 4).map((bid) => (
              <Link key={bid.id} href={`/worker/jobs/${bid.jobId}`} style={{ textDecoration: "none" }}>
                <JobCard
                  job={bidToUiJob(bid)}
                  compact
                  footer={
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "10px" }}>
                      <span style={{ fontSize: "12px", color: "var(--muted)" }}>Abrir detalle operativo</span>
                      <span style={{ display: "inline-flex", alignItems: "center", gap: "5px", color: "var(--brand)", fontSize: "12px", fontWeight: 700 }}>
                        Ver trabajo <ArrowRight size={12} />
                      </span>
                    </div>
                  }
                />
              </Link>
            ))}
          </div>
        )}
      </section>

      <section>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: "12px",
            marginBottom: "14px",
            flexWrap: "wrap",
          }}
        >
          <div>
            <h2 style={{ fontSize: "15px", fontWeight: 700, color: "var(--ink)" }}>Oportunidades abiertas</h2>
            <p style={{ fontSize: "12px", color: "var(--muted)", marginTop: "4px" }}>
              Trabajos publicados que pueden alimentar tu siguiente ciclo.
            </p>
          </div>
          <Link
            href="/worker/jobs"
            style={{ display: "inline-flex", alignItems: "center", gap: "5px", fontSize: "12px", color: "var(--brand)", textDecoration: "none", fontWeight: 700 }}
          >
            Explorar <Search size={13} />
          </Link>
        </div>

        {loading ? null : metrics.opportunities.length === 0 ? (
          <EmptyPanel
            title="No hay oportunidades abiertas ahora"
            description="Cuando entren trabajos publicados al pipeline, aparecerán aquí para evaluación."
            icon={Search}
          />
        ) : (
          <div style={{ display: "grid", gap: "12px", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))" }}>
            {metrics.opportunities.slice(0, 3).map((job) => (
              <Link key={job.id} href={`/worker/jobs/${job.id}`} style={{ textDecoration: "none" }}>
                <JobCard job={toUiJob(job)} compact />
              </Link>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
