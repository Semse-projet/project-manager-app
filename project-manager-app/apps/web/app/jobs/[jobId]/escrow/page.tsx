"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import {
  fetchJobEscrow,
  fetchJobMilestones,
  fundJobEscrow,
  releaseMilestoneEscrow,
  createJobDispute,
  semseRuntimeEnabled,
} from "../../../semse-api";
import {
  EscrowTimeline,
  normalizeEscrow,
  normalizeMilestone,
  type EscrowView,
} from "@semse/ui";
import { Button } from "../../../../components/ui/button";
import { Input } from "../../../../components/ui/input";
import { FeedbackBanner } from "../../../../components/ui/error-state";
import { PageSpinner } from "../../../../components/ui/spinner";

type EscrowPageProps = { params: Promise<{ jobId: string }> };

export default function JobEscrowPage({ params }: EscrowPageProps) {
  const runtimeEnabled = semseRuntimeEnabled();

  const [jobId, setJobId] = useState("");
  const [loading, setLoading] = useState(true);
  const [escrow, setEscrow] = useState<EscrowView | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);

  // Fondear
  const [fundAmount, setFundAmount] = useState("1000");
  const [funding, setFunding] = useState(false);

  // Liberar milestone
  const [releasingId, setReleasingId] = useState<string | null>(null);

  // Disputa
  const [disputing, setDisputing] = useState(false);

  // ── Carga inicial ───────────────────────────────────────────
  const load = useCallback(async (jid: string) => {
    setLoading(true);
    setError(null);
    try {
      const [rawEscrow, rawMilestones] = await Promise.all([
        fetchJobEscrow(jid),
        fetchJobMilestones(jid).catch(() => [] as Record<string, unknown>[]),
      ]);
      const milestones = (rawMilestones as Record<string, unknown>[]).map(normalizeMilestone);
      setEscrow(normalizeEscrow(rawEscrow, jid, milestones));
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "No se pudo cargar el escrow.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const resolved = await params;
      if (cancelled) return;
      setJobId(resolved.jobId);
      await load(resolved.jobId);
    })();
    return () => { cancelled = true; };
  }, [params, load]);

  // ── Fondear escrow ──────────────────────────────────────────
  async function handleFund() {
    if (!jobId || funding) return;
    const parsed = Number(fundAmount);
    if (!Number.isFinite(parsed) || parsed <= 0) {
      setError("El monto debe ser mayor que cero.");
      return;
    }
    setFunding(true);
    setError(null);
    setFeedback(null);
    try {
      await fundJobEscrow(jobId, { amount: parsed, currency: "USD", provider: "mock", methodType: "bank_transfer" });
      setFeedback(`Escrow fondeado: ${parsed} USD.`);
      await load(jobId);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "No se pudo fondear el escrow.");
    } finally {
      setFunding(false);
    }
  }

  // ── Liberar milestone ───────────────────────────────────────
  async function handleReleaseMilestone(milestoneId: string) {
    setReleasingId(milestoneId);
    setError(null);
    setFeedback(null);
    try {
      await releaseMilestoneEscrow(milestoneId);
      setFeedback("Pago liberado correctamente.");
      await load(jobId);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "No se pudo liberar el pago.");
    } finally {
      setReleasingId(null);
    }
  }

  // ── Iniciar disputa ─────────────────────────────────────────
  async function handleDispute() {
    setDisputing(true);
    setError(null);
    setFeedback(null);
    try {
      await createJobDispute({ jobId, reason: "Disputa iniciada desde el panel de escrow." });
      setFeedback("Disputa registrada. El equipo revisará el caso.");
      await load(jobId);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "No se pudo iniciar la disputa.");
    } finally {
      setDisputing(false);
    }
  }

  return (
    <div className="mx-auto w-full max-w-5xl px-4 sm:px-6 py-8">
      {/* Breadcrumb */}
      <nav aria-label="Breadcrumb" className="mb-6 flex items-center gap-2 text-xs text-muted">
        <Link href="/" className="hover:text-brand transition-colors">Jobs</Link>
        <span aria-hidden className="text-white/20">/</span>
        <Link href={`/jobs/${jobId}`} className="hover:text-brand transition-colors">Detalle</Link>
        <span aria-hidden className="text-white/20">/</span>
        <span className="text-ink font-medium">Escrow</span>
      </nav>

      {/* Header */}
      <div className="mb-6">
        <p className="text-[0.68rem] font-semibold tracking-widest uppercase text-brand mb-1">
          Finanzas
        </p>
        <h1 className="text-2xl font-bold tracking-tight text-ink">Escrow</h1>
        <p className="mt-1 text-sm text-muted">
          Gestiona los fondos retenidos y los pagos por milestone.
        </p>
      </div>

      {/* Runtime banner */}
      {!runtimeEnabled && (
        <div className="mb-6 rounded-xl border border-amber-500/20 bg-amber-500/[0.07] px-4 py-3">
          <p className="text-xs font-semibold text-amber-300">Modo simulación</p>
          <p className="mt-0.5 text-xs text-amber-300/70">
            Configura las variables de entorno del servidor para ver el escrow real.
          </p>
        </div>
      )}

      {/* Feedback / Error banners */}
      {error && (
        <div className="mb-4">
          <FeedbackBanner type="error" message={error} />
        </div>
      )}
      {feedback && (
        <div className="mb-4">
          <FeedbackBanner type="success" message={feedback} />
        </div>
      )}

      {loading ? (
        <PageSpinner />
      ) : (
        <div className="grid gap-6 lg:grid-cols-[1fr_300px]">
          {/* ── Main: Timeline visual ─────────────────────── */}
          <div className="grid gap-6">
            {escrow ? (
              <EscrowTimeline
                escrow={escrow}
                onReleaseMilestone={handleReleaseMilestone}
                onDispute={handleDispute}
                releasingId={releasingId}
                disputing={disputing}
              />
            ) : (
              <div className="rounded-xl border border-white/[0.07] bg-[#131328] px-4 py-10 text-center">
                <p className="text-sm text-muted">No hay datos de escrow para este job.</p>
              </div>
            )}
          </div>

          {/* ── Sidebar: Fondear + acciones ───────────────── */}
          <aside className="grid gap-4 content-start">
            {/* Fondear */}
            <div className="rounded-2xl border border-white/[0.08] bg-[#0d0d20] p-5">
              <h2 className="mb-1 text-xs font-semibold uppercase tracking-widest text-muted">
                Fondear escrow
              </h2>
              <p className="mb-4 text-xs text-muted/60">
                Método: bank_transfer · Proveedor: mock
              </p>
              <Input
                label="Monto (USD)"
                data-testid="escrow-amount-input"
                inputMode="decimal"
                value={fundAmount}
                onChange={(e) => setFundAmount(e.target.value)}
              />
              <Button
                className="mt-3 w-full"
                data-testid="fund-escrow-button"
                disabled={!runtimeEnabled || loading}
                loading={funding}
                onClick={() => void handleFund()}
              >
                Fondear escrow
              </Button>
            </div>

            {/* Navegación */}
            <div className="rounded-2xl border border-white/[0.08] bg-[#131328] p-5">
              <p className="mb-3 text-[0.68rem] font-semibold tracking-widest uppercase text-muted">
                Navegación
              </p>
              <div className="grid gap-2">
                <Link href={`/jobs/${jobId}`}>
                  <Button variant="ghost" size="sm" className="w-full justify-start">
                    ← Detalle del job
                  </Button>
                </Link>
                <Link href={`/jobs/${jobId}/evidence`}>
                  <Button variant="ghost" size="sm" className="w-full justify-start">
                    Evidencia
                  </Button>
                </Link>
                <Link href="/">
                  <Button variant="ghost" size="sm" className="w-full justify-start">
                    Todos los jobs
                  </Button>
                </Link>
              </div>
            </div>
          </aside>
        </div>
      )}
    </div>
  );
}
