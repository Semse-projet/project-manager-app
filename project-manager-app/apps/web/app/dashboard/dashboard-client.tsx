"use client";

import { useState } from "react";
import Link from "next/link";
import { HtmlInCanvasPanel } from "@semse/ui";
import { cn } from "../../lib/cn";
import type { JobRecordView, JobRecordStatus } from "@semse/schemas";

// ── Tipos locales ─────────────────────────────────────────────
interface DashboardStats {
  totalJobs: number;
  activeJobs: number;
  pendingReview: number;
  completedJobs: number;
  totalBudgetMin: number;
  totalBudgetMax: number;
}

interface DashboardClientProps {
  jobs: JobRecordView[];
}

// ── Helpers ───────────────────────────────────────────────────
function computeStats(jobs: JobRecordView[]): DashboardStats {
  return {
    totalJobs:     jobs.length,
    activeJobs:    jobs.filter(j => j.status === "in_progress" || j.status === "accepted").length,
    pendingReview: jobs.filter(j => j.status === "review" || j.status === "posted" || j.status === "published").length,
    completedJobs: jobs.filter(j => j.status === "completed").length,
    totalBudgetMin: jobs.reduce((s, j) => s + (j.budgetMin ?? 0), 0),
    totalBudgetMax: jobs.reduce((s, j) => s + (j.budgetMax ?? 0), 0),
  };
}

const statusConfig: Record<JobRecordStatus, { label: string; color: string; dot: string }> = {
  draft:       { label: "Borrador",     color: "text-muted",       dot: "bg-white/20" },
  posted:      { label: "Publicado",    color: "text-brand",       dot: "bg-brand animate-pulse" },
  published:   { label: "Publicado",    color: "text-brand",       dot: "bg-brand animate-pulse" },
  reserved:    { label: "Reservado",    color: "text-amber-400",   dot: "bg-amber-400" },
  accepted:    { label: "Aceptado",     color: "text-emerald-400", dot: "bg-emerald-400" },
  in_progress: { label: "En progreso",  color: "text-emerald-400", dot: "bg-emerald-400 animate-pulse" },
  review:      { label: "En revisión",  color: "text-amber-400",   dot: "bg-amber-400 animate-pulse" },
  dispute:     { label: "Disputa",      color: "text-red-400",     dot: "bg-red-400" },
  completed:   { label: "Completado",   color: "text-emerald-400", dot: "bg-emerald-400" },
  awarded:     { label: "Asignado",     color: "text-brand",       dot: "bg-brand" },
  cancelled:   { label: "Cancelado",    color: "text-muted",       dot: "bg-white/20" },
};

function formatCurrency(n: number) {
  return new Intl.NumberFormat("es-MX", { style: "currency", currency: "USD", minimumFractionDigits: 0 }).format(n);
}

// ── Stat Card ─────────────────────────────────────────────────
function StatCard({
  label,
  value,
  sub,
  accent = false,
  delta,
}: {
  label: string;
  value: React.ReactNode;
  sub?: string;
  accent?: boolean;
  delta?: { up: boolean; label: string };
}) {
  return (
    <HtmlInCanvasPanel
      as="article"
      className={cn(
        "rounded-2xl border p-5 transition-all",
        accent
          ? "border-brand/20 bg-brand/[0.06]"
          : "border-white/[0.08] bg-[#0d0d20]"
      )}
      canvasClassName="rounded-2xl"
      minHeight={148}
    >
      <p className="text-[0.68rem] font-semibold uppercase tracking-widest text-muted">{label}</p>
      <p className={cn("mt-2 text-3xl font-bold tracking-tight", accent ? "text-brand" : "text-ink")}>
        {value}
      </p>
      {sub && <p className="mt-1 text-xs text-muted">{sub}</p>}
      {delta && (
        <p className={cn("mt-2 flex items-center gap-1 text-xs font-medium", delta.up ? "text-emerald-400" : "text-red-400")}>
          <span aria-hidden>{delta.up ? "↑" : "↓"}</span>
          {delta.label}
        </p>
      )}
    </HtmlInCanvasPanel>
  );
}

// ── Status Filter Pills ────────────────────────────────────────
const FILTER_OPTIONS: Array<{ key: JobRecordStatus | "all"; label: string }> = [
  { key: "all",         label: "Todos" },
  { key: "in_progress", label: "En progreso" },
  { key: "posted",      label: "Publicados" },
  { key: "review",      label: "En revisión" },
  { key: "completed",   label: "Completados" },
  { key: "dispute",     label: "Disputas" },
];

// ── Componente principal ───────────────────────────────────────
export function DashboardClient({ jobs }: DashboardClientProps) {
  const [filter, setFilter] = useState<JobRecordStatus | "all">("all");
  const [search, setSearch] = useState("");
  const stats = computeStats(jobs);

  const filtered = jobs.filter(j => {
    const matchFilter = filter === "all" || j.status === filter;
    const matchSearch = !search || j.title.toLowerCase().includes(search.toLowerCase());
    return matchFilter && matchSearch;
  });

  const today = new Date().toLocaleDateString("es-MX", { weekday: "long", day: "numeric", month: "long" });

  return (
    <div className="mx-auto w-full max-w-7xl px-4 sm:px-6 py-8 space-y-8">
      {/* Migration Alert Banner */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 p-4 rounded-2xl border border-brand/20 bg-brand/[0.06] text-sm">
        <div className="flex items-center gap-2">
          <span className="text-brand font-bold">◈ NOTA:</span>
          <span className="text-muted">
            SEMSE está migrando a una arquitectura de 3 capas (Mission Control {"->"} Workspace {"->"} Context Panel).
          </span>
        </div>
        <Link
          href="/admin/mission-control"
          className="text-xs font-bold text-brand hover:underline shrink-0"
        >
          Probar Mission Control →
        </Link>
      </div>

      {/* ── Encabezado ─────────────────────────────────────── */}
      <div>
        <p className="text-xs text-muted capitalize">{today}</p>
        <h1 className="mt-1 text-2xl font-bold tracking-tight text-ink">Dashboard SEMSE OS</h1>
        <p className="mt-1 text-sm text-muted">
          Vista operativa del ecosistema de proyectos y trabajadores.
        </p>
      </div>

      {/* ── Stat cards ─────────────────────────────────────── */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <StatCard
          label="Jobs totales"
          value={stats.totalJobs}
          sub={`${stats.completedJobs} completados`}
        />
        <StatCard
          label="En progreso"
          value={stats.activeJobs}
          accent={stats.activeJobs > 0}
        />
        <StatCard
          label="Pendientes"
          value={stats.pendingReview}
          sub="esperan acción"
          accent={stats.pendingReview > 0}
        />
        <StatCard
          label="Presupuesto estimado"
          value={formatCurrency(stats.totalBudgetMax)}
          sub={`Mín: ${formatCurrency(stats.totalBudgetMin)}`}
        />
      </div>

      {/* ── Accesos rápidos ────────────────────────────────── */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          { href: "/jobs/new",  label: "Publicar job",    icon: "＋",  accent: true },
          { href: "/cortex",    label: "Prometeo Cortex", icon: "◈",   accent: false },
          { href: "/",          label: "Todos los jobs",  icon: "◫",   accent: false },
          { href: "/dashboard", label: "Actualizar",      icon: "↻",   accent: false },
        ].map(({ href, label, icon, accent }) => (
          <HtmlInCanvasPanel
            key={href}
            as="article"
            className={cn(
              "rounded-xl border",
              accent ? "border-brand/30 bg-brand/10" : "border-white/[0.08] bg-[#0d0d20]"
            )}
            canvasClassName="rounded-xl"
            minHeight={56}
          >
            <Link
              href={href}
              className={cn(
                "flex items-center gap-2 px-4 py-3 text-sm font-medium transition-all hover:scale-[1.02]",
                accent
                  ? "text-brand hover:bg-brand/20"
                  : "text-muted hover:text-ink hover:border-white/20"
              )}
            >
              <span aria-hidden className="text-base">{icon}</span>
              {label}
            </Link>
          </HtmlInCanvasPanel>
        ))}
      </div>

      {/* ── Tabla de jobs ───────────────────────────────────── */}
      <HtmlInCanvasPanel as="section" canvasClassName="rounded-xl" minHeight={420}>
        <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <h2 className="text-sm font-semibold text-ink">Jobs recientes</h2>
          <div className="flex flex-wrap items-center gap-2">
            {/* Búsqueda */}
            <input
              type="search"
              placeholder="Buscar por título…"
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="h-8 rounded-lg border border-white/[0.08] bg-[#0d0d20] px-3 text-xs text-ink placeholder:text-muted focus:outline-none focus:ring-1 focus:ring-brand"
              aria-label="Buscar jobs"
            />
          </div>
        </div>

        {/* Filtros de estado */}
        <div className="mb-3 flex flex-wrap gap-1.5">
          {FILTER_OPTIONS.map(({ key, label }) => (
            <button
              key={key}
              onClick={() => setFilter(key)}
              className={cn(
                "rounded-full border px-3 py-1 text-[0.7rem] font-semibold transition-all",
                filter === key
                  ? "border-brand/40 bg-brand/20 text-brand"
                  : "border-white/[0.08] bg-transparent text-muted hover:text-ink hover:border-white/20"
              )}
            >
              {label}
              {key !== "all" && (
                <span className="ml-1.5 tabular-nums opacity-60">
                  {jobs.filter(j => j.status === key).length}
                </span>
              )}
            </button>
          ))}
        </div>

        {/* Tabla */}
        {filtered.length === 0 ? (
          <div className="rounded-xl border border-white/[0.07] bg-[#131328] py-12 text-center">
            <p className="text-sm text-muted">Sin jobs que coincidan con los filtros.</p>
            <Link href="/jobs/new" className="mt-2 inline-block text-xs text-brand hover:underline">
              Publicar el primero →
            </Link>
          </div>
        ) : (
          <div className="overflow-hidden rounded-xl border border-white/[0.08]">
            <table className="w-full text-sm" role="grid">
              <thead>
                <tr className="border-b border-white/[0.06] bg-[#131328]">
                  {["Título", "Estado", "Presupuesto", "Acciones"].map(h => (
                    <th key={h} className="px-4 py-3 text-left text-[0.68rem] font-semibold uppercase tracking-widest text-muted">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-white/[0.04]">
                {filtered.map(job => {
                  const cfg = statusConfig[job.status] ?? statusConfig.draft;
                  const budgetStr = job.budgetMin && job.budgetMax
                    ? `${formatCurrency(job.budgetMin)} – ${formatCurrency(job.budgetMax)}`
                    : job.budgetMin
                      ? formatCurrency(job.budgetMin)
                      : "—";
                  return (
                    <tr
                      key={job.id}
                      className="bg-[#0d0d20] transition-colors hover:bg-white/[0.03]"
                    >
                      <td className="px-4 py-3.5">
                        <div className="max-w-xs">
                          <p className="font-medium text-ink truncate">{job.title}</p>
                          <p className="mt-0.5 text-xs text-muted/60 truncate">
                            {job.scope.slice(0, 60)}…
                          </p>
                        </div>
                      </td>
                      <td className="px-4 py-3.5">
                        <span className={cn("flex items-center gap-1.5 text-xs font-semibold", cfg.color)}>
                          <span className={cn("inline-block h-1.5 w-1.5 rounded-full shrink-0", cfg.dot)} aria-hidden />
                          {cfg.label}
                        </span>
                      </td>
                      <td className="px-4 py-3.5 tabular-nums text-xs text-muted">
                        {budgetStr}
                      </td>
                      <td className="px-4 py-3.5">
                        <div className="flex items-center gap-2">
                          <Link
                            href={`/jobs/${job.id}`}
                            className="text-xs text-brand hover:underline"
                          >
                            Detalle
                          </Link>
                          <span aria-hidden className="text-white/20">·</span>
                          <Link
                            href={`/jobs/${job.id}/escrow`}
                            className="text-xs text-muted hover:text-ink"
                          >
                            Escrow
                          </Link>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        <p className="mt-2 text-right text-xs text-muted/50">
          {filtered.length} de {jobs.length} jobs
        </p>
      </HtmlInCanvasPanel>
    </div>
  );
}
