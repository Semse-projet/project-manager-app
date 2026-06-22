import { Injectable, Logger } from '@nestjs/common';
import { BurnRateService } from './burn-rate.service';

/**
 * DrawForecastService — proyectar próximos draws basado en burn rate.
 */

@Injectable()
export class DrawForecastService {
  private readonly logger = new Logger(DrawForecastService.name);

  constructor(private readonly burnRateService: BurnRateService) {}

  /**
   * Forecasr próximos draws (cuándo y cuánto).
   */
  async forecastNextDraws(projectId: string): Promise<
    Array<{
      drawNumber: number;
      estimatedDate: Date;
      estimatedAmount: number;
      riskLevel: 'low' | 'medium' | 'high';
    }>
  > {
    this.logger.log(`Forecasting draws for project: ${projectId}`);

    const burnRate = await this.burnRateService.calculateDailyBurnRate(projectId);
    const etc = await this.burnRateService.calculateETC(projectId);

    // Asumir draws de 25% cada uno (simplified)
    const remainingDrawPercentage = Math.ceil(etc.daysRemaining / 30 * 4); // ~4 draws per 120 days

    const forecast = [];

    for (let i = 1; i <= Math.min(remainingDrawPercentage, 2); i++) {
      const daysUntilDraw = i * 30; // Cada 30 días aprox
      const estimatedDate = new Date(Date.now() + daysUntilDraw * 24 * 60 * 60 * 1000);

      // Risk assessment
      let riskLevel: 'low' | 'medium' | 'high' = 'low';
      if (!etc.onBudget) {
        riskLevel = 'high';
      } else if (burnRate.budgetRemaining < burnRate.dailyBurnRate * 30) {
        riskLevel = 'medium';
      }

      forecast.push({
        drawNumber: 3 + i, // Después del draw 3 (ya que este es forecast)
        estimatedDate,
        estimatedAmount: Math.round(burnRate.dailyBurnRate * 30),
        riskLevel,
      });
    }

    return forecast;
  }

  /**
   * Fecha estimada de liberación de retainage.
   */
  async estimateRetainageReleaseDate(projectId: string): Promise<{
    releaseDate: Date;
    amount: number;
  }> {
    const etc = await this.burnRateService.calculateETC(projectId);

    return {
      releaseDate: etc.projectedCompletionDate,
      amount: 0, // Retainage released on completion
    };
  }
}
