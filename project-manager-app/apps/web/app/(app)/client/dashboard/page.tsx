"use client";

/**
 * Client Dashboard — Vista principal del cliente
 * Basado en ClientDashboard del SEMSE OS
 * Conectado al API real via semse-api.ts
 */

import { useEffect, useState } from "react";
import { Briefcase, DollarSign, CheckSquare, AlertTriangle, Plus, ArrowRight, FolderKanban, Users } from "lucide-react";
import Link from "next/link";
import { HtmlInCanvasPanel } from "@semse/ui";
import type { JobRecordView } from "@semse/schemas";
import { ClientPageHeader } from "../../../components/client/ClientPageHeader";
import { ClientSummaryCardLink } from "../../../components/client/ClientSummaryCardLink";
import { NotificationBanner } from "../../../components/notifications/NotificationBanner";
import { CLIENT_ROUTES, clientDisputesHref, clientJobsHref, clientPaymentsHref } from "../../../lib/client-routes";

// ─────────────────────────────────────────────────────────────
// COMPONENTE
// ─────────────────────────────────────────────────────────────

const STATUS_CONFIG: Record<string, { label: string; color: string; bg: string }> = {
  draft:       { label: "Borrador",    color: "#64748b", bg: "rgba(100,116,139,.12)" },
  posted:      { label: "Publicado",   color: "#3b82f6", bg: "rgba(59,130,246,.12)" },
  reserved:    { label: "Reservado",   color: "#f59e0b", bg: "rgba(245,158,11,.12)" },
  accepted:    { label: "Aceptado",    color: "#8b5cf6", bg: "rgba(139,92,246,.12)" },
  in_progress: { label: "En progreso", color: "#06b6d4", bg: "rgba(6,182,212,.12)" },
  review:      { label: "En revisión", color: "#f59e0b", bg: "rgba(245,158,11,.12)" },
  dispute:     { label: "En disputa",  color: "#ef4444", bg: "rgba(239,68,68,.12)" },
  completed:   { label: "Completado",  color: "#10b981", bg: "rgba(16,185,129,.12)" },
  cancelled:   { label: "Cancelado",   color: "#64748b", bg: "rgba(100,116,139,.12)" },
};

function formatBudget(min?: number, max?: number): string {
  const fmt = (n: number) => new Intl.NumberFormat("es-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(n);
  if (!min && !max) return "—";
  if (min && max) return `${fmt(min)} – ${fmt(max)}`;
  return fmt(min ?? max ?? 0);
}

function preferredProfessionalLabel(job: JobRecordView): string | null {
  return job.preferredProfessional?.displayName?.trim() || null;
}

export default function ClientDashboardPage() {
  const [jobs, setJobs]   = useState<JobRecordView[]>([]);
  const [loading, setLoading] = useState(true);
  const [apiError, setApiError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/semse/jobs")
      .then(r => r.json())
      .then((d: { data?: JobRecordView[]; error?: { message: string } }) => {
        if (d.error) { setApiError(d.error.message); return; }
        setJobs(d.data ?? []);
      })
      .catch(() => setApiError("No se pudo conectar con el servidor"))
      .finally(() => setLoading(false));
  }, []);

  const activeJobs    = jobs.filter(j => ["in_progress", "reserved", "accepted", "review"].includes(j.status));
  const pendingJobs   = jobs.filter(j => ["posted", "published", "review"].includes(j.status));
  const completedJobs = jobs.filter(j => j.status === "completed");
  const budgetActiveJobs = jobs.filter(j => ["accepted", "reserved", "in_progress", "review"].includes(j.status) && (j.budgetMin ?? j.budgetMax));
  const jobsWithPreferred = jobs.filter((job) => preferredProfessionalLabel(job));

  return (
    <div style={{ maxWidth: "1100px", margin: "0 auto" }}>
      <ClientPageHeader
        title="Dashboard"
        subtitle="Centro de control para tus trabajos, pagos, hitos y navegación operativa."
        breadcrumbs={[]}
        minHeight={92}
        marginBottom={28}
        actions={
          <Link
            href={CLIENT_ROUTES.newJob}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "7px",
              padding: "10px 18px",
              borderRadius: "10px",
              background: "linear-gradient(135deg, var(--brand), #2563eb)",
              color: "#fff",
              fontWeight: 700,
              fontSize: "13px",
              textDecoration: "none",
              boxShadow: "0 4px 12px rgba(59,130,246,.3)",
            }}
          >
            <Plus size={15} />
            Publicar trabajo
          </Link>
        }
      />

      <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 8, marginTop: -16 }}>
        <NotificationBanner audience="client" />
      </div>

      {/* Stats */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))", gap: "12px", marginBottom: "28px" }}>
        <ClientSummaryCardLink
          href={clientJobsHref("active")}
          label="Trabajos activos"
          value={loading ? "—" : activeJobs.length}
          icon={Briefcase}
          color="blue"
          loading={loading}
          hint="Ver detalle"
        />
        <ClientSummaryCardLink
          href={clientJobsHref("pending")}
          label="Esperando propuestas"
          value={loading ? "—" : pendingJobs.length}
          icon={AlertTriangle}
          color="amber"
          loading={loading}
          hint="Ver pendientes"
        />
        <ClientSummaryCardLink
          href={clientJobsHref("completed")}
          label="Completados"
          value={loading ? "—" : completedJobs.length}
          icon={CheckSquare}
          color="green"
          loading={loading}
          hint="Ver cierres"
        />
        <ClientSummaryCardLink
          href={clientPaymentsHref({ tab: "escrow" })}
          label="Presupuestos activos"
          value={loading ? "—" : formatBudget(budgetActiveJobs.reduce((acc, j) => acc + (j.budgetMin ?? 0), 0) || undefined)}
          icon={DollarSign}
          color="orange"
          loading={loading}
          hint="Ver escrow"
        />
      </div>

      {!loading && jobsWithPreferred.length > 0 ? (
        <HtmlInCanvasPanel as="section" style={{ marginBottom: "20px" }} canvasClassName="rounded-2xl" minHeight={76}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
            <div>
              <div style={{ fontSize: "11px", color: "#a5b4fc", fontWeight: 800, marginBottom: 4 }}>OBJETIVOS DE CONTRATACION</div>
              <div style={{ fontSize: "14px", fontWeight: 700, color: "var(--ink)" }}>
                {jobsWithPreferred.length} trabajo{jobsWithPreferred.length === 1 ? "" : "s"} con profesional objetivo
              </div>
              <div style={{ fontSize: "12px", color: "var(--muted)", marginTop: 2 }}>
                Ultimo objetivo: {preferredProfessionalLabel(jobsWithPreferred[0])}
              </div>
            </div>
            <Link
              href={`/client/jobs/${jobsWithPreferred[0]?.id ?? ""}`}
              style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "9px 12px", borderRadius: 10, border: "1px solid rgba(129,140,248,.24)", background: "rgba(129,140,248,.1)", color: "#a5b4fc", fontSize: 12, fontWeight: 700, textDecoration: "none" }}
            >
              Abrir ultimo objetivo <ArrowRight size={13} />
            </Link>
          </div>
        </HtmlInCanvasPanel>
      ) : null}

      {/* Jobs list */}
      <HtmlInCanvasPanel as="section" style={{ marginBottom: "28px" }} canvasClassName="rounded-2xl" minHeight={320}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "14px" }}>
          <h2 style={{ fontSize: "15px", fontWeight: 700, color: "var(--ink)" }}>
            Trabajos recientes
          </h2>
          <Link
            href={CLIENT_ROUTES.jobs}
            style={{ display: "flex", alignItems: "center", gap: "4px", fontSize: "12px", color: "var(--brand)", textDecoration: "none", fontWeight: 600 }}
          >
            Ver todos <ArrowRight size={13} />
          </Link>
        </div>

        {loading ? (
          <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
            {[1, 2, 3].map(i => (
              <div key={i} style={{ height: "72px", borderRadius: "12px", background: "var(--raised)", animation: "pulse 1.5s ease-in-out infinite" }} />
            ))}
          </div>
        ) : apiError ? (
          <div style={{ padding: "20px", background: "rgba(239,68,68,.06)", border: "1px solid rgba(239,68,68,.2)", borderRadius: "12px", color: "#ef4444", fontSize: "13px" }}>
            {apiError} — configura <code>SEMSE_API_BASE_URL</code> para conectar el backend.
          </div>
        ) : jobs.length === 0 ? (
          <EmptyState />
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
            {jobs.slice(0, 6).map(job => {
              const sc = STATUS_CONFIG[job.status] ?? STATUS_CONFIG.posted;
              const preferredLabel = preferredProfessionalLabel(job);
              return (
                <Link
                  key={job.id}
                  href={`/client/jobs/${job.id}`}
                  style={{ textDecoration: "none", display: "flex", alignItems: "center", gap: "14px", padding: "14px 16px", background: "var(--surface)", border: "1px solid var(--border)", borderRadius: "10px", transition: "border-color .15s" }}
                  onMouseOver={e => (e.currentTarget.style.borderColor = "var(--brand)")}
                  onMouseOut={e => (e.currentTarget.style.borderColor = "var(--border)")}
                >
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{ fontSize: "14px", fontWeight: 700, color: "var(--ink)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{job.title}</p>
                    <p style={{ fontSize: "12px", color: "var(--muted)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{job.scope}</p>
                    {preferredLabel ? (
                      <div style={{ marginTop: 7, display: "inline-flex", alignItems: "center", gap: 6, padding: "4px 8px", borderRadius: 999, background: "rgba(129,140,248,.12)", border: "1px solid rgba(129,140,248,.22)", fontSize: 11, fontWeight: 700, color: "#a5b4fc" }}>
                        Objetivo: {preferredLabel}
                      </div>
                    ) : null}
                  </div>
                  {(job.budgetMin ?? job.budgetMax) && (
                    <span style={{ fontSize: "13px", fontWeight: 700, color: "var(--ink)", whiteSpace: "nowrap" }}>
                      <DollarSign size={12} style={{ display: "inline", verticalAlign: "middle", color: "var(--accent)", marginRight: "2px" }} />
                      {formatBudget(job.budgetMin, job.budgetMax)}
                    </span>
                  )}
                  <span style={{ fontSize: "11px", fontWeight: 700, padding: "3px 10px", borderRadius: "999px", background: sc.bg, color: sc.color, whiteSpace: "nowrap" }}>
                    {sc.label}
                  </span>
                  <ArrowRight size={14} style={{ color: "var(--muted)", flexShrink: 0 }} />
                </Link>
              );
            })}
          </div>
        )}
      </HtmlInCanvasPanel>

      {/* Quick actions */}
      <HtmlInCanvasPanel as="section" canvasClassName="rounded-2xl" minHeight={180}>
        <h2 style={{ fontSize: "15px", fontWeight: 700, color: "var(--ink)", marginBottom: "14px" }}>
          Acciones rápidas
        </h2>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))", gap: "10px" }}>
          {[
            { label: "Publicar nuevo trabajo", href: CLIENT_ROUTES.newJob,      icon: Plus,         color: "#3b82f6" },
            { label: "Proyectos y copiloto",   href: CLIENT_ROUTES.projects,    icon: FolderKanban, color: "#8b5cf6" },
            { label: "Ver milestones",         href: CLIENT_ROUTES.milestones,  icon: CheckSquare,  color: "#10b981" },
            { label: "Historial pagos",        href: CLIENT_ROUTES.payments,    icon: DollarSign,   color: "#ff6a00" },
            { label: "Propuestas recibidas",   href: "/client/proposals",                     icon: Users,        color: "#6366f1" },
            { label: "Disputas abiertas",      href: clientDisputesHref({ status: "open" }), icon: AlertTriangle, color: "#ef4444" },
          ].map(action => {
            const Icon = action.icon;
            return (
              <Link
                key={action.href}
                href={action.href}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "10px",
                  padding: "14px",
                  background: "var(--surface)",
                  border: "1px solid var(--border)",
                  borderRadius: "10px",
                  textDecoration: "none",
                  color: "var(--ink)",
                  fontSize: "13px",
                  fontWeight: 600,
                  transition: "border-color 0.15s",
                }}
                onMouseOver={e => (e.currentTarget.style.borderColor = action.color)}
                onMouseOut={e => (e.currentTarget.style.borderColor = "var(--border)")}
              >
                <div style={{ width: "32px", height: "32px", borderRadius: "8px", background: `${action.color}18`, display: "flex", alignItems: "center", justifyContent: "center", color: action.color }}>
                  <Icon size={15} />
                </div>
                {action.label}
              </Link>
            );
          })}
        </div>
      </HtmlInCanvasPanel>
    </div>
  );
}

function EmptyState() {
  return (
    <div
      style={{
        padding: "48px 24px",
        textAlign: "center",
        background: "var(--surface)",
        border: "1px solid var(--border)",
        borderRadius: "12px",
        borderStyle: "dashed",
      }}
    >
      <Briefcase size={40} style={{ color: "var(--faint)", margin: "0 auto 14px" }} />
      <p style={{ fontSize: "15px", fontWeight: 700, color: "var(--ink)", marginBottom: "6px" }}>
        Aún no tienes trabajos
      </p>
      <p style={{ fontSize: "13px", color: "var(--muted)", marginBottom: "20px" }}>
        Publica tu primer trabajo y recibe propuestas de profesionales verificados.
      </p>
      <Link
        href={CLIENT_ROUTES.newJob}
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: "6px",
          padding: "10px 20px",
          borderRadius: "8px",
          background: "var(--brand)",
          color: "#fff",
          fontWeight: 700,
          fontSize: "13px",
          textDecoration: "none",
        }}
      >
        <Plus size={14} />
        Publicar trabajo
      </Link>
    </div>
  );
}
