import { Injectable } from "@nestjs/common";
import { PrismaService } from "../../infrastructure/prisma/prisma.service.js";

@Injectable()
export class AgroEconomicsRepository {
  constructor(private readonly prisma: PrismaService) {}

  // ── Production records ─────────────────────────────────────────────────────

  async listProduction(farmId: string, filters?: {
    type?: string;
    targetType?: string;
    targetId?: string;
    from?: Date;
    to?: Date;
  }) {
    return this.prisma.agroProductionRecord.findMany({
      where: {
        farmId,
        ...(filters?.type && { type: filters.type }),
        ...(filters?.targetType && { targetType: filters.targetType }),
        ...(filters?.targetId && { targetId: filters.targetId }),
        ...((filters?.from || filters?.to) && {
          occurredAt: {
            ...(filters.from && { gte: filters.from }),
            ...(filters.to && { lte: filters.to }),
          },
        }),
      },
      orderBy: { occurredAt: "desc" },
    });
  }

  async findProduction(recordId: string) {
    return this.prisma.agroProductionRecord.findUnique({ where: { id: recordId } });
  }

  async createProduction(input: {
    farmId: string;
    targetType: string;
    targetId?: string;
    type: string;
    quantity: number;
    unit: string;
    unitPrice?: number;
    totalValue?: number;
    occurredAt: Date;
    notes?: string;
  }) {
    return this.prisma.agroProductionRecord.create({ data: input });
  }

  async deleteProduction(recordId: string) {
    return this.prisma.agroProductionRecord.delete({ where: { id: recordId } });
  }

  async sumProductionValue(farmId: string, targetType: string, targetId: string) {
    const result = await this.prisma.agroProductionRecord.aggregate({
      where: { farmId, targetType, targetId },
      _sum: { totalValue: true },
    });
    return Number(result._sum.totalValue ?? 0);
  }

  // ── Sale records ───────────────────────────────────────────────────────────

  async listSales(farmId: string, filters?: { targetType?: string; targetId?: string; from?: Date; to?: Date }) {
    return this.prisma.agroSaleRecord.findMany({
      where: {
        farmId,
        ...(filters?.targetType && { targetType: filters.targetType }),
        ...(filters?.targetId && { targetId: filters.targetId }),
        ...((filters?.from || filters?.to) && {
          occurredAt: {
            ...(filters.from && { gte: filters.from }),
            ...(filters.to && { lte: filters.to }),
          },
        }),
      },
      orderBy: { occurredAt: "desc" },
    });
  }

  async createSale(input: {
    farmId: string;
    targetType: string;
    targetId: string;
    buyerName?: string;
    quantity: number;
    saleWeight?: number;
    salePrice: number;
    freightCost?: number;
    commission?: number;
    paymentMethod?: string;
    totalCostBasis?: number;
    netProfit?: number;
    marginPercent?: number;
    currency?: string;
    occurredAt: Date;
    notes?: string;
  }) {
    return this.prisma.agroSaleRecord.create({ data: input });
  }

  // ── Cost aggregation ───────────────────────────────────────────────────────

  async sumCosts(farmId: string, targetType: string, targetId: string) {
    const result = await this.prisma.agroCostEntry.aggregate({
      where: { farmId, targetType, targetId },
      _sum: { amount: true },
    });
    return Number(result._sum.amount ?? 0);
  }

  async sumCostsByTargets(farmId: string, targetType: string) {
    const rows = await this.prisma.agroCostEntry.groupBy({
      by: ["targetId"],
      where: { farmId, targetType },
      _sum: { amount: true },
    });
    const map = new Map<string, number>();
    for (const row of rows) {
      if (row.targetId) map.set(row.targetId, Number(row._sum.amount ?? 0));
    }
    return map;
  }

  async sumProductionByTargets(farmId: string, targetType: string) {
    const rows = await this.prisma.agroProductionRecord.groupBy({
      by: ["targetId"],
      where: { farmId, targetType },
      _sum: { totalValue: true },
    });
    const map = new Map<string, number>();
    for (const row of rows) {
      if (row.targetId) map.set(row.targetId, Number(row._sum.totalValue ?? 0));
    }
    return map;
  }
}
