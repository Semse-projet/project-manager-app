import test from "node:test";
import assert from "node:assert/strict";
import { createWorkspaceStore, type WorkspaceApi } from "../../apps/web/lib/stores/workspace-state.ts";
import type { WorkspaceContextResponse } from "@semse/schemas";

const context = (): WorkspaceContextResponse => ({
  userId: "test-user", tenantId: "test-tenant", organizationId: "test-org", currentScreen: "home",
  permissions: ["CLIENT"], activeMission: null,
  leftPanelState: { activeSection: "home", navigationHistory: ["home"] },
  rightPanelState: { mode: "operational", content: null },
});
function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
}
function makeApi(overrides: Partial<WorkspaceApi> = {}): WorkspaceApi {
  return {
    getContext: async () => context(),
    navigate: async (input) => ({ leftPanelState: { activeSection: input.leftPanelAction, navigationHistory: ["home", input.leftPanelAction] }, centralPanelContent: null, rightPanelContent: null, breadcrumb: [] }),
    loadMission: async (input) => ({ missionId: input.missionId, missionType: input.missionType, title: input.title ?? "Referencia", content: null, context: null, rightPanelMode: "operational" }),
    unloadMission: async (id) => ({ missionId: id, unloadedAt: "2026-11-14T00:00:00Z" }),
    ...overrides,
  };
}

test("refresh hydrates confirmed context; navigation updates context and derived state together", async () => {
  const store = createWorkspaceStore(makeApi());
  assert.equal(await store.refresh(), true);
  assert.equal(await store.navigate("settings", "configuration"), true);
  const state = store.getSnapshot();
  assert.equal(state.activeSection, "settings");
  assert.equal(state.context?.leftPanelState.activeSection, state.activeSection);
  assert.equal(state.context?.rightPanelState.mode, state.rightPanelMode);
  assert.equal(state.context?.currentScreen, "settings");
  assert.equal(state.pending, null);
});

test("pending mutations cannot be duplicated and failed operations preserve confirmed state", async () => {
  const pending = deferred<Awaited<ReturnType<WorkspaceApi["navigate"]>>>();
  let calls = 0;
  const store = createWorkspaceStore(makeApi({ navigate: () => { calls++; return pending.promise; } }));
  await store.refresh();
  const first = store.navigate("projects");
  assert.equal(store.getSnapshot().pending, "navigate");
  assert.equal(await store.navigate("evidence"), false);
  assert.equal(calls, 1);
  pending.reject(new Error("No autorizado (403)"));
  assert.equal(await first, false);
  assert.equal(store.getSnapshot().activeSection, "home");
  assert.match(store.getSnapshot().error ?? "", /403/);
  assert.equal(store.getSnapshot().context?.leftPanelState.activeSection, "home");
});

test("reset invalidates in-flight responses and does not contaminate a new session", async () => {
  const old = deferred<WorkspaceContextResponse>();
  const store = createWorkspaceStore(makeApi({ getContext: () => old.promise }));
  const request = store.refresh();
  store.reset();
  old.resolve({ ...context(), userId: "old-user", activeMission: { missionId: "11111111-1111-4111-8111-111111111111", missionType: "project", title: "Old" } });
  assert.equal(await request, false);
  assert.equal(store.getSnapshot().context, null);
  assert.equal(store.getSnapshot().activeMission, null);
  assert.equal(store.getSnapshot().pending, null);
});

test("opening and closing a reference preserves the context contract", async () => {
  const store = createWorkspaceStore(makeApi());
  await store.refresh();
  const id = "11111111-1111-4111-8111-111111111111";
  assert.equal(await store.loadMission(id, "project", "Revisión"), true);
  assert.deepEqual(store.getSnapshot().activeMission, store.getSnapshot().context?.activeMission);
  assert.equal(await store.unloadMission(id), true);
  assert.equal(store.getSnapshot().context?.activeMission, null);
});

test("refresh requests coalesce while refresh is in progress", async () => {
  const pending = deferred<WorkspaceContextResponse>();
  let calls = 0;
  const store = createWorkspaceStore(makeApi({ getContext: () => { calls++; return pending.promise; } }));
  const a = store.refresh();
  const b = store.refresh();
  pending.resolve(context());
  assert.equal(await a, true);
  assert.equal(await b, true);
  assert.equal(calls, 1);
});

test("a confirmed 401 removes private context while retaining the last section label", async () => {
  let authorized = true;
  const store = createWorkspaceStore(makeApi({ getContext: async () => { if (!authorized) throw new Error("Sesión no disponible (401)"); return context(); } }));
  await store.refresh();
  await store.navigate("projects");
  authorized = false;
  assert.equal(await store.refresh(), false);
  assert.equal(store.getSnapshot().context, null);
  assert.equal(store.getSnapshot().activeMission, null);
  assert.equal(store.getSnapshot().activeSection, "projects");
});
