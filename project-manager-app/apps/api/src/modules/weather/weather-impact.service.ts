import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '@semse/db';

/**
 * WeatherImpactService — track impacto de clima en proyecto.
 * Días perdidos, estimación de retrasos, análisis de costos.
 */

@Injectable()
export class WeatherImpactService {
  private readonly logger = new Logger(WeatherImpactService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Obtener impacto total de clima en un proyecto.
   */
  async getWeatherImpact(projectId: string): Promise<{
    totalAlertDays: number;
    affectedTrades: Record<string, number>; // trade → días con alerta
    estimatedDelay: number; // días
    estimatedCost: number; // USD
  }> {
    this.logger.log(`Getting weather impact: ${projectId}`);

    const alerts = await this.prisma.weatherAlert.findMany({
      where: { projectId },
    });

    // Contar días únicos con alertas
    const uniqueDays = new Set(alerts.map((a) => a.date.toISOString().split('T')[0]));
    const totalAlertDays = uniqueDays.size;

    // Contar por trade
    const affectedTrades: Record<string, number> = {};
    for (const alert of alerts) {
      const key = alert.trade;
      affectedTrades[key] = (affectedTrades[key] || 0) + 1;
    }

    // Estimación simple: 1 alerta ≈ 0.5 días perdidos
    const estimatedDelay = Math.ceil(totalAlertDays * 0.5);

    // Estimación de costo: $500/día por proyecto
    const estimatedCost = estimatedDelay * 500;

    return {
      totalAlertDays,
      affectedTrades,
      estimatedDelay,
      estimatedCost,
    };
  }

  /**
   * Generar reporte de impacto de clima.
   */
  async generateImpactReport(projectId: string): Promise<string> {
    const impact = await this.getWeatherImpact(projectId);

    const trades = Object.entries(impact.affectedTrades)
      .map(([trade, days]) => `${trade}: ${days} alert days`)
      .join('\n');

    const report = `
WEATHER IMPACT REPORT
Project: ${projectId}

Total Alert Days: ${impact.totalAlertDays}
Estimated Project Delay: ${impact.estimatedDelay} days
Estimated Cost Impact: $${impact.estimatedCost.toLocaleString()}

Affected Trades:
${trades}

Recommendation:
- Monitor weather forecasts closely
- Have contingency plans for outdoor work
- Consider insurance for weather delays
    `.trim();

    return report;
  }

  /**
   * Calcular productividad reducida por trade debido a clima.
   */
  async getTradeProductivityImpact(projectId: string, trade: string): Promise<{
    alertDays: number;
    estimatedHoursLost: number;
    productivityLoss: number; // %
  }> {
    const alerts = await this.prisma.weatherAlert.findMany({
      where: { projectId, trade },
    });

    const uniqueDays = new Set(alerts.map((a) => a.date.toISOString().split('T')[0]));
    const alertDays = uniqueDays.size;

    // Estimación: 8 horas/día × alertDays
    const estimatedHoursLost = alertDays * 8;

    // Asumiendo 20 días trabajables en un mes típico
    const productivityLoss = (alertDays / 20) * 100;

    return {
      alertDays,
      estimatedHoursLost,
      productivityLoss: Math.round(productivityLoss),
    };
  }
}
