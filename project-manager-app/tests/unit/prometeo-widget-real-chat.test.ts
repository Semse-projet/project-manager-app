import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import path from "node:path";
import { buildChatHistory, buildWidgetChatRequest, classifyChatReply, describeChatFailure, pickRuntimeReply } from "../../apps/web/lib/prometeo-widget-chat.ts";

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

test("0.43: el historial se reenvía acotado y sin saludos, degradados ni errores", () => {
  const history = buildChatHistory([
    { id: "welcome", role: "assistant", content: "Hola, soy Prometeo." },
    { id: "1", role: "user", content: "cuantos trabajos activos tengo" },
    { id: "2", role: "assistant", content: "Tienes **4** activos." },
    { id: "3", role: "assistant", content: "El modelo no pudo responder. No es una respuesta de Prometeo.", status: "degraded" },
    { id: "4", role: "assistant", content: "⚠ Error de conexión" },
    { id: "5", role: "user", content: "   " },
  ]);
  assert.deepEqual(history, [
    { role: "user", content: "cuantos trabajos activos tengo" },
    { role: "assistant", content: "Tienes **4** activos." },
  ]);

  const long = Array.from({ length: 30 }, (_, i) => ({ id: `m${i}`, role: i % 2 ? ("assistant" as const) : ("user" as const), content: "z".repeat(5000) }));
  const capped = buildChatHistory(long);
  assert.equal(capped.length, 10);
  assert.ok(capped.every((t) => t.content.length === 2000));
});

test("0.43: la petición del widget lleva el historial solo si hay turnos previos", () => {
  const withHistory = buildWidgetChatRequest({ message: "y el primero?", context: null, history: [{ role: "user", content: "hola" }] });
  assert.deepEqual(withHistory.history, [{ role: "user", content: "hola" }]);
  assert.equal("history" in buildWidgetChatRequest({ message: "hola", context: null, history: [] }), false);
  assert.equal("history" in buildWidgetChatRequest({ message: "hola", context: null }), false);
  assert.match(widget, /history: buildChatHistory\(messages\)/, "el widget debe enviar el historial");
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

test("H06: distingue una respuesta real de una degradación; los reportes y el contexto SÍ se conservan", () => {
  assert.deepEqual(classifyChatReply({ mode: "runtime", response: " hola " }), { kind: "answer", text: "hola", mode: "runtime" });
  assert.equal(classifyChatReply({ mode: "report", response: "Informe X" }).kind, "answer");
  assert.equal(classifyChatReply({ mode: "context_only", message: "Elige un proyecto" }).kind, "answer");
  for (const bad of [
    { mode: "demo", response: "Hola, soy Prometeo (demo)" },
    { mode: "fallback", response: "error del modelo" },
    { mode: "runtime", response: "   " },
    { mode: "otro", response: "x" },
    {},
  ]) {
    assert.equal(classifyChatReply(bad as never).kind, "degraded", JSON.stringify(bad));
  }
  assert.equal(classifyChatReply(null).kind, "degraded");
  assert.equal(pickRuntimeReply({ mode: "report", response: "Informe" }), "Informe");
  assert.equal(pickRuntimeReply({ mode: "demo", response: "x" }), null);
});

test("H06: timeout, cancelación y error se describen distinto", () => {
  const timeout = Object.assign(new Error("t"), { name: "TimeoutError" });
  const abort = Object.assign(new Error("a"), { name: "AbortError" });
  assert.match(describeChatFailure(timeout), /tardó demasiado/);
  assert.match(describeChatFailure(abort), /canceló/);
  assert.equal(describeChatFailure(new Error("502 del API")), "502 del API");
  assert.match(describeChatFailure(undefined), /No se pudo consultar/);
});

test("H06: el widget no oculta el fallo del runtime ni deja respuestas de otro contexto", () => {
  // el catch vacío que conservaba el texto fijo ya no existe
  assert.doesNotMatch(widget, /catch \{\s*\/\/ se mantiene `reply`/);
  assert.doesNotMatch(widget, /let reply = res\.response;/);
  // degradación visible, con reintento y sin pasar por respuesta de Prometeo
  assert.match(widget, /status: "degraded", retryText: text/);
  assert.match(widget, /No es una respuesta de Prometeo\./);
  assert.match(widget, /onRetry=\{handleSend\}/);
  // timeout y cancelación (cambio de página / desmontaje)
  assert.match(widget, /const CHAT_TIMEOUT_MS = 45_000;/);
  assert.match(widget, /new AbortController\(\)/);
  assert.match(widget, /askPrometeoChat\([\s\S]*controller\.signal/);
  assert.match(widget, /inflight\.current\?\.abort\(\)/);
  // la respuesta de otra pantalla se descarta
  assert.match(widget, /if \(pathnameRef\.current !== startedAt\) return;/);
  // el mood "answered" solo tras una respuesta real; el error en la degradación
  assert.match(widget, /flashMood\("error"\);\s*setMessages/);
  const chat = readFileSync(path.join(repoRoot, "apps/web/app/components/prometeo/CopilotChat.tsx"), "utf8");
  assert.match(chat, /Reintentar/);
  assert.match(chat, /role=\{m\.status === "degraded" \? "alert" : undefined\}/);
});

test("H09: foco visible, 'reducir movimiento' dinámico y pérdida de WebGL en la mascota", () => {
  const mascot3d = readFileSync(path.join(repoRoot, "apps/web/app/components/prometeo/PrometeoMascot3D.tsx"), "utf8");
  assert.match(mascot3d, /matches\(":focus-visible"\)/);
  assert.match(mascot3d, /outline: focusVisible \? "3px solid #29d3ff" : "none"/);
  const wrapper = readFileSync(path.join(repoRoot, "apps/web/app/components/prometeo/PrometeoMascot.tsx"), "utf8");
  assert.match(wrapper, /query\?\.addEventListener\?\.\("change", apply\)/);
  assert.match(wrapper, /removeEventListener\?\.\("change", apply\)/);
  assert.match(wrapper, /if \(!use3D \|\| contextLost\) return fallback;/);
  const scene = readFileSync(path.join(repoRoot, "apps/web/lib/prometeo-mascot-scene.ts"), "utf8");
  assert.match(scene, /addEventListener\("webglcontextlost", this\.onContextLost\)/);
  assert.match(scene, /removeEventListener\("webglcontextlost", this\.onContextLost\)/);
});
