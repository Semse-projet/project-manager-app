import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import path from "node:path";
import { isChatAction, safeChatRoute, toChatActionViews } from "../../apps/web/lib/prometeo-chat-actions.ts";

// prometeo.chat-actions · Ola 3 (CA-030..CA-033): helper puro de la UI y su cableado en el widget y el panel.

const repoRoot = path.resolve(import.meta.dirname, "../..");
const read = (rel: string) => readFileSync(path.join(repoRoot, rel), "utf8");

test("CA-030: solo se navega a rutas relativas de los espacios conocidos", () => {
  for (const ok of ["/client/dashboard", "/worker/jobs", "/admin/disputes", "/client/jobs/new"]) assert.equal(safeChatRoute(ok), ok, ok);
  for (const bad of [
    "https://evil.example", "//evil.example", "/\\evil", "javascript:alert(1)", "/admin/../etc/passwd", "/client/jobs?x=1",
    "/client/jobs#frag", "/root/panel", "client/dashboard", "", null, undefined, 42, {},
  ]) {
    assert.equal(safeChatRoute(bad as never), null, String(bad));
  }
});

test("CA-030: toChatActionViews solo deja las acciones de chat conocidas y con destino válido", () => {
  const views = toChatActionViews([
    { id: "chat-navigate-disputes", namespace: "chat", tool: "navigate", label: "Ir a Disputas", input: { route: "/admin/disputes" } },
    { id: "chat-create_job_draft", namespace: "chat", tool: "create_job_draft", label: "Crear el trabajo", input: { route: "/client/jobs/new" } },
    { id: "chat-create_job_draft", namespace: "chat", tool: "create_job_draft", label: "duplicada", input: {} },
    { id: "x1", namespace: "chat", tool: "navigate", label: "Ruta insegura", input: { route: "https://evil.example" } },
    { id: "x2", namespace: "chat", tool: "borrar_todo", label: "Desconocida", input: {} },
    { id: "x3", namespace: "vision", tool: "navigate", label: "Otro namespace", input: { route: "/admin/disputes" } },
    { namespace: "time_tracker", tool: "get_status" },
  ]);
  assert.deepEqual(views.map((v) => [v.id, v.kind, v.route]), [
    ["chat-navigate-disputes", "navigate", "/admin/disputes"],
    ["chat-create_job_draft", "create_job_draft", "/client/jobs/new"],
  ]);
  assert.deepEqual(toChatActionViews(undefined), []);
  assert.deepEqual(toChatActionViews(null), []);
});

test("CA-030: crear trabajo sin ruta dedicada se conserva (el panel usa el borrador del asistente)", () => {
  const [view] = toChatActionViews([{ id: "chat-create_job_draft", namespace: "chat", tool: "create_job_draft", label: "Crear el trabajo", input: {} }]);
  assert.equal(view!.kind, "create_job_draft");
  assert.equal(view!.route, null);
  assert.equal(isChatAction({ namespace: "chat", tool: "create_job_draft" }), true);
  assert.equal(isChatAction({ namespace: "chat", tool: "otra" }), false);
});

test("CA-031: el panel pinta botones de chat (sin duplicarlos como tarjeta), valida la ruta y abre el borrador solo al pulsar", () => {
  const panel = read("apps/web/components/ai/agent-chat-panel.tsx");
  assert.match(panel, /toChatActionViews\(message\.proposedActions\)/, "convierte las acciones del envelope");
  assert.match(panel, /namespace !== "chat"/, "las acciones de chat no se pintan también como tarjeta de aprobación");
  assert.match(panel, /safeChatRoute\(/, "el panel vuelve a validar la ruta antes de navegar");
  assert.match(panel, /forcePublishJob/, "crear trabajo reutiliza el flujo de borrador existente");
  assert.match(panel, /silentUser/, "el clic no duplica el mensaje del usuario");
  assert.match(panel, /isPublishJobIntent/, "el atajo por frases exactas sigue vigente mientras el flag no esté en live");
});

test("CA-032: el widget propaga las acciones del envelope y navega solo al pulsar, con la ruta validada", () => {
  const widget = read("apps/web/app/components/prometeo/PrometeoCopilot.tsx");
  assert.match(widget, /toChatActionViews\(real\.proposedActions\)/);
  assert.match(widget, /safeChatRoute\(/);
  assert.match(widget, /router\.push\(/);
  const chat = read("apps/web/app/components/prometeo/CopilotChat.tsx");
  assert.match(chat, /onAction/);
  assert.match(chat, /actionsUsed|disabled=\{pending \|\| used/, "un botón ya usado no se puede pulsar dos veces");
});

test("CA-033: el BFF reenvía el envelope tal cual (las acciones de chat llegan al cliente)", () => {
  const widgetLib = read("apps/web/lib/prometeo-widget-chat.ts");
  assert.match(widgetLib, /proposedActions\?:/, "RuntimeChatData declara proposedActions");
});
