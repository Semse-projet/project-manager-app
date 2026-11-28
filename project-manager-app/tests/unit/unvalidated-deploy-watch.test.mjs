// C4 / G-R06: la alarma informa de TODOS los servicios que sirven el SHA
// vigilado, no solo del primero (incidente 9e2f87f1: solo informó de la API).
import test from "node:test";
import assert from "node:assert/strict";
import http from "node:http";
import { aggregate, extractGitSha, round } from "../../scripts/unvalidated-deploy-watch.mjs";

const BAD = "9e2f87f134cf790c86362eabdb33b68c73f6679e";
const GOOD = "0ae2c319bece1230a1679fee6f840037f691ba7e";

function serve(payload) {
  return new Promise((resolve) => {
    const srv = http.createServer((_req, res) => {
      res.setHeader("content-type", "application/json");
      res.end(JSON.stringify(payload));
    });
    srv.listen(0, "127.0.0.1", () => resolve(srv));
  });
}
const base = (srv) => `http://127.0.0.1:${srv.address().port}`;

test("extrae gitSha de {data:{gitSha}} y de {gitSha}", () => {
  assert.equal(extractGitSha({ data: { gitSha: BAD } }), BAD);
  assert.equal(extractGitSha({ gitSha: BAD.toUpperCase() }), BAD);
  assert.equal(extractGitSha(null), "unknown");
});

test("aggregate devuelve todos los aciertos", () => {
  const r = aggregate(BAD, [
    { label: "semse-API", gitSha: BAD },
    { label: "semse-web", gitSha: BAD },
    { label: "otro", gitSha: GOOD },
  ]);
  assert.deepEqual(r.hits, ["semse-API", "semse-web"]);
});

test("ronda real: API y Web sirven el SHA rojo -> se reportan ambos", async () => {
  const api = await serve({ data: { status: "ok", gitSha: BAD } });
  const web = await serve({ gitSha: BAD });
  try {
    const r = await round(BAD, [
      { label: "semse-API", base: base(api), path: "/v1/health" },
      { label: "semse-web", base: base(web), path: "/api/semse/healthz" },
    ]);
    assert.deepEqual(r.hits.sort(), ["semse-API", "semse-web"]);
  } finally {
    api.close();
    web.close();
  }
});

test("objetivo caído cuenta como unknown, nunca como acierto ni como limpio confirmado", async () => {
  const r = await round(BAD, [{ label: "caido", base: "http://127.0.0.1:9", path: "/x" }], { timeoutMs: 500 });
  assert.deepEqual(r.hits, []);
  assert.equal(r.observations[0].gitSha, "unknown");
});

test("la alarma usa un plazo de reloj y avisa en la primera coincidencia", async () => {
  // Revisión del PR #1196: con una sonda que agota su timeout, 80 rondas
  // superaban el límite del job y el aviso se perdía.
  const { readFileSync } = await import("node:fs");
  const { fileURLToPath } = await import("node:url");
  const wf = readFileSync(fileURLToPath(new URL("../../../.github/workflows/production-unvalidated-deploy-alarm.yml", import.meta.url)), "utf8");
  assert.doesNotMatch(wf, /for _ in \$\(seq 1 /);
  assert.match(wf, /deadline=\$\(\(SECONDS \+ 1200\)\)/);
  assert.match(wf, /deadline=\$\(\(SECONDS \+ 2400\)\)/);
  assert.match(wf, /::error title=Despliegue no validado::\$label sirve/);
  assert.match(wf, /::error title=Servido antes de CI::\$label sirve/);
});

test("served-before-ci revalida el CI después de observar el SHA", async () => {
  // Revisión del PR #1196: un estado leído antes de las sondas podía estar viejo
  // y producir una falsa alarma si el CI terminaba entretanto.
  const { readFileSync } = await import("node:fs");
  const { fileURLToPath } = await import("node:url");
  const wf = readFileSync(fileURLToPath(new URL("../../../.github/workflows/production-unvalidated-deploy-alarm.yml", import.meta.url)), "utf8");
  const job = wf.slice(wf.indexOf("served-before-ci:"));
  const probe = job.indexOf("unvalidated-deploy-watch.mjs --sha=");
  const recheck = job.indexOf("read -r status2");
  assert.ok(probe > 0 && recheck > probe, "el CI se vuelve a consultar después de la sonda");
  assert.match(job, /if \[ "\$status2" != "completed" \]; then/);
});
