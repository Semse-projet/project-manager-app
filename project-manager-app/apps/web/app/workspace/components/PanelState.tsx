"use client";

import { AlertCircle, Loader2, RefreshCw } from "lucide-react";

export function PanelState({ title, description, loading = false, error = false, onRetry }: {
  title: string;
  description?: string;
  loading?: boolean;
  error?: boolean;
  onRetry?: () => void;
}) {
  return (
    <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-5" role={error ? "alert" : "status"} aria-live="polite">
      <div className="flex items-center gap-2">
        {loading ? <Loader2 className="h-4 w-4 animate-spin motion-reduce:animate-none" aria-hidden="true" /> : error ? <AlertCircle className="h-4 w-4 text-[var(--error)]" aria-hidden="true" /> : null}
        <p className="text-sm font-semibold text-[var(--ink)]">{title}</p>
      </div>
      {description && <p className="mt-2 text-sm text-[var(--muted)]">{description}</p>}
      {onRetry && <button type="button" onClick={onRetry} className="mt-3 inline-flex min-h-11 items-center gap-2 rounded-lg border border-[var(--border)] px-3 text-sm text-[var(--brand)]"><RefreshCw className="h-4 w-4" aria-hidden="true" />Reintentar</button>}
    </div>
  );
}
