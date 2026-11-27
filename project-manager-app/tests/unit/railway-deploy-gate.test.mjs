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
