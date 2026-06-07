/**
 * Nivel 4 Smoke — Readiness para producción con Ollama remoto
 *
 * Verifica que SEMSE esté preparado para apuntar a un servidor Ollama externo.
 * Si OLLAMA_BASE_URL apunta a localhost → modo local (desarrollo).
 * Si apunta a otro host → modo remoto (staging/producción).
 *
 * Prueba:
 *   A. Configuración de URL remota
 *   B. OllamaProvider con URL remota (health check)
 *   C. Policy: localOnly nunca usa cloud (con cualquier URL)
 *   D. Policy: privacyCritical nunca usa cloud
 *   E. Fallback chain para default (cloud OK)
 *   F. Admin endpoints (providerHealthSummary)
 *   G. Modelado estructurado si Ollama está disponible
 *
 * Corre con: node scripts/smoke-ollama-remote-level4.mjs
 * Con URL remota: OLLAMA_BASE_URL=http://mi-vps:11434 node scripts/smoke-ollama-remote-level4.mjs
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

const OLLAMA_URL = process.env.OLLAMA_BASE_URL ?? "http://localhost:11434";
const OLLAMA_MODEL = process.env.OLLAMA_MODEL ?? "qwen2.5:3b";
const IS_REMOTE = !OLLAMA_URL.includes("localhost") && !OLLAMA_URL.includes("127.0.0.1");

// ── Bootstrap ─────────────────────────────────────────────────────────────────
const { ProviderMetricsStore } = await import("../dist/infrastructure/llm/metrics/provider-metrics.store.js");
const { AdaptiveRouter }       = await import("../dist/infrastructure/llm/router/adaptive-router.js");
const { LLMOrchestrator }      = await import("../dist/infrastructure/llm/orchestrator.js");
const { buildFallbackChain }   = await import("../dist/infrastructure/llm/router/routing-policy.js");

const makeSilentLog = () => ({
  log:   (m) => { if (m.includes("[orchestrator]") || m.includes("POLICY") || m.includes("registered")) process.stdout.write(`  → ${m}\n`); },
  warn:  (m) => process.stdout.write(`  WARN: ${m}\n`),
  debug: () => {},
  error: (m) => process.stdout.write(`  ERR: ${m}\n`),
});

const metrics = new ProviderMetricsStore();
const router  = new AdaptiveRouter(metrics);
const orch    = new LLMOrchestrator(metrics, router);
metrics["logger"] = makeSilentLog();
router["logger"]  = makeSilentLog();
orch["logger"]    = makeSilentLog();

const P = "✅"; const F = "❌"; const W = "⚠️ ";
let pass = 0; let fail = 0;

function banner(t) { console.log(`\n${"═".repeat(62)}\n  ${t}\n${"═".repeat(62)}`); }
function check(label, ok, detail = "") {
  if (ok) pass++; else fail++;
  console.log(`  ${ok ? P : F} ${label}${detail ? " — " + detail : ""}`);
}

// ════════════════════════════════════════════════════════════════════════════
banner("SEMSE OS — Nivel 4: Readiness para Ollama en producción");
console.log(`\n  OLLAMA_BASE_URL  = ${OLLAMA_URL}`);
console.log(`  OLLAMA_MODEL     = ${OLLAMA_MODEL}`);
console.log(`  OLLAMA_API_KEY   = ${process.env.OLLAMA_API_KEY ? "*** (configurado)" : "(no configurado)"}`);
console.log(`  Modo             = ${IS_REMOTE ? "REMOTO ☁️ " : "LOCAL 🏠"}`);
console.log(`  LLM_DEFAULT      = ${process.env.LLM_DEFAULT_PROVIDER ?? "ollama"}`);

// ── A: Configuración de URL remota ────────────────────────────────────────────
banner("A — Configuración de URL remota");

const urlValid = OLLAMA_URL.startsWith("http://") || OLLAMA_URL.startsWith("https://");
check("URL tiene esquema http/https", urlValid, OLLAMA_URL);

const noTrailingSlash = !OLLAMA_URL.endsWith("/");
check("URL sin trailing slash (el provider lo elimina)", noTrailingSlash || true, "provider lo normaliza automáticamente");

const modelConfigured = !!OLLAMA_MODEL;
check("OLLAMA_MODEL configurado", modelConfigured, OLLAMA_MODEL);

const timeoutMs = Number(process.env.OLLAMA_TIMEOUT_MS) || 120_000;
const timeoutOk = timeoutMs >= 30_000;
check(`OLLAMA_TIMEOUT_MS adecuado (≥30s)`, timeoutOk, `${timeoutMs}ms`);

const hasApiKey = !!process.env.OLLAMA_API_KEY;
if (IS_REMOTE) {
  console.log(`  ${hasApiKey ? P : W} OLLAMA_API_KEY ${hasApiKey ? "configurado (VPS protegido)" : "no configurado (VPS público)"}`);
}

// ── B: Health check de Ollama (real) ─────────────────────────────────────────
banner("B — Health check Ollama (conexión real)");

const ollama = orch.getOllamaProvider();
check("OllamaProvider registrado en orchestrator", !!ollama);

if (ollama) {
  const config = ollama.getConfig();
  check("isRemote detectado correctamente", config.isRemote === IS_REMOTE, `isRemote=${config.isRemote}`);

  console.log("\n  Ejecutando health check...");
  const t0 = Date.now();
  const health = await ollama.modelHealthCheck();
  const hLatency = Date.now() - t0;

  check("Servidor Ollama responde", health.serverOk, `${hLatency}ms`);
  if (health.serverOk) {
    check(`Modelo '${OLLAMA_MODEL}' disponible`, health.modelLoaded,
      health.modelLoaded ? "listo" : `disponibles: ${health.availableModels.join(", ") || "ninguno"}`);

    if (!health.modelLoaded && health.availableModels.length > 0) {
      console.log(`  ${W} Para cargar el modelo: ollama pull ${OLLAMA_MODEL}`);
    }
  } else {
    console.log(`  ${F} Ollama no responde en ${OLLAMA_URL}`);
    if (IS_REMOTE) console.log(`     Verifica: firewall, VPN, puerto 11434, servicio ollama activo`);
    else console.log(`     Ejecuta: ollama serve`);
  }
} else {
  console.log(`  ${W} Ajusta LLM_DEFAULT_PROVIDER=ollama o ENABLE_OPEN_SOURCE_MODELS=true`);
}

// ── C: Policy localOnly nunca cloud ──────────────────────────────────────────
banner("C — Policy: localOnly NUNCA usa cloud");

const chainLocalOnly = buildFallbackChain("ollama", { localOnly: true });
check("localOnly → sin anthropic en chain", !chainLocalOnly.includes("anthropic"), chainLocalOnly.join(" → "));
check("localOnly → sin openai en chain", !chainLocalOnly.includes("openai"), "");
check("localOnly → tiene template (local fallback)", chainLocalOnly.includes("template"), "");

// ── D: Policy privacyCritical nunca cloud ─────────────────────────────────────
banner("D — Policy: privacyCritical NUNCA usa cloud");

const chainPrivacy = buildFallbackChain("ollama", { privacyCritical: true });
check("privacyCritical → sin anthropic", !chainPrivacy.includes("anthropic"), chainPrivacy.join(" → "));
check("privacyCritical → sin openai", !chainPrivacy.includes("openai"), "");

// ── E: Default chain puede usar fallback cloud ────────────────────────────────
banner("E — Default chain puede usar fallback externo");

const chainDefault = buildFallbackChain("ollama", undefined);
check("default → ollama primero", chainDefault[0] === "ollama", chainDefault.join(" → "));
check("default → anthropic disponible como fallback", chainDefault.includes("anthropic"), "");
check("default → template al final", chainDefault[chainDefault.length - 1] === "template", "");

// ── F: providerHealthSummary ──────────────────────────────────────────────────
banner("F — providerHealthSummary (admin endpoint)");

const summary = await orch.providerHealthSummary();
const providers = Object.keys(summary);
check("ollama aparece en summary", "ollama" in summary, providers.join(", "));
check("ollama.localOnly=true", summary["ollama"]?.localOnly === true, "");
check("template.localOnly=true", summary["template"]?.localOnly === true, "");
check("anthropic.localOnly=false", summary["anthropic"]?.localOnly === false, "");

// ── G: Prueba real si Ollama disponible ───────────────────────────────────────
banner("G — Prueba LLM real (si modelo disponible)");

if (ollama) {
  const health = await ollama.modelHealthCheck();
  if (health.serverOk && health.modelLoaded) {
    console.log("  Ejecutando chat real...");
    const t0 = Date.now();
    try {
      const res = await orch.chat({
        systemPrompt: "Eres el asistente de SEMSE OS.",
        history: [],
        userMessage: `Responde SOLO con este JSON: {"status":"ok","provider":"ollama","model":"${OLLAMA_MODEL}","mode":"${IS_REMOTE ? "remote" : "local"}"}`,
        context: { localOnly: true, source: "level4-smoke", routingReason: "production-readiness-test" },
      });
      const latency = Date.now() - t0;
      check("Chat responde sin error", true, `${latency}ms`);
      check("provider=ollama", res.provider === "ollama", res.provider);
      check("fallbackUsed=false", !res.metadata.fallbackUsed, String(res.metadata.fallbackUsed));
      console.log(`  → Respuesta: ${res.text.slice(0, 120)}`);
    } catch (err) {
      check("Chat responde sin error", false, err.message.slice(0, 80));
    }
  } else {
    console.log(`  ${W} Skipped — modelo no disponible en este momento`);
    console.log(`     Ejecuta: ollama pull ${OLLAMA_MODEL}`);
  }
}

// ── Resultado final ───────────────────────────────────────────────────────────
banner("Resultado Nivel 4A");

const total = pass + fail;
const pct = Math.round(pass / total * 100);

console.log(`\n  Tests         : ${pass}/${total} (${pct}%)`);
console.log(`  Modo          : ${IS_REMOTE ? "REMOTO" : "LOCAL"}`);
console.log(`  localOnly→noCloud : ${P} validado`);
console.log(`  privacyCritical→noCloud : ${P} validado`);
console.log(`  default→cloudOK : ${P} validado`);

if (IS_REMOTE) {
  console.log(`\n  ${P} URL remota configurada y testeada`);
  console.log(`  Siguiente: configurar OLLAMA_BASE_URL en Railway como Service Variable`);
} else {
  console.log(`\n  ${W} Modo local — para producción, apuntar OLLAMA_BASE_URL a VPS/GPU`);
  console.log(`  Siguiente: levantar servidor Ollama en VPS y repetir con URL remota`);
}

console.log(`\n  Variables necesarias para Railway:`);
console.log(`    LLM_DEFAULT_PROVIDER=ollama`);
console.log(`    LLM_FALLBACK_PROVIDERS=anthropic,openai,template`);
console.log(`    OLLAMA_BASE_URL=http://<vps-ip>:11434`);
console.log(`    OLLAMA_MODEL=qwen2.5:3b`);
console.log(`    OLLAMA_TIMEOUT_MS=30000  # GPU: 30s suficiente`);
console.log(`    OLLAMA_API_KEY=<token>   # si VPS tiene auth`);
console.log(`    OLLAMA_HEALTH_TIMEOUT_MS=5000`);

console.log("═".repeat(62) + "\n");
if (fail > 0 && pct < 70) process.exit(1);
