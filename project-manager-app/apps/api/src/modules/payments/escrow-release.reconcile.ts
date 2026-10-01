import { classifyStalePendingRelease } from "./escrow-release.command.js";

/**
 * ADR-041 slice 2b — informe de reconciliacion proveedor<->DB para RELEASE
 * PENDING estancados. SOLO LECTURA: no cambia estados ni llama al proveedor.
 * Un release PENDING/unknown bloquea los reintentos del milestone, asi que un
 * operador debe resolverlo contra el proveedor (runbook ESCROW_RELEASE_RECONCILIATION).
 */
export type StalePendingRow = {
  id: string;
  milestoneId: string | null;
  providerRef: string;
  amount: number;
  createdAt: Date;
};

export type ReconcileClassification = "stale_no_provider_ref" | "stale_awaiting_webhook";

export type ReconcileItem = {
  transactionId: string;
  milestoneId: string | null;
  amount: number;
  ageMinutes: number;
  classification: ReconcileClassification;
  /** Clave para buscar la transferencia en el proveedor (metadata/externalRef), si la reserva nunca recibio providerRef. */
  providerSearchKey: string | null;
  providerRef: string | null;
  action: string;
};

export type ReconcileReport = {
  generatedAt: string;
  staleAfterMinutes: number;
  total: number;
  counts: Record<ReconcileClassification, number>;
  items: ReconcileItem[];
};

export function buildReconciliationReport(
  rows: StalePendingRow[],
  now: Date,
  staleAfterMs: number,
): ReconcileReport {
  const counts: Record<ReconcileClassification, number> = { stale_no_provider_ref: 0, stale_awaiting_webhook: 0 };
  const items: ReconcileItem[] = [];

  for (const row of rows) {
    const classification = classifyStalePendingRelease(row, now, staleAfterMs);
    if (classification === "fresh") continue;
    counts[classification] += 1;
    const noRef = classification === "stale_no_provider_ref";
    items.push({
      transactionId: row.id,
      milestoneId: row.milestoneId,
      amount: row.amount,
      ageMinutes: Math.floor((now.getTime() - row.createdAt.getTime()) / 60_000),
      classification,
      providerSearchKey: noRef ? row.providerRef : null,
      providerRef: noRef ? null : row.providerRef,
      action: noRef
        ? "Buscar en el proveedor por la referencia de reserva (externalRef/metadata). Si existe la transferencia: confirmar como SUCCEEDED con su id real; si NO existe: marcar FAILED. No reintentar el milestone antes."
        : "Verificar el estado del payout en el proveedor por providerRef; si el webhook se perdio, reenviarlo o resolver a mano segun el runbook.",
    });
  }

  items.sort((a, b) => b.ageMinutes - a.ageMinutes);
  return {
    generatedAt: now.toISOString(),
    staleAfterMinutes: Math.round(staleAfterMs / 60_000),
    total: items.length,
    counts,
    items,
  };
}
