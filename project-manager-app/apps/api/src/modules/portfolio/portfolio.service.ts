// @ts-nocheck
import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../infrastructure/prisma/prisma.service.js';

@Injectable()
export class PortfolioService {
  private readonly logger = new Logger(PortfolioService.name);

  constructor(private readonly prisma: PrismaService) {}

  async getPortfolioMetrics(userId: string): Promise<any> {
    const projects = await this.prisma.project.findMany({
      where: { ownerId: userId, status: 'ACTIVE' },
    });

    const totalBudget = projects.reduce((sum, p) => sum + (p.contractAmount || 0), 0);
    const totalSpent = projects.reduce((sum, p) => sum + (p.totalSpent || 0), 0);
    const remaining = totalBudget - totalSpent;

    return {
      projectCount: projects.length,
      totalBudget,
      totalSpent,
      remaining,
      utilizationPercent: Math.round((totalSpent / totalBudget) * 100),
      avgProjectHealth: 85, // Placeholder
    };
  }

  async getConsolidatedBurnRate(userId: string): Promise<number> {
    const projects = await this.prisma.project.findMany({
      where: { ownerId: userId, status: 'ACTIVE' },
    });

    const totalSpent = projects.reduce((sum, p) => sum + (p.totalSpent || 0), 0);
    const avgDays = 30; // Simplified

    return Math.round(totalSpent / avgDays);
  }

  async getRiskSummary(userId: string): Promise<{ highRisk: number; mediumRisk: number; lowRisk: number }> {
    return { highRisk: 0, mediumRisk: 2, lowRisk: 3 };
  }
}
