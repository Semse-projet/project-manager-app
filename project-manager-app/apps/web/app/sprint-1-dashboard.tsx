"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { fetchJobs, semseRuntimeEnabled, type JobRecordView } from "./semse-api";
import { Badge, statusVariant } from "../components/ui/badge";
import { MetricCard } from "../components/ui/card";
import { Button } from "../components/ui/button";
import { EmptyState } from "../components/ui/empty-state";
import { FeedbackBanner } from "../components/ui/error-state";
import { MetricCardSkeleton, RowSkeleton } from "../components/ui/skeleton";

function formatStatus(status: string) {
  return status.replace(/_/g, " ");
}

function formatBudget(min?: number | null, max?: number | null) {
  if (!min && !max) return "—";
  if (min && max) return `$${min.toLocaleString()} – $${max.toLocaleString()}`;
  if (min) return `desde $${min.toLocaleString()}`;
  return `hasta $${max!.toLocaleString()}`;
}

type Sprint1DashboardProps = {
  initialJobs?: JobRecordView[];
};

export function Sprint1Dashboard({ initialJobs = [] }: Sprint1DashboardProps) {
  const runtimeEnabled = semseRuntimeEnabled();
  const [jobs, setJobs] = useState<JobRecordView[]>(initialJobs);
  const [loading, setLoading] = useState(initialJobs.length === 0);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      if (!runtimeEnabled) {
        setLoading(false);
        return;
      }

      try {
        const data = await fetchJobs();
        if (!cancelled) {
          setJobs(data);
          setError(null);
        }
      } catch (caught) {
        if (!cancelled) {
          setError(caught instanceof Error ? caught.message : "No se pudieron leer los jobs.");
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    void load();
    return () => {
      cancelled = true;
    };
  }, [runtimeEnabled]);

  const stats = useMemo(() => {
    const posted   = jobs.filter((j) => j.status === "posted").length;
    const reserved = jobs.filter((j) => j.status === "reserved").length;
    const accepted = jobs.filter((j) => j.status === "accepted").length;
    const disputed = jobs.filter((j) => j.status === "dispute").length;
    return { total: jobs.length, posted, reserved, accepted, disputed };
  }, [jobs]);

  return (
    <section aria-label="Jobs dashboard">
      {/* Header */}
      <div className="mb-6 flex items-start justify-between gap-4 flex-wrap">
        <div>
          <p className="text-[0.68rem] font-semibold tracking-widest uppercase text-brand mb-1">
            Sprint 1 · Dashboard shell
          </p>
          <h1 className="text-2xl font-bold tracking-tight text-ink">Flujo visible principal del MVP</h1>
          <p className="mt-1 text-sm text-muted">
            Desde aquí se entiende el circuito demoable: crear job, entrar al detalle, mover milestones,
            registrar evidencia, fondear/release de escrow y abrir/cerrar disputes.
          </p>
        </div>
        <Link href="/jobs/new">
          <Button>+ Nuevo job</Button>
        </Link>
      </div>

      {/* Runtime banner */}
      {!runtimeEnabled ? (
        <div className="mb-6 rounded-xl border border-amber-500/20 bg-amber-500/[0.07] px-4 py-3">
          <p className="text-xs font-semibold text-amber-300">Modo simulación</p>
          <p className="mt-0.5 text-xs text-amber-300/70">
            Configura las variables de entorno del servidor para conectar la API en tiempo real.
          </p>
        </div>
      ) : null}

      {/* Stats */}
      <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
        {loading ? (
          <>
            <MetricCardSkeleton />
            <MetricCardSkeleton />
            <MetricCardSkeleton />
            <MetricCardSkeleton />
          </>
        ) : (
          <>
            <MetricCard label="Total" value={stats.total} />
            <MetricCard label="Posted" value={stats.posted} />
            <MetricCard label="Accepted" value={stats.accepted} />
            <MetricCard
              label="Disputes"
              value={stats.disputed}
              accent={stats.disputed > 0}
            />
          </>
        )}
      </div>

      {/* Messages */}
      {error ? <FeedbackBanner type="error" message={error} /> : null}

      {/* Hidden test attribute */}
      <div data-testid="jobs-count-debug" hidden>{String(jobs.length)}</div>

      {/* Jobs list */}
      <div className="grid gap-2">
        {loading ? (
          <>
            <RowSkeleton />
            <RowSkeleton />
            <RowSkeleton />
          </>
        ) : jobs.length === 0 ? (
          <EmptyState
            title="Sin jobs aún"
            description="Crea el primero para comenzar a gestionar trabajo en la plataforma."
            action={
              <Link href="/jobs/new">
                <Button size="sm">Crear job</Button>
              </Link>
            }
          />
        ) : (
          jobs.slice(0, 8).map((job) => (
            <article
              key={job.id}
              className="group flex items-center justify-between gap-4 rounded-xl border border-white/[0.07] bg-[#0d0d20] px-4 py-3.5 transition-colors hover:border-white/[0.12] hover:bg-[#131328]"
            >
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold text-ink">
                  {job.title}
                </p>
                <p className="mt-0.5 text-xs text-muted">
                  {formatStatus(job.status)} · {formatBudget(job.budgetMin, job.budgetMax)}
                </p>
              </div>
              <div className="flex shrink-0 items-center gap-2 flex-wrap justify-end">
                <Badge variant={statusVariant(job.status)}>
                  {job.status}
                </Badge>
                <Link
                  data-testid={`job-detail-link-${job.id}`}
                  href={`/jobs/${job.id}`}
                  className="ghost-action-button text-xs"
                >
                  Detalle
                </Link>
                <Link
                  href={`/jobs/${job.id}/escrow`}
                  className="ghost-action-button text-xs"
                >
                  Escrow
                </Link>
                <Link
                  href={`/jobs/${job.id}/evidence`}
                  className="ghost-action-button text-xs"
                >
                  Evidence
                </Link>
              </div>
            </article>
          ))
        )}
      </div>
    </section>
  );
}
