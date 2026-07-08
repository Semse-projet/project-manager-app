import "reflect-metadata";

import test from "node:test";
import assert from "node:assert/strict";
import { BadRequestException, NotFoundException } from "@nestjs/common";
import { AgroProductionService } from "../dist/modules/agro/agro-production.service.js";

// ── Stubs ─────────────────────────────────────────────────────────────────────

const STUB_FARM = { id: "farm_1", ownerId: "usr_1", name: "La Esperanza", operationType: "LIVESTOCK" };
const STUB_ANIMAL = { id: "ani_1", farmId: "farm_1", tagCode: "LEC-021", species: "CATTLE", status: "ACTIVE" };
const STUB_GROUP  = { id: "grp_1", farmId: "farm_1", name: "PON-001", species: "CHICKEN", status: "ACTIVE", count: 50 };

function makeFarmRepo(farm = STUB_FARM) {
  return { findFarm: async (id: string) => (id === farm.id ? farm : null) } as never;
}

function makeAnimalRepo() {
  return {
    findAnimal: async (id: string) => (id === STUB_ANIMAL.id ? STUB_ANIMAL : null),
    findGroup:  async (id: string) => (id === STUB_GROUP.id ? STUB_GROUP : null),
  } as never;
}

function makeEconomicsRepo(existing: any[] = []) {
  const records = [...existing];
  const repo = {
    listProduction:   async (farmId: string, filters?: any) =>
      records.filter(r => r.farmId === farmId && (!filters?.from || r.occurredAt >= filters.from)),
    findProduction:   async (id: string) => records.find(r => r.id === id) ?? null,
    createProduction: async (input: any) => { const r = { id: `rec_${records.length + 1}`, ...input }; records.push(r); return r; },
    deleteProduction: async (id: string) => {
      const i = records.findIndex(r => r.id === id);
      if (i >= 0) records.splice(i, 1);
      return { id };
    },
    _records: records,
  };
  return repo as any;
}

function makeAuditRepo() {
  const events: any[] = [];
  return { record: async (e: any) => { events.push(e); }, _events: events } as any;
}

function makeService(existing: any[] = []) {
  const econ = makeEconomicsRepo(existing);
  const audit = makeAuditRepo();
  const svc = new AgroProductionService(econ, makeAnimalRepo(), makeFarmRepo(), audit);
  return { svc, econ, audit };
}

// ── Crear registros ───────────────────────────────────────────────────────────

test("agro-production: crea registro de leche con valor total calculado", async () => {
  const { svc, audit } = makeService();
  const record = await svc.createRecord("farm_1", "usr_1", {
    targetType: "ANIMAL", targetId: "ani_1", type: "MILK",
    quantity: 8, unit: "LITER", unitPrice: 18,
  });
  assert.equal(record.totalValue, 144);
  assert.equal(audit._events[0]!.action, "production.recorded");
});

test("agro-production: sin precio unitario no calcula valor total", async () => {
  const { svc } = makeService();
  const record = await svc.createRecord("farm_1", "usr_1", {
    targetType: "FARM", type: "EGGS", quantity: 38, unit: "UNIT",
  });
  assert.equal(record.totalValue, undefined);
});

test("agro-production: rechaza tipo, unidad y cantidad inválidos", async () => {
  const { svc } = makeService();
  await assert.rejects(
    () => svc.createRecord("farm_1", "usr_1", { targetType: "FARM", type: "BAD", quantity: 1, unit: "UNIT" }),
    BadRequestException,
  );
  await assert.rejects(
    () => svc.createRecord("farm_1", "usr_1", { targetType: "FARM", type: "MILK", quantity: 1, unit: "BAD" }),
    BadRequestException,
  );
  await assert.rejects(
    () => svc.createRecord("farm_1", "usr_1", { targetType: "FARM", type: "MILK", quantity: 0, unit: "LITER" }),
    BadRequestException,
  );
});

test("agro-production: rechaza ANIMAL sin targetId o con animal inexistente", async () => {
  const { svc } = makeService();
  await assert.rejects(
    () => svc.createRecord("farm_1", "usr_1", { targetType: "ANIMAL", type: "MILK", quantity: 1, unit: "LITER" }),
    BadRequestException,
  );
  await assert.rejects(
    () => svc.createRecord("farm_1", "usr_1", { targetType: "ANIMAL", targetId: "ani_X", type: "MILK", quantity: 1, unit: "LITER" }),
    NotFoundException,
  );
});

test("agro-production: rechaza dueño ajeno", async () => {
  const { svc } = makeService();
  await assert.rejects(
    () => svc.createRecord("farm_1", "usr_X", { targetType: "FARM", type: "MILK", quantity: 1, unit: "LITER" }),
    NotFoundException,
  );
});

// ── Resumen y borrado ─────────────────────────────────────────────────────────

test("agro-production: resumen agrupa por tipo con totales", async () => {
  const { svc } = makeService();
  await svc.createRecord("farm_1", "usr_1", { targetType: "ANIMAL", targetId: "ani_1", type: "MILK", quantity: 8, unit: "LITER", unitPrice: 18 });
  await svc.createRecord("farm_1", "usr_1", { targetType: "ANIMAL", targetId: "ani_1", type: "MILK", quantity: 7, unit: "LITER", unitPrice: 18 });
  await svc.createRecord("farm_1", "usr_1", { targetType: "ANIMAL_GROUP", targetId: "grp_1", type: "EGGS", quantity: 38, unit: "UNIT", unitPrice: 0.2 });

  const summary = await svc.getSummary("farm_1", "usr_1");
  const milk = summary.byType.find(t => t.type === "MILK")!;
  assert.equal(milk.quantity, 15);
  assert.equal(milk.totalValue, 270);
  assert.equal(milk.records, 2);
  assert.ok(Math.abs(summary.totalValue - (270 + 7.6)) < 0.01);
});

test("agro-production: deleteRecord elimina y audita", async () => {
  const { svc, econ, audit } = makeService();
  const record = await svc.createRecord("farm_1", "usr_1", { targetType: "FARM", type: "MILK", quantity: 5, unit: "LITER" });
  const result = await svc.deleteRecord(record.id, "usr_1");
  assert.equal(result.deleted, true);
  assert.equal(econ._records.length, 0);
  assert.ok(audit._events.some((e: any) => e.action === "production.deleted"));
});

test("agro-production: deleteRecord rechaza registro inexistente", async () => {
  const { svc } = makeService();
  await assert.rejects(() => svc.deleteRecord("rec_X", "usr_1"), NotFoundException);
});
