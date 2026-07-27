import { Injectable } from "@nestjs/common";
import { PrismaService } from "../../infrastructure/prisma/prisma.service.js";

@Injectable()
export class AgroInventoryRepository {
  constructor(private readonly prisma: PrismaService) {}

  // ── Items ─────────────────────────────────────────────────────────────────

  async listItems(farmId: string) {
    return this.prisma.agroInventoryItem.findMany({
      where: { farmId },
      orderBy: { name: "asc" },
    });
  }

  async findItem(itemId: string) {
    return this.prisma.agroInventoryItem.findUnique({ where: { id: itemId } });
  }

  async createItem(input: {
    farmId: string;
    name: string;
    category: string;
    unit: string;
    minimumStock?: number;
    notes?: string;
  }) {
    return this.prisma.agroInventoryItem.create({
      data: {
        farmId: input.farmId,
        name: input.name,
        category: input.category,
        unit: input.unit,
        minimumStock: input.minimumStock,
        notes: input.notes,
      },
    });
  }

  async updateItem(itemId: string, input: {
    name?: string;
    category?: string;
    unit?: string;
    minimumStock?: number | null;
    notes?: string;
  }) {
    return this.prisma.agroInventoryItem.update({
      where: { id: itemId },
      data: {
        ...(input.name !== undefined && { name: input.name }),
        ...(input.category !== undefined && { category: input.category }),
        ...(input.unit !== undefined && { unit: input.unit }),
        ...(input.minimumStock !== undefined && { minimumStock: input.minimumStock }),
        ...(input.notes !== undefined && { notes: input.notes }),
      },
    });
  }

  // ── Movements ─────────────────────────────────────────────────────────────

  async listMovements(farmId: string, itemId?: string) {
    return this.prisma.agroInventoryMovement.findMany({
      where: { farmId, ...(itemId && { itemId }) },
      orderBy: { occurredAt: "desc" },
    });
  }

  async createMovement(input: {
    farmId: string;
    itemId: string;
    movementType: string;
    quantity?: number;
    adjustmentDelta?: number;
    unitCost?: number;
    totalCost?: number;
    relatedTaskId?: string;
    targetType?: string;
    targetId?: string;
    occurredAt: Date;
    notes?: string;
  }) {
    return this.prisma.agroInventoryMovement.create({
      data: {
        farmId: input.farmId,
        itemId: input.itemId,
        movementType: input.movementType,
        quantity: input.quantity,
        adjustmentDelta: input.adjustmentDelta,
        unitCost: input.unitCost,
        totalCost: input.totalCost,
        relatedTaskId: input.relatedTaskId,
        targetType: input.targetType,
        targetId: input.targetId,
        occurredAt: input.occurredAt,
        notes: input.notes,
      },
    });
  }

  async computeStock(itemId: string): Promise<number> {
    const movements = await this.prisma.agroInventoryMovement.findMany({
      where: { itemId },
    });
    let stock = 0;
    for (const m of movements) {
      if (m.movementType === "IN")           stock += Number(m.quantity ?? 0);
      else if (m.movementType === "OUT")     stock -= Number(m.quantity ?? 0);
      else if (m.movementType === "ADJUSTMENT") stock += Number(m.adjustmentDelta ?? 0);
    }
    return stock;
  }

  // ── Cost Entries ──────────────────────────────────────────────────────────

  async listCosts(farmId: string, filters?: { targetType?: string; targetId?: string }) {
    return this.prisma.agroCostEntry.findMany({
      where: {
        farmId,
        ...(filters?.targetType && { targetType: filters.targetType }),
        ...(filters?.targetId && { targetId: filters.targetId }),
      },
      orderBy: { occurredAt: "desc" },
    });
  }

  async createCostEntry(input: {
    farmId: string;
    sourceType: string;
    sourceId?: string;
    targetType: string;
    targetId?: string;
    category: string;
    amount: number;
    currency?: string;
    description?: string;
    occurredAt: Date;
  }) {
    return this.prisma.agroCostEntry.create({
      data: {
        farmId: input.farmId,
        sourceType: input.sourceType,
        sourceId: input.sourceId,
        targetType: input.targetType,
        targetId: input.targetId,
        category: input.category,
        amount: input.amount,
        currency: input.currency ?? "USD",
        description: input.description,
        occurredAt: input.occurredAt,
      },
    });
  }

  async costSummary(farmId: string, since: Date): Promise<{ category: string; total: number }[]> {
    const entries = await this.prisma.agroCostEntry.findMany({
      where: { farmId, occurredAt: { gte: since } },
    });
    const map = new Map<string, number>();
    for (const e of entries) {
      map.set(e.category, (map.get(e.category) ?? 0) + Number(e.amount));
    }
    return [...map.entries()].map(([category, total]) => ({ category, total }));
  }
}
