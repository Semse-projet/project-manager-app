import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { runInNewContext } from "node:vm";
import { createWorkspaceStore } from "../../apps/web/lib/stores/workspace-state.ts";
import { fetchBuildOpsTasks } from "../../apps/web/app/lib/buildops-api.ts";
import { detectCopilotContext } from "../../apps/web/lib/bff/prometeo.ts";

const require = createRequire(new URL("../../package.json", import.meta.url));
const ts = require("typescript");
const React = require("react");
const renderer = require("react-test-renderer");
(globalThis as Record<string, unknown>).IS_REACT_ACT_ENVIRONMENT = true;
const context = () => ({ userId: "fixture-user", tenantId: "fixture-tenant", organizationId: "fixture-org", currentScreen: "home", activeMission: null, permissions: ["CLIENT"], leftPanelState: { activeSection: "home", navigationHistory: ["home"] }, rightPanelState: { mode: "operational" as const, content: null } });
function makeStore() {
  return createWorkspaceStore({
    getContext: async () => context(),
    navigate: async () => ({ leftPanelState: context().leftPanelState, centralPanelContent: null, rightPanelContent: null, breadcrumb: [] }),
    loadMission: async () => { throw new Error("unused fixture"); },
    unloadMission: async () => { throw new Error("unused fixture"); },
  });
}
function loadSource(path: string, aliases: Record<string, unknown> = {}) {
  const source = readFileSync(new URL(`../../${path}`, import.meta.url), "utf8");
  const exports: Record<string, any> = {};
  runInNewContext(ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, target: ts.ScriptTarget.ES2022 } }).outputText, {
    exports, require: (name: string) => aliases[name] ?? require(name), Promise, Error, window: { location: { href: "https://fixture.invalid/workspace" } },
  });
  return exports;
}
function loadQuery(store: ReturnType<typeof makeStore>) {
  return loadSource("apps/web/app/workspace/lib/use-workspace-query.ts", {
    "../../../lib/stores/workspaceStore": { workspaceStore: store, useWorkspaceStore: () => React.useSyncExternalStore(store.subscribe, store.getSnapshot, store.getServerSnapshot) },
  });
}

test("a bids 401 retires the loaded Job, related queries and in-flight results until confirmed refresh", async () => {
  const store = makeStore();
  await store.refresh();
  const query = loadQuery(store);
  let jobs: any;
  let bids: any;
  let stale: any;
  let deny = false;
  let resolveStale!: (value: string[]) => void;
  const loadJobs = async () => ["private Job and budget"];
  const loadBids = async () => { if (deny) throw Object.assign(new Error("Authenticated SEMSE session required"), { status: 401 }); return ["private bid"]; };
  const loadStale = () => new Promise<string[]>((resolve) => { resolveStale = resolve; });
  function Probe() {
    jobs = query.useWorkspaceQuery("jobs", loadJobs);
    bids = query.useWorkspaceQuery("bids", loadBids);
    stale = query.useWorkspaceQuery("pending", loadStale);
    return null;
  }
  let root: any;
  await renderer.act(async () => { root = renderer.create(React.createElement(Probe)); });
  assert.deepEqual(jobs.data, ["private Job and budget"]);
  deny = true;
  await renderer.act(async () => { bids.retry(); });
  assert.equal(store.getSnapshot().context, null);
  assert.equal(jobs.data, null);
  assert.equal(bids.data, null);
  assert.equal(jobs.status, 401);
  assert.match(jobs.error, /sesión/i);
  await renderer.act(async () => { resolveStale(["old session response"]); });
  assert.equal(stale.data, null);
  deny = false;
  await renderer.act(async () => { await store.refresh(); });
  assert.deepEqual(jobs.data, ["private Job and budget"]);
  await renderer.act(async () => { root.unmount(); });
});

test("a resource 403 preserves independent authorized queries and its structured status", async () => {
  const store = makeStore();
  const query = loadQuery(store);
  let jobs: any;
  let bids: any;
  const loadJobs = async () => ["authorized Job"];
  const loadBids = async () => { throw Object.assign(new Error("Insufficient permissions"), { status: 403 }); };
  function Probe() { jobs = query.useWorkspaceQuery("jobs", loadJobs); bids = query.useWorkspaceQuery("bids", loadBids); return null; }
  let root: any;
  await renderer.act(async () => { root = renderer.create(React.createElement(Probe)); });
  assert.deepEqual(jobs.data, ["authorized Job"]);
  assert.equal(bids.status, 403);
  assert.match(bids.error, /acceso/i);
  assert.equal(store.getSnapshot().sessionUnavailable, false);
  assert.equal(query.isWorkspaceAccessError("Insufficient permissions", 403), true);
  await renderer.act(async () => { root.unmount(); });
});

test("readers preserve canonical HTTP status for BuildOps and Prometeo", async () => {
  const original = globalThis.fetch;
  try {
    for (const status of [401, 403]) {
      globalThis.fetch = async () => new Response(JSON.stringify({ error: { message: status === 401 ? "Authenticated SEMSE session required" : "Insufficient permissions" } }), { status });
      await assert.rejects(fetchBuildOpsTasks(), (error: any) => error.status === status);
      await assert.rejects(detectCopilotContext({ currentUrl: "https://fixture.invalid/workspace" }), (error: any) => error.status === status);
    }
  } finally { globalThis.fetch = original; }
});

test("session invalidation preserves only section labels and discards an older shell mutation", async () => {
  let resolveNavigation!: (value: any) => void;
  const store = createWorkspaceStore({ getContext: async () => context(), navigate: () => new Promise((resolve) => { resolveNavigation = resolve; }), loadMission: async () => { throw new Error("unused"); }, unloadMission: async () => { throw new Error("unused"); } });
  await store.refresh();
  const version = store.getSnapshot().scopeVersion;
  const pending = store.navigate("projects");
  await Promise.resolve();
  assert.equal(typeof store.invalidateSession, "function");
  store.invalidateSession();
  resolveNavigation({ leftPanelState: { activeSection: "projects", navigationHistory: ["home", "projects"] }, centralPanelContent: null, rightPanelContent: null, breadcrumb: [] });
  assert.equal(await pending, false);
  assert.equal(store.getSnapshot().context, null);
  assert.equal(store.getSnapshot().activeSection, "home");
  assert.ok(store.getSnapshot().scopeVersion > version);
});

test("desktop and drawer search labels target unique inputs rendered together", () => {
  const icons = Object.fromEntries(["ArrowUpRight", "Boxes", "CalendarDays", "Camera", "FileCheck2", "Home", "Search", "Settings", "Wallet"].map((name) => [name, () => React.createElement("svg")]));
  const left = loadSource("apps/web/app/workspace/components/LeftPanel.tsx", {
    "lucide-react": icons,
    "next/link": { __esModule: true, default: (props: any) => React.createElement("a", props) },
    "../lib/workspace-model": { WORKSPACE_SECTIONS: [{ id: "home", label: "Inicio" }], getWorkspaceSection: () => ({ label: "Inicio" }) },
    "../lib/workspace-navigation": { getWorkspaceDestinations: () => [] },
  });
  const props = { activeSection: "home", onNavigate: () => undefined, role: "client" };
  const html = require("react-dom/server").renderToStaticMarkup(React.createElement(React.Fragment, null, React.createElement(left.LeftPanel, props), React.createElement(left.LeftPanel, props)));
  const ids = [...html.matchAll(/<input[^>]+id="([^"]+)"/g)].map((match) => match[1]);
  const labels = [...html.matchAll(/<label[^>]+for="([^"]+)"/g)].map((match) => match[1]);
  assert.equal(ids.length, 2);
  assert.equal(new Set(ids).size, 2);
  assert.deepEqual(labels, ids);
});

test("the existing Copilot context also retires its prior data after a confirmed 401", async () => {
  const store = makeStore();
  const query = loadQuery(store);
  let denied = false;
  const hook = loadSource("apps/web/lib/hooks/useCopilotContext.ts", {
    "next/navigation": { usePathname: () => "/workspace" },
    "../../app/workspace/lib/use-workspace-query": query,
    "../bff/prometeo": { detectCopilotContext: async () => { if (denied) throw Object.assign(new Error("Authenticated SEMSE session required"), { status: 401 }); return { fixture: "private copilot context" }; } },
  });
  let snapshot: any;
  function Probe() { snapshot = hook.useCopilotContext(); return null; }
  let root: any;
  await renderer.act(async () => { root = renderer.create(React.createElement(Probe)); });
  assert.equal(snapshot.context.fixture, "private copilot context");
  denied = true;
  await renderer.act(async () => { snapshot.refresh(); });
  assert.equal(snapshot.context, null);
  assert.equal(store.getSnapshot().sessionUnavailable, true);
  assert.match(snapshot.error, /sesión/i);
  await renderer.act(async () => { root.unmount(); });
});
