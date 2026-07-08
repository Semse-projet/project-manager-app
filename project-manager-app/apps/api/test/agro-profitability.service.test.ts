import "reflect-metadata";

import test from "node:test";
import assert from "node:assert/strict";
import { NotFoundException } from "@nestjs/common";
import { AgroProfitabilityService } from "../dist/modules/agro/agro-profitability.service.js";

// ── Stubs ─────────────────────────────────────────────────────────────────────

const STUB_FARM = { id: "farm_1", ownerId: "usr_1", name: "La Esperanza", operationType: "LIVESTOCK" };

const STUB_ANIMAL = {
  id: "ani_1", farmId: "farm_1", tagCode: "LEC-021", species: "CATTLE", purpose: "DAIRY",
  status: "ACTIVE", acquisitionCost: 28000, estimatedValue: 31000,
  expectedSalePrice: null, expectedSaleDate: null,
};

const STUB_GROUP = {
  id: "grp_1", farmId: "farm_1", name: "POL-001", species: "CHICKEN", purpose: "FATTENING",
  status: "ACTIVE", count: 288, acquisitionCost: 9000, estimatedValue: null,
  expectedSalePrice: 37440, expectedSaleDate: null,
};

function makeFarmRepo(farm = STUB_FARM) {
  return { findFarm: async (id: string) => (id === farm.id ? farm : null) } as never;
}

function makeAnimalRepo(animals: any[] = [STUB_ANIMAL], groups: any[] = [STUB_GROUP]) {
  return {
    findAnimal:  async (id: string) => animals.find(a => a.id === id) ?? null,
    findGroup:   async (id: string) => groups.find(g => g.id === id) ?? null,
    listAnimals: async (farmId: string) => animals.filter(a => a.farmId === farmId),
    listGroups:  async (farmId: string) => groups.filter(g => g.farmId === farmId),
  } as never;
}

function makeEconomicsRepo(opts: { costs?: number; income?: number; costMap?: Map<string, number>; incomeMap?: Map<string, number> } = {}) {
  return {
    sumCosts:               async () => opts.costs ?? 0,
    sumProductionValue:     async () => opts.income ?? 0,
    sumCostsByTargets:      async () => opts.costMap ?? new Map(),
    sumProductionByTargets: async () => opts.incomeMap ?? new Map(),
  } as never;
}

function makeService(opts: Parameters<typeof makeEconomicsRepo>[0] = {}, animals?: any[], groups?: any[]) {
  return new AgroProfitabilityService(makeEconomicsRepo(opts), makeAnimalRepo(animals, groups), makeFarmRepo());
}

// ── Motor de reglas (computeProfitability) ────────────────────────────────────

const BASE = {
  targetType: "ANIMAL" as const, targetId: "x", label: "X", species: "CATTLE",
  purpose: "FATTENING", status: "ACTIVE", productionIncome: 0,
  expectedSalePrice: null, expectedSaleDate: null,
};

test("agro-profitability: margen sano (>=20%) recomienda mantener", () => {
  const svc = makeService();
  const p = svc.computeProfitability({ ...BASE, acquisitionCost: 10000, accumulatedCosts: 0, estimatedValue: 13000 });
  assert.equal(p.profit, 3000);
  assert.equal(p.recommendation, "MAINTAIN");
  assert.equal(p.riskLevel, "LOW");
});

test("agro-profitability: margen intermedio (5–20%) recomienda revisar costos", () => {
  const svc = makeService();
  const p = svc.computeProfitability({ ...BASE, acquisitionCost: 10000, accumulatedCosts: 0, estimatedValue: 11000 });
  assert.equal(p.recommendation, "REVIEW_COSTS");
  assert.equal(p.riskLevel, "MEDIUM");
});

test("agro-profitability: margen bajo (0–5%) recomienda vender pronto", () => {
  const svc = makeService();
  const p = svc.computeProfitability({ ...BASE, acquisitionCost: 10000, accumulatedCosts: 0, estimatedValue: 10200 });
  assert.equal(p.recommendation, "SELL_SOON");
  assert.equal(p.riskLevel, "HIGH");
});

test("agro-profitability: pérdida genera alerta crítica", () => {
  const svc = makeService();
  const p = svc.computeProfitability({ ...BASE, acquisitionCost: 10000, accumulatedCosts: 2000, estimatedValue: 9000 });
  assert.ok((p.profit ?? 0) < 0);
  assert.equal(p.recommendation, "LOSS_ALERT");
  assert.equal(p.riskLevel, "CRITICAL");
});

test("agro-profitability: fecha de venta vencida recomienda vender ahora", () => {
  const svc = makeService();
  const p = svc.computeProfitability({
    ...BASE, acquisitionCost: 10000, accumulatedCosts: 0, estimatedValue: 13000,
    expectedSaleDate: new Date(Date.now() - 24 * 3600 * 1000),
  });
  assert.equal(p.recommendation, "SELL_NOW");
});

test("agro-profitability: fecha de venta próxima (7 días) con buen margen recomienda vender pronto", () => {
  const svc = makeService();
  const p = svc.computeProfitability({
    ...BASE, acquisitionCost: 10000, accumulatedCosts: 0, estimatedValue: 13000,
    expectedSaleDate: new Date(Date.now() + 3 * 24 * 3600 * 1000),
  });
  assert.equal(p.recommendation, "SELL_SOON");
  assert.equal(p.riskLevel, "LOW");
});

test("agro-profitability: sin valor estimado ni precio esperado pide revisar datos", () => {
  const svc = makeService();
  const p = svc.computeProfitability({ ...BASE, acquisitionCost: 10000, accumulatedCosts: 500, estimatedValue: null });
  assert.equal(p.recommendation, "REVIEW_DATA");
  assert.equal(p.profit, null);
});

test("agro-profitability: la producción acumulada cuenta como ingreso", () => {
  const svc = makeService();
  // Vaca lechera: costo 41200, valor actual 30000, leche vendida 15000 → utilidad 3800
  const p = svc.computeProfitability({
    ...BASE, purpose: "DAIRY", acquisitionCost: 30000, accumulatedCosts: 11200,
    estimatedValue: 30000, productionIncome: 15000,
  });
  assert.equal(p.totalCost, 41200);
  assert.equal(p.economicValue, 45000);
  assert.equal(p.profit, 3800);
});

// ── Acceso y agregados ────────────────────────────────────────────────────────

test("agro-profitability: getAnimalProfitability suma costos y producción del animal", async () => {
  const svc = makeService({ costs: 9700, income: 4320 });
  const p = await svc.getAnimalProfitability("ani_1", "usr_1");
  assert.equal(p.totalCost, 28000 + 9700);
  assert.equal(p.productionIncome, 4320);
  assert.equal(p.currentValue, 31000);
});

test("agro-profitability: getAnimalProfitability rechaza dueño ajeno", async () => {
  const svc = makeService();
  await assert.rejects(() => svc.getAnimalProfitability("ani_1", "usr_X"), NotFoundException);
});

test("agro-profitability: getGroupProfitability usa precio esperado si no hay valor estimado", async () => {
  const svc = makeService({ costs: 18500 });
  const p = await svc.getGroupProfitability("grp_1", "usr_1");
  assert.equal(p.currentValue, 37440);
  assert.equal(p.totalCost, 9000 + 18500);
});

test("agro-profitability: getFarmProfitability resume rentables y en pérdida", async () => {
  const losing = { ...STUB_ANIMAL, id: "ani_2", tagCode: "ENG-009", estimatedValue: 20000 };
  const svc = makeService(
    { costMap: new Map([["ani_2", 15000]]) },
    [STUB_ANIMAL, losing],
    [STUB_GROUP],
  );
  const { summary, items } = await svc.getFarmProfitability("farm_1", "usr_1");
  assert.equal(summary.totalItems, 3);
  assert.equal(summary.profitable, 2); // ani_1 (+3000) y grp_1 (+28440)
  assert.equal(summary.inLoss, 1);     // ani_2: 20000 - 43000
  assert.equal(items[0]!.targetId, "ani_2"); // ordenado: peor primero
});

test("agro-profitability: getFarmProfitability excluye animales no activos", async () => {
  const sold = { ...STUB_ANIMAL, id: "ani_3", status: "SOLD" };
  const svc = makeService({}, [STUB_ANIMAL, sold], []);
  const { summary } = await svc.getFarmProfitability("farm_1", "usr_1");
  assert.equal(summary.totalItems, 1);
});
