import test from "node:test";
import assert from "node:assert/strict";
import { EXPECTED, IDS, guardEnvironment, inspect, main, parseInput } from "../../scripts/staging/pilot-seed.mjs";

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
  assert.deepEqual(guardEnvironment({ ...stagingEnv, NODE_ENV: "production" }), [], "la imagen de la API fija NODE_ENV=production también en staging");
  assert.ok(guardEnvironment({ ...stagingEnv, NODE_ENV: "production", RAILWAY_ENVIRONMENT_NAME: "production" }).length > 0);
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

// Base falsa en memoria: solo las lecturas que usa inspect().
function fakeDb({ users = [], memberships = [], worksites = [], jobs = [] }) {
  const pick = (rows, where) => rows.filter((r) => Object.entries(where).every(([k, v]) =>
    v && typeof v === "object" ? ("in" in v ? v.in.includes(r[k]) : "not" in v ? r[k] !== v.not : false) : r[k] === v));
  return {
    user: { findUnique: async ({ where }) => users.find((u) => u.email === where.email) ?? null },
    membership: { findFirst: async ({ where }) => pick(memberships, where).sort((a, b) => a.createdAt - b.createdAt)[0] ?? null },
    job: { count: async ({ where }) => pick(jobs, where).length },
    worksite: { count: async ({ where }) => pick(worksites, where).length },
  };
}
const proUser = { id: "u_pro", email: "pro@example.com", status: "active" };
const proMembership = { userId: "u_pro", status: "ACTIVE", createdAt: 1, orgId: "org_pro", role: { key: "PRO" }, org: { tenantId: "t1", type: "PRO" } };
const parsed = parseInput(input);

test("inspect (solo lectura): la Org del piloto es la Org de sesión del PRO; WORKER pendiente de invitación no bloquea", async () => {
  const r = await inspect(fakeDb({ users: [proUser], memberships: [proMembership] }), parsed);
  assert.deepEqual(r.blocking, []);
  assert.deepEqual(r.pilot, { proUserId: "u_pro", orgId: "org_pro", tenantId: "t1" });
  assert.equal(r.worker, "pending_invitation");
});

test("inspect: WORKER invitado (única membresía WORKER en la Org del piloto) → ready", async () => {
  const worker = { id: "u_w", email: "worker@example.com", status: "active" };
  const wm = { userId: "u_w", status: "ACTIVE", createdAt: 5, orgId: "org_pro", role: { key: "WORKER" }, org: { tenantId: "t1", type: "PRO" } };
  const r = await inspect(fakeDb({ users: [proUser, worker], memberships: [proMembership, wm] }), parsed);
  assert.deepEqual(r.blocking, []);
  assert.equal(r.worker, "ready");
});

test("inspect: WORKER con registro público (Org propia más antigua) bloquea y el correo va enmascarado", async () => {
  const worker = { id: "u_w", email: "worker@example.com", status: "active" };
  const own = { userId: "u_w", status: "ACTIVE", createdAt: 2, orgId: "org_w", role: { key: "PRO" }, org: { tenantId: "t1", type: "PRO" } };
  const later = { userId: "u_w", status: "ACTIVE", createdAt: 9, orgId: "org_pro", role: { key: "WORKER" }, org: { tenantId: "t1", type: "PRO" } };
  const r = await inspect(fakeDb({ users: [proUser, worker], memberships: [proMembership, own, later] }), parsed);
  assert.ok(r.blocking.some((e) => e.includes("invitación")));
  assert.ok(r.blocking.every((e) => !e.includes("worker@example.com")), "el correo va enmascarado");
});

test("inspect: PRO inexistente, o cuya Org de sesión no es PRO, bloquea", async () => {
  assert.ok((await inspect(fakeDb({}), parsed)).blocking.some((e) => e.includes("no existe")));
  const asClient = { ...proMembership, role: { key: "CLIENT" }, org: { tenantId: "t1", type: "CLIENT" } };
  assert.ok((await inspect(fakeDb({ users: [proUser], memberships: [asClient] }), parsed)).blocking.some((e) => e.includes("Org PRO")));
});

test("inspect: obras pilot_seed_* de otra Org bloquean (rollback antes de cambiar de PRO)", async () => {
  const ws = [{ id: IDS.worksiteVerified, orgId: "org_otra" }];
  const r = await inspect(fakeDb({ users: [proUser], memberships: [proMembership], worksites: ws }), parsed);
  assert.ok(r.blocking.some((e) => e.includes("rollback")));
});
