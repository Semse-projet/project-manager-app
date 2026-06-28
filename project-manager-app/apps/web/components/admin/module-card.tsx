import Link from "next/link";
import type { AdminModule, AdminModuleStatus, AdminModuleTone } from "../../lib/admin/admin-navigation";
import { cn } from "../../lib/cn";

const statusClasses: Record<AdminModuleStatus, string> = {
  operational: "border-emerald-400/25 bg-emerald-400/[0.08] text-emerald-200",
  attention: "border-amber-400/25 bg-amber-400/[0.08] text-amber-200",
  planned: "border-sky-400/25 bg-sky-400/[0.08] text-sky-200",
  disabled: "border-white/[0.08] bg-white/[0.04] text-muted",
};

const metricToneClasses: Record<AdminModuleTone, string> = {
  neutral: "text-slate-200",
  success: "text-emerald-200",
  warning: "text-amber-200",
  danger: "text-red-200",
};

export function ModuleCard({ module, compact = false }: { module: AdminModule; compact?: boolean }) {
  return (
    <article className="flex min-h-[220px] flex-col rounded-lg border border-white/[0.08] bg-[#101527] p-5 shadow-sm">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-lg font-semibold text-ink">{module.label}</h2>
          <p className="mt-2 text-sm leading-6 text-muted">{module.description}</p>
        </div>
        <span
          className={cn(
            "shrink-0 rounded-md border px-2.5 py-1 text-[0.68rem] font-semibold uppercase tracking-widest",
            statusClasses[module.status]
          )}
        >
          {module.status}
        </span>
      </div>

      {module.metric ? (
        <div className="mt-5 rounded-md border border-white/[0.07] bg-white/[0.03] px-3 py-2">
          <span className="block text-[0.68rem] font-semibold uppercase tracking-widest text-muted">
            {module.metric.label}
          </span>
          <strong className={cn("mt-1 block text-xl font-semibold", metricToneClasses[module.metric.tone ?? "neutral"])}>
            {module.metric.value}
          </strong>
        </div>
      ) : null}

      {!compact ? (
        <div className="mt-5 flex flex-wrap gap-2">
          {module.children.slice(0, 5).map((child) => (
            <Link
              key={`${module.id}-${child.id}-${child.href}`}
              href={child.href}
              className="rounded-md border border-white/[0.08] bg-white/[0.03] px-2.5 py-1.5 text-xs font-medium text-muted transition hover:border-brand/40 hover:text-ink"
            >
              {child.label}
            </Link>
          ))}
        </div>
      ) : null}

      <div className="mt-auto pt-5">
        <Link
          href={module.href}
          className="inline-flex min-h-9 items-center rounded-md bg-brand px-3 py-2 text-sm font-semibold text-[#0a0a14] transition hover:bg-brand-dim"
        >
          Open hub
        </Link>
      </div>
    </article>
  );
}
