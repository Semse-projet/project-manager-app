import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { AgroAuditRepository } from "./agro-audit.repository.js";
import { AgroFarmRepository } from "./agro-farm.repository.js";
import { AgroInventoryRepository } from "./agro-inventory.repository.js";

const VALID_CATEGORIES = [
  "FEED", "MEDICINE", "VACCINE", "FERTILIZER", "SEED",
  "FUEL", "TOOL", "MATERIAL", "EQUIPMENT", "OTHER",
] as const;

const VALID_UNITS = [
  "UNIT", "LB", "KG", "TON", "LITER", "GALLON",
  "BAG", "BOX", "DOSE", "BOTTLE", "OTHER",
] as const;

const VALID_COST_CATEGORIES = [
  "FEED", "VETERINARY", "LABOR", "EQUIPMENT",
  "TRANSPORT", "INFRASTRUCTURE", "SEED", "FERTILIZER", "FUEL", "OTHER",
] as const;

const COST_CATEGORY_FROM_ITEM: Record<string, string> = {
  FEED: "FEED", MEDICINE: "VETERINARY", VACCINE: "VETERINARY",
  FERTILIZER: "FERTILIZER", SEED: "SEED", FUEL: "FUEL",
  TOOL: "EQUIPMENT", MATERIAL: "EQUIPMENT", EQUIPMENT: "EQUIPMENT", OTHER: "OTHER",
};

@Injectable()
export class AgroInventoryService {
  constructor(
    private readonly repo: AgroInventoryRepository,
    private readonly farmRepo: AgroFarmRepository,
    private readonly audit: AgroAuditRepository,
  ) {}

  private async assertFarmAccess(farmId: string, ownerId: string) {
    const farm = await this.farmRepo.findFarm(farmId);
    if (!farm || farm.ownerId !== ownerId) throw new NotFoundException(`Farm not found: ${farmId}`);
    return farm;
  }

  // ── Items ─────────────────────────────────────────────────────────────────

  async listItems(farmId: string, ownerId: string) {
    await this.assertFarmAccess(farmId, ownerId);
    return this.repo.listItems(farmId);
  }

  async getItem(itemId: string) {
    const item = await this.repo.findItem(itemId);
    if (!item) throw new NotFoundException(`Inventory item not found: ${itemId}`);
    return item;
  }

  async getItemStock(itemId: string, ownerId: string) {
    const item = await this.getItem(itemId);
    await this.assertFarmAccess(item.farmId, ownerId);
    const stock = await this.repo.computeStock(itemId);
    return { item, stock };
  }

  async createItem(farmId: string, ownerId: string, input: {
    name: string;
    category: string;
    unit: string;
    minimumStock?: number;
    notes?: string;
  }) {
    await this.assertFarmAccess(farmId, ownerId);
    if (!input.name?.trim()) throw new BadRequestException("Item name is required");
    if (!VALID_CATEGORIES.includes(input.category as any)) {
      throw new BadRequestException(`Invalid category: ${input.category}`);
    }
    if (!VALID_UNITS.includes(input.unit as any)) {
      throw new BadRequestException(`Invalid unit: ${input.unit}`);
    }

    const item = await this.repo.createItem({ farmId, ...input });
    await this.audit.record({
      farmId, actorId: ownerId,
      entityType: "AgroInventoryItem", entityId: item.id,
      action: "inventory_item.created",
      after: { name: item.name, category: item.category, unit: item.unit },
      source: "WEB",
    });
    return item;
  }

  async updateItem(itemId: string, ownerId: string, input: {
    name?: string;
    minimumStock?: number | null;
    notes?: string;
  }) {
    const item = await this.getItem(itemId);
    await this.assertFarmAccess(item.farmId, ownerId);

    const updated = await this.repo.updateItem(itemId, input);
    await this.audit.record({
      farmId: item.farmId, actorId: ownerId,
      entityType: "AgroInventoryItem", entityId: itemId,
      action: "inventory_item.updated",
      before: { name: item.name },
      after: { name: updated.name },
      source: "WEB",
    });
    return updated;
  }

  // ── Movements ─────────────────────────────────────────────────────────────

  async listMovements(farmId: string, ownerId: string, itemId?: string) {
    await this.assertFarmAccess(farmId, ownerId);
    return this.repo.listMovements(farmId, itemId);
  }

  async recordMovement(farmId: string, ownerId: string, input: {
    itemId: string;
    movementType: "IN" | "OUT" | "ADJUSTMENT";
    quantity?: number;
    adjustmentDelta?: number;
    unitCost?: number;
    relatedTaskId?: string;
    targetType?: string;
    targetId?: string;
    occurredAt?: Date;
    notes?: string;
  }) {
    await this.assertFarmAccess(farmId, ownerId);
    const item = await this.getItem(input.itemId);
    if (item.farmId !== farmId) throw new BadRequestException("Item does not belong to this farm");

    if (input.movementType === "IN" || input.movementType === "OUT") {
      if (!input.quantity || input.quantity <= 0) {
        throw new BadRequestException("quantity must be positive for IN/OUT movements");
      }
    }
    if (input.movementType === "ADJUSTMENT" && input.adjustmentDelta === undefined) {
      throw new BadRequestException("adjustmentDelta is required for ADJUSTMENT movements");
    }

    const qty = input.quantity ?? 0;
    const unitCost = input.unitCost ?? 0;
    const totalCost = qty * unitCost || undefined;
    const occurredAt = input.occurredAt ?? new Date();

    const movement = await this.repo.createMovement({
      farmId, itemId: input.itemId,
      movementType: input.movementType,
      quantity: input.movementType !== "ADJUSTMENT" ? qty : undefined,
      adjustmentDelta: input.movementType === "ADJUSTMENT" ? input.adjustmentDelta : undefined,
      unitCost: unitCost || undefined,
      totalCost,
      relatedTaskId: input.relatedTaskId,
      targetType: input.targetType,
      targetId: input.targetId,
      occurredAt,
      notes: input.notes,
    });

    // Auto-generate cost entry when movement has a cost
    if (totalCost && totalCost > 0) {
      const costCategory = COST_CATEGORY_FROM_ITEM[item.category] ?? "OTHER";
      await this.repo.createCostEntry({
        farmId,
        sourceType: "INVENTORY_MOVEMENT",
        sourceId: movement.id,
        targetType: input.targetType ?? "GENERAL",
        targetId: input.targetId,
        category: costCategory,
        amount: totalCost,
        occurredAt,
        description: `Auto-cost from ${input.movementType} of ${item.name}`,
      });
    }

    await this.audit.record({
      farmId, actorId: ownerId,
      entityType: "AgroInventoryMovement", entityId: movement.id,
      action: "inventory.movement_recorded",
      after: { itemId: input.itemId, movementType: input.movementType, quantity: qty },
      source: "WEB",
    });

    return movement;
  }

  async consumeInventory(farmId: string, ownerId: string, input: {
    itemId: string;
    quantity: number;
    unitCost?: number;
    relatedTaskId?: string;
    targetType?: string;
    targetId?: string;
    notes?: string;
  }) {
    return this.recordMovement(farmId, ownerId, { ...input, movementType: "OUT" });
  }

  // ── Cost Entries ──────────────────────────────────────────────────────────

  async listCosts(farmId: string, ownerId: string, filters?: { targetType?: string; targetId?: string }) {
    await this.assertFarmAccess(farmId, ownerId);
    return this.repo.listCosts(farmId, filters);
  }

  async createManualCost(farmId: string, ownerId: string, input: {
    targetType: string;
    targetId?: string;
    category: string;
    amount: number;
    currency?: string;
    description?: string;
    occurredAt?: Date;
  }) {
    await this.assertFarmAccess(farmId, ownerId);
    if (!VALID_COST_CATEGORIES.includes(input.category as any)) {
      throw new BadRequestException(`Invalid cost category: ${input.category}`);
    }
    if (input.amount <= 0) throw new BadRequestException("Cost amount must be positive");

    const entry = await this.repo.createCostEntry({
      farmId,
      sourceType: "MANUAL",
      targetType: input.targetType,
      targetId: input.targetId,
      category: input.category,
      amount: input.amount,
      currency: input.currency,
      description: input.description,
      occurredAt: input.occurredAt ?? new Date(),
    });
    await this.audit.record({
      farmId, actorId: ownerId,
      entityType: "AgroCostEntry", entityId: entry.id,
      action: "cost_entry.created",
      after: { category: entry.category, amount: Number(entry.amount) },
      source: "WEB",
    });
    return entry;
  }

  async getCostSummary(farmId: string, ownerId: string, days = 30) {
    await this.assertFarmAccess(farmId, ownerId);
    const since = new Date(Date.now() - days * 24 * 3600 * 1000);
    const byCategory = await this.repo.costSummary(farmId, since);
    const total = byCategory.reduce((s, r) => s + r.total, 0);
    return { since, total, byCategory };
  }
}
