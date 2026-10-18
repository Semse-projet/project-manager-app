import "reflect-metadata";

import test from "node:test";
import assert from "node:assert/strict";
import { DailyReportsService, dayWindow, hashSnapshot, stableStringify } from "../dist/modules/daily-reports/daily-reports.service.js";

type Row = Record<string, any>;

const at = (hhmm: string, day = "2026-10-19") => new Date(`${day}T${hhmm}:00.000Z`);

function makeWorld() {
  const reports: Row[] = [];
  const audits: Row[] = [];
  const crews: Row[] = [
    { id: "c1", tenantId: "t1", orgId: "orgA", worksiteId: "w1", supervisorUserId: "sup", status: "ACTIVE" },
    { id: "c2", tenantId: "t1", orgId: "orgA", worksiteId: null, supervisorUserId: "sup2", status: "ACTIVE" },
    { id: "cx", tenantId: "t2", orgId: "orgB", worksiteId: null, supervisorUserId: "supb", status: "ACTIVE" }
  ];
  const crewMembers: Row[] = [
    { crewId: "c1", userId: "ana", status: "ACTIVE" },
    { crewId: "c1", userId: "bob", status: "ACTIVE" },
    { crewId: "c1", userId: "old", status: "REMOVED" }
  ];
  const entries: Row[] = [
    { id: "e1", tenantId: "t1", orgId: "orgA", createdBy: "ana", status: "completed", startedAt: at("08:00"), endedAt: at("17:00"), breakMinutes: 60, editedBy: null },
    { id: "e2", tenantId: "t1", orgId: "orgA", createdBy: "bob", status: "running", startedAt: at("08:00"), endedAt: null, breakMinutes: 0, editedBy: null },
    { id: "e3", tenantId: "t1", orgId: "orgA", createdBy: "ana", status: "deleted", startedAt: at("18:00"), endedAt: at("19:00"), breakMinutes: 0, editedBy: null },
    { id: "e4", tenantId: "t1", orgId: "orgA", createdBy: "ana", status: "completed", startedAt: at("08:00", "2026-10-18"), endedAt: at("12:00", "2026-10-18"), breakMinutes: 0, editedBy: null },
    { id: "e5", tenantId: "t1", orgId: "orgA", createdBy: "old", status: "completed", startedAt: at("08:00"), endedAt: at("12:00"), breakMinutes: 0, editedBy: null }
  ];
  const tasks: Row[] = [
    { id: "task1", tenantId: "t1", orgId: "orgA", title: "Pintar", assignedTo: "ana", completedAt: at("15:00") },
    { id: "task2", tenantId: "t1", orgId: "orgA", title: "Ayer", assignedTo: "ana", completedAt: at("15:00", "2026-10-18") }
  ];
  const memberships: Row[] = [
    { userId: "sup", orgId: "orgA", status: "ACTIVE", role: { key: "WORKER" }, org: { tenantId: "t1" } },
    { userId: "sup2", orgId: "orgA", status: "ACTIVE", role: { key: "WORKER" }, org: { tenantId: "t1" } },
    { userId: "boss", orgId: "orgA", status: "ACTIVE", role: { key: "CLIENT" }, org: { tenantId: "t1" } },
    { userId: "ghost", orgId: "orgA", status: "SUSPENDED", role: { key: "WORKER" }, org: { tenantId: "t1" } }
  ];
  let seq = 0;
  const cond = (row: Row, key: string, v: any): boolean => {
    if (v && typeof v === "object" && !(v instanceof Date)) {
      if ("in" in v) return v.in.includes(row[key]);
      if ("not" in v) return row[key] !== v.not;
      if ("gte" in v || "lt" in v) return (v.gte === undefined || row[key] >= v.gte) && (v.lt === undefined || row[key] < v.lt);
    }
    return row[key] === v;
  };
  const match = (row: Row, where: Row): boolean => Object.entries(where).every(([k, v]) => cond(row, k, v));
  const table = (rows: Row[], defaults: () => Row) => ({
    async findFirst({ where }: any) { return rows.find((r) => match(r, where)) ?? null; },
    async findMany({ where }: any) { return rows.filter((r) => match(r, where)); },
    async create({ data }: any) { const row = { id: `r${++seq}`, ...defaults(), ...data }; rows.push(row); return row; },
    async updateMany({ where, data }: any) {
      const hit = rows.filter((r) => match(r, where));
      hit.forEach((r) => Object.assign(r, data));
      return { count: hit.length };
    }
  });
  const prisma: any = {
    crew: table(crews, () => ({})),
    crewMember: table(crewMembers, () => ({})),
    timeEntry: table(entries, () => ({})),
    jobTask: table(tasks, () => ({})),
    dailyReport: table(reports, () => ({ status: "DRAFT", reviewedByUserId: null, reviewedAt: null, reviewNote: null, publishedAt: null })),
    membership: {
      async findMany({ where }: any) {
        return memberships.filter((m) => m.userId === where.userId && m.orgId === where.orgId &&
          (where.status ? m.status === where.status : true) &&
          (where.org ? m.org.tenantId === where.org.tenantId : true));
      }
    }
  };
  const audit: any = { async append(entry: Row) { audits.push(entry); } };
  return { service: new DailyReportsService(prisma, audit), reports, entries, audits, crewMembers };
}

const sup = { tenantId: "t1", userId: "sup", roles: ["WORKER"] };
const boss = { tenantId: "t1", userId: "boss", roles: ["CLIENT"] };
const input = { reportDate: "2026-10-19" };

test.beforeEach(() => { process.env.SEMSE_DAILY_REPORTS_ENABLED = "true"; });
test.after(() => { delete process.env.SEMSE_DAILY_REPORTS_ENABLED; });

test("hash estable: no depende del orden de las claves", () => {
  assert.equal(stableStringify({ b: 1, a: [2, { d: 1, c: 2 }] }), stableStringify({ a: [2, { c: 2, d: 1 }], b: 1 }));
  assert.equal(hashSnapshot({ x: 1, y: 2 }), hashSnapshot({ y: 2, x: 1 }));
  assert.notEqual(hashSnapshot({ x: 1 }), hashSnapshot({ x: 2 }));
});

test("ventana del día respeta la zona y rechaza fechas imposibles", () => {
  const w = dayWindow("2026-10-19", -360);
  assert.equal(w.start.toISOString(), "2026-10-19T06:00:00.000Z");
  assert.equal(w.end.toISOString(), "2026-10-20T06:00:00.000Z");
  assert.throws(() => dayWindow("2026-02-31", 0), { status: 422 });
  assert.throws(() => dayWindow("19/10/2026", 0), { status: 422 });
});

test("AC-01 flag apagado -> 404 sin efectos", async () => {
  process.env.SEMSE_DAILY_REPORTS_ENABLED = "false";
  const w = makeWorld();
  await assert.rejects(w.service.generate(sup, "c1", "r", input), { status: 404 });
  assert.equal(w.reports.length, 0);
});

test("AC-02 alcance: su cuadrilla sí; otra cuadrilla 403; otro tenant 404; membresía suspendida 404", async () => {
  const w = makeWorld();
  await assert.rejects(w.service.generate(sup, "c2", "r", input), { status: 403 });
  await assert.rejects(w.service.generate(sup, "cx", "r", input), { status: 404 });
  await assert.rejects(w.service.generate({ tenantId: "t1", userId: "ghost", roles: ["WORKER"] }, "c1", "r", input), { status: 404 });
  assert.equal(w.reports.length, 0);
  await w.service.generate(boss, "c1", "r", input);
  assert.equal(w.reports.length, 1);
});

test("AC-03 horas reales por trabajador, sin inventar: abierto sin horas, borrado y otro día fuera", async () => {
  const w = makeWorld();
  const r: any = await w.service.generate(sup, "c1", "r", input);
  const ana = r.snapshot.workers.find((x: any) => x.userId === "ana");
  const bob = r.snapshot.workers.find((x: any) => x.userId === "bob");
  assert.equal(ana.workedMinutes, 480);
  assert.equal(ana.entries.length, 1);
  assert.equal(bob.workedMinutes, 0);
  assert.equal(bob.entries[0].workedMinutes, null);
  assert.equal(r.snapshot.openEntries, 1);
  assert.equal(r.snapshot.crewWorkedMinutes, 480);
  assert.deepEqual(r.snapshot.sources.timeEntryIds, ["e1", "e2"]);
  assert.equal(r.snapshot.workers.some((x: any) => x.userId === "old"), false);
});

test("AC-04 tareas cerradas ese día y limitaciones declaradas", async () => {
  const w = makeWorld();
  const r: any = await w.service.generate(sup, "c1", "r", input);
  assert.deepEqual(r.snapshot.tasksCompleted.map((t: any) => t.taskId), ["task1"]);
  assert.ok(r.snapshot.limitations.length >= 3);
});

test("AC-05 el hash coincide con el contenido y cambia si cambian los datos", async () => {
  const w = makeWorld();
  const first: any = await w.service.generate(sup, "c1", "r1", input);
  assert.equal(first.contentHash, hashSnapshot(first.snapshot));
  w.entries[0].breakMinutes = 30;
  const second: any = await w.service.generate(sup, "c1", "r2", input);
  assert.equal(w.reports.length, 1);
  assert.notEqual(second.contentHash, first.contentHash);
  assert.equal(second.contentHash, hashSnapshot(second.snapshot));
});

test("AC-06 el generador no revisa su propio reporte; un trabajador sin permiso tampoco", async () => {
  const w = makeWorld();
  const r: any = await w.service.generate(boss, "c1", "r", input);
  await assert.rejects(w.service.review(boss, r.reportId, "APPROVE", undefined, "r"), { status: 403 });
  await assert.rejects(w.service.review(sup, r.reportId, "APPROVE", undefined, "r"), { status: 403 });
  assert.equal(w.reports[0].status, "DRAFT");
});

test("AC-07 revisar congela: aprobar -> REVIEWED, ya no se regenera ni se revisa de nuevo", async () => {
  const w = makeWorld();
  const r: any = await w.service.generate(sup, "c1", "r", input);
  await assert.rejects(w.service.review(boss, r.reportId, "RETURN", undefined, "r"), { status: 422 });
  const res = await w.service.review(boss, r.reportId, "APPROVE", "ok", "r2");
  assert.equal(res.status, "REVIEWED");
  assert.equal(w.reports[0].reviewedByUserId, "boss");
  await assert.rejects(w.service.generate(sup, "c1", "r3", input), { status: 409 });
  await assert.rejects(w.service.review(boss, r.reportId, "APPROVE", undefined, "r4"), { status: 409 });
});

test("AC-07 devolver deja el borrador con el motivo y permite regenerar", async () => {
  const w = makeWorld();
  const r: any = await w.service.generate(sup, "c1", "r", input);
  const res = await w.service.review(boss, r.reportId, "RETURN", "falta la hora de bob", "r2");
  assert.equal(res.status, "DRAFT");
  assert.equal(w.reports[0].reviewNote, "falta la hora de bob");
  await w.service.generate(sup, "c1", "r3", input);
  assert.equal(w.reports.length, 1);
});

test("AC-08 publicar solo un reporte revisado; audita todo el ciclo", async () => {
  const w = makeWorld();
  const r: any = await w.service.generate(sup, "c1", "r", input);
  await assert.rejects(w.service.publish(boss, r.reportId, "r"), { status: 409 });
  await w.service.review(boss, r.reportId, "APPROVE", undefined, "r2");
  const pub = await w.service.publish(boss, r.reportId, "r3");
  assert.equal(pub.status, "PUBLISHED");
  assert.deepEqual(w.audits.map((a) => a.action), ["daily_report.generated", "daily_report.reviewed", "daily_report.published"]);
  await assert.rejects(w.service.publish(boss, r.reportId, "r4"), { status: 409 });
});

test("listar y leer exigen el alcance de la cuadrilla", async () => {
  const w = makeWorld();
  await w.service.generate(sup, "c1", "r", input);
  const list: any[] = await w.service.listForCrew(sup, "c1");
  assert.equal(list.length, 1);
  assert.equal("snapshot" in list[0], false);
  const one: any = await w.service.getForCrew(sup, "c1", "2026-10-19");
  assert.ok(one.snapshot);
  await assert.rejects(w.service.listForCrew(sup, "c2"), { status: 403 });
  await assert.rejects(w.service.getForCrew(sup, "c1", "2026-01-01"), { status: 404 });
});
