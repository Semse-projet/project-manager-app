import test from "node:test";
import http from "node:http";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import assert from "node:assert/strict";
import { evaluateProvenance, toMarkdown } from "../../scripts/verify-deploy-provenance.mjs";

const good = { gitSha: "754030f787c9d8abab6a965889b30cbb8c60175f", deploymentId: "d1", environment: "production", imageDigest: "sha256:abc" };

test("coincide solo con el sha completo exacto (sin prefijos)", () => {
  assert.equal(evaluateProvenance(good, { expectSha: good.gitSha }).ok, true);
  assert.equal(evaluateProvenance(good, { expectSha: good.gitSha.toUpperCase() }).ok, true);
  assert.equal(evaluateProvenance(good, { expectSha: "754030f" }).ok, false);
  // un sha reportado abreviado tampoco pasa contra el esperado completo (ni al reves)
  assert.equal(evaluateProvenance({ ...good, gitSha: "7" }, { expectSha: good.gitSha }).ok, false);
});
test("sha distinto => falla", () => {
  const r = evaluateProvenance(good, { expectSha: "aecbd8d" });
  assert.equal(r.ok, false);
  assert.match(r.problems[0], /esperado/);
});
test("unknown nunca pasa; digest solo con --allow-unknown-digest", () => {
  const u = { ...good, gitSha: "unknown", deploymentId: "unknown" };
  assert.equal(evaluateProvenance(u, { expectSha: good.gitSha }).problems.length, 2);
  const d = { ...good, imageDigest: "unknown" };
  assert.equal(evaluateProvenance(d, { expectSha: good.gitSha }).ok, false);
  const tolerated = evaluateProvenance(d, { expectSha: good.gitSha, allowUnknownDigest: true });
  assert.equal(tolerated.ok, true);
  assert.deepEqual(tolerated.warnings, ["imageDigest desconocido (tolerado)"]);
  assert.match(toMarkdown("api", tolerated, 200), /✅ coincide — 🟡 imageDigest desconocido/);
});

test("acepta la forma {data:{...}} del healthz de la web", () => {
  const web = { data: { status: "ok", service: "semse-web", ...good } };
  assert.equal(evaluateProvenance(web, { expectSha: good.gitSha }).ok, true);
  assert.equal(evaluateProvenance(web, { expectSha: "deadbeef" }).ok, false);
});
test("markdown informativo: muestra coincidencia o el motivo de la discrepancia", () => {
  const ok = toMarkdown("api", evaluateProvenance(good, { expectSha: good.gitSha }), 200);
  assert.match(ok, /✅ coincide/);
  const bad = toMarkdown("api", evaluateProvenance({ ...good, gitSha: "unknown" }, { expectSha: good.gitSha }), 200);
  assert.match(bad, /⚠️/);
  assert.match(bad, /gitSha desconocido/);
});

// --- CLI: el gate usa el exit code; aqui se prueba contra un servidor real local ---
const script = fileURLToPath(new URL("../../scripts/verify-deploy-provenance.mjs", import.meta.url));
function runCli(url, sha, extra = []) {
  // asincrono: el servidor de la prueba vive en este mismo proceso y no puede bloquearse
  return new Promise((resolve) => {
    const child = spawn(process.execPath, [script, `--url=${url}`, `--expect-sha=${sha}`, "--allow-unknown-digest", "--retries=1", ...extra]);
    let stdout = "";
    child.stdout.on("data", (d) => { stdout += d; });
    const timer = setTimeout(() => child.kill("SIGKILL"), 20000);
    child.on("close", (status) => { clearTimeout(timer); resolve({ status, stdout }); });
  });
}
function withServer(handler, fn) {
  return new Promise((resolve, reject) => {
    const srv = http.createServer(handler);
    srv.listen(0, "127.0.0.1", async () => {
      try { resolve(await fn(`http://127.0.0.1:${srv.address().port}`)); } catch (e) { reject(e); } finally { srv.close(); }
    });
  });
}
const json = (code, body) => (_req, res) => { res.writeHead(code, { "content-type": "application/json" }); res.end(JSON.stringify(body)); };

test("CLI: coincidencia exacta con digest unknown => exit 0 (warning)", async () => {
  await withServer(json(200, { status: "ok", ...good, imageDigest: "unknown" }), async (url) => {
    const r = await runCli(url, good.gitSha, ["--markdown"]);
    assert.equal(r.status, 0);
    assert.match(r.stdout, /🟡/);
  });
});
test("CLI: gitSha distinto => exit 1", async () => {
  await withServer(json(200, { status: "ok", ...good }), async (url) => {
    const r = await runCli(url, "f".repeat(40));
    assert.equal(r.status, 1);
  });
});
test("CLI: deploymentId ausente => exit 1", async () => {
  await withServer(json(200, { status: "ok", gitSha: good.gitSha, environment: "production" }), async (url) => {
    assert.equal((await runCli(url, good.gitSha)).status, 1);
  });
});
test("CLI: health responde 503 => exit 1 aunque el cuerpo coincida", async () => {
  await withServer(json(503, { status: "down", ...good }), async (url) => {
    assert.equal((await runCli(url, good.gitSha)).status, 1);
  });
});
test("CLI: servicio caido (sin respuesta) => exit 1, nunca se acepta procedencia desconocida", async () => {
  const r = await runCli("http://127.0.0.1:9", good.gitSha);
  assert.equal(r.status, 1);
});

test("markdown: HTTP no 2xx nunca se muestra como coincide, aunque el cuerpo coincida", () => {
  const md = toMarkdown("api", evaluateProvenance(good, { expectSha: good.gitSha }), 503);
  assert.doesNotMatch(md, /✅/);
  assert.match(md, /⚠️ HTTP 503/);
});
test("markdown: la advertencia del digest se conserva aunque el sha no coincida", () => {
  const r = evaluateProvenance({ ...good, imageDigest: "unknown" }, { expectSha: "f".repeat(40), allowUnknownDigest: true });
  assert.equal(r.ok, false);
  const md = toMarkdown("api", r, 200);
  assert.match(md, /⚠️ gitSha .* != esperado/);
  assert.match(md, /🟡 imageDigest desconocido/);
});
test("CLI: health que envia cabeceras y deja el cuerpo abierto => timeout por intento y exit 1 (no se cuelga)", async () => {
  await withServer((_req, res) => { res.writeHead(200, { "content-type": "application/json" }); res.write('{"gitSha":'); /* nunca termina */ }, async (url) => {
    const t0 = Date.now();
    const r = await runCli(url, good.gitSha, ["--timeout=1"]);
    assert.equal(r.status, 1);
    assert.ok(Date.now() - t0 < 10000, "debe terminar por el plazo, no esperar indefinidamente");
  });
});
