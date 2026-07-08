import { Injectable, NotFoundException } from "@nestjs/common";
import { AgroAnimalRepository } from "./agro-animal.repository.js";
import { AgroEconomicsRepository } from "./agro-economics.repository.js";
import { AgroFarmRepository } from "./agro-farm.repository.js";

export type AgroRecommendation =
  | "MAINTAIN"        // margen sano, mantener
  | "SELL_SOON"       // utilidad positiva pero margen bajo o fecha de venta cercana
  | "SELL_NOW"        // pasó su fecha esperada de venta
  | "REVIEW_COSTS"    // margen intermedio, revisar costos
  | "LOSS_ALERT"      // en pérdida: vender o descartar
  | "REVIEW_DATA";    // faltan datos críticos para decidir

export type AgroRiskLevel = "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";

export interface AgroProfitability {
  targetType: "ANIMAL" | "ANIMAL_GROUP";
  targetId: string;
  label: string;
  species: string;
  purpose: string;
  status: string;
  acquisitionCost: number;
  accumulatedCosts: number;
  totalCost: number;
  productionIncome: number;
  currentValue: number | null;
  economicValue: number | null;
  profit: number | null;
  marginPercent: number | null;
  roiPercent: number | null;
  expectedSaleDate: Date | null;
  recommendation: AgroRecommendation;
  riskLevel: AgroRiskLevel;
}

/** Reglas del motor de decisión (spec SEMSE Agro §67):
 *  margen >= 20% → mantener · 5–20% → revisar costos · 0–5% → vender pronto · < 0 → pérdida. */
const HEALTHY_MARGIN = 0.20;
const WARNING_MARGIN = 0.05;

@Injectable()
export class AgroProfitabilityService {
  constructor(
    private readonly economicsRepo: AgroEconomicsRepository,
    private readonly animalRepo: AgroAnimalRepository,
    private readonly farmRepo: AgroFarmRepository,
  ) {}

  private async assertFarmAccess(farmId: string, ownerId: string) {
    const farm = await this.farmRepo.findFarm(farmId);
    if (!farm || farm.ownerId !== ownerId) throw new NotFoundException(`Farm not found: ${farmId}`);
    return farm;
  }

  computeProfitability(input: {
    targetType: "ANIMAL" | "ANIMAL_GROUP";
    targetId: string;
    label: string;
    species: string;
    purpose: string;
    status: string;
    acquisitionCost: number | null;
    accumulatedCosts: number;
    productionIncome: number;
    estimatedValue: number | null;
    expectedSalePrice: number | null;
    expectedSaleDate: Date | null;
    now?: Date;
  }): AgroProfitability {
    const now = input.now ?? new Date();
    const acquisitionCost = input.acquisitionCost ?? 0;
    const totalCost = acquisitionCost + input.accumulatedCosts;
    const currentValue = input.estimatedValue ?? input.expectedSalePrice;

    let economicValue: number | null = null;
    let profit: number | null = null;
    let marginPercent: number | null = null;
    let roiPercent: number | null = null;

    if (currentValue != null) {
      economicValue = input.productionIncome + currentValue;
      profit = economicValue - totalCost;
      marginPercent = totalCost > 0 ? (profit / totalCost) * 100 : null;
      roiPercent = acquisitionCost > 0 ? (profit / acquisitionCost) * 100 : null;
    }

    const { recommendation, riskLevel } = this.recommend({
      profit, marginPercent,
      expectedSaleDate: input.expectedSaleDate,
      hasValue: currentValue != null,
      hasCost: totalCost > 0,
      now,
    });

    return {
      targetType: input.targetType,
      targetId: input.targetId,
      label: input.label,
      species: input.species,
      purpose: input.purpose,
      status: input.status,
      acquisitionCost,
      accumulatedCosts: input.accumulatedCosts,
      totalCost,
      productionIncome: input.productionIncome,
      currentValue,
      economicValue,
      profit,
      marginPercent,
      roiPercent,
      expectedSaleDate: input.expectedSaleDate,
      recommendation,
      riskLevel,
    };
  }

  private recommend(input: {
    profit: number | null;
    marginPercent: number | null;
    expectedSaleDate: Date | null;
    hasValue: boolean;
    hasCost: boolean;
    now: Date;
  }): { recommendation: AgroRecommendation; riskLevel: AgroRiskLevel } {
    if (!input.hasValue || !input.hasCost || input.marginPercent == null) {
      return { recommendation: "REVIEW_DATA", riskLevel: "MEDIUM" };
    }
    if (input.expectedSaleDate && input.expectedSaleDate <= input.now) {
      return {
        recommendation: "SELL_NOW",
        riskLevel: (input.profit ?? 0) < 0 ? "CRITICAL" : "HIGH",
      };
    }
    const margin = input.marginPercent / 100;
    if (margin < 0) return { recommendation: "LOSS_ALERT", riskLevel: "CRITICAL" };
    if (margin < WARNING_MARGIN) return { recommendation: "SELL_SOON", riskLevel: "HIGH" };
    if (margin < HEALTHY_MARGIN) return { recommendation: "REVIEW_COSTS", riskLevel: "MEDIUM" };
    const soon = new Date(input.now.getTime() + 7 * 24 * 3600 * 1000);
    if (input.expectedSaleDate && input.expectedSaleDate <= soon) {
      return { recommendation: "SELL_SOON", riskLevel: "LOW" };
    }
    return { recommendation: "MAINTAIN", riskLevel: "LOW" };
  }

  async getAnimalProfitability(animalId: string, ownerId: string): Promise<AgroProfitability> {
    const animal = await this.animalRepo.findAnimal(animalId);
    if (!animal) throw new NotFoundException(`Animal not found: ${animalId}`);
    await this.assertFarmAccess(animal.farmId, ownerId);

    const [accumulatedCosts, productionIncome] = await Promise.all([
      this.economicsRepo.sumCosts(animal.farmId, "ANIMAL", animalId),
      this.economicsRepo.sumProductionValue(animal.farmId, "ANIMAL", animalId),
    ]);

    return this.computeProfitability({
      targetType: "ANIMAL",
      targetId: animal.id,
      label: animal.tagCode ?? animal.id,
      species: animal.species,
      purpose: animal.purpose,
      status: animal.status,
      acquisitionCost: animal.acquisitionCost != null ? Number(animal.acquisitionCost) : null,
      accumulatedCosts,
      productionIncome,
      estimatedValue: animal.estimatedValue != null ? Number(animal.estimatedValue) : null,
      expectedSalePrice: animal.expectedSalePrice != null ? Number(animal.expectedSalePrice) : null,
      expectedSaleDate: animal.expectedSaleDate,
    });
  }

  async getGroupProfitability(groupId: string, ownerId: string): Promise<AgroProfitability> {
    const group = await this.animalRepo.findGroup(groupId);
    if (!group) throw new NotFoundException(`Animal group not found: ${groupId}`);
    await this.assertFarmAccess(group.farmId, ownerId);

    const [accumulatedCosts, productionIncome] = await Promise.all([
      this.economicsRepo.sumCosts(group.farmId, "ANIMAL_GROUP", groupId),
      this.economicsRepo.sumProductionValue(group.farmId, "ANIMAL_GROUP", groupId),
    ]);

    return this.computeProfitability({
      targetType: "ANIMAL_GROUP",
      targetId: group.id,
      label: group.name,
      species: group.species,
      purpose: group.purpose,
      status: group.status,
      acquisitionCost: group.acquisitionCost != null ? Number(group.acquisitionCost) : null,
      accumulatedCosts,
      productionIncome,
      estimatedValue: group.estimatedValue != null ? Number(group.estimatedValue) : null,
      expectedSalePrice: group.expectedSalePrice != null ? Number(group.expectedSalePrice) : null,
      expectedSaleDate: group.expectedSaleDate,
    });
  }

  /** Rentabilidad de todos los animales y lotes activos de la finca, con resumen. */
  async getFarmProfitability(farmId: string, ownerId: string) {
    await this.assertFarmAccess(farmId, ownerId);

    const [animals, groups, animalCosts, groupCosts, animalIncome, groupIncome] = await Promise.all([
      this.animalRepo.listAnimals(farmId),
      this.animalRepo.listGroups(farmId),
      this.economicsRepo.sumCostsByTargets(farmId, "ANIMAL"),
      this.economicsRepo.sumCostsByTargets(farmId, "ANIMAL_GROUP"),
      this.economicsRepo.sumProductionByTargets(farmId, "ANIMAL"),
      this.economicsRepo.sumProductionByTargets(farmId, "ANIMAL_GROUP"),
    ]);

    const items: AgroProfitability[] = [
      ...animals
        .filter(a => a.status === "ACTIVE")
        .map(a => this.computeProfitability({
          targetType: "ANIMAL" as const,
          targetId: a.id,
          label: a.tagCode ?? a.id,
          species: a.species,
          purpose: a.purpose,
          status: a.status,
          acquisitionCost: a.acquisitionCost != null ? Number(a.acquisitionCost) : null,
          accumulatedCosts: animalCosts.get(a.id) ?? 0,
          productionIncome: animalIncome.get(a.id) ?? 0,
          estimatedValue: a.estimatedValue != null ? Number(a.estimatedValue) : null,
          expectedSalePrice: a.expectedSalePrice != null ? Number(a.expectedSalePrice) : null,
          expectedSaleDate: a.expectedSaleDate,
        })),
      ...groups
        .filter(g => g.status === "ACTIVE")
        .map(g => this.computeProfitability({
          targetType: "ANIMAL_GROUP" as const,
          targetId: g.id,
          label: g.name,
          species: g.species,
          purpose: g.purpose,
          status: g.status,
          acquisitionCost: g.acquisitionCost != null ? Number(g.acquisitionCost) : null,
          accumulatedCosts: groupCosts.get(g.id) ?? 0,
          productionIncome: groupIncome.get(g.id) ?? 0,
          estimatedValue: g.estimatedValue != null ? Number(g.estimatedValue) : null,
          expectedSalePrice: g.expectedSalePrice != null ? Number(g.expectedSalePrice) : null,
          expectedSaleDate: g.expectedSaleDate,
        })),
    ];

    const withMargin = items.filter(i => i.profit != null);
    const summary = {
      totalItems: items.length,
      profitable: withMargin.filter(i => (i.profit ?? 0) > 0).length,
      inLoss: withMargin.filter(i => (i.profit ?? 0) < 0).length,
      missingData: items.filter(i => i.recommendation === "REVIEW_DATA").length,
      totalCost: items.reduce((s, i) => s + i.totalCost, 0),
      totalCurrentValue: items.reduce((s, i) => s + (i.currentValue ?? 0), 0),
      totalProductionIncome: items.reduce((s, i) => s + i.productionIncome, 0),
      totalProjectedProfit: withMargin.reduce((s, i) => s + (i.profit ?? 0), 0),
      sellNow: items.filter(i => i.recommendation === "SELL_NOW").length,
      sellSoon: items.filter(i => i.recommendation === "SELL_SOON").length,
    };

    items.sort((a, b) => (a.profit ?? Number.POSITIVE_INFINITY) - (b.profit ?? Number.POSITIVE_INFINITY));
    return { summary, items };
  }
}
