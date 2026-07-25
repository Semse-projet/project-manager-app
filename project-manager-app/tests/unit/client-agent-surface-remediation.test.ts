import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import path from "node:path";

const repoRoot = path.resolve(import.meta.dirname, "../..");

function read(relativePath: string): string {
  return readFileSync(path.join(repoRoot, relativePath), "utf8");
}

const agentsSource = read("apps/web/app/(app)/agents/page.tsx");
const panelStateSource = read("apps/web/components/ai/agent-panel-state.tsx");
const layoutSource = read("apps/web/app/(app)/layout.tsx");

test("agent catalog exposes six direct chats and ten explicit routed capabilities", () => {
  const routeMap = agentsSource.slice(
    agentsSource.indexOf("const PANEL_AGENT_ROUTE_MAP"),
    agentsSource.indexOf("const PANEL_AGENT_LABELS"),
  );
  const routes = Array.from(routeMap.matchAll(/^\s+([a-z_]+):\s+"([a-z_]+)",?$/gm))
    .map((match) => ({ catalogId: match[1], panelId: match[2] }));

  assert.equal(routes.length, 16);
  assert.equal(routes.filter((route) => route.catalogId === route.panelId).length, 6);
  assert.equal(routes.filter((route) => route.catalogId !== route.panelId).length, 10);
  assert.match(panelStateSource, /PanelAgentId\s*=\s*"assistant"\s*\|\s*"marta"\s*\|\s*"felix"\s*\|\s*"pulse"\s*\|\s*"justus"\s*\|\s*"planner"/);
  assert.match(agentsSource, /6 chats directos · 10 capacidades canalizadas · 8 automatizaciones backend sin chat directo/);
  assert.match(agentsSource, /aria-pressed=\{isSelected\}/);
});

test("backend-only agents use neutral, non-telemetry copy", () => {
  assert.doesNotMatch(agentsSource, /Backend activo/);
  assert.match(agentsSource, /Automatización backend · sin chat directo/);
  assert.match(agentsSource, /no representa telemetría en tiempo real/);
});

test("authenticated layout exposes exactly one assistant surface", () => {
  assert.equal((layoutSource.match(/<AgentChatPanel\s*\/>/g) ?? []).length, 1);
  assert.doesNotMatch(layoutSource, /\bPrometeoCopilot\b/);
});
