// @ts-nocheck
import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../infrastructure/prisma/prisma.service.js';

/**
 * Not registered in any module/controller — unreachable by any real
 * request today (checked 2026-08-27). Its own test file (portfolio.
 * service.test.ts) passes only because it feeds `findMany` synthetic
 * `Project` rows carrying `contractAmount`/`totalSpent` fields that don't
 * exist on the real `Project` model in packages/db/prisma/schema.prisma
 * — against a real Prisma-returned Project, both are always undefined, so
 * every computed field here (totalBudget, totalSpent, remaining,
 * utilizationPercent) would be 0 or NaN, and avgProjectHealth is a bare
 * hardcoded 85. No approved spec references a "portfolio" feature, so
 * this wasn't redesigned — just flagged so nobody wires it up trusting
 * the passing tests.
 */
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

  async getRiskSummary(_userId: string): Promise<{ highRisk: number; mediumRisk: number; lowRisk: number }> {
    return { highRisk: 0, mediumRisk: 2, lowRisk: 3 };
  }
}
