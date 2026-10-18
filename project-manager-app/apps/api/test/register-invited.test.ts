import "reflect-metadata";

import test from "node:test";
import assert from "node:assert/strict";
import { InvitationsService } from "../dist/modules/organizations/invitations.service.js";

type Row = Record<string, any>;

function makeWorld(opts: { emailOk?: boolean; existingUserEmail?: string } = {}) {
  const invitations: Row[] = [];
  const users: Row[] = opts.existingUserEmail ? [{ id: "u_old", email: opts.existingUserEmail }] : [];
  const profiles: Row[] = [];
  const memberships: Row[] = [
    { userId: "owner", orgId: "orgA", status: "ACTIVE", role: { key: "PRO" }, org: { tenantId: "t1" } }
  ];
  const audits: Row[] = [];
  const sent: Row[] = [];
  const sessions: Row[] = [];
  let seq = 0;
  const match = (row: Row, where: Row): boolean =>
    Object.entries(where).every(([k, v]) => {
      if (v && typeof v === "object" && "gt" in v) return row[k] > v.gt;
      return row[k] === v;
    });
  const invitationApi = {
    async findFirst({ where }: any) { return invitations.find((r) => match(r, where)) ?? null; },
    async findMany({ where }: any) { return invitations.filter((r) => match(r, where)); },
    async findUnique({ where }: any) { return invitations.find((r) => (where.id ? r.id === where.id : r.tokenHash === where.tokenHash)) ?? null; },
    async create({ data }: any) {
      const row = { id: `inv${++seq}`, status: "PENDING", acceptedByUserId: null, createdAt: new Date(), lastSentAt: null, ...data };
      invitations.push(row);
      return row;
    },
    async updateMany({ where, data }: any) {
      const rows = invitations.filter((r) => match(r, where));
      rows.forEach((r) => Object.assign(r, data));
      return { count: rows.length };
    },
    async update({ where, data }: any) {
      const row = invitations.find((r) => r.id === where.id)!;
      Object.assign(row, data);
      return row;
    }
  };
  const userApi = {
    async findUnique({ where }: any) { return users.find((u) => u.email === where.email || u.id === where.id) ?? null; },
    async create({ data }: any) { const u = { id: `u${++seq}`, ...data }; users.push(u); return u; }
  };
  const membershipApi = {
    async findMany({ where }: any) {
      return memberships.filter((m) => m.userId === where.userId && m.orgId === where.orgId &&
        (where.status ? m.status === where.status : true) &&
        (where.org ? m.org.tenantId === where.org.tenantId : true));
    },
    async create({ data }: any) { memberships.push({ ...data, role: { key: "WORKER" }, org: { tenantId: "t1" } }); return data; }
  };
  const tx = { orgInvitation: invitationApi, user: userApi, userProfile: { async create({ data }: any) { profiles.push(data); return data; } }, membership: membershipApi };
  const prisma: any = {
    orgInvitation: invitationApi,
    user: userApi,
    membership: membershipApi,
    role: { async findUnique({ where }: any) { return where.key === "WORKER" ? { id: "r_worker", key: "WORKER" } : null; } },
    org: { async findFirst({ where }: any) { return where.id === "orgA" ? { id: "orgA", name: "Acme Remodel", tenantId: "t1" } : null; } },
    async $transaction(fn: any) { return fn(tx); }
  };
  const audit: any = { async append(entry: Row) { audits.push(entry); } };
  const email: any = { async send(msg: Row) { sent.push(msg); return opts.emailOk === false ? { sent: false, error: "x" } : { sent: true }; } };
  const auth: any = { async issueSession(input: Row) { sessions.push(input); return { accessToken: "at", user: input.userId }; } };
  const logger: any = { error() {}, warn() {}, info() {} };
  return { service: new InvitationsService(prisma, audit, email, auth, logger), invitations, users, profiles, memberships, audits, sent, sessions };
}

const owner = { tenantId: "t1", orgId: "orgA", userId: "owner", roles: ["PRO"] };

function flags(on: boolean) {
  process.env.SEMSE_ORG_INVITATIONS_ENABLED = String(on);
  process.env.SEMSE_INVITATION_EMAIL_DELIVERY = String(on);
  process.env.SEMSE_INVITED_REGISTRATION_ENABLED = String(on);
}
test.beforeEach(() => flags(true));
test.after(() => {
  delete process.env.SEMSE_ORG_INVITATIONS_ENABLED;
  delete process.env.SEMSE_INVITATION_EMAIL_DELIVERY;
  delete process.env.SEMSE_INVITED_REGISTRATION_ENABLED;
});

test("entrega por correo: el token va al destinatario y NO se devuelve a quien invita", async () => {
  const w = makeWorld();
  const created = await w.service.create(owner, "orgA", { email: "Nuevo@Example.com", role: "WORKER" });
  assert.equal(created.token, null);
  assert.equal(created.emailSent, true);
  assert.equal(w.sent.length, 1);
  assert.equal(w.sent[0].to, "nuevo@example.com");
  assert.match(w.sent[0].text, /token=/);
  assert.ok(!JSON.stringify(created).includes("token="));
});

test("sin entrega por correo se conserva el comportamiento BO-01 (token a quien invita)", async () => {
  const w = makeWorld();
  process.env.SEMSE_INVITATION_EMAIL_DELIVERY = "false";
  const created = await w.service.create(owner, "orgA", { email: "a@example.com", role: "WORKER" });
  assert.ok(created.token);
  assert.equal(w.sent.length, 0);
});

test("register-invited: crea User + Membership WORKER en la Org que invita, sin Org nueva, e inicia sesión", async () => {
  const w = makeWorld();
  await w.service.create(owner, "orgA", { email: "nuevo@example.com", role: "WORKER" });
  const token = decodeURIComponent(/token=([^\s"&]+)/.exec(w.sent[0].text)![1]);
  const session = await w.service.registerInvited({ token, name: "Nuevo Trabajador", password: "Clave-larga-123", requestId: "r1" });
  assert.ok(session);
  assert.equal(w.users.length, 1);
  assert.equal(w.users[0].email, "nuevo@example.com");
  assert.notEqual(w.users[0].passwordHash, "Clave-larga-123");
  const newMemberships = w.memberships.filter((m) => m.userId === w.users[0].id);
  assert.equal(newMemberships.length, 1);
  assert.equal(newMemberships[0].orgId, "orgA");
  assert.equal(w.invitations[0].status, "ACCEPTED");
  assert.equal(w.sessions[0].orgId, "orgA");
  assert.deepEqual(w.sessions[0].roles, ["WORKER"]);
  assert.equal(w.audits.at(-1)?.action, "membership.created");
});

test("register-invited: token inválido, vencido o ya usado -> 404 neutro", async () => {
  const w = makeWorld();
  await assert.rejects(w.service.registerInvited({ token: "inv1.nope-nope-nope", name: "X Y", password: "Clave-larga-123", requestId: "r" }), { status: 404 });
  await w.service.create(owner, "orgA", { email: "n@example.com", role: "WORKER" });
  const token = decodeURIComponent(/token=([^\s"&]+)/.exec(w.sent[0].text)![1]);
  w.invitations[0].expiresAt = new Date(Date.now() - 1000);
  await assert.rejects(w.service.registerInvited({ token, name: "X Y", password: "Clave-larga-123", requestId: "r" }), { status: 404 });
});

test("register-invited: no se puede reutilizar el token (segunda vez -> 404)", async () => {
  const w = makeWorld();
  await w.service.create(owner, "orgA", { email: "n@example.com", role: "WORKER" });
  const token = decodeURIComponent(/token=([^\s"&]+)/.exec(w.sent[0].text)![1]);
  await w.service.registerInvited({ token, name: "N N", password: "Clave-larga-123", requestId: "r" });
  await assert.rejects(w.service.registerInvited({ token, name: "N N", password: "Otra-clave-123", requestId: "r" }), { status: 404 });
  assert.equal(w.users.length, 1);
});

test("register-invited: si ya existe cuenta con ese correo -> 409 (debe iniciar sesión)", async () => {
  const w = makeWorld({ existingUserEmail: "n@example.com" });
  await w.service.create(owner, "orgA", { email: "n@example.com", role: "WORKER" });
  const token = decodeURIComponent(/token=([^\s"&]+)/.exec(w.sent[0].text)![1]);
  await assert.rejects(w.service.registerInvited({ token, name: "N N", password: "Clave-larga-123", requestId: "r" }), { status: 409 });
});

test("register-invited exige los tres flags (apagado -> 404 sin efectos)", async () => {
  const w = makeWorld();
  await w.service.create(owner, "orgA", { email: "n@example.com", role: "WORKER" });
  const token = decodeURIComponent(/token=([^\s"&]+)/.exec(w.sent[0].text)![1]);
  process.env.SEMSE_INVITED_REGISTRATION_ENABLED = "false";
  await assert.rejects(w.service.registerInvited({ token, name: "N N", password: "Clave-larga-123", requestId: "r" }), { status: 404 });
  process.env.SEMSE_INVITED_REGISTRATION_ENABLED = "true";
  process.env.SEMSE_INVITATION_EMAIL_DELIVERY = "false";
  await assert.rejects(w.service.registerInvited({ token, name: "N N", password: "Clave-larga-123", requestId: "r" }), { status: 404 });
  assert.equal(w.users.length, 0);
  assert.equal(w.invitations[0].status, "PENDING");
});
