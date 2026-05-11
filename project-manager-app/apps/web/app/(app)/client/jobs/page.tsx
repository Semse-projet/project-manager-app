"use client";

/**
 * Client — Mis proyectos
 * Lista de todos los trabajos del cliente con filtros por estado
 */

import { useEffect, useState } from "react";
import { useLanguage } from "../../../../lib/language-context";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { Plus, Search, Briefcase, DollarSign, ArrowRight } from "lucide-react";
import { HtmlInCanvasPanel } from "@semse/ui";
import type { JobRecordView } from "@semse/schemas";
import { ClientPageHeader } from "../../../components/client/ClientPageHeader";
import { CLIENT_ROUTES } from "../../../lib/client-routes";
import { NotificationBanner } from "../../../components/notifications/NotificationBanner";

const STATUS_CONFIG: Record<string, { label: string; color: string; bg: string }> = {
  draft:       { label: "Borrador",    color: "#64748b", bg: "rgba(100,116,139,.12)" },
  posted:      { label: "Publicado",   color: "#3b82f6", bg: "rgba(59,130,246,.12)" },
  reserved:    { label: "Reservado",   color: "#f59e0b", bg: "rgba(245,158,11,.12)" },
  accepted:    { label: "Aceptado",    color: "#8b5cf6", bg: "rgba(139,92,246,.12)" },
  in_progress: { label: "En progreso", color: "#06b6d4", bg: "rgba(6,182,212,.12)"  },
  review:      { label: "En revisión", color: "#f59e0b", bg: "rgba(245,158,11,.12)" },
  dispute:     { label: "En disputa",  color: "#ef4444", bg: "rgba(239,68,68,.12)"  },
  completed:   { label: "Completado",  color: "#10b981", bg: "rgba(16,185,129,.12)" },
  cancelled:   { label: "Cancelado",   color: "#64748b", bg: "rgba(100,116,139,.12)"},
};

function formatBudget(min?: number, max?: number): string {
  const fmt = (n: number) =>
    new Intl.NumberFormat("es-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(n);
  if (!min && !max) return "—";
  if (min && max)   return `${fmt(min)} – ${fmt(max)}`;
  return fmt(min ?? max ?? 0);
}

function preferredProfessionalLabel(job: JobRecordView): string | null {
  return job.preferredProfessional?.displayName?.trim() || null;
}

const FILTERS = [
  { key: "all",       label: "Todos"      },
  { key: "active",    label: "Activos"    },
  { key: "pending",   label: "Esperando propuestas" },
  { key: "posted",    label: "Publicados" },
  { key: "review",    label: "En revisión" },
  { key: "completed", label: "Completados" },
];

export default function ClientJobsPage() {
  const { t } = useLanguage();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [jobs, setJobs]     = useState<JobRecordView[]>([]);
  const [loading, setLoading] = useState(true);
  const [apiError, setApiError] = useState<string | null>(null);
  const [filter, setFilter]   = useState(() => {
    const f = searchParams?.get("filter") ?? null;
    return FILTERS.some(x => x.key === f) ? f! : "all";
  });
  const [query, setQuery]     = useState(() => searchParams?.get("q") ?? "");

  useEffect(() => {
    const nextFilter = searchParams?.get("filter") ?? "all";
    const normalizedFilter = FILTERS.some((item) => item.key === nextFilter) ? nextFilter : "all";
    const nextQuery = searchParams?.get("q") ?? "";
    if (normalizedFilter !== filter) setFilter(normalizedFilter);
    if (nextQuery !== query) setQuery(nextQuery);
  }, [searchParams, filter, query]);

  useEffect(() => {
    const params = new URLSearchParams(searchParams?.toString() ?? "");
    if (filter === "all") params.delete("filter");
    else params.set("filter", filter);
    if (query.trim()) params.set("q", query.trim());
    else params.delete("q");
    const next = params.toString();
    const current = searchParams?.toString() ?? "";
    if (next !== current) {
      router.replace(next ? `${pathname ?? ""}?${next}` : (pathname ?? ""), { scroll: false });
    }
  }, [filter, pathname, query, router, searchParams]);

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

  const filtered = jobs.filter(j => {
    const matchFilter =
      filter === "all"       ? true :
      filter === "active"    ? ["in_progress", "reserved", "accepted", "review"].includes(j.status) :
      filter === "pending"   ? ["posted", "published", "review"].includes(j.status) :
      filter === "posted"    ? j.status === "posted" :
      filter === "review"    ? j.status === "review" :
      filter === "completed" ? j.status === "completed" : true;
    const matchQ = !query || j.title.toLowerCase().includes(query.toLowerCase());
    return matchFilter && matchQ;
  });

  const headerCopy: Record<string, { title: string; detail: string }> = {
    all: { title: "Todos tus trabajos", detail: "Vista general de trabajos, estados y presupuesto." },
    active: { title: "Trabajos activos", detail: "Trabajos reservados, aceptados, en progreso o en revisión." },
    pending: { title: "Esperando propuestas", detail: "Trabajos publicados o en revisión que todavía requieren respuesta o propuestas." },
    posted: { title: "Trabajos publicados", detail: "Trabajos ya visibles para profesionales, todavía sin movimiento operativo." },
    review: { title: "Trabajos en revisión", detail: "Trabajos donde ya hay entrega o revisión pendiente de tu parte." },
    completed: { title: "Trabajos completados", detail: "Historial de trabajos cerrados correctamente." }
  };
  const currentCopy = headerCopy[filter] ?? headerCopy.all;

  return (
    <div style={{ maxWidth: "900px", margin: "0 auto" }}>
      <ClientPageHeader
        title={currentCopy.title}
        subtitle={currentCopy.detail}
        breadcrumbs={[{ label: "Trabajos" }]}
        minHeight={92}
        actions={
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <NotificationBanner audience="client" />
            <Link
              href={CLIENT_ROUTES.newJob}
              style={{
                display: "inline-flex", alignItems: "center", gap: "7px",
                padding: "9px 16px", borderRadius: "9px",
                background: "linear-gradient(135deg, var(--brand), #2563eb)",
                color: "#fff", fontWeight: 700, fontSize: "13px",
                textDecoration: "none", boxShadow: "0 4px 12px rgba(59,130,246,.3)",
              }}
            >
              <Plus size={14} /> Publicar trabajo
            </Link>
          </div>
        }
      />

      {/* Filter + Search */}
      <HtmlInCanvasPanel as="section" style={{ display: "flex", gap: "10px", marginBottom: "16px", flexWrap: "wrap", alignItems: "center" }} canvasClassName="rounded-2xl" minHeight={54}>
        <div style={{ display: "flex", gap: "4px", background: "var(--surface)", padding: "4px", borderRadius: "10px", border: "1px solid var(--border)" }}>
          {FILTERS.map(f => (
            <button
              key={f.key}
              onClick={() => setFilter(f.key)}
              style={{
                padding: "6px 14px", borderRadius: "7px", border: "none",
                background: filter === f.key ? "var(--brand)" : "transparent",
                color: filter === f.key ? "#fff" : "var(--muted)",
                fontSize: "13px", fontWeight: 600, cursor: "pointer",
              }}
            >
              {f.label}
            </button>
          ))}
        </div>

        <div style={{ position: "relative", flex: 1, minWidth: "180px", maxWidth: "280px" }}>
          <Search size={13} style={{ position: "absolute", left: "10px", top: "50%", transform: "translateY(-50%)", color: "var(--muted)" }} />
          <input
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="Buscar trabajo..."
            style={{
              width: "100%", paddingLeft: "30px", paddingRight: "12px", height: "34px",
              borderRadius: "8px", border: "1px solid var(--border)",
              background: "var(--surface)", color: "var(--ink)", fontSize: "13px", outline: "none",
              boxSizing: "border-box",
            }}
          />
        </div>
      </HtmlInCanvasPanel>

      {/* Job List */}
      {loading ? (
        <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
          {[1, 2, 3, 4].map(i => (
            <div key={i} style={{ height: "72px", borderRadius: "12px", background: "var(--raised)", animation: "pulse 1.5s ease-in-out infinite" }} />
          ))}
        </div>
      ) : apiError ? (
        <div style={{ padding: "20px", background: "rgba(239,68,68,.06)", border: "1px solid rgba(239,68,68,.2)", borderRadius: "12px", color: "#ef4444", fontSize: "13px" }}>
          {apiError} — configura <code>SEMSE_API_BASE_URL</code> para conectar el backend.
        </div>
      ) : filtered.length === 0 ? (
        <HtmlInCanvasPanel as="section" style={{
          padding: "48px 24px", textAlign: "center",
          background: "var(--surface)", border: "1px dashed var(--border)",
          borderRadius: "12px",
        }} canvasClassName="rounded-2xl" minHeight={220}>
          <Briefcase size={36} style={{ color: "var(--faint)", margin: "0 auto 12px" }} />
          <p style={{ fontSize: "14px", fontWeight: 700, color: "var(--ink)" }}>
            {jobs.length === 0 ? "Aún no tienes trabajos" : "No hay trabajos en esta vista"}
          </p>
          <p style={{ fontSize: "13px", color: "var(--muted)", marginTop: "4px", marginBottom: "20px" }}>
            {jobs.length === 0 ? "Publica tu primer trabajo y recibe propuestas." : "Prueba otra categoría o abre el detalle de un trabajo activo."}
          </p>
          <Link
            href={CLIENT_ROUTES.newJob}
            style={{
              display: "inline-flex", alignItems: "center", gap: "6px",
              padding: "9px 18px", borderRadius: "8px",
              background: "var(--brand)", color: "#fff",
              fontWeight: 700, fontSize: "13px", textDecoration: "none",
            }}
          >
            <Plus size={14} /> Publicar trabajo
          </Link>
        </HtmlInCanvasPanel>
      ) : (
        <HtmlInCanvasPanel as="section" style={{ display: "flex", flexDirection: "column", gap: "6px" }} canvasClassName="rounded-2xl" minHeight={380}>
          {filtered.map(job => {
            const sc = STATUS_CONFIG[job.status] ?? STATUS_CONFIG.posted;
            return (
              <Link
                key={job.id}
                href={`/client/jobs/${job.id}`}
                style={{
                  display: "flex", alignItems: "center", gap: "14px",
                  padding: "14px 16px",
                  background: "var(--surface)", border: "1px solid var(--border)",
                  borderRadius: "10px", textDecoration: "none",
                  transition: "border-color .15s",
                }}
                onMouseOver={e => (e.currentTarget.style.borderColor = "var(--brand)")}
                onMouseOut={e => (e.currentTarget.style.borderColor = "var(--border)")}
              >
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p style={{ fontSize: "14px", fontWeight: 700, color: "var(--ink)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {job.title}
                  </p>
                  <p style={{ fontSize: "12px", color: "var(--muted)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", marginTop: "2px" }}>
                    {job.scope}
                  </p>
                  {preferredProfessionalLabel(job) ? (
                    <div style={{ marginTop: "7px", display: "inline-flex", alignItems: "center", gap: "6px", padding: "4px 8px", borderRadius: "999px", background: "rgba(129,140,248,.12)", border: "1px solid rgba(129,140,248,.22)", fontSize: "11px", fontWeight: 700, color: "#a5b4fc", maxWidth: "100%" }}>
                      Objetivo: {preferredProfessionalLabel(job)}
                    </div>
                  ) : null}
                </div>
                {(job.budgetMin ?? job.budgetMax) ? (
                  <span style={{ fontSize: "13px", fontWeight: 700, color: "var(--ink)", whiteSpace: "nowrap", display: "flex", alignItems: "center", gap: "2px" }}>
                    <DollarSign size={12} style={{ color: "var(--accent)" }} />
                    {formatBudget(job.budgetMin, job.budgetMax)}
                  </span>
                ) : null}
                <span style={{ fontSize: "11px", fontWeight: 700, padding: "3px 10px", borderRadius: "999px", background: sc.bg, color: sc.color, whiteSpace: "nowrap", border: `1px solid ${sc.color}30` }}>
                  {sc.label}
                </span>
                <ArrowRight size={14} style={{ color: "var(--muted)", flexShrink: 0 }} />
              </Link>
            );
          })}
        </HtmlInCanvasPanel>
      )}
    </div>
  );
}
