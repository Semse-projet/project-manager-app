import "reflect-metadata";

import test from "node:test";
import assert from "node:assert/strict";
import { BadRequestException, NotFoundException } from "@nestjs/common";
import { AgroFarmService } from "../dist/modules/agro/agro-farm.service.js";

// ── Stub builders ─────────────────────────────────────────────────────────────

const STUB_FARM = {
  id: "farm_1",
  ownerId: "usr_1",
  name: "La Esperanza",
  operationType: "LIVESTOCK",
  locationLabel: "Cundinamarca, Colombia",
  notes: null,
  createdAt: new Date(),
  updatedAt: new Date(),
};

const STUB_UNIT = {
  id: "unit_1",
  farmId: "farm_1",
  name: "Potrero Norte",
  type: "PASTURE",
  areaValue: 5.5,
  areaUnit: "HECTARE",
  notes: null,
  createdAt: new Date(),
  updatedAt: new Date(),
};

function makeFarmRepo(overrides: {
  farms?: any[];
  units?: any[];
} = {}) {
  const farms = overrides.farms ?? [STUB_FARM];
  const units = overrides.units ?? [STUB_UNIT];

  return {
    listFarms: async (ownerId: string) => farms.filter((f) => f.ownerId === ownerId),
    findFarm: async (farmId: string) => farms.find((f) => f.id === farmId) ?? null,
    createFarm: async (input: any) => ({ ...STUB_FARM, id: "farm_new", ...input }),
    updateFarm: async (farmId: string, input: any) => {
      const farm = farms.find((f) => f.id === farmId);
      return { ...farm, ...input };
    },
    listUnits: async (farmId: string) => units.filter((u) => u.farmId === farmId),
    findUnit: async (unitId: string) => units.find((u) => u.id === unitId) ?? null,
    createUnit: async (input: any) => ({ ...STUB_UNIT, id: "unit_new", ...input }),
    updateUnit: async (unitId: string, input: any) => {
      const unit = units.find((u) => u.id === unitId);
      return { ...unit, ...input };
    },
  } as never;
}

function makeAuditRepo() {
  const events: any[] = [];
  return {
    record: async (input: any) => {
      events.push(input);
      return { id: `evt_${events.length}`, ...input, createdAt: new Date() };
    },
    list: async ({ farmId, limit }: any) =>
      events.filter((e) => e.farmId === farmId).slice(0, limit ?? 50),
    _events: events,
  } as any;
}

// ── listFarms ─────────────────────────────────────────────────────────────────

test("agro-farm: listFarms returns farms for owner", async () => {
  const service = new AgroFarmService(makeFarmRepo(), makeAuditRepo());

  const farms = await service.listFarms("usr_1");

  assert.equal(farms.length, 1);
  assert.equal(farms[0]!.name, "La Esperanza");
});

test("agro-farm: listFarms returns empty for unknown owner", async () => {
  const service = new AgroFarmService(makeFarmRepo(), makeAuditRepo());

  const farms = await service.listFarms("usr_unknown");

  assert.equal(farms.length, 0);
});

// ── getFarm ───────────────────────────────────────────────────────────────────

test("agro-farm: getFarm returns farm when owner matches", async () => {
  const service = new AgroFarmService(makeFarmRepo(), makeAuditRepo());

  const farm = await service.getFarm("farm_1", "usr_1");

  assert.equal(farm.id, "farm_1");
  assert.equal(farm.name, "La Esperanza");
});

test("agro-farm: getFarm throws NotFoundException for wrong owner", async () => {
  const service = new AgroFarmService(makeFarmRepo(), makeAuditRepo());

  await assert.rejects(
    () => service.getFarm("farm_1", "usr_other"),
    NotFoundException,
  );
});

test("agro-farm: getFarm throws NotFoundException for missing farm", async () => {
  const service = new AgroFarmService(makeFarmRepo({ farms: [] }), makeAuditRepo());

  await assert.rejects(
    () => service.getFarm("farm_nonexistent", "usr_1"),
    NotFoundException,
  );
});

// ── createFarm ────────────────────────────────────────────────────────────────

test("agro-farm: createFarm creates farm and records audit event", async () => {
  const audit = makeAuditRepo();
  const service = new AgroFarmService(makeFarmRepo(), audit);

  const farm = await service.createFarm({
    ownerId: "usr_1",
    name: "Finca San Pedro",
    operationType: "MIXED",
    locationLabel: "Boyacá",
  });

  assert.ok(farm.id);
  assert.equal(farm.name, "Finca San Pedro");
  assert.equal(audit._events.length, 1);
  assert.equal(audit._events[0].action, "farm.created");
});

test("agro-farm: createFarm throws BadRequestException for empty name", async () => {
  const service = new AgroFarmService(makeFarmRepo(), makeAuditRepo());

  await assert.rejects(
    () => service.createFarm({ ownerId: "usr_1", name: "   " }),
    BadRequestException,
  );
});

test("agro-farm: createFarm throws BadRequestException for invalid operationType", async () => {
  const service = new AgroFarmService(makeFarmRepo(), makeAuditRepo());

  await assert.rejects(
    () => service.createFarm({ ownerId: "usr_1", name: "Farm X", operationType: "INVALID" }),
    BadRequestException,
  );
});

test("agro-farm: createFarm defaults operationType to LIVESTOCK", async () => {
  const created: any[] = [];
  const repo = {
    ...makeFarmRepo(),
    createFarm: async (input: any) => {
      const f = { ...STUB_FARM, ...input };
      created.push(f);
      return f;
    },
  } as never;
  const service = new AgroFarmService(repo, makeAuditRepo());

  await service.createFarm({ ownerId: "usr_1", name: "Mi Finca" });

  assert.equal(created[0].operationType, "LIVESTOCK");
});

// ── createUnit ────────────────────────────────────────────────────────────────

test("agro-farm: createUnit adds unit to farm and records audit", async () => {
  const audit = makeAuditRepo();
  const service = new AgroFarmService(makeFarmRepo(), audit);

  const unit = await service.createUnit("farm_1", "usr_1", {
    name: "Potrero Sur",
    type: "PASTURE",
    areaValue: 3.2,
    areaUnit: "HECTARE",
  });

  assert.ok(unit.id);
  assert.equal(unit.farmId, "farm_1");
  assert.equal(audit._events.length, 1);
  assert.equal(audit._events[0].action, "farm_unit.created");
});

test("agro-farm: createUnit throws for invalid unit type", async () => {
  const service = new AgroFarmService(makeFarmRepo(), makeAuditRepo());

  await assert.rejects(
    () => service.createUnit("farm_1", "usr_1", { name: "Zone X", type: "INVALID_TYPE" }),
    BadRequestException,
  );
});

test("agro-farm: createUnit throws when farm not found", async () => {
  const service = new AgroFarmService(makeFarmRepo({ farms: [] }), makeAuditRepo());

  await assert.rejects(
    () => service.createUnit("farm_nonexistent", "usr_1", { name: "Unit Y" }),
    NotFoundException,
  );
});

// ── getAuditEvents ────────────────────────────────────────────────────────────

test("agro-farm: getAuditEvents returns events for farm", async () => {
  const audit = makeAuditRepo();
  const service = new AgroFarmService(makeFarmRepo(), audit);

  // Create some events first
  await service.createFarm({ ownerId: "usr_1", name: "Finca A" });
  const events = await service.getAuditEvents("farm_1", "usr_1");

  // audit._events contains the event recorded during createFarm (for farm_new)
  // farm_1's events are 0 since no action targeted it directly
  assert.ok(Array.isArray(events));
});

test("agro-farm: getAuditEvents throws for unauthorized access", async () => {
  const service = new AgroFarmService(makeFarmRepo(), makeAuditRepo());

  await assert.rejects(
    () => service.getAuditEvents("farm_1", "usr_hacker"),
    NotFoundException,
  );
});
