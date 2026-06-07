import test from "node:test";
import assert from "node:assert/strict";

import {
  todayISO,
  validateDueDate,
  normalizeBudget,
  parseTags,
  validateProjectData,
  filterAndSortProjects,
  normalizeProject,
  isOverdue,
  getDefaultFilters,
  normalizeViewFilters,
  normalizeFilterPresets,
  parseBackupPayload,
} from "../../logic.mjs";

test("todayISO, validateDueDate y normalizeBudget cubren ramas base", () => {
  assert.equal(todayISO(new Date("2026-03-04T12:00:00.000Z")), "2026-03-04");
  assert.equal(validateDueDate("2026-03-04"), true);
  assert.equal(validateDueDate("04/03/2026"), false);

  assert.equal(normalizeBudget("150"), 150);
  assert.equal(normalizeBudget(-1), 0);
  assert.equal(normalizeBudget("abc"), 0);
});

test("parseTags normaliza, quita duplicados y limita cantidad", () => {
  const tags = parseTags(" Web,api,web,  urgente ,cliente,qa,ux,ops,extra,one-more ");
  assert.deepEqual(tags, ["web", "api", "urgente", "cliente", "qa", "ux", "ops", "extra"]);
  assert.deepEqual(parseTags(undefined), []);
});

test("validateProjectData rechaza datos invalidos", () => {
  const missing = validateProjectData({
    name: "",
    owner: "",
    dueDate: "2026-03-12",
    priority: "alta",
    status: "pendiente",
    budget: 10,
  });
  assert.equal(missing.valid, false);

  const invalidDate = validateProjectData({
    name: "Proyecto A",
    owner: "Ana",
    dueDate: "12/03/2026",
    priority: "alta",
    status: "pendiente",
    budget: 10,
  });
  assert.equal(invalidDate.valid, false);
});

test("validateProjectData acepta datos validos", () => {
  const result = validateProjectData({
    name: "Proyecto A",
    owner: "Ana",
    dueDate: "2026-03-12",
    priority: "alta",
    status: "pendiente",
    budget: 10,
  });

  assert.equal(result.valid, true);
});

test("validateProjectData cubre ramas de prioridad, estado y presupuesto", () => {
  const invalidPriority = validateProjectData({
    name: "Proyecto A",
    owner: "Ana",
    dueDate: "2026-03-12",
    priority: "urgente",
    status: "pendiente",
    budget: 10,
  });
  assert.equal(invalidPriority.valid, false);
  assert.match(invalidPriority.message, /prioridad/i);

  const invalidStatus = validateProjectData({
    name: "Proyecto A",
    owner: "Ana",
    dueDate: "2026-03-12",
    priority: "alta",
    status: "bloqueado",
    budget: 10,
  });
  assert.equal(invalidStatus.valid, false);
  assert.match(invalidStatus.message, /estado/i);

  const invalidBudget = validateProjectData({
    name: "Proyecto A",
    owner: "Ana",
    dueDate: "2026-03-12",
    priority: "alta",
    status: "pendiente",
    budget: -5,
  });
  assert.equal(invalidBudget.valid, false);
  assert.match(invalidBudget.message, /presupuesto/i);
});

test("filterAndSortProjects filtra por texto, estado y ordena por prioridad", () => {
  const projects = [
    {
      id: "1",
      name: "Sitio Web",
      owner: "Ana",
      status: "pendiente",
      priority: "media",
      dueDate: "2026-03-20",
      tags: ["web"],
      description: "Landing",
      createdAt: 1,
    },
    {
      id: "2",
      name: "API Core",
      owner: "Bruno",
      status: "pendiente",
      priority: "alta",
      dueDate: "2026-03-10",
      tags: ["backend"],
      description: "Servicios",
      createdAt: 2,
    },
    {
      id: "3",
      name: "QA Sprint",
      owner: "Carla",
      status: "completado",
      priority: "baja",
      dueDate: "2026-03-01",
      tags: ["qa"],
      description: "Pruebas",
      createdAt: 3,
    },
  ];

  const filtered = filterAndSortProjects(projects, {
    search: "",
    status: "pendiente",
    priority: "todas",
    owner: "",
    sortKey: "priority",
  });

  assert.equal(filtered.length, 2);
  assert.equal(filtered[0].id, "2");
  assert.equal(filtered[1].id, "1");
});

test("normalizeProject corrige campos y isOverdue detecta vencidos", () => {
  const normalized = normalizeProject({
    id: 99,
    name: "  Proyecto Z  ",
    owner: "  Luis ",
    status: "inexistente",
    priority: "x",
    dueDate: "bad-date",
    budget: -10,
    tags: ["UI", " ui", ""],
    description: "  desc ",
  }, 1700000000000);

  assert.equal(normalized.name, "Proyecto Z");
  assert.equal(normalized.owner, "Luis");
  assert.equal(normalized.status, "pendiente");
  assert.equal(normalized.priority, "media");
  assert.equal(normalized.budget, 0);
  assert.deepEqual(normalized.tags, ["ui"]);

  const overdue = isOverdue({ ...normalized, dueDate: "2026-03-01", status: "pendiente" }, "2026-03-04");
  assert.equal(overdue, true);
});

test("normalizeProject cubre rutas nulas, faltantes y valores validos", () => {
  assert.equal(normalizeProject(null), null);
  assert.equal(normalizeProject({ id: "1", name: "A" }), null);

  const normalized = normalizeProject(
    {
      id: "42",
      name: "OK",
      owner: "Dev",
      status: "completado",
      priority: "alta",
      dueDate: "2026-03-12",
      budget: 50,
      tags: "no-array",
      description: "",
      createdAt: 10,
      updatedAt: 11,
    },
    1700000000000
  );

  assert.equal(normalized.status, "completado");
  assert.equal(normalized.priority, "alta");
  assert.equal(normalized.dueDate, "2026-03-12");
  assert.equal(normalized.budget, 50);
  assert.deepEqual(normalized.tags, []);
  assert.equal(normalized.description, "");
  assert.equal(normalized.createdAt, 10);
  assert.equal(normalized.updatedAt, 11);
});

test("filterAndSortProjects cubre ramas de orden por status/newest/name/dueDate", () => {
  const projects = [
    {
      id: "1",
      name: "Zeta",
      owner: "Ana",
      status: "en-progreso",
      priority: "media",
      dueDate: "2026-03-20",
      tags: ["web"],
      description: "A",
      createdAt: 1,
    },
    {
      id: "2",
      name: "Alfa",
      owner: "Ana",
      status: "pendiente",
      priority: "alta",
      dueDate: "2026-03-10",
      tags: ["api"],
      description: "B",
      createdAt: 3,
    },
    {
      id: "3",
      name: "Beta",
      owner: "Bruno",
      status: "completado",
      priority: "baja",
      dueDate: "2026-03-30",
      tags: ["qa"],
      description: "C",
      createdAt: 2,
    },
  ];

  const byStatus = filterAndSortProjects(projects, {
    search: "",
    status: "todos",
    priority: "todas",
    owner: "",
    sortKey: "status",
  });
  assert.deepEqual(byStatus.map((item) => item.id), ["2", "1", "3"]);

  const byNewest = filterAndSortProjects(projects, {
    search: "",
    status: "todos",
    priority: "todas",
    owner: "",
    sortKey: "newest",
  });
  assert.deepEqual(byNewest.map((item) => item.id), ["2", "3", "1"]);

  const byName = filterAndSortProjects(projects, {
    search: "",
    status: "todos",
    priority: "todas",
    owner: "",
    sortKey: "name",
  });
  assert.deepEqual(byName.map((item) => item.id), ["2", "3", "1"]);

  const byDueDate = filterAndSortProjects(projects, {
    search: "",
    status: "todos",
    priority: "todas",
    owner: "",
    sortKey: "dueDate",
  });
  assert.deepEqual(byDueDate.map((item) => item.id), ["2", "1", "3"]);
});

test("filterAndSortProjects cubre ramas de busqueda por owner/tag/description y filtros", () => {
  const projects = [
    {
      id: "a",
      name: "Portal",
      owner: "Marta",
      status: "pendiente",
      priority: "alta",
      dueDate: "2026-04-01",
      budget: 1200,
      tags: ["frontend"],
      description: "Implementar auth",
      createdAt: 1,
    },
    {
      id: "b",
      name: "Servicio",
      owner: "Nico",
      status: "en-progreso",
      priority: "media",
      dueDate: "2026-04-02",
      budget: 300,
      tags: ["backend"],
      description: "API interna",
      createdAt: 2,
    },
  ];

  const byOwnerSearch = filterAndSortProjects(projects, {
    search: "marta",
    status: "todos",
    priority: "todas",
    owner: "",
    sortKey: "dueDate",
  });
  assert.deepEqual(byOwnerSearch.map((item) => item.id), ["a"]);

  const byTagSearch = filterAndSortProjects(projects, {
    search: "backend",
    status: "todos",
    priority: "todas",
    owner: "",
    sortKey: "dueDate",
  });
  assert.deepEqual(byTagSearch.map((item) => item.id), ["b"]);

  const byDescriptionSearch = filterAndSortProjects(projects, {
    search: "auth",
    status: "todos",
    priority: "todas",
    owner: "",
    sortKey: "dueDate",
  });
  assert.deepEqual(byDescriptionSearch.map((item) => item.id), ["a"]);

  const byPriorityAndOwner = filterAndSortProjects(projects, {
    search: "",
    status: "todos",
    priority: "alta",
    owner: "mar",
    sortKey: "dueDate",
  });
  assert.deepEqual(byPriorityAndOwner.map((item) => item.id), ["a"]);

  const byExplicitTagFilter = filterAndSortProjects(projects, {
    search: "",
    status: "todos",
    priority: "todas",
    owner: "",
    tag: "front",
    sortKey: "dueDate",
  });
  assert.deepEqual(byExplicitTagFilter.map((item) => item.id), ["a"]);

  const byBudgetRange = filterAndSortProjects(projects, {
    search: "",
    status: "todos",
    priority: "todas",
    owner: "",
    budgetMin: "500",
    budgetMax: "1500",
    sortKey: "dueDate",
  });
  assert.deepEqual(byBudgetRange.map((item) => item.id), ["a"]);
});

test("normalización de filtros por vista y presets", () => {
  const defaults = getDefaultFilters();
  assert.equal(defaults.status, "todos");

  const normalizedViews = normalizeViewFilters({
    list: { status: "pendiente", owner: "Ana" },
    kanban: { priority: "alta" },
  });
  assert.equal(normalizedViews.list.status, "pendiente");
  assert.equal(normalizedViews.list.owner, "Ana");
  assert.equal(normalizedViews.kanban.priority, "alta");
  assert.equal(normalizedViews.calendar.sortBy, "dueDate");

  const presets = normalizeFilterPresets({
    "Equipo Ana": { status: "pendiente", view: "list" },
    "Urgentes K": { priority: "alta", view: "kanban" },
  });
  assert.equal(presets["Equipo Ana"].view, "list");
  assert.equal(presets["Urgentes K"].priority, "alta");
});

test("parseBackupPayload acepta formato legado y formato completo", () => {
  const legacy = parseBackupPayload([{ id: "1" }]);
  assert.equal(legacy.isValid, true);
  assert.equal(legacy.isLegacy, true);
  assert.equal(Array.isArray(legacy.projects), true);

  const full = parseBackupPayload({
    projects: [{ id: "2" }],
    filterPresets: { P1: { status: "pendiente", view: "list" } },
    viewFilters: { list: { status: "pendiente" } },
  });
  assert.equal(full.isValid, true);
  assert.equal(full.isLegacy, false);
  assert.equal(full.filterPresets.P1.view, "list");
  assert.equal(full.viewFilters.list.status, "pendiente");

  const invalid = parseBackupPayload("bad");
  assert.equal(invalid.isValid, false);
});
