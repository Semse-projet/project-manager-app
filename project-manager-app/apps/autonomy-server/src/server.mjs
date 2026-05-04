#!/usr/bin/env node
/**
 * SEMSE Autonomy Server — standalone HTTP wrapper over @semse/autonomy
 * Usage: node apps/autonomy-server/src/server.mjs [--port 4310] [--repo /path]
 * Or via NestJS API: POST /v1/autonomy/runs
 */
import { createServer } from "node:http";
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { randomUUID } from "node:crypto";
import { runAutonomyTask } from "@semse/autonomy";

const portArgIndex = process.argv.indexOf("--port");
const repoArgIndex = process.argv.indexOf("--repo");
const PORT = Number(portArgIndex === -1 ? process.env.AUTONOMY_PORT ?? "4310" : process.argv[portArgIndex + 1]);
const DEFAULT_REPO = repoArgIndex === -1 ? process.cwd() : process.argv[repoArgIndex + 1];
const STATE_PATH = join(process.cwd(), ".semse-autonomy", "runs.json");

function readRuns() {
  try { return JSON.parse(readFileSync(STATE_PATH, "utf8")); } catch { return []; }
}

function writeRuns(runs) {
  mkdirSync(dirname(STATE_PATH), { recursive: true });
  writeFileSync(STATE_PATH, JSON.stringify(runs, null, 2), "utf8");
}

function json(res, status, body) {
  const payload = JSON.stringify(body);
  res.writeHead(status, { "content-type": "application/json", "content-length": Buffer.byteLength(payload), "access-control-allow-origin": "*" });
  res.end(payload);
}

function parseBody(req) {
  return new Promise((resolve, reject) => {
    let raw = "";
    req.on("data", c => { raw += c; });
    req.on("end", () => { try { resolve(JSON.parse(raw || "{}")); } catch { reject(new Error("invalid json")); } });
    req.on("error", reject);
  });
}

const HTML = `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8"><title>SEMSE Autonomy</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: ui-sans-serif, system-ui, sans-serif; background: #0b1020; color: #e2e8f0; display: grid; grid-template-columns: 320px 1fr; min-height: 100vh; }
    aside { background: #0f1730; border-right: 1px solid #1e2d50; padding: 24px; display: flex; flex-direction: column; gap: 16px; }
    main { padding: 24px; overflow: auto; }
    h1 { font-size: 20px; font-weight: 800; color: #fff; }
    h2 { font-size: 14px; font-weight: 700; color: #94a3b8; margin-bottom: 8px; }
    .card { background: #121c38; border: 1px solid #1e2d50; border-radius: 12px; padding: 16px; }
    textarea { width: 100%; background: #0a1329; border: 1px solid #2a3f6e; border-radius: 8px; color: #e2e8f0; padding: 10px; font-size: 13px; resize: vertical; }
    button { width: 100%; padding: 10px; border-radius: 8px; border: none; background: linear-gradient(135deg, #3b82f6, #2563eb); color: #fff; font-weight: 700; font-size: 13px; cursor: pointer; margin-top: 8px; }
    button:disabled { opacity: 0.5; cursor: not-allowed; }
    .run-item { cursor: pointer; padding: 10px; border-radius: 8px; border: 1px solid #1e2d50; background: #0a1329; margin-bottom: 6px; font-size: 12px; }
    .run-item:hover { border-color: #3b82f6; }
    .run-title { font-weight: 700; color: #e2e8f0; }
    .run-branch { color: #64748b; margin-top: 2px; }
    pre { background: #0a1329; border: 1px solid #1e2d50; border-radius: 8px; padding: 14px; font-size: 12px; white-space: pre-wrap; word-break: break-all; color: #94a3b8; min-height: 200px; }
    .badge { display: inline-block; padding: 2px 8px; border-radius: 10px; font-size: 10px; font-weight: 700; background: rgba(59,130,246,.15); color: #60a5fa; }
    label { font-size: 11px; color: #64748b; font-weight: 600; display: block; margin-bottom: 4px; }
    select { width: 100%; background: #0a1329; border: 1px solid #2a3f6e; border-radius: 8px; color: #e2e8f0; padding: 8px; font-size: 12px; margin-bottom: 8px; }
    .status { font-size: 11px; color: #64748b; margin-top: 6px; }
  </style>
</head>
<body>
<aside>
  <div>
    <h1>SEMSE Autonomy</h1>
    <div class="status" id="provider-status">Cargando proveedor...</div>
  </div>
  <div class="card">
    <h2>Nueva tarea</h2>
    <label>TAREA (describe qué implementar)</label>
    <textarea id="task" rows="4" placeholder="add user authentication with JWT"></textarea>
    <label style="margin-top:8px">ETAPA OBJETIVO</label>
    <select id="stage">
      <option value="pr">PR completa</option>
      <option value="commit">Solo commit</option>
      <option value="push">Push sin PR</option>
      <option value="change">Solo cambio</option>
      <option value="branch">Solo rama</option>
    </select>
    <button id="run-btn">▶ Ejecutar tarea autónoma</button>
  </div>
  <div class="card" style="flex:1; overflow:auto;">
    <h2>Runs recientes</h2>
    <div id="runs-list"></div>
  </div>
</aside>
<main>
  <div class="card">
    <h2 id="detail-title">Selecciona o ejecuta un run</h2>
    <pre id="detail"></pre>
  </div>
</main>
<script>
async function loadProvider() {
  try {
    const d = await fetch('/api/provider').then(r => r.json());
    const el = document.getElementById('provider-status');
    el.textContent = d.configured ? '✓ LLM: ' + (d.model || 'configurado') : '⚠ LLM no configurado — set OPENAI_API_KEY o LLM_API_KEY';
    el.style.color = d.configured ? '#10b981' : '#fbbf24';
  } catch {}
}
async function loadRuns() {
  const runs = await fetch('/api/runs').then(r => r.json());
  const el = document.getElementById('runs-list');
  if (!runs.length) { el.innerHTML = '<div style="color:#64748b;font-size:12px">Sin runs aún.</div>'; return; }
  el.innerHTML = runs.map(r => '<div class="run-item" data-id="' + r.runId + '"><div class="run-title">' + r.task.slice(0,48) + '</div><div class="run-branch">' + (r.branchName || '—') + '</div></div>').join('');
  el.querySelectorAll('.run-item').forEach(el => {
    el.addEventListener('click', async () => {
      const data = await fetch('/api/runs/' + el.dataset.id).then(r => r.json());
      document.getElementById('detail-title').textContent = 'Run: ' + data.runId;
      document.getElementById('detail').textContent = JSON.stringify(data, null, 2);
    });
  });
}
document.getElementById('run-btn').addEventListener('click', async () => {
  const task = document.getElementById('task').value.trim();
  const targetStage = document.getElementById('stage').value;
  if (!task) return;
  const btn = document.getElementById('run-btn');
  btn.disabled = true; btn.textContent = 'Ejecutando...';
  document.getElementById('detail').textContent = 'Ejecutando tarea...\\n\\nEspera — el LLM está generando el plan y aplicando el cambio.';
  try {
    const data = await fetch('/api/run', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ task, targetStage }) }).then(r => r.json());
    document.getElementById('detail-title').textContent = 'Run: ' + data.runId;
    document.getElementById('detail').textContent = JSON.stringify(data, null, 2);
    await loadRuns();
  } catch (e) {
    document.getElementById('detail').textContent = 'Error: ' + String(e);
  } finally { btn.disabled = false; btn.textContent = '▶ Ejecutar tarea autónoma'; }
});
loadProvider(); loadRuns();
</script>
</body>
</html>`;

createServer(async (req, res) => {
  const url = req.url ?? "/";

  if (req.method === "OPTIONS") {
    res.writeHead(204, { "access-control-allow-origin": "*", "access-control-allow-headers": "content-type" });
    res.end(); return;
  }

  if (url === "/api/runs" && req.method === "GET") {
    return json(res, 200, readRuns());
  }

  if (url.startsWith("/api/runs/") && req.method === "GET") {
    const runId = url.split("/").pop();
    const match = readRuns().find(r => r.runId === runId);
    return json(res, match ? 200 : 404, match ?? { error: "not_found" });
  }

  if (url === "/api/provider" && req.method === "GET") {
    const llmApiKey = process.env.LLM_API_KEY ?? process.env.OPENAI_API_KEY ?? "";
    const llmModel = process.env.LLM_MODEL ?? process.env.OPENAI_MODEL ?? "";
    const llmBaseUrl = process.env.LLM_BASE_URL ?? process.env.OPENAI_BASE_URL ?? "";
    return json(res, 200, {
      configured: Boolean(llmApiKey && llmModel),
      model: llmModel || null,
      baseUrl: llmBaseUrl || null,
    });
  }

  if (url === "/api/run" && req.method === "POST") {
    let body;
    try { body = await parseBody(req); } catch { return json(res, 400, { error: "invalid_json" }); }
    if (!body.task) return json(res, 400, { error: "missing_task" });

    const runId = randomUUID();
    try {
      const result = await runAutonomyTask(body.task, {
        repoPath: body.repoPath ?? DEFAULT_REPO,
        baseBranch: body.baseBranch,
        targetStage: body.targetStage ?? "pr",
        llmApiKey: process.env.LLM_API_KEY,
        llmModel: process.env.LLM_MODEL,
        llmBaseUrl: process.env.LLM_BASE_URL,
        openAiApiKey: process.env.OPENAI_API_KEY,
        openAiModel: process.env.OPENAI_MODEL,
        openAiBaseUrl: process.env.OPENAI_BASE_URL,
        localPrMode: !process.env.GITHUB_TOKEN,
      });
      const entry = { ...result, runId: result.runId || runId };
      const runs = readRuns();
      runs.unshift(entry);
      writeRuns(runs.slice(0, 50));
      return json(res, 200, entry);
    } catch (error) {
      return json(res, 500, { error: String(error), runId });
    }
  }

  if (url === "/" || url === "/index.html") {
    const buf = Buffer.from(HTML, "utf8");
    res.writeHead(200, { "content-type": "text/html; charset=utf-8", "content-length": buf.length });
    res.end(buf); return;
  }

  json(res, 404, { error: "not_found" });
}).listen(PORT, "127.0.0.1", () => {
  console.log(`SEMSE Autonomy Server at http://127.0.0.1:${PORT}`);
  console.log(`Repo: ${DEFAULT_REPO}`);
  console.log(`LLM: ${process.env.LLM_MODEL || process.env.OPENAI_MODEL || "not configured"}`);
});
