"use client";

import { useId, useState } from "react";
import { ArrowUpRight, Boxes, CalendarDays, Camera, FileCheck2, Home, Search, Settings, Wallet } from "lucide-react";
import Link from "next/link";
import { WORKSPACE_SECTIONS, getWorkspaceSection, type WorkspaceRole } from "../lib/workspace-model";
import { getWorkspaceDestinations } from "../lib/workspace-navigation";

const icons = { home: Home, projects: Boxes, evidence: FileCheck2, budget: Wallet, planning: CalendarDays, settings: Settings };
const normalize = (text: string) => text.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();

export function LeftPanel({ activeSection, onNavigate, role, history = [], disabled = false, onOpenDestination }: {
  activeSection: string;
  onNavigate: (section: string) => void;
  role: WorkspaceRole | null;
  history?: string[];
  disabled?: boolean;
  onOpenDestination?: () => void;
}) {
  const searchId = useId();
  const [query, setQuery] = useState("");
  const term = normalize(query);
  const sections = WORKSPACE_SECTIONS.filter((section) => normalize(section.label).includes(term));
  const destinations = getWorkspaceDestinations(role, query);
  const recent = Array.from(new Set(history.slice().reverse())).filter((section) => section !== activeSection && WORKSPACE_SECTIONS.some((item) => item.id === section)).slice(0, 4);
  return (
    <aside className="flex w-64 max-w-full shrink-0 flex-col overflow-y-auto border-r border-[var(--border)] bg-[var(--surface)] p-3" aria-label="Navegación del workspace">
      <label htmlFor={searchId} className="mb-2 px-2 text-xs font-semibold uppercase tracking-wide text-[var(--muted)]">Buscar en tu workspace</label>
      <div className="relative mb-3"><Search className="pointer-events-none absolute left-3 top-3.5 h-4 w-4 text-[var(--muted)]" aria-hidden="true" /><input id={searchId} type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Sección o módulo…" className="min-h-11 w-full rounded-lg border border-[var(--border)] bg-[var(--bg)] pl-9 pr-3 text-sm text-[var(--ink)]" /></div>
      <nav aria-label="Secciones" className="flex flex-col gap-1">
        {sections.map(({ id, label }) => {
          const Icon = icons[id];
          return <button key={id} type="button" onClick={() => onNavigate(id)} disabled={disabled} aria-current={activeSection === id ? "page" : undefined} className={`flex min-h-11 items-center gap-3 rounded-lg px-3 text-left text-sm disabled:opacity-45 ${activeSection === id ? "bg-[var(--brand-dim)] font-semibold text-[var(--brand)]" : "text-[var(--muted)] hover:bg-[var(--raised)]"}`}><Icon className="h-4 w-4" aria-hidden="true" />{label}</button>;
        })}
      </nav>
      {query && destinations.length > 0 && <nav aria-label="Módulos disponibles" className="mt-4 space-y-1"><p className="mb-2 px-2 text-xs font-semibold uppercase tracking-wide text-[var(--muted)]">Abren otro módulo</p>{destinations.map((destination) => <Link key={destination.id} href={destination.href} onClick={onOpenDestination} className="flex min-h-11 items-center justify-between gap-2 rounded-lg px-3 text-sm text-[var(--ink)] hover:bg-[var(--raised)]"><span>{destination.label}</span><ArrowUpRight className="h-3.5 w-3.5 shrink-0 text-[var(--muted)]" aria-hidden="true" /></Link>)}</nav>}
      {query && sections.length === 0 && destinations.length === 0 && <p role="status" className="mt-3 px-2 text-sm text-[var(--muted)]">No hay resultados entre tus módulos disponibles.</p>}
      {!query && recent.length > 0 && <nav aria-label="Secciones recientes" className="mt-5 space-y-1"><p className="mb-2 px-2 text-xs font-semibold uppercase tracking-wide text-[var(--muted)]">Volver a recientes</p>{recent.map((section) => <button key={section} type="button" disabled={disabled} onClick={() => onNavigate(section)} className="flex min-h-11 w-full items-center rounded-lg px-3 text-left text-sm text-[var(--muted)] hover:bg-[var(--raised)] disabled:opacity-45">{getWorkspaceSection(section).label}</button>)}</nav>}
      <Link href="/workspace/recorridos-360" onClick={onOpenDestination} className="mt-5 flex min-h-11 items-center gap-2 rounded-lg border border-[var(--border)] px-3 text-sm text-[var(--brand)] hover:bg-[var(--raised)]"><Camera className="h-4 w-4 shrink-0" aria-hidden="true" /><span>Recorrido 360°<span className="block text-xs text-[var(--muted)]">Vista local · sin subir archivos</span></span></Link>
      {!role && <p className="mt-4 px-2 text-xs text-[var(--muted)]">Los módulos operativos aparecerán al cargar un contexto con rol reconocido.</p>}
    </aside>
  );
}
