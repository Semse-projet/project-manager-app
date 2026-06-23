import "reflect-metadata";

import test from "node:test";
import assert from "node:assert/strict";
import { BadRequestException, NotFoundException } from "@nestjs/common";
import { AgroTaskService } from "../dist/modules/agro/agro-task.service.js";

// ── Stubs ─────────────────────────────────────────────────────────────────────

const STUB_FARM = { id: "farm_1", ownerId: "usr_1", name: "La Esperanza", operationType: "LIVESTOCK", locationLabel: null, notes: null, createdAt: new Date(), updatedAt: new Date() };

const STUB_TASK = {
  id: "task_1", farmId: "farm_1",
  title: "Feed cattle", type: "FEEDING",
  targetType: "ANIMAL_GROUP", targetId: "grp_1",
  assignedToId: null, status: "PENDING", priority: "MEDIUM",
  dueAt: null, startedAt: null, completedAt: null,
  blockedAt: null, cancelledAt: null,
  blockReason: null, cancelReason: null, notes: null,
  createdAt: new Date(), updatedAt: new Date(),
};

function makeFarmRepo(farm = STUB_FARM) {
  return { findFarm: async (id: string) => id === farm.id ? farm : null } as never;
}

function makeTaskRepo(tasks = [STUB_TASK]) {
  const list = tasks.map(t => ({ ...t }));
  return {
    listTasks:  async (farmId: string, filters?: any) =>
      list.filter(t => t.farmId === farmId && (!filters?.status || t.status === filters.status)),
    findTask:   async (id: string) => list.find(t => t.id === id) ?? null,
    createTask: async (input: any) => ({ ...STUB_TASK, id: "task_new", ...input }),
    updateTask: async (id: string, patch: any) => {
      const t = list.find(t => t.id === id) ?? STUB_TASK;
      Object.assign(t, patch);
      return { ...t };
    },
    getEntityTimeline: async () => [],
  } as never;
}

function makeAuditRepo() {
  const events: any[] = [];
  return { record: async (e: any) => { events.push(e); }, _events: events } as any;
}

// ── listTasks / getTask ───────────────────────────────────────────────────────

test("agro-task: listTasks returns tasks for farm", async () => {
  const svc = new AgroTaskService(makeTaskRepo(), makeFarmRepo(), makeAuditRepo());
  const tasks = await svc.listTasks("farm_1", "usr_1");
  assert.equal(tasks.length, 1);
  assert.equal(tasks[0]!.title, "Feed cattle");
});

test("agro-task: listTasks throws for wrong owner", async () => {
  const svc = new AgroTaskService(makeTaskRepo(), makeFarmRepo(), makeAuditRepo());
  await assert.rejects(() => svc.listTasks("farm_1", "usr_X"), NotFoundException);
});

test("agro-task: getTask throws for unknown id", async () => {
  const svc = new AgroTaskService(makeTaskRepo([]), makeFarmRepo(), makeAuditRepo());
  await assert.rejects(() => svc.getTask("task_unknown"), NotFoundException);
});

// ── createTask ────────────────────────────────────────────────────────────────

test("agro-task: createTask creates task and records audit", async () => {
  const audit = makeAuditRepo();
  const svc = new AgroTaskService(makeTaskRepo(), makeFarmRepo(), audit);
  const task = await svc.createTask("farm_1", "usr_1", {
    title: "Vaccinate herd", type: "VACCINATION", priority: "HIGH",
  });
  assert.ok(task.id);
  assert.equal(audit._events[0].action, "task.created");
});

test("agro-task: createTask throws for empty title", async () => {
  const svc = new AgroTaskService(makeTaskRepo(), makeFarmRepo(), makeAuditRepo());
  await assert.rejects(
    () => svc.createTask("farm_1", "usr_1", { title: "", type: "FEEDING" }),
    BadRequestException,
  );
});

test("agro-task: createTask throws for invalid type", async () => {
  const svc = new AgroTaskService(makeTaskRepo(), makeFarmRepo(), makeAuditRepo());
  await assert.rejects(
    () => svc.createTask("farm_1", "usr_1", { title: "T", type: "DANCING" }),
    BadRequestException,
  );
});

test("agro-task: createTask throws for invalid priority", async () => {
  const svc = new AgroTaskService(makeTaskRepo(), makeFarmRepo(), makeAuditRepo());
  await assert.rejects(
    () => svc.createTask("farm_1", "usr_1", { title: "T", type: "FEEDING", priority: "EXTREME" }),
    BadRequestException,
  );
});

// ── FSM transitions ───────────────────────────────────────────────────────────

test("agro-task: startTask moves PENDING → IN_PROGRESS", async () => {
  const audit = makeAuditRepo();
  const svc = new AgroTaskService(makeTaskRepo(), makeFarmRepo(), audit);
  const task = await svc.startTask("task_1", "usr_1");
  assert.equal(task.status, "IN_PROGRESS");
  assert.ok(task.startedAt);
  assert.equal(audit._events[0].action, "task.in_progress");
});

test("agro-task: completeTask moves IN_PROGRESS → COMPLETED", async () => {
  const inProgress = { ...STUB_TASK, status: "IN_PROGRESS" };
  const audit = makeAuditRepo();
  const svc = new AgroTaskService(makeTaskRepo([inProgress]), makeFarmRepo(), audit);
  const task = await svc.completeTask("task_1", "usr_1");
  assert.equal(task.status, "COMPLETED");
  assert.ok(task.completedAt);
});

test("agro-task: completeTask throws when task is PENDING (not in progress)", async () => {
  const svc = new AgroTaskService(makeTaskRepo(), makeFarmRepo(), makeAuditRepo());
  await assert.rejects(() => svc.completeTask("task_1", "usr_1"), BadRequestException);
});

test("agro-task: blockTask records blockReason", async () => {
  const audit = makeAuditRepo();
  const svc = new AgroTaskService(makeTaskRepo(), makeFarmRepo(), audit);
  const task = await svc.blockTask("task_1", "usr_1", "Waiting for supplies");
  assert.equal(task.status, "BLOCKED");
  assert.equal(task.blockReason, "Waiting for supplies");
});

test("agro-task: cancelTask from BLOCKED records cancelReason", async () => {
  const blocked = { ...STUB_TASK, status: "BLOCKED" };
  const svc = new AgroTaskService(makeTaskRepo([blocked]), makeFarmRepo(), makeAuditRepo());
  const task = await svc.cancelTask("task_1", "usr_1", "No longer needed");
  assert.equal(task.status, "CANCELLED");
  assert.equal(task.cancelReason, "No longer needed");
});

test("agro-task: cannot start COMPLETED task", async () => {
  const completed = { ...STUB_TASK, status: "COMPLETED" };
  const svc = new AgroTaskService(makeTaskRepo([completed]), makeFarmRepo(), makeAuditRepo());
  await assert.rejects(() => svc.startTask("task_1", "usr_1"), BadRequestException);
});

test("agro-task: cannot update CANCELLED task", async () => {
  const cancelled = { ...STUB_TASK, status: "CANCELLED" };
  const svc = new AgroTaskService(makeTaskRepo([cancelled]), makeFarmRepo(), makeAuditRepo());
  await assert.rejects(() => svc.updateTask("task_1", "usr_1", { title: "New title" }), BadRequestException);
});

// ── listEntityTasks ───────────────────────────────────────────────────────────

test("agro-task: listEntityTasks filters by targetType+targetId", async () => {
  const tasks = [
    { ...STUB_TASK, id: "t1", targetType: "ANIMAL_GROUP", targetId: "grp_1" },
    { ...STUB_TASK, id: "t2", targetType: "FARM_UNIT",    targetId: "unit_1" },
  ];
  const svc = new AgroTaskService(makeTaskRepo(tasks), makeFarmRepo(), makeAuditRepo());
  const result = await svc.listEntityTasks("farm_1", "usr_1", "ANIMAL_GROUP", "grp_1");
  assert.equal(result.length, 1);
  assert.equal(result[0]!.id, "t1");
});
