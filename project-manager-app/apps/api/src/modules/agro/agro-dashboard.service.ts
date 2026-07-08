import { Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../../infrastructure/prisma/prisma.service.js";
import { AgroFarmRepository } from "./agro-farm.repository.js";

export interface AgroAlert {
  type: "OVERDUE_TASK" | "BLOCKED_TASK" | "LOW_STOCK" | "MISSING_EVIDENCE" | "ANIMAL_INACTIVITY";
  severity: "CRITICAL" | "WARNING" | "INFO";
  entityType: string;
  entityId: string;
  message: string;
}

@Injectable()
export class AgroDashboardService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly farmRepo: AgroFarmRepository,
  ) {}

  private async assertFarmAccess(farmId: string, ownerId: string) {
    const farm = await this.farmRepo.findFarm(farmId);
    if (!farm || farm.ownerId !== ownerId) throw new NotFoundException(`Farm not found: ${farmId}`);
    return farm;
  }

  async getDashboard(farmId: string, ownerId: string) {
    const farm = await this.assertFarmAccess(farmId, ownerId);
    const now = new Date();
    const monthAgo = new Date(now.getTime() - 30 * 24 * 3600 * 1000);
    const weekAgo = new Date(now.getTime() - 7 * 24 * 3600 * 1000);

    const [animals, groups, tasks, items, recentAuditEvents, recentEvidence, costEntries, productionEntries, saleEntries] =
      await Promise.all([
        this.prisma.agroAnimal.findMany({ where: { farmId, status: "ACTIVE" } }),
        this.prisma.agroAnimalGroup.findMany({ where: { farmId, status: "ACTIVE" } }),
        this.prisma.agroFarmTask.findMany({ where: { farmId } }),
        this.prisma.agroInventoryItem.findMany({ where: { farmId } }),
        this.prisma.agroAuditEvent.findMany({ where: { farmId }, orderBy: { createdAt: "desc" }, take: 10 }),
        this.prisma.agroEvidenceItem.findMany({ where: { farmId }, orderBy: { capturedAt: "desc" }, take: 5 }),
        this.prisma.agroCostEntry.findMany({ where: { farmId, occurredAt: { gte: monthAgo } } }),
        this.prisma.agroProductionRecord.findMany({ where: { farmId, occurredAt: { gte: monthAgo } } }),
        this.prisma.agroSaleRecord.findMany({ where: { farmId, occurredAt: { gte: monthAgo } } }),
      ]);

    const overdueTasks = tasks.filter(t =>
      ["PENDING", "IN_PROGRESS"].includes(t.status) && t.dueAt && t.dueAt < now
    );
    const blockedTasks = tasks.filter(t => t.status === "BLOCKED");
    const pendingTasks = tasks.filter(t => t.status === "PENDING");
    const completedThisWeek = tasks.filter(t => t.completedAt && t.completedAt >= weekAgo);

    const movements = await this.prisma.agroInventoryMovement.findMany({ where: { farmId } });
    const stockByItem = new Map<string, number>();
    for (const m of movements) {
      const curr = stockByItem.get(m.itemId) ?? 0;
      if (m.movementType === "IN")  stockByItem.set(m.itemId, curr + Number(m.quantity ?? 0));
      else if (m.movementType === "OUT") stockByItem.set(m.itemId, curr - Number(m.quantity ?? 0));
      else stockByItem.set(m.itemId, curr + Number(m.adjustmentDelta ?? 0));
    }
    const lowStockItems = items.filter(item =>
      item.minimumStock != null && (stockByItem.get(item.id) ?? 0) <= Number(item.minimumStock)
    );

    const monthCost = costEntries.reduce((s, e) => s + Number(e.amount), 0);

    const animalValue = (a: { estimatedValue: unknown; acquisitionCost: unknown }) =>
      Number(a.estimatedValue ?? a.acquisitionCost ?? 0);
    const livestockCapital =
      animals.reduce((s, a) => s + animalValue(a), 0) +
      groups.reduce((s, g) => s + animalValue(g), 0);
    const monthProductionIncome = productionEntries.reduce((s, p) => s + Number(p.totalValue ?? 0), 0);
    const monthSalesRevenue = saleEntries.reduce((s, x) => s + Number(x.salePrice), 0);
    const monthIncome = monthProductionIncome + monthSalesRevenue;

    const alerts: AgroAlert[] = [
      ...overdueTasks.map(t => ({
        type: "OVERDUE_TASK" as const,
        severity: "CRITICAL" as const,
        entityType: "AgroFarmTask",
        entityId: t.id,
        message: `Task "${t.title}" is overdue`,
      })),
      ...blockedTasks.map(t => ({
        type: "BLOCKED_TASK" as const,
        severity: "WARNING" as const,
        entityType: "AgroFarmTask",
        entityId: t.id,
        message: `Task "${t.title}" is blocked: ${t.blockReason ?? "no reason"}`,
      })),
      ...lowStockItems.map(item => ({
        type: "LOW_STOCK" as const,
        severity: "WARNING" as const,
        entityType: "AgroInventoryItem",
        entityId: item.id,
        message: `${item.name} stock (${stockByItem.get(item.id) ?? 0} ${item.unit}) at or below minimum (${item.minimumStock})`,
      })),
    ];

    const totalAnimals = animals.length + groups.reduce((s, g) => s + g.count, 0);

    return {
      farm: { id: farm.id, name: farm.name, operationType: farm.operationType },
      counts: {
        animals: animals.length,
        animalGroups: groups.length,
        totalAnimals,
        pendingTasks: pendingTasks.length,
        blockedTasks: blockedTasks.length,
        overdueTasks: overdueTasks.length,
        completedThisWeek: completedThisWeek.length,
        inventoryItems: items.length,
        lowStockItems: lowStockItems.length,
      },
      monthCostSummary: { total: monthCost, since: monthAgo, currency: "USD" },
      capital: { livestock: livestockCapital, currency: "USD" },
      monthIncomeSummary: {
        production: monthProductionIncome,
        sales: monthSalesRevenue,
        total: monthIncome,
        projectedProfit: monthIncome - monthCost,
        since: monthAgo,
        currency: "USD",
      },
      alerts,
      recentActivity: recentAuditEvents,
      recentEvidence,
      nextBestActions: this.computeNextActions(overdueTasks, blockedTasks, lowStockItems),
    };
  }

  private computeNextActions(overdue: any[], blocked: any[], lowStock: any[]) {
    const actions: { priority: number; action: string; detail: string }[] = [];
    if (overdue.length > 0) {
      actions.push({ priority: 1, action: "RESOLVE_OVERDUE_TASKS", detail: `${overdue.length} task(s) overdue` });
    }
    if (blocked.length > 0) {
      actions.push({ priority: 2, action: "UNBLOCK_TASKS", detail: `${blocked.length} task(s) blocked` });
    }
    if (lowStock.length > 0) {
      actions.push({ priority: 3, action: "RESTOCK_INVENTORY", detail: `${lowStock.length} item(s) below minimum stock` });
    }
    return actions.sort((a, b) => a.priority - b.priority);
  }
}
