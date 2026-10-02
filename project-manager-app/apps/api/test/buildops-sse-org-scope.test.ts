import "reflect-metadata";
import test from "node:test";
import assert from "node:assert/strict";
import { setImmediate as tick } from "node:timers/promises";
import { Reflector } from "@nestjs/core";
import { ForbiddenException } from "@nestjs/common";
import { SseController } from "../dist/infrastructure/sse/sse.controller.js";
import { SseEventBusService } from "../dist/infrastructure/sse/sse-event-bus.service.js";
import { RbacGuard } from "../dist/common/rbac.guard.js";

function matches(row: any, where: any): boolean {
  if (!row) return false;
  return Object.entries(where ?? {}).every(([key, value]: [string, any]) => {
    if (key === "OR") return value.some((c: any) => matches(row, c));
    if (key === "AND") return [value].flat().every((c: any) => matches(row, c));
    if (value && typeof value === "object") {
      if ("in" in value) return value.in.includes(row[key]);
      return matches(row[key], value);
    }
    return row[key] === value;
  });
}
function actor(orgId = "client", roles = ["CLIENT"], tenantId = "tenant") {
  return { tenantId, orgId, roles, userId: "user" };
}
function fixture() {
  const project = { id: "project", tenantId: "tenant", assignedProOrgId: "pro",
    job: { clientOrgId: "client", tenantId: "tenant", deletedAt: null } };
  const otherProject = { ...project, id: "other-project", assignedProOrgId: "other-pro",
    job: { ...project.job, clientOrgId: "other-client" } };
  const foreignProject = { ...project, id: "foreign-project", tenantId: "foreign" };
  const rows = {
    milestone: [{ id: "milestone", project }, { id: "other-milestone", project: otherProject },
      { id: "foreign-milestone", project: foreignProject }],
    job: [{ id: "job", ...project.job, project }, { id: "other-job", ...otherProject.job, project: otherProject }],
    buildOpsProject: [{ id: "build", tenantId: "tenant", orgId: "client" },
      { id: "other-build", tenantId: "tenant", orgId: "other-client" }],
    changeOrderCandidate: [
      { id: "co", tenantId: "tenant", jobId: "job", milestoneId: null, buildOpsProjectId: null },
      { id: "other-co", tenantId: "tenant", jobId: "other-job", milestoneId: null, buildOpsProjectId: null },
      { id: "mixed-co", tenantId: "tenant", jobId: "job", milestoneId: null, buildOpsProjectId: "other-build" },
      { id: "foreign-co", tenantId: "foreign", jobId: "job", milestoneId: null, buildOpsProjectId: null },
    ],
    operationalSignal: [{ id: "signal", tenantId: "tenant", milestoneId: "milestone", jobId: null, buildOpsProjectId: null }],
  };
  const prisma = Object.fromEntries(Object.entries(rows).map(([name, data]) => [name, {
    async findMany({ where }: any) { return data.filter((row) => matches(row, where)); },
    async findFirst({ where }: any) { return data.find((row) => matches(row, where)) ?? null; },
  }]));
  const bus = new SseEventBusService();
  const controller = new SseController(bus, {} as never, {} as never, {} as never, prisma as never);
  function listen(t: any, context = actor()) {
    const received: any[] = [];
    const sub = controller.buildopsStream({ authContext: context, headers: { "x-tenant-id": "foreign" } })
      .subscribe((message) => received.push({ type: message.type, data: JSON.parse(String(message.data)) }));
    t.after(() => sub.unsubscribe());
    return { received, sub };
  }
  async function emit(event: string, data: unknown, tenantId = "tenant") {
    bus.emit("buildops:" + tenantId, event, data);
    await tick();
  }
  return { controller, bus, prisma, rows, project, listen, emit };
}

for (const roles of [["CLIENT"], ["PRO"], ["OPS_ADMIN"]]) {
  test("RBAC accepts authorized BuildOps SSE roles " + roles.join(), () => {
    const guard = new RbacGuard(new Reflector());
    assert.equal(guard.canActivate({
      getHandler: () => SseController.prototype.buildopsStream,
      getClass: () => SseController,
      switchToHttp: () => ({ getRequest: () => ({ authContext: actor("client", roles) }) }),
    } as never), true);
  });
}
test("RBAC denies a role without projects:read", () => {
  const guard = new RbacGuard(new Reflector());
  assert.throws(() => guard.canActivate({
    getHandler: () => SseController.prototype.buildopsStream,
    getClass: () => SseController,
    switchToHttp: () => ({ getRequest: () => ({ authContext: actor("client", ["WORKER"]) }) }),
  } as never), ForbiddenException);
});
for (const event of ["milestone:updated", "evidence-item:updated", "evidence-item:reviewed", "evidence-item:archived", "evidence-item:replaced"]) {
  test(event + " reaches owner and assigned pro, never the other org", async (t) => {
    const f = fixture();
    const owner = f.listen(t), pro = f.listen(t, actor("pro", ["PRO"])), stranger = f.listen(t, actor("stranger"));
    await f.emit(event, { milestoneId: "milestone", itemId: "item" });
    assert.equal(owner.received.length, 1); assert.equal(pro.received.length, 1);
    assert.equal(stranger.received.length, 0);
  });
}
for (const event of ["buildops-plan-approved", "buildops-plan-changes-requested", "buildops-plan-rejected", "buildops-plan-unapproved", "buildops-plan-rerun-completed"]) {
  test(event + " uses BuildOps ownership, including legacy jobId alias", async (t) => {
    const f = fixture();
    const owner = f.listen(t), stranger = f.listen(t, actor("stranger"));
    await f.emit(event, { buildOpsProjectId: "build", jobId: "build" });
    assert.equal(owner.received.length, 1); assert.equal(stranger.received.length, 0);
  });
}
for (const event of ["change-order:updated", "change-order:applied"]) {
  test(event + " authorizes the persisted candidate, not payload claims", async (t) => {
    const f = fixture(), stream = f.listen(t);
    await f.emit(event, { changeOrderId: "other-co", jobId: "job", orgId: "client" });
    await f.emit(event, { changeOrderId: "mixed-co", jobId: "job" });
    await f.emit(event, { changeOrderId: "co" });
    assert.deepEqual(stream.received.map((e) => e.data.changeOrderId), ["co"]);
  });
}
test("unknown/malformed/unlinked events and missing resources are dropped", async (t) => {
  const f = fixture(), stream = f.listen(t);
  for (const [event, data] of [
    ["unknown", { milestoneId: "milestone" }], ["milestone:updated", {}],
    ["milestone:updated", { milestoneId: 123 }], ["milestone:updated", null],
    ["milestone:updated", { milestoneId: "missing" }], ["change-order:updated", { jobId: "job" }],
  ] as [string, unknown][]) await f.emit(event, data);
  assert.equal(stream.received.length, 0);
});
test("tenant channel and authoritative resource tenant both stay isolated for OPS_ADMIN", async (t) => {
  const f = fixture(), stream = f.listen(t, actor("ops", ["OPS_ADMIN"]));
  await f.emit("milestone:updated", { milestoneId: "milestone" }, "foreign");
  await f.emit("milestone:updated", { milestoneId: "foreign-milestone" });
  await f.emit("change-order:updated", { changeOrderId: "foreign-co" });
  await f.emit("milestone:updated", { milestoneId: "other-milestone" });
  assert.deepEqual(stream.received.map((e) => e.data.milestoneId), ["other-milestone"]);
});
test("domain permissions still apply even for an owning org", async (t) => {
  const f = fixture(), stream = f.listen(t, actor("client", ["WORKER"]));
  await f.emit("milestone:updated", { milestoneId: "milestone" });
  await f.emit("change-order:updated", { changeOrderId: "co" });
  assert.equal(stream.received.length, 0);
});
test("operational signals require the same ops permission as REST", async (t) => {
  const f = fixture(), owner = f.listen(t), admin = f.listen(t, actor("ops", ["OPS_ADMIN"]));
  await f.emit("operational-signal:created", { id: "signal", milestoneId: "milestone" });
  assert.equal(owner.received.length, 0); assert.equal(admin.received.length, 1);
});
test("lookup failure drops one event and later valid events still arrive", async (t) => {
  const f = fixture(), stream = f.listen(t);
  const original = f.prisma.milestone.findMany;
  f.prisma.milestone.findMany = async () => { throw new Error("database unavailable"); };
  await f.emit("milestone:updated", { milestoneId: "milestone" });
  f.prisma.milestone.findMany = original;
  await f.emit("milestone:updated", { milestoneId: "milestone", status: "APPROVED" });
  assert.deepEqual(stream.received.map((e) => e.data.status), ["APPROVED"]);
});
test("ownership is rechecked after an organization loses access", async (t) => {
  const f = fixture(), stream = f.listen(t);
  await f.emit("milestone:updated", { milestoneId: "milestone" });
  f.project.job.clientOrgId = "new-client";
  await f.emit("milestone:updated", { milestoneId: "milestone" });
  assert.equal(stream.received.length, 1);
});
test("async authorization preserves event order and unsubscribe drops in-flight delivery", async (t) => {
  const f = fixture(), stream = f.listen(t);
  const original = f.prisma.milestone.findMany;
  let release!: () => void;
  const gate = new Promise<void>((resolve) => { release = resolve; });
  let calls = 0;
  f.prisma.milestone.findMany = async (query: any) => {
    calls++; if (calls === 1) await gate; return original(query);
  };
  f.bus.emit("buildops:tenant", "milestone:updated", { milestoneId: "milestone", sequence: 1 });
  f.bus.emit("buildops:tenant", "milestone:updated", { milestoneId: "milestone", sequence: 2 });
  await tick();
  assert.equal(stream.received.length, 0);
  release(); await tick();
  assert.deepEqual(stream.received.map((e) => e.data.sequence), [1, 2]);
  stream.sub.unsubscribe();
  await f.emit("milestone:updated", { milestoneId: "milestone", sequence: 3 });
  assert.equal(stream.received.length, 2);
});
test("disconnect while first lookup is pending cancels queued lookups and delivery", async (t) => {
  const f = fixture(), stream = f.listen(t);
  let release!: () => void;
  const gate = new Promise<void>((resolve) => { release = resolve; });
  let calls = 0;
  f.prisma.milestone.findMany = async () => { calls++; await gate; return f.rows.milestone; };
  f.bus.emit("buildops:tenant", "milestone:updated", { milestoneId: "milestone" });
  f.bus.emit("buildops:tenant", "milestone:updated", { milestoneId: "milestone" });
  stream.sub.unsubscribe(); release(); await tick();
  assert.equal(stream.received.length, 0); assert.equal(calls, 1);
});
