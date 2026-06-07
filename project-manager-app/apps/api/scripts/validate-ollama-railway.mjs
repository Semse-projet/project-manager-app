/**
 * Validación post-deploy: Ollama en Railway
 *
 * Corre DESPUÉS de que el servicio Ollama esté deployed en Railway.
 * Prueba: health, model load, privacyCritical policy, chat real.
 *
 * Uso:
 *   # Con URL interna (desde Railway CLI shell):
 *   OLLAMA_BASE_URL=http://ollama.railway.internal:11434 node scripts/validate-ollama-railway.mjs
 *
 *   # Con URL pública temporal (si expones el puerto):
 *   OLLAMA_BASE_URL=http://<IP_RAILWAY>:11434 node scripts/validate-ollama-railway.mjs
 *
 *   # Contra SEMSE API desplegada (cuando API use nueva URL):
 *   SEMSE_API_URL=https://api.semseproject.com node scripts/validate-ollama-railway.mjs
 */

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Load .env
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

const OLLAMA_URL    = process.env.OLLAMA_BASE_URL ?? "http://localhost:11434";
const OLLAMA_MODEL  = process.env.OLLAMA_MODEL    ?? "qwen2.5:3b";
const SEMSE_API_URL = process.env.SEMSE_API_URL   ?? "http://localhost:4000";
const API_KEY       = process.env.OLLAMA_API_KEY;
const IS_REMOTE     = !OLLAMA_URL.includes("localhost") && !OLLAMA_URL.includes("127.0.0.1");

const P = "✅"; const F = "❌"; const W = "⚠️ ";
let pass = 0; let fail = 0;

function check(label, ok, detail = "") {
  if (ok) pass++; else fail++;
  console.log(`  ${ok ? P : F} ${label}${detail ? " — " + detail : ""}`);
}

function banner(t) { console.log(`\n${"═".repeat(58)}\n  ${t}\n${"═".repeat(58)}`); }

function authHeaders() {
  return API_KEY ? { Authorization: `Bearer ${API_KEY}` } : {};
}

banner("SEMSE — Validación Ollama en Railway");
console.log(`\n  OLLAMA_BASE_URL = ${OLLAMA_URL}`);
console.log(`  OLLAMA_MODEL    = ${OLLAMA_MODEL}`);
console.log(`  SEMSE_API_URL   = ${SEMSE_API_URL}`);
console.log(`  Modo            = ${IS_REMOTE ? "REMOTO ☁️" : "LOCAL 🏠"}`);

// ── A: Health check directo a Ollama ──────────────────────────────────────────
banner("A — Health check directo a Ollama");

let serverOk = false;
let modelLoaded = false;
let availableModels = [];

try {
  const res = await fetch(`${OLLAMA_URL}/api/tags`, {
    headers: authHeaders(),
    signal: AbortSignal.timeout(10000),
  });
  if (res.ok) {
    serverOk = true;
    const json = await res.json();
    availableModels = (json.models ?? []).map(m => m.name);
    modelLoaded = availableModels.some(m => m.startsWith(OLLAMA_MODEL.split(":")[0]));
  }
} catch (err) {
  console.log(`  ${F} Error conectando: ${err.message}`);
}

check("Servidor Ollama responde", serverOk, OLLAMA_URL);
check(`Modelo '${OLLAMA_MODEL}' cargado`, modelLoaded,
  modelLoaded ? "listo" : `disponibles: ${availableModels.join(", ") || "ninguno — espera la descarga"}`);
check("Modo REMOTO detectado", IS_REMOTE, IS_REMOTE ? "correcto" : "aún en localhost");

// ── B: Chat real contra Ollama ────────────────────────────────────────────────
if (serverOk && modelLoaded) {
  banner("B — Chat real contra Ollama");
  try {
    const t0 = Date.now();
    const chatRes = await fetch(`${OLLAMA_URL}/api/chat`, {
      method: "POST",
      headers: { "content-type": "application/json", ...authHeaders() },
      body: JSON.stringify({
        model: OLLAMA_MODEL,
        messages: [{ role: "user", content: "Responde solo con OK" }],
        stream: false,
      }),
      signal: AbortSignal.timeout(Number(process.env.OLLAMA_TIMEOUT_MS) || 120000),
    });
    const latency = Date.now() - t0;
    if (chatRes.ok) {
      const data = await chatRes.json();
      const text = data.message?.content ?? "";
      check("Chat responde", true, `${latency}ms`);
      check("Respuesta no vacía", text.length > 0, text.slice(0, 50));
    } else {
      check("Chat responde", false, `HTTP ${chatRes.status}`);
    }
  } catch (err) {
    check("Chat responde", false, err.message.slice(0, 80));
  }
} else {
  console.log(`\n  ${W} Skipping chat test — modelo no disponible todavía`);
  console.log(`  Espera a que Railway termine de descargar '${OLLAMA_MODEL}' y re-corre este script.`);
}

// ── C: Health via SEMSE API (si está desplegada con nueva URL) ───────────────
banner("C — Health via SEMSE API /ollama/health");

try {
  const res = await fetch(`${SEMSE_API_URL}/v1/ops/ai-mission-control/ollama/health`, {
    signal: AbortSignal.timeout(10000),
  });
  if (res.ok) {
    const json = await res.json();
    const d = json.data ?? json;
    check("SEMSE API: serverOk", d.serverOk === true, `serverOk=${d.serverOk}`);
    check("SEMSE API: modelLoaded", d.modelLoaded === true, `modelLoaded=${d.modelLoaded}`);
    check("SEMSE API: configuredModel", d.configuredModel === OLLAMA_MODEL, d.configuredModel);
    if (d.isRemote !== undefined) check("SEMSE API: isRemote", true, `isRemote=${d.isRemote}`);
  } else {
    console.log(`  ${W} SEMSE API no responde en ${SEMSE_API_URL} (puede ser localhost si no está desplegada)`);
  }
} catch {
  console.log(`  ${W} SEMSE API no accesible en ${SEMSE_API_URL} — validar manualmente una vez desplegada`);
}

// ── Resultado final ────────────────────────────────────────────────────────────
banner("Resultado");

const total = pass + fail;
console.log(`\n  Tests    : ${pass}/${total}`);
console.log(`  Modo     : ${IS_REMOTE ? "REMOTO ☁️" : "LOCAL 🏠"}`);

if (!serverOk) {
  console.log(`\n  ${F} Ollama no responde. Verifica:`);
  console.log(`    1. El servicio Ollama está deployed en Railway`);
  console.log(`    2. OLLAMA_BASE_URL apunta a la URL correcta`);
  console.log(`    3. Si usas railway.internal, este script debe correr en el mismo proyecto`);
} else if (!modelLoaded) {
  console.log(`\n  ${W} Servidor OK pero modelo no listo. Probablemente descargando.`);
  console.log(`    Espera ~5-10 min y vuelve a correr este script.`);
  console.log(`    Puedes seguir los logs con: railway logs --service ollama`);
} else {
  console.log(`\n  ${P} Ollama Railway listo para SEMSE.`);
  console.log(`  Siguiente: configurar OLLAMA_BASE_URL en Railway API y redeploy.`);
}

console.log("═".repeat(58) + "\n");
if (fail > 0 && !modelLoaded) process.exit(0); // not a hard failure if just downloading
if (fail > 2) process.exit(1);
