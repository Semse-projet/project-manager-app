import { Controller, ForbiddenException, Get, NotFoundException, Post, Param, Req, UseGuards, Logger } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { RequirePermissions } from '../../common/permissions.decorator.js';
import { resolveRequestContext } from '../../common/request-context.js';
import { ResourceScopeResolver } from '../../common/resource-scope.resolver.js';
import { normalizeRoles } from '../../common/rbac.js';
import { assertScopeAccess } from '../../common/resource-scope.js';
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

  constructor(
    private readonly weatherService: WeatherService,
    private readonly scopeResolver: ResourceScopeResolver,
  ) {}

  /**
   * C51 etapa 3: las rutas por `projectId` resuelven primero el ProjectScope DENTRO del tenant del actor
   * (otro tenant / inexistente ⇒ 404) y exigen ser la org cliente, la org profesional asignada u OPS_ADMIN
   * (otra org del mismo tenant ⇒ 403). Antes se leía/consultaba por `projectId` sin tenant ni org.
   */
  private async assertProjectAccess(req: { headers?: Record<string, unknown> }, projectId: string): Promise<void> {
    const actor = resolveRequestContext(req);
    const scope = await this.scopeResolver.resolveProjectScope(actor.tenantId, projectId);
    if (!scope) throw new NotFoundException('Project not found');
    assertScopeAccess(actor, scope, 'read', 'Actor cannot access this project', 'Project not found');
  }

  /**
   * GET /v1/projects/:projectId/weather/alerts
   * Alertas no completadas del proyecto (FORECAST/IMMINENT/ACTIVE).
   */
  @Get('v1/projects/:projectId/weather/alerts')
  @RequirePermissions('weather:read')
  async getActiveAlerts(@Req() req: { headers?: Record<string, unknown> }, @Param('projectId') projectId: string) {
    await this.assertProjectAccess(req, projectId);
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
  async checkProject(@Req() req: { headers?: Record<string, unknown> }, @Param('projectId') projectId: string) {
    await this.assertProjectAccess(req, projectId);
    this.logger.log(`POST /weather/check: ${projectId}`);
    const alerts = await this.weatherService.checkProjectWeather(projectId);
    return { success: true, count: alerts.length, data: alerts };
  }

  /**
   * POST /v1/admin/weather/check
   * Disparado cada hora por apps/worker/src/main.mjs cuando
   * WEATHER_CHECK_ENABLED=true (kill switch, default off).
   *
   * C51: procesa TODOS los proyectos activos de TODOS los tenants, así que `weather:write`
   * (que también tienen CLIENT y PRO) no basta. Fail-closed: solo la identidad interna del worker
   * (OPS_ADMIN + EVENT_CONSUMER); un OPS_ADMIN humano, o cualquier otro rol, recibe 403.
   * Mismo patrón de identidad de servicio que `domain-events/:eventId/process`.
   */
  @Post('v1/admin/weather/check')
  @RequirePermissions('weather:write')
  async checkAllProjects(@Req() req: { headers?: Record<string, unknown> }) {
    const actor = resolveRequestContext(req);
    const roles = normalizeRoles(actor.roles);
    if (!roles.includes('OPS_ADMIN') || !roles.includes('EVENT_CONSUMER')) {
      throw new ForbiddenException({
        message: 'Global weather check requires the internal worker service identity',
        requiredRoles: ['OPS_ADMIN', 'EVENT_CONSUMER'],
      });
    }
    this.logger.log('Scheduled trigger: check-all-projects-weather');
    const result = await this.weatherService.checkAllActiveProjectsWeather();
    return { success: true, ...result };
  }
}
