import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { AgroAuditRepository } from "./agro-audit.repository.js";
import { AgroAnimalRepository } from "./agro-animal.repository.js";
import { AgroEconomicsRepository } from "./agro-economics.repository.js";
import { AgroFarmRepository } from "./agro-farm.repository.js";

export interface AgroSaleInput {
  buyerName?: string;
  quantity?: number;
  saleWeight?: number;
  salePrice: number;
  freightCost?: number;
  commission?: number;
  paymentMethod?: string;
  occurredAt?: Date;
  notes?: string;
}

@Injectable()
export class AgroSaleService {
  constructor(
    private readonly repo: AgroEconomicsRepository,
    private readonly animalRepo: AgroAnimalRepository,
    private readonly farmRepo: AgroFarmRepository,
    private readonly audit: AgroAuditRepository,
  ) {}

  private async assertFarmAccess(farmId: string, ownerId: string) {
    const farm = await this.farmRepo.findFarm(farmId);
    if (!farm || farm.ownerId !== ownerId) throw new NotFoundException(`Farm not found: ${farmId}`);
    return farm;
  }

  async listSales(farmId: string, ownerId: string, filters?: { targetType?: string; targetId?: string }) {
    await this.assertFarmAccess(farmId, ownerId);
    return this.repo.listSales(farmId, filters);
  }

  /** Cierre financiero: utilidad final = (venta neta + producción acumulada) − costo total acumulado. */
  private closeFinancials(input: {
    salePrice: number;
    freightCost?: number;
    commission?: number;
    acquisitionCost: number;
    accumulatedCosts: number;
    productionIncome: number;
  }) {
    const netSale = input.salePrice - (input.freightCost ?? 0) - (input.commission ?? 0);
    const totalCostBasis = input.acquisitionCost + input.accumulatedCosts;
    const netProfit = netSale + input.productionIncome - totalCostBasis;
    const marginPercent = totalCostBasis > 0 ? (netProfit / totalCostBasis) * 100 : null;
    return { netSale, totalCostBasis, netProfit, marginPercent };
  }

  async sellAnimal(animalId: string, ownerId: string, input: AgroSaleInput) {
    if (input.salePrice <= 0) throw new BadRequestException("Sale price must be positive");
    const animal = await this.animalRepo.findAnimal(animalId);
    if (!animal) throw new NotFoundException(`Animal not found: ${animalId}`);
    await this.assertFarmAccess(animal.farmId, ownerId);
    if (animal.status !== "ACTIVE") {
      throw new BadRequestException(`Cannot sell animal with status: ${animal.status}`);
    }

    const [accumulatedCosts, productionIncome] = await Promise.all([
      this.repo.sumCosts(animal.farmId, "ANIMAL", animalId),
      this.repo.sumProductionValue(animal.farmId, "ANIMAL", animalId),
    ]);
    const fin = this.closeFinancials({
      salePrice: input.salePrice,
      freightCost: input.freightCost,
      commission: input.commission,
      acquisitionCost: animal.acquisitionCost != null ? Number(animal.acquisitionCost) : 0,
      accumulatedCosts,
      productionIncome,
    });

    const sale = await this.repo.createSale({
      farmId: animal.farmId,
      targetType: "ANIMAL",
      targetId: animalId,
      buyerName: input.buyerName,
      quantity: 1,
      saleWeight: input.saleWeight,
      salePrice: input.salePrice,
      freightCost: input.freightCost,
      commission: input.commission,
      paymentMethod: input.paymentMethod,
      totalCostBasis: fin.totalCostBasis,
      netProfit: fin.netProfit,
      marginPercent: fin.marginPercent ?? undefined,
      occurredAt: input.occurredAt ?? new Date(),
      notes: input.notes,
    });
    await this.animalRepo.updateAnimal(animalId, { status: "SOLD" });

    await this.audit.record({
      farmId: animal.farmId, actorId: ownerId,
      entityType: "AgroAnimal", entityId: animalId,
      action: "animal.sold",
      before: { status: animal.status },
      after: {
        status: "SOLD", saleId: sale.id, salePrice: input.salePrice,
        totalCostBasis: fin.totalCostBasis, netProfit: fin.netProfit,
      },
      source: "WEB",
    });
    return { sale, financials: fin };
  }

  async sellGroup(groupId: string, ownerId: string, input: AgroSaleInput) {
    if (input.salePrice <= 0) throw new BadRequestException("Sale price must be positive");
    const group = await this.animalRepo.findGroup(groupId);
    if (!group) throw new NotFoundException(`Animal group not found: ${groupId}`);
    await this.assertFarmAccess(group.farmId, ownerId);
    if (group.status !== "ACTIVE") {
      throw new BadRequestException(`Cannot sell group with status: ${group.status}`);
    }

    const quantity = input.quantity ?? group.count;
    if (quantity <= 0 || quantity > group.count) {
      throw new BadRequestException(`Invalid quantity: ${quantity} (group has ${group.count})`);
    }

    const [accumulatedCosts, productionIncome] = await Promise.all([
      this.repo.sumCosts(group.farmId, "ANIMAL_GROUP", groupId),
      this.repo.sumProductionValue(group.farmId, "ANIMAL_GROUP", groupId),
    ]);

    // Venta parcial: el costo y la producción se prorratean por cabeza vendida.
    const share = quantity / group.count;
    const fin = this.closeFinancials({
      salePrice: input.salePrice,
      freightCost: input.freightCost,
      commission: input.commission,
      acquisitionCost: group.acquisitionCost != null ? Number(group.acquisitionCost) * share : 0,
      accumulatedCosts: accumulatedCosts * share,
      productionIncome: productionIncome * share,
    });

    const sale = await this.repo.createSale({
      farmId: group.farmId,
      targetType: "ANIMAL_GROUP",
      targetId: groupId,
      buyerName: input.buyerName,
      quantity,
      saleWeight: input.saleWeight,
      salePrice: input.salePrice,
      freightCost: input.freightCost,
      commission: input.commission,
      paymentMethod: input.paymentMethod,
      totalCostBasis: fin.totalCostBasis,
      netProfit: fin.netProfit,
      marginPercent: fin.marginPercent ?? undefined,
      occurredAt: input.occurredAt ?? new Date(),
      notes: input.notes,
    });

    const remaining = group.count - quantity;
    await this.animalRepo.updateGroup(groupId, {
      count: remaining,
      ...(remaining === 0 && { status: "SOLD" }),
    });

    await this.audit.record({
      farmId: group.farmId, actorId: ownerId,
      entityType: "AgroAnimalGroup", entityId: groupId,
      action: remaining === 0 ? "group.sold" : "group.sold_partial",
      before: { count: group.count, status: group.status },
      after: {
        count: remaining, status: remaining === 0 ? "SOLD" : group.status,
        saleId: sale.id, quantity, salePrice: input.salePrice, netProfit: fin.netProfit,
      },
      source: "WEB",
    });
    return { sale, financials: fin };
  }

  /** Resumen de ventas de los últimos N días. */
  async getSummary(farmId: string, ownerId: string, days = 30) {
    await this.assertFarmAccess(farmId, ownerId);
    const from = new Date(Date.now() - days * 24 * 3600 * 1000);
    const sales = await this.repo.listSales(farmId, { from });

    const totalRevenue = sales.reduce((s, x) => s + Number(x.salePrice), 0);
    const totalProfit = sales.reduce((s, x) => s + Number(x.netProfit ?? 0), 0);
    const headsSold = sales.reduce((s, x) => s + x.quantity, 0);
    return { since: from, days, salesCount: sales.length, headsSold, totalRevenue, totalProfit };
  }
}
