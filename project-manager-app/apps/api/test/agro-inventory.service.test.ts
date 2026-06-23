import "reflect-metadata";

import test from "node:test";
import assert from "node:assert/strict";
import { BadRequestException, NotFoundException } from "@nestjs/common";
import { AgroInventoryService } from "../dist/modules/agro/agro-inventory.service.js";

// ── Stubs ─────────────────────────────────────────────────────────────────────

const STUB_FARM = { id: "farm_1", ownerId: "usr_1", name: "La Esperanza", operationType: "LIVESTOCK", locationLabel: null, notes: null, createdAt: new Date(), updatedAt: new Date() };

const STUB_ITEM = {
  id: "item_1", farmId: "farm_1", name: "Maiz molido",
  category: "FEED", unit: "KG", minimumStock: 50, notes: null,
  createdAt: new Date(), updatedAt: new Date(),
};

const STUB_MOVEMENT = {
  id: "mov_1", farmId: "farm_1", itemId: "item_1",
  movementType: "IN", quantity: 100, adjustmentDelta: null,
  unitCost: 1.5, totalCost: 150, relatedTaskId: null,
  targetType: null, targetId: null,
  occurredAt: new Date(), notes: null, createdAt: new Date(),
};

function makeFarmRepo(farm = STUB_FARM) {
  return { findFarm: async (id: string) => id === farm.id ? farm : null } as never;
}

function makeInventoryRepo(items = [STUB_ITEM], movements = [STUB_MOVEMENT]) {
  const itemList = [...items];
  const movList  = [...movements];
  const costs: any[] = [];
  return {
    listItems:    async (farmId: string) => itemList.filter(i => i.farmId === farmId),
    findItem:     async (id: string)     => itemList.find(i => i.id === id) ?? null,
    createItem:   async (input: any)     => ({ ...STUB_ITEM, id: "item_new", ...input }),
    updateItem:   async (id: string, patch: any) => {
      const item = itemList.find(i => i.id === id) ?? STUB_ITEM;
      return { ...item, ...patch };
    },
    listMovements:  async (farmId: string, itemId?: string) =>
      movList.filter(m => m.farmId === farmId && (!itemId || m.itemId === itemId)),
    createMovement: async (input: any) => ({ ...STUB_MOVEMENT, id: "mov_new", ...input }),
    computeStock:   async (itemId: string) =>
      movList.filter(m => m.itemId === itemId)
        .reduce((s, m) => {
          if (m.movementType === "IN")  return s + (m.quantity ?? 0);
          if (m.movementType === "OUT") return s - (m.quantity ?? 0);
          return s + (m.adjustmentDelta ?? 0);
        }, 0),
    listCosts:      async (_f: string, filters?: any) => costs.filter(c => !filters?.targetType || c.targetType === filters.targetType),
    createCostEntry: async (input: any) => { const e = { id: "cost_new", ...input }; costs.push(e); return e; },
    costSummary:    async (_farmId: string, _since: Date) => [{ category: "FEED", total: 150 }],
    _costs: costs,
  } as never;
}

function makeAuditRepo() {
  const events: any[] = [];
  return { record: async (e: any) => { events.push(e); }, _events: events } as any;
}

// ── Items ─────────────────────────────────────────────────────────────────────

test("agro-inventory: listItems returns items for farm", async () => {
  const svc = new AgroInventoryService(makeInventoryRepo(), makeFarmRepo(), makeAuditRepo());
  const items = await svc.listItems("farm_1", "usr_1");
  assert.equal(items.length, 1);
  assert.equal(items[0]!.name, "Maiz molido");
});

test("agro-inventory: listItems throws for wrong owner", async () => {
  const svc = new AgroInventoryService(makeInventoryRepo(), makeFarmRepo(), makeAuditRepo());
  await assert.rejects(() => svc.listItems("farm_1", "usr_X"), NotFoundException);
});

test("agro-inventory: createItem creates item and records audit", async () => {
  const audit = makeAuditRepo();
  const svc = new AgroInventoryService(makeInventoryRepo(), makeFarmRepo(), audit);
  const item = await svc.createItem("farm_1", "usr_1", {
    name: "Vitaminas", category: "MEDICINE", unit: "DOSE",
  });
  assert.ok(item.id);
  assert.equal(audit._events[0].action, "inventory_item.created");
});

test("agro-inventory: createItem throws for invalid category", async () => {
  const svc = new AgroInventoryService(makeInventoryRepo(), makeFarmRepo(), makeAuditRepo());
  await assert.rejects(
    () => svc.createItem("farm_1", "usr_1", { name: "X", category: "ROCKS", unit: "KG" }),
    BadRequestException,
  );
});

test("agro-inventory: createItem throws for invalid unit", async () => {
  const svc = new AgroInventoryService(makeInventoryRepo(), makeFarmRepo(), makeAuditRepo());
  await assert.rejects(
    () => svc.createItem("farm_1", "usr_1", { name: "X", category: "FEED", unit: "CARTLOAD" }),
    BadRequestException,
  );
});

// ── Stock ─────────────────────────────────────────────────────────────────────

test("agro-inventory: getItemStock computes stock from movements", async () => {
  const svc = new AgroInventoryService(makeInventoryRepo(), makeFarmRepo(), makeAuditRepo());
  const { stock } = await svc.getItemStock("item_1", "usr_1");
  assert.equal(stock, 100); // one IN movement of 100
});

// ── Movements ─────────────────────────────────────────────────────────────────

test("agro-inventory: recordMovement IN creates movement", async () => {
  const audit = makeAuditRepo();
  const svc = new AgroInventoryService(makeInventoryRepo(), makeFarmRepo(), audit);
  const mov = await svc.recordMovement("farm_1", "usr_1", {
    itemId: "item_1", movementType: "IN", quantity: 50, unitCost: 2.0,
  });
  assert.equal(mov.movementType, "IN");
  assert.equal(audit._events[0].action, "inventory.movement_recorded");
});

test("agro-inventory: recordMovement OUT auto-generates cost entry when unitCost given", async () => {
  const repo = makeInventoryRepo();
  const svc = new AgroInventoryService(repo, makeFarmRepo(), makeAuditRepo());
  await svc.recordMovement("farm_1", "usr_1", {
    itemId: "item_1", movementType: "OUT", quantity: 20, unitCost: 1.5,
  });
  assert.equal((repo as any)._costs.length, 1);
  assert.equal((repo as any)._costs[0].category, "FEED");
  assert.equal((repo as any)._costs[0].amount, 30); // 20 * 1.5
});

test("agro-inventory: recordMovement throws when quantity missing for OUT", async () => {
  const svc = new AgroInventoryService(makeInventoryRepo(), makeFarmRepo(), makeAuditRepo());
  await assert.rejects(
    () => svc.recordMovement("farm_1", "usr_1", { itemId: "item_1", movementType: "OUT" }),
    BadRequestException,
  );
});

test("agro-inventory: recordMovement ADJUSTMENT requires adjustmentDelta", async () => {
  const svc = new AgroInventoryService(makeInventoryRepo(), makeFarmRepo(), makeAuditRepo());
  await assert.rejects(
    () => svc.recordMovement("farm_1", "usr_1", { itemId: "item_1", movementType: "ADJUSTMENT" }),
    BadRequestException,
  );
});

test("agro-inventory: consumeInventory is alias for OUT movement", async () => {
  const audit = makeAuditRepo();
  const svc = new AgroInventoryService(makeInventoryRepo(), makeFarmRepo(), audit);
  const mov = await svc.consumeInventory("farm_1", "usr_1", { itemId: "item_1", quantity: 10 });
  assert.equal(mov.movementType, "OUT");
});

// ── Cost Summary ──────────────────────────────────────────────────────────────

test("agro-inventory: getCostSummary returns total and by-category", async () => {
  const svc = new AgroInventoryService(makeInventoryRepo(), makeFarmRepo(), makeAuditRepo());
  const { byCategory, total } = await svc.getCostSummary("farm_1", "usr_1", 30);
  assert.ok(Array.isArray(byCategory));
  assert.equal(total, 150);
});

test("agro-inventory: createManualCost throws for invalid category", async () => {
  const svc = new AgroInventoryService(makeInventoryRepo(), makeFarmRepo(), makeAuditRepo());
  await assert.rejects(
    () => svc.createManualCost("farm_1", "usr_1", { targetType: "GENERAL", category: "MAGIC", amount: 100 }),
    BadRequestException,
  );
});

test("agro-inventory: createManualCost throws for non-positive amount", async () => {
  const svc = new AgroInventoryService(makeInventoryRepo(), makeFarmRepo(), makeAuditRepo());
  await assert.rejects(
    () => svc.createManualCost("farm_1", "usr_1", { targetType: "GENERAL", category: "FEED", amount: 0 }),
    BadRequestException,
  );
});
