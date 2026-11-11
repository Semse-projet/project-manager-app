import "reflect-metadata";

import test from "node:test";
import assert from "node:assert/strict";
import { TaskAllocationsService } from "../dist/modules/organizations/task-allocations.service.js";

type Row = Record<string, any>;

function makeWorld() {
  const allocations: Row[] = [];
  const audits: Row[] = [];
  const crews: Row[] = [
    { id: "c1", tenantId: "t1", orgId: "orgA", supervisorUserId: "sup", status: "ACTIVE" },
    { id: "c2", tenantId: "t1", orgId: "orgA", supervisorUserId: "sup2", status: "ACTIVE" },
    { id: "cx", tenantId: "t2", orgId: "orgB", supervisorUserId: "supb", status: "ACTIVE" }
  ];
  const crewMembers: Row[] = [
    { crewId: "c1", userId: "ana", status: "ACTIVE" },
    { crewId: "c1", userId: "bob", status: "ACTIVE" },
    { crewId: "c1", userId: "old", status: "REMOVED" },
    { crewId: "c2", userId: "eva", status: "ACTIVE" }
  ];
  const tasks: Row[] = [
    { id: "task1", tenantId: "t1", orgId: "orgA", status: "pending", assignedTo: null },
    { id: "done1", tenantId: "t1", orgId: "orgA", status: "done" },
    { id: "ajena", tenantId: "t2", orgId: "orgB", status: "pending" }
  ];
  const memberships: Row[] = [
    { userId: "sup", orgId: "orgA", status: "ACTIVE", role: { key: "WORKER" }, org: { tenantId: "t1" } },
    { userId: "sup2", orgId: "orgA", status: "ACTIVE", role: { key: "WORKER" }, org: { tenantId: "t1" } },
    { userId: "boss", orgId: "orgA", status: "ACTIVE", role: { key: "CLIENT" }, org: { tenantId: "t1" } },
    { userId: "ana", orgId: "orgA", status: "ACTIVE", role: { key: "WORKER" }, org: { tenantId: "t1" } },
    { userId: "ghost", orgId: "orgA", status: "SUSPENDED", role: { key: "WORKER" }, org: { tenantId: "t1" } }
  ];
  let seq = 0;
  const match = (row: Row, where: Row): boolean =>
    Object.entries(where).every(([k, v]) => (v && typeof v === "object" && "in" in (v as Row) ? (v as Row).in.includes(row[k]) : row[k] === v));
  const table = (rows: Row[], defaults: () => Row) => ({
    async findFirst({ where }: any) { return rows.find((r) => match(r, where)) ?? null; },
    async findMany({ where }: any) { return rows.filter((r) => match(r, where)); },
    async create({ data }: any) {
      const row = { id: `a${++seq}`, ...defaults(), ...data };
      if (rows === allocations && rows.some((r) => r.taskId === row.taskId && r.userId === row.userId)) {
        throw Object.assign(new Error("unique"), { code: "P2002" });
      }
      rows.push(row);
      return row;
    },
    async updateMany({ where, data }: any) {
      const hit = rows.filter((r) => match(r, where));
      hit.forEach((r) => Object.assign(r, data));
      return { count: hit.length };
    }
  });
  const prisma: any = {
    crew: table(crews, () => ({})),
    crewMember: table(crewMembers, () => ({})),
    jobTask: table(tasks, () => ({})),
    membership: {
      async findMany({ where }: any) {
        return memberships.filter((m) => m.userId === where.userId && m.orgId === where.orgId &&
          (where.status ? m.status === where.status : true) &&
          (where.org ? m.org.tenantId === where.org.tenantId : true));
      }
    },
    taskAllocation: table(allocations, () => ({ status: "ASSIGNED", assignedAt: new Date(), acknowledgedAt: null, releasedAt: null, releaseReason: null, statusNote: null, assignReason: null }))
  };
  const audit: any = { async append(entry: Row) { audits.push(entry); } };
  return { service: new TaskAllocationsService(prisma, audit), allocations, audits, tasks };
}

const sup = { tenantId: "t1", userId: "sup", roles: ["WORKER"] };
const boss = { tenantId: "t1", userId: "boss", roles: ["CLIENT"] };
const ana = { tenantId: "t1", userId: "ana" };

test.beforeEach(() => { process.env.SEMSE_TASK_ALLOCATION_ENABLED = "true"; });
test.after(() => { delete process.env.SEMSE_TASK_ALLOCATION_ENABLED; });

test("AC-01 flag apagado -> 404 sin efectos", async () => {
  process.env.SEMSE_TASK_ALLOCATION_ENABLED = "false";
  const w = makeWorld();
  await assert.rejects(w.service.assign(sup, "c1", "task1", "r", ["ana"]), { status: 404 });
  await assert.rejects(w.service.listMine(ana), { status: 404 });
  assert.equal(w.allocations.length, 0);
});

test("AC-02 el supervisor solo asigna en SU cuadrilla; otra cuadrilla 403; otro tenant 404", async () => {
  const w = makeWorld();
  await assert.rejects(w.service.assign(sup, "c2", "task1", "r", ["eva"]), { status: 403 });
  await assert.rejects(w.service.assign(sup, "cx", "task1", "r", ["ana"]), { status: 404 });
  assert.equal(w.allocations.length, 0);
});

test("AC-02 un gestor de cuadrillas de la Org sí puede; un supervisor suspendido no", async () => {
  const w = makeWorld();
  await w.service.assign(boss, "c1", "task1", "r", ["ana"]);
  assert.equal(w.allocations.length, 1);
  const ghost = { tenantId: "t1", userId: "ghost", roles: ["WORKER"] };
  await assert.rejects(w.service.assign(ghost, "c1", "task1", "r", ["ana"]), { status: 404 });
});

test("AC-03 solo miembros ACTIVOS de la cuadrilla; la tarea debe ser de la Org y no estar cerrada", async () => {
  const w = makeWorld();
  await assert.rejects(w.service.assign(sup, "c1", "task1", "r", ["eva"]), { status: 422 });
  await assert.rejects(w.service.assign(sup, "c1", "task1", "r", ["old"]), { status: 422 });
  await assert.rejects(w.service.assign(sup, "c1", "ajena", "r", ["ana"]), { status: 422 });
  await assert.rejects(w.service.assign(sup, "c1", "done1", "r", ["ana"]), { status: 422 });
  assert.equal(w.allocations.length, 0);
});

test("AC-04 una tarea compartida = una tarea con varias asignaciones; repetir no duplica", async () => {
  const w = makeWorld();
  const first = await w.service.assign(sup, "c1", "task1", "r1", ["ana", "bob"], "instalar lámparas");
  assert.equal(first.length, 2);
  await w.service.assign(sup, "c1", "task1", "r2", ["ana", "bob", "ana"]);
  assert.equal(w.allocations.length, 2);
  assert.equal(w.tasks.length, 3);
  assert.deepEqual(w.audits.map((a) => a.action), ["task_allocation.assigned", "task_allocation.assigned"]);
});

test("AC-05 no se modifica la tarea canónica (no toca assignedTo)", async () => {
  const w = makeWorld();
  await w.service.assign(sup, "c1", "task1", "r", ["ana"]);
  assert.equal(w.tasks[0].assignedTo, null);
});

test("AC-06 liberar exige motivo, audita y permite reasignar a la misma persona", async () => {
  const w = makeWorld();
  await w.service.assign(sup, "c1", "task1", "r", ["ana"]);
  await w.service.release(sup, "c1", "task1", "ana", "r2", "pasa a otra obra");
  assert.equal(w.allocations[0].status, "RELEASED");
  assert.equal(w.allocations[0].releaseReason, "pasa a otra obra");
  await assert.rejects(w.service.release(sup, "c1", "task1", "ana", "r3", "otra vez"), { status: 409 });
  await w.service.assign(sup, "c1", "task1", "r4", ["ana"]);
  assert.equal(w.allocations.length, 1);
  assert.equal(w.allocations[0].status, "ASSIGNED");
  assert.equal(w.allocations[0].releaseReason, null);
  assert.deepEqual(w.audits.map((a) => a.action), ["task_allocation.assigned", "task_allocation.released", "task_allocation.assigned"]);
});

test("AC-07 la vista incluye el título de la tarea canónica", async () => {
  const w = makeWorld();
  w.tasks[0].title = "Instalar lámparas";
  await w.service.assign(sup, "c1", "task1", "r", ["ana"]);
  const mine: any[] = await w.service.listMine(ana);
  assert.equal(mine[0].taskTitle, "Instalar lámparas");
  const forTask: any[] = await w.service.listForTask(sup, "c1", "task1");
  assert.equal(forTask[0].taskTitle, "Instalar lámparas");
});

test("AC-07 la persona ve solo lo suyo y no ve las liberadas", async () => {
  const w = makeWorld();
  await w.service.assign(sup, "c1", "task1", "r", ["ana", "bob"]);
  assert.equal((await w.service.listMine(ana)).length, 1);
  assert.equal((await w.service.listMine({ tenantId: "t1", userId: "bob" })).length, 1);
  await w.service.release(sup, "c1", "task1", "ana", "r2", "cambio de obra");
  assert.equal((await w.service.listMine(ana)).length, 0);
});

test("AC-08 transiciones: ASSIGNED->ACK->IN_PROGRESS->SUBMITTED; salto o terminal -> 422", async () => {
  const w = makeWorld();
  const [a] = await w.service.assign(sup, "c1", "task1", "r", ["ana"]);
  await assert.rejects(w.service.updateStatus(ana, a.allocationId, "SUBMITTED", undefined, "r"), { status: 422 });
  await w.service.updateStatus(ana, a.allocationId, "ACKNOWLEDGED", undefined, "r");
  assert.notEqual(w.allocations[0].acknowledgedAt, null);
  await w.service.updateStatus(ana, a.allocationId, "IN_PROGRESS", undefined, "r");
  await w.service.updateStatus(ana, a.allocationId, "SUBMITTED", "listo", "r");
  assert.equal(w.allocations[0].status, "SUBMITTED");
  await assert.rejects(w.service.updateStatus(ana, a.allocationId, "IN_PROGRESS", undefined, "r"), { status: 422 });
});

test("AC-08 bloquear exige motivo; solo se avanza lo propio", async () => {
  const w = makeWorld();
  const [a] = await w.service.assign(sup, "c1", "task1", "r", ["ana"]);
  await assert.rejects(w.service.updateStatus(ana, a.allocationId, "BLOCKED", undefined, "r"), { status: 422 });
  await w.service.updateStatus(ana, a.allocationId, "BLOCKED", "falta material", "r");
  assert.equal(w.allocations[0].statusNote, "falta material");
  await assert.rejects(w.service.updateStatus({ tenantId: "t1", userId: "bob" }, a.allocationId, "IN_PROGRESS", undefined, "r"), { status: 404 });
});

test("AC-08 una asignación liberada no se puede avanzar", async () => {
  const w = makeWorld();
  const [a] = await w.service.assign(sup, "c1", "task1", "r", ["ana"]);
  await w.service.release(sup, "c1", "task1", "ana", "r2", "ya no aplica");
  await assert.rejects(w.service.updateStatus(ana, a.allocationId, "IN_PROGRESS", undefined, "r"), { status: 422 });
});

test("AC-09 una tarea interna se crea en la Org de la cuadrilla y luego se puede asignar", async () => {
  const w = makeWorld();
  const created: any = await w.service.createCrewTask(sup, "c1", "r1", { title: "Pintar pasillo", priority: "high" });
  const row = w.tasks.find((t: any) => t.id === created.taskId) as any;
  assert.equal(row.orgId, "orgA");
  assert.equal(row.entityType, "Crew");
  assert.equal(row.entityId, "c1");
  assert.equal(row.createdBy, "sup");
  assert.equal(created.priority, "high");
  const [a]: any[] = await w.service.assign(sup, "c1", created.taskId, "r2", ["ana"]);
  assert.equal(a.status, "ASSIGNED");
  const mine: any[] = await w.service.listMine(ana);
  assert.equal(mine[0].taskTitle, "Pintar pasillo");
  assert.deepEqual(w.audits.map((x) => x.action), ["crew_task.created", "task_allocation.assigned"]);
});

test("FIELD-R01 habitación 205: supervisor crea, asigna y solo el trabajador designado la ve", async () => {
  const w = makeWorld();
  const title = "Hab. 205 — Reparar pared";
  const created: any = await w.service.createCrewTask(sup, "c1", "r1", { title, priority: "high" });
  assert.equal(created.title, title);

  const [allocation]: any[] = await w.service.assign(sup, "c1", created.taskId, "r2", ["ana"]);
  assert.equal(allocation.status, "ASSIGNED");
  assert.equal(allocation.taskTitle, null);

  const mineAna: any[] = await w.service.listMine(ana);
  const mineBob: any[] = await w.service.listMine({ tenantId: "t1", userId: "bob" });
  assert.equal(mineAna.length, 1);
  assert.equal(mineAna[0].taskTitle, title);
  assert.deepEqual(mineBob, []);

  await w.service.updateStatus(ana, allocation.allocationId, "ACKNOWLEDGED", undefined, "r3");
  await w.service.updateStatus(ana, allocation.allocationId, "IN_PROGRESS", undefined, "r4");
  const mineInProgress: any[] = await w.service.listMine(ana);
  assert.equal(mineInProgress[0].taskTitle, title);
  assert.equal(mineInProgress[0].status, "IN_PROGRESS");
  assert.deepEqual(w.audits.map((a) => a.action), [
    "crew_task.created",
    "task_allocation.assigned",
    "task_allocation.status_changed",
    "task_allocation.status_changed"
  ]);
});

test("AC-09 crear o listar tareas respeta el alcance y el flag", async () => {
  const w = makeWorld();
  await assert.rejects(w.service.createCrewTask(sup, "c2", "r", { title: "Ajena ajena" }), { status: 403 });
  await assert.rejects(w.service.createCrewTask(sup, "cx", "r", { title: "Otro tenant" }), { status: 404 });
  await w.service.createCrewTask(sup, "c1", "r", { title: "Mía" });
  const list: any[] = await w.service.listCrewTasks(sup, "c1");
  assert.deepEqual(list.map((t) => t.title), ["Mía"]);
  await assert.rejects(w.service.listCrewTasks(sup, "c2"), { status: 403 });
  process.env.SEMSE_TASK_ALLOCATION_ENABLED = "false";
  await assert.rejects(w.service.createCrewTask(sup, "c1", "r", { title: "Apagado" }), { status: 404 });
});
