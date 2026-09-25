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

  const movements: any[] = [];

  const db: any = {
    agroAuditEvent: {
      findFirst: async ({ where }: any) =>
        auditEvents.find(e => e.farmId === where.farmId && e.action === where.action) ?? null,
      create: async ({ data }: any) => {
        // Emula el indice unico (farmId, clientEventId) del que ahora depende
        // la deduplicacion. Postgres no considera iguales dos NULL, asi que
        // solo colisionan los marcadores de sync, no la auditoria normal.
        if (data.clientEventId != null) {
          const clash = auditEvents.some(
            e => e.farmId === data.farmId && e.clientEventId === data.clientEventId,
          );
          if (clash) {
            throw Object.assign(new Error("Unique constraint failed"), { code: "P2002" });
          }
        }
        auditEvents.push(data);
        return { ...data, id: `evt_${auditEvents.length}` };
      },
    },
    agroInventoryMovement: {
      create: async ({ data }: any) => { movements.push(data); return { ...data, id: `mov_${movements.length}` }; },
    },
    agroFarmTask: {
      create: async ({ data }: any) => { tasks.push(data); return { ...data, id: `task_${tasks.length}` }; },
      updateMany: async () => ({ count: 1 }),
      // Espejo JobTask (T-051): el stub no persiste filas completas; sin tarea no hay espejo.
      findUnique: async () => null,
      update: async () => ({}),
    },
    agroFarm: { findUnique: async () => ({ tenantId: null, ownerId: "usr_1" }) },
    jobTask: { upsert: async () => { throw new Error("unexpected JobTask mirror in stub"); } },
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
    _movements: movements,
  };

  // $transaction con las dos propiedades que importan aqui: atomicidad (si el
  // callback lanza, se revierten sus escrituras) y aislamiento (dos
  // transacciones no se entrelazan). Sin aislamiento, revertir la perdedora de
  // una carrera borraria tambien lo que escribio la ganadora, que es un
  // artefacto del stub y no algo que Postgres permita.
  let queue: Promise<unknown> = Promise.resolve();
  db.$transaction = (fn: any) => {
    const run = queue.then(() => runTransaction(fn), () => runTransaction(fn));
    queue = run.catch(() => undefined);
    return run;
  };

  const runTransaction = async (fn: any) => {
    const snapshot = {
      auditEvents:    [...auditEvents],
      tasks:          [...tasks],
      animals:        animals.map(a => ({ ...a })),
      groups:         groups.map(g => ({ ...g })),
      evidenceItems:  [...evidenceItems],
      movements:      [...movements],
    };
    try {
      return await fn(db);
    } catch (err) {
      auditEvents.length   = 0; auditEvents.push(...snapshot.auditEvents);
      tasks.length         = 0; tasks.push(...snapshot.tasks);
      animals.length       = 0; animals.push(...snapshot.animals);
      groups.length        = 0; groups.push(...snapshot.groups);
      evidenceItems.length = 0; evidenceItems.push(...snapshot.evidenceItems);
      movements.length     = 0; movements.push(...snapshot.movements);
      throw err;
    }
  };

  return db as any;
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

function makeSvc(prisma: any) {
  const invRepo = makeInventoryRepo();
  const farmRepo = makeFarmRepo();
  return { svc: new AgroSyncService(prisma, farmRepo, invRepo), invRepo, prisma };
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
  // Reenviar el mismo evento es lo que hace la cola offline cuando vuelve la
  // señal sin haber recibido la respuesta anterior. Se ejercita el mecanismo
  // real —el unique (farmId, clientEventId)— en vez de stubear la deteccion.
  const prisma = makePrisma();
  const { svc } = makeSvc(prisma);
  const event = {
    clientEventId: "evt_dup_001",
    farmId: "farm_1",
    action: "farm_task.create" as const,
    payload: { title: "Dup task", type: "FEEDING" },
    occurredAt: new Date().toISOString(),
  };

  const first = await svc.processSyncEvents("usr_1", [event]);
  assert.equal(first[0]!.status, "SYNCED");

  const second = await svc.processSyncEvents("usr_1", [event]);
  assert.equal(second[0]!.status, "DUPLICATE");

  // Lo que de verdad importa: la tarea se creo una sola vez.
  assert.equal(prisma._tasks.length, 1);
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

// ── Regresiones de la deduplicacion offline ──────────────────────────────────

test("agro-sync: el reintento concurrente no aplica la accion dos veces", async () => {
  // Dos entregas del mismo evento en paralelo: es lo que produce una conexion
  // intermitente en campo. Antes ambas pasaban el findFirst y aplicaban.
  const prisma = makePrisma();
  const { svc } = makeSvc(prisma);
  const event = {
    clientEventId: "evt_race_001",
    farmId: "farm_1",
    action: "farm_task.create" as const,
    payload: { title: "Carrera", type: "FEEDING" },
    occurredAt: new Date().toISOString(),
  };

  const [a, b] = await Promise.all([
    svc.processSyncEvents("usr_1", [event]),
    svc.processSyncEvents("usr_1", [event]),
  ]);

  const statuses = [a[0]!.status, b[0]!.status].sort();
  assert.deepEqual(statuses, ["DUPLICATE", "SYNCED"]);
  assert.equal(prisma._tasks.length, 1, "la tarea debe crearse exactamente una vez");
});

test("agro-sync: si aplicar falla, el evento queda reintentable y no marcado", async () => {
  // El marcador de dedup y la accion van en la misma transaccion: si la accion
  // revienta, el marcador no puede sobrevivir, porque si no el reintento
  // devolveria DUPLICATE y la accion no se aplicaria jamas.
  const prisma = makePrisma();
  let shouldFail = true;
  prisma.agroFarmTask.create = async ({ data }: any) => {
    if (shouldFail) throw new Error("boom: fallo transitorio de la base");
    prisma._tasks.push(data);
    return { ...data, id: "task_ok" };
  };

  const { svc } = makeSvc(prisma);
  const event = {
    clientEventId: "evt_retry_001",
    farmId: "farm_1",
    action: "farm_task.create" as const,
    payload: { title: "Reintentable", type: "FEEDING" },
    occurredAt: new Date().toISOString(),
  };

  const failed = await svc.processSyncEvents("usr_1", [event]);
  assert.equal(failed[0]!.status, "FAILED");
  assert.equal(
    prisma._auditEvents.filter((e: any) => e.clientEventId === "evt_retry_001").length,
    0,
    "el marcador de dedup no debe quedar tras un fallo",
  );

  shouldFail = false;
  const retried = await svc.processSyncEvents("usr_1", [event]);
  assert.equal(retried[0]!.status, "SYNCED", "el reintento debe poder aplicarse");
  assert.equal(prisma._tasks.length, 1);
});

test("agro-sync: completar una tarea inexistente devuelve FAILED, no SYNCED", async () => {
  // updateMany sobre una entidad ausente afecta 0 filas. Antes eso devolvia
  // SYNCED y el cliente borraba el evento de su cola creyendolo aplicado.
  const prisma = makePrisma();
  prisma.agroFarmTask.updateMany = async () => ({ count: 0 });

  const { svc } = makeSvc(prisma);
  const results = await svc.processSyncEvents("usr_1", [{
    clientEventId: "evt_missing_001",
    farmId: "farm_1",
    action: "farm_task.complete",
    payload: { taskId: "task_inexistente" },
    occurredAt: new Date().toISOString(),
  }]);

  assert.equal(results[0]!.status, "FAILED");
  assert.match(results[0]!.error ?? "", /not found/i);
  assert.equal(
    prisma._auditEvents.filter((e: any) => e.clientEventId === "evt_missing_001").length,
    0,
    "no debe quedar marcador de dedup para un evento que no se aplico",
  );
});
