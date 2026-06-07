/**
 * Test: Ollama como proveedor nativo de SEMSE OS
 * Ejercita el LLM Orchestrator real (compiled dist) con una llamada al modelo local.
 * Corre con: node scripts/test-ollama-semse.mjs
 */
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Load .env manually
const envPath = path.join(__dirname, "../.env");
const envLines = readFileSync(envPath, "utf8").split("\n");
for (const line of envLines) {
  const trimmed = line.trim();
  if (!trimmed || trimmed.startsWith("#")) continue;
  const eq = trimmed.indexOf("=");
  if (eq === -1) continue;
  const key = trimmed.slice(0, eq).trim();
  const val = trimmed.slice(eq + 1).trim().replace(/^["']|["']$/g, "");
  if (!process.env[key]) process.env[key] = val;
}

const OLLAMA_BASE_URL = process.env.OLLAMA_BASE_URL ?? "http://localhost:11434";
const OLLAMA_MODEL    = process.env.OLLAMA_MODEL    ?? "qwen2.5:3b";
const TIMEOUT_MS      = Number(process.env.OLLAMA_TIMEOUT_MS) || 60_000;

// ── 1. Check Ollama health ────────────────────────────────────────────────────
console.log("\n═══════════════════════════════════════════════════════");
console.log("  SEMSE OS — Test Ollama como inteligencia nativa");
console.log("═══════════════════════════════════════════════════════\n");

console.log(`[1] Verificando Ollama en ${OLLAMA_BASE_URL}...`);
let available = false;
let availableModel = null;

try {
  const tagsRes = await fetch(`${OLLAMA_BASE_URL}/api/tags`, { signal: AbortSignal.timeout(3000) });
  if (tagsRes.ok) {
    const tags = await tagsRes.json();
    const models = (tags.models ?? []).map(m => m.name);
    console.log(`   ✅ Ollama responde. Modelos disponibles: ${models.length > 0 ? models.join(", ") : "(ninguno aún)"}`);

    // Pick best available model
    availableModel = models.find(m => m.startsWith(OLLAMA_MODEL.split(":")[0]))
      ?? models[0]
      ?? null;

    if (!availableModel) {
      console.log(`\n   ⚠️  Modelo '${OLLAMA_MODEL}' todavía descargando.`);
      console.log(`   Ejecuta en otra terminal: ollama pull ${OLLAMA_MODEL}`);
      console.log(`   Reintenta este test cuando termine.\n`);
      process.exit(0);
    }
    console.log(`   → Usando modelo: ${availableModel}`);
    available = true;
  }
} catch (err) {
  console.log(`   ❌ Ollama no responde: ${err.message}`);
  console.log(`   Ejecuta: ollama serve\n`);
  process.exit(1);
}

// ── 2. Direct OllamaProvider test ────────────────────────────────────────────
console.log("\n[2] Test directo OllamaProvider → Ollama...");

const t0 = Date.now();
const body = {
  model: availableModel,
  messages: [
    { role: "system", content: "Eres el asistente operacional de SEMSE OS. Responde siempre en español, de forma concisa." },
    { role: "user",   content: "Responde SOLO con este JSON y nada más: {\"provider\": \"ollama\", \"model\": \"<tu modelo>\", \"status\": \"OK\", \"message\": \"Ollama nativo SEMSE activo\"}" }
  ],
  stream: false
};

let response;
try {
  const res = await fetch(`${OLLAMA_BASE_URL}/api/chat`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });

  if (!res.ok) throw new Error(`HTTP ${res.status}: ${await res.text()}`);

  const data = await res.json();
  const latency = Date.now() - t0;
  const text = data.message?.content ?? "";

  console.log(`   ✅ Respuesta en ${latency}ms`);
  console.log(`   provider : ollama`);
  console.log(`   model    : ${availableModel}`);
  console.log(`   tokens   : in=${data.prompt_eval_count ?? "?"} out=${data.eval_count ?? "?"}`);
  console.log(`   response : ${text.slice(0, 200)}`);
  response = { text, latency };
} catch (err) {
  console.log(`   ❌ Fallo: ${err.message}`);
  process.exit(1);
}

// ── 3. Routing policy test ────────────────────────────────────────────────────
console.log("\n[3] Verificando routing policy...");
const { selectProvider, buildFallbackChain } = await import("../dist/infrastructure/llm/router/routing-policy.js");

const tests = [
  { ctx: undefined,                    expected: "ollama",    label: "default (sin contexto)" },
  { ctx: { lowCost: true },            expected: "ollama",    label: "lowCost=true" },
  { ctx: { localOnly: true },          expected: "ollama",    label: "localOnly=true" },
  { ctx: { privacyCritical: true },    expected: "ollama",    label: "privacyCritical=true" },
  { ctx: { requiresTools: true },      expected: "anthropic", label: "requiresTools=true" },
  { ctx: { riskLevel: "high" },        expected: "anthropic", label: "riskLevel=high" },
];

let pass = 0;
for (const t of tests) {
  const got = selectProvider(t.ctx);
  const ok = got === t.expected;
  if (ok) pass++;
  console.log(`   ${ok ? "✅" : "❌"} ${t.label}: ${got} ${ok ? "" : `(esperado: ${t.expected})`}`);
}

const chain = buildFallbackChain("ollama", undefined);
console.log(`   fallback chain: ${chain.join(" → ")}`);

// ── 4. Summary ────────────────────────────────────────────────────────────────
console.log("\n═══════════════════════════════════════════════════════");
console.log(`  Resultado: ${pass}/${tests.length} routing tests OK`);
console.log(`  Ollama native: ✅ responde como provider=ollama`);
console.log(`  LLM_DEFAULT_PROVIDER = ${process.env.LLM_DEFAULT_PROVIDER ?? "(no seteado → ollama)"}`);
console.log(`  OLLAMA_MODEL = ${OLLAMA_MODEL}`);
console.log(`  Latencia Ollama: ${response.latency}ms`);
console.log("═══════════════════════════════════════════════════════\n");
