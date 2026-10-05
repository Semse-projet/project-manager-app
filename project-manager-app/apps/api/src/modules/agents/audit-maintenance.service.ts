import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from "@nestjs/common";
import { AgentApprovalService } from "./agent-approval.service.js";
import { ToolGovernanceRepository } from "../prometeo/tool-governance/tool-governance.repository.js";
import { resolveAuditLifecycleMode, resolveRetentionDays } from "../prometeo/tool-governance/tool-call-audit.js";

/**
 * H05 (entrega B) — barridos de mantenimiento, todos idempotentes:
 *  - ejecuciones de tools que llevan demasiado en `started` ⇒ `failed / INTERRUPTED` (caída del proceso);
 *  - contenido redactado vencido ⇒ se borra (se conservan digest, estado y tiempos);
 *  - aprobaciones del copiloto `EXECUTING` caducadas ⇒ `FAILED / INTERRUPTED`, y aprobadas que nunca llegaron a
 *    ejecutarse ⇒ `FAILED / NOT_EXECUTED`. NO se reintenta ningún efecto solo (decisión D2): lo decide un humano.
 *
 * Con `PROMETEO_TOOL_AUDIT_LIFECYCLE=off` no hace nada (las columnas pueden no existir aún). Para correr solo en el
 * proceso de la API sin un job de worker, `PROMETEO_TOOL_AUDIT_SWEEP_INTERVAL_MS` (> 0) activa un temporizador; varias
 * instancias en paralelo son inofensivas porque cada barrido es una transición condicional.
 */
@Injectable()
export class AuditMaintenanceService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(AuditMaintenanceService.name);
  private timer: ReturnType<typeof setInterval> | null = null;

  constructor(
    private readonly tools: ToolGovernanceRepository,
    private readonly approvals: AgentApprovalService,
  ) {}

  onModuleInit(): void {
    const interval = Number.parseInt(process.env.PROMETEO_TOOL_AUDIT_SWEEP_INTERVAL_MS ?? "", 10);
    if (!Number.isFinite(interval) || interval <= 0) return;
    this.timer = setInterval(() => void this.runOnce().catch((e) => this.logger.error(`sweep failed: ${String(e)}`)), interval);
    this.timer.unref?.();
  }

  onModuleDestroy(): void {
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
  }

  async runOnce(now: Date = new Date()): Promise<{
    skipped: boolean;
    toolExecutionsInterrupted: number;
    contentPurged: number;
    approvalsInterrupted: number;
    approvalsNotExecuted: number;
  }> {
    if (resolveAuditLifecycleMode() === "off") {
      return { skipped: true, toolExecutionsInterrupted: 0, contentPurged: 0, approvalsInterrupted: 0, approvalsNotExecuted: 0 };
    }
    const afterMs = Number.parseInt(process.env.PROMETEO_TOOL_AUDIT_INTERRUPTED_AFTER_MS ?? "", 10);
    const olderThan = new Date(now.getTime() - (Number.isFinite(afterMs) && afterMs > 0 ? afterMs : 15 * 60_000));

    const toolExecutionsInterrupted = await this.tools.reconcileInterrupted({ olderThan, now, retentionDays: resolveRetentionDays() });
    const contentPurged = await this.tools.purgeExpiredContent(now);
    const approvals = await this.approvals.reconcileExecutions({ olderThan, now });
    if (toolExecutionsInterrupted || approvals.interrupted || approvals.notExecuted) {
      this.logger.warn(
        `sweep: tools interrumpidas=${toolExecutionsInterrupted} aprobaciones interrumpidas=${approvals.interrupted} no ejecutadas=${approvals.notExecuted}`,
      );
    }
    return {
      skipped: false,
      toolExecutionsInterrupted,
      contentPurged,
      approvalsInterrupted: approvals.interrupted,
      approvalsNotExecuted: approvals.notExecuted,
    };
  }
}
