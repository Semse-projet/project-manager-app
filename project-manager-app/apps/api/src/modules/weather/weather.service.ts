import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import { PrismaService } from '../../infrastructure/prisma/prisma.service.js';
import { TomorrowWeatherClient } from '../../integrations/tomorrow-weather.js';
import { classifyForecastEntry, classifyTradeImpact } from './weather-trade-matrix.js';

/**
 * WeatherService — Bloque 2.3.A de m2.3-weather.spec.md: consulta
 * Tomorrow.io, clasifica el forecast por trade y persiste `WeatherAlert`.
 *
 * NO implementado (fuera de alcance de 2.3.A, ver Bloques 2.3.B/2.3.C del
 * spec): push notifications, auto-halt de tareas, integración con daily
 * log, generación de change orders al completar el evento, calibración de
 * thresholds por región (`weather:calibrate`).
 */
@Injectable()
export class WeatherService {
  private readonly logger = new Logger(WeatherService.name);
  private static readonly IMMINENT_WINDOW_MS = 24 * 60 * 60 * 1000;

  constructor(
    private readonly prisma: PrismaService,
    private readonly weatherClient: TomorrowWeatherClient
  ) {}

  /**
   * Consultar Tomorrow.io para un proyecto y crear/actualizar sus
   * WeatherAlert. Falla explícitamente si el proyecto no tiene
   * coordenadas — nunca adivina una ubicación para una alerta que puede
   * disparar un halt de trabajo real.
   */
  async checkProjectWeather(projectId: string): Promise<unknown[]> {
    const project = await this.prisma.project.findUniqueOrThrow({
      where: { id: projectId },
      select: { id: true, job: { select: { latitude: true, longitude: true } } },
    });

    if (project.job.latitude == null || project.job.longitude == null) {
      throw new BadRequestException(
        `Cannot check weather for project ${projectId}: job has no latitude/longitude — refusing to guess a location.`
      );
    }

    const lat = project.job.latitude.toNumber();
    const lon = project.job.longitude.toNumber();
    const apiKey = process.env.TOMORROW_API_KEY || '';

    const forecast = await this.weatherClient.getWeatherForecast(lat, lon, apiKey);
    const now = Date.now();
    const results: unknown[] = [];

    for (const entry of forecast.hourly) {
      const classifications = classifyForecastEntry(entry);
      if (classifications.length === 0) continue;

      const startTime = new Date(entry.timestamp);
      const endTime = new Date(startTime.getTime() + 60 * 60 * 1000); // Tomorrow.io 1h timestep
      const status = this.deriveStatus(startTime, endTime, now);

      for (const { eventType, severity } of classifications) {
        const { affectedTrades, notCriticalFor } = classifyTradeImpact(eventType);

        const alert = await this.prisma.weatherAlert.upsert({
          where: { projectId_eventType_startTime: { projectId, eventType, startTime } },
          create: {
            projectId,
            eventType,
            severity,
            startTime,
            endTime,
            probability: null,
            maxIntensity: entry.precipitation,
            affectedTrades: affectedTrades as unknown as Prisma.InputJsonValue,
            notCriticalFor: notCriticalFor as unknown as Prisma.InputJsonValue,
            source: 'tomorrow.io',
            status,
          },
          update: {
            severity,
            endTime,
            status,
          },
        });

        results.push(alert);
      }
    }

    this.logger.log(`Weather checked for project ${projectId}: ${results.length} alert(s)`, { projectId });
    return results;
  }

  private deriveStatus(startTime: Date, endTime: Date, now: number): string {
    if (endTime.getTime() <= now) return 'COMPLETED';
    if (startTime.getTime() <= now) return 'ACTIVE';
    if (startTime.getTime() - now <= WeatherService.IMMINENT_WINDOW_MS) return 'IMMINENT';
    return 'FORECAST';
  }

  /** Alertas no completadas de un proyecto, más recientes primero. */
  async listActiveAlerts(projectId: string): Promise<unknown[]> {
    return this.prisma.weatherAlert.findMany({
      where: { projectId, status: { not: 'COMPLETED' } },
      orderBy: { startTime: 'asc' },
    });
  }

  /**
   * Chequear clima para todos los proyectos IN_PROGRESS con coordenadas.
   * Llamado por el scheduler del worker (kill switch WEATHER_CHECK_ENABLED).
   * Un proyecto sin coordenadas o cuya llamada a Tomorrow.io falle se
   * loggea y se salta — no debe tumbar el chequeo del resto de proyectos.
   */
  async checkAllActiveProjectsWeather(): Promise<{ checked: number; skipped: number; failed: number }> {
    const projects = await this.prisma.project.findMany({
      where: { status: 'IN_PROGRESS', job: { latitude: { not: null }, longitude: { not: null } } },
      select: { id: true },
    });

    let checked = 0;
    let failed = 0;

    for (const project of projects) {
      try {
        await this.checkProjectWeather(project.id);
        checked++;
      } catch (error) {
        failed++;
        this.logger.error(`Weather check failed for project ${project.id}`, error);
      }
    }

    const totalActive = await this.prisma.project.count({ where: { status: 'IN_PROGRESS' } });

    return { checked, skipped: totalActive - projects.length, failed };
  }
}
