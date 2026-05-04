import type { ReactNode } from "react";
import type { Job, JobStatusUI, UrgencyLevel } from "@semse/schemas";
import { cn } from "../lib/cn";
import { HtmlInCanvasPanel } from "./HtmlInCanvasPanel";
import { StatusBadge, type StatusBadgeVariant } from "./StatusBadge";

export interface JobCardProps {
  job: Job;
  compact?: boolean;
  footer?: ReactNode;
  className?: string;
}

const statusVariantMap: Record<JobStatusUI, { label: string; variant: StatusBadgeVariant }> = {
  draft: { label: "Borrador", variant: "neutral" },
  posted: { label: "Publicado", variant: "info" },
  reserved: { label: "Reservado", variant: "warning" },
  accepted: { label: "Aceptado", variant: "violet" },
  in_progress: { label: "En progreso", variant: "info" },
  review: { label: "En revisión", variant: "warning" },
  dispute: { label: "En disputa", variant: "error" },
  completed: { label: "Completado", variant: "success" },
  cancelled: { label: "Cancelado", variant: "neutral" },
};

const urgencyLabelMap: Record<UrgencyLevel, string> = {
  low: "Baja",
  medium: "Media",
  high: "Alta",
  urgent: "Urgente",
};

function formatCurrency(amount: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 0,
  }).format(amount);
}

function formatBudget(job: Job) {
  if (job.budget.type === "range" && job.budget.max) {
    return `${formatCurrency(job.budget.min)} - ${formatCurrency(job.budget.max)}`;
  }

  return formatCurrency(job.budget.min);
}

function formatDate(date: Date) {
  return new Intl.DateTimeFormat("es", {
    day: "numeric",
    month: "short",
  }).format(new Date(date));
}

function truncate(text: string, max: number) {
  return text.length > max ? `${text.slice(0, max)}…` : text;
}

export function JobCard({ job, compact = false, footer, className }: JobCardProps) {
  const status = statusVariantMap[job.status] ?? statusVariantMap.posted;
  const summary = truncate(job.description || job.scope || "", compact ? 84 : 140);

  return (
    <HtmlInCanvasPanel
      as="article"
      className={cn(
        "rounded-2xl border border-white/10 bg-[#0d1220] p-4 text-slate-100",
        compact ? "space-y-3" : "space-y-4 p-5",
        className
      )}
      canvasClassName="rounded-2xl"
      minHeight={compact ? 168 : 208}
    >
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0 flex-1 space-y-1">
          <h3 className="truncate text-base font-bold tracking-[-0.02em] text-white">{job.title}</h3>
          <p className="text-sm leading-6 text-slate-400">{summary}</p>
        </div>
        <StatusBadge variant={status.variant} text={status.label} size="sm" />
      </div>

      <div className="flex flex-wrap gap-2 text-xs text-slate-300">
        <span className="rounded-full border border-white/10 bg-white/5 px-2.5 py-1 font-semibold">
          {formatBudget(job)}
        </span>
        {job.category ? (
          <span className="rounded-full border border-white/10 bg-white/5 px-2.5 py-1">{job.category}</span>
        ) : null}
        {job.location?.type ? (
          <span className="rounded-full border border-white/10 bg-white/5 px-2.5 py-1">
            {job.location.type === "remote" ? "Remoto" : job.location.city ?? "En sitio"}
          </span>
        ) : null}
        {job.urgency ? (
          <span className="rounded-full border border-white/10 bg-white/5 px-2.5 py-1">
            Prioridad: {urgencyLabelMap[job.urgency]}
          </span>
        ) : null}
        {job.deadline ? (
          <span className="rounded-full border border-white/10 bg-white/5 px-2.5 py-1">
            Vence {formatDate(job.deadline)}
          </span>
        ) : null}
      </div>

      {footer ? <div className="border-t border-white/10 pt-3">{footer}</div> : null}
    </HtmlInCanvasPanel>
  );
}
