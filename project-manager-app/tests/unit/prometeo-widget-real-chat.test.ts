import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import path from "node:path";
import { buildWidgetChatRequest, pickRuntimeReply } from "../../apps/web/lib/prometeo-widget-chat.ts";

const repoRoot = path.resolve(import.meta.dirname, "../..");
const widget = readFileSync(path.join(repoRoot, "apps/web/app/components/prometeo/PrometeoCopilot.tsx"), "utf8");

test("projectId solo se envía cuando la pantalla es de un proyecto", () => {
  const project = buildWidgetChatRequest({ message: "hola", context: { module: "projects", resource: { id: "p1", type: "project" } }, route: "/client/projects/p1" });
  assert.equal(project.projectId, "p1");
  assert.equal(project.pageContext.module, "projects");
  assert.equal(project.pageContext.route, "/client/projects/p1");

  const job = buildWidgetChatRequest({ message: "hola", context: { module: "jobs", resource: { id: "j1", type: "job" } } });
  assert.equal("projectId" in job, false);

  const none = buildWidgetChatRequest({ message: "hola", context: null });
  assert.equal("projectId" in none, false);
  assert.deepEqual(none.pageContext, {});
});

test("el threadId se reutiliza solo si existe", () => {
  assert.equal(buildWidgetChatRequest({ message: "a", context: null, threadId: "t1" }).threadId, "t1");
  assert.equal("threadId" in buildWidgetChatRequest({ message: "a", context: null }), false);
});

test("solo se acepta la respuesta del runtime, nunca la de demo ni vacía", () => {
  assert.equal(pickRuntimeReply({ mode: "runtime", response: "  Tu score es Trust.  " }), "Tu score es Trust.");
  assert.equal(pickRuntimeReply({ mode: "runtime", message: "ok" }), "ok");
  assert.equal(pickRuntimeReply({ mode: "demo", response: "Hola, soy Prometeo (demo)" }), null);
  assert.equal(pickRuntimeReply({ mode: "runtime", response: "   " }), null);
  assert.equal(pickRuntimeReply(null), null);
  assert.equal(pickRuntimeReply(undefined), null);
});

test("el widget responde las preguntas generales con el chat real y conserva el respaldo", () => {
  assert.match(widget, /if \(!res\.requiresWorkspace\)/);
  assert.match(widget, /await askPrometeoChat\(/);
  assert.match(widget, /pickRuntimeReply\(real\)/);
  // el respaldo: la respuesta del servidor sigue siendo el valor por defecto
  assert.match(widget, /let reply = res\.response;/);
  assert.match(widget, /catch \{\s*\/\/ se mantiene `reply`/);
});
