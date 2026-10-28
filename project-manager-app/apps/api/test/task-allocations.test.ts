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
    { userId: "bob", orgId: "orgA", status: "ACTIVE", role: { key: "WORKER" }, org: { tenantId: "t1" } },
    { userId: "ghost", orgId: "orgA", status: "SUSPENDED", role: { key: "WORKER" }, org: { tenantId: "t1" } }
  ];
  let seq = 0;
  let beforeAllocationUpdate: (() => void) | null = null;
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
      if (rows === allocations && beforeAllocationUpdate) {
        const callback = beforeAllocationUpdate;
        beforeAllocationUpdate = null;
        callback();
      }
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
  return {
    service: new TaskAllocationsService(prisma, audit), allocations, audits, tasks, crews, crewMembers, memberships,
    beforeNextAllocationUpdate(callback: () => void) { beforeAllocationUpdate = callback; }
  };
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

test("S0B-N10: tarea Crew c1 no se puede asignar desde c2 en la misma org", async () => {
  const w = makeWorld();
  w.memberships.push({ userId: "eva", orgId: "orgA", status: "ACTIVE", role: { key: "WORKER" }, org: { tenantId: "t1" } });
  const created = await w.service.createCrewTask(sup, "c1", "r1", { title: "Hab. 205 — Reparar pared" });
  const initialAuditCount = w.audits.length;
  await assert.rejects(
    w.service.assign({ tenantId: "t1", userId: "sup2", roles: ["WORKER"] }, "c2", created.taskId, "r2", ["eva"]),
    { status: 422 }
  );
  assert.equal(w.allocations.length, 0);
  assert.equal(w.audits.length, initialAuditCount);
});

test("S0B-N11: asignación existente de c1 nunca se devuelve como idempotente en c2", async () => {
  const w = makeWorld();
  w.crewMembers.push({ crewId: "c2", userId: "ana", status: "ACTIVE" });
  const [original] = await w.service.assign(sup, "c1", "task1", "r1", ["ana"]);
  const initialAuditCount = w.audits.length;
  await assert.rejects(
    w.service.assign({ tenantId: "t1", userId: "sup2", roles: ["WORKER"] }, "c2", "task1", "r2", ["ana"]),
    { status: 409 }
  );
  assert.equal(w.allocations.length, 1);
  assert.equal(w.allocations[0].id, original.allocationId);
  assert.equal(w.allocations[0].crewId, "c1");
  assert.equal(w.allocations[0].status, "ASSIGNED");
  assert.equal(w.audits.length, initialAuditCount);
});

test("S0B-N12: asignación RELEASED de otra crew no se transfiere silenciosamente", async () => {
  const w = makeWorld();
  w.crewMembers.push({ crewId: "c2", userId: "ana", status: "ACTIVE" });
  await w.service.assign(sup, "c1", "task1", "r1", ["ana"]);
  await w.service.release(sup, "c1", "task1", "ana", "r2", "terminó asignación");
  const initialAuditCount = w.audits.length;
  await assert.rejects(
    w.service.assign({ tenantId: "t1", userId: "sup2", roles: ["WORKER"] }, "c2", "task1", "r3", ["ana"]),
    { status: 409 }
  );
  assert.equal(w.allocations[0].status, "RELEASED");
  assert.equal(w.allocations[0].crewId, "c1");
  assert.equal(w.audits.length, initialAuditCount);
});

test("S0B-N14: carrera en reactivación RELEASED no reabre asignación movida a otra crew", async () => {
  const w = makeWorld();
  await w.service.assign(sup, "c1", "task1", "r1", ["ana"]);
  await w.service.release(sup, "c1", "task1", "ana", "r2", "fin del turno");
  const auditCount = w.audits.length;

  // Simula una mutación concurrente después de leer y validar la asignación,
  // justo antes del compare-and-swap en la base de datos.
  w.beforeNextAllocationUpdate(() => {
    w.allocations[0].crewId = "c2";
  });

  await assert.rejects(w.service.assign(sup, "c1", "task1", "r3", ["ana"]), { status: 409 });
  assert.equal(w.allocations[0].status, "RELEASED");
  assert.equal(w.allocations[0].crewId, "c2");
  assert.equal(w.audits.length, auditCount);
});

test("S0B-N13: lote mixto con asignación ajena no crea asignaciones parciales", async () => {
  const w = makeWorld();
  w.crewMembers.push({ crewId: "c2", userId: "ana", status: "ACTIVE" });
  w.memberships.push({ userId: "eva", orgId: "orgA", status: "ACTIVE", role: { key: "WORKER" }, org: { tenantId: "t1" } });
  await w.service.assign(sup, "c1", "task1", "r1", ["ana"]);
  const initialAuditCount = w.audits.length;
  await assert.rejects(
    w.service.assign({ tenantId: "t1", userId: "sup2", roles: ["WORKER"] }, "c2", "task1", "r2", ["eva", "ana"]),
    { status: 409 }
  );
  assert.equal(w.allocations.length, 1);
  assert.equal(w.allocations[0].userId, "ana");
  assert.equal(w.allocations[0].crewId, "c1");
  assert.equal(w.audits.length, initialAuditCount);
});

test("AC-03 solo miembros ACTIVOS de la cuadrilla; la tarea debe ser de la Org y no estar cerrada", async () => {
  const w = makeWorld();
  await assert.rejects(w.service.assign(sup, "c1", "task1", "r", ["eva"]), { status: 422 });
  await assert.rejects(w.service.assign(sup, "c1", "task1", "r", ["old"]), { status: 422 });
  await assert.rejects(w.service.assign(sup, "c1", "ajena", "r", ["ana"]), { status: 422 });
  await assert.rejects(w.service.assign(sup, "c1", "done1", "r", ["ana"]), { status: 422 });
  assert.equal(w.allocations.length, 0);
});

test("N02: supervisor sin WORKER ACTIVE ni permiso de gestor no conserva alcance", async () => {
  const w = makeWorld();
  w.memberships.find((m) => m.userId === "sup" && m.role.key === "WORKER")!.status = "SUSPENDED";
  w.memberships.push({ userId: "sup", orgId: "orgA", status: "ACTIVE", role: { key: "VIEWER" }, org: { tenantId: "t1" } });

  await assert.rejects(w.service.assign(sup, "c1", "task1", "r", ["ana"]), { status: 403 });
  assert.equal(w.allocations.length, 0);
  assert.equal(w.audits.length, 0);
});

test("N03: CrewMember ACTIVE sin WORKER ACTIVE no puede recibir asignaciones", async () => {
  const w = makeWorld();
  w.memberships.find((m) => m.userId === "ana" && m.role.key === "WORKER")!.status = "SUSPENDED";

  await assert.rejects(w.service.assign(sup, "c1", "task1", "r", ["ana"]), { status: 422 });
  assert.equal(w.allocations.length, 0);
  assert.equal(w.audits.length, 0);
});

test("N08: PRO ACTIVE conserva gestión legítima de crews aunque WORKER de supervisor esté suspendido", async () => {
  const w = makeWorld();
  // WORKER y PRO son memberships independientes en una misma organización.
  w.memberships.find((m) => m.userId === "sup" && m.role.key === "WORKER")!.status = "SUSPENDED";
  w.memberships.push({ userId: "sup", orgId: "orgA", status: "ACTIVE", role: { key: "PRO" }, org: { tenantId: "t1" } });
  w.memberships.push({ userId: "eva", orgId: "orgA", status: "ACTIVE", role: { key: "WORKER" }, org: { tenantId: "t1" } });

  // No recibe autoridad por el cargo de supervisor suspendido: accede por
  // el permiso organizacional org:crews:manage de su PRO vigente.
  const result = await w.service.assign(sup, "c2", "task1", "r-n08", ["eva"]);
  assert.equal(result.length, 1);
  assert.equal(w.allocations[0].crewId, "c2");
  assert.equal(w.allocations[0].userId, "eva");
  assert.deepEqual(w.audits.map((a) => a.action), ["task_allocation.assigned"]);
});

test("N09: claims PRO/WORKER no sustituyen Membership de la Org ni tenant real", async () => {
  const w = makeWorld();
  w.crews.push({ id: "c3", tenantId: "t1", orgId: "orgC", supervisorUserId: "someoneElse", status: "ACTIVE" });
  w.crewMembers.push({ crewId: "c3", userId: "ana", status: "ACTIVE" });

  // El mismo tenant no basta: sin Membership activa en orgC, 404.
  await assert.rejects(
    w.service.assign({ tenantId: "t1", userId: "sup", roles: ["WORKER", "PRO"] }, "c3", "task1", "r-n09a", ["ana"]),
    { status: 404 }
  );
  // Aunque tenga WORKER en orgC, no es su supervisor ni un gestor.
  w.memberships.push({ userId: "sup", orgId: "orgC", status: "ACTIVE", role: { key: "WORKER" }, org: { tenantId: "t1" } });
  await assert.rejects(
    w.service.assign({ tenantId: "t1", userId: "sup", roles: ["PRO"] }, "c3", "task1", "r-n09b", ["ana"]),
    { status: 403 }
  );
  // Cambiar roles del JWT y tenant del actor no permite acceder a una crew de otro tenant.
  await assert.rejects(
    w.service.assign({ tenantId: "t2", userId: "sup", roles: ["PRO"] }, "c1", "task1", "r-n09c", ["ana"]),
    { status: 404 }
  );
  assert.equal(w.allocations.length, 0);
  assert.equal(w.audits.length, 0);
});

test("S0A-SCOPE-01: listado y liberación ignoran asignaciones con org/tenant inconsistente", async () => {
  const w = makeWorld();
  // Datos sintéticos corruptos: misma crew y task, pero distintas autoridades.
  // Sin FK de TaskAllocation a Crew, el servicio debe rechazar también la lectura.
  const foreign = [
    { id: "foreign-tenant", tenantId: "t2", orgId: "orgB", crewId: "c1", taskId: "task1", userId: "ana", status: "ASSIGNED", assignedAt: new Date() },
    { id: "foreign-org", tenantId: "t1", orgId: "orgC", crewId: "c1", taskId: "task1", userId: "bob", status: "ASSIGNED", assignedAt: new Date() }
  ];
  w.allocations.push(...foreign);

  assert.deepEqual(await w.service.listForTask(sup, "c1", "task1"), []);
  await assert.rejects(w.service.release(sup, "c1", "task1", "ana", "r-foreign-tenant", "sin autoridad"), { status: 404 });
  await assert.rejects(w.service.release(sup, "c1", "task1", "bob", "r-foreign-org", "sin autoridad"), { status: 404 });
  assert.deepEqual(w.allocations.map((row) => row.status), ["ASSIGNED", "ASSIGNED"]);
  assert.equal(w.audits.length, 0);
});

test("S0A-CAS-01: release no modifica allocation si cambia de crew entre lectura y escritura", async () => {
  const w = makeWorld();
  await w.service.assign(sup, "c1", "task1", "r-before", ["ana"]);
  const beforeAuditCount = w.audits.length;
  w.beforeNextAllocationUpdate(() => {
    // Emular otra transacción que reemplaza la fila entre findFirst y updateMany.
    w.allocations[0] = { ...w.allocations[0], crewId: "c2" };
  });
  await assert.rejects(
    w.service.release(sup, "c1", "task1", "ana", "r-race", "se mueve a otro frente"),
    { status: 409 }
  );
  assert.equal(w.allocations[0].crewId, "c2");
  assert.equal(w.allocations[0].status, "ASSIGNED");
  assert.equal(w.audits.length, beforeAuditCount, "no success audit on failed compare-and-swap");
});

test("S0A-CAS-02: worker status no modifica allocation si cambia de Org antes de updateMany", async () => {
  const w = makeWorld();
  const [allocation] = await w.service.assign(sup, "c1", "task1", "r-before", ["ana"]);
  const beforeAuditCount = w.audits.length;
  w.beforeNextAllocationUpdate(() => {
    // El objeto devuelto por findFirst es un snapshot; reemplazar la fila
    // emula una escritura externa sin mutar el snapshot que conserva el servicio.
    w.allocations[0] = { ...w.allocations[0], orgId: "orgC" };
  });
  await assert.rejects(
    w.service.updateStatus(ana, allocation.allocationId, "IN_PROGRESS", undefined, "r-race"),
    { status: 409 }
  );
  assert.equal(w.allocations[0].orgId, "orgC");
  assert.equal(w.allocations[0].status, "ASSIGNED");
  assert.equal(w.audits.length, beforeAuditCount);
});

test("N03b: lote mixto de WORKER ACTIVE y suspendido no deja escrituras parciales", async () => {
  const w = makeWorld();
  w.memberships.find((m) => m.userId === "bob" && m.role.key === "WORKER")!.status = "SUSPENDED";
  w.memberships.push({ userId: "bob", orgId: "orgA", status: "ACTIVE", role: { key: "PRO" }, org: { tenantId: "t1" } });

  // No comenzar a asignar a ana antes de validar también al segundo destinatario.
  await assert.rejects(w.service.assign(sup, "c1", "task1", "r-n03b", ["ana", "bob"]), { status: 422 });
  assert.equal(w.allocations.length, 0);
  assert.equal(w.audits.length, 0);
});

test("N04b: asignación propia denegada tras revocar WORKER aunque PRO siga activo", async () => {
  const w = makeWorld();
  const [allocation] = await w.service.assign(sup, "c1", "task1", "r-start", ["ana"]);
  const auditsBefore = w.audits.length;
  w.memberships.find((m) => m.userId === "ana" && m.role.key === "WORKER")!.status = "REVOKED";
  w.memberships.push({ userId: "ana", orgId: "orgA", status: "ACTIVE", role: { key: "PRO" }, org: { tenantId: "t1" } });

  await assert.rejects(w.service.updateStatus(ana, allocation.allocationId, "IN_PROGRESS", undefined, "r-n04b"), { status: 404 });
  assert.equal((await w.service.listMine(ana)).length, 0);
  assert.equal(w.allocations[0].status, "ASSIGNED");
  assert.equal(w.audits.length, auditsBefore);
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

test("N04/N07: revocar WORKER oculta la asignación e impide mutarla", async () => {
  const w = makeWorld();
  const [allocation] = await w.service.assign(sup, "c1", "task1", "r", ["ana"]);
  const auditCount = w.audits.length;
  w.memberships.find((m) => m.userId === "ana" && m.role.key === "WORKER")!.status = "REVOKED";

  await assert.rejects(w.service.updateStatus(ana, allocation.allocationId, "IN_PROGRESS", undefined, "r2"), { status: 404 });
  assert.equal((await w.service.listMine(ana)).length, 0);
  assert.equal(w.allocations[0].status, "ASSIGNED");
  assert.equal(w.audits.length, auditCount);
});

test("N05/N07: retirar CrewMember oculta la asignación e impide mutarla", async () => {
  const w = makeWorld();
  const [allocation] = await w.service.assign(sup, "c1", "task1", "r", ["ana"]);
  const auditCount = w.audits.length;
  w.crewMembers.find((member) => member.crewId === "c1" && member.userId === "ana")!.status = "REMOVED";

  await assert.rejects(w.service.updateStatus(ana, allocation.allocationId, "IN_PROGRESS", undefined, "r2"), { status: 404 });
  assert.equal((await w.service.listMine(ana)).length, 0);
  assert.equal(w.allocations[0].status, "ASSIGNED");
  assert.equal(w.audits.length, auditCount);
});

test("N06/N07: archivar Crew oculta la asignación e impide mutarla", async () => {
  const w = makeWorld();
  const [allocation] = await w.service.assign(sup, "c1", "task1", "r", ["ana"]);
  const auditCount = w.audits.length;
  w.crews.find((crew) => crew.id === "c1")!.status = "ARCHIVED";

  await assert.rejects(w.service.updateStatus(ana, allocation.allocationId, "IN_PROGRESS", undefined, "r2"), { status: 404 });
  assert.equal((await w.service.listMine(ana)).length, 0);
  assert.equal(w.allocations[0].status, "ASSIGNED");
  assert.equal(w.audits.length, auditCount);
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
