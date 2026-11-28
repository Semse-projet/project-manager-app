"use client";

import { useRef, useState, type FormEvent } from "react";
import { Loader2, Plus } from "lucide-react";
import type { WorkspaceMissionType } from "@semse/schemas";
import { validateMissionTitle, WORKSPACE_MISSION_TYPES } from "../lib/workspace-model";

export function MissionLoader({ onLoad, disabled = false }: {
  onLoad: (missionId: string, missionType: WorkspaceMissionType, title: string) => Promise<boolean>;
  disabled?: boolean;
}) {
  const [title, setTitle] = useState("");
  const [type, setType] = useState<WorkspaceMissionType>("project");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const submitting = useRef(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submitting.current || disabled) return;
    const validation = validateMissionTitle(title);
    if (validation) { setError(validation); return; }
    submitting.current = true;
    setPending(true);
    setError(null);
    try {
      const success = await onLoad(crypto.randomUUID(), type, title.trim());
      if (success) setTitle("");
      else setError("No se confirmó la apertura. Tu título se conserva para reintentar.");
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : "No se pudo abrir la referencia.");
    } finally {
      submitting.current = false;
      setPending(false);
    }
  }

  return (
    <form onSubmit={submit} className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4 sm:p-5" aria-busy={pending}>
      <h3 className="text-sm font-semibold text-[var(--ink)]">Abrir una referencia de trabajo</h3>
      <p id="mission-reference-help" className="mt-1 text-xs leading-relaxed text-[var(--muted)]">Organiza el contexto del workspace. Esto no crea un proyecto, ejecuta una misión ni aprueba trabajo. Abrir otra referencia reemplaza la actual.</p>
      <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-end">
        <div className="sm:w-40">
          <label htmlFor="workspace-mission-type" className="mb-1 block text-xs font-medium text-[var(--muted)]">Tipo</label>
          <select id="workspace-mission-type" value={type} onChange={(event) => setType(event.target.value as WorkspaceMissionType)} disabled={disabled || pending} className="min-h-11 w-full rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 text-sm text-[var(--ink)] disabled:opacity-50">
            {WORKSPACE_MISSION_TYPES.map((mission) => <option key={mission.id} value={mission.id}>{mission.label}</option>)}
          </select>
        </div>
        <div className="min-w-0 flex-1">
          <label htmlFor="workspace-mission-title" className="mb-1 block text-xs font-medium text-[var(--muted)]">Título de la referencia</label>
          <input id="workspace-mission-title" value={title} onChange={(event) => { setTitle(event.target.value); setError(null); }} maxLength={200} required disabled={disabled || pending} aria-describedby="mission-reference-help mission-reference-count" placeholder="Por ejemplo, revisión de evidencia" className="min-h-11 w-full rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 text-sm text-[var(--ink)] disabled:opacity-50" />
        </div>
        <button type="submit" disabled={disabled || pending || Boolean(validateMissionTitle(title))} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg bg-[var(--brand)] px-4 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-45">
          {pending ? <Loader2 className="h-4 w-4 animate-spin motion-reduce:animate-none" aria-hidden="true" /> : <Plus className="h-4 w-4" aria-hidden="true" />}{pending ? "Abriendo…" : "Abrir referencia"}
        </button>
      </div>
      <p id="mission-reference-count" className="mt-2 text-right text-xs text-[var(--muted)]">{title.length}/200 caracteres</p>
      {error && <p role="alert" className="mt-2 text-sm text-[var(--error)]">{error}</p>}
    </form>
  );
}
