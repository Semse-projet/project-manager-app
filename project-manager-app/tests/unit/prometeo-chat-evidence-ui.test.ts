import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import path from "node:path";
import {
  EVIDENCE_OPINION_LABEL,
  classifyAnalysisResponse,
  evidenceIdOf,
  isAnalyzeEvidenceAction,
  requestEvidenceAnalysis,
} from "../../apps/web/lib/prometeo-chat-evidence.ts";
import { toChatActionViews } from "../../apps/web/lib/prometeo-chat-actions.ts";

// prometeo.chat-evidence · Ola 4 (CE-040/CE-041): helper puro de la UI y su cableado en el panel y el widget.

const repoRoot = path.resolve(import.meta.dirname, "../..");
const read = (rel: string) => readFileSync(path.join(repoRoot, rel), "utf8");

const action = (evidenceId: unknown, over: Record<string, unknown> = {}) => ({
  id: `chat-analyze_evidence-${String(evidenceId)}`, namespace: "chat", tool: "analyze_evidence", label: "Analizar con visión", input: { evidenceId }, ...over,
});

test("CE-040: se reconoce la acción y solo con un evidenceId de forma segura", () => {
  assert.equal(isAnalyzeEvidenceAction(action("ev_1")), true);
  assert.equal(evidenceIdOf(action("ev_1")), "ev_1");
  for (const bad of ["../x", "a b", "", "x".repeat(65), 42, null, undefined, { a: 1 }, "ev/1", "<script>"]) {
    assert.equal(evidenceIdOf(action(bad)), null, String(bad));
  }
  assert.equal(isAnalyzeEvidenceAction({ namespace: "vision", tool: "analyze_evidence", input: { evidenceId: "ev_1" } }), false);
  assert.equal(isAnalyzeEvidenceAction({ namespace: "chat", tool: "navigate" }), false);
});

test("CE-040: toChatActionViews incluye el botón de análisis con su evidenceId y descarta los inseguros", () => {
  const views = toChatActionViews([action("ev_1"), action("../x"), action("ev_2")]);
  assert.deepEqual(views.map((v) => [v.kind, v.evidenceId]), [["analyze_evidence", "ev_1"], ["analyze_evidence", "ev_2"]]);
});

test("CE-040: la etiqueta fija deja claro que es una opinión asistida", () => {
  assert.match(EVIDENCE_OPINION_LABEL, /opinión asistida, no es una aprobación/i);
});

test("CE-040: classifyAnalysisResponse — hecho, degradado, límite diario y error", () => {
  const summary = { evidenceId: "ev_1", analysisStatus: "completed", qualityScore: 82, riskLevel: "low", riskReasons: ["Sombra"], requiresHumanReview: false, recommendedAction: "review", disclaimer: "x" };
  const done = classifyAnalysisResponse(200, { data: summary });
  assert.equal(done.state, "done");
  assert.equal((done as { summary: typeof summary }).summary.qualityScore, 82);
  assert.equal(classifyAnalysisResponse(200, { data: { ...summary, analysisStatus: "failed" } }).state, "degraded");
  assert.equal(classifyAnalysisResponse(429, { error: { message: "Límite" } }).state, "limit");
  for (const status of [400, 403, 404, 500, 502, 503]) assert.equal(classifyAnalysisResponse(status, {}).state, "error", String(status));
  assert.equal(classifyAnalysisResponse(200, { data: "basura" }).state, "error");
  assert.equal(classifyAnalysisResponse(200, null).state, "error");
});

test("CE-040: classifyAnalysisResponse descarta lo que no es dato esperado (sin enlaces ni rawResult)", () => {
  const out = classifyAnalysisResponse(200, { data: { evidenceId: "ev_1", analysisStatus: "completed", qualityScore: 70, riskLevel: "low", riskReasons: ["ok", 5, "https://evil.example"], rawResult: { x: 1 }, fileUrl: "https://secret" } });
  const json = JSON.stringify(out);
  for (const leak of ["rawResult", "fileUrl", "evil.example", "secret"]) assert.equal(json.includes(leak), false, leak);
});

test("CE-040: requestEvidenceAnalysis hace POST al BFF solo con la correlación y nunca lanza", async () => {
  const calls: Array<{ url: string; init: any }> = [];
  const okFetch = (async (url: string, init: any) => { calls.push({ url, init }); return { status: 200, json: async () => ({ data: { evidenceId: "ev_1", analysisStatus: "completed", qualityScore: 1, riskReasons: [] } }) }; }) as never;
  const res = await requestEvidenceAnalysis("ev_1", { fetchImpl: okFetch, chatRequestId: "chat-1" });
  assert.equal(res.state, "done");
  assert.equal(calls[0]!.url, "/api/semse/prometeo/chat-evidence/analyze/ev_1");
  assert.equal(calls[0]!.init.method, "POST");
  assert.deepEqual(JSON.parse(calls[0]!.init.body), { chatRequestId: "chat-1" });
  const boom = (async () => { throw new Error("net"); }) as never;
  assert.equal((await requestEvidenceAnalysis("ev_1", { fetchImpl: boom })).state, "error");
  assert.equal((await requestEvidenceAnalysis("../x", { fetchImpl: okFetch })).state, "error", "un id inseguro ni siquiera se envía");
  assert.equal(calls.length, 1);
});

test("CE-041: el panel analiza solo al pulsar, de un solo uso, muestra estados y la etiqueta fija", () => {
  const panel = read("apps/web/components/ai/agent-chat-panel.tsx");
  assert.match(panel, /requestEvidenceAnalysis\(/, "llama al BFF solo desde el manejador del clic");
  assert.match(panel, /analyze_evidence/);
  assert.match(panel, /EVIDENCE_OPINION_LABEL/, "etiqueta fija «opinión asistida, no es una aprobación»");
  assert.match(panel, /usedChatActions\.has\(key\)/, "un solo uso");
  assert.match(panel, /EvidenceAnalysisResult/, "estados cargando/degradado/error");
});

test("CE-041: el widget analiza solo al pulsar y muestra estados con la etiqueta fija", () => {
  const widget = read("apps/web/app/components/prometeo/PrometeoCopilot.tsx");
  assert.match(widget, /requestEvidenceAnalysis\(/);
  assert.match(widget, /analyze_evidence/);
  const chat = read("apps/web/app/components/prometeo/CopilotChat.tsx");
  assert.match(chat, /EVIDENCE_OPINION_LABEL/);
  assert.match(chat, /evidenceResults/);
});

test("CE-041: ningún componente llama al API directo; solo al BFF", () => {
  for (const file of ["apps/web/components/ai/agent-chat-panel.tsx", "apps/web/app/components/prometeo/PrometeoCopilot.tsx", "apps/web/app/components/prometeo/CopilotChat.tsx"]) {
    const src = read(file);
    assert.equal(/\/v1\/prometeo\/chat-evidence/.test(src), false, `${file}: solo el BFF`);
  }
});
