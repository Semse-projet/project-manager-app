import {
  Controller,
  Post,
  Get,
  Param,
  Body,
  Query,
  UseGuards,
  Logger,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { RequirePermissions } from '../../common/permissions.decorator.js';
import { DailyLogService } from './daily-log.service.js';

/**
 * DailyLogController — endpoints para daily logs.
 */
@Controller('v1/projects/:projectId/evidence/daily-logs')
@UseGuards(AuthGuard('jwt'))
@RequirePermissions('evidence:read')
export class DailyLogController {
  private readonly logger = new Logger(DailyLogController.name);

  constructor(private readonly dailyLogService: DailyLogService) {}

  /**
   * GET /v1/projects/:projectId/evidence/daily-logs
   *
   * Obtener daily logs del proyecto (con paginación opcional).
   */
  @Get()
  async getDailyLogs(
    @Param('projectId') projectId: string,
    @Query('from') from?: string,
    @Query('to') to?: string
  ) {
    this.logger.log(`GET /daily-logs: ${projectId}`);

    const startDate = from ? new Date(from) : undefined;
    const endDate = to ? new Date(to) : undefined;

    const logs = await this.dailyLogService.getDailyLogs(projectId, startDate, endDate);

    return {
      success: true,
      count: logs.length,
      data: logs.map((log) => ({
        id: log.id,
        date: log.logDate,
        photoCount: log.photoCount,
        changesCount: log.changesCount,
        status: log.status,
        signedBy: log.signedBy,
        signedAt: log.signedAt,
      })),
    };
  }

  /**
   * GET /v1/projects/:projectId/evidence/daily-logs/:logId
   *
   * Obtener detalles de un daily log.
   */
  @Get(':logId')
  async getDailyLog(
    @Param('projectId') projectId: string,
    @Param('logId') logId: string
  ) {
    this.logger.log(`GET /daily-logs/:logId: ${logId}`);

    const summary = await this.dailyLogService.getDailyLogSummary(logId);

    return {
      success: true,
      data: summary,
    };
  }

  /**
   * POST /v1/projects/:projectId/evidence/daily-logs/:logId/sign
   *
   * Firmar daily log (capturar firma digital).
   */
  @Post(':logId/sign')
  @RequirePermissions('evidence:write')
  async signDailyLog(
    @Param('projectId') projectId: string,
    @Param('logId') logId: string,
    @Body() body: { signature: string }
  ) {
    this.logger.log(`POST /daily-logs/:logId/sign: ${logId}`);

    const signed = await this.dailyLogService.signDailyLog(
      logId,
      'user-from-jwt', // TODO: obtener del token
      body.signature
    );

    return {
      success: true,
      message: 'Daily log signed successfully',
      data: {
        id: signed.id,
        status: signed.status,
        signedAt: signed.signedAt,
      },
    };
  }

  /**
   * GET /v1/projects/:projectId/evidence/daily-logs/coverage
   *
   * Obtener coverage de daily logs (auditoría).
   * % de días que tienen log creado.
   */
  @Get('/coverage/stats')
  async getLogCoverage(@Param('projectId') projectId: string) {
    this.logger.log(`GET /coverage: ${projectId}`);

    const coverage = await this.dailyLogService.getLogCoverage(projectId);

    return {
      success: true,
      data: coverage,
    };
  }
}
