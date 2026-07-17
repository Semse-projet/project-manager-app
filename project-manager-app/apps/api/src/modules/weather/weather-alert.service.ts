import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../infrastructure/prisma/prisma.service.js';
import { WeatherMatrixService } from './weather-matrix.service.js';
import { TomorrowWeatherClient } from '../../integrations/tomorrow-weather.js';

/**
 * WeatherAlertService — generar alertas basadas en clima y matriz de trades.
 * Compara clima actual vs reglas por trade.
 */

@Injectable()
export class WeatherAlertService {
  private readonly logger = new Logger(WeatherAlertService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly weatherMatrix: WeatherMatrixService,
    private readonly weatherClient: TomorrowWeatherClient
  ) {}

  /**
   * Verificar clima y generar alertas para un proyecto.
   */
  async checkAndAlertWeather(projectId: string): Promise<{
    alerts: number;
    trades: string[];
  }> {
    this.logger.log(`Checking weather alerts: ${projectId}`);

    const _project = await this.prisma.project.findUniqueOrThrow({
      where: { id: projectId },
    });

    // Obtener coordenadas del proyecto
    // TODO: parsear address → coordinates
    const lat = -33.8688; // Placeholder: Buenos Aires
    const lon = -56.1665;

    // Obtener clima
    const forecast = await this.weatherClient.getWeatherForecast(
      lat,
      lon,
      process.env.TOMORROW_API_KEY || ''
    );

    if (!forecast.daily || forecast.daily.length === 0) {
      this.logger.warn(`No weather data for ${projectId}`);
      return { alerts: 0, trades: [] };
    }

    const todayWeather = forecast.daily[0];

    // Verificar todos los trades
    const trades = [
      'General Labor',
      'Carpentry',
      'Masonry',
      'Plumbing',
      'HVAC',
      'Electrical',
      'Roofing',
      'Painting',
      'Drywall',
      'Flooring',
      'Framing',
      'Concrete',
      'Excavation',
      'Grading',
      'Landscaping',
      'Demolition',
      'Insulation',
      'Windows/Doors',
      'Siding',
      'Finishes',
    ];

    const affectedTrades: string[] = [];
    let alertCount = 0;

    for (const trade of trades) {
      const score = this.weatherMatrix.evaluateWeatherForTrade(trade, todayWeather);

      // Si score < 40, crear alerta
      if (score < 40) {
        const recommendation = this.weatherMatrix.getRecommendations(trade, todayWeather);

        // Crear o actualizar alerta
        const existing = await this.prisma.weatherAlert.findFirst({
          where: {
            projectId,
            trade,
            date: new Date().toISOString().split('T')[0],
          },
        });

        if (!existing) {
          await this.prisma.weatherAlert.create({
            data: {
              projectId,
              trade,
              date: new Date(),
              score,
              message: recommendation.message,
              weatherCondition: todayWeather.weatherCode,
              temperature: todayWeather.temperature,
              windSpeed: todayWeather.windSpeed,
              precipitation: todayWeather.precipitation,
              status: 'ACTIVE',
            },
          });

          alertCount++;
        }

        affectedTrades.push(trade);
      }
    }

    // Resolver alertas antiguas (> 24 horas)
    await this.prisma.weatherAlert.updateMany({
      where: {
        projectId,
        status: 'ACTIVE',
        date: {
          lt: new Date(Date.now() - 24 * 60 * 60 * 1000),
        },
      },
      data: {
        status: 'RESOLVED',
      },
    });

    this.logger.log(`Weather alerts created: ${alertCount}`, { projectId, trades: affectedTrades });

    return { alerts: alertCount, trades: affectedTrades };
  }

  /**
   * Obtener alertas activas de un proyecto.
   */
  async getActiveAlerts(projectId: string): Promise<any[]> {
    return await this.prisma.weatherAlert.findMany({
      where: { projectId, status: 'ACTIVE' },
      orderBy: { trade: 'asc' },
    });
  }

  /**
   * Obtener historial de alertas.
   */
  async getAlertHistory(projectId: string, days: number = 7): Promise<any[]> {
    const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

    return await this.prisma.weatherAlert.findMany({
      where: { projectId, date: { gte: since } },
      orderBy: { date: 'desc' },
    });
  }
}
