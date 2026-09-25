import type { ElementType, ReactNode } from "react";
import { cn } from "../lib/cn";

export interface EmptyStateProps {
  title: string;
  description?: string;
  /** Lucide (or any SVG) icon component, shown when no `image` is given. */
  icon?: ElementType;
  /** Illustration src, takes priority over `icon` when both are given. */
  image?: string;
  /** Usually a `<Link>`/`<a>` so routing stays in the consumer's control. */
  action?: ReactNode;
  className?: string;
}

/**
 * Shared "nothing here yet" panel — same visual language across every list,
 * dashboard section and table in the ecosystem, so users learn it once.
 * Generalized from the worker dashboard's local `EmptyPanel` (2026-09).
 */
export function EmptyState({ title, description, icon: Icon, image, action, className }: EmptyStateProps) {
  return (
    <div
      className={cn(
        "rounded-2xl border border-[var(--border)] bg-[var(--surface)] px-6 py-10 text-center",
        className
      )}
    >
      {image ? (
        // eslint-disable-next-line @next/next/no-img-element -- packages/ui has no Next.js dependency
        <img src={image} alt="" width={56} height={56} className="mx-auto mb-3.5 block" />
      ) : Icon ? (
        <Icon size={32} className="mx-auto mb-3.5 block text-[var(--faint)]" aria-hidden="true" />
      ) : null}
      <p className="mb-1.5 text-sm font-bold text-[var(--ink)]">{title}</p>
      {description ? <p className="text-[13px] text-[var(--muted)]">{description}</p> : null}
      {action ? <div className="mt-5 flex justify-center">{action}</div> : null}
    </div>
  );
}
