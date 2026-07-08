import "reflect-metadata";

import test from "node:test";
import assert from "node:assert/strict";
import { BadRequestException, NotFoundException } from "@nestjs/common";
import { AgroSaleService } from "../dist/modules/agro/agro-sale.service.js";

// ── Stubs ─────────────────────────────────────────────────────────────────────

const STUB_FARM = { id: "farm_1", ownerId: "usr_1", name: "La Esperanza", operationType: "LIVESTOCK" };

const STUB_ANIMAL = {
  id: "ani_1", farmId: "farm_1", tagCode: "ENG-009", species: "CATTLE",
  status: "ACTIVE", acquisitionCost: 10000,
};

const STUB_GROUP = {
  id: "grp_1", farmId: "farm_1", name: "POL-001", species: "CHICKEN",
  status: "ACTIVE", count: 300, acquisitionCost: 9000,
};

function makeFarmRepo(farm = STUB_FARM) {
  return { findFarm: async (id: string) => (id === farm.id ? farm : null) } as never;
}

function makeAnimalRepo(animal: any = STUB_ANIMAL, group: any = STUB_GROUP) {
  const updates: any[] = [];
  const repo = {
    findAnimal:   async (id: string) => (id === animal?.id ? animal : null),
    findGroup:    async (id: string) => (id === group?.id ? group : null),
    updateAnimal: async (id: string, patch: any) => { updates.push({ id, patch }); return { ...animal, ...patch }; },
    updateGroup:  async (id: string, patch: any) => { updates.push({ id, patch }); return { ...group, ...patch }; },
    _updates: updates,
  };
  return repo as any;
}

function makeEconomicsRepo(opts: { costs?: number; income?: number } = {}) {
  const sales: any[] = [];
  const repo = {
    sumCosts:           async () => opts.costs ?? 0,
    sumProductionValue: async () => opts.income ?? 0,
    createSale:         async (input: any) => { const sale = { id: "sale_1", ...input }; sales.push(sale); return sale; },
    listSales:          async () => sales,
    _sales: sales,
  };
  return repo as any;
}

function makeAuditRepo() {
  const events: any[] = [];
  return { record: async (e: any) => { events.push(e); }, _events: events } as any;
}

// ── Venta de animal ───────────────────────────────────────────────────────────

test("agro-sale: sellAnimal calcula cierre financiero y marca SOLD", async () => {
  const animalRepo = makeAnimalRepo();
  const econRepo = makeEconomicsRepo({ costs: 5200, income: 0 });
  const audit = makeAuditRepo();
  const svc = new AgroSaleService(econRepo, animalRepo, makeFarmRepo(), audit);

  const { sale, financials } = await svc.sellAnimal("ani_1", "usr_1", {
    salePrice: 18000, freightCost: 500, commission: 300,
  });

  // costo base 10000 + 5200 = 15200; venta neta 17200; utilidad 2000
  assert.equal(financials.totalCostBasis, 15200);
  assert.equal(financials.netSale, 17200);
  assert.equal(financials.netProfit, 2000);
  assert.ok(Math.abs((financials.marginPercent ?? 0) - (2000 / 15200) * 100) < 0.01);
  assert.equal(sale.targetType, "ANIMAL");
  assert.equal(animalRepo._updates[0]!.patch.status, "SOLD");
  assert.equal(audit._events[0]!.action, "animal.sold");
});

test("agro-sale: sellAnimal suma la producción histórica a la utilidad", async () => {
  const svc = new AgroSaleService(
    makeEconomicsRepo({ costs: 11200, income: 15000 }),
    makeAnimalRepo({ ...STUB_ANIMAL, acquisitionCost: 30000 }),
    makeFarmRepo(),
    makeAuditRepo(),
  );
  const { financials } = await svc.sellAnimal("ani_1", "usr_1", { salePrice: 26000 });
  // costo 41200; ingreso 26000 + 15000 = 41000 → utilidad -200
  assert.equal(financials.netProfit, -200);
});

test("agro-sale: sellAnimal rechaza animal no activo", async () => {
  const svc = new AgroSaleService(
    makeEconomicsRepo(),
    makeAnimalRepo({ ...STUB_ANIMAL, status: "SOLD" }),
    makeFarmRepo(),
    makeAuditRepo(),
  );
  await assert.rejects(() => svc.sellAnimal("ani_1", "usr_1", { salePrice: 100 }), BadRequestException);
});

test("agro-sale: sellAnimal rechaza dueño ajeno y precio inválido", async () => {
  const svc = new AgroSaleService(makeEconomicsRepo(), makeAnimalRepo(), makeFarmRepo(), makeAuditRepo());
  await assert.rejects(() => svc.sellAnimal("ani_1", "usr_X", { salePrice: 100 }), NotFoundException);
  await assert.rejects(() => svc.sellAnimal("ani_1", "usr_1", { salePrice: 0 }), BadRequestException);
});

// ── Venta de lote ─────────────────────────────────────────────────────────────

test("agro-sale: sellGroup completo marca el lote SOLD con count 0", async () => {
  const animalRepo = makeAnimalRepo();
  const svc = new AgroSaleService(makeEconomicsRepo({ costs: 18500 }), animalRepo, makeFarmRepo(), makeAuditRepo());

  const { financials } = await svc.sellGroup("grp_1", "usr_1", { salePrice: 37440 });
  // costo base 9000 + 18500 = 27500; utilidad 9940
  assert.equal(financials.totalCostBasis, 27500);
  assert.equal(financials.netProfit, 9940);
  assert.equal(animalRepo._updates[0]!.patch.count, 0);
  assert.equal(animalRepo._updates[0]!.patch.status, "SOLD");
});

test("agro-sale: sellGroup parcial prorratea el costo por cabeza y no cambia estado", async () => {
  const animalRepo = makeAnimalRepo();
  const audit = makeAuditRepo();
  const svc = new AgroSaleService(makeEconomicsRepo({ costs: 18500 }), animalRepo, makeFarmRepo(), audit);

  const { financials } = await svc.sellGroup("grp_1", "usr_1", { salePrice: 13000, quantity: 100 });
  // share = 100/300; costo base prorrateado (9000 + 18500) / 3
  assert.ok(Math.abs(financials.totalCostBasis - 27500 / 3) < 0.01);
  assert.equal(animalRepo._updates[0]!.patch.count, 200);
  assert.equal(animalRepo._updates[0]!.patch.status, undefined);
  assert.equal(audit._events[0]!.action, "group.sold_partial");
});

test("agro-sale: sellGroup rechaza cantidad mayor al lote", async () => {
  const svc = new AgroSaleService(makeEconomicsRepo(), makeAnimalRepo(), makeFarmRepo(), makeAuditRepo());
  await assert.rejects(() => svc.sellGroup("grp_1", "usr_1", { salePrice: 100, quantity: 301 }), BadRequestException);
});

test("agro-sale: getSummary agrega ventas del período", async () => {
  const econRepo = makeEconomicsRepo({ costs: 0 });
  const svc = new AgroSaleService(econRepo, makeAnimalRepo(), makeFarmRepo(), makeAuditRepo());
  await svc.sellAnimal("ani_1", "usr_1", { salePrice: 18000 });

  const summary = await svc.getSummary("farm_1", "usr_1");
  assert.equal(summary.salesCount, 1);
  assert.equal(summary.headsSold, 1);
  assert.equal(summary.totalRevenue, 18000);
});
