import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  filterPlanningTasks,
  groupPlanningTasks,
  parsePlanningDueDate,
  planningProjectHref,
  planningTaskHref,
  PLANNING_STATUS_LABELS,
  PLANNING_PRIORITY_LABELS,
  type PlanningTask,
} from "../../apps/web/app/workspace/lib/planning-model.ts";

// Fixtures sintéticos exclusivamente para tests. IDs BuildOps y canónico distintos.
const buildOpsId = "11111111-1111-4111-8111-111111111111";
const canonicalId = "22222222-2222-4222-8222-222222222222";
const today = new Date(2026, 10, 14, 12, 0, 0);
function task(id: string, overrides: Partial<PlanningTask> = {}): PlanningTask {
  return {
    id, projectId: buildOpsId, title: `Tarea ${id}`, projectTitle: "Proyecto sintético",
    status: "todo", priority: "medium", dueDate: null, ...overrides,
  };
}
const ids = (tasks: readonly PlanningTask[]) => tasks.map((item) => item.id);

test("agrupa fechas reales anteriores, hoy/futuras y ausentes sin inventarlas", () => {
  const tasks = [
    task("tomorrow", { dueDate: "2026-11-15" }),
    task("none"),
    task("past", { dueDate: "2026-11-13" }),
    task("today", { dueDate: "2026-11-14" }),
    task("invalid", { dueDate: "no es una fecha" }),
  ];
  const groups = groupPlanningTasks(tasks, today);
  assert.deepEqual(ids(groups.overdue), ["past"]);
  assert.deepEqual(ids(groups.upcoming), ["today", "tomorrow"]);
  assert.deepEqual(ids(groups.undated), ["none", "invalid"]);
  assert.equal(parsePlanningDueDate(null).kind, "missing");
  assert.equal(parsePlanningDueDate("").kind, "invalid");
  assert.equal(parsePlanningDueDate("no es una fecha").kind, "invalid");
  assert.deepEqual(ids(tasks), ["tomorrow", "none", "past", "today", "invalid"]);
});

test("rechaza fechas imposibles y formatos ambiguos en lugar de normalizarlos", () => {
  for (const value of ["2026-02-29", "2026-02-30", "2026-13-01", "2026-00-01", "2026-11-00", "14/11/2026", "2026-11-14T25:00:00Z", "2026-02-30T08:00:00Z", "2026-11-14T10:00:00", "   "]) {
    assert.equal(parsePlanningDueDate(value).kind, "invalid", value);
  }
  assert.equal(parsePlanningDueDate("2024-02-29").kind, "valid");
  assert.equal(parsePlanningDueDate("2026-11-14T10:00:00.000Z").kind, "valid");
});

test("una fecha sin hora mantiene su día en la zona local del navegador", () => {
  const parsed = parsePlanningDueDate("2026-11-14");
  assert.equal(parsed.kind, "valid");
  if (parsed.kind !== "valid") return;
  assert.equal(parsed.date.getFullYear(), 2026);
  assert.equal(parsed.date.getMonth(), 10);
  assert.equal(parsed.date.getDate(), 14);
  assert.equal(parsed.date.getHours(), 0);
});

test("timestamp con offset usa el día local real y no el prefijo UTC", () => {
  const now = new Date(2026, 10, 14, 12);
  const due = "2026-11-14T01:00:00+14:00";
  const local = new Date(due);
  const start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const groups = groupPlanningTasks([task("offset", { dueDate: due })], now);
  assert.equal(groups.overdue.length, local < start ? 1 : 0);
  assert.equal(groups.upcoming.length, local < start ? 0 : 1);
});

test("límite de hoy es medianoche local, no últimas 24 horas", () => {
  const yesterday = new Date(2026, 10, 13, 23, 59);
  const morning = new Date(2026, 10, 14, 0, 1);
  const groups = groupPlanningTasks([
    task("yesterday", { dueDate: yesterday.toISOString() }),
    task("morning", { dueDate: morning.toISOString() }),
  ], today);
  assert.deepEqual(ids(groups.overdue), ["yesterday"]);
  assert.deepEqual(ids(groups.upcoming), ["morning"]);
});

test("filtros locales combinan proyecto BuildOps, estado y prioridad sin mutar tareas", () => {
  const tasks = [
    task("match", { status: "blocked", priority: "urgent" }),
    task("state", { status: "todo", priority: "urgent" }),
    task("priority", { status: "blocked", priority: "high" }),
    task("canonical", { projectId: canonicalId, status: "blocked", priority: "urgent" }),
    task("standalone", { projectId: null, status: "blocked", priority: "urgent" }),
  ];
  assert.deepEqual(ids(filterPlanningTasks(tasks, { projectId: buildOpsId, status: "blocked", priority: "urgent" })), ["match"]);
  assert.deepEqual(ids(filterPlanningTasks(tasks, { projectId: canonicalId })), ["canonical"]);
  assert.deepEqual(ids(filterPlanningTasks(tasks, { projectId: "unassigned" })), ["standalone"]);
  assert.deepEqual(ids(filterPlanningTasks(tasks, {})), ids(tasks));
});

test("estados y prioridades reales siguen visibles, incluidos terminales", () => {
  assert.deepEqual(Object.keys(PLANNING_STATUS_LABELS), ["todo", "in_progress", "blocked", "done", "canceled"]);
  assert.deepEqual(Object.keys(PLANNING_PRIORITY_LABELS), ["low", "medium", "high", "urgent"]);
  for (const status of Object.keys(PLANNING_STATUS_LABELS) as PlanningTask["status"][]) {
    const tasks = [task(status, { status, dueDate: "2026-11-13" })];
    assert.deepEqual(ids(filterPlanningTasks(tasks, { status })), [status]);
    assert.deepEqual(ids(groupPlanningTasks(tasks, today).overdue), [status]);
    assert.equal(tasks[0].status, status);
  }
  for (const priority of Object.keys(PLANNING_PRIORITY_LABELS) as PlanningTask["priority"][]) {
    assert.equal(filterPlanningTasks([task(priority, { priority })], { priority }).length, 1);
  }
});

test("enlaces a detalle codifican IDs reales y jamás intercambian canonicalProjectId", () => {
  const project = { id: buildOpsId, canonicalProjectId: canonicalId };
  assert.equal(planningProjectHref(project), `/buildops/projects/${buildOpsId}`);
  assert.ok(!planningProjectHref(project).includes(canonicalId));
  assert.equal(planningProjectHref({ id: "project/a?b", canonicalProjectId: null }), "/buildops/projects/project%2Fa%3Fb");
  assert.equal(planningTaskHref({ id: "task/a?b" }), "/buildops/tasks/task%2Fa%3Fb");
});

test("panel declara rol nullable y evita montar consultas/enlaces para rol desconocido", () => {
  const source = readFileSync(new URL("../../apps/web/app/workspace/components/PlanningPanel.tsx", import.meta.url), "utf8");
  assert.match(source, /export function PlanningPanel\(/);
  assert.match(source, /role: WorkspaceRole \| null/);
  const guard = source.indexOf("if (!role)");
  const authorized = source.indexOf("return <AuthorizedPlanningPanel");
  assert.ok(guard >= 0 && authorized > guard);
  assert.match(source.slice(guard, authorized), /PanelState/);
  assert.doesNotMatch(source.slice(guard, authorized), /href=|fetch|useWorkspaceQuery/);
  assert.match(source, /key=\{role\}/);
  assert.match(source, /useCallback/);
  assert.match(source, /useWorkspaceQuery/);
  assert.match(source, /fetchBuildOpsTasks/);
  assert.match(source, /fetchBuildOpsProjects/);
  assert.match(source, /isWorkspaceAccessError/);
});

test("panel es solo lectura, muestra fechas inválidas, blocked/urgent y destinos existentes", () => {
  const source = readFileSync(new URL("../../apps/web/app/workspace/components/PlanningPanel.tsx", import.meta.url), "utf8");
  assert.match(source, /Fecha inválida/);
  assert.match(source, /blocked/);
  assert.match(source, /urgent/);
  assert.match(source, /canonicalProjectId/);
  assert.match(source, /\/buildops\/tasks/);
  assert.match(source, /\/buildops\/milestones/);
  assert.match(source, /min-h-11/);
  assert.doesNotMatch(source, /missionId|localStorage|sessionStorage|createBuildOps|approveClientPlan|draggable|onDrag|method:\s*["'](?:POST|PATCH|PUT|DELETE)/);
});
