import { Injectable, Logger } from "@nestjs/common";
import { PaymentsRepository } from "./payments.repository.js";
import { buildReconciliationReport, type ReconcileItem, type ReconcileReport } from "./escrow-release.reconcile.js";

export const DEFAULT_RECONCILE_STALE_AFTER_MS = 30 * 60_000;
export const DEFAULT_RECONCILE_REALERT_AFTER_MS = 24 * 60 * 60_000;

export type ReconcileCheckResult = ReconcileReport & { alerted: number; suppressed: number };

/**
 * ADR-041 slice 2b — comprobacion periodica (la dispara el worker) de RELEASE
 * PENDING estancados. Politica del dueño (2026-10-01):
 *   - SOLO LECTURA sobre dinero: jamas cambia el estado de un PaymentTxn /
 *     Milestone / Escrow, ni reintenta ni finaliza nada. La resolucion es humana
 *     (runbook ESCROW_RELEASE_RECONCILIATION).
 *   - Emite una alerta (log estructurado `alert:true`) y un registro de auditoria
 *     append-only, como mucho una vez cada 24 h por transaccion.
 */
@Injectable()
export class EscrowReleaseReconcileService {
  private readonly logger = new Logger(EscrowReleaseReconcileService.name);

  constructor(private readonly paymentsRepository: PaymentsRepository) {}

  async runCheck(options: { staleAfterMs?: number; realertAfterMs?: number; now?: Date } = {}): Promise<ReconcileCheckResult> {
    const now = options.now ?? new Date();
    const staleAfterMs = options.staleAfterMs ?? DEFAULT_RECONCILE_STALE_AFTER_MS;
    const realertAfterMs = options.realertAfterMs ?? DEFAULT_RECONCILE_REALERT_AFTER_MS;

    const rows = await this.paymentsRepository.findStalePendingReleases(new Date(now.getTime() - staleAfterMs));
    const tenantByTxn = new Map(rows.map((r) => [r.id, r.tenantId]));
    const report = buildReconciliationReport(rows, now, staleAfterMs);

    let alerted = 0;
    let suppressed = 0;
    for (const item of report.items) {
      const tenantId = tenantByTxn.get(item.transactionId);
      if (!tenantId) continue;
      const since = new Date(now.getTime() - realertAfterMs);
      if (await this.paymentsRepository.hasRecentReleaseReconcileAlert(item.transactionId, since)) {
        suppressed += 1;
        continue;
      }
      this.logger.error(JSON.stringify(this.alertPayload(item, tenantId)));
      await this.paymentsRepository.recordReleaseReconcileAlert({
        tenantId,
        transactionId: item.transactionId,
        payload: this.alertPayload(item, tenantId),
      });
      alerted += 1;
    }

    if (report.total === 0) {
      this.logger.log(JSON.stringify({ event: "escrow_release_reconcile_ok", staleAfterMinutes: report.staleAfterMinutes }));
    }
    return { ...report, alerted, suppressed };
  }

  private alertPayload(item: ReconcileItem, tenantId: string) {
    return {
      event: "escrow_release_reconcile_alert",
      alert: true,
      tenantId,
      transactionId: item.transactionId,
      milestoneId: item.milestoneId,
      amount: item.amount,
      ageMinutes: item.ageMinutes,
      classification: item.classification,
      providerSearchKey: item.providerSearchKey,
      providerRef: item.providerRef,
      action: item.action,
    };
  }
}
