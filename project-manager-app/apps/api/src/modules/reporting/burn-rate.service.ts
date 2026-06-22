// @ts-nocheck
import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../infrastructure/prisma/prisma.service.js';

/**
 * BurnRateService — calcular burn rate (gasto/día vs. budget).
 * ETC (estimate to complete) y alertas.
 */

@Injectable()
export class BurnRateService {
  private readonly logger = new Logger(BurnRateService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Calcular burn rate diario del proyecto.
   */
  async calculateDailyBurnRate(projectId: string): Promise<{
    dailyBurnRate: number; // $/día
    totalSpent: number;
    daysElapsed: number;
    budgetRemaining: number;
  }> {
    const project = await this.prisma.project.findUniqueOrThrow({
      where: { id: projectId },
    });

    // Obtener total gasto de draws + expenses
    const draws = await this.prisma.drawRequest.findMany({
      where: { projectId, status: 'FUNDED' },
    });

    const totalFunded = draws.reduce((sum, d) => sum + d.amount - (d.retainage || 0), 0);

    // Calcular días desde inicio
    const startDate = project.startDate || new Date();
    const today = new Date();
    const daysElapsed = Math.max(
      1,
      Math.floor((today.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24))
    );

    // Burn rate diario
    const dailyBurnRate = totalFunded / daysElapsed;

    // Budget remaining
    const budget = project.contractAmount || 0;
    const budgetRemaining = budget - totalFunded;

    return {
      dailyBurnRate: Math.round(dailyBurnRate),
      totalSpent: totalFunded,
      daysElapsed,
      budgetRemaining,
    };
  }

  /**
   * Calcular ETC (estimate to complete).
   */
  async calculateETC(projectId: string): Promise<{
    daysRemaining: number; // Estimado
    costRemaining: number;
    projectedCompletionDate: Date;
    onBudget: boolean;
  }> {
    const burnRate = await this.calculateDailyBurnRate(projectId);
    const daysRemaining = Math.ceil(burnRate.budgetRemaining / burnRate.dailyBurnRate);

    const projectedCompletionDate = new Date(
      Date.now() + daysRemaining * 24 * 60 * 60 * 1000
    );

    const onBudget = burnRate.budgetRemaining >= 0;

    return {
      daysRemaining,
      costRemaining: burnRate.budgetRemaining,
      projectedCompletionDate,
      onBudget,
    };
  }

  /**
   * Generar alerta si ETC > budget.
   */
  async checkBudgetAlert(projectId: string): Promise<{
    hasAlert: boolean;
    message?: string;
    overByAmount?: number;
  }> {
    const etc = await this.calculateETC(projectId);

    if (!etc.onBudget) {
      return {
        hasAlert: true,
        message: `Project at risk: estimated overage of $${Math.abs(etc.costRemaining).toLocaleString()}`,
        overByAmount: Math.abs(etc.costRemaining),
      };
    }

    return { hasAlert: false };
  }

  /**
   * Forecast: cuánto se gastará si proyecto continúa a burn rate actual.
   */
  async projectFinalCost(projectId: string): Promise<number> {
    const burnRate = await this.calculateDailyBurnRate(projectId);
    const etc = await this.calculateETC(projectId);

    const projectedFinalCost = burnRate.totalSpent + etc.costRemaining;
    return projectedFinalCost;
  }
}
