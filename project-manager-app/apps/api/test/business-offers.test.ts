import "reflect-metadata";

import test from "node:test";
import assert from "node:assert/strict";
import { REQUIRED_PERMISSIONS_KEY } from "../src/common/permissions.decorator.ts";
import { OffersService } from "../dist/modules/organizations/offers.service.js";
import { OrgOffersController } from "../dist/modules/organizations/offers.controller.js";

type Row = Record<string, any>;

function makeWorld() {
  const offers: Row[] = [];
  const engagements: Row[] = [];
  const audits: Row[] = [];
  let seq = 0;
  const memberships: Row[] = [
    { userId: "owner", orgId: "orgA", status: "ACTIVE", role: { key: "CLIENT" }, org: { tenantId: "t1" } },
    { userId: "ana", orgId: "orgA", status: "ACTIVE", role: { key: "WORKER" }, org: { tenantId: "t1" } },
    { userId: "bob", orgId: "orgA", status: "ACTIVE", role: { key: "WORKER" }, org: { tenantId: "t1" } },
    { userId: "carl", orgId: "orgA", status: "SUSPENDED", role: { key: "WORKER" }, org: { tenantId: "t1" } },
    { userId: "owner_b", orgId: "orgB", status: "ACTIVE", role: { key: "CLIENT" }, org: { tenantId: "t2" } }
  ];
  const match = (row: Row, where: Row): boolean =>
    Object.entries(where).every(([k, v]) => {
      if (v && typeof v === "object" && "gt" in v) return row[k] > v.gt;
      if (v && typeof v === "object" && "in" in v) return v.in.includes(row[k]);
      return row[k] === v;
    });
  const table = (rows: Row[], defaults: () => Row) => ({
    async findFirst({ where }: any) { return rows.find((r) => match(r, where)) ?? null; },
    async findMany({ where }: any) { return rows.filter((r) => match(r, where)); },
    async create({ data }: any) { const row = { id: `x${++seq}`, ...defaults(), ...data }; rows.push(row); return row; },
    async updateMany({ where, data }: any) {
      const hit = rows.filter((r) => match(r, where));
      hit.forEach((r) => Object.assign(r, data));
      return { count: hit.length };
    }
  });
  const offerApi = table(offers, () => ({ status: "SENT", startsAt: null, compensationNote: null, respondedAt: null, createdAt: new Date() }));
  const engagementApi = table(engagements, () => ({ status: "PENDING_CONFIRMATION" }));
  const prisma: any = {
    businessOffer: offerApi,
    businessEngagement: engagementApi,
    membership: {
      async findMany({ where }: any) {
        return memberships.filter((m) => m.userId === where.userId && m.orgId === where.orgId &&
          (where.status ? m.status === where.status : true) &&
          (where.org ? m.org.tenantId === where.org.tenantId : true));
      }
    },
    async $transaction(fn: any) { return fn({ businessOffer: offerApi, businessEngagement: engagementApi }); }
  };
  const audit: any = { async append(entry: Row) { audits.push(entry); } };
  return { service: new OffersService(prisma, audit), offers, engagements, audits, memberships };
}

const owner = { tenantId: "t1", orgId: "orgA", userId: "owner", roles: ["CLIENT"] };
const input = (recipientUserId = "ana") => ({ recipientUserId, positionTitle: "Pintor" });

test.beforeEach(() => { process.env.SEMSE_BUSINESS_OFFERS_ENABLED = "true"; });
test.after(() => { delete process.env.SEMSE_BUSINESS_OFFERS_ENABLED; });

test("AC-07: flag apagado -> 404 sin efectos", async () => {
  process.env.SEMSE_BUSINESS_OFFERS_ENABLED = "false";
  const w = makeWorld();
  await assert.rejects(w.service.create(owner, "orgA", "r", input()), { status: 404 });
  await assert.rejects(w.service.listMine({ userId: "ana" }), { status: 404 });
  assert.equal(w.offers.length, 0);
});

test("AC-01: otra Org -> 404; trabajador sin permiso -> 403", async () => {
  const w = makeWorld();
  await assert.rejects(w.service.create(owner, "orgB", "r", input()), { status: 404 });
  const worker = { tenantId: "t1", orgId: "orgA", userId: "ana", roles: ["WORKER"] };
  await assert.rejects(w.service.create(worker, "orgA", "r", input("bob")), { status: 403 });
  assert.equal(w.offers.length, 0);
});

test("solo a WORKER activo de la Org; no a si mismo; no a suspendido ni ajeno", async () => {
  const w = makeWorld();
  await assert.rejects(w.service.create(owner, "orgA", "r", input("carl")), { status: 422 });
  await assert.rejects(w.service.create(owner, "orgA", "r", input("stranger")), { status: 422 });
  await assert.rejects(w.service.create(owner, "orgA", "r", input("owner")), { status: 422 });
});

test("oferta vigente duplicada -> 409; audita business_offer.sent", async () => {
  const w = makeWorld();
  await w.service.create(owner, "orgA", "r1", input());
  await assert.rejects(w.service.create(owner, "orgA", "r2", input()), { status: 409 });
  assert.deepEqual(w.audits.map((a) => a.action), ["business_offer.sent"]);
});

test("AC-02: otro usuario no puede responder la oferta (404 neutro)", async () => {
  const w = makeWorld();
  const offer = await w.service.create(owner, "orgA", "r", input());
  await assert.rejects(w.service.respond({ userId: "bob" }, offer.offerId, "ACCEPT", "r"), { status: 404 });
  assert.equal(w.offers[0].status, "SENT");
});

test("AC-03/04: aceptar crea engagement pendiente (sin activar); repetir es idempotente", async () => {
  const w = makeWorld();
  const offer = await w.service.create(owner, "orgA", "r", input());
  assert.deepEqual(await w.service.respond({ userId: "ana" }, offer.offerId, "ACCEPT", "r"), { status: "ACCEPTED" });
  assert.deepEqual(await w.service.respond({ userId: "ana" }, offer.offerId, "ACCEPT", "r"), { status: "ACCEPTED" });
  assert.equal(w.engagements.length, 1);
  assert.equal(w.engagements[0].status, "PENDING_CONFIRMATION");
  assert.equal(w.memberships.filter((m) => m.userId === "ana").length, 1);
});

test("AC-03: aceptaciones concurrentes crean un solo engagement", async () => {
  const w = makeWorld();
  const offer = await w.service.create(owner, "orgA", "r", input());
  await Promise.all([
    w.service.respond({ userId: "ana" }, offer.offerId, "ACCEPT", "a"),
    w.service.respond({ userId: "ana" }, offer.offerId, "ACCEPT", "b")
  ]);
  assert.equal(w.engagements.length, 1);
});

test("rechazar no crea engagement; responder lo opuesto despues -> 410", async () => {
  const w = makeWorld();
  const offer = await w.service.create(owner, "orgA", "r", input());
  await w.service.respond({ userId: "ana" }, offer.offerId, "DECLINE", "r");
  assert.equal(w.engagements.length, 0);
  await assert.rejects(w.service.respond({ userId: "ana" }, offer.offerId, "ACCEPT", "r"), { status: 410 });
});

test("vencida o revocada -> 410 al responder", async () => {
  const w = makeWorld();
  const offer = await w.service.create(owner, "orgA", "r", input());
  w.offers[0].expiresAt = new Date(Date.now() - 1000);
  await assert.rejects(w.service.respond({ userId: "ana" }, offer.offerId, "ACCEPT", "r"), { status: 410 });

  const w2 = makeWorld();
  const o2 = await w2.service.create(owner, "orgA", "r", input());
  await w2.service.revoke(owner, "orgA", o2.offerId, "r");
  await assert.rejects(w2.service.respond({ userId: "ana" }, o2.offerId, "ACCEPT", "r"), { status: 410 });
});

test("AC-04: confirmar activa solo tras aceptar; no antes", async () => {
  const w = makeWorld();
  const offer = await w.service.create(owner, "orgA", "r", input());
  await assert.rejects(w.service.confirm(owner, "orgA", offer.offerId, "r"), { status: 409 });
  await w.service.respond({ userId: "ana" }, offer.offerId, "ACCEPT", "r");
  assert.deepEqual(await w.service.confirm(owner, "orgA", offer.offerId, "r"), { status: "ACTIVE" });
  assert.ok(w.engagements[0].legalConfirmedAt);
  await assert.rejects(w.service.confirm(owner, "orgA", offer.offerId, "r"), { status: 409 });
});

test("terminar engagement: una vez; no toca la Membership", async () => {
  const w = makeWorld();
  const offer = await w.service.create(owner, "orgA", "r", input());
  await w.service.respond({ userId: "ana" }, offer.offerId, "ACCEPT", "r");
  const id = w.engagements[0].id;
  await w.service.endEngagement(owner, "orgA", id, "fin de obra", "r");
  assert.equal(w.engagements[0].status, "ENDED");
  assert.equal(w.engagements[0].endedReason, "fin de obra");
  await assert.rejects(w.service.endEngagement(owner, "orgA", id, "otra", "r"), { status: 409 });
  assert.equal(w.memberships.filter((m) => m.userId === "ana" && m.status === "ACTIVE").length, 1);
});

test("mis ofertas: solo las propias", async () => {
  const w = makeWorld();
  await w.service.create(owner, "orgA", "r", input("ana"));
  await w.service.create(owner, "orgA", "r", input("bob"));
  const mine = await w.service.listMine({ userId: "ana" });
  assert.equal(mine.length, 1);
  assert.equal(mine[0].recipientUserId, "ana");
});

test("controller declara permisos RBAC", () => {
  for (const method of ["create", "list", "revoke", "confirm", "end"]) {
    const meta = Reflect.getMetadata(REQUIRED_PERMISSIONS_KEY, (OrgOffersController.prototype as any)[method]);
    assert.deepEqual(meta, ["org:offers:manage"]);
  }
});

test("OPEN-04: un PRO ya no gestiona ofertas (403) y OPS_ADMIN sí", async () => {
  const w = makeWorld();
  w.memberships.push({ userId: "pro1", orgId: "orgA", status: "ACTIVE", role: { key: "PRO" }, org: { tenantId: "t1" } });
  const pro = { tenantId: "t1", orgId: "orgA", userId: "pro1", roles: ["PRO"] };
  await assert.rejects(w.service.create(pro, "orgA", "r", input()), { status: 403 });
  assert.equal(w.offers.length, 0);
  w.memberships.push({ userId: "ops1", orgId: "orgA", status: "ACTIVE", role: { key: "OPS_ADMIN" }, org: { tenantId: "t1" } });
  const ops = { tenantId: "t1", orgId: "orgA", userId: "ops1", roles: ["OPS_ADMIN"] };
  const offer = await w.service.create(ops, "orgA", "r", input());
  assert.equal(offer.recipientUserId, "ana");
});

test("OPEN-03: la clasificación no se pide, no se guarda y no se expone", async () => {
  const w = makeWorld();
  const offer = await w.service.create(owner, "orgA", "r", input());
  assert.equal("classification" in offer, false);
  assert.equal(w.offers[0].classificationDeclared, "NOT_RECORDED");
});
