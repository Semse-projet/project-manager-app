"use client";

import { useCallback, useState } from "react";
import Link from "next/link";
import { ArrowUpRight, Calculator, RefreshCw } from "lucide-react";
import { fetchJobBids, fetchJobs } from "../../semse-api";
import type { WorkspaceRole } from "../lib/workspace-model";
import { isWorkspaceAccessError, useWorkspaceQuery } from "../lib/use-workspace-query";
import {
  budgetBidStatusLabel,
  budgetComparisonLabel,
  compareBidToBudget,
  formatBudgetAmount,
  formatBudgetRange,
  getBudgetLinks,
  readBudgetJobs,
  readJobBids,
  selectJobBids,
} from "../lib/budget-model";
import { PanelState } from "./PanelState";

const linkClass = "inline-flex min-h-11 items-center gap-2 rounded-lg border border-[var(--border)] px-3 py-2 text-sm font-semibold text-[var(--brand)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--brand)]";

export function BudgetPanel({ role }: { role: WorkspaceRole | null }) {
  if (!role) {
    return <PanelState title="Presupuestos no disponibles" description="No se pudo confirmar tu rol. No se consultan trabajos ni se muestran enlaces operativos." />;
  }
  const links = getBudgetLinks(role);
  if (!links.length) {
    return <PanelState title="Presupuestos no disponibles" description="Rol no reconocido. No se consultan trabajos ni se muestran enlaces operativos." />;
  }
  const canReceive = role === "client" || role === "admin";
  return (
    <section className="min-w-0 space-y-5 text-[var(--ink)]" aria-label="Presupuestos y propuestas">
      <header>
        <h2 className="flex items-center gap-2 text-lg font-bold"><Calculator className="h-5 w-5 text-[var(--brand)]" aria-hidden="true" />Presupuestos y propuestas</h2>
        <p className="mt-2 text-sm text-[var(--muted)]">Accesos a módulos existentes y consulta de importes reales. Esta vista no cambia propuestas ni adjudica trabajos.</p>
      </header>
      <nav aria-label="Módulos de presupuestos" className="grid min-w-0 gap-3 sm:grid-cols-2">
        {links.map((link) => (
          <Link key={link.href} href={link.href} className="flex min-h-11 min-w-0 items-start gap-3 rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4 focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--brand)]">
            <div className="min-w-0 flex-1">
              <span className="block text-sm font-semibold text-[var(--brand)]">{link.label}</span>
              <span className="mt-1 block text-xs text-[var(--muted)]">{link.description}</span>
            </div>
            <ArrowUpRight className="h-4 w-4 shrink-0 text-[var(--muted)]" aria-hidden="true" />
          </Link>
        ))}
      </nav>
      <aside className="rounded-xl border border-[var(--border)] bg-[var(--brand-dim)] p-4 text-sm">
        <p className="font-semibold">Estimado preliminar · UNVERIFIED</p>
        <p className="mt-1 text-[var(--muted)]">La confianza heurística del estimador no es verificación técnica ni una cotización vinculante. No sustituye el rango publicado del trabajo ni autoriza contratación. No se envían estos datos automáticamente a Prometeo.</p>
      </aside>
      {canReceive ? <ReceivedBudgetComparison key={role} role={role} /> : (
        <PanelState title="Propuestas propias" description="Consulta tus propuestas enviadas en el módulo profesional. La comparación de propuestas recibidas y la adjudicación no están habilitadas para este rol." />
      )}
    </section>
  );
}

/** Mount only for client/ops. Backend remains authoritative for tenant, org and Job. */
function ReceivedBudgetComparison({ role }: { role: "client" | "admin" }) {
  const [jobId, setJobId] = useState("");
  const loadJobs = useCallback(async () => readBudgetJobs(await fetchJobs()), []);
  const jobs = useWorkspaceQuery(`budget-jobs:${role}`, loadJobs);
  const selectedJob = jobs.data?.find((job) => job.id === jobId) ?? null;
  const loadBids = useCallback(async () => {
    if (!jobId) throw new Error("Selecciona un trabajo autorizado.");
    return readJobBids(await fetchJobBids(encodeURIComponent(jobId)), jobId);
  }, [jobId]);
  const bids = useWorkspaceQuery(selectedJob ? `budget-bids:${role}:${jobId}` : null, loadBids);
  const proposals = selectedJob && bids.data ? selectJobBids(selectedJob.id, bids.data, "job-bids") : [];
  const detailHref = selectedJob ? `/${role === "client" ? "client" : "admin"}/jobs/${encodeURIComponent(selectedJob.id)}` : null;

  return (
    <div className="min-w-0 space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="text-base font-semibold">Comparar propuestas recibidas</h3>
          <p className="mt-1 text-xs text-[var(--muted)]">Un solo Job seleccionado · solo lectura · autorización del backend.</p>
        </div>
        <button type="button" onClick={jobs.retry} disabled={jobs.loading} className={`${linkClass} disabled:opacity-50`} aria-label="Actualizar trabajos">
          <RefreshCw className="h-4 w-4" aria-hidden="true" />Actualizar trabajos
        </button>
      </div>
      {jobs.loading ? <PanelState title="Cargando trabajos" loading /> : jobs.error ? (
        <PanelState title={isWorkspaceAccessError(jobs.error, jobs.status) ? "Sin acceso a los trabajos" : "No se pudieron cargar los trabajos"} description={jobs.error} error onRetry={jobs.retry} />
      ) : jobs.data?.length === 0 ? (
        <PanelState title="Sin trabajos disponibles" description="La consulta autorizada no devolvió trabajos para seleccionar." />
      ) : jobs.data ? (
        <div>
          <label htmlFor="budget-job-selector" className="mb-2 block text-sm font-semibold">Trabajo (Job)</label>
          <select id="budget-job-selector" value={selectedJob?.id ?? ""} onChange={(event) => setJobId(event.target.value)} className="min-h-11 w-full min-w-0 max-w-full rounded-lg border border-[var(--border)] bg-[var(--bg)] px-3 text-sm text-[var(--ink)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--brand)]">
            <option value="">Selecciona un trabajo</option>
            {jobs.data.map((job) => <option key={job.id} value={job.id}>{job.title}</option>)}
          </select>
        </div>
      ) : null}
      {!jobs.loading && !jobs.error && Boolean(jobs.data?.length) && !selectedJob && (
        <PanelState title="Selecciona un trabajo" description="Las propuestas se consultan únicamente después de elegir un Job de la lista autorizada." />
      )}
      {selectedJob && (
        <>
          <div className="min-w-0 rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4">
            <h4 className="break-words font-semibold">{selectedJob.title}</h4>
            <p className="mt-2 break-words text-sm"><span className="text-[var(--muted)]">Rango del trabajo: </span>{formatBudgetRange(selectedJob)}</p>
            <p className="mt-2 text-xs text-[var(--muted)]">Los contratos actuales de Job y Bid no proporcionan moneda. No se supone USD ni otra divisa; sin moneda explícita de ambos y un rango completo, la diferencia económica es indisponible.</p>
            <div className="mt-3 flex flex-wrap gap-2">
              {detailHref && <Link href={detailHref} className={linkClass}>Ver trabajo <ArrowUpRight className="h-4 w-4" aria-hidden="true" /></Link>}
              <button type="button" onClick={bids.retry} disabled={bids.loading} className={`${linkClass} disabled:opacity-50`}><RefreshCw className="h-4 w-4" aria-hidden="true" />Actualizar propuestas</button>
            </div>
          </div>
          {bids.loading ? <PanelState title="Cargando propuestas del trabajo" loading /> : bids.error ? (
            <PanelState title={isWorkspaceAccessError(bids.error, bids.status) ? "Sin acceso a las propuestas de este trabajo" : "No se pudieron cargar las propuestas"} description={bids.error} error onRetry={bids.retry} />
          ) : bids.data && proposals.length === 0 ? (
            <PanelState title="Sin propuestas recibidas" description="El trabajo seleccionado no tiene propuestas en la respuesta autorizada." />
          ) : bids.data ? (
            <div className="grid min-w-0 gap-3" aria-label="Comparación de propuestas del mismo trabajo">
              {proposals.map((bid) => (
                <article key={bid.id} className="min-w-0 rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4">
                  <header className="flex flex-wrap items-start justify-between gap-2">
                    <h4 className="min-w-0 break-all text-sm font-semibold">{bid.proEmail || `Propuesta ${bid.id}`}</h4>
                    <span className="rounded-full border border-[var(--border)] px-2 py-1 text-xs text-[var(--muted)]">{budgetBidStatusLabel(bid.status)}</span>
                  </header>
                  <dl className="mt-3 grid min-w-0 gap-3 text-sm sm:grid-cols-2">
                    <div className="min-w-0"><dt className="text-xs text-[var(--muted)]">Importe propuesto</dt><dd className="mt-1 break-words font-semibold">{formatBudgetAmount(bid.amount, bid.currency)}</dd></div>
                    <div><dt className="text-xs text-[var(--muted)]">Plazo propuesto</dt><dd className="mt-1">{typeof bid.etaDays === "number" && Number.isInteger(bid.etaDays) && bid.etaDays > 0 ? `${bid.etaDays} días` : "Plazo no informado"}</dd></div>
                    <div className="min-w-0 sm:col-span-2"><dt className="text-xs text-[var(--muted)]">Nota de la propuesta</dt><dd className="mt-1 whitespace-pre-wrap break-words">{typeof bid.note === "string" && bid.note.trim() ? bid.note : "Sin nota"}</dd></div>
                    <div className="min-w-0 sm:col-span-2"><dt className="text-xs text-[var(--muted)]">Diferencia frente al rango real</dt><dd className="mt-1 break-words">{budgetComparisonLabel(compareBidToBudget(selectedJob, bid, "job-bids"))}</dd></div>
                  </dl>
                </article>
              ))}
            </div>
          ) : null}
        </>
      )}
    </div>
  );
}
