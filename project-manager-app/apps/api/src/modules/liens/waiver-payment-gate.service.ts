import {Injectable, Logger} from '@nestjs/common';
import { LiensService } from './liens.service.js';

/**
 * WaiverPaymentGateService — verifica waivers antes de liberar escrow.
 * Gate integrado en PaymentGovernanceService.
 */
@Injectable()
export class WaiverPaymentGateService {
  private readonly logger = new Logger(WaiverPaymentGateService.name);

  constructor(private readonly liensService: LiensService) {}

  /**
   * Verificar si se puede liberar escrow.
   * Retorna true si puede proceder, false si debe bloquear.
   */
  async canReleaseEscrow(projectId: string, releaseAmount: number): Promise<boolean> {
    this.logger.debug(`Checking waiver gate for project: ${projectId}`);

    const { canRelease, blockingWaivers } =
      await this.liensService.checkWaiverRequirements(projectId, releaseAmount);

    if (!canRelease) {
      this.logger.warn(`Waiver gate blocked release`, {
        projectId,
        blockingWaivers: blockingWaivers.map((w) => w.id),
      });
      return false;
    }

    return true;
  }

  /**
   * Obtener mensaje de bloqueo si no puede liberar.
   */
  async getBlockingReason(projectId: string, releaseAmount: number): Promise<string | null> {
    const { canRelease, blockingWaivers } =
      await this.liensService.checkWaiverRequirements(projectId, releaseAmount);

    if (!canRelease && blockingWaivers.length > 0) {
      const waiverId = blockingWaivers[0].id;
      const state = blockingWaivers[0].lienCalendar?.stateName || 'Unknown';
      const deadline = blockingWaivers[0].requiredBefore?.toISOString().split('T')[0];

      return `Lien waiver required (${state}) before release. Deadline: ${deadline}. Waiver: ${waiverId}`;
    }

    return null;
  }

  /**
   * Autorizar release solo si waivers están OK.
   * Usado en PaymentGovernanceService.authorizeRelease().
   */
  async authorizeRelease(projectId: string, releaseAmount: number): Promise<{
    approved: boolean;
    reason?: string;
  }> {
    const canRelease = await this.canReleaseEscrow(projectId, releaseAmount);

    if (!canRelease) {
      const reason = await this.getBlockingReason(projectId, releaseAmount);
      return {
        approved: false,
        reason: reason || 'Waiver requirements not met',
      };
    }

    return { approved: true };
  }
}
