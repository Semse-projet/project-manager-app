import "reflect-metadata";
import test from "node:test";
import assert from "node:assert/strict";
import { AgroInventoryService } from "../dist/modules/agro/agro-inventory.service.js";
import { AgroDashboardService } from "../dist/modules/agro/agro-dashboard.service.js";
import { AgroAuditReportService } from "../dist/modules/agro/agro-audit-report.service.js";

// AUDIT_REMEDIATION_PLAN 0.49a / PD-08 (owner decision 2026-11-10): an exit is never rejected for
// insufficient stock — field consumption is real even when the recorded inventory is behind — but a
// movement that leaves the item below zero is marked as an overdraft (response + its own audit row) and
// surfaced to supervisors (INVENTORY_OVERDRAFT dashboard alert, RECONCILE_INVENTORY next action,
// audit-report finding).

const FARM = { id: "farm_1", ownerId: "usr_1", name: "La Esperanza" };
const ITEM = { id: "item_1", farmId: "farm_1", name: "Maiz molido", category: "FEED", unit: "KG", minimumStock: 50 };

function movement(type: "IN" | "OUT" | "ADJUSTMENT", qty: number, id = `mov_${Math.random()}`) {
  return {
    id, farmId: "farm_1", itemId: "item_1", movementType: type,
    quantity: type === "ADJUSTMENT" ? null : qty, adjustmentDelta: type === "ADJUSTMENT" ? qty : null,
    unitCost: null, totalCost: null, occurredAt: new Date(), notes: null, createdAt: new Date(),
  };
}

function inventoryService(initial: ReturnType<typeof movement>[]) {
  const movements = [...initial];
  const audit: any[] = [];
  const repo = {
    findItem: async (id: string) => (id === ITEM.id ? ITEM : null),
    createMovement: async (input: any) => {
      const created = { ...movement(input.movementType, input.quantity ?? input.adjustmentDelta ?? 0, "mov_new"), ...input, id: "mov_new" };
      movements.push(created);
      return created;
    },
    createCostEntry: async () => ({}),
    computeStock: async (itemId: string) =>
      movements.filter((m) => m.itemId === itemId).reduce((s, m) => {
        if (m.movementType === "IN") return s + Number(m.quantity ?? 0);
        if (m.movementType === "OUT") return s - Number(m.quantity ?? 0);
        return s + Number(m.adjustmentDelta ?? 0);
      }, 0),
  };
  const farmRepo = { findFarm: async (id: string) => (id === FARM.id ? FARM : null) };
  const svc = new AgroInventoryService(repo as never, farmRepo as never, { record: async (e: any) => { audit.push(e); } } as never);
  return { svc, audit };
}

test("an exit past zero is recorded, not rejected, and flagged as an overdraft", async () => {
  const { svc, audit } = inventoryService([movement("IN", 10)]);
  const result: any = await svc.consumeInventory("farm_1", "usr_1", { itemId: "item_1", quantity: 15 });
  assert.equal(result.id, "mov_new");
  assert.equal(result.overdraft, true);
  assert.equal(result.resultingStock, -5);
  const overdraftRow = audit.find((e) => e.action === "inventory.overdraft_recorded");
  assert.ok(overdraftRow, "dedicated audit row for the overdraft");
  assert.equal(overdraftRow.entityId, "mov_new");
  assert.equal(overdraftRow.after.resultingStock, -5);
  assert.equal(overdraftRow.after.itemName, "Maiz molido");
  const recorded = audit.find((e) => e.action === "inventory.movement_recorded");
  assert.equal(recorded.after.overdraft, true);
});

test("an exit that keeps stock at or above zero is not an overdraft and adds no extra audit row", async () => {
  const { svc, audit } = inventoryService([movement("IN", 10)]);
  const exact: any = await svc.consumeInventory("farm_1", "usr_1", { itemId: "item_1", quantity: 10 });
  assert.equal(exact.overdraft, false);
  assert.equal(exact.resultingStock, 0);
  assert.equal(audit.some((e) => e.action === "inventory.overdraft_recorded"), false);
});

test("a negative ADJUSTMENT that leaves stock below zero is also flagged", async () => {
  const { svc } = inventoryService([movement("IN", 3)]);
  const result: any = await svc.recordMovement("farm_1", "usr_1", { itemId: "item_1", movementType: "ADJUSTMENT", adjustmentDelta: -4 });
  assert.equal(result.overdraft, true);
  assert.equal(result.resultingStock, -1);
});

function fakePrisma(movements: ReturnType<typeof movement>[], items = [ITEM]) {
  const empty = { findMany: async () => [] };
  return {
    agroAnimal: empty, agroAnimalGroup: empty, agroFarmTask: empty, agroAuditEvent: empty, agroEvidenceItem: empty,
    agroCostEntry: empty, agroProductionRecord: empty, agroSaleRecord: empty,
    agroInventoryItem: { findMany: async () => items },
    agroInventoryMovement: { findMany: async () => movements },
  };
}
const farmRepo = { findFarm: async () => FARM };

test("dashboard: negative stock raises a CRITICAL INVENTORY_OVERDRAFT alert, not a duplicate LOW_STOCK line", async () => {
  const dashboard = new AgroDashboardService(fakePrisma([movement("IN", 10), movement("OUT", 15)]) as never, farmRepo as never);
  const result: any = await dashboard.getDashboard("farm_1", "usr_1");
  const types = result.alerts.map((a: any) => a.type);
  assert.deepEqual(types.filter((t: string) => t === "INVENTORY_OVERDRAFT" || t === "LOW_STOCK"), ["INVENTORY_OVERDRAFT"]);
  const alert = result.alerts.find((a: any) => a.type === "INVENTORY_OVERDRAFT");
  assert.equal(alert.severity, "CRITICAL");
  assert.equal(alert.entityId, "item_1");
  assert.match(alert.message, /-5 KG/);
  assert.equal(result.nextBestActions.some((a: any) => a.action === "RECONCILE_INVENTORY"), true);
});

test("dashboard: an overdraft is reported even when the item has no minimumStock", async () => {
  const dashboard = new AgroDashboardService(
    fakePrisma([movement("OUT", 2)], [{ ...ITEM, minimumStock: null as unknown as number }]) as never,
    farmRepo as never,
  );
  const result: any = await dashboard.getDashboard("farm_1", "usr_1");
  assert.equal(result.alerts.some((a: any) => a.type === "INVENTORY_OVERDRAFT"), true);
});

test("weekly audit report: negative stock adds an INVENTORY overdraft finding", async () => {
  const report = new AgroAuditReportService(fakePrisma([movement("IN", 10), movement("OUT", 15)]) as never, farmRepo as never);
  const result: any = await report.generateWeeklyReport("farm_1", "usr_1");
  assert.equal(result.findings.some((f: any) => f.area === "INVENTORY" && /negative stock/.test(f.message)), true);
});

test("dashboard: positive low stock keeps its LOW_STOCK alert and no overdraft", async () => {
  const dashboard = new AgroDashboardService(fakePrisma([movement("IN", 10)]) as never, farmRepo as never);
  const result: any = await dashboard.getDashboard("farm_1", "usr_1");
  const types = result.alerts.map((a: any) => a.type);
  assert.equal(types.includes("LOW_STOCK"), true);
  assert.equal(types.includes("INVENTORY_OVERDRAFT"), false);
  assert.equal(result.nextBestActions.some((a: any) => a.action === "RECONCILE_INVENTORY"), false);
});
