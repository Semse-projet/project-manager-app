"use client";

import { ChevronRight } from "lucide-react";

export function NavigationBreadcrumb({ history }: { history: string[] }) {
  const trail = history.slice(-4);
  return (
    <nav aria-label="breadcrumb" className="flex items-center gap-1 text-sm text-[var(--muted)]">
      {trail.map((section, idx) => (
        <span key={`${section}-${idx}`} className="flex items-center gap-1">
          {idx > 0 && <ChevronRight className="h-3.5 w-3.5 text-[var(--muted)]" />}
          <span className={idx === trail.length - 1 ? "font-medium text-[var(--ink)]" : ""}>
            {section}
          </span>
        </span>
      ))}
    </nav>
  );
}
