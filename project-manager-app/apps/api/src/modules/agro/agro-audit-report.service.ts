import { Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../../infrastructure/prisma/prisma.service.js";
import { AgroFarmRepository } from "./agro-farm.repository.js";

interface Finding {
  type: "CRITICAL" | "WARNING" | "INFO";
  area: string;
  message: string;
}

@Injectable()
export class AgroAuditReportService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly farmRepo: AgroFarmRepository,
  ) {}

  private async assertFarmAccess(farmId: string, ownerId: string) {
    const farm = await this.farmRepo.findFarm(farmId);
    if (!farm || farm.ownerId !== ownerId) throw new NotFoundException(`Farm not found: ${farmId}`);
    return farm;
  }

  async generateWeeklyReport(farmId: string, ownerId: string) {
    const farm = await this.assertFarmAccess(farmId, ownerId);
    const now = new Date();
    const weekAgo = new Date(now.getTime() - 7 * 24 * 3600 * 1000);

    const [tasks, animals, items, movements, events, costEntries] = await Promise.all([
      this.prisma.agroFarmTask.findMany({ where: { farmId } }),
      this.prisma.agroAnimal.findMany({ where: { farmId, status: "ACTIVE" } }),
      this.prisma.agroInventoryItem.findMany({ where: { farmId } }),
      this.prisma.agroInventoryMovement.findMany({ where: { farmId, occurredAt: { gte: weekAgo } } }),
      this.prisma.agroAuditEvent.findMany({ where: { farmId, createdAt: { gte: weekAgo } }, orderBy: { createdAt: "desc" } }),
      this.prisma.agroCostEntry.findMany({ where: { farmId, occurredAt: { gte: weekAgo } } }),
    ]);

    const findings: Finding[] = [];

    // Overdue tasks
    const overdue = tasks.filter(t =>
      ["PENDING", "IN_PROGRESS"].includes(t.status) && t.dueAt && t.dueAt < now
    );
    if (overdue.length > 0) {
      findings.push({ type: "CRITICAL", area: "TASKS", message: `${overdue.length} task(s) are overdue` });
    }

    // Blocked tasks
    const blocked = tasks.filter(t => t.status === "BLOCKED");
    if (blocked.length > 0) {
      findings.push({ type: "WARNING", area: "TASKS", message: `${blocked.length} task(s) are blocked` });
    }

    // Low stock
    const stockMap = new Map<string, number>();
    const allMovements = await this.prisma.agroInventoryMovement.findMany({ where: { farmId } });
    for (const m of allMovements) {
      const curr = stockMap.get(m.itemId) ?? 0;
      if (m.movementType === "IN")  stockMap.set(m.itemId, curr + Number(m.quantity ?? 0));
      else if (m.movementType === "OUT") stockMap.set(m.itemId, curr - Number(m.quantity ?? 0));
      else stockMap.set(m.itemId, curr + Number(m.adjustmentDelta ?? 0));
    }
    const lowStock = items.filter(i => i.minimumStock != null && (stockMap.get(i.id) ?? 0) <= Number(i.minimumStock));
    if (lowStock.length > 0) {
      findings.push({ type: "WARNING", area: "INVENTORY", message: `${lowStock.length} item(s) below minimum stock` });
    }

    // Animals without activity this week
    const activeAnimalIds = new Set(
      events.filter(e => e.entityType === "AgroAnimal").map(e => e.entityId)
    );
    const inactiveAnimals = animals.filter(a => !activeAnimalIds.has(a.id));
    if (inactiveAnimals.length > 0) {
      findings.push({ type: "INFO", area: "ANIMALS", message: `${inactiveAnimals.length} animal(s) had no recorded activity this week` });
    }

    // Score calculation
    const criticals = findings.filter(f => f.type === "CRITICAL").length;
    const warnings  = findings.filter(f => f.type === "WARNING").length;
    const infos     = findings.filter(f => f.type === "INFO").length;
    const score = Math.max(0, 100 - 15 * criticals - 5 * warnings - 1 * infos);

    const weekCost = costEntries.reduce((s, e) => s + Number(e.amount), 0);

    const recommendations = this.buildRecommendations(findings);

    return {
      farmId,
      farmName: farm.name,
      period: { from: weekAgo, to: now },
      score,
      summary: {
        totalTasks: tasks.length,
        completedTasks: tasks.filter(t => t.status === "COMPLETED").length,
        overdueTasks: overdue.length,
        blockedTasks: blocked.length,
        activeAnimals: animals.length,
        lowStockItems: lowStock.length,
        weekCost,
        eventCount: events.length,
      },
      findings,
      recentEvents: events.slice(0, 20),
      recommendations,
    };
  }

  private buildRecommendations(findings: Finding[]) {
    const recs: string[] = [];
    for (const f of findings) {
      if (f.area === "TASKS" && f.type === "CRITICAL") recs.push("Resolve overdue tasks immediately to avoid operational disruption.");
      if (f.area === "TASKS" && f.type === "WARNING")  recs.push("Investigate blocked tasks and remove blockers.");
      if (f.area === "INVENTORY")                      recs.push("Restock low-inventory items before they run out.");
      if (f.area === "ANIMALS")                        recs.push("Log at least one activity per animal per week (weight check, observation, or task).");
    }
    return [...new Set(recs)];
  }
}
