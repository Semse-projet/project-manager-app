import "reflect-metadata";

import test from "node:test";
import assert from "node:assert/strict";
import { BusinessOsToolsService } from "../dist/modules/prometeo/business-os-tools.service.js";
import { PROMETEO_TOOL_REGISTRY, findPrometeoToolDescriptor } from "../dist/modules/prometeo/prometeo-tool-registry.js";
import { evaluatePrometeoToolPolicy } from "../dist/modules/prometeo/tool-governance/tool-governance.policy.js";

type Row = Record<string, any>;

function makeWorld() {
  const allocations: Row[] = [
    { id: "a1", tenantId: "t1", crewId: "c1", userId: "ana", taskId: "task1", status: "BLOCKED", statusNote: "falta material", assignedAt: new Date("2026-10-19") },
    { id: "a2", tenantId: "t1", crewId: "c1", userId: "ana", taskId: "task2", status: "ASSIGNED", statusNote: null, assignedAt: new Date("2026-10-19") },
    { id: "a3", tenantId: "t1", crewId: "c1", userId: "ana", taskId: "task3", status: "RELEASED", statusNote: null, assignedAt: new Date("2026-10-19") },
    { id: "a4", tenantId: "t1", crewId: "c1", userId: "bob", taskId: "task1", status: "ASSIGNED", statusNote: null, assignedAt: new Date("2026-10-19") }
  ];
  const tasks: Row[] = [
    { id: "task1", tenantId: "t1", orgId: "orgA", title: "Instalar lámparas", priority: "high", status: "pending", dueDate: null, entityType: "Crew", entityId: "c1" },
    { id: "task2", tenantId: "t1", orgId: "orgA", title: "Pintar", priority: "medium", status: "pending", dueDate: null, entityType: "Crew", entityId: "c1" },
    { id: "task3", tenantId: "t1", orgId: "orgA", title: "Limpieza", priority: "low", status: "pending", dueDate: null, entityType: "Crew", entityId: "c1" },
    { id: "otra", tenantId: "t1", orgId: "orgA", title: "De otra cuadrilla", priority: "low", status: "pending", dueDate: null, entityType: "Crew", entityId: "c2" }
  ];
  const crews: Row[] = [
    { id: "c1", tenantId: "t1", orgId: "orgA", supervisorUserId: "sup", status: "ACTIVE" },
    { id: "c2", tenantId: "t1", orgId: "orgA", supervisorUserId: "sup2", status: "ACTIVE" }
  ];
  const memberships: Row[] = [
    { userId: "sup", orgId: "orgA", status: "ACTIVE", role: { key: "WORKER" }, org: { tenantId: "t1" } },
    { userId: "boss", orgId: "orgA", status: "ACTIVE", role: { key: "CLIENT" }, org: { tenantId: "t1" } },
    { userId: "ana", orgId: "orgA", status: "ACTIVE", role: { key: "WORKER" }, org: { tenantId: "t1" } },
    { userId: "ghost", orgId: "orgA", status: "SUSPENDED", role: { key: "WORKER" }, org: { tenantId: "t1" } }
  ];
  const experiences: Row[] = [
    { userId: "ana", status: "CONFIRMED", trade: "Pintura", decidedAt: new Date("2026-03-10T12:00:00Z") },
    { userId: "ana", status: "REJECTED", trade: "Electricidad", decidedAt: new Date("2026-03-11T12:00:00Z") },
    { userId: "bob", status: "CONFIRMED", trade: "Plomería", decidedAt: new Date("2026-03-12T12:00:00Z") }
  ];
  const reports: Row[] = [
    {
      tenantId: "t1", crewId: "c1", reportDate: "2026-10-19", status: "DRAFT", contentHash: "abc123",
      snapshot: {
        crewWorkedMinutes: 480, openEntries: 1,
        workers: [{ userId: "ana", workedMinutes: 480, openEntries: 0 }, { userId: "bob", workedMinutes: 0, openEntries: 1 }],
        tasksCompleted: [{ title: "Pintar" }],
        limitations: ["No calcula nómina.", "No usa ubicación."]
      }
    }
  ];
  const match = (row: Row, where: Row): boolean =>
    Object.entries(where).every(([k, v]) => (v && typeof v === "object" && "in" in (v as Row) ? (v as Row).in.includes(row[k]) : row[k] === v));
  const table = (rows: Row[]) => ({
    async findFirst({ where }: any) { return rows.find((r) => match(r, where)) ?? null; },
    async findMany({ where }: any) { return rows.filter((r) => match(r, where)); }
  });
  const prisma: any = {
    taskAllocation: table(allocations),
    jobTask: table(tasks),
    crew: table(crews),
    skillExperience: table(experiences),
    dailyReport: table(reports),
    membership: {
      async findMany({ where }: any) {
        return memberships.filter((m) => m.userId === where.userId && m.orgId === where.orgId &&
          (where.status ? m.status === where.status : true) &&
          (where.org ? m.org.tenantId === where.org.tenantId : true));
      }
    }
  };
  return { service: new BusinessOsToolsService(prisma), allocations, reports };
}

const actor = (userId: string, roles: string[] = ["WORKER"]) => ({ tenantId: "t1", orgId: "orgA", userId, roles });

test.beforeEach(() => { process.env.SEMSE_PROMETEO_BUSINESS_OS_ENABLED = "true"; });
test.after(() => { delete process.env.SEMSE_PROMETEO_BUSINESS_OS_ENABLED; });

// ---- registro ----
test("AC-01 las herramientas de lectura no piden aprobación y las acciones están desactivadas", () => {
  const bo = PROMETEO_TOOL_REGISTRY.filter((t) => t.namespace === "business_os");
  const reads = bo.filter((t) => t.mode === "read");
  const writes = bo.filter((t) => t.mode !== "read");
  assert.deepEqual(reads.map((t) => t.name).sort(), ["crew_blocked", "crew_tasks", "draft_report_summary", "my_assignments", "my_skills"]);
  for (const t of reads) assert.equal(t.approvalPolicy, "none", t.name);
  assert.deepEqual(writes.map((t) => t.name).sort(), ["assign_task", "release_task"]);
  for (const t of writes) {
    assert.equal(t.adapterPending, true, t.name);
    assert.notEqual(t.approvalPolicy, "none", t.name);
  }
  assert.ok(findPrometeoToolDescriptor("business_os", "my_assignments"));
});

test("AC-01 ninguna herramienta prohibida está registrada", () => {
  const words = new Set(PROMETEO_TOOL_REGISTRY.filter((t) => t.namespace === "business_os").flatMap((t) => t.name.split("_")));
  for (const forbidden of ["hire", "sign", "approve", "grant", "certify", "publish", "escrow", "hours", "correct", "review", "fire"]) {
    assert.equal(words.has(forbidden), false, forbidden);
  }
});

test("AC-02 la política deja pasar las lecturas y exige aprobación a las acciones", () => {
  const read = findPrometeoToolDescriptor("business_os", "my_assignments")!;
  assert.equal(evaluatePrometeoToolPolicy({ actorRoles: ["WORKER"], descriptor: read }).decision, "allow");
  const write = findPrometeoToolDescriptor("business_os", "assign_task")!;
  assert.equal(evaluatePrometeoToolPolicy({ actorRoles: ["WORKER"], descriptor: write }).decision, "deny");
  assert.equal(evaluatePrometeoToolPolicy({ actorRoles: ["CLIENT"], descriptor: write }).decision, "require_approval");
});

// ---- flag ----
test("AC-03 flag apagado -> todas las herramientas devuelven bloqueo, sin leer datos", async () => {
  process.env.SEMSE_PROMETEO_BUSINESS_OS_ENABLED = "false";
  const w = makeWorld();
  for (const result of [
    await w.service.myAssignments(actor("ana")),
    await w.service.mySkills(actor("ana")),
    await w.service.crewTasks(actor("sup"), { crewId: "c1" }),
    await w.service.crewBlocked(actor("sup"), { crewId: "c1" }),
    await w.service.draftReportSummary(actor("sup"), { crewId: "c1", reportDate: "2026-10-19" })
  ]) {
    assert.ok("__blockedReason" in (result as object));
  }
});

// ---- lectura propia ----
test("AC-04 mis asignaciones: solo las mías, sin las liberadas, con título", async () => {
  const w = makeWorld();
  const mine: any[] = (await w.service.myAssignments(actor("ana"))) as any[];
  assert.deepEqual(mine.map((m) => m.allocationId).sort(), ["a1", "a2"]);
  assert.equal(mine.find((m) => m.allocationId === "a1").taskTitle, "Instalar lámparas");
  const bob: any[] = (await w.service.myAssignments(actor("bob"))) as any[];
  assert.deepEqual(bob.map((m) => m.allocationId), ["a4"]);
});

test("AC-05 mi experiencia: solo lo confirmado y mío, sin niveles", async () => {
  const w = makeWorld();
  const s: any = await w.service.mySkills(actor("ana"));
  assert.deepEqual(s.trades.map((t: any) => [t.trade, t.confirmedCount]), [["pintura", 1]]);
  assert.equal(JSON.stringify(s).includes("level"), false);
});

// ---- alcance de cuadrilla ----
test("AC-06 tareas y bloqueos de cuadrilla: su supervisor o un gestor; otros 403/404", async () => {
  const w = makeWorld();
  assert.equal(((await w.service.crewTasks(actor("sup"), { crewId: "c1" })) as any[]).length, 3);
  assert.equal(((await w.service.crewTasks(actor("boss", ["CLIENT"]), { crewId: "c1" })) as any[]).length, 3);
  await assert.rejects(w.service.crewTasks(actor("sup"), { crewId: "c2" }), { status: 403 });
  await assert.rejects(w.service.crewTasks(actor("ana"), { crewId: "c1" }), { status: 403 });
  await assert.rejects(w.service.crewTasks(actor("ghost"), { crewId: "c1" }), { status: 404 });
  await assert.rejects(w.service.crewBlocked(actor("ana"), { crewId: "c1" }), { status: 403 });
  await assert.rejects(w.service.crewTasks(actor("sup"), { crewId: "nada" }), { status: 404 });
});

test("AC-07 bloqueos: solo informa lo bloqueado y no cambia nada", async () => {
  const w = makeWorld();
  const blocked: any[] = (await w.service.crewBlocked(actor("sup"), { crewId: "c1" })) as any[];
  assert.deepEqual(blocked.map((b) => [b.allocationId, b.reason, b.taskTitle]), [["a1", "falta material", "Instalar lámparas"]]);
  assert.equal(w.allocations.find((a) => a.id === "a1")!.status, "BLOCKED");
});

// ---- borrador ----
test("AC-08 borrador del reporte: determinista, marcado para revisión humana y sin tocar el reporte", async () => {
  const w = makeWorld();
  const before = JSON.stringify(w.reports);
  const d: any = await w.service.draftReportSummary(actor("sup"), { crewId: "c1", reportDate: "2026-10-19" });
  assert.equal(d.draft, true);
  assert.equal(d.requiresHumanReview, true);
  assert.equal(d.basedOnReportHash, "abc123");
  assert.ok(d.text.includes("8.00 h"));
  assert.ok(d.text.includes("abierto"));
  assert.ok(d.text.includes("Limitaciones"));
  assert.equal(JSON.stringify(w.reports), before);
  const again: any = await w.service.draftReportSummary(actor("sup"), { crewId: "c1", reportDate: "2026-10-19" });
  assert.equal(again.text, d.text);
});

test("AC-08 sin reporte generado no se inventa nada; fecha inválida y otra cuadrilla se rechazan", async () => {
  const w = makeWorld();
  const none: any = await w.service.draftReportSummary(actor("sup"), { crewId: "c1", reportDate: "2026-01-01" });
  assert.ok("__blockedReason" in none);
  await assert.rejects(w.service.draftReportSummary(actor("sup"), { crewId: "c1", reportDate: "mañana" }), { status: 404 });
  await assert.rejects(w.service.draftReportSummary(actor("sup"), { crewId: "c2", reportDate: "2026-10-19" }), { status: 403 });
});
