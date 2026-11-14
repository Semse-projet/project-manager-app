import test, { afterEach } from "node:test";
import assert from "node:assert/strict";
import { getWorkspaceContext, updateWorkspaceNavigation, loadWorkspaceMission, unloadWorkspaceMission } from "../../apps/web/lib/bff/workspace.ts";
const originalFetch = globalThis.fetch;
afterEach(() => { globalThis.fetch = originalFetch; });
const context = { userId: "fixture-user", tenantId: "fixture-tenant", organizationId: "fixture-org", currentScreen: "home", permissions: ["CLIENT"], activeMission: null, leftPanelState: { activeSection: "home", navigationHistory: ["home"] }, rightPanelState: { mode: "operational", content: null } };
const respond = (data: unknown) => { globalThis.fetch = async () => new Response(JSON.stringify({ data }), { status: 200 }); };

test("workspace context is validated with its canonical contract", async () => {
  respond(context);
  assert.deepEqual(await getWorkspaceContext(), context);
  respond({ ...context, activeMission: { missionType: "unknown", title: "Invalid", missionId: "not-a-uuid" } });
  await assert.rejects(getWorkspaceContext(), /contrato del workspace/);
});

test("malformed navigation response is not accepted as confirmed state", async () => {
  respond({ leftPanelState: { activeSection: "projects", navigationHistory: ["home", "projects"] }, centralPanelContent: null, rightPanelContent: null, breadcrumb: [] });
  assert.equal((await updateWorkspaceNavigation({ leftPanelAction: "projects" })).leftPanelState.activeSection, "projects");
  respond({ leftPanelState: { activeSection: 7, navigationHistory: [] } });
  await assert.rejects(updateWorkspaceNavigation({ leftPanelAction: "projects" }), /contrato del workspace/);
});

test("load and unload use canonical UUID responses and existing endpoints", async () => {
  const id = "11111111-1111-4111-8111-111111111111";
  const paths: string[] = [];
  globalThis.fetch = async (input) => {
    paths.push(String(input));
    return new Response(JSON.stringify({ data: paths.length === 1 ? { missionId: id, missionType: "project", title: "Fixture", content: null, context: null, rightPanelMode: "operational" } : { missionId: id, unloadedAt: "2026-11-14T00:00:00Z" } }), { status: 200 });
  };
  assert.equal((await loadWorkspaceMission({ missionId: id, missionType: "project", title: "Fixture" })).missionId, id);
  assert.equal((await unloadWorkspaceMission(id)).missionId, id);
  assert.deepEqual(paths, ["/api/semse/workspace/mission/load", "/api/semse/workspace/mission/unload"]);
});

test("401 and 403 keep their status visible and do not become empty successful data", async () => {
  for (const status of [401, 403]) {
    globalThis.fetch = async () => new Response(JSON.stringify({ error: { message: "Not permitted" } }), { status });
    await assert.rejects(getWorkspaceContext(), new RegExp(String(status)));
  }
});
