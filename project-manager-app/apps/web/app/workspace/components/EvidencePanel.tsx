"use client";

import Link from "next/link";
import { useCallback, useState } from "react";
import { Camera, ExternalLink, FileText, Upload } from "lucide-react";
import { fetchJobs, fetchMyJobs, fetchJobEvidence, fetchJobMilestones } from "../../semse-api";
import type { WorkspaceRole } from "../lib/workspace-model";
import { useWorkspaceQuery, isWorkspaceAccessError } from "../lib/use-workspace-query";
import { EVIDENCE_KIND_LABELS, evidenceStatus, evidenceStatusLabel, evidenceText, evidenceUploadHref, filterEvidence } from "../lib/evidence-model";
import { PanelState } from "./PanelState";

const controlClass = "min-h-11 w-full min-w-0 rounded-lg border border-[var(--border)] bg-[var(--bg)] px-3 text-sm text-[var(--ink)]";
const linkClass = "inline-flex min-h-11 items-center gap-2 rounded-lg border border-[var(--border)] px-3 text-sm text-[var(--brand)]";

export function EvidencePanel({ role }: { role: WorkspaceRole | null }) {
  const [selectedJobId, setSelectedJobId] = useState("");
  const [kind, setKind] = useState("");
  const [status, setStatus] = useState("");
  const [milestoneId, setMilestoneId] = useState("");
  const jobsLoader = useCallback(() => role === "worker" ? fetchMyJobs() : fetchJobs(), [role]);
  const jobs = useWorkspaceQuery(role ? `evidence-jobs:${role}` : null, jobsLoader);
  const activeJobId = jobs.data?.some((job) => job.id === selectedJobId) ? selectedJobId : "";
  const evidenceLoader = useCallback(() => fetchJobEvidence(encodeURIComponent(activeJobId)), [activeJobId]);
  const milestonesLoader = useCallback(() => fetchJobMilestones(encodeURIComponent(activeJobId)), [activeJobId]);
  const evidence = useWorkspaceQuery(role && activeJobId ? `evidence:${role}:${activeJobId}` : null, evidenceLoader);
  const milestones = useWorkspaceQuery(role && activeJobId ? `evidence-milestones:${role}:${activeJobId}` : null, milestonesLoader);
  const uploadHref = evidenceUploadHref(role, activeJobId);

  if (!role) return <PanelState title="Evidencia no disponible" description="No se pudo resolver un rol autorizado. No se consultaron datos de negocio." />;
  const filtered = filterEvidence(evidence.data ?? [], { kind, status, milestoneId });
  const statuses = Array.from(new Set(["manual_review", ...(evidence.data ?? []).map(evidenceStatus)]));
  const milestoneOptions = new Map<string, string>();
  for (const row of milestones.data ?? []) {
    const id = evidenceText(row.id);
    if (id) milestoneOptions.set(id, evidenceText(row.title) || id);
  }
  // Keep filtering by the actual evidence reference possible when the milestone source fails.
  for (const row of evidence.data ?? []) {
    const id = evidenceText(row.milestoneId);
    if (id && !milestoneOptions.has(id)) milestoneOptions.set(id, `Hito ${id}`);
  }

  return (
    <section className="grid min-w-0 gap-4" aria-labelledby="workspace-evidence-title">
      <div>
        <h2 id="workspace-evidence-title" className="text-lg font-semibold text-[var(--ink)]">Evidencia del trabajo</h2>
        <p className="mt-1 text-sm text-[var(--muted)]">Consulta archivos autorizados. La carga se abre en el módulo existente; no aprueba hitos ni libera fondos.</p>
      </div>
      {jobs.loading && <PanelState title="Cargando trabajos" loading />}
      {jobs.error && <PanelState title={isWorkspaceAccessError(jobs.error, jobs.status) ? "Sin acceso a los trabajos" : "No se pudieron cargar los trabajos"} description={jobs.error} error onRetry={jobs.retry} />}
      {jobs.data && jobs.data.length === 0 && <PanelState title="Sin trabajos disponibles" description="La fuente autorizada no devolvió trabajos para esta sesión." />}
      <label className="grid min-w-0 gap-2 text-sm text-[var(--muted)]">
        Trabajo autorizado
        <select className={controlClass} value={activeJobId} disabled={jobs.loading || !jobs.data?.length} onChange={(event) => {
          setSelectedJobId(event.target.value); setKind(""); setStatus(""); setMilestoneId("");
        }}>
          <option value="">Selecciona un trabajo</option>
          {(jobs.data ?? []).map((job) => <option key={job.id} value={job.id}>{job.title}</option>)}
        </select>
      </label>
      <div className="flex flex-wrap gap-2">
        {uploadHref && <Link href={uploadHref} className={linkClass}><Upload className="h-4 w-4" aria-hidden />Subir archivo real · abrir módulo<ExternalLink className="h-3 w-3" aria-hidden /></Link>}
        <Link href="/workspace/recorridos-360" className={linkClass}><Camera className="h-4 w-4" aria-hidden />Recorrido 360° · vista local</Link>
      </div>
      {activeJobId ? <>
        {milestones.loading && <PanelState title="Cargando hitos" loading />}
        {milestones.error && <PanelState title={isWorkspaceAccessError(milestones.error, milestones.status) ? "Sin acceso a los hitos" : "Consulta parcial: no se pudieron cargar los hitos"} description={milestones.error} error onRetry={milestones.retry} />}
        {evidence.loading && <PanelState title="Cargando evidencia" loading />}
        {evidence.error && <PanelState title={isWorkspaceAccessError(evidence.error, evidence.status) ? "Sin acceso a la evidencia" : "No se pudo cargar la evidencia"} description={evidence.error} error onRetry={evidence.retry} />}
        {evidence.data && <>
          <div className="grid min-w-0 gap-3 sm:grid-cols-3">
            <label className="grid min-w-0 gap-2 text-sm text-[var(--muted)]">Tipo
              <select className={controlClass} value={kind} onChange={(event) => setKind(event.target.value)}><option value="">Todos los tipos</option>{Object.entries(EVIDENCE_KIND_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select>
            </label>
            <label className="grid min-w-0 gap-2 text-sm text-[var(--muted)]">Estado
              <select className={controlClass} value={status} onChange={(event) => setStatus(event.target.value)}><option value="">Todos los estados</option>{statuses.map((value) => <option key={value} value={value}>{evidenceStatusLabel(value)}</option>)}</select>
            </label>
            <label className="grid min-w-0 gap-2 text-sm text-[var(--muted)]">Hito
              <select className={controlClass} value={milestoneId} onChange={(event) => setMilestoneId(event.target.value)}><option value="">Todos los hitos</option><option value="__none__">Sin hito específico</option>{Array.from(milestoneOptions).map(([id, title]) => <option key={id} value={id}>{title}</option>)}</select>
            </label>
          </div>
          <p className="text-xs text-[var(--muted)]">{filtered.length} de {evidence.data.length} archivos · filtros locales del trabajo seleccionado</p>
          {filtered.length === 0 ? <PanelState title={evidence.data.length ? "Sin coincidencias" : "Sin evidencia registrada"} description={evidence.data.length ? "Cambia los filtros para ver otros archivos del trabajo." : "No se devolvieron archivos para este trabajo."} /> : <ul className="grid min-w-0 gap-2">
            {filtered.map((row, index) => <li key={evidenceText(row.id) || index} className="flex min-w-0 items-start gap-3 rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4">
              <FileText className="mt-1 h-4 w-4 shrink-0 text-[var(--brand)]" aria-hidden />
              <div className="min-w-0 flex-1 break-words [overflow-wrap:anywhere]">
                <p className="text-sm font-semibold text-[var(--ink)]">{evidenceText(row.filename) || evidenceText(row.key) || `Evidencia ${index + 1}`}</p>
                <p className="mt-1 text-xs text-[var(--muted)]">{EVIDENCE_KIND_LABELS[evidenceText(row.kind).toUpperCase()] || evidenceText(row.kind) || "Tipo no disponible"} · {evidenceStatusLabel(evidenceStatus(row))}</p>
                <p className="mt-1 text-xs text-[var(--muted)]">{milestoneOptions.get(evidenceText(row.milestoneId)) || "Sin hito específico"}</p>
              </div>
            </li>)}
          </ul>}
        </>}
      </> : !jobs.error && !jobs.loading && Boolean(jobs.data?.length) && <PanelState title="Selecciona un trabajo" description="La evidencia se consulta solo después de elegir un trabajo de la lista accesible." />}
    </section>
  );
}
