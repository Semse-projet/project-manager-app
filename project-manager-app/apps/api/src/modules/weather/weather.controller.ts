import { Controller, Get, Post, Param, UseGuards, Logger } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { AuthenticatedAccess } from '../../common/permissions.decorator.js';
import { WeatherAlertService } from './weather-alert.service.js';
import { WeatherMatrixService } from './weather-matrix.service.js';

/**
 * Weather Controller — endpoints para alertas de clima.
 */
@Controller('v1/projects/:projectId/weather')
@UseGuards(AuthGuard('jwt'))
@AuthenticatedAccess('Legacy weather endpoints are JWT-protected and pending granular project permissions.')
export class WeatherController {
  private readonly logger = new Logger(WeatherController.name);

  constructor(
    private readonly weatherAlertService: WeatherAlertService,
    private readonly weatherMatrix: WeatherMatrixService
  ) {}

  /**
   * GET /v1/projects/:projectId/weather/alerts
   * Obtener alertas activas.
   */
  @Get('alerts')
  async getAlerts(@Param('projectId') projectId: string) {
    this.logger.log(`GET /weather/alerts: ${projectId}`);

    const alerts = await this.weatherAlertService.getActiveAlerts(projectId);

    return {
      success: true,
      count: alerts.length,
      data: alerts,
    };
  }

  /**
   * GET /v1/projects/:projectId/weather/alerts/history
   * Obtener historial de alertas (últimos 7 días).
   */
  @Get('alerts/history')
  async getHistory(@Param('projectId') projectId: string) {
    this.logger.log(`GET /weather/alerts/history: ${projectId}`);

    const history = await this.weatherAlertService.getAlertHistory(projectId, 7);

    return {
      success: true,
      count: history.length,
      data: history,
    };
  }

  /**
   * POST /v1/projects/:projectId/weather/check-now
   * Verificar clima ahora (sin esperar scheduler).
   */
  @Post('check-now')
  async checkNow(@Param('projectId') projectId: string) {
    this.logger.log(`POST /weather/check-now: ${projectId}`);

    const result = await this.weatherAlertService.checkAndAlertWeather(projectId);

    return {
      success: true,
      message: `Weather checked: ${result.alerts} alerts`,
      data: result,
    };
  }

  /**
   * GET /v1/projects/:projectId/weather/matrix
   * Obtener matriz de compatibilidad (para UI).
   */
  @Get('matrix')
  async getMatrix(@Param('projectId') projectId: string) {
    this.logger.log(`GET /weather/matrix: ${projectId}`);

    const matrix = this.weatherMatrix.getFullMatrix();

    return {
      success: true,
      count: Object.keys(matrix).length,
      data: matrix,
    };
  }
}
