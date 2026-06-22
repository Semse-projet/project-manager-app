import { Injectable, Logger } from '@nestjs/common';

@Injectable()
export class PredictiveAnalyticsService {
  private readonly logger = new Logger(PredictiveAnalyticsService.name);

  /**
   * Forecast project completion date based on burn rate.
   */
  forecastCompletion(daysElapsed: number, budgetSpent: number, budgetTotal: number): Date {
    const dailyBurn = budgetSpent / daysElapsed;
    const daysRemaining = Math.ceil((budgetTotal - budgetSpent) / dailyBurn);
    const completionDate = new Date(Date.now() + daysRemaining * 24 * 60 * 60 * 1000);

    this.logger.log(`Forecasted completion: ${completionDate.toISOString()}`);
    return completionDate;
  }

  /**
   * Risk score: 0-100 (higher = more risky).
   */
  calculateRiskScore(budgetRemaining: number, daysRemaining: number, penalties: number): number {
    let score = 50; // Base

    // Budget pressure
    if (budgetRemaining < 0) score += 30;
    else if (budgetRemaining < 50000) score += 15;

    // Schedule pressure
    if (daysRemaining < 15) score += 20;
    else if (daysRemaining < 30) score += 10;

    // Penalties/disputes
    score += penalties * 5;

    return Math.min(100, score);
  }

  /**
   * Trend analysis: is project improving or worsening?
   */
  analyzeTrend(
    previousBurnRate: number,
    currentBurnRate: number
  ): 'improving' | 'stable' | 'worsening' {
    const diff = ((currentBurnRate - previousBurnRate) / previousBurnRate) * 100;

    if (diff > 10) return 'worsening';
    if (diff < -10) return 'improving';
    return 'stable';
  }
}
