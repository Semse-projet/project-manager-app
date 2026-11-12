import assert from "node:assert/strict";
import test from "node:test";
import {
  ALLOWED_ROLES,
  DEFAULT_ROLES,
  SERVICE_USER_ID,
  applyPlan,
  ensureWorkerServiceMembershipFromEnv,
  planServiceMembership,
} from "../../scripts/ops/ensure-worker-service-membership.mjs";

const base = {
  userId: SERVICE_USER_ID,
  tenantId: "tenant_default",
  orgId: "org_admin_001",
  roles: DEFAULT_ROLES,
};
const okState = (over = {}) => ({
  user: { status: "active" },
  org: { tenantId: "tenant_default" },
  memberships: [],
  roleKeys: ALLOWED_ROLES,
  ...over,
});

test("crea las tres membresías que faltan", () => {
  const plan = planServiceMembership({ ...base, state: okState() });
  assert.equal(plan.ok, true);
  assert.deepEqual(plan.createMemberships, DEFAULT_ROLES);
  assert.deepEqual(plan.createRoles, []);
});

test("AGENT_RUNNER solo es permitido con una solicitud explícita para la identidad de servicio", () => {
  assert.ok(!DEFAULT_ROLES.includes("AGENT_RUNNER"));
  assert.ok(ALLOWED_ROLES.includes("AGENT_RUNNER"));
  const requested = planServiceMembership({
    ...base, roles: [...DEFAULT_ROLES, "AGENT_RUNNER"], state: okState(),
  });
  assert.equal(requested.ok, true);
  assert.deepEqual(requested.createMemberships, [...DEFAULT_ROLES, "AGENT_RUNNER"]);
  const denied = planServiceMembership({
    ...base, userId: "usr_human", roles: ["AGENT_RUNNER"], state: okState(),
  });
  assert.equal(denied.ok, false);
  const suspended = planServiceMembership({
    ...base, roles: ["AGENT_RUNNER"],
    state: okState({ memberships: [{roleKey:"AGENT_RUNNER",status:"REVOKED"}] }),
  });
  assert.deepEqual(suspended.skippedNonActive, ["AGENT_RUNNER"]);
  assert.deepEqual(suspended.createMemberships, []);
});

test("es idempotente: lo ya ACTIVE no se vuelve a crear", () => {
  const memberships = DEFAULT_ROLES.map((roleKey) => ({ roleKey, status: "ACTIVE" }));
  const plan = planServiceMembership({ ...base, state: okState({ memberships }) });
  assert.deepEqual(plan.createMemberships, []);
  assert.deepEqual(plan.alreadyActive, DEFAULT_ROLES);
});

test("no reactiva una membresía suspendida o revocada", () => {
  const memberships = [{ roleKey: "OPS_ADMIN", status: "SUSPENDED" }];
  const plan = planServiceMembership({ ...base, state: okState({ memberships }) });
  assert.deepEqual(plan.skippedNonActive, ["OPS_ADMIN"]);
  assert.ok(!plan.createMemberships.includes("OPS_ADMIN"));
});

test("aborta si el usuario no es el de servicio, o pide roles fuera de la lista", () => {
  assert.equal(planServiceMembership({ ...base, userId: "usr_admin_001", state: okState() }).ok, false);
  assert.equal(planServiceMembership({ ...base, roles: ["CLIENT"], state: okState() }).ok, false);
  assert.equal(planServiceMembership({ ...base, roles: ["OPS_ADMIN", "PRO"], state: okState() }).ok, false);
});

test("aborta sin crear User/Org y rechaza org de otro tenant o usuario inactivo", () => {
  assert.equal(planServiceMembership({ ...base, state: okState({ user: null }) }).ok, false);
  assert.equal(planServiceMembership({ ...base, state: okState({ org: null }) }).ok, false);
  assert.equal(planServiceMembership({ ...base, state: okState({ org: { tenantId: "otro" } }) }).ok, false);
  assert.equal(planServiceMembership({ ...base, state: okState({ user: { status: "suspended" } }) }).ok, false);
});

test("applyPlan solo escribe memberships ACTIVE para la identidad indicada", async () => {
  const writes = [];
  const tx = {
    role: {
      upsert: async ({ where }) => writes.push(["role", where.key]),
      findUniqueOrThrow: async ({ where }) => ({ id: `id_${where.key}` }),
    },
    membership: { upsert: async ({ create }) => writes.push(["membership", create]) },
  };
  const prisma = { $transaction: async (fn) => fn(tx) };
  const plan = planServiceMembership({ ...base, state: okState() });
  await applyPlan(prisma, { userId: SERVICE_USER_ID, orgId: "org_admin_001" }, plan);
  const memberships = writes.filter(([k]) => k === "membership").map(([, c]) => c);
  assert.equal(memberships.length, 3);
  for (const m of memberships) {
    assert.equal(m.userId, SERVICE_USER_ID);
    assert.equal(m.orgId, "org_admin_001");
    assert.equal(m.status, "ACTIVE");
  }
});

// ── Camino de despliegue (pre-migrate) ───────────────────────────────────────

function fakePrisma({ memberships = ["OPS_ADMIN", "WORKER", "EVENT_CONSUMER"], orgTenant = "tenant_default", fail = false } = {}) {
  const created = [];
  const tx = {
    role: {
      async upsert() {},
      async findUniqueOrThrow({ where }) { return { id: `role_${where.key}` }; },
    },
    membership: { async upsert({ create }) { created.push(create); } },
  };
  return {
    created,
    user: { async findUnique() { if (fail) throw new Error("db down"); return { status: "active" }; } },
    org: { async findUnique() { return { tenantId: orgTenant }; } },
    membership: { async findMany() { return memberships.map((key) => ({ status: "ACTIVE", role: { key } })); } },
    role: { async findMany() { return ALLOWED_ROLES.map((key) => ({ key })); } },
    async $transaction(cb) { return cb(tx); },
  };
}
const ROLES = "OPS_ADMIN,WORKER,EVENT_CONSUMER,AGENT_RUNNER";

test("deploy: sin modo (o con un valor desconocido) no lee ni escribe nada", async () => {
  const prisma = fakePrisma({ fail: true });
  const logs = [];
  assert.deepEqual(await ensureWorkerServiceMembershipFromEnv(prisma, {}, (l) => logs.push(l)), { outcome: "skipped", reason: "mode_off" });
  assert.equal((await ensureWorkerServiceMembershipFromEnv(prisma, { SEMSE_WORKER_SERVICE_MEMBERSHIP_MODE: "on", SEMSE_WORKER_SERVICE_ROLES: ROLES }, (l) => logs.push(l))).outcome, "skipped");
  assert.deepEqual(logs, []);
});

test("deploy: los roles son explícitos — sin lista no hay default (AGENT_RUNNER nunca implícito)", async () => {
  const prisma = fakePrisma();
  const result = await ensureWorkerServiceMembershipFromEnv(prisma, { SEMSE_WORKER_SERVICE_MEMBERSHIP_MODE: "apply" }, () => {});
  assert.equal(result.outcome, "skipped");
  assert.deepEqual(prisma.created, []);
});

test("deploy dry-run: muestra el plan (solo falta AGENT_RUNNER) y no escribe", async () => {
  const prisma = fakePrisma();
  const logs = [];
  const result = await ensureWorkerServiceMembershipFromEnv(
    prisma, { SEMSE_WORKER_SERVICE_MEMBERSHIP_MODE: "dry-run", SEMSE_WORKER_SERVICE_ROLES: ROLES }, (l) => logs.push(JSON.parse(l)));
  assert.equal(result.outcome, "dry-run");
  assert.deepEqual(result.plan.createMemberships, ["AGENT_RUNNER"]);
  assert.deepEqual(result.plan.alreadyActive, ["OPS_ADMIN", "WORKER", "EVENT_CONSUMER"]);
  assert.deepEqual(prisma.created, []);
  assert.equal(logs[0].label, "worker-service-membership");
  assert.equal(logs[0].orgId, "org_admin_001");
});

test("deploy apply: crea solo la membresía que falta y es idempotente", async () => {
  const prisma = fakePrisma();
  const env = { SEMSE_WORKER_SERVICE_MEMBERSHIP_MODE: "apply", SEMSE_WORKER_SERVICE_ROLES: ROLES };
  const first = await ensureWorkerServiceMembershipFromEnv(prisma, env, () => {});
  assert.equal(first.outcome, "applied");
  assert.deepEqual(prisma.created, [{ userId: SERVICE_USER_ID, orgId: "org_admin_001", roleId: "role_AGENT_RUNNER", status: "ACTIVE" }]);

  const done = fakePrisma({ memberships: ["OPS_ADMIN", "WORKER", "EVENT_CONSUMER", "AGENT_RUNNER"] });
  assert.equal((await ensureWorkerServiceMembershipFromEnv(done, env, () => {})).outcome, "nothing_to_do");
  assert.deepEqual(done.created, []);
});

test("deploy: org de otro tenant, rol no permitido o BD caída ⇒ no escribe y nunca lanza", async () => {
  const env = { SEMSE_WORKER_SERVICE_MEMBERSHIP_MODE: "apply", SEMSE_WORKER_SERVICE_ROLES: ROLES };
  const otherTenant = fakePrisma({ orgTenant: "tenant_other" });
  assert.equal((await ensureWorkerServiceMembershipFromEnv(otherTenant, env, () => {})).outcome, "aborted");
  assert.deepEqual(otherTenant.created, []);

  const badRole = fakePrisma();
  assert.equal((await ensureWorkerServiceMembershipFromEnv(badRole, { ...env, SEMSE_WORKER_SERVICE_ROLES: "OPS_ADMIN,CLIENT" }, () => {})).outcome, "aborted");
  assert.deepEqual(badRole.created, []);

  assert.equal((await ensureWorkerServiceMembershipFromEnv(fakePrisma({ fail: true }), env, () => {})).outcome, "failed");
});
