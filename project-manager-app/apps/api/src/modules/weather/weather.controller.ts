import { Controller, Get, Post, Param, UseGuards, Logger } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { RequirePermissions } from '../../common/permissions.decorator.js';
import { WeatherService } from './weather.service.js';

/**
 * WeatherController — Bloque 2.3.A de m2.3-weather.spec.md.
 *
 * El spec define permisos `weather:view`/`weather:log`/`weather:calibrate`,
 * que no existen en packages/auth/src/rbac.ts — el RBAC real de este repo
 * ya tiene `weather:read`/`weather:write` (asignados a CLIENT/PRO/WORKER/
 * OPS_ADMIN) desde antes de este módulo. Se usan esos dos, no se inventan
 * los tres del spec — mismo criterio que el resto de este pase (no
 * inventar nombres fuera de lo ya establecido en el código real).
 */
@Controller()
@UseGuards(AuthGuard('jwt'))
export class WeatherController {
  private readonly logger = new Logger(WeatherController.name);

  constructor(private readonly weatherService: WeatherService) {}

  /**
   * GET /v1/projects/:projectId/weather/alerts
   * Alertas no completadas del proyecto (FORECAST/IMMINENT/ACTIVE).
   */
  @Get('v1/projects/:projectId/weather/alerts')
  @RequirePermissions('weather:read')
  async getActiveAlerts(@Param('projectId') projectId: string) {
    const alerts = await this.weatherService.listActiveAlerts(projectId);
    return { success: true, count: alerts.length, data: alerts };
  }

  /**
   * POST /v1/projects/:projectId/weather/check
   * Disparar manualmente una consulta a Tomorrow.io para este proyecto.
   * Falla con 400 si el job del proyecto no tiene latitude/longitude.
   */
  @Post('v1/projects/:projectId/weather/check')
  @RequirePermissions('weather:write')
  async checkProject(@Param('projectId') projectId: string) {
    this.logger.log(`POST /weather/check: ${projectId}`);
    const alerts = await this.weatherService.checkProjectWeather(projectId);
    return { success: true, count: alerts.length, data: alerts };
  }

  /**
   * POST /v1/admin/weather/check
   * Disparado cada hora por apps/worker/src/main.mjs cuando
   * WEATHER_CHECK_ENABLED=true (kill switch, default off). También
   * disponible para disparo manual (testing/debugging), mismo patrón que
   * POST /v1/admin/liens/check-deadlines.
   */
  @Post('v1/admin/weather/check')
  @RequirePermissions('weather:write')
  async checkAllProjects() {
    this.logger.log('Manual/scheduled trigger: check-all-projects-weather');
    const result = await this.weatherService.checkAllActiveProjectsWeather();
    return { success: true, ...result };
  }
}
