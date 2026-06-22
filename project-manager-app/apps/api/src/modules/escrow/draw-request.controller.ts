import { Controller, Post, Get, Param, Body, UseGuards, Logger } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { DrawRequestService } from './draw-request.service';

/**
 * DrawRequest Controller — endpoints para draws y retainage.
 */
@Controller('v1/projects/:projectId/draws')
@UseGuards(AuthGuard('jwt'))
export class DrawRequestController {
  private readonly logger = new Logger(DrawRequestController.name);

  constructor(private readonly drawService: DrawRequestService) {}

  /**
   * POST /v1/projects/:projectId/draws
   */
  @Post()
  async createDraw(
    @Param('projectId') projectId: string,
    @Body() body: { amount: number; percentage: number }
  ) {
    this.logger.log(`POST /draws: ${projectId}`);

    const nextDraw = await this.drawService.getNextDrawNumber(projectId);
    const draw = await this.drawService.createDraw(
      projectId,
      nextDraw,
      body.amount,
      body.percentage,
      'user-from-jwt'
    );

    return { success: true, data: draw };
  }

  /**
   * GET /v1/projects/:projectId/draws
   */
  @Get()
  async getDraws(@Param('projectId') projectId: string) {
    this.logger.log(`GET /draws: ${projectId}`);

    const draws = await this.drawService.getProjectDraws(projectId);

    return { success: true, count: draws.length, data: draws };
  }

  /**
   * POST /v1/projects/:projectId/draws/:drawId/submit
   */
  @Post(':drawId/submit')
  async submitDraw(
    @Param('projectId') projectId: string,
    @Param('drawId') drawId: string
  ) {
    this.logger.log(`POST /draws/:drawId/submit: ${drawId}`);

    const draw = await this.drawService.submitForApproval(drawId, 'user-from-jwt');

    return { success: true, message: 'Draw submitted', data: draw };
  }

  /**
   * POST /v1/projects/:projectId/draws/:drawId/approve [LENDER]
   */
  @Post(':drawId/approve')
  async approveDraw(
    @Param('projectId') projectId: string,
    @Param('drawId') drawId: string
  ) {
    this.logger.log(`POST /draws/:drawId/approve: ${drawId}`);

    const draw = await this.drawService.approveDraw(drawId, 'lender-from-jwt');

    return { success: true, message: 'Draw approved', data: draw };
  }

  /**
   * POST /v1/projects/:projectId/draws/:drawId/fund
   */
  @Post(':drawId/fund')
  async fundDraw(
    @Param('projectId') projectId: string,
    @Param('drawId') drawId: string,
    @Body() body: { transactionId: string }
  ) {
    this.logger.log(`POST /draws/:drawId/fund: ${drawId}`);

    const draw = await this.drawService.fundDraw(drawId, body.transactionId);

    return { success: true, message: 'Draw funded', data: draw };
  }

  /**
   * GET /v1/projects/:projectId/retainage
   */
  @Get('/retainage/summary')
  async getRetainage(@Param('projectId') projectId: string) {
    this.logger.log(`GET /retainage: ${projectId}`);

    const total = await this.drawService.getTotalRetainage(projectId);
    const funded = await this.drawService.getTotalFunded(projectId);

    return {
      success: true,
      data: { totalRetainage: total, totalFunded: funded },
    };
  }
}
