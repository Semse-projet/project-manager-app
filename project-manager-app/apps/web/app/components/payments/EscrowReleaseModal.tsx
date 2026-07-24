"use client";

import { useEffect, useId, useRef, useState } from "react";
import { AlertTriangle, LockKeyhole, X } from "lucide-react";

interface EscrowReleaseModalProps {
  milestoneTitle: string;
  amount: number;
  currency?: string;
  onClose: () => void;
  onConfirm: () => Promise<void>;
}

function formatCurrency(amount: number, currency: string): string {
  try {
    return new Intl.NumberFormat("es-MX", {
      style: "currency",
      currency,
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(amount);
  } catch {
    return `${amount.toFixed(2)} ${currency}`;
  }
}

export function EscrowReleaseModal({
  milestoneTitle,
  amount,
  currency = "USD",
  onClose,
  onConfirm,
}: EscrowReleaseModalProps) {
  const titleId = useId();
  const descriptionId = useId();
  const confirmButtonRef = useRef<HTMLButtonElement>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const hasValidAmount = Number.isFinite(amount) && amount > 0;

  useEffect(() => {
    confirmButtonRef.current?.focus();

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape" && !submitting) onClose();
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onClose, submitting]);

  async function handleConfirm() {
    if (submitting || !hasValidAmount) return;
    setSubmitting(true);
    setError(null);
    try {
      await onConfirm();
      onClose();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "No se pudo liberar el pago.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-[220] flex items-center justify-center bg-black/70 p-6"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget && !submitting) onClose();
      }}
    >
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={descriptionId}
        className="w-full max-w-md rounded-2xl border border-white/[0.1] bg-[#0d0d20] p-6 shadow-2xl"
      >
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-[0.68rem] font-semibold uppercase tracking-widest text-brand">
              Confirmación financiera
            </p>
            <h2 id={titleId} className="mt-1 text-lg font-bold text-ink">
              Liberar pago
            </h2>
          </div>
          <button
            type="button"
            aria-label="Cerrar confirmación"
            disabled={submitting}
            onClick={onClose}
            className="rounded-lg p-2 text-muted transition-colors hover:bg-white/[0.06] hover:text-ink disabled:opacity-40"
          >
            <X size={18} />
          </button>
        </div>

        <p id={descriptionId} className="mt-3 text-sm leading-6 text-muted">
          Confirma el monto antes de liberar los fondos de este milestone al profesional.
        </p>

        <div className="mt-5 rounded-xl border border-white/[0.08] bg-[#131328] p-4">
          <p className="text-xs font-semibold uppercase tracking-widest text-muted">Milestone</p>
          <p className="mt-1 text-sm font-semibold text-ink">{milestoneTitle}</p>
          <p
            data-testid="escrow-release-amount"
            className="mt-4 font-mono text-2xl font-bold tabular-nums text-brand"
          >
            {hasValidAmount ? formatCurrency(amount, currency) : "Monto no disponible"}
          </p>
          <p className="mt-1 text-xs text-muted">{currency}</p>
        </div>

        <div className="mt-4 flex gap-2 rounded-xl border border-amber-500/20 bg-amber-500/[0.07] p-3">
          <LockKeyhole size={16} className="mt-0.5 shrink-0 text-amber-300" />
          <p className="text-xs leading-5 text-amber-200">
            {hasValidAmount
              ? "Esta acción mueve dinero real y no debe ejecutarse hasta verificar evidencia y aprobación."
              : "No se puede liberar hasta que el milestone tenga un monto válido y visible."}
          </p>
        </div>

        {error ? (
          <div className="mt-4 flex gap-2 rounded-xl border border-red-500/20 bg-red-500/[0.08] p-3">
            <AlertTriangle size={16} className="mt-0.5 shrink-0 text-red-400" />
            <p role="alert" className="text-xs leading-5 text-red-300">{error}</p>
          </div>
        ) : null}

        <div className="mt-6 grid grid-cols-2 gap-3">
          <button
            type="button"
            disabled={submitting}
            onClick={onClose}
            className="rounded-lg border border-white/[0.1] px-4 py-2.5 text-sm font-semibold text-muted transition-colors hover:bg-white/[0.05] hover:text-ink disabled:opacity-40"
          >
            Cancelar
          </button>
          <button
            ref={confirmButtonRef}
            type="button"
            data-testid="escrow-release-confirm"
            disabled={submitting || !hasValidAmount}
            onClick={() => void handleConfirm()}
            className="rounded-lg bg-brand px-4 py-2.5 text-sm font-semibold text-[#0a0a14] transition-colors hover:bg-brand-dim disabled:cursor-not-allowed disabled:opacity-40"
          >
            {submitting ? "Liberando…" : "Confirmar liberación"}
          </button>
        </div>
      </section>
    </div>
  );
}
