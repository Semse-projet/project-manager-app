import { Controller, Post, Body, Headers, Logger, BadRequestException } from '@nestjs/common';
import { AuthenticatedAccess } from '../../common/permissions.decorator.js';
import { LenderClient } from '../../integrations/lender-api.js';
import { DrawRequestService } from './draw-request.service.js';

/**
 * Lender Webhook Controller — recibir eventos del lender.
 */
@Controller('v1/webhooks/lender')
@AuthenticatedAccess('Lender webhook currently requires platform auth in addition to lender signature verification.')
export class LenderWebhookController {
  private readonly logger = new Logger(LenderWebhookController.name);

  constructor(
    private readonly lenderClient: typeof LenderClient,
    private readonly drawService: DrawRequestService
  ) {}

  /**
   * POST /v1/webhooks/lender-approval
   *
   * Recibir eventos de lender (draw approvals, rejections, syncs).
   */
  @Post('approval')
  async handleLenderWebhook(
    @Body() payload: any,
    @Headers('x-lender-signature') signature: string
  ) {
    this.logger.log('Received lender webhook');

    // Verificar firma
    const payloadString = JSON.stringify(payload);
    const secret = process.env.LENDER_WEBHOOK_SECRET || '';

    if (!LenderClient.verifyWebhookSignature(payloadString, signature, secret)) {
      this.logger.warn('Invalid webhook signature');
      throw new BadRequestException('Invalid signature');
    }

    // Procesar evento
    const { event, data } = payload;

    switch (event) {
      case 'draw.approved':
        await this.handleDrawApproved(data);
        break;
      case 'draw.rejected':
        await this.handleDrawRejected(data);
        break;
      case 'project.sync':
        await this.handleProjectSync(data);
        break;
      default:
        this.logger.warn(`Unknown event: ${event}`);
    }

    return { success: true };
  }

  /**
   * Manejar draw approved.
   */
  private async handleDrawApproved(data: any): Promise<void> {
    const { drawId, approvalDate } = data;

    this.logger.log(`Processing draw approval: ${drawId}`);

    // Actualizar draw a APPROVED (si estaba PENDING_LENDER)
    try {
      await this.drawService.approveDraw(drawId, 'lender-webhook');
      this.logger.log(`Draw approved: ${drawId}`);
    } catch (error) {
      this.logger.error(`Failed to approve draw: ${drawId}`, error);
    }
  }

  /**
   * Manejar draw rejected.
   */
  private async handleDrawRejected(data: any): Promise<void> {
    const { drawId, reason } = data;

    this.logger.log(`Processing draw rejection: ${drawId}`);

    try {
      await this.drawService.rejectDraw(drawId, reason || 'Rejected by lender');
      this.logger.log(`Draw rejected: ${drawId}`);
    } catch (error) {
      this.logger.error(`Failed to reject draw: ${drawId}`, error);
    }
  }

  /**
   * Manejar project sync.
   */
  private async handleProjectSync(data: any): Promise<void> {
    const { projectId, status, amountFunded } = data;

    this.logger.log(`Processing project sync: ${projectId}`, { status, amountFunded });

    // En producción: actualizar project status, etc
    this.logger.log(`Project synced: ${projectId} / ${status}`);
  }
}
