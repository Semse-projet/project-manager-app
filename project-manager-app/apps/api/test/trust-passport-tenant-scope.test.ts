import test from "node:test";
import assert from "node:assert/strict";
import { NotFoundException, UnauthorizedException } from "@nestjs/common";

process.env.PASSPORT_SECRET = process.env.PASSPORT_SECRET || "test-passport-secret-for-unit-tests-32+";
process.env.DATABASE_URL = process.env.DATABASE_URL || "postgresql://stub:stub@127.0.0.1:1/stub";

const { TrustPassportService } = await import("../dist/modules/trust/trust-passport.service.js");

// C51: GET /v1/users/:userId/trust-passport buscaba al usuario solo por id y estado, sin tenant. Un OPS_ADMIN de un
// tenant podía emitir un pasaporte firmado (y distinguir 200/404) para un usuario que solo pertenece a otro tenant.
// Ahora exige una membresía ACTIVE en una org del tenant del solicitante; si no, 404.

type Membership = { userId: string; tenantId: string; status: string };
const MEMBERSHIPS: Membership[] = [
  { userId: "u_t1", tenantId: "t1", status: "ACTIVE" },
  { userId: "u_t2", tenantId: "t2", status: "ACTIVE" },
  { userId: "u_suspended", tenantId: "t1", status: "SUSPENDED" },
  { userId: "u_both", tenantId: "t1", status: "ACTIVE" },
  { userId: "u_both", tenantId: "t2", status: "ACTIVE" },
];

function build() {
  const userWheres: unknown[] = [];
  const counted: string[] = [];
  const count = (name: string) => async ({ where }: { where: unknown }) => (counted.push(`${name}:${JSON.stringify(where)}`), 0);
  const prisma = {
    user: {
      findFirst: async ({ where }: { where: { id: string; status: string; memberships?: { some: { status: string; org: { tenantId: string } } } } }) => {
        userWheres.push(where);
        const m = where.memberships?.some;
        // Sin filtro de membresía (comportamiento anterior) cualquier id conocido existiría.
        const ok = m
          ? MEMBERSHIPS.some((x) => x.userId === where.id && x.status === m.status && x.tenantId === m.org.tenantId)
          : MEMBERSHIPS.some((x) => x.userId === where.id);
        return ok ? { id: where.id } : null;
      },
    },
    jobReservation: { count: count("jobReservation") },
    milestone: { count: count("milestone") },
    evidence: { count: count("evidence") },
    rating: { aggregate: async () => ({ _avg: { score: null }, _count: { id: 0 } }) },
    contract: { findMany: async () => [] },
    dispute: { count: count("dispute") },
  };
  const reputation = { computeForUser: async () => ({ score: 0, tier: "NEW", algorithmVersion: "v", signals: {} }) };
  return { svc: new TrustPassportService(prisma as never, reputation as never), userWheres, counted };
}

test("emite el pasaporte de un usuario con membresía ACTIVE en el tenant del solicitante", async () => {
  for (const userId of ["u_t1", "u_both"]) {
    const { svc } = build();
    const out = await svc.issue("t1", userId);
    assert.equal(out.claims.sub, userId);
    assert.equal(typeof out.token, "string");
  }
});

test("usuario solo de otro tenant ⇒ 404 y no se calcula nada (sin pasaporte firmado ni oráculo)", async () => {
  const { svc, counted } = build();
  await assert.rejects(svc.issue("t1", "u_t2"), NotFoundException);
  assert.deepEqual(counted, []);
});

test("membresía no ACTIVE en el tenant ⇒ 404", async () => {
  const { svc } = build();
  await assert.rejects(svc.issue("t1", "u_suspended"), NotFoundException);
});

test("tenant vacío nunca concede", async () => {
  const { svc, userWheres } = build();
  await assert.rejects(svc.issue("", "u_t1"), NotFoundException);
  assert.deepEqual(userWheres, []);
});

test("la consulta del usuario lleva el tenant del solicitante", async () => {
  const { svc, userWheres } = build();
  await svc.issue("t1", "u_t1");
  assert.deepEqual(userWheres[0], { id: "u_t1", status: "active", memberships: { some: { status: "ACTIVE", org: { tenantId: "t1" } } } });
});

test("assertCanIssue sigue permitiendo solo al propio usuario o a OPS_ADMIN", () => {
  const { svc } = build();
  svc.assertCanIssue("u1", ["PRO"], "u1");
  svc.assertCanIssue("ops", ["OPS_ADMIN"], "u1");
  assert.throws(() => svc.assertCanIssue("u2", ["PRO"], "u1"), UnauthorizedException);
});
