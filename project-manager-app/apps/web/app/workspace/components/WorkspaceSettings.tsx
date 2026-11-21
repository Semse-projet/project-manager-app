"use client";

import { useId } from "react";
import { RotateCcw } from "lucide-react";
import type { WorkspacePreferences } from "../lib/workspace-model";

export function WorkspaceSettings({ preferences, onChange, onReset, storageError }: {
  preferences: WorkspacePreferences;
  onChange: (value: WorkspacePreferences) => void;
  onReset: () => void;
  storageError?: string | null;
}) {
  const id = useId();
  return (
    <div className="space-y-5 text-sm">
      <p className="leading-relaxed text-[var(--muted)]">Estas preferencias solo cambian la presentación en este navegador. No modifican permisos, proyectos ni el estado del trabajo.</p>
      <fieldset className="space-y-2">
        <legend className="mb-2 font-semibold text-[var(--ink)]">Paneles de escritorio</legend>
        <label htmlFor={`${id}-left`} className="flex min-h-11 cursor-pointer items-center justify-between gap-3 rounded-lg border border-[var(--border)] px-3">
          <span>Navegación lateral</span><input id={`${id}-left`} type="checkbox" checked={preferences.leftPanel} onChange={(event) => onChange({ ...preferences, leftPanel: event.target.checked })} className="h-4 w-4 accent-[var(--brand)]" />
        </label>
        <label htmlFor={`${id}-right`} className="flex min-h-11 cursor-pointer items-center justify-between gap-3 rounded-lg border border-[var(--border)] px-3">
          <span>Contexto y configuración</span><input id={`${id}-right`} type="checkbox" checked={preferences.rightPanel} onChange={(event) => onChange({ ...preferences, rightPanel: event.target.checked })} className="h-4 w-4 accent-[var(--brand)]" />
        </label>
        <p className="text-xs text-[var(--muted)]">Si pliegas un panel, puedes abrirlo desde los controles superiores. En móvil se abre como diálogo.</p>
      </fieldset>
      <div>
        <label htmlFor={`${id}-density`} className="mb-2 block font-semibold text-[var(--ink)]">Densidad de contenido</label>
        <select id={`${id}-density`} value={preferences.density} onChange={(event) => onChange({ ...preferences, density: event.target.value === "compact" ? "compact" : "comfortable" })} className="min-h-11 w-full rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 text-[var(--ink)]">
          <option value="comfortable">Cómoda · más espacio</option><option value="compact">Compacta · menos espacio</option>
        </select>
      </div>
      <button type="button" onClick={onReset} className="inline-flex min-h-11 items-center gap-2 rounded-lg border border-[var(--border)] px-3 font-medium text-[var(--brand)]"><RotateCcw className="h-4 w-4" aria-hidden="true" />Restaurar preferencias</button>
      {storageError && <p role="status" className="text-xs text-[var(--error)]">{storageError}</p>}
    </div>
  );
}
