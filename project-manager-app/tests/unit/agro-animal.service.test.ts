import "reflect-metadata";

import test from "node:test";
import assert from "node:assert/strict";
import { BadRequestException, NotFoundException } from "@nestjs/common";
import { AgroAnimalService } from "../../apps/api/dist/modules/agro/agro-animal.service.js";

// ── Stubs ─────────────────────────────────────────────────────────────────────

const STUB_FARM = { id: "farm_1", ownerId: "usr_1", name: "La Esperanza", operationType: "LIVESTOCK", locationLabel: null, notes: null, createdAt: new Date(), updatedAt: new Date() };

const STUB_ANIMAL = {
  id: "ani_1", farmId: "farm_1", currentUnitId: null, tagCode: "TAG-001",
  species: "CATTLE", breed: "Angus", sex: "MALE",
  birthDate: null, estimatedAgeMonths: 18,
  initialWeight: 280, currentWeight: 310,
  status: "ACTIVE",
  acquisitionDate: null, acquisitionCost: null, notes: null,
  createdAt: new Date(), updatedAt: new Date(),
};

const STUB_GROUP = {
  id: "grp_1", farmId: "farm_1", currentUnitId: null, name: "Lote A",
  species: "CATTLE", count: 25, averageWeight: 300, status: "ACTIVE",
  acquisitionDate: null, acquisitionCost: null, notes: null,
  createdAt: new Date(), updatedAt: new Date(),
};

function makeFarmRepo(farm = STUB_FARM) {
  return { findFarm: async (id: string) => id === farm.id ? farm : null } as never;
}

function makeAnimalRepo(animals = [STUB_ANIMAL], groups = [STUB_GROUP]) {
  const animalList = [...animals];
  const groupList  = [...groups];
  const events: any[] = [];
  return {
    listAnimals:       async (farmId: string)   => animalList.filter(a => a.farmId === farmId),
    findAnimal:        async (id: string)        => animalList.find(a => a.id === id) ?? null,
    createAnimal:      async (input: any)        => ({ ...STUB_ANIMAL, id: "ani_new", ...input }),
    updateAnimal:      async (id: string, patch: any) => {
      const a = animalList.find(a => a.id === id) ?? STUB_ANIMAL;
      return { ...a, ...patch };
    },
    listGroups:        async (farmId: string)    => groupList.filter(g => g.farmId === farmId),
    findGroup:         async (id: string)        => groupList.find(g => g.id === id) ?? null,
    createGroup:       async (input: any)        => ({ ...STUB_GROUP, id: "grp_new", ...input }),
    updateGroup:       async (id: string, patch: any) => {
      const g = groupList.find(g => g.id === id) ?? STUB_GROUP;
      return { ...g, ...patch };
    },
    getEntityTimeline: async (_f: string, _e: string, _id: string) => events,
  } as never;
}

function makeAuditRepo() {
  const events: any[] = [];
  return { record: async (e: any) => { events.push(e); }, _events: events } as any;
}

// ── Animals: list/get ─────────────────────────────────────────────────────────

test("agro-animal: listAnimals returns animals for farm owner", async () => {
  const svc = new AgroAnimalService(makeAnimalRepo(), makeFarmRepo(), makeAuditRepo());
  const animals = await svc.listAnimals("farm_1", "usr_1");
  assert.equal(animals.length, 1);
  assert.equal(animals[0]!.tagCode, "TAG-001");
});

test("agro-animal: listAnimals throws for wrong owner", async () => {
  const svc = new AgroAnimalService(makeAnimalRepo(), makeFarmRepo(), makeAuditRepo());
  await assert.rejects(() => svc.listAnimals("farm_1", "usr_X"), NotFoundException);
});

test("agro-animal: getAnimal throws for unknown id", async () => {
  const svc = new AgroAnimalService(makeAnimalRepo([]), makeFarmRepo(), makeAuditRepo());
  await assert.rejects(() => svc.getAnimal("ani_unknown"), NotFoundException);
});

// ── Animals: create ───────────────────────────────────────────────────────────

test("agro-animal: createAnimal creates and records audit", async () => {
  const audit = makeAuditRepo();
  const svc = new AgroAnimalService(makeAnimalRepo(), makeFarmRepo(), audit);
  const animal = await svc.createAnimal("farm_1", "usr_1", {
    species: "CATTLE", sex: "FEMALE", tagCode: "TAG-002", initialWeight: 250,
  });
  assert.ok(animal.id);
  assert.equal(audit._events.length, 1);
  assert.equal(audit._events[0].action, "animal.created");
});

test("agro-animal: createAnimal throws for invalid species", async () => {
  const svc = new AgroAnimalService(makeAnimalRepo(), makeFarmRepo(), makeAuditRepo());
  await assert.rejects(
    () => svc.createAnimal("farm_1", "usr_1", { species: "LION", sex: "MALE" }),
    BadRequestException,
  );
});

test("agro-animal: createAnimal throws for invalid sex", async () => {
  const svc = new AgroAnimalService(makeAnimalRepo(), makeFarmRepo(), makeAuditRepo());
  await assert.rejects(
    () => svc.createAnimal("farm_1", "usr_1", { species: "CATTLE", sex: "NEUTER" }),
    BadRequestException,
  );
});

// ── Animals: move/weigh/status ────────────────────────────────────────────────

test("agro-animal: moveAnimal updates currentUnitId and records audit", async () => {
  const audit = makeAuditRepo();
  const svc = new AgroAnimalService(makeAnimalRepo(), makeFarmRepo(), audit);
  const updated = await svc.moveAnimal("ani_1", "usr_1", "unit_2", "Moving to new pasture");
  assert.equal(updated.currentUnitId, "unit_2");
  assert.equal(audit._events[0].action, "animal.moved");
});

test("agro-animal: moveAnimal rejects inactive animal", async () => {
  const inactiveAnimal = { ...STUB_ANIMAL, status: "SOLD" };
  const svc = new AgroAnimalService(makeAnimalRepo([inactiveAnimal]), makeFarmRepo(), makeAuditRepo());
  await assert.rejects(() => svc.moveAnimal("ani_1", "usr_1", "unit_2"), BadRequestException);
});

test("agro-animal: weighAnimal updates weight and records audit", async () => {
  const audit = makeAuditRepo();
  const svc = new AgroAnimalService(makeAnimalRepo(), makeFarmRepo(), audit);
  const updated = await svc.weighAnimal("ani_1", "usr_1", 350);
  assert.equal(updated.currentWeight, 350);
  assert.equal(audit._events[0].action, "animal.weighed");
});

test("agro-animal: weighAnimal throws for non-positive weight", async () => {
  const svc = new AgroAnimalService(makeAnimalRepo(), makeFarmRepo(), makeAuditRepo());
  await assert.rejects(() => svc.weighAnimal("ani_1", "usr_1", 0), BadRequestException);
});

test("agro-animal: changeAnimalStatus updates status", async () => {
  const audit = makeAuditRepo();
  const svc = new AgroAnimalService(makeAnimalRepo(), makeFarmRepo(), audit);
  const updated = await svc.changeAnimalStatus("ani_1", "usr_1", "SOLD", "Sold at market");
  assert.equal(updated.status, "SOLD");
  assert.equal(audit._events[0].action, "animal.status_changed");
});

test("agro-animal: changeAnimalStatus throws for invalid status", async () => {
  const svc = new AgroAnimalService(makeAnimalRepo(), makeFarmRepo(), makeAuditRepo());
  await assert.rejects(() => svc.changeAnimalStatus("ani_1", "usr_1", "ESCAPED"), BadRequestException);
});

// ── Groups: create/move/count ────────────────────────────────────────────────

test("agro-animal: createGroup creates group and records audit", async () => {
  const audit = makeAuditRepo();
  const svc = new AgroAnimalService(makeAnimalRepo(), makeFarmRepo(), audit);
  const group = await svc.createGroup("farm_1", "usr_1", {
    name: "Lote B", species: "CATTLE", count: 10,
  });
  assert.ok(group.id);
  assert.equal(audit._events[0].action, "animal_group.created");
});

test("agro-animal: createGroup throws for count < 1", async () => {
  const svc = new AgroAnimalService(makeAnimalRepo(), makeFarmRepo(), makeAuditRepo());
  await assert.rejects(
    () => svc.createGroup("farm_1", "usr_1", { name: "G", species: "CATTLE", count: 0 }),
    BadRequestException,
  );
});

test("agro-animal: adjustGroupCount updates count", async () => {
  const audit = makeAuditRepo();
  const svc = new AgroAnimalService(makeAnimalRepo(), makeFarmRepo(), audit);
  const updated = await svc.adjustGroupCount("grp_1", "usr_1", 20, "2 died");
  assert.equal(updated.count, 20);
  assert.equal(audit._events[0].action, "animal_group.count_adjusted");
});

test("agro-animal: adjustGroupCount throws for negative count", async () => {
  const svc = new AgroAnimalService(makeAnimalRepo(), makeFarmRepo(), makeAuditRepo());
  await assert.rejects(() => svc.adjustGroupCount("grp_1", "usr_1", -1), BadRequestException);
});

test("agro-animal: moveGroup throws when group not ACTIVE", async () => {
  const inactive = { ...STUB_GROUP, status: "INACTIVE" };
  const svc = new AgroAnimalService(makeAnimalRepo([], [inactive]), makeFarmRepo(), makeAuditRepo());
  await assert.rejects(() => svc.moveGroup("grp_1", "usr_1", "unit_3"), BadRequestException);
});
