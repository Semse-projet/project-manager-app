"use client";

import Link from "next/link";
import { ArrowRight, ArrowUpRight, Bookmark, Boxes, CalendarDays, FileCheck2, Wallet, X } from "lucide-react";
import type { WorkspaceActiveMission, WorkspaceMissionType } from "@semse/schemas";
import { getMissionTypeLabel, getWorkspaceSection, WORKSPACE_SECTIONS, type WorkspacePreferences, type WorkspaceRole } from "../lib/workspace-model";
import { getWorkspaceDestinations } from "../lib/workspace-navigation";
import { MissionLoader } from "./MissionLoader";
import { ProjectsPanel } from "./ProjectsPanel";
import { EvidencePanel } from "./EvidencePanel";
import { BudgetPanel } from "./BudgetPanel";
import { PlanningPanel } from "./PlanningPanel";
import { PrometeoAccess } from "./PrometeoAccess";
import { WorkspaceSettings } from "./WorkspaceSettings";
import { PanelState } from "./PanelState";

const icons = { projects: Boxes, evidence: FileCheck2, budget: Wallet, planning: CalendarDays };
const referenceSection: Record<WorkspaceMissionType, string> = { project: "projects", conversation: "home", budget: "budget", evidence: "evidence", planning: "planning" };

export function CentralPanel({ activeSection, activeMission, onLoadMission, onUnloadMission, onNavigate, role, pending, contextReady, loading, scopeKey, preferences, onPreferencesChange, onResetPreferences, onMissionLoaded, storageError }: {
  activeSection: string;
  activeMission: WorkspaceActiveMission | null;
  onLoadMission: (id: string, type: WorkspaceMissionType, title: string) => Promise<boolean>;
  onUnloadMission: (id: string) => Promise<boolean>;
  onNavigate: (section: string) => void;
  role: WorkspaceRole | null;
  pending: boolean;
  contextReady: boolean;
  loading: boolean;
  scopeKey: string;
  preferences: WorkspacePreferences;
  onPreferencesChange: (value: WorkspacePreferences) => void;
  onResetPreferences: () => void;
  onMissionLoaded: () => void;
  storageError?: string | null;
}) {
  const section = getWorkspaceSection(activeSection);
  const available = getWorkspaceDestinations(role).slice(0, 6);
  const compact = preferences.density === "compact";
  return (
    <main id="workspace-main" className={`flex min-w-0 flex-1 flex-col overflow-y-auto bg-[var(--bg)] ${compact ? "gap-3 p-3 sm:p-4" : "gap-5 p-4 sm:p-6"}`} aria-label={section.label} tabIndex={-1}>
      <div><p className="text-xs font-semibold uppercase tracking-wider text-[var(--brand)]">Área de trabajo</p><h2 className="mt-1 text-xl font-semibold text-[var(--ink)]">{section.label}</h2><p className="mt-2 max-w-2xl text-sm leading-relaxed text-[var(--muted)]">{section.description}</p></div>
      {activeMission && <section className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4 sm:p-5" aria-label="Referencia de trabajo activa">
        <div className="flex items-start justify-between gap-3"><div className="min-w-0"><p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-[var(--brand)]"><Bookmark className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />Referencia de trabajo · {getMissionTypeLabel(activeMission.missionType)}</p><h3 className="mt-2 break-words text-base font-semibold text-[var(--ink)]">{activeMission.title}</h3><p className="mt-1 text-xs text-[var(--muted)]">sin ejecución vinculada · no es el ID de un proyecto</p></div><button type="button" disabled={pending} onClick={() => void onUnloadMission(activeMission.missionId)} className="inline-flex min-h-11 shrink-0 items-center gap-1 rounded-lg border border-[var(--border)] px-3 text-sm text-[var(--muted)] disabled:opacity-45" aria-label="Cerrar referencia, sin cancelar el trabajo"><X className="h-4 w-4" aria-hidden="true" /><span className="hidden sm:inline">Cerrar referencia</span></button></div>
        <details className="mt-3 text-xs text-[var(--muted)]"><summary className="cursor-pointer py-2">Qué significa esta referencia</summary><p className="mt-1 leading-relaxed">Organiza el contexto del workspace. No crea ni ejecuta trabajo; cerrarla no cancela proyectos, tareas ni misiones. Cada módulo consulta por separado los recursos que la API autoriza.</p><p className="mt-2 break-all">ID de referencia: {activeMission.missionId}</p></details>
        {section.id === "home" && <button type="button" onClick={() => onNavigate(referenceSection[activeMission.missionType])} disabled={pending} className="mt-2 inline-flex min-h-11 items-center gap-2 rounded-lg bg-[var(--brand-dim)] px-3 text-sm font-semibold text-[var(--brand)] disabled:opacity-45">Continuar en {getWorkspaceSection(referenceSection[activeMission.missionType]).label}<ArrowRight className="h-4 w-4" aria-hidden="true" /></button>}
      </section>}
      {!contextReady ? <PanelState title={loading ? "Cargando el contexto del workspace…" : "Contexto no disponible"} loading={loading} description="No se muestran datos operativos hasta confirmar la sesión y el contexto. Puedes actualizar desde el encabezado." /> : <>
        {section.id === "home" && <>
          {!activeMission && <div className="rounded-xl border border-dashed border-[var(--border)] bg-[var(--surface)] p-4"><h3 className="text-sm font-semibold text-[var(--ink)]">Empieza por el módulo que necesitas</h3><p className="mt-2 text-sm leading-relaxed text-[var(--muted)]">No hace falta abrir una referencia para consultar tus proyectos, evidencia, propuestas o tareas.</p></div>}
          <div className="grid gap-3 sm:grid-cols-2">{WORKSPACE_SECTIONS.filter((item): item is typeof item & { id: keyof typeof icons } => item.id in icons).map((item) => { const Icon = icons[item.id]; return <button key={item.id} type="button" disabled={pending} onClick={() => onNavigate(item.id)} className="flex min-h-28 items-start gap-3 rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4 text-left hover:border-[var(--brand)] disabled:opacity-45"><span className="rounded-lg bg-[var(--brand-dim)] p-2 text-[var(--brand)]"><Icon className="h-5 w-5" aria-hidden="true" /></span><span className="min-w-0"><span className="block text-sm font-semibold text-[var(--ink)]">{item.label}</span><span className="mt-1 block text-xs leading-relaxed text-[var(--muted)]">{item.description}</span></span></button>; })}</div>
          <PrometeoAccess key={scopeKey} role={role} onMissionLoaded={onMissionLoaded} />
          <MissionLoader onLoad={onLoadMission} disabled={pending} />
          {available.length > 0 && <section className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4"><h3 className="text-sm font-semibold text-[var(--ink)]">Tus módulos disponibles</h3><p className="mt-1 text-xs text-[var(--muted)]">Estos accesos abren otra pantalla de SEMSE. Busca más desde la navegación lateral.</p><div className="mt-3 flex flex-wrap gap-2">{available.map((item) => <Link key={item.id} href={item.href} className="inline-flex min-h-11 items-center gap-2 rounded-lg border border-[var(--border)] px-3 text-sm text-[var(--brand)]">{item.label}<ArrowUpRight className="h-3.5 w-3.5" aria-hidden="true" /></Link>)}</div></section>}
        </>}
        {section.id === "projects" && <ProjectsPanel key={scopeKey} role={role} />}
        {section.id === "evidence" && <EvidencePanel key={scopeKey} role={role} />}
        {section.id === "budget" && <BudgetPanel key={scopeKey} role={role} />}
        {section.id === "planning" && <PlanningPanel key={scopeKey} role={role} />}
        {section.id === "settings" && <section className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4 sm:p-5"><h3 className="mb-4 text-base font-semibold text-[var(--ink)]">Presentación del workspace</h3><WorkspaceSettings preferences={preferences} onChange={onPreferencesChange} onReset={onResetPreferences} storageError={storageError} /></section>}
      </>}
    </main>
  );
}
