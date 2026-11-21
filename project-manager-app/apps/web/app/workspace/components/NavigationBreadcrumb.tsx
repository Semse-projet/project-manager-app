"use client";

import { ChevronRight } from "lucide-react";
import { getWorkspaceSection } from "../lib/workspace-model";

export function NavigationBreadcrumb({ history, onNavigate, disabled = false }: { history: string[]; onNavigate?: (section: string) => void; disabled?: boolean }) {
  const trail = history.slice(-4);
  return (
    <nav aria-label="Historial de navegación" className="mt-1 flex flex-wrap items-center gap-1 text-xs text-[var(--muted)]">
      {trail.map((section, index) => <span key={`${section}-${index}`} className="inline-flex items-center gap-1">
        {index > 0 && <ChevronRight className="h-3.5 w-3.5" aria-hidden="true" />}
        {index === trail.length - 1 ? <span aria-current="page" className="font-medium text-[var(--ink)]">{getWorkspaceSection(section).label}</span> : <button type="button" disabled={disabled || !onNavigate} onClick={() => onNavigate?.(getWorkspaceSection(section).id)} className="min-h-8 rounded px-1 hover:text-[var(--brand)] disabled:opacity-50">{getWorkspaceSection(section).label}</button>}
      </span>)}
    </nav>
  );
}
