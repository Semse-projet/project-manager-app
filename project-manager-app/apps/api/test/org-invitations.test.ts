import "reflect-metadata";

import test from "node:test";
import assert from "node:assert/strict";
import { REQUIRED_PERMISSIONS_KEY } from "../src/common/permissions.decorator.ts";
import { InvitationsService } from "../dist/modules/organizations/invitations.service.js";
import { OrgInvitationsController } from "../dist/modules/organizations/invitations.controller.js";

type Inv = Record<string, any>;

function makeWorld() {
  const invitations: Inv[] = [];
  const memberships: Inv[] = [
    { userId: "owner", orgId: "orgA", roleId: "r_pro", status: "ACTIVE", role: { key: "PRO" }, org: { tenantId: "t1" } },
    { userId: "worker_in_a", orgId: "orgA", roleId: "r_worker", status: "ACTIVE", role: { key: "WORKER" }, org: { tenantId: "t1" } },
    { userId: "owner_b", orgId: "orgB", roleId: "r_pro", status: "ACTIVE", role: { key: "PRO" }, org: { tenantId: "t2" } }
  ];
  const users: Record<string, Inv> = {
    ana: { id: "ana", email: "Ana@Example.com" },
    eve: { id: "eve", email: "eve@example.com" }
  };
  const audits: Inv[] = [];
  const faults = { audit: false };
  let seq = 0;
  const match = (row: Inv, where: Inv): boolean =>
    Object.entries(where).every(([k, v]) => {
      if (v && typeof v === "object" && "gt" in v) return row[k] > v.gt;
      return row[k] === v;
    });
  const invitationApi = {
    async findFirst({ where }: any) { return invitations.find((r) => match(r, where)) ?? null; },
    async findMany({ where }: any) { return invitations.filter((r) => match(r, where)); },
    async findUnique({ where }: any) {
      return invitations.find((r) => (where.id ? r.id === where.id : r.tokenHash === where.tokenHash)) ?? null;
    },
    async create({ data }: any) {
      const row = { id: `inv${++seq}`, status: "PENDING", acceptedByUserId: null, createdAt: new Date(), lastSentAt: null, ...data };
      invitations.push(row);
      return row;
    },
    async updateMany({ where, data }: any) {
      const rows = invitations.filter((r) => match(r, where));
      rows.forEach((r) => Object.assign(r, data));
      return { count: rows.length };
    }
  };
  const membershipApi = {
    async findMany({ where }: any) {
      return memberships.filter((m) => m.userId === where.userId && m.orgId === where.orgId &&
        (where.status ? m.status === where.status : true) &&
        (where.org ? m.org.tenantId === where.org.tenantId : true));
    },
    async create({ data }: any) { memberships.push({ ...data, role: { key: "WORKER" }, org: { tenantId: "t1" } }); return data; }
  };
  const prisma: any = {
    orgInvitation: invitationApi,
    membership: membershipApi,
    user: { async findUnique({ where }: any) { return users[where.id] ?? null; } },
    role: { async findUnique({ where }: any) { return where.key === "WORKER" ? { id: "r_worker", key: "WORKER" } : null; } },
    org: { async findFirst({ where }: any) { return where.id === "orgA" ? { id: "orgA", name: "Acme Remodel", tenantId: "t1" } : null; } },
    async $transaction(fn: any) {
      const before = [invitations, memberships, audits].map(rows => structuredClone(rows));
      try { return await fn({ orgInvitation: invitationApi, membership: membershipApi }); }
      catch (error) { [invitations, memberships, audits].forEach((rows,i)=>rows.splice(0,rows.length,...before[i])); throw error; }
    }
  };
  const audit: any = { async append(entry: Inv, tx: unknown) { assert.ok(tx, "membership audit must use transaction"); if(faults.audit)throw Error("audit unavailable"); audits.push(entry); } };
  return { service: new InvitationsService(prisma, audit), invitations, memberships, audits, faults };
}

const owner = { tenantId: "t1", orgId: "orgA", userId: "owner", roles: ["PRO"] };

test.beforeEach(() => { process.env.SEMSE_ORG_INVITATIONS_ENABLED = "true"; });
test.after(() => { delete process.env.SEMSE_ORG_INVITATIONS_ENABLED; });

test("AC-10: flag apagado -> 404 sin efectos", async () => {
  process.env.SEMSE_ORG_INVITATIONS_ENABLED = "false";
  const w = makeWorld();
  await assert.rejects(w.service.create(owner, "orgA", { email: "ana@example.com", role: "WORKER" }), { status: 404 });
  assert.equal(w.invitations.length, 0);
});

test("AC-01: otra Org o tenant -> 404; membresía sin permiso -> 403", async () => {
  const w = makeWorld();
  await assert.rejects(w.service.create(owner, "orgB", { email: "ana@example.com", role: "WORKER" }), { status: 404 });
  const worker = { tenantId: "t1", orgId: "orgA", userId: "worker_in_a", roles: ["WORKER"] };
  await assert.rejects(w.service.create(worker, "orgA", { email: "ana@example.com", role: "WORKER" }), { status: 403 });
  assert.equal(w.invitations.length, 0);
});

test("AC-02: solo WORKER es invitable", async () => {
  const w = makeWorld();
  for (const role of ["OPS_ADMIN", "PRO", "CLIENT"]) {
    await assert.rejects(w.service.create(owner, "orgA", { email: "ana@example.com", role }), { status: 422 });
  }
});

test("AC-03: se guarda solo el hash; el token se devuelve una vez; listar no lo expone", async () => {
  const w = makeWorld();
  const created = await w.service.create(owner, "orgA", { email: "Ana@Example.com", role: "WORKER" });
  assert.ok(created.token);
  const secret = created.token!.split(".")[1];
  assert.notEqual(w.invitations[0].tokenHash, secret);
  assert.equal(w.invitations[0].contactEmail, "ana@example.com");
  const listed = await w.service.list(owner, "orgA");
  assert.equal(listed.length, 1);
  assert.ok(!JSON.stringify(listed).includes(secret));
  assert.match(listed[0].recipientMasked, /^a\*+@example\.com$/);
});

test("AC-09: invitar dos veces al mismo contacto es idempotente", async () => {
  const w = makeWorld();
  await w.service.create(owner, "orgA", { email: "ana@example.com", role: "WORKER" });
  const again = await w.service.create(owner, "orgA", { email: "ANA@example.com", role: "WORKER" });
  assert.equal(w.invitations.length, 1);
  assert.equal(again.token, null);
});

test("accept: destinatario correcto crea Membership ACTIVE y audita; repetir es idempotente", async () => {
  const w = makeWorld();
  const { token } = await w.service.create(owner, "orgA", { email: "ana@example.com", role: "WORKER" });
  const first = await w.service.accept({ userId: "ana" }, { token: token!, requestId: "req1" });
  assert.deepEqual(first.membership, { orgId: "orgA", role: "WORKER", status: "ACTIVE" });
  assert.equal(w.memberships.filter((m) => m.userId === "ana" && m.orgId === "orgA").length, 1);
  assert.equal(w.audits.length, 1);
  const second = await w.service.accept({ userId: "ana" }, { token: token!, requestId: "req2" });
  assert.deepEqual(second, first);
  assert.equal(w.memberships.filter((m) => m.userId === "ana" && m.orgId === "orgA").length, 1);
});

test("AC-04: otro usuario con el token recibe 404 neutro y no obtiene Membership", async () => {
  const w = makeWorld();
  const { token } = await w.service.create(owner, "orgA", { email: "ana@example.com", role: "WORKER" });
  await assert.rejects(w.service.accept({ userId: "eve" }, { token: token!, requestId: "r" }), { status: 404 });
  assert.equal(w.memberships.some((m) => m.userId === "eve" && m.orgId === "orgA"), false);
  await assert.rejects(w.service.accept({ userId: "ana" }, { token: "inv1.mal", requestId: "r" }), { status: 404 });
});

test("AC-05: aceptaciones concurrentes crean una sola Membership", async () => {
  const w = makeWorld();
  const { token } = await w.service.create(owner, "orgA", { email: "ana@example.com", role: "WORKER" });
  await Promise.all([
    w.service.accept({ userId: "ana" }, { token: token!, requestId: "a" }),
    w.service.accept({ userId: "ana" }, { token: token!, requestId: "b" })
  ]);
  assert.equal(w.memberships.filter((m) => m.userId === "ana" && m.orgId === "orgA").length, 1);
});

test("AC-06: vencida o cancelada -> 410", async () => {
  const w = makeWorld();
  const { token } = await w.service.create(owner, "orgA", { email: "ana@example.com", role: "WORKER" });
  w.invitations[0].expiresAt = new Date(Date.now() - 1000);
  await assert.rejects(w.service.accept({ userId: "ana" }, { token: token!, requestId: "r" }), { status: 410 });

  const w2 = makeWorld();
  const c2 = await w2.service.create(owner, "orgA", { email: "ana@example.com", role: "WORKER" });
  await w2.service.cancel(owner, "orgA", w2.invitations[0].id, "error de contacto");
  await assert.rejects(w2.service.accept({ userId: "ana" }, { token: c2.token!, requestId: "r" }), { status: 410 });
});

test("AC-07: reenviar rota el token y el anterior deja de valer", async () => {
  const w = makeWorld();
  const first = await w.service.create(owner, "orgA", { email: "ana@example.com", role: "WORKER" });
  const second = await w.service.resend(owner, "orgA", w.invitations[0].id);
  assert.notEqual(first.token, second.token);
  await assert.rejects(w.service.accept({ userId: "ana" }, { token: first.token!, requestId: "r" }), { status: 404 });
  await w.service.accept({ userId: "ana" }, { token: second.token, requestId: "r" });
});

test("AC-08: Membership SUSPENDED existente -> 409 sin restaurar", async () => {
  const w = makeWorld();
  w.memberships.push({ userId: "ana", orgId: "orgA", roleId: "r_worker", status: "SUSPENDED", role: { key: "WORKER" }, org: { tenantId: "t1" } });
  const { token } = await w.service.create(owner, "orgA", { email: "ana@example.com", role: "WORKER" });
  await assert.rejects(w.service.accept({ userId: "ana" }, { token: token!, requestId: "r" }), { status: 409 });
});

test("preview: no consume el token y enmascara el destino", async () => {
  const w = makeWorld();
  const { token } = await w.service.create(owner, "orgA", { email: "ana@example.com", role: "WORKER" });
  const preview = await w.service.preview(token!);
  assert.equal(preview.companyName, "Acme Remodel");
  assert.equal(w.invitations[0].status, "PENDING");
  await assert.rejects(w.service.preview("inv1.nope"), { status: 404 });
});

test("controller declara permisos RBAC", () => {
  const expected: Array<[string, string]> = [
    ["create", "org:members:invite"],
    ["list", "org:invitations:read"],
    ["cancel", "org:invitations:cancel"],
    ["resend", "org:members:invite"]
  ];
  for (const [method, permission] of expected) {
    const meta = Reflect.getMetadata(REQUIRED_PERMISSIONS_KEY, (OrgInvitationsController.prototype as any)[method]);
    assert.deepEqual(meta, [permission]);
  }
});

 test("accept: audit failure restores pending invitation and does not grant membership", async()=>{
  const w=makeWorld(); const {token}=await w.service.create(owner,"orgA",{email:"ana@example.com",role:"WORKER"});
  w.faults.audit=true; await assert.rejects(w.service.accept({userId:"ana"},{token:token!,requestId:"r"}),/audit unavailable/);
  assert.equal(w.invitations[0].status,"PENDING");assert.equal(w.memberships.some(m=>m.userId==="ana"),false);
  w.faults.audit=false;await w.service.accept({userId:"ana"},{token:token!,requestId:"retry"});assert.equal(w.audits.length,1);
 });
