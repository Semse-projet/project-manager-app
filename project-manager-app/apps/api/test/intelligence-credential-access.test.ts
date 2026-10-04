import test from "node:test";
import assert from "node:assert/strict";
import { IntelligenceController } from "../dist/modules/intelligence/intelligence.controller.js";
import { ProfessionalCredentialService } from "../dist/modules/intelligence/professional-credential.service.js";

// C51 (decisión del dueño): `GET /v1/intelligence/credentials/user/:userId` exige mismo tenant y además
// propio usuario, OPS_ADMIN del tenant o credencial publicada (solo campos públicos). Antes cualquier
// usuario con users:read leía el registro completo (orgId, totalManaged, ...) de cualquier usuario del tenant.

process.env.DATABASE_URL = process.env.DATABASE_URL || "postgresql://stub:stub@127.0.0.1:1/stub";

const row = (o: Record<string, unknown>) => ({
  id: "c", tenantId: "t1", userId: "u_pub", orgId: "org_secret", displayName: "Ana Pérez", completedProjects: 7, activeProjects: 2,
  totalManaged: "125000.00", onTimeRate: "0.9", disputeRate: "0", avgClientRating: "4.8", trustScore: 88, specialties: ["Pintura"],
  badgesJson: ["verified"], verifiedAt: new Date(), lastActivityAt: new Date(), publicSlug: null, updatedAt: new Date(), ...o,
});
const ROWS = [
  row({ id: "c1", userId: "u_pub", publicSlug: "ana-perez-u_pub" }),
  row({ id: "c2", userId: "u_priv", publicSlug: null }),
  row({ id: "c3", userId: "u_t2", tenantId: "t2", publicSlug: "otro-t2" }),
];
const prisma = {
  professionalCredential: {
    findFirst: async ({ where }: { where: { userId: string; tenantId: string } }) =>
      ROWS.find((r) => r.userId === where.userId && r.tenantId === where.tenantId) ?? null,
  },
};
const controller = new (IntelligenceController as any)({}, {}, new (ProfessionalCredentialService as any)(prisma), {}, {}, {}, {}, {});
const req = (userId: string, tenantId = "t1", roles: string[] = []) => ({ headers: {}, authContext: { tenantId, orgId: "org_x", userId, roles } });
const call = async (r: ReturnType<typeof req>, target: string) => {
  try {
    return { status: 200, data: (await controller.credentialByUser(r, target)).data };
  } catch (e) {
    return { status: (e as { getStatus?: () => number }).getStatus?.() ?? 500, data: undefined };
  }
};
const PRIVATE_FIELDS = ["id", "tenantId", "userId", "orgId", "totalManaged", "activeProjects", "lastActivityAt", "updatedAt"];

test("otro tenant o inexistente no devuelve nada (también OPS_ADMIN) y sin oráculo de existencia", async () => {
  for (const roles of [[], ["OPS_ADMIN"]]) {
    assert.deepEqual(await call(req("u1", "t1", roles), "u_t2"), { status: 200, data: null });
    assert.deepEqual(await call(req("u1", "t2", roles), "u_pub"), { status: 200, data: null });
  }
  assert.deepEqual(await call(req("u1"), "no_existe"), { status: 200, data: null });
});

test("credencial sin publicar de otro usuario del tenant ⇒ 403", async () => {
  assert.equal((await call(req("u1"), "u_priv")).status, 403);
  assert.equal((await call(req("u1", "t1", ["PRO"]), "u_priv")).status, 403);
});

test("el propio usuario y OPS_ADMIN del tenant reciben el registro completo (publicado o no)", async () => {
  for (const [r, target] of [[req("u_priv"), "u_priv"], [req("u_pub"), "u_pub"], [req("u1", "t1", ["OPS_ADMIN"]), "u_priv"], [req("u1", "t1", ["OPS_ADMIN"]), "u_pub"]] as const) {
    const out = await call(r, target);
    assert.equal(out.status, 200);
    for (const f of PRIVATE_FIELDS) assert.ok(f in (out.data as object), `${target} debe incluir ${f}`);
  }
});

test("credencial publicada: otro usuario del tenant recibe SOLO los campos públicos", async () => {
  const out = await call(req("u1", "t1", ["CLIENT"]), "u_pub");
  assert.equal(out.status, 200);
  const data = out.data as Record<string, unknown>;
  for (const f of PRIVATE_FIELDS) assert.ok(!(f in data), `no debe exponer ${f}`);
  assert.deepEqual(Object.keys(data).sort(), ["avgClientRating", "badges", "completedProjects", "displayName", "disputeRate", "onTimeRate", "publicSlug", "specialties", "trustScore", "verifiedAt"]);
  assert.equal(data.publicSlug, "ana-perez-u_pub");
});
