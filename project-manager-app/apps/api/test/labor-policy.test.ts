import "reflect-metadata";

import test from "node:test";
import assert from "node:assert/strict";
import { REQUIRED_PERMISSIONS_KEY } from "../src/common/permissions.decorator.ts";
import { LaborPolicyService } from "../dist/modules/labor-engine/labor-policy.service.js";
import { computeLaborTime } from "../dist/modules/labor-engine/labor-policy.calc.js";
import { OrgLaborController } from "../dist/modules/labor-engine/labor-policy.controller.js";

type Row = Record<string, any>;

const at = (hhmm: string, day = "2026-10-19") => new Date(`${day}T${hhmm}:00.000Z`);

function makeWorld() {
  const policies: Row[] = [];
  const corrections: Row[] = [];
  const entries: Row[] = [
    { id: "e1", tenantId: "t1", orgId: "orgA", createdBy: "ana", status: "completed", startedAt: at("08:00"), endedAt: at("17:00"), breakMinutes: 60 },
    { id: "e2", tenantId: "t1", orgId: "orgA", createdBy: "ana", status: "running", startedAt: at("08:00"), endedAt: null, breakMinutes: 0 },
    { id: "e3", tenantId: "t1", orgId: "orgA", createdBy: "bob", status: "completed", startedAt: at("08:00"), endedAt: at("16:00"), breakMinutes: 30 }
  ];
  const audits: Row[] = [];
  const memberships: Row[] = [
    { userId: "boss", orgId: "orgA", status: "ACTIVE", role: { key: "CLIENT" }, org: { tenantId: "t1" } },
    { userId: "boss2", orgId: "orgA", status: "ACTIVE", role: { key: "OPS_ADMIN" }, org: { tenantId: "t1" } },
    { userId: "pro", orgId: "orgA", status: "ACTIVE", role: { key: "PRO" }, org: { tenantId: "t1" } },
    { userId: "ana", orgId: "orgA", status: "ACTIVE", role: { key: "WORKER" }, org: { tenantId: "t1" } }
  ];
  let seq = 0;
  const match = (row: Row, where: Row): boolean =>
    Object.entries(where).every(([k, v]) => row[k] === v);
  const table = (rows: Row[], defaults: () => Row) => ({
    async findFirst({ where, orderBy }: any) {
      let hit = rows.filter((r) => match(r, where));
      if (orderBy?.version === "desc") hit = [...hit].sort((a, b) => b.version - a.version);
      return hit[0] ?? null;
    },
    async findMany({ where }: any) { return rows.filter((r) => match(r, where)); },
    async create({ data }: any) {
      const row = { id: `x${++seq}`, ...defaults(), ...data };
      if (rows === policies && rows.some((r) => r.tenantId === row.tenantId && r.orgId === row.orgId && r.scopeKey === row.scopeKey && r.version === row.version)) {
        throw Object.assign(new Error("unique"), { code: "P2002" });
      }
      rows.push(row);
      return row;
    },
    async updateMany({ where, data }: any) {
      const hit = rows.filter((r) => match(r, where));
      hit.forEach((r) => Object.assign(r, data));
      return { count: hit.length };
    }
  });
  const api = {
    laborSchedulePolicy: table(policies, () => ({ status: "ACTIVE", createdAt: new Date(), supersededAt: null })),
    laborTimeCorrection: table(corrections, () => ({ status: "PENDING", createdAt: new Date(), reviewNote: null, reviewedAt: null })),
    timeEntry: table(entries, () => ({})),
    worksite: { async findFirst({ where }: any) { return where.id === "w1" && where.orgId === "orgA" ? { id: "w1" } : null; } },
    membership: {
      async findMany({ where }: any) {
        return memberships.filter((m) => m.userId === where.userId && m.orgId === where.orgId &&
          (where.status ? m.status === where.status : true) &&
          (where.org ? m.org.tenantId === where.org.tenantId : true));
      }
    }
  };
  const prisma: any = { ...api, async $transaction(fn: any) { return fn(api); } };
  const audit: any = { async append(entry: Row) { audits.push(entry); } };
  return { service: new LaborPolicyService(prisma, audit), policies, corrections, entries, audits };
}

const boss = { tenantId: "t1", orgId: "orgA", userId: "boss", roles: ["CLIENT"] };
const pro = { tenantId: "t1", orgId: "orgA", userId: "pro", roles: ["PRO"] };
const ana = { tenantId: "t1", userId: "ana" };
const policy = { name: "8x5", weekdays: [1, 2, 3, 4, 5], scheduledStartMinute: 480, scheduledEndMinute: 1020, expectedBreakMinutes: 60 };

test.beforeEach(() => { process.env.SEMSE_LABOR_POLICY_ENABLED = "true"; });
test.after(() => { delete process.env.SEMSE_LABOR_POLICY_ENABLED; });

// ---- cálculo puro ----
test("jornada 06:30-17:00 con 1h de pausa real = 9h30 trabajadas", () => {
  const r = computeLaborTime({ startedAt: at("06:30"), endedAt: at("17:00"), breakMinutes: 60 }, null);
  assert.equal(r.open, false);
  assert.equal(r.workedMinutes, 570);
  assert.equal(r.payableMinutes, 570);
});

test("4x10: 11h de presencia con 1h de descanso real = 10h trabajadas", () => {
  const r = computeLaborTime({ startedAt: at("07:00"), endedAt: at("18:00"), breakMinutes: 60 }, null);
  assert.equal(r.workedMinutes, 600);
});

test("un descanso no tomado no se descuenta", () => {
  const r = computeLaborTime({ startedAt: at("08:00"), endedAt: at("16:00"), breakMinutes: 0 }, { overtimeAfterMinutesPerDay: null });
  assert.equal(r.workedMinutes, 480);
  assert.equal(r.payableMinutes, 480);
});

test("overtime solo se propone y exige aprobación", () => {
  const r = computeLaborTime({ startedAt: at("07:00"), endedAt: at("18:00"), breakMinutes: 60 }, { overtimeAfterMinutesPerDay: 480 });
  assert.equal(r.overtimeCandidateMinutes, 120);
  assert.equal(r.overtimeNeedsApproval, true);
  assert.equal(r.payableMinutes, 600);
});

test("registro abierto: sin horas inventadas; fin antes del inicio es error", () => {
  const open = computeLaborTime({ startedAt: at("08:00"), endedAt: null, breakMinutes: 0 }, null);
  assert.equal(open.open, true);
  assert.equal(open.workedMinutes, null);
  assert.throws(() => computeLaborTime({ startedAt: at("09:00"), endedAt: at("08:00"), breakMinutes: 0 }, null), RangeError);
});

test("el descanso nunca supera lo transcurrido", () => {
  const r = computeLaborTime({ startedAt: at("08:00"), endedAt: at("08:30"), breakMinutes: 600 }, null);
  assert.equal(r.workedMinutes, 0);
});

// ---- política ----
test("flag apagado -> 404 sin efectos", async () => {
  process.env.SEMSE_LABOR_POLICY_ENABLED = "false";
  const w = makeWorld();
  await assert.rejects(w.service.createPolicy(boss, "orgA", "r", policy), { status: 404 });
  await assert.rejects(w.service.requestCorrection(ana, "r", { timeEntryId: "e1", breakMinutes: 30, reason: "me equivoqué" }), { status: 404 });
  assert.equal(w.policies.length, 0);
});

test("PRO no gestiona política (403); otra Org -> 404; CLIENT sí", async () => {
  const w = makeWorld();
  await assert.rejects(w.service.createPolicy(pro, "orgA", "r", policy), { status: 403 });
  await assert.rejects(w.service.createPolicy(boss, "orgB", "r", policy), { status: 404 });
  const created = await w.service.createPolicy(boss, "orgA", "r", policy);
  assert.equal(created.version, 1);
});

test("publicar de nuevo versiona: la anterior queda SUPERSEDED y se audita", async () => {
  const w = makeWorld();
  await w.service.createPolicy(boss, "orgA", "r1", policy);
  const v2 = await w.service.createPolicy(boss, "orgA", "r2", { ...policy, name: "4x10" });
  assert.equal(v2.version, 2);
  assert.deepEqual(w.policies.map((p) => p.status), ["SUPERSEDED", "ACTIVE"]);
  assert.deepEqual(w.audits.map((a) => a.action), ["labor_policy.created", "labor_policy.created"]);
});

test("política por obra exige que la obra sea de la Org; horarios y días validados", async () => {
  const w = makeWorld();
  await assert.rejects(w.service.createPolicy(boss, "orgA", "r", { ...policy, worksiteId: "ajena" }), { status: 422 });
  await assert.rejects(w.service.createPolicy(boss, "orgA", "r", { ...policy, weekdays: [9] }), { status: 422 });
  await assert.rejects(w.service.createPolicy(boss, "orgA", "r", { ...policy, scheduledEndMinute: 480 }), { status: 422 });
  assert.equal((await w.service.createPolicy(boss, "orgA", "r", { ...policy, worksiteId: "w1" })).worksiteId, "w1");
});

// ---- correcciones ----
test("solo corrige registros propios y terminados (404 / 422)", async () => {
  const w = makeWorld();
  await assert.rejects(w.service.requestCorrection(ana, "r", { timeEntryId: "e3", breakMinutes: 0, reason: "ajeno ajeno" }), { status: 404 });
  await assert.rejects(w.service.requestCorrection(ana, "r", { timeEntryId: "e2", endedAt: at("12:00"), reason: "sigue corriendo" }), { status: 422 });
});

test("corrección sin cambios, horas imposibles o duplicada pendiente se rechazan", async () => {
  const w = makeWorld();
  await assert.rejects(w.service.requestCorrection(ana, "r", { timeEntryId: "e1", reason: "sin cambio real" }), { status: 422 });
  await assert.rejects(w.service.requestCorrection(ana, "r", { timeEntryId: "e1", endedAt: at("07:00"), reason: "fin antes del inicio" }), { status: 422 });
  await w.service.requestCorrection(ana, "r", { timeEntryId: "e1", breakMinutes: 30, reason: "solo descansé media hora" });
  await assert.rejects(w.service.requestCorrection(ana, "r", { timeEntryId: "e1", breakMinutes: 45, reason: "otro intento" }), { status: 409 });
});

test("pedir corrección no cambia el registro y guarda el original", async () => {
  const w = makeWorld();
  const c = await w.service.requestCorrection(ana, "r", { timeEntryId: "e1", breakMinutes: 30, reason: "solo descansé media hora" });
  assert.equal(c.status, "PENDING");
  assert.equal(w.entries[0].breakMinutes, 60);
  assert.equal(c.original.breakMinutes, 60);
  assert.equal(c.proposed.breakMinutes, 30);
});

test("aprobar aplica el cambio con revisor y motivo; el original queda en la solicitud", async () => {
  const w = makeWorld();
  const c = await w.service.requestCorrection(ana, "r", { timeEntryId: "e1", breakMinutes: 30, reason: "solo descansé media hora" });
  const res = await w.service.review(boss, "orgA", c.correctionId, "APPROVE", "ok", "r2");
  assert.equal(res.status, "APPROVED");
  const entry = w.entries[0];
  assert.equal(entry.breakMinutes, 30);
  assert.equal(entry.durationMinutes, 510);
  assert.equal(entry.editedBy, "boss");
  assert.equal(entry.editReason, `labor_correction:${c.correctionId}`);
  assert.equal(w.corrections[0].originalBreakMinutes, 60);
  assert.deepEqual(w.audits.map((a) => a.action), ["labor_correction.requested", "labor_correction.approved"]);
});

test("rechazar no toca el registro; revisar dos veces -> 409", async () => {
  const w = makeWorld();
  const c = await w.service.requestCorrection(ana, "r", { timeEntryId: "e1", breakMinutes: 30, reason: "solo descansé media hora" });
  await w.service.review(boss, "orgA", c.correctionId, "REJECT", "no", "r2");
  assert.equal(w.entries[0].breakMinutes, 60);
  assert.equal(w.entries[0].editedBy, undefined);
  await assert.rejects(w.service.review(boss, "orgA", c.correctionId, "APPROVE", undefined, "r3"), { status: 409 });
});

test("el trabajador no revisa su propia corrección; PRO tampoco gestiona", async () => {
  const w = makeWorld();
  const c = await w.service.requestCorrection(ana, "r", { timeEntryId: "e1", breakMinutes: 30, reason: "solo descansé media hora" });
  const anaActor = { tenantId: "t1", orgId: "orgA", userId: "ana", roles: ["WORKER"] };
  await assert.rejects(w.service.review(anaActor, "orgA", c.correctionId, "APPROVE", undefined, "r"), { status: 403 });
  await assert.rejects(w.service.review(pro, "orgA", c.correctionId, "APPROVE", undefined, "r"), { status: 403 });
  assert.equal(w.corrections[0].status, "PENDING");
});

test("listados: el trabajador ve solo lo suyo; la Org ve su cola", async () => {
  const w = makeWorld();
  await w.service.requestCorrection(ana, "r", { timeEntryId: "e1", breakMinutes: 30, reason: "solo descansé media hora" });
  assert.equal((await w.service.listMine(ana)).length, 1);
  assert.equal((await w.service.listMine({ tenantId: "t1", userId: "bob" })).length, 0);
  assert.equal((await w.service.listForOrg(boss, "orgA", "PENDING")).length, 1);
  await assert.rejects(w.service.listForOrg(pro, "orgA"), { status: 403 });
});

test("controller declara permisos RBAC", () => {
  for (const method of ["createPolicy", "listPolicies", "listCorrections", "approve", "reject"]) {
    const meta = Reflect.getMetadata(REQUIRED_PERMISSIONS_KEY, (OrgLaborController.prototype as any)[method]);
    assert.deepEqual(meta, ["org:labor:manage"]);
  }
});
