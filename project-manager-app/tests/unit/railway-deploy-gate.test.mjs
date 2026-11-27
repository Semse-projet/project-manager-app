// G-R04 (unit, estático): el release nunca puede quedar en verde sin
// credencial, y la guardia forward-only corre antes de disparar el build.
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const wf = readFileSync(
  fileURLToPath(new URL("../../../.github/workflows/railway-deploy.yml", import.meta.url)),
  "utf8",
);
const deployJob = wf.slice(wf.indexOf("\n  deploy:\n"), wf.indexOf("\n  health-check:\n"));

test("ningún paso del job deploy usa continue-on-error", () => {
  assert.doesNotMatch(deployJob, /continue-on-error:\s*true/);
});

test("la credencial se exige antes de la guardia y la guardia antes del build", () => {
  const cred = deployJob.indexOf("Require Railway credential");
  const guard = deployJob.indexOf("Forward-only guard");
  const build = deployJob.indexOf("Deploy exact commit to Railway");
  assert.ok(cred > 0 && guard > cred && build > guard, "orden: credencial -> guardia -> build");
  assert.match(deployJob, /if: steps\.forward-guard\.outputs\.action == 'deploy'/);
});

test("Worker y Vision se verifican sin depender del resultado del token", () => {
  assert.doesNotMatch(wf, /token_deploy/);
  assert.match(wf, /26cd1c52-1a07-4f05-8b21-9a225e601d7a/); // worker
  assert.match(wf, /63a901e8-189e-4748-97f7-b7e60e628ee2/); // vision
});

test("el gate no cede la verificación solo porque main avanzó", () => {
  assert.doesNotMatch(wf, /main avanzó a \$head_sha durante la espera/);
});

test("el deploy pide el commit exacto: serviceInstanceDeployV2(commitSha) sin latestCommit", () => {
  // QA G-R02 (27-nov-2026): latestCommit:true + commitSha construyó otro commit.
  assert.doesNotMatch(deployJob, /latestCommit/);
  assert.match(deployJob, /serviceInstanceDeployV2\(serviceId:\$s, environmentId:\$e, commitSha:\$c\)/);
});

test("el preflight de migraciones destructivas corre tras la guardia y antes del build", () => {
  // QA G-R05 (27-nov-2026): revertir el código no revierte la base.
  const guard = deployJob.indexOf("Forward-only guard");
  const pre = deployJob.indexOf("Destructive migration preflight");
  const build = deployJob.indexOf("Deploy exact commit to Railway");
  assert.ok(pre > guard && build > pre, "orden: guardia -> preflight -> build");
  assert.match(deployJob, /migration-destructive-preflight\.mjs/);
  assert.match(deployJob, /--served="\$SERVED_SHA" --candidate="\$DEPLOY_SHA"/);
  assert.doesNotMatch(deployJob, /filter: blob:none/);
});

test("el Worker se verifica en runtime por su log de arranque", () => {
  // QA G-R06 (27-nov-2026): el log startup del Worker informa gitSha y deploymentId.
  assert.match(wf, /Worker runtime provenance \(startup log, blocking\)/);
  assert.match(wf, /verify-worker-startup-log\.mjs --expect-sha="\$DEPLOY_SHA" --deployment-id="\$wdep"/);
  assert.match(wf, /@label:startup/);
});

test("el deploy decide por servicio y no se salta servicios rezagados (revisión de #1199)", () => {
  const step = deployJob.slice(deployJob.indexOf("Deploy exact commit to Railway"));
  // Corre también cuando la API ya sirve el candidato (repetir un release parcial).
  assert.match(deployJob, /Deploy exact commit to Railway \(fresh build\)\n\s+if: steps\.forward-guard\.outputs\.action == 'deploy' \|\| steps\.forward-guard\.outputs\.action == 'already_served'/);
  // La guardia se evalúa contra el último deployment SUCCESS de cada servicio.
  const guardIdx = step.indexOf("release-forward-guard.mjs");
  const deployIdx = step.indexOf("serviceInstanceDeployV2");
  assert.ok(guardIdx > 0 && deployIdx > guardIdx, "guardia por servicio antes de la mutación");
  assert.match(step, /already_served\)\s*\n\s*echo "Servicio \$svc ya sirve/);
  // Cualquier otro resultado (servicio por delante, divergente o desconocido)
  // bloquea, y se decide para los cuatro antes de la primera mutación.
  assert.match(step, /\*\)\s*\n\s*echo "::error title=Release BLOCKED::servicio/);
  const blockedIdx = step.indexOf('[ "$blocked" = "0" ] || exit 1');
  assert.ok(blockedIdx > guardIdx && blockedIdx < deployIdx, "sin mutaciones si un servicio bloquea");
});

test("el fallback de superseded no mezcla «unknown» con el SHA observado (revisión de #1199)", () => {
  const gate = wf.slice(wf.indexOf("Runtime provenance gate"));
  assert.doesNotMatch(gate, /\| jq -r '\.observed\.gitSha \/\/ "unknown"' 2>\/dev\/null \|\| echo unknown\)/);
  assert.match(gate, /vjson=\$\(node project-manager-app\/scripts\/verify-deploy-provenance\.mjs[\s\S]*?\|\| true\)/);
});
