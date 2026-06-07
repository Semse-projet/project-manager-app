/**
 * Smoke test: Ollama dentro de un flujo real de SEMSE OS
 *
 * Ejercita LLMNarrativeService (→ LLMOrchestrator → OllamaProvider) con 3 operaciones reales:
 *   A. generateMissionControlNarrative  — summary operacional (texto libre)
 *   B. detectChangeOrderCandidate       — JSON estructurado (el más exigente)
 *   C. explainEvidenceReadiness         — narrativa de evidencia faltante
 *
 * No toca DB, no toca Railway, no requiere auth.
 * Corre con: node scripts/smoke-ollama-real-flow.mjs
 */

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// ── Load .env ─────────────────────────────────────────────────────────────────
const envLines = readFileSync(path.join(__dirname, "../.env"), "utf8").split("\n");
for (const line of envLines) {
  const t = line.trim();
  if (!t || t.startsWith("#")) continue;
  const eq = t.indexOf("=");
  if (eq === -1) continue;
  const k = t.slice(0, eq).trim();
  const v = t.slice(eq + 1).trim().replace(/^["']|["']$/g, "");
  if (!process.env[k]) process.env[k] = v;
}

// ── Bootstrap LLM stack from compiled dist ────────────────────────────────────
const { ProviderMetricsStore } = await import("../dist/infrastructure/llm/metrics/provider-metrics.store.js");
const { AdaptiveRouter }       = await import("../dist/infrastructure/llm/router/adaptive-router.js");
const { LLMOrchestrator }      = await import("../dist/infrastructure/llm/orchestrator.js");
const { LLMNarrativeService }  = await import("../dist/modules/operational-intelligence/llm-narrative.service.js");

// NestJS Logger stub (no necesitamos DI real para el smoke)
const logLines = [];
const patchLogger = (instance) => {
  const name = instance.constructor?.name ?? "?";
  const stub = {
    log:   (...a) => { const msg = `[${name}] ${a.join(" ")}`; logLines.push(msg); process.stdout.write(msg + "\n"); },
    warn:  (...a) => process.stdout.write(`[WARN][${name}] ${a.join(" ")}\n`),
    debug: ()    => {},
    error: (...a) => process.stdout.write(`[ERR][${name}] ${a.join(" ")}\n`),
  };
  Object.assign(instance["logger"] ?? {}, stub);
  instance["logger"] = stub;
};

const metrics  = new ProviderMetricsStore();
const router   = new AdaptiveRouter(metrics);
const orch     = new LLMOrchestrator(metrics, router);
const narrative = new LLMNarrativeService(orch);

patchLogger(metrics);
patchLogger(router);
patchLogger(orch);
patchLogger(narrative);

// ── Helpers ───────────────────────────────────────────────────────────────────
const PASS = "✅";
const FAIL = "❌";
const WARN = "⚠️ ";

function banner(title) {
  console.log(`\n${"═".repeat(60)}`);
  console.log(`  ${title}`);
  console.log("═".repeat(60));
}

function isValidJson(str) {
  if (!str) return false;
  const match = str.match(/\{[\s\S]*\}/);
  if (!match) return false;
  try { JSON.parse(match[0]); return true; } catch { return false; }
}

const results = [];

async function runFlow(label, fn) {
  console.log(`\n[${label}] Ejecutando...`);
  const t0 = Date.now();
  try {
    const output = await fn();
    const latency = Date.now() - t0;
    // Find the last orchestrator log line to extract provider info
    const orchLog = [...logLines].reverse().find(l => l.includes("[orchestrator] provider="));
    const providerMatch = orchLog?.match(/provider=(\S+)/);
    const modelMatch    = orchLog?.match(/model=(\S+)/);
    const fallbackMatch = orchLog?.match(/fallback=(\S+)/);
    const reasonMatch   = orchLog?.match(/routingReason=(\S+)/);

    const provider    = providerMatch?.[1] ?? "unknown";
    const model       = modelMatch?.[1]    ?? "unknown";
    const fallback    = fallbackMatch?.[1] ?? "unknown";
    const reason      = reasonMatch?.[1]   ?? "unknown";

    results.push({ label, ok: true, provider, model, fallback, reason, latency, output });

    console.log(`   provider       : ${provider}`);
    console.log(`   model          : ${model}`);
    console.log(`   routingReason  : ${reason}`);
    console.log(`   fallbackUsed   : ${fallback}`);
    console.log(`   latency        : ${latency}ms`);
    console.log(`   output         : ${String(output ?? "").slice(0, 200)}`);
    return output;
  } catch (err) {
    const latency = Date.now() - t0;
    results.push({ label, ok: false, error: err.message, latency });
    console.log(`   ${FAIL} Error (${latency}ms): ${err.message}`);
    return null;
  }
}

// ══════════════════════════════════════════════════════════════════════════════
banner("SEMSE OS — Smoke: Ollama en flujos reales");
console.log(`\nOLLAMA_MODEL = ${process.env.OLLAMA_MODEL}`);
console.log(`Providers registrados: ${orch.getRegisteredProviders().join(", ")}`);

// ── FLOW A: Mission Control Narrative ─────────────────────────────────────────
banner("Flow A — generateMissionControlNarrative (texto libre)");
await runFlow("MissionControlNarrative", () =>
  narrative.generateMissionControlNarrative({
    systemStatus:     "high_risk",
    openSignalCount:  4,
    criticalCount:    1,
    highCount:        2,
    topSignals: [
      { type: "DISPUTE_RISK_HIGH",  severity: "critical", title: "Riesgo de disputa elevado" },
      { type: "PAYMENT_BLOCKED",    severity: "high",     title: "Pago bloqueado en milestone 3" },
      { type: "EVIDENCE_GAP",       severity: "high",     title: "Evidencia incompleta en instalación eléctrica" },
    ],
  })
);

// ── FLOW B: Change Order Detection (JSON estructurado) ────────────────────────
banner("Flow B — detectChangeOrderCandidate (JSON estructurado)");
const coResult = await runFlow("ChangeOrderDetector", () =>
  narrative.detectChangeOrderCandidate(
    "Pintar paredes interiores de sala y comedor, 2 manos de pintura blanca.",
    "Oye, también me puedes pintar los closets y reparar esa parte del drywall que está hundida?"
  )
);

// Validate JSON
const coStr = JSON.stringify(coResult);
const jsonOk = coResult !== null && typeof coResult === "object" && "detected" in coResult;
console.log(`   JSON válido    : ${jsonOk ? PASS : FAIL}`);
if (jsonOk) console.log(`   detected       : ${coResult.detected}, risk=${coResult.risk ?? "?"}`);

// ── FLOW C: Evidence Readiness Explanation ────────────────────────────────────
banner("Flow C — explainEvidenceReadiness (narrativa privada)");
await runFlow("EvidenceAnalyzer", () =>
  narrative.explainEvidenceReadiness({
    milestoneTitle:    "Instalación eléctrica rough-in",
    milestoneStatus:   "submitted",
    paymentReadiness:  "not_ready",
    evidenceReadiness: "partial",
    missingLabels:     ["Foto del panel eléctrico", "Confirmación de inspección rough-in"],
    rejectedLabels:    [],
    trade:             "electrical",
  })
);

// ── Summary ───────────────────────────────────────────────────────────────────
banner("Resultado final");

const passed  = results.filter(r => r.ok && r.provider !== "unknown");
const total   = results.length;
const allOllama = passed.every(r => r.provider === "ollama");
const anyFallback = passed.some(r => r.fallback === "true");

for (const r of results) {
  const icon = r.ok ? PASS : FAIL;
  const prov = r.provider === "ollama" ? `${PASS} ollama` : (r.provider === "unknown" ? `${WARN}unknown` : `${FAIL} ${r.provider}`);
  const fb   = r.fallback === "false" ? "fallbackUsed=false" : `${WARN}fallbackUsed=${r.fallback}`;
  console.log(`  ${icon} ${r.label.padEnd(28)} ${prov}  ${fb}  ${r.latency}ms`);
}

console.log(`\n  Flows OK        : ${passed.length}/${total}`);
console.log(`  Todos en Ollama : ${allOllama ? PASS : FAIL} ${allOllama ? "SÍ" : "NO — alguno fue a externo"}`);
console.log(`  fallback usado  : ${anyFallback ? WARN + "SÍ" : PASS + " NO"}`);

// JSON validity for change order
if (coResult !== null) {
  console.log(`  JSON estructurado (changeOrder): ${jsonOk ? PASS + " válido" : FAIL + " inválido"}`);
  if (jsonOk && coResult.detected) {
    console.log(`    → detected=true  title="${coResult.title}"  risk=${coResult.risk}`);
    console.log(`    → suggestedAction="${coResult.suggestedAction}"`);
  } else if (jsonOk) {
    console.log(`    → detected=false (no detectó change order)`);
  }
}

console.log(`\n  Conclusión: ${allOllama && passed.length === total ? PASS + " Ollama opera dentro de flujos reales de SEMSE" : WARN + "Requiere revisión"}`);
console.log("═".repeat(60) + "\n");

// Exit non-zero if any flow failed
if (passed.length < total) process.exit(1);
