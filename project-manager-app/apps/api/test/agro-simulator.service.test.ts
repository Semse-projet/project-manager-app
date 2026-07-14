import "reflect-metadata";

import test from "node:test";
import assert from "node:assert/strict";
import { BadRequestException } from "@nestjs/common";
import { AgroSimulatorService } from "../dist/modules/agro/agro-simulator.service.js";

const svc = new AgroSimulatorService();

// ── Reglas de recomendación ───────────────────────────────────────────────────

test("agro-simulator: margen >= 20% recomienda comprar", () => {
  const sim = svc.simulatePurchase({
    purchasePrice: 1800, freightCost: 150, feedCostProjected: 2500,
    medicineCost: 250, laborCost: 300, expectedSalePrice: 6500,
  });
  // costo total 5000, ingreso 6500, utilidad 1500, margen 30%
  assert.equal(sim.totalProjectedCost, 5000);
  assert.equal(sim.expectedProfit, 1500);
  assert.equal(sim.recommendation, "BUY");
  assert.equal(sim.riskLevel, "LOW");
  assert.ok(Math.abs(sim.marginPercent - 30) < 0.01);
});

test("agro-simulator: margen entre 5% y 20% recomienda negociar", () => {
  const sim = svc.simulatePurchase({
    purchasePrice: 10000, freightCost: 1200, feedCostProjected: 3500,
    medicineCost: 500, expectedSalePrice: 17000,
  });
  // costo total 15200, utilidad 1800, margen 11.8%
  assert.equal(sim.recommendation, "NEGOTIATE");
  assert.equal(sim.riskLevel, "MEDIUM");
  assert.ok(sim.rationale.some(r => r.includes("negociar") || r.includes("Comprar solo si")));
});

test("agro-simulator: margen < 5% recomienda no comprar", () => {
  const sim = svc.simulatePurchase({
    purchasePrice: 10000, expectedSalePrice: 10200,
  });
  assert.equal(sim.recommendation, "DONT_BUY");
  assert.equal(sim.riskLevel, "HIGH");
});

test("agro-simulator: pérdida proyectada recomienda no comprar con razón explícita", () => {
  const sim = svc.simulatePurchase({
    purchasePrice: 28000, freightCost: 1500, feedCostProjected: 3600,
    expectedSalePrice: 30000,
  });
  assert.equal(sim.recommendation, "DONT_BUY");
  assert.ok(sim.expectedProfit < 0);
  assert.ok(sim.rationale.some(r => r.includes("pérdida")));
});

// ── Cálculos ──────────────────────────────────────────────────────────────────

test("agro-simulator: precio máximo de compra deja margen del 20%", () => {
  const sim = svc.simulatePurchase({
    purchasePrice: 10000, freightCost: 1000, expectedSalePrice: 12000,
  });
  // Al comprar al precio máximo, el margen debe ser exactamente 20%.
  const maxPrice = sim.maxRecommendedPurchasePrice;
  const check = svc.simulatePurchase({
    purchasePrice: maxPrice, freightCost: 1000, expectedSalePrice: 12000,
  });
  assert.ok(Math.abs(check.marginPercent - 20) < 0.01);
});

test("agro-simulator: mortalidad esperada reduce el ingreso, no el costo", () => {
  const base = svc.simulatePurchase({ purchasePrice: 9000, feedCostProjected: 14500, expectedSalePrice: 37440 });
  const withMortality = svc.simulatePurchase({
    purchasePrice: 9000, feedCostProjected: 14500, expectedSalePrice: 37440, expectedMortalityPercent: 4,
  });
  assert.equal(withMortality.totalProjectedCost, base.totalProjectedCost);
  assert.ok(withMortality.grossIncome < base.grossIncome);
  assert.ok(Math.abs(withMortality.grossIncome - 37440 * 0.96) < 0.01);
});

test("agro-simulator: costo diario usa días de tenencia y excluye la compra", () => {
  const sim = svc.simulatePurchase({
    purchasePrice: 9000, feedCostProjected: 13500, expectedSalePrice: 37000, holdingDays: 45,
  });
  assert.equal(sim.dailyCost, 13500 / 45);
});

test("agro-simulator: ingreso por producción se suma al ingreso esperado", () => {
  const sim = svc.simulatePurchase({
    purchasePrice: 28000, feedCostProjected: 3300, expectedSalePrice: 26000,
    expectedProductionIncome: 12960,
  });
  assert.equal(sim.grossIncome, 26000 + 12960);
});

test("agro-simulator: flete alto agrega advertencia", () => {
  const sim = svc.simulatePurchase({
    purchasePrice: 10000, freightCost: 2000, expectedSalePrice: 17000,
  });
  assert.ok(sim.rationale.some(r => r.includes("flete") || r.includes("15%")));
});

// ── Validación ────────────────────────────────────────────────────────────────

test("agro-simulator: rechaza precio de compra no positivo", () => {
  assert.throws(() => svc.simulatePurchase({ purchasePrice: 0, expectedSalePrice: 100 }), BadRequestException);
});

test("agro-simulator: rechaza venta esperada no positiva", () => {
  assert.throws(() => svc.simulatePurchase({ purchasePrice: 100, expectedSalePrice: 0 }), BadRequestException);
});

test("agro-simulator: rechaza mortalidad fuera de rango", () => {
  assert.throws(
    () => svc.simulatePurchase({ purchasePrice: 100, expectedSalePrice: 200, expectedMortalityPercent: 100 }),
    BadRequestException,
  );
});
