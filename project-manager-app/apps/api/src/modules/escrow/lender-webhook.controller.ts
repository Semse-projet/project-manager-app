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
    @Body() payload: unknown,
    @Headers('x-lender-signature') signature: string
  ) {
    this.logger.log('Received lender webhook');

    const secret = process.env.LENDER_WEBHOOK_SECRET;
    if (!secret) {
      throw new BadRequestException('LENDER_WEBHOOK_SECRET is not configured');
    }

    if (!payload || typeof payload !== 'object') {
      throw new BadRequestException('Invalid webhook payload');
    }

    const rawPayload = payload as Record<string, unknown>;
    const payloadString = JSON.stringify(rawPayload);

    if (typeof signature !== 'string' || !LenderClient.verifyWebhookSignature(payloadString, signature, secret)) {
      this.logger.warn('Invalid lender webhook signature');
      throw new BadRequestException('Invalid signature');
    }

    const event = rawPayload.event;
    const data = rawPayload.data;

    if (typeof event !== 'string') {
      throw new BadRequestException('Missing event in webhook payload');
    }

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
        this.logger.warn(`Unknown lender webhook event: ${event}`);
    }

    return { success: true };
  }

  private getStringField(data: unknown, field: string): string | undefined {
    return data && typeof data === 'object' && typeof (data as Record<string, unknown>)[field] === 'string'
      ? (data as Record<string, unknown>)[field] as string
      : undefined;
  }

  /**
   * Manejar draw approved.
   */
  private async handleDrawApproved(data: unknown): Promise<void> {
    const drawId = this.getStringField(data, 'drawId');
    if (!drawId) {
      this.logger.warn('Lender webhook draw.approved missing drawId');
      return;
    }

    this.logger.log(`Processing draw approval: ${drawId}`);

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
  private async handleDrawRejected(data: unknown): Promise<void> {
    const drawId = this.getStringField(data, 'drawId');
    if (!drawId) {
      this.logger.warn('Lender webhook draw.rejected missing drawId');
      return;
    }

    const reason = this.getStringField(data, 'reason') || 'Rejected by lender';

    this.logger.log(`Processing draw rejection: ${drawId}`);

    try {
      await this.drawService.rejectDraw(drawId, reason);
      this.logger.log(`Draw rejected: ${drawId}`);
    } catch (error) {
      this.logger.error(`Failed to reject draw: ${drawId}`, error);
    }
  }

  /**
   * Manejar project sync.
   */
  private async handleProjectSync(data: unknown): Promise<void> {
    const projectId = this.getStringField(data, 'projectId');
    const status = this.getStringField(data, 'status');

    this.logger.log(`Processing project sync: ${projectId ?? 'unknown'}`, { status });

    // En producción: actualizar project status, etc
    this.logger.log(`Project synced: ${projectId ?? 'unknown'} / ${status ?? 'unknown'}`);
  }
}
