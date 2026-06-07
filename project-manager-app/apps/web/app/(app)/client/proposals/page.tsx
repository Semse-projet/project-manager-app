"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { AlertTriangle, CheckCircle2, ChevronRight, DollarSign, RefreshCw, Send, Users } from "lucide-react";
import { ClientPageHeader } from "../../../components/client/ClientPageHeader";
import { NotificationBanner } from "../../../components/notifications/NotificationBanner";
import { acceptBid, fetchJobBids, fetchJobs, type BidView, type JobRecordView } from "../../../semse-api";

const TENANT_ID = process.env.NEXT_PUBLIC_SEMSE_TENANT_ID ?? "default";

type JobWithBids = {
  job: JobRecordView;
  bids: BidView[];
};

function money(v: number | null | undefined) {
  if (!v) return null;
  return `$${Math.round(v).toLocaleString()}`;
}

function budgetLabel(bid: BidView) {
  if (!bid.budgetMin && !bid.budgetMax) return "Sin presupuesto";
  if (bid.budgetMin && bid.budgetMax) return `${money(bid.budgetMin)} – ${money(bid.budgetMax)}`;
  return money(bid.budgetMin ?? bid.budgetMax) ?? "—";
}

export default function ClientProposalsPage() {
  const [jobsWithBids, setJobsWithBids] = useState<JobWithBids[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [accepting, setAccepting] = useState<string | null>(null);
  const [acceptError, setAcceptError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const jobs = await fetchJobs();
      const published = (Array.isArray(jobs) ? jobs : []).filter(
        (j: JobRecordView) => j.status === "published" || j.status === "posted"
      );
      const results = await Promise.allSettled(
        published.map(async (j: JobRecordView) => {
          const bids = await fetchJobBids(j.id).catch(() => []);
          return { job: j, bids };
        })
      );
      const withBids = results
        .filter((r): r is PromiseFulfilledResult<JobWithBids> => r.status === "fulfilled")
        .map(r => r.value)
        .filter(jb => jb.bids.length > 0)
        .sort((a, b) => b.bids.length - a.bids.length);
      setJobsWithBids(withBids);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error al cargar propuestas");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  // SSE: auto-reload when new bids arrive
  useEffect(() => {
    if (typeof window === "undefined") return;
    const es = new EventSource(`/api/semse/sse?channels=bids:${TENANT_ID}`);
    es.addEventListener("bid:submitted", () => void load());
    return () => es.close();
  }, [load]);

  async function handleAccept(bid: BidView) {
    setAccepting(bid.id);
    setAcceptError(null);
    try {
      await acceptBid(bid.id);
      await load();
    } catch (e) {
      setAcceptError(e instanceof Error ? e.message : "Error al aceptar propuesta");
    } finally {
      setAccepting(null);
    }
  }

  const totalPending = jobsWithBids.reduce((s, jb) => s + jb.bids.filter(b => b.status === "submitted").length, 0);

  return (
    <div className="mx-auto max-w-4xl px-4 py-8 sm:px-6">
      <ClientPageHeader
        title="Propuestas recibidas"
        subtitle={`${totalPending} propuesta${totalPending !== 1 ? "s" : ""} pendiente${totalPending !== 1 ? "s" : ""} de revisión`}
        breadcrumbs={[{ label: "Propuestas" }]}
        minHeight={76}
        actions={<NotificationBanner audience="client" />}
      />

      {acceptError && (
        <div className="mb-4 rounded-xl border border-red-500/30 bg-red-950/20 p-3 text-sm text-red-200 flex items-center gap-2">
          <AlertTriangle size={14} />{acceptError}
        </div>
      )}

      <div className="mb-4 flex items-center justify-between">
        <p className="text-sm text-muted">
          {loading ? "Cargando..." : jobsWithBids.length === 0 ? "No hay propuestas pendientes en tus trabajos publicados." : `${jobsWithBids.length} trabajo${jobsWithBids.length !== 1 ? "s" : ""} con propuestas`}
        </p>
        <button
          onClick={load}
          className="inline-flex items-center gap-2 rounded-lg border border-white/[0.08] px-3 py-2 text-sm text-muted hover:text-ink"
        >
          <RefreshCw size={13} className={loading ? "animate-spin" : ""} />
          Actualizar
        </button>
      </div>

      {loading ? (
        <div className="grid gap-3">
          {[1, 2, 3].map(i => <div key={i} className="h-24 rounded-xl border border-white/[0.08] bg-white/[0.02] animate-pulse" />)}
        </div>
      ) : jobsWithBids.length === 0 ? (
        <div className="rounded-xl border border-white/[0.08] bg-white/[0.02] p-8 text-center">
          <Users size={32} className="mx-auto mb-3 text-muted" />
          <p className="font-semibold text-muted text-sm">Sin propuestas aún</p>
          <p className="text-xs text-muted mt-1">Las propuestas de profesionales aparecerán aquí cuando apliquen a tus trabajos publicados.</p>
          <Link href="/client/jobs/new" className="mt-4 inline-flex items-center gap-2 rounded-lg bg-brand px-4 py-2 text-sm font-bold text-[#0a0a14]">
            Publicar trabajo →
          </Link>
        </div>
      ) : (
        <div className="grid gap-6">
          {jobsWithBids.map(({ job, bids }) => {
            const submitted = bids.filter(b => b.status === "submitted");
            const accepted = bids.filter(b => b.status === "accepted");
            return (
              <section key={job.id} className="rounded-xl border border-white/[0.08] bg-white/[0.02]">
                {/* Job header */}
                <div className="flex items-center justify-between gap-4 px-5 py-4 border-b border-white/[0.06]">
                  <div>
                    <h2 className="font-bold text-ink text-base">{job.title}</h2>
                    <p className="text-xs text-muted mt-0.5">
                      {submitted.length} pendiente{submitted.length !== 1 ? "s" : ""}
                      {accepted.length > 0 ? ` · ${accepted.length} aceptada${accepted.length !== 1 ? "s" : ""}` : ""}
                    </p>
                  </div>
                  <Link
                    href={`/client/jobs/${job.id}`}
                    className="inline-flex items-center gap-1 text-xs text-muted hover:text-ink"
                  >
                    Ver proyecto <ChevronRight size={12} />
                  </Link>
                </div>

                {/* Bids list */}
                <div className="divide-y divide-white/[0.05]">
                  {bids.map(bid => {
                    const isSubmitted = bid.status === "submitted";
                    const isAccepted = bid.status === "accepted";
                    return (
                      <div key={bid.id} className="flex items-start gap-4 px-5 py-4">
                        <div className="flex-1 min-w-0">
                          <div className="flex flex-wrap items-center gap-2 mb-1">
                            <span className="text-sm font-semibold text-ink">
                              {bid.proName ?? bid.proEmail ?? `Profesional ${bid.proUserId.slice(-6)}`}
                            </span>
                            {isAccepted && (
                              <span className="rounded-full border border-green-500/30 bg-green-950/20 px-2 py-0.5 text-xs font-bold text-green-300">
                                Aceptada
                              </span>
                            )}
                            {!isSubmitted && !isAccepted && (
                              <span className="rounded-full border border-white/[0.08] px-2 py-0.5 text-xs text-muted capitalize">
                                {bid.status}
                              </span>
                            )}
                          </div>
                          {(bid.budgetMin ?? bid.budgetMax) && (
                            <p className="text-xs text-green-400 font-semibold flex items-center gap-1 mb-1">
                              <DollarSign size={10} />{budgetLabel(bid)}
                            </p>
                          )}
                          {bid.note && (
                            <p className="text-xs text-muted leading-relaxed line-clamp-2">{bid.note}</p>
                          )}
                          {bid.availableFrom && (
                            <p className="text-xs text-muted mt-1">
                              Disponible desde: {new Date(bid.availableFrom).toLocaleDateString("es-MX", { day: "2-digit", month: "short" })}
                            </p>
                          )}
                        </div>
                        {isSubmitted && (
                          <button
                            onClick={() => void handleAccept(bid)}
                            disabled={accepting === bid.id}
                            className="inline-flex items-center gap-2 rounded-xl bg-green-600 px-3 py-2 text-xs font-bold text-white hover:bg-green-500 disabled:opacity-60 shrink-0"
                          >
                            <CheckCircle2 size={12} />
                            {accepting === bid.id ? "Aceptando..." : "Aceptar"}
                          </button>
                        )}
                        {isAccepted && (
                          <Send size={14} className="text-green-400 shrink-0 mt-1" />
                        )}
                      </div>
                    );
                  })}
                </div>
              </section>
            );
          })}
        </div>
      )}
    </div>
  );
}
