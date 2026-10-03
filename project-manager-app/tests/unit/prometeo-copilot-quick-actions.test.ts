import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import path from "node:path";

const repoRoot = path.resolve(import.meta.dirname, "../..");
const source = readFileSync(
  path.join(repoRoot, "apps/web/app/components/prometeo/PrometeoCopilot.tsx"),
  "utf8",
);

function quickActionHandler(): string {
  const start = source.indexOf("async function handleQuickAction");
  const end = source.indexOf("if (!open) {", start);
  assert.ok(start >= 0 && end > start, "handleQuickAction must exist");
  return source.slice(start, end);
}

test("quick actions never report a fabricated success", () => {
  assert.doesNotMatch(source, /ejecutada\./);
  assert.doesNotMatch(quickActionHandler(), /`Acción "\$\{action\.description\}" ejecutada/);
});

test("read-only quick actions are asked through the real copilot chat", () => {
  const handler = quickActionHandler();
  assert.match(handler, /await handleSend\(action\.description\)/);
});

test("actions that need the workspace navigate there, including workspace.focus", () => {
  const handler = quickActionHandler();
  assert.match(handler, /res\.requiresWorkspace \|\| action\.action === "workspace\.focus"/);
  assert.match(handler, /router\.push\("\/workspace"\)/);
});

test("copilot.ask invites the user to type instead of sending its label as a question", () => {
  const handler = quickActionHandler();
  const ask = handler.indexOf('action.action === "copilot.ask"');
  const send = handler.indexOf("await handleSend(action.description)");
  assert.ok(ask >= 0 && ask < send, "copilot.ask must be handled before the generic chat path");
  assert.match(handler, /Escribe tu pregunta abajo/);
});

test("a failed action and a request error are shown to the user", () => {
  const handler = quickActionHandler();
  assert.match(handler, /res\.status === "failed"/);
  assert.match(handler, /No se pudo ejecutar la acción\./);
});

test("the copilot widget stays mounted in the authenticated layout", () => {
  const layout = readFileSync(path.join(repoRoot, "apps/web/app/(app)/layout.tsx"), "utf8");
  assert.match(layout, /<PrometeoCopilot \/>/);
});
