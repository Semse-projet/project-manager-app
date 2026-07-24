"use client";

import { useState } from "react";
import type {
  EscrowApiStatus as EscrowStatus,
  MilestoneApiStatus as MilestoneStatus,
  EscrowMilestoneView as EscrowMilestone,
  EscrowView,
} from "@semse/schemas";
import { cn } from "../lib/cn";

export type { EscrowStatus, MilestoneStatus, EscrowMilestone, EscrowView };

export function normalizeMilestone(raw: Record<string, unknown>, index: number): EscrowMilestone {
  const id = String(raw.id ?? raw.milestoneId ?? `m-${index}`);
  const title = String(raw.title ?? raw.name ?? `Milestone ${index + 1}`);
  const description = raw.description ? String(raw.description) : undefined;
  const amount = Number(raw.amount ?? raw.value ?? 0);
  const rawStatus = String(raw.status ?? "DRAFT").toUpperCase();
  const status = (rawStatus === "PENDING" ? "DRAFT" : rawStatus) as MilestoneStatus;
  const sequence = Number(raw.sequence ?? raw.order ?? index + 1);
  const dueDate = raw.dueDate ? String(raw.dueDate) : undefined;
  const completedAt = raw.completedAt ?? raw.approvedAt
    ? String(raw.completedAt ?? raw.approvedAt)
    : undefined;
  const reviewDecision = raw.reviewDecision ? String(raw.reviewDecision) : undefined;
  const rejectionReason = raw.rejectionReason ? String(raw.rejectionReason) : undefined;
  const evidenceCount = raw.evidenceCount != null ? Number(raw.evidenceCount) : undefined;

  return { id, title, description, amount, status, sequence, dueDate, completedAt, reviewDecision, rejectionReason, evidenceCount };
}

export function normalizeEscrow(
  raw: Record<string, unknown>,
  jobId: string,
  milestones: EscrowMilestone[]
): EscrowView {
  return {
    id: raw.id ? String(raw.id) : undefined,
    jobId,
    status: String(raw.status ?? "PENDING").toUpperCase() as EscrowStatus,
    totalAmount: Number(raw.totalAmount ?? raw.amount ?? raw.fundedAmount ?? 0),
    releasedAmount: Number(raw.releasedAmount ?? raw.released ?? 0),
    availableAmount: Number(raw.availableAmount ?? raw.available ?? 0),
    currency: String(raw.currency ?? "USD"),
    milestones,
  };
}

const escrowStatusConfig: Record<EscrowStatus, { label: string; color: string; bg: string }> = {
  PENDING:            { label: "Pendiente de fondos", color: "text-amber-400", bg: "bg-amber-500/10 border-amber-500/20" },
  FUNDED:             { label: "Fondos depositados", color: "text-emerald-400", bg: "bg-emerald-500/10 border-emerald-500/20" },
  HELD:               { label: "En custodia", color: "text-brand", bg: "bg-brand/10 border-brand/20" },
  PARTIALLY_RELEASED: { label: "Parcialmente liberado", color: "text-emerald-400", bg: "bg-emerald-500/10 border-emerald-500/20" },
  RELEASED:           { label: "Completado", color: "text-emerald-400", bg: "bg-emerald-500/10 border-emerald-500/20" },
  DISPUTED:           { label: "En disputa", color: "text-red-400", bg: "bg-red-500/10 border-red-500/20" },
  REFUNDED:           { label: "Reembolsado", color: "text-muted", bg: "bg-white/[0.04] border-white/[0.08]" },
};

const milestoneStatusConfig: Record<MilestoneStatus, { label: string; color: string; bg: string; dot: string }> = {
  DRAFT: { label: "Borrador", color: "text-muted", bg: "bg-white/[0.06]", dot: "bg-white/20" },
  AWAITING_REVIEW: { label: "Esperando Revisión", color: "text-amber-400", bg: "bg-amber-500/10", dot: "bg-amber-400 animate-pulse" },
  SUBMITTED: { label: "En revisión", color: "text-amber-400", bg: "bg-amber-500/10", dot: "bg-amber-400 animate-pulse" },
  APPROVED: { label: "Aprobado", color: "text-brand", bg: "bg-brand/10", dot: "bg-brand" },
  PAID: { label: "Pagado", color: "text-emerald-400", bg: "bg-emerald-500/10", dot: "bg-emerald-400" },
  REJECTED: { label: "Rechazado", color: "text-red-400", bg: "bg-red-500/10", dot: "bg-red-400" },
};

function formatCurrency(amount: number, currency = "USD"): string {
  return new Intl.NumberFormat("es-MX", {
    style: "currency",
    currency,
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("es-MX", {
    day: "numeric", month: "short", year: "numeric",
  });
}

interface EscrowTimelineProps {
  escrow: EscrowView;
  onReleaseMilestone?: (milestoneId: string) => Promise<void>;
  onDispute?: () => Promise<void>;
  releasingId?: string | null;
  disputing?: boolean;
}

export function EscrowTimeline({
  escrow,
  onReleaseMilestone,
  onDispute,
  releasingId = null,
  disputing = false,
}: EscrowTimelineProps) {
  const statusCfg = escrowStatusConfig[escrow.status] ?? escrowStatusConfig.PENDING;
  const paidCount = escrow.milestones.filter((m) => m.status === "PAID").length;
  const totalCount = escrow.milestones.length;
  const progress = totalCount > 0 ? (paidCount / totalCount) * 100 : 0;

  return (
    <div className="grid gap-4">
      <div className={cn("flex items-center justify-between rounded-xl border p-4", statusCfg.bg)}>
        <div className="flex items-center gap-3">
          <span
            className={cn(
              "inline-block h-2.5 w-2.5 rounded-full",
              escrow.status === "DISPUTED"
                ? "bg-red-400"
                : escrow.status === "RELEASED" || escrow.status === "PARTIALLY_RELEASED"
                  ? "bg-emerald-400"
                  : "bg-brand animate-pulse"
            )}
            aria-hidden
          />
          <div>
            <p className="text-[0.68rem] font-semibold tracking-widest uppercase text-muted">Estado del Escrow</p>
            <p className={cn("text-sm font-semibold", statusCfg.color)}>{statusCfg.label}</p>
          </div>
        </div>
        <div className="text-right">
          <p className="text-[0.68rem] uppercase tracking-widest text-muted">Monto total</p>
          <p className="text-xl font-bold text-ink">{formatCurrency(escrow.totalAmount, escrow.currency)}</p>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-3">
        {[
          { label: "Retenido", value: escrow.totalAmount, accent: false },
          { label: "Disponible", value: escrow.availableAmount, accent: escrow.availableAmount > 0 },
          { label: "Liberado", value: escrow.releasedAmount, accent: false },
        ].map(({ label, value, accent }) => (
          <div
            key={label}
            className={cn(
              "rounded-xl border p-3 text-center",
              accent ? "border-emerald-500/20 bg-emerald-500/[0.06]" : "border-white/[0.07] bg-[#131328]"
            )}
          >
            <p className="text-[0.62rem] font-semibold uppercase tracking-widest text-muted">{label}</p>
            <p className={cn("mt-1 text-lg font-bold", accent ? "text-emerald-400" : "text-ink")}>
              {formatCurrency(value, escrow.currency)}
            </p>
          </div>
        ))}
      </div>

      {totalCount > 0 && (
        <div className="space-y-1.5">
          <div className="flex items-center justify-between text-xs">
            <span className="text-muted">Progreso de milestones</span>
            <span className="tabular-nums text-ink">{paidCount} / {totalCount} pagados</span>
          </div>
          <div className="h-1.5 w-full overflow-hidden rounded-full bg-white/[0.06]">
            <div
              className="h-full rounded-full bg-gradient-to-r from-brand to-emerald-400 transition-all duration-700"
              style={{ width: `${progress}%` }}
              role="progressbar"
              aria-valuenow={progress}
              aria-valuemin={0}
              aria-valuemax={100}
            />
          </div>
        </div>
      )}

      {totalCount > 0 ? (
        <div className="overflow-hidden rounded-xl border border-white/[0.08] bg-[#0d0d20]">
          <div className="border-b border-white/[0.06] px-4 py-3">
            <h3 className="text-xs font-semibold uppercase tracking-widest text-muted">Milestones</h3>
          </div>
          <div className="divide-y divide-white/[0.05]">
            {escrow.milestones
              .sort((a, b) => a.sequence - b.sequence)
              .map((milestone) => (
                <MilestoneRow
                  key={milestone.id}
                  milestone={milestone}
                  currency={escrow.currency ?? "USD"}
                  onRelease={onReleaseMilestone}
                  releasing={releasingId === milestone.id}
                />
              ))}
          </div>
        </div>
      ) : (
        <div className="rounded-xl border border-white/[0.07] bg-[#131328] px-4 py-8 text-center">
          <p className="text-sm text-muted">Sin milestones definidos aún.</p>
          <p className="mt-1 text-xs text-muted/60">Crea milestones desde el detalle del job para trackear pagos.</p>
        </div>
      )}

      {(escrow.status === "HELD" || escrow.status === "PARTIALLY_RELEASED") && onDispute ? (
        <div className="flex justify-end">
          <button
            type="button"
            disabled={disputing}
            onClick={() => void onDispute()}
            className="inline-flex items-center justify-center rounded-md border border-red-500/30 bg-red-500/10 px-3 py-1.5 text-xs text-red-400 transition-all hover:bg-red-500/20 disabled:cursor-not-allowed disabled:opacity-40"
          >
            {disputing ? "Iniciando..." : "Iniciar disputa"}
          </button>
        </div>
      ) : null}
    </div>
  );
}

interface MilestoneRowProps {
  milestone: EscrowMilestone;
  currency: string;
  onRelease?: (id: string) => Promise<void>;
  releasing: boolean;
}

function MilestoneRow({ milestone, currency, onRelease, releasing }: MilestoneRowProps) {
  const cfg = milestoneStatusConfig[milestone.status] ?? milestoneStatusConfig.DRAFT;
  const canRelease = milestone.status === "APPROVED" && onRelease != null;
  // 1.2 — this button used to call onRelease directly with no confirmation
  // and no amount shown before the money moved. A safe fund-side modal
  // (EscrowFundModal, apps/web) exists for funding, but it is not reusable
  // here — this is a release action against a different endpoint with a
  // different, milestone-scoped amount — so a lightweight inline confirm
  // step (same "show the exact amount, require an explicit second click")
  // is added directly in this shared component instead.
  const [confirming, setConfirming] = useState(false);

  return (
    <div className="flex items-start gap-4 px-4 py-4">
      <div className="mt-0.5 flex flex-col items-center gap-1 pt-0.5">
        <span className={cn("h-2.5 w-2.5 shrink-0 rounded-full", cfg.dot)} aria-hidden />
      </div>

      <div className="min-w-0 flex-1">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-[0.68rem] uppercase tracking-widest text-muted">#{milestone.sequence}</span>
              <span className={cn("inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[0.65rem] font-semibold", cfg.bg, cfg.color)}>
                {cfg.label}
              </span>
            </div>
            <p className="mt-0.5 truncate text-sm font-medium text-ink">{milestone.title}</p>
            {milestone.description ? <p className="mt-0.5 line-clamp-2 text-xs text-muted">{milestone.description}</p> : null}
            {milestone.rejectionReason ? (
              <div className="mt-2 rounded bg-red-400/5 border border-red-500/10 p-2 text-[0.65rem] text-red-300 italic">
                {milestone.reviewDecision === "REQUEST_CHANGES" ? "Solicitud de cambios: " : "Motivo de rechazo: "}
                {milestone.rejectionReason}
              </div>
            ) : null}
            {milestone.evidenceCount && milestone.evidenceCount > 0 ? (
              <p className="mt-1 text-xs text-brand/70 flex items-center gap-1">
                <span aria-hidden>📎</span> {milestone.evidenceCount} evidencia(s)
              </p>
            ) : null}
            {milestone.dueDate ? <p className="mt-1 text-xs text-muted/60">Vence: {formatDate(milestone.dueDate)}</p> : null}
            {milestone.completedAt ? <p className="mt-1 text-xs text-emerald-400/70">Pagado: {formatDate(milestone.completedAt)}</p> : null}
          </div>
          <div className="shrink-0 text-right">
            <p className="tabular-nums text-sm font-bold text-ink">{formatCurrency(milestone.amount, currency)}</p>
            {canRelease && !confirming ? (
              <button
                type="button"
                className="mt-2 inline-flex items-center justify-center rounded-md bg-brand px-3 py-1.5 text-xs font-semibold text-[#0a0a14] transition-all hover:bg-brand-dim disabled:cursor-not-allowed disabled:opacity-40"
                disabled={releasing}
                onClick={() => setConfirming(true)}
                aria-label={`Liberar pago de ${milestone.title}`}
              >
                Liberar pago
              </button>
            ) : null}
            {canRelease && confirming ? (
              <div className="mt-2 grid gap-1.5 rounded-md border border-amber-500/25 bg-amber-500/[0.06] p-2 text-left">
                <p className="text-[0.65rem] leading-snug text-amber-200">
                  Confirmar liberación de {formatCurrency(milestone.amount, currency)}
                </p>
                <div className="flex gap-1.5">
                  <button
                    type="button"
                    className="inline-flex flex-1 items-center justify-center rounded-md border border-white/[0.1] bg-transparent px-2 py-1 text-[0.65rem] font-semibold text-ink transition-all hover:bg-white/[0.06] disabled:cursor-not-allowed disabled:opacity-40"
                    disabled={releasing}
                    onClick={() => setConfirming(false)}
                  >
                    Cancelar
                  </button>
                  <button
                    type="button"
                    className="inline-flex flex-1 items-center justify-center rounded-md bg-brand px-2 py-1 text-[0.65rem] font-semibold text-[#0a0a14] transition-all hover:bg-brand-dim disabled:cursor-not-allowed disabled:opacity-40"
                    disabled={releasing}
                    onClick={() => { setConfirming(false); void onRelease(milestone.id); }}
                    aria-label={`Confirmar liberación de pago de ${milestone.title}`}
                  >
                    {releasing ? "Liberando..." : "Confirmar"}
                  </button>
                </div>
              </div>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}
