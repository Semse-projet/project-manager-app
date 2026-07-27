import "reflect-metadata";

import test from "node:test";
import assert from "node:assert/strict";
import { AgroSyncService } from "../dist/modules/agro/agro-sync.service.js";

const STUB_FARM = { id: "farm_1", ownerId: "usr_1", name: "La Esperanza", operationType: "LIVESTOCK", locationLabel: null, notes: null, createdAt: new Date(), updatedAt: new Date() };

function makePrisma(overrides: Record<string, any> = {}) {
  const auditEvents: any[] = [];
  const tasks: any[] = [];
  const animals: any[] = [{ id: "ani_1", farmId: "farm_1", currentWeight: 300 }];
  const groups: any[] = [{ id: "grp_1", farmId: "farm_1" }];
  const evidenceItems: any[] = [];

  return {
    agroAuditEvent: {
      findFirst: async ({ where }: any) =>
        auditEvents.find(e => e.farmId === where.farmId && e.action === where.action) ?? null,
      create: async ({ data }: any) => { auditEvents.push(data); return { ...data, id: `evt_${auditEvents.length}` }; },
    },
    agroFarmTask: {
      create: async ({ data }: any) => { tasks.push(data); return { ...data, id: `task_${tasks.length}` }; },
      updateMany: async () => ({ count: 1 }),
    },
    agroAnimal: {
      updateMany: async () => ({ count: 1 }),
    },
    agroAnimalGroup: {
      updateMany: async () => ({ count: 1 }),
    },
    agroEvidenceItem: {
      create: async ({ data }: any) => { evidenceItems.push(data); return { ...data, id: `ev_${evidenceItems.length}` }; },
    },
    ...overrides,
    _auditEvents: auditEvents,
    _tasks: tasks,
    _evidenceItems: evidenceItems,
  } as any;
}

function makeFarmRepo(farm = STUB_FARM) {
  return { findFarm: async (id: string) => id === farm.id ? farm : null } as never;
}

function makeInventoryRepo() {
  const movements: any[] = [];
  return {
    createMovement: async (input: any) => { movements.push(input); return { id: "mov_1", ...input }; },
    _movements: movements,
  } as never;
}

function makeAuditRepo(prisma: any) {
  return {
    record: async (input: any) => {
      prisma.agroAuditEvent._auditEvents?.push(input) ??
        await prisma.agroAuditEvent.create({ data: input });
    },
  } as any;
}

function makeSvc(prisma: any) {
  const invRepo = makeInventoryRepo();
  const auditRepo = makeAuditRepo(prisma);
  const farmRepo = makeFarmRepo();
  return { svc: new AgroSyncService(prisma, farmRepo, invRepo, auditRepo), invRepo, prisma };
}

// ── sync: farm_task.create ────────────────────────────────────────────────────

test("agro-sync: farm_task.create event creates task", async () => {
  const prisma = makePrisma();
  const { svc } = makeSvc(prisma);
  const results = await svc.processSyncEvents("usr_1", [{
    clientEventId: "evt_001",
    farmId: "farm_1",
    action: "farm_task.create",
    payload: { title: "Feed animals", type: "FEEDING", priority: "HIGH" },
    occurredAt: new Date().toISOString(),
  }]);
  assert.equal(results[0]!.status, "SYNCED");
  assert.equal(prisma._tasks.length, 1);
  assert.equal(prisma._tasks[0].title, "Feed animals");
});

// ── sync: deduplication ───────────────────────────────────────────────────────

test("agro-sync: duplicate clientEventId returns DUPLICATE", async () => {
  const existingAuditEvent = {
    farmId: "farm_1",
    action: "sync.evt_dup_001",
    entityType: "SYNC",
    entityId: "evt_dup_001",
  };
  const prisma = makePrisma({
    agroAuditEvent: {
      findFirst: async ({ where }: any) =>
        where.action === "sync.evt_dup_001" ? existingAuditEvent : null,
      create: async (d: any) => d,
    },
  });
  const { svc } = makeSvc(prisma);
  const results = await svc.processSyncEvents("usr_1", [{
    clientEventId: "evt_dup_001",
    farmId: "farm_1",
    action: "farm_task.create",
    payload: { title: "Dup task", type: "FEEDING" },
    occurredAt: new Date().toISOString(),
  }]);
  assert.equal(results[0]!.status, "DUPLICATE");
});

// ── sync: unknown farm ────────────────────────────────────────────────────────

test("agro-sync: wrong farmId returns FAILED", async () => {
  const prisma = makePrisma();
  const { svc } = makeSvc(prisma);
  const results = await svc.processSyncEvents("usr_1", [{
    clientEventId: "evt_002",
    farmId: "farm_unknown",
    action: "farm_task.create",
    payload: { title: "T", type: "FEEDING" },
    occurredAt: new Date().toISOString(),
  }]);
  assert.equal(results[0]!.status, "FAILED");
  assert.ok(results[0]!.error?.includes("not found"));
});

// ── sync: unsupported action ──────────────────────────────────────────────────

test("agro-sync: unsupported action returns FAILED", async () => {
  const prisma = makePrisma();
  const { svc } = makeSvc(prisma);
  const results = await svc.processSyncEvents("usr_1", [{
    clientEventId: "evt_003",
    farmId: "farm_1",
    action: "farm.delete" as any,
    payload: {},
    occurredAt: new Date().toISOString(),
  }]);
  assert.equal(results[0]!.status, "FAILED");
});

// ── sync: animal.weigh ────────────────────────────────────────────────────────

test("agro-sync: animal.weigh event processes successfully", async () => {
  const prisma = makePrisma();
  const { svc } = makeSvc(prisma);
  const results = await svc.processSyncEvents("usr_1", [{
    clientEventId: "evt_004",
    farmId: "farm_1",
    action: "animal.weigh",
    payload: { animalId: "ani_1", weight: 350 },
    occurredAt: new Date().toISOString(),
  }]);
  assert.equal(results[0]!.status, "SYNCED");
});

// ── sync: evidence.note.create ────────────────────────────────────────────────

test("agro-sync: evidence.note.create creates evidence item", async () => {
  const prisma = makePrisma();
  const { svc } = makeSvc(prisma);
  const results = await svc.processSyncEvents("usr_1", [{
    clientEventId: "evt_005",
    farmId: "farm_1",
    action: "evidence.note.create",
    payload: { entityType: "GENERAL", note: "Everything OK" },
    occurredAt: new Date().toISOString(),
  }]);
  assert.equal(results[0]!.status, "SYNCED");
  assert.equal(prisma._evidenceItems.length, 1);
  assert.equal(prisma._evidenceItems[0].note, "Everything OK");
});

// ── sync: inventory_movement.create ──────────────────────────────────────────

test("agro-sync: inventory_movement.create records movement", async () => {
  const prisma = makePrisma();
  const invRepo = makeInventoryRepo();
  const { svc } = makeSvc(prisma);
  const results = await svc.processSyncEvents("usr_1", [{
    clientEventId: "evt_006",
    farmId: "farm_1",
    action: "inventory_movement.create",
    payload: { itemId: "item_1", movementType: "OUT", quantity: 10 },
    occurredAt: new Date().toISOString(),
  }]);
  assert.equal(results[0]!.status, "SYNCED");
});

// ── sync: batch processing ────────────────────────────────────────────────────

test("agro-sync: batch with mixed results processes all events", async () => {
  const prisma = makePrisma();
  const { svc } = makeSvc(prisma);
  const results = await svc.processSyncEvents("usr_1", [
    {
      clientEventId: "batch_1",
      farmId: "farm_1",
      action: "farm_task.create",
      payload: { title: "Task A", type: "FEEDING" },
      occurredAt: new Date().toISOString(),
    },
    {
      clientEventId: "batch_2",
      farmId: "farm_unknown",
      action: "farm_task.create",
      payload: { title: "Task B", type: "FEEDING" },
      occurredAt: new Date().toISOString(),
    },
  ]);
  assert.equal(results.length, 2);
  assert.equal(results[0]!.status, "SYNCED");
  assert.equal(results[1]!.status, "FAILED");
});
