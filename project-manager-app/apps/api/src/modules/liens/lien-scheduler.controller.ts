import { Controller, Post, UseGuards, Logger } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { RequirePermissions } from '../../common/permissions.decorator.js';
import { LienAlertsScheduler } from './lien-alerts.scheduler.js';

/**
 * Controlador para ejecutar scheduler manualmente.
 * Útil para testing y debugging.
 *
 * Endpoints:
 * - POST /v1/admin/liens/check-deadlines
 * - POST /v1/admin/liens/reset-alerts (testing)
 */
@Controller('v1/admin/liens')
@UseGuards(AuthGuard('jwt'))
@RequirePermissions('ops:dashboard:write')
export class LienSchedulerController {
  private readonly logger = new Logger(LienSchedulerController.name);

  constructor(private readonly lienAlertsScheduler: LienAlertsScheduler) {}

  /**
   * POST /v1/admin/liens/check-deadlines
   *
   * Ejecutar manualmente el chequeo de deadlines.
   * Normalmente se ejecutaría por cron/BullMQ.
   */
  @Post('check-deadlines')
  async checkDeadlines() {
    this.logger.log('Manual trigger: check-lien-deadlines');

    try {
      await this.lienAlertsScheduler.checkAndAlertDeadlines();

      return {
        success: true,
        message: 'Lien deadlines checked successfully',
      };
    } catch (error) {
      this.logger.error('Failed to check lien deadlines', error);
      throw error;
    }
  }

  /**
   * POST /v1/admin/liens/reset-alerts
   *
   * Reset alertas para testing.
   * Retorna todos los calendarios a estado CREATED.
   */
  @Post('reset-alerts')
  async resetAlerts() {
    this.logger.log('Manual trigger: reset-alerts (testing only)');

    try {
      const count = await this.lienAlertsScheduler.resetAlertsForTesting();

      return {
        success: true,
        message: `Reset ${count} calendars to CREATED`,
        count,
      };
    } catch (error) {
      this.logger.error('Failed to reset alerts', error);
      throw error;
    }
  }
}
