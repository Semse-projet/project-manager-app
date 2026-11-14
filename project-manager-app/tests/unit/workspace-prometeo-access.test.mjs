import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { createRequire, stripTypeScriptTypes } from "node:module";
import { runInNewContext } from "node:vm";
import path from "node:path";

const root = path.resolve(import.meta.dirname, "../..");
const widget = readFileSync(path.join(root, "apps/web/app/components/prometeo/PrometeoCopilot.tsx"), "utf8");
let access = "";
try {
  access = readFileSync(path.join(root, "apps/web/app/workspace/components/PrometeoAccess.tsx"), "utf8");
} catch (error) {
  if (error.code !== "ENOENT") throw error;
}

// Usa el compilador ya declarado en el repositorio, nunca instala dependencias.
let ts;
try {
  ts = createRequire(import.meta.url)("typescript");
} catch (error) {
  if (error.code !== "MODULE_NOT_FOUND") throw error;
}

function renderWidget(props) {
  const effects = [];
  const updates = [];
  let stateIndex = 0;
  const dependencies = {
    react: {
      useState: (initial) => {
        const slot = stateIndex++;
        return [typeof initial === "function" ? initial() : initial, (value) => updates.push([slot, value])];
      },
      useEffect: (callback, dependencies) => effects.push({ callback, dependencies }),
      useRef: (value) => ({ current: value }),
    },
    "react/jsx-runtime": { jsx: (type, props) => ({ type, props }), jsxs: (type, props) => ({ type, props }) },
    "next/navigation": { useRouter: () => ({ push: () => assert.fail("no navega al montar") }), usePathname: () => "/workspace" },
    "lucide-react": { X: "X" },
    "../../../lib/hooks/useCopilotContext": { useCopilotContext: () => ({ context: null, loading: false, error: null, refresh: () => undefined }) },
    "../../../lib/use-modal-open": { useModalOpen: () => false },
    "../../../lib/bff/prometeo": {
      askPrometeoChat: () => assert.fail("sin petición LLM al montar"),
      createMissionFromCopilot: () => assert.fail("sin aceptación automática"),
      executeCopilotAction: () => assert.fail("sin acción automática"),
      sendCopilotMessage: () => assert.fail("sin chat automático"),
    },
    "../../../lib/prometeo-widget-chat": {},
    "../../../lib/prometeo-chat-actions": {},
    "../../../lib/prometeo-chat-evidence": {},
    "./ContextDetector": { ContextDetector: "ContextDetector" },
    "./CopilotChat": { CopilotChat: "CopilotChat" },
    "./QuickActions": { QuickActions: "QuickActions" },
    "./PrometeoMascot": { PrometeoMascot: "PrometeoMascot" },
    "./MissionSuggestion": { MissionSuggestion: "MissionSuggestion" },
  };
  const output = ts.transpileModule(widget, {
    compilerOptions: { jsx: ts.JsxEmit.ReactJSX, module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  const exports = {};
  runInNewContext(output, {
    exports,
    require: (name) => {
      assert.ok(name in dependencies, `dependencia sintética explícita: ${name}`);
      return dependencies[name];
    },
  });
  return { tree: exports.PrometeoCopilot(props), effects, updates };
}

function acceptHandlerSource() {
  const start = widget.indexOf("async function handleAcceptMission");
  const end = widget.indexOf("function pushAssistantMessage", start);
  assert.ok(start >= 0 && end > start, "se conserva el handler existente de aceptación");
  return widget.slice(start, end);
}

function acceptanceHarness({ callback = true, fail = false, sessionId = "synthetic-session", pending = false } = {}) {
  const events = [];
  const messages = [];
  const handle = runInNewContext(
    `${stripTypeScriptTypes(acceptHandlerSource())}; handleAcceptMission;`,
    {
      sessionId,
      pending,
      createMissionFromCopilot: async (request) => {
        events.push(["create", request]);
        if (fail) throw new Error("synthetic failure");
        return { missionId: "synthetic-reference", workspaceUrl: "/workspace" };
      },
      setPending: (value) => events.push(["pending", value]),
      setSuggestion: (value) => events.push(["suggestion", value]),
      flashMood: (value) => events.push(["mood", value]),
      router: { push: (url) => events.push(["push", url]) },
      onWorkspaceMissionLoaded: callback ? () => events.push(["refresh"]) : undefined,
      setMessages: (update) => messages.push(...update([])),
      newId: () => "synthetic-message",
    },
  );
  return { handle, events, messages };
}

const suggestion = { type: "project", title: "Referencia sintética", reason: "Solo prueba local" };

test("P7: acceso exportado con rol nullable y callback opcional", () => {
  assert.match(access, /export function PrometeoAccess/);
  assert.match(access, /role:\s*WorkspaceRole\s*\|\s*null/);
  assert.match(access, /onMissionLoaded\?:\s*\(\)\s*=>\s*void/);
  assert.match(access, /import type \{ WorkspaceRole \} from "\.\.\/lib\/workspace-model"/);
});

test("P7: rol desconocido no monta el widget ni habilita enlaces de negocio", () => {
  assert.match(access, /if \(!role\)\s*\{/);
  assert.match(access, /<PrometeoAccessCard key=\{role\}/);
  assert.doesNotMatch(access, /href=|fetch\(|useCopilotContext\(|useWorkspaceQuery\(/);
});

test("P7: una tarjeta monta un único widget lazy solo después de abrir", () => {
  assert.match(access, /dynamic\(/);
  assert.match(access, /import\("\.\.\/\.\.\/components\/prometeo\/PrometeoCopilot"\)/);
  assert.match(access, /ssr:\s*false/);
  assert.match(access, /useState\(0\)/);
  assert.match(access, /onClick=\{\(\) => setOpenSignal\(\(signal\) => signal \+ 1\)\}/);
  assert.match(access, /openSignal > 0 &&/);
  assert.equal((access.match(/<WorkspacePrometeoCopilot\b/g) ?? []).length, 1);
  assert.match(access, /openSignal=\{openSignal\}/);
  assert.match(access, /onWorkspaceMissionLoaded=\{onMissionLoaded\}/);
});

test("P7: tarjeta española, estado honesto, referencia sin ejecución y targets táctiles", () => {
  assert.match(access, /Abrir Prometeo/);
  assert.match(access, /sin comprobar/i);
  assert.match(access, /Referencia de trabajo · sin ejecución vinculada/);
  assert.match(access, /min-h-11/);
  assert.match(access, /var\(--surface\)/);
  assert.match(access, /var\(--brand\)/);
  assert.match(access, /focus-visible/);
  assert.doesNotMatch(access, /w-96|w-\[\d+px\]|saludable|100% disponible/i);
});

test("P7: no chat paralelo, historial persistido, store duplicado o datos financieros automáticos", () => {
  assert.doesNotMatch(access, /CopilotChat|sendCopilotMessage|askPrometeoChat|localStorage|sessionStorage|workspaceStore|budget|bid/);
  assert.doesNotMatch(widget, /localStorage|sessionStorage/);
});

test("P7: nuevas props son opcionales y el montaje sin props permanece válido", () => {
  assert.match(widget, /openSignal\?:\s*number/);
  assert.match(widget, /onWorkspaceMissionLoaded\?:\s*\(\)\s*=>\s*void/);
  assert.match(widget, /export function PrometeoCopilot\([\s\S]*?: PrometeoCopilotProps = \{\}/);
  const layout = readFileSync(path.join(root, "apps/web/app/(app)/layout.tsx"), "utf8");
  assert.match(layout, /<PrometeoCopilot \/>/);
});

test("P7: una señal positiva abre el widget sin pedir respuestas al asistente", () => {
  const signalEffect = widget.match(/useEffect\(\(\) => \{([\s\S]*?)\}, \[openSignal\]\);/);
  assert.ok(signalEffect, "la apertura responde a cambios de señal");
  assert.match(signalEffect[1], /openSignal > 0/);
  assert.match(signalEffect[1], /setOpen\(true\)/);
  assert.doesNotMatch(signalEffect[1], /handleSend|askPrometeoChat|sendCopilotMessage|createMissionFromCopilot|executeCopilotAction/);
});

test("P7: error del hook visible y reintento usa refresh sin modificar contratos", () => {
  assert.match(widget, /const \{ context, loading, error, refresh \} = useCopilotContext\(\)/);
  assert.match(widget, /\{error && \(/);
  assert.match(widget, /role="alert"/);
  assert.match(widget, /\{error\}/);
  assert.match(widget, /onClick=\{refresh\}/);
  assert.match(widget, /disabled=\{loading\}/);
  assert.match(widget, /Reintentar contexto/);
  assert.match(widget, /onRetry=\{handleSend\}/);
});

test("P7: wrapper del widget se adapta al viewport y cierre accesible de 44px", () => {
  assert.match(widget, /max-h-\[calc\(100dvh-/);
  assert.match(widget, /max-w-sm/);
  assert.match(widget, /min-h-11 min-w-11/);
  assert.match(widget, /aria-label="Cerrar Copilot"/);
});

test("P7: montaje real sin props conserva mascota cerrada; señal positiva abre sin invocar BFF", { skip: !ts && "TypeScript no disponible; contratos de source y handler siguen activos" }, () => {
  assert.equal(renderWidget().tree.props.role, undefined);
  assert.equal(renderWidget({ openSignal: 1 }).tree.props.role, "region");
  const launched = renderWidget({ openSignal: 2 });
  const effect = launched.effects.find(({ dependencies }) => dependencies.length === 1 && dependencies[0] === 2);
  assert.ok(effect);
  effect.callback();
  assert.equal(launched.updates.length, 1);
  assert.equal(launched.updates[0][1], true);
});

test("P7: señal ausente, cero, negativa o no finita no abre ni envía requests", { skip: !ts && "TypeScript no disponible" }, () => {
  for (const signal of [undefined, 0, -1, NaN, Infinity]) {
    const rendered = renderWidget({ openSignal: signal });
    assert.equal(rendered.tree.props.role, undefined);
    const effect = rendered.effects.find(({ dependencies }) => dependencies.length === 1 && Object.is(dependencies[0], signal));
    assert.ok(effect);
    effect.callback();
    assert.equal(rendered.updates.length, 0);
  }
});

test("P7: callback refresca antes del push aunque destino sea la misma ruta", async () => {
  const { handle, events } = acceptanceHarness();
  await handle(suggestion);
  assert.equal(events.filter(([kind]) => kind === "refresh").length, 1);
  const refresh = events.findIndex(([kind]) => kind === "refresh");
  const create = events.findIndex(([kind]) => kind === "create");
  const push = events.findIndex(([kind]) => kind === "push");
  assert.ok(create < refresh && refresh < push);
  assert.equal(events[push][1], "/workspace");
  assert.equal(events[create][1].copilotSessionId, "synthetic-session");
  assert.equal(events[create][1].title, suggestion.title);
  assert.equal(events.at(-1)[1], false);
});

test("P7: aceptar sin callback mantiene el flujo de los otros montajes", async () => {
  const { handle, events } = acceptanceHarness({ callback: false });
  await handle(suggestion);
  assert.equal(events.filter(([kind]) => kind === "push").length, 1);
  assert.equal(events.filter(([kind]) => kind === "refresh").length, 0);
});

test("P7: fallo al abrir conserva sugerencia, no notifica ni navega y permite intentar otra vez", async () => {
  const { handle, events, messages } = acceptanceHarness({ fail: true });
  await handle(suggestion);
  assert.equal(events.filter(([kind]) => ["refresh", "push", "suggestion"].includes(kind)).length, 0);
  assert.equal(messages.length, 1);
  assert.match(messages[0].content, /No se pudo/);
  assert.equal(events.at(-1)[1], false);
});

test("P7: sin sesión o mientras está pendiente no repite aceptación", async () => {
  for (const options of [{ sessionId: null }, { pending: true }]) {
    const harness = acceptanceHarness(options);
    await harness.handle(suggestion);
    assert.equal(harness.events.length, 0);
  }
});
