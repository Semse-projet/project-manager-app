import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../infrastructure/prisma/prisma.service.js';

/**
 * ExtendedMetricsService — track 20 main construction trades.
 *
 * 20 Trades:
 * 1. General Labor, 2. Carpentry, 3. Masonry, 4. Plumbing, 5. HVAC,
 * 6. Electrical, 7. Roofing, 8. Painting, 9. Drywall, 10. Flooring,
 * 11. Framing, 12. Concrete, 13. Excavation, 14. Grading, 15. Landscaping,
 * 16. Demolition, 17. Insulation, 18. Windows/Doors, 19. Siding, 20. Finishes
 */

const CONSTRUCTION_TRADES = [
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

@Injectable()
export class ExtendedMetricsService {
  private readonly logger = new Logger(ExtendedMetricsService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Obtener lista de 20 trades.
   */
  getTrades(): string[] {
    return CONSTRUCTION_TRADES;
  }

  /**
   * Registrar horas trabajadas por trade.
   */
  async logTradeHours(
    projectId: string,
    trade: string,
    hours: number,
    cost: number,
    date: Date
  ): Promise<any> {
    this.logger.log(`Logging hours for trade: ${trade}`, { projectId, hours, cost });

    if (!CONSTRUCTION_TRADES.includes(trade)) {
      throw new Error(`Invalid trade: ${trade}`);
    }

    // Crear o actualizar registro
    const metric = await this.prisma.tradeMetric.create({
      data: {
        projectId,
        trade,
        hoursLogged: hours,
        costLogged: cost,
        date,
      },
    });

    return metric;
  }

  /**
   * Obtener métricas agregadas por trade.
   */
  async getTradeMetrics(projectId: string, trade?: string): Promise<any[]> {
    const where: any = { projectId };
    if (trade) {
      where.trade = trade;
    }

    const metrics = await this.prisma.tradeMetric.findMany({
      where,
      orderBy: { date: 'desc' },
    });

    // Agregar por trade
    const aggregated: Record<string, any> = {};

    for (const metric of metrics) {
      if (!aggregated[metric.trade]) {
        aggregated[metric.trade] = {
          trade: metric.trade,
          totalHours: 0,
          totalCost: 0,
          dailyEntries: [],
        };
      }
      aggregated[metric.trade].totalHours += metric.hoursLogged;
      aggregated[metric.trade].totalCost += metric.costLogged;
      aggregated[metric.trade].dailyEntries.push({
        date: metric.date,
        hours: metric.hoursLogged,
        cost: metric.costLogged,
      });
    }

    return Object.values(aggregated);
  }

  /**
   * Calcular % completado por trade (estimado).
   */
  async getTradeProgress(projectId: string): Promise<any[]> {
    const metrics = await this.getTradeMetrics(projectId);

    // Simulación: asignar progress basado en horas/costo
    // En producción: obtener de project plan vs actual
    return metrics.map((m: any) => ({
      trade: m.trade,
      totalHours: m.totalHours,
      totalCost: m.totalCost,
      estimatedProgress: Math.min(100, Math.round((m.totalHours / 40) * 10)), // Simulado
    }));
  }

  /**
   * Obtener resumen de todas las métricas.
   */
  async getSummary(projectId: string): Promise<any> {
    const metrics = await this.getTradeMetrics(projectId);

    const summary = {
      projectId,
      totalTrades: metrics.length,
      totalHours: 0,
      totalCost: 0,
      trades: metrics,
    };

    for (const m of metrics) {
      summary.totalHours += m.totalHours;
      summary.totalCost += m.totalCost;
    }

    return summary;
  }
}
