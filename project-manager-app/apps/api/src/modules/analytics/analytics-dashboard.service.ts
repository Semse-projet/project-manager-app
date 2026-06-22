import { Injectable } from '@nestjs/common';
import { BurnRateService } from '../reporting/burn-rate.service';

@Injectable()
export class AnalyticsDashboardService {
  constructor(private burnRateService: BurnRateService) {}

  async getDashboardMetrics(projectId: string): Promise<any> {
    const burnRate = await this.burnRateService.calculateDailyBurnRate(projectId);
    const etc = await this.burnRateService.calculateETC(projectId);

    return {
      burnRate: burnRate.dailyBurnRate,
      totalSpent: burnRate.totalSpent,
      budgetRemaining: burnRate.budgetRemaining,
      utilizationPercent: Math.round((burnRate.totalSpent / (burnRate.totalSpent + burnRate.budgetRemaining)) * 100),
      daysRemaining: etc.daysRemaining,
      projectedCompletion: etc.projectedCompletionDate,
      onBudget: etc.onBudget,
    };
  }

  async getChartData(projectId: string): Promise<any> {
    return {
      burnChart: [
        { day: 1, spent: 10000 },
        { day: 2, spent: 25000 },
        { day: 3, spent: 38000 },
      ],
      utilizationChart: [
        { trade: 'Electrical', utilization: 85 },
        { trade: 'Plumbing', utilization: 60 },
        { trade: 'Painting', utilization: 40 },
      ],
    };
  }

  async exportReport(projectId: string, format: 'pdf' | 'csv'): Promise<Buffer> {
    const metrics = await this.getDashboardMetrics(projectId);
    if (format === 'csv') {
      return Buffer.from('project,spent,budget,utilization\n' + `${projectId},${metrics.totalSpent},${metrics.totalSpent + metrics.budgetRemaining},${metrics.utilizationPercent}`);
    }
    return Buffer.from('PDF Report');
  }
}
