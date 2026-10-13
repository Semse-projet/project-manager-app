import assert from "node:assert/strict";
import test from "node:test";
import {
  ALLOWED_ROLES,
  SERVICE_USER_ID,
  applyPlan,
  planServiceMembership,
} from "../../scripts/ops/ensure-worker-service-membership.mjs";

const base = {
  userId: SERVICE_USER_ID,
  tenantId: "tenant_default",
  orgId: "org_admin_001",
  roles: ALLOWED_ROLES,
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
  assert.deepEqual(plan.createMemberships, ALLOWED_ROLES);
  assert.deepEqual(plan.createRoles, []);
});

test("es idempotente: lo ya ACTIVE no se vuelve a crear", () => {
  const memberships = ALLOWED_ROLES.map((roleKey) => ({ roleKey, status: "ACTIVE" }));
  const plan = planServiceMembership({ ...base, state: okState({ memberships }) });
  assert.deepEqual(plan.createMemberships, []);
  assert.deepEqual(plan.alreadyActive, ALLOWED_ROLES);
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
