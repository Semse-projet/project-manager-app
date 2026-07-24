"use client";

import { useEffect, useId, useRef, useState } from "react";
import { AlertTriangle, Scale, X } from "lucide-react";

type ClientResolutionType = "pro_favor";

interface DisputeResolutionModalProps {
  disputeLabel: string;
  initialResolution?: string;
  onClose: () => void;
  onConfirm: (resolution: string, resolutionType: ClientResolutionType) => Promise<void>;
}

const DEFAULT_RESOLUTION = "Acuerdo confirmado por el cliente a favor del profesional.";

export function DisputeResolutionModal({
  disputeLabel,
  initialResolution = DEFAULT_RESOLUTION,
  onClose,
  onConfirm,
}: DisputeResolutionModalProps) {
  const titleId = useId();
  const descriptionId = useId();
  const resolutionInputRef = useRef<HTMLTextAreaElement>(null);
  const [resolution, setResolution] = useState(initialResolution.trim() || DEFAULT_RESOLUTION);
  const [acknowledged, setAcknowledged] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    resolutionInputRef.current?.focus();

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape" && !submitting) onClose();
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onClose, submitting]);

  async function handleConfirm() {
    const normalizedResolution = resolution.trim();
    if (!acknowledged || !normalizedResolution || submitting) return;

    setSubmitting(true);
    setError(null);
    try {
      await onConfirm(normalizedResolution, "pro_favor");
      onClose();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "No se pudo resolver la disputa.");
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
        className="w-full max-w-lg rounded-2xl border border-white/[0.1] bg-[#0d0d20] p-6 shadow-2xl"
      >
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-[0.68rem] font-semibold uppercase tracking-widest text-amber-300">
              Acuerdo de disputa
            </p>
            <h2 id={titleId} className="mt-1 text-lg font-bold text-ink">
              Confirmar resolución
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
          {disputeLabel}. Como cliente, solo puedes cerrar por acuerdo a favor del profesional.
          Reembolsos, divisiones y escalamiento requieren intervención de Operaciones.
        </p>

        <div className="mt-5 rounded-xl border border-blue-500/20 bg-blue-500/[0.07] p-4">
          <div className="flex items-center gap-2">
            <Scale size={16} className="text-blue-300" />
            <p className="text-xs font-semibold uppercase tracking-widest text-blue-200">
              Resultado seleccionado
            </p>
          </div>
          <p data-testid="dispute-resolution-outcome" className="mt-2 text-sm font-semibold text-ink">
            A favor del profesional
          </p>
          <p className="mt-1 text-xs leading-5 text-muted">
            La disputa quedará cerrada y el escrow podrá liberar los fondos al profesional.
          </p>
        </div>

        <label className="mt-5 grid gap-2 text-xs font-semibold uppercase tracking-widest text-muted">
          Detalle del acuerdo
          <textarea
            ref={resolutionInputRef}
            data-testid="dispute-resolution-detail"
            rows={3}
            maxLength={1000}
            value={resolution}
            onChange={(event) => setResolution(event.target.value)}
            className="resize-y rounded-lg border border-white/[0.08] bg-[#131328] px-3 py-2 text-sm font-normal normal-case tracking-normal text-ink outline-none transition-colors focus:border-brand"
          />
        </label>

        <label className="mt-4 flex cursor-pointer items-start gap-3 rounded-xl border border-amber-500/20 bg-amber-500/[0.07] p-3">
          <input
            type="checkbox"
            data-testid="dispute-resolution-acknowledgement"
            checked={acknowledged}
            disabled={submitting}
            onChange={(event) => setAcknowledged(event.target.checked)}
            className="mt-0.5 h-4 w-4 accent-amber-400"
          />
          <span className="text-xs leading-5 text-amber-200">
            Entiendo que esta resolución es terminal y favorece financieramente al profesional.
          </span>
        </label>

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
            Mantener abierta
          </button>
          <button
            type="button"
            data-testid="dispute-resolution-confirm"
            disabled={!acknowledged || !resolution.trim() || submitting}
            onClick={() => void handleConfirm()}
            className="rounded-lg bg-amber-400 px-4 py-2.5 text-sm font-semibold text-[#0a0a14] transition-colors hover:bg-amber-300 disabled:cursor-not-allowed disabled:opacity-40"
          >
            {submitting ? "Resolviendo…" : "Confirmar acuerdo"}
          </button>
        </div>
      </section>
    </div>
  );
}
