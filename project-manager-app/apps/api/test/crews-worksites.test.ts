import "reflect-metadata";

import test from "node:test";
import assert from "node:assert/strict";
import { REQUIRED_PERMISSIONS_KEY } from "../src/common/permissions.decorator.ts";
import { CrewsService } from "../dist/modules/organizations/crews.service.js";
import { OrgCrewsController } from "../dist/modules/organizations/crews.controller.js";

type Row = Record<string, any>;

function makeWorld() {
  let seq = 0;
  const worksites: Row[] = [];
  const crews: Row[] = [];
  const crewMembers: Row[] = [];
  const audits: Row[] = [];
  const memberships: Row[] = [
    { userId: "owner", orgId: "orgA", status: "ACTIVE", role: { key: "PRO" }, org: { tenantId: "t1" } },
    { userId: "sup", orgId: "orgA", status: "ACTIVE", role: { key: "WORKER" }, org: { tenantId: "t1" } },
    { userId: "ana", orgId: "orgA", status: "ACTIVE", role: { key: "WORKER" }, org: { tenantId: "t1" } },
    { userId: "bob", orgId: "orgA", status: "ACTIVE", role: { key: "WORKER" }, org: { tenantId: "t1" } },
    { userId: "carl", orgId: "orgA", status: "SUSPENDED", role: { key: "WORKER" }, org: { tenantId: "t1" } },
    { userId: "owner_b", orgId: "orgB", status: "ACTIVE", role: { key: "PRO" }, org: { tenantId: "t2" } },
    { userId: "ana", orgId: "orgB", status: "ACTIVE", role: { key: "WORKER" }, org: { tenantId: "t2" } }
  ];
  const match = (row: Row, where: Row): boolean =>
    Object.entries(where).every(([k, v]) => {
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
  const prisma: any = {
    worksite: table(worksites, () => ({ status: "ACTIVE", address: null, createdAt: new Date() })),
    crew: table(crews, () => ({ status: "ACTIVE", worksiteId: null, createdAt: new Date() })),
    crewMember: table(crewMembers, () => ({ status: "ACTIVE", addedAt: new Date() })),
    membership: {
      async findMany({ where }: any) {
        return memberships.filter((m) => m.userId === where.userId && m.orgId === where.orgId &&
          (where.status ? m.status === where.status : true) &&
          (where.org ? m.org.tenantId === where.org.tenantId : true));
      }
    }
  };
  const audit: any = { async append(entry: Row) { audits.push(entry); } };
  return { service: new CrewsService(prisma, audit), worksites, crews, crewMembers, audits, memberships };
}

const owner = { tenantId: "t1", orgId: "orgA", userId: "owner", roles: ["PRO"] };

test.beforeEach(() => { process.env.SEMSE_CREWS_ENABLED = "true"; });
test.after(() => { delete process.env.SEMSE_CREWS_ENABLED; });

test("flag apagado -> 404 sin efectos", async () => {
  process.env.SEMSE_CREWS_ENABLED = "false";
  const w = makeWorld();
  await assert.rejects(w.service.createWorksite(owner, "orgA", "r", { name: "Obra 1" }), { status: 404 });
  await assert.rejects(w.service.listMine({ tenantId: "t1", userId: "ana" }), { status: 404 });
  assert.equal(w.worksites.length, 0);
});

test("otra Org -> 404; trabajador sin permiso -> 403", async () => {
  const w = makeWorld();
  await assert.rejects(w.service.createWorksite(owner, "orgB", "r", { name: "Obra" }), { status: 404 });
  const worker = { tenantId: "t1", orgId: "orgA", userId: "ana", roles: ["WORKER"] };
  await assert.rejects(w.service.createWorksite(worker, "orgA", "r", { name: "Obra" }), { status: 403 });
});

test("crear obra y cuadrilla; el supervisor debe ser WORKER activo de la Org", async () => {
  const w = makeWorld();
  const site = await w.service.createWorksite(owner, "orgA", "r", { name: "Casa Lomas" });
  const crew = await w.service.createCrew(owner, "orgA", "r", { name: "Pintura", supervisorUserId: "sup", worksiteId: site.worksiteId });
  assert.equal(crew.supervisorUserId, "sup");
  await assert.rejects(w.service.createCrew(owner, "orgA", "r", { name: "X", supervisorUserId: "carl" }), { status: 422 });
  await assert.rejects(w.service.createCrew(owner, "orgA", "r", { name: "X", supervisorUserId: "stranger" }), { status: 422 });
  assert.deepEqual(w.audits.map((a) => a.action), ["worksite.created", "crew.created"]);
});

test("una obra de otra Org no se puede usar en la cuadrilla", async () => {
  const w = makeWorld();
  w.worksites.push({ id: "foreign", tenantId: "t2", orgId: "orgB", status: "ACTIVE", name: "Ajena" });
  await assert.rejects(w.service.createCrew(owner, "orgA", "r", { name: "X", supervisorUserId: "sup", worksiteId: "foreign" }), { status: 422 });
});

test("agregar miembro: solo WORKER activo de la Org; idempotente; cuadrilla ajena -> 404", async () => {
  const w = makeWorld();
  const crew = await w.service.createCrew(owner, "orgA", "r", { name: "C1", supervisorUserId: "sup" });
  await w.service.addMember(owner, "orgA", crew.crewId, "ana", "r");
  await w.service.addMember(owner, "orgA", crew.crewId, "ana", "r");
  assert.equal(w.crewMembers.filter((m) => m.userId === "ana").length, 1);
  await assert.rejects(w.service.addMember(owner, "orgA", crew.crewId, "carl", "r"), { status: 422 });
  await assert.rejects(w.service.addMember(owner, "orgB", crew.crewId, "ana", "r"), { status: 404 });
});

test("quitar miembro: una vez; la segunda -> 409", async () => {
  const w = makeWorld();
  const crew = await w.service.createCrew(owner, "orgA", "r", { name: "C1", supervisorUserId: "sup" });
  await w.service.addMember(owner, "orgA", crew.crewId, "ana", "r");
  await w.service.removeMember(owner, "orgA", crew.crewId, "ana", "r");
  await assert.rejects(w.service.removeMember(owner, "orgA", crew.crewId, "ana", "r"), { status: 409 });
});

test("roster: solo el supervisor de ESA cuadrilla (cross-crew -> 404)", async () => {
  const w = makeWorld();
  const c1 = await w.service.createCrew(owner, "orgA", "r", { name: "C1", supervisorUserId: "sup" });
  const c2 = await w.service.createCrew(owner, "orgA", "r", { name: "C2", supervisorUserId: "bob" });
  await w.service.addMember(owner, "orgA", c1.crewId, "ana", "r");
  const roster = await w.service.rosterForSupervisor({ tenantId: "t1", userId: "sup" }, c1.crewId);
  assert.deepEqual(roster.members.map((m: any) => m.userId), ["ana"]);
  await assert.rejects(w.service.rosterForSupervisor({ tenantId: "t1", userId: "sup" }, c2.crewId), { status: 404 });
  await assert.rejects(w.service.rosterForSupervisor({ tenantId: "t1", userId: "ana" }, c1.crewId), { status: 404 });
});

test("sesión obsoleta: si la Membership del supervisor ya no está ACTIVE, deja de ver el roster y sus cuadrillas", async () => {
  const w = makeWorld();
  const c1 = await w.service.createCrew(owner, "orgA", "r", { name: "C1", supervisorUserId: "sup" });
  await w.service.addMember(owner, "orgA", c1.crewId, "ana", "r");
  assert.equal((await w.service.listMine({ tenantId: "t1", userId: "sup" })).length, 1);
  w.memberships.find((m) => m.userId === "sup")!.status = "SUSPENDED";
  await assert.rejects(w.service.rosterForSupervisor({ tenantId: "t1", userId: "sup" }, c1.crewId), { status: 404 });
  assert.equal((await w.service.listMine({ tenantId: "t1", userId: "sup" })).length, 0);
  w.memberships.find((m) => m.userId === "ana" && m.orgId === "orgA")!.status = "REVOKED";
  assert.equal((await w.service.listMine({ tenantId: "t1", userId: "ana" })).length, 0);
});

test("N01: PRO ACTIVE no conserva autoridad de supervisor si WORKER queda suspendido", async () => {
  const w = makeWorld();
  const c1 = await w.service.createCrew(owner, "orgA", "r", { name: "C1", supervisorUserId: "sup" });
  w.memberships.push({ userId: "sup", orgId: "orgA", status: "ACTIVE", role: { key: "PRO" }, org: { tenantId: "t1" } });
  w.memberships.find((m) => m.userId === "sup" && m.role.key === "WORKER")!.status = "SUSPENDED";

  await assert.rejects(w.service.rosterForSupervisor({ tenantId: "t1", userId: "sup" }, c1.crewId), { status: 404 });
  assert.equal((await w.service.listMine({ tenantId: "t1", userId: "sup" })).length, 0);
});

test("mis cuadrillas: el miembro ve la suya con rol MEMBER; archivar una vez", async () => {
  const w = makeWorld();
  const c1 = await w.service.createCrew(owner, "orgA", "r", { name: "C1", supervisorUserId: "sup" });
  await w.service.addMember(owner, "orgA", c1.crewId, "ana", "r");
  const mine = await w.service.listMine({ tenantId: "t1", userId: "ana" });
  assert.equal(mine.length, 1);
  assert.equal(mine[0].myRole, "MEMBER");
  await w.service.archiveCrew(owner, "orgA", c1.crewId, "r");
  await assert.rejects(w.service.archiveCrew(owner, "orgA", c1.crewId, "r"), { status: 409 });
  assert.equal((await w.service.listMine({ tenantId: "t1", userId: "ana" })).length, 0);
});

test("N10: un mismo usuario en dos tenants no puede mezclar crews ni rosters entre sesiones", async () => {
  const w = makeWorld();
  const tenantA = await w.service.createCrew(owner, "orgA", "r-tenanta", { name: "Crew tenant A", supervisorUserId: "ana" });
  const ownerB = { tenantId: "t2", orgId: "orgB", userId: "owner_b", roles: ["PRO"] };
  const tenantB = await w.service.createCrew(ownerB, "orgB", "r-tenantb", { name: "Crew tenant B", supervisorUserId: "ana" });

  const visibleA = await w.service.listMine({ tenantId: "t1", userId: "ana" });
  const visibleB = await w.service.listMine({ tenantId: "t2", userId: "ana" });
  assert.deepEqual(visibleA.map((c) => c.crewId), [tenantA.crewId]);
  assert.deepEqual(visibleB.map((c) => c.crewId), [tenantB.crewId]);
  assert.equal(visibleA[0].myRole, "SUPERVISOR");
  assert.equal(visibleB[0].myRole, "SUPERVISOR");

  const rosterA = await w.service.rosterForSupervisor({ tenantId: "t1", userId: "ana" }, tenantA.crewId);
  const rosterB = await w.service.rosterForSupervisor({ tenantId: "t2", userId: "ana" }, tenantB.crewId);
  assert.equal(rosterA.crewId, tenantA.crewId);
  assert.equal(rosterB.crewId, tenantB.crewId);

  await assert.rejects(
    w.service.rosterForSupervisor({ tenantId: "t1", userId: "ana" }, tenantB.crewId),
    { status: 404 }
  );
  await assert.rejects(
    w.service.rosterForSupervisor({ tenantId: "t2", userId: "ana" }, tenantA.crewId),
    { status: 404 }
  );
});

test("controller declara permisos RBAC", () => {
  for (const method of ["createWorksite", "listWorksites", "createCrew", "listCrews", "addMember", "removeMember", "archive"]) {
    const meta = Reflect.getMetadata(REQUIRED_PERMISSIONS_KEY, (OrgCrewsController.prototype as any)[method]);
    assert.deepEqual(meta, ["org:crews:manage"]);
  }
});
