import { BadRequestException, Injectable } from "@nestjs/common";

export type AgroBuyRecommendation = "BUY" | "NEGOTIATE" | "DONT_BUY";

export interface AgroPurchaseSimulationInput {
  species?: string;
  purpose?: string;
  quantity?: number;
  purchasePrice: number;
  freightCost?: number;
  feedCostProjected?: number;
  medicineCost?: number;
  laborCost?: number;
  otherCosts?: number;
  expectedSalePrice: number;
  expectedProductionIncome?: number;
  holdingDays?: number;
  expectedMortalityPercent?: number;
}

export interface AgroPurchaseSimulation {
  totalProjectedCost: number;
  dailyCost: number | null;
  grossIncome: number;
  expectedProfit: number;
  marginPercent: number;
  roiPercent: number | null;
  breakEvenSalePrice: number;
  maxRecommendedPurchasePrice: number;
  recommendation: AgroBuyRecommendation;
  riskLevel: "LOW" | "MEDIUM" | "HIGH";
  rationale: string[];
}

/** Reglas de compra (spec SEMSE Agro §25/§67):
 *  margen >= 20% → comprar · 5–20% → negociar · < 5% → no comprar. */
const BUY_MARGIN = 0.20;
const NEGOTIATE_MARGIN = 0.05;

@Injectable()
export class AgroSimulatorService {

  simulatePurchase(input: AgroPurchaseSimulationInput): AgroPurchaseSimulation {
    if (input.purchasePrice <= 0) throw new BadRequestException("Purchase price must be positive");
    if (input.expectedSalePrice <= 0) throw new BadRequestException("Expected sale price must be positive");
    if (input.expectedMortalityPercent != null && (input.expectedMortalityPercent < 0 || input.expectedMortalityPercent >= 100)) {
      throw new BadRequestException("Expected mortality must be between 0 and 100");
    }

    const operatingCosts =
      (input.freightCost ?? 0) +
      (input.feedCostProjected ?? 0) +
      (input.medicineCost ?? 0) +
      (input.laborCost ?? 0) +
      (input.otherCosts ?? 0);
    const totalProjectedCost = input.purchasePrice + operatingCosts;

    // La mortalidad esperada reduce el ingreso de venta, no el costo.
    const survivalFactor = 1 - (input.expectedMortalityPercent ?? 0) / 100;
    const grossIncome = input.expectedSalePrice * survivalFactor + (input.expectedProductionIncome ?? 0);

    const expectedProfit = grossIncome - totalProjectedCost;
    const marginPercent = totalProjectedCost > 0 ? (expectedProfit / totalProjectedCost) * 100 : 0;
    const roiPercent = input.purchasePrice > 0 ? (expectedProfit / input.purchasePrice) * 100 : null;
    const dailyCost = input.holdingDays && input.holdingDays > 0 ? operatingCosts / input.holdingDays : null;

    const breakEvenSalePrice = (totalProjectedCost - (input.expectedProductionIncome ?? 0)) / (survivalFactor || 1);
    // Precio máximo de compra para que el margen proyectado llegue al 20%.
    const maxRecommendedPurchasePrice = Math.max(0, grossIncome / (1 + BUY_MARGIN) - operatingCosts);

    const margin = marginPercent / 100;
    let recommendation: AgroBuyRecommendation;
    let riskLevel: "LOW" | "MEDIUM" | "HIGH";
    const rationale: string[] = [];

    if (margin >= BUY_MARGIN) {
      recommendation = "BUY";
      riskLevel = "LOW";
      rationale.push(`Margen proyectado ${marginPercent.toFixed(1)}% supera el umbral de compra (20%).`);
    } else if (margin >= NEGOTIATE_MARGIN) {
      recommendation = "NEGOTIATE";
      riskLevel = "MEDIUM";
      rationale.push(`Margen proyectado ${marginPercent.toFixed(1)}% está entre 5% y 20%: negociar precio o flete.`);
      rationale.push(`Comprar solo si el precio baja a ${maxRecommendedPurchasePrice.toFixed(2)} o menos.`);
    } else {
      recommendation = "DONT_BUY";
      riskLevel = "HIGH";
      rationale.push(
        margin < 0
          ? `La compra proyecta pérdida de ${Math.abs(expectedProfit).toFixed(2)}.`
          : `Margen proyectado ${marginPercent.toFixed(1)}% está debajo del mínimo (5%).`,
      );
      if (maxRecommendedPurchasePrice > 0) {
        rationale.push(`Solo sería rentable comprando a ${maxRecommendedPurchasePrice.toFixed(2)} o menos.`);
      }
    }
    if ((input.freightCost ?? 0) > input.purchasePrice * 0.15) {
      rationale.push("El flete supera el 15% del precio de compra: intenta reducirlo o comprar más cerca.");
    }
    if ((input.expectedMortalityPercent ?? 0) > 5) {
      rationale.push(`Mortalidad esperada ${input.expectedMortalityPercent}% es alta y ya está descontada del ingreso.`);
    }

    return {
      totalProjectedCost,
      dailyCost,
      grossIncome,
      expectedProfit,
      marginPercent,
      roiPercent,
      breakEvenSalePrice,
      maxRecommendedPurchasePrice,
      recommendation,
      riskLevel,
      rationale,
    };
  }
}
