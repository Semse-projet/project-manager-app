// @ts-nocheck
import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../infrastructure/prisma/prisma.service.js';
import { WeatherAlertService } from './weather-alert.service.js';

/**
 * WeatherScheduler — ejecutar alertas de clima cada hora.
 */
@Injectable()
export class WeatherScheduler {
  private readonly logger = new Logger(WeatherScheduler.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly weatherAlertService: WeatherAlertService
  ) {}

  /**
   * Verificar clima para todos los proyectos.
   * Ejecutar cada hora.
   */
  async checkAllProjects(): Promise<{
    processed: number;
    alertsCreated: number;
  }> {
    this.logger.log(`Starting weather check for all projects`);

    const projects = await this.prisma.project.findMany({
      where: { status: 'ACTIVE' },
    });

    let alertsCreated = 0;

    for (const project of projects) {
      try {
        const result = await this.weatherAlertService.checkAndAlertWeather(project.id);
        alertsCreated += result.alerts;
      } catch (error) {
        this.logger.error(`Failed to check weather for ${project.id}`, error);
      }
    }

    this.logger.log(`Weather check completed`, {
      processed: projects.length,
      alertsCreated,
    });

    return { processed: projects.length, alertsCreated };
  }
}
