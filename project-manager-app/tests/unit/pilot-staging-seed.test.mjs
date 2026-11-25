import test from "node:test";
import assert from "node:assert/strict";
import { EXPECTED, guardEnvironment, main, parseInput } from "../../scripts/staging/pilot-seed.mjs";

const stagingEnv = {
  RAILWAY_PROJECT_ID: EXPECTED.projectId,
  RAILWAY_PROJECT_NAME: EXPECTED.projectName,
  RAILWAY_ENVIRONMENT_NAME: "staging",
  RAILWAY_SERVICE_NAME: "semse-api-qa",
  DATABASE_URL: "postgresql://user:secret@postgres-qa.railway.internal:5432/railway",
};
const input = {
  PILOT_SEED_PRO_EMAIL: "pro@example.com",
  PILOT_SEED_WORKER_EMAIL: "worker@example.com",
  PILOT_SEED_VERIFIED_LAT: "19.4326",
  PILOT_SEED_VERIFIED_LNG: "-99.1332",
  PILOT_SEED_UNVERIFIED_LAT: "19.44",
  PILOT_SEED_UNVERIFIED_LNG: "-99.14",
};

test("guard: solo el staging aislado autorizado (proyecto, entorno y servicio exactos)", () => {
  assert.deepEqual(guardEnvironment(stagingEnv), []);
  assert.ok(guardEnvironment({ ...stagingEnv, RAILWAY_ENVIRONMENT_NAME: "production" }).length > 0);
  assert.ok(guardEnvironment({ ...stagingEnv, RAILWAY_PROJECT_ID: "95ad1b14-d1d9-467d-82d8-5354619ba873" }).length > 0, "SEMSEproject (producción) se rechaza");
  assert.ok(guardEnvironment({ ...stagingEnv, RAILWAY_SERVICE_NAME: "semse-API" }).length > 0);
  assert.ok(guardEnvironment({ ...stagingEnv, NODE_ENV: "production" }).length > 0);
  assert.ok(guardEnvironment({}).length > 0, "fuera de Railway se rechaza");
});

test("entrada: plan por defecto; apply y rollback exigen PILOT_SEED_CONFIRM=staging-only", () => {
  assert.equal(parseInput(input).mode, "plan");
  assert.deepEqual(parseInput(input).errors, []);
  assert.ok(parseInput({ ...input, PILOT_SEED_MODE: "apply" }).errors.some((e) => e.includes("PILOT_SEED_CONFIRM")));
  assert.deepEqual(parseInput({ ...input, PILOT_SEED_MODE: "apply", PILOT_SEED_CONFIRM: "staging-only" }).errors, []);
  assert.deepEqual(parseInput({ PILOT_SEED_MODE: "rollback", PILOT_SEED_CONFIRM: "staging-only" }).errors, []);
});

test("entrada: coordenadas, radio 50–1000 y correos válidos y distintos; los errores no muestran los correos", () => {
  const bad = parseInput({ ...input, PILOT_SEED_VERIFIED_LAT: "200", PILOT_SEED_VERIFIED_RADIUS: "20", PILOT_SEED_WORKER_EMAIL: "pro@example.com" });
  assert.ok(bad.errors.some((e) => e.includes("PILOT_SEED_VERIFIED_LAT")));
  assert.ok(bad.errors.some((e) => e.includes("RADIUS")));
  assert.ok(bad.errors.some((e) => e.includes("distintas")));
  assert.ok(bad.errors.every((e) => !e.includes("example.com")));
  assert.equal(parseInput(input).verified.radiusMeters, 150);
});

test("main: fuera del staging no escribe y sale con 2", async () => {
  assert.equal(await main({ ...input, PILOT_SEED_MODE: "apply", PILOT_SEED_CONFIRM: "staging-only" }), 2);
});

test("main: en plan no abre conexión a la base y sale con 0", async () => {
  assert.equal(await main({ ...stagingEnv, ...input }), 0);
});
