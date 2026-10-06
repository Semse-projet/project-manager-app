/**
 * Cifras de escrow del contexto operativo de Prometeo (hallazgo 0.45).
 *
 * Antes el contexto inventaba el dinero: `escrowReleased` era siempre 0 y `pendingRelease` era el 30 % del escrow total
 * si había algún hito aprobado (o, con proyecto, `escrow × aprobados / hitos`), y el chat lo presentaba como "elegibles
 * para liberación". Ahora se deriva solo de transacciones CONFIRMADAS (`SUCCEEDED`), la misma definición que
 * `FinanceRepository.getProjectSummary`:
 *
 *   fondeado   = Σ DEPOSIT  SUCCEEDED
 *   liberado   = Σ RELEASE  SUCCEEDED
 *   reembolsado= Σ REFUND   SUCCEEDED
 *   retenido   = max(0, fondeado − liberado − reembolsado)   ← lo que sigue en escrow (campo `pendingRelease`)
 *
 * `pendingRelease` NO significa "elegible": es dinero aún retenido. Que un hito esté listo para liberar lo decide
 * `MilestonesRepository.computePaymentReadiness`, no esta cifra.
 */
export type EscrowTxnLike = { type: string; amount: unknown; status: string };

export type EscrowFigures = { escrowFunded: number; escrowReleased: number; pendingRelease: number };

function toNumber(value: unknown): number {
  const n = Number(value ?? 0);
  return Number.isFinite(n) ? n : 0;
}

export function computeEscrowFigures(transactions: ReadonlyArray<EscrowTxnLike>): EscrowFigures {
  const confirmed = (type: string) =>
    transactions.filter((t) => t.type === type && t.status === "SUCCEEDED").reduce((sum, t) => sum + toNumber(t.amount), 0);
  const escrowFunded = confirmed("DEPOSIT");
  const escrowReleased = confirmed("RELEASE");
  const refunded = confirmed("REFUND");
  return { escrowFunded, escrowReleased, pendingRelease: Math.max(0, escrowFunded - escrowReleased - refunded) };
}
