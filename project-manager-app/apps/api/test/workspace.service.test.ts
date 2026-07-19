import test from "node:test";
import assert from "node:assert/strict";
import { WorkspaceService } from "../dist/modules/workspace/workspace.service.js";
import { InMemoryWorkspaceStateRepository } from "../dist/modules/workspace/workspace.repository.js";

const actor = { userId: "u1", tenantId: "t1", orgId: "o1", roles: ["jobs:read"] };

function makeSvc() {
  return new WorkspaceService(new InMemoryWorkspaceStateRepository());
}

test("getContext returns default state for a new user", async () => {
  const svc = makeSvc();
  const ctx = await svc.getContext(actor);
  assert.equal(ctx.userId, "u1");
  assert.equal(ctx.tenantId, "t1");
  assert.equal(ctx.organizationId, "o1");
  assert.equal(ctx.activeMission, null);
  assert.equal(ctx.leftPanelState.activeSection, "home");
  assert.deepEqual(ctx.permissions, ["jobs:read"]);
  assert.equal(ctx.rightPanelState.mode, "operational");
});

test("updateNavigation pushes history and updates section", async () => {
  const svc = makeSvc();
  const res = await svc.updateNavigation(actor, { leftPanelAction: "projects" });
  assert.equal(res.leftPanelState.activeSection, "projects");
  assert.deepEqual(res.leftPanelState.navigationHistory, ["home", "projects"]);
  assert.equal(res.breadcrumb[res.breadcrumb.length - 1].path, "/workspace/projects");
});

test("updateNavigation does not duplicate consecutive sections", async () => {
  const svc = makeSvc();
  await svc.updateNavigation(actor, { leftPanelAction: "projects" });
  const res = await svc.updateNavigation(actor, { leftPanelAction: "projects" });
  assert.deepEqual(res.leftPanelState.navigationHistory, ["home", "projects"]);
});

test("updateNavigation honors rightPanelMode and centralPanelTarget", async () => {
  const svc = makeSvc();
  const res = await svc.updateNavigation(actor, {
    leftPanelAction: "settings",
    rightPanelMode: "configuration",
    centralPanelTarget: { projectId: "p1" },
  });
  assert.deepEqual(res.centralPanelContent, { projectId: "p1", sessionId: null });
  const ctx = await svc.getContext(actor);
  assert.equal(ctx.rightPanelState.mode, "configuration");
});

test("updateNavigation rejects blank action", async () => {
  const svc = makeSvc();
  await assert.rejects(() => svc.updateNavigation(actor, { leftPanelAction: "   " }));
});

test("updateNavigation caps history length", async () => {
  const svc = makeSvc();
  for (let i = 0; i < 30; i++) {
    await svc.updateNavigation(actor, { leftPanelAction: `s${i}` });
  }
  const ctx = await svc.getContext(actor);
  assert.ok(ctx.leftPanelState.navigationHistory.length <= 20);
});

test("loadMission sets active mission and operational panel", async () => {
  const svc = makeSvc();
  const res = await svc.loadMission(actor, { missionId: "m1", missionType: "budget" });
  assert.equal(res.missionId, "m1");
  assert.equal(res.missionType, "budget");
  assert.equal(res.title, "Presupuesto");
  assert.equal(res.rightPanelMode, "operational");
  const ctx = await svc.getContext(actor);
  assert.equal(ctx.activeMission?.missionId, "m1");
  assert.equal(ctx.currentScreen, "mission:budget");
});

test("loadMission uses provided title", async () => {
  const svc = makeSvc();
  const res = await svc.loadMission(actor, {
    missionId: "m1",
    missionType: "project",
    title: "Casa Rivera",
  });
  assert.equal(res.title, "Casa Rivera");
});

test("loadMission replaces an active mission", async () => {
  const svc = makeSvc();
  await svc.loadMission(actor, { missionId: "m1", missionType: "project" });
  const res = await svc.loadMission(actor, { missionId: "m2", missionType: "evidence" });
  assert.equal(res.missionId, "m2");
  assert.equal((await svc.getContext(actor)).activeMission?.missionId, "m2");
});

test("unloadMission clears the active mission", async () => {
  const svc = makeSvc();
  await svc.loadMission(actor, { missionId: "m1", missionType: "project" });
  const res = await svc.unloadMission(actor, "m1");
  assert.equal(res.missionId, "m1");
  assert.ok(typeof res.unloadedAt === "string");
  assert.equal((await svc.getContext(actor)).activeMission, null);
});

test("unloadMission throws when no mission active", async () => {
  const svc = makeSvc();
  await assert.rejects(() => svc.unloadMission(actor, "m1"), /No active mission/);
});

test("unloadMission throws on mismatched id", async () => {
  const svc = makeSvc();
  await svc.loadMission(actor, { missionId: "m1", missionType: "project" });
  await assert.rejects(() => svc.unloadMission(actor, "other"), /does not match/);
});

test("state is isolated per tenant/user", async () => {
  const svc = makeSvc();
  await svc.loadMission(actor, { missionId: "m1", missionType: "project" });
  const other = { userId: "u2", tenantId: "t1", orgId: "o1", roles: [] };
  assert.equal((await svc.getContext(other)).activeMission, null);
});

test("state persists across service instances sharing a repository", async () => {
  const repo = new InMemoryWorkspaceStateRepository();
  const first = new WorkspaceService(repo);
  await first.loadMission(actor, { missionId: "m1", missionType: "project" });
  const second = new WorkspaceService(repo);
  assert.equal((await second.getContext(actor)).activeMission?.missionId, "m1");
});

test("newMissionId returns a uuid-like string", () => {
  assert.match(WorkspaceService.newMissionId(), /[0-9a-f-]{36}/);
});
