"use strict";

import {
  STATUS_ORDER,
  PRIORITY_RANK,
  todayISO,
  validateProjectData,
  normalizeProject,
  normalizeBudget,
  parseTags,
  filterAndSortProjects,
  isOverdue,
  getDefaultFilters,
  normalizeViewFilters,
  normalizeFilterPresets,
  parseBackupPayload,
} from "./logic.mjs";

const STORAGE_KEY = "project_manager_projects_v2";
const FILTER_PRESETS_KEY = "project_manager_filter_presets_v1";
const VIEW_FILTERS_KEY = "project_manager_view_filters_v1";
const LEGACY_STORAGE_KEYS = ["project_manager_projects", "project_manager_projects_v1"];
const MAX_FILE_SIZE_BYTES = 2 * 1024 * 1024;

const form = document.getElementById("project-form");
const statusMessage = document.getElementById("app-status");

const inputs = {
  id: document.getElementById("project-id"),
  name: document.getElementById("name"),
  owner: document.getElementById("owner"),
  status: document.getElementById("status"),
  priority: document.getElementById("priority"),
  dueDate: document.getElementById("dueDate"),
  budget: document.getElementById("budget"),
  tags: document.getElementById("tags"),
  description: document.getElementById("description"),
};

const submitBtn = document.getElementById("submit-btn");
const formTitle = document.getElementById("form-title");
const cancelEditBtn = document.getElementById("cancel-edit");

const listView = document.getElementById("list-view");
const kanbanView = document.getElementById("kanban-view");
const calendarView = document.getElementById("calendar-view");
const calendarGrid = document.getElementById("calendar-grid");
const calendarLabel = document.getElementById("calendar-label");
const calendarPrevBtn = document.getElementById("calendar-prev");
const calendarNextBtn = document.getElementById("calendar-next");
const kanbanColumns = {
  pendiente: document.getElementById("kanban-pendiente"),
  "en-progreso": document.getElementById("kanban-en-progreso"),
  completado: document.getElementById("kanban-completado"),
};

const searchInput = document.getElementById("search");
const filterStatus = document.getElementById("filter-status");
const filterPriority = document.getElementById("filter-priority");
const filterOwner = document.getElementById("filter-owner");
const filterTag = document.getElementById("filter-tag");
const filterBudgetMin = document.getElementById("filter-budget-min");
const filterBudgetMax = document.getElementById("filter-budget-max");
const sortBy = document.getElementById("sort-by");
const projectCount = document.getElementById("project-count");
const filterPreset = document.getElementById("filter-preset");
const savePresetBtn = document.getElementById("save-preset");
const deletePresetBtn = document.getElementById("delete-preset");
const helpShortcutsBtn = document.getElementById("help-shortcuts");
const shortcutsModal = document.getElementById("shortcuts-modal");
const closeShortcutsBtn = document.getElementById("close-shortcuts");

const resetFiltersBtn = document.getElementById("reset-filters");
const clearCompletedBtn = document.getElementById("clear-completed");
const undoActionBtn = document.getElementById("undo-action");
const exportBtn = document.getElementById("export-btn");
const importFileInput = document.getElementById("import-file");

const viewListBtn = document.getElementById("view-list");
const viewKanbanBtn = document.getElementById("view-kanban");
const viewCalendarBtn = document.getElementById("view-calendar");

const metrics = {
  total: document.getElementById("metric-total"),
  progress: document.getElementById("metric-progress"),
  overdue: document.getElementById("metric-overdue"),
  completion: document.getElementById("metric-completion"),
  budgetTotal: document.getElementById("metric-budget-total"),
  budgetPending: document.getElementById("metric-budget-pending"),
  budgetProgress: document.getElementById("metric-budget-progress"),
  budgetCompleted: document.getElementById("metric-budget-completed"),
};
const ownerBudgetList = document.getElementById("owner-budget-list");

const state = {
  projects: loadProjects(),
  currentView: "list",
  filterPresets: loadFilterPresets(),
  viewFilters: loadViewFilters(),
  undoSnapshot: null,
  undoLabel: "",
  calendarCursor: (() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), 1);
  })(),
};

function setStatusMessage(message, type = "info") {
  statusMessage.textContent = message;
  statusMessage.dataset.type = type;
}

function cloneJSON(value) {
  return JSON.parse(JSON.stringify(value));
}

function setUndoSnapshot(label) {
  state.undoSnapshot = {
    projects: cloneJSON(state.projects),
    filterPresets: cloneJSON(state.filterPresets),
    viewFilters: cloneJSON(state.viewFilters),
  };
  state.undoLabel = label;
  undoActionBtn.disabled = false;
}

function clearUndoSnapshot() {
  state.undoSnapshot = null;
  state.undoLabel = "";
  undoActionBtn.disabled = true;
}

function restoreSnapshot(snapshot) {
  state.projects = snapshot.projects || [];
  state.filterPresets = snapshot.filterPresets || {};
  state.viewFilters = normalizeViewFilters(snapshot.viewFilters);

  const okProjects = saveProjects();
  const okPresets = saveFilterPresets();
  const okViews = saveViewFilters();

  if (okProjects && okPresets && okViews) {
    applyViewFilters(state.currentView);
    renderPresetOptions();
    clearPresetSelection();
    render();
  }
}

function undoLastAction() {
  if (!state.undoSnapshot) {
    setStatusMessage("No hay acciones para deshacer.", "info");
    return;
  }

  restoreSnapshot(state.undoSnapshot);
  const label = state.undoLabel || "última acción";
  clearUndoSnapshot();
  setStatusMessage(`Se deshizo: ${label}.`, "success");
}

function safeJSONParse(raw, fallback = null) {
  try {
    return JSON.parse(raw);
  } catch {
    return fallback;
  }
}

function readStorage(key) {
  try {
    return localStorage.getItem(key);
  } catch {
    setStatusMessage("No se pudo leer almacenamiento local.", "error");
    return null;
  }
}

function writeStorage(key, value) {
  try {
    localStorage.setItem(key, value);
    return true;
  } catch {
    setStatusMessage("No se pudo guardar. Revisa espacio de almacenamiento.", "error");
    return false;
  }
}

function saveProjects() {
  return writeStorage(STORAGE_KEY, JSON.stringify(state.projects));
}

function loadFilterPresets() {
  const raw = readStorage(FILTER_PRESETS_KEY);
  if (!raw) return {};

  const parsed = safeJSONParse(raw, {});
  return normalizeFilterPresets(parsed);
}

function saveFilterPresets() {
  return writeStorage(FILTER_PRESETS_KEY, JSON.stringify(state.filterPresets));
}

function loadViewFilters() {
  const raw = readStorage(VIEW_FILTERS_KEY);
  const defaults = normalizeViewFilters({});

  if (!raw) return defaults;
  const parsed = safeJSONParse(raw, null);
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return defaults;
  return normalizeViewFilters(parsed);
}

function saveViewFilters() {
  return writeStorage(VIEW_FILTERS_KEY, JSON.stringify(state.viewFilters));
}

function loadProjects() {
  const keys = [STORAGE_KEY, ...LEGACY_STORAGE_KEYS];

  for (const key of keys) {
    const raw = readStorage(key);
    if (!raw) continue;

    const parsed = safeJSONParse(raw, []);
    if (!Array.isArray(parsed)) continue;

    const normalized = parsed.map((item) => normalizeProject(item)).filter(Boolean);
    if (normalized.length && key !== STORAGE_KEY) {
      writeStorage(STORAGE_KEY, JSON.stringify(normalized));
    }
    return normalized;
  }

  return [];
}

function formatDate(dateString) {
  const date = new Date(`${dateString}T00:00:00`);
  if (Number.isNaN(date.getTime())) return "Sin fecha";

  return new Intl.DateTimeFormat("es-ES", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(date);
}

function getMonthLabel(date) {
  return new Intl.DateTimeFormat("es-ES", {
    month: "long",
    year: "numeric",
  }).format(date);
}

function daysUntil(dateIso) {
  const target = new Date(`${dateIso}T00:00:00`);
  const today = new Date(`${todayISO()}T00:00:00`);
  const diffMs = target.getTime() - today.getTime();
  return Math.round(diffMs / (1000 * 60 * 60 * 24));
}

function buildMonthMatrix(cursorDate) {
  const year = cursorDate.getFullYear();
  const month = cursorDate.getMonth();
  const firstDayOfMonth = new Date(year, month, 1);
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const startWeekDay = (firstDayOfMonth.getDay() + 6) % 7;

  const cells = [];
  for (let i = 0; i < startWeekDay; i += 1) {
    cells.push(null);
  }
  for (let day = 1; day <= daysInMonth; day += 1) {
    cells.push(new Date(year, month, day));
  }
  while (cells.length % 7 !== 0) {
    cells.push(null);
  }
  return cells;
}

function formatMoney(value) {
  return new Intl.NumberFormat("es-ES", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(value || 0);
}

function getStatusLabel(status) {
  if (status === "en-progreso") return "En progreso";
  return status.charAt(0).toUpperCase() + status.slice(1);
}

function getPriorityLabel(priority) {
  return priority.charAt(0).toUpperCase() + priority.slice(1);
}

function getFilteredProjects() {
  return filterAndSortProjects(state.projects, {
    search: searchInput.value,
    status: filterStatus.value,
    priority: filterPriority.value,
    owner: filterOwner.value,
    tag: filterTag.value,
    budgetMin: filterBudgetMin.value,
    budgetMax: filterBudgetMax.value,
    sortKey: sortBy.value,
  });
}

function getCurrentFilters() {
  return {
    search: searchInput.value,
    status: filterStatus.value,
    priority: filterPriority.value,
    owner: filterOwner.value,
    tag: filterTag.value,
    budgetMin: filterBudgetMin.value,
    budgetMax: filterBudgetMax.value,
    sortBy: sortBy.value,
  };
}

function applyFilterControls(filters) {
  searchInput.value = String(filters.search || "");
  filterStatus.value = String(filters.status || "todos");
  filterPriority.value = String(filters.priority || "todas");
  filterOwner.value = String(filters.owner || "");
  filterTag.value = String(filters.tag || "");
  filterBudgetMin.value = String(filters.budgetMin || "");
  filterBudgetMax.value = String(filters.budgetMax || "");
  sortBy.value = String(filters.sortBy || "dueDate");
}

function persistCurrentViewFilters() {
  state.viewFilters[state.currentView] = getCurrentFilters();
  saveViewFilters();
}

function applyViewFilters(view) {
  const nextFilters = state.viewFilters[view] || getDefaultFilters();
  applyFilterControls(nextFilters);
}

function clearPresetSelection() {
  if (filterPreset.value) {
    filterPreset.value = "";
  }
}

function applyFiltersFromPreset(preset) {
  applyFilterControls(preset);
  persistCurrentViewFilters();
  render();
}

function renderPresetOptions() {
  const previousValue = filterPreset.value;
  filterPreset.innerHTML = '<option value="">Sin preset</option>';

  Object.keys(state.filterPresets)
    .sort((a, b) => a.localeCompare(b, "es", { sensitivity: "base" }))
    .forEach((name) => {
      const preset = state.filterPresets[name];
      if (preset?.view && preset.view !== state.currentView) return;
      const option = document.createElement("option");
      option.value = name;
      option.textContent = name;
      filterPreset.appendChild(option);
    });

  if (previousValue && state.filterPresets[previousValue]) {
    filterPreset.value = previousValue;
  }
}

function buildTagList(tags) {
  if (!tags.length) return null;
  const wrapper = document.createElement("div");
  wrapper.className = "tags";
  tags.forEach((tag) => {
    const span = document.createElement("span");
    span.className = "tag";
    span.textContent = `#${tag}`;
    wrapper.appendChild(span);
  });
  return wrapper;
}

function createButton(label, action, classes = "icon-btn") {
  const button = document.createElement("button");
  button.className = classes;
  button.type = "button";
  button.dataset.action = action;
  button.textContent = label;
  return button;
}

function createProjectCard(project, compact) {
  const card = document.createElement("article");
  card.className = `project-card${compact ? " compact" : ""}`;
  card.dataset.id = project.id;

  if (isOverdue(project)) card.classList.add("overdue");

  const title = document.createElement("h3");
  title.textContent = project.name;

  const meta = document.createElement("p");
  meta.className = "meta";
  meta.textContent = `Responsable: ${project.owner}`;

  const badges = document.createElement("div");
  badges.className = "badges";

  const statusBadge = document.createElement("span");
  statusBadge.className = "badge status-badge";
  statusBadge.dataset.status = project.status;
  statusBadge.textContent = getStatusLabel(project.status);

  const priorityBadge = document.createElement("span");
  priorityBadge.className = "badge priority-badge";
  priorityBadge.dataset.priority = project.priority;
  priorityBadge.textContent = `Prioridad ${getPriorityLabel(project.priority)}`;

  const description = document.createElement("p");
  description.className = "description";
  description.textContent = project.description || "Sin descripción";

  const info = document.createElement("p");
  info.className = "meta mono";
  info.textContent = `Entrega: ${formatDate(project.dueDate)} | Presupuesto: ${formatMoney(project.budget)}`;

  badges.append(statusBadge, priorityBadge);

  const actions = document.createElement("div");
  actions.className = "project-actions";
  actions.append(
    createButton("Editar", "edit"),
    createButton("Duplicar", "duplicate"),
    createButton("Estado", "toggle-status"),
    createButton("Eliminar", "delete", "icon-btn danger")
  );

  card.append(title, meta, badges, description, info);

  const tags = buildTagList(project.tags);
  if (tags) card.appendChild(tags);

  card.appendChild(actions);
  return card;
}

function renderList(items) {
  listView.innerHTML = "";

  if (!items.length) {
    const empty = document.createElement("p");
    empty.className = "empty";
    empty.textContent = "No hay proyectos para mostrar.";
    listView.appendChild(empty);
    return;
  }

  const grid = document.createElement("div");
  grid.className = "project-grid";
  items.forEach((project) => grid.appendChild(createProjectCard(project, false)));
  listView.appendChild(grid);
}

function renderKanban(items) {
  Object.values(kanbanColumns).forEach((column) => {
    column.innerHTML = "";
  });

  STATUS_ORDER.forEach((status) => {
    const statusItems = items.filter((project) => project.status === status);

    if (!statusItems.length) {
      const empty = document.createElement("p");
      empty.className = "empty small";
      empty.textContent = "Sin proyectos";
      kanbanColumns[status].appendChild(empty);
      return;
    }

    statusItems.forEach((project) => {
      kanbanColumns[status].appendChild(createProjectCard(project, true));
    });
  });
}

function renderCalendar(items) {
  calendarGrid.innerHTML = "";
  const weekdayLabels = ["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"];
  weekdayLabels.forEach((label) => {
    const head = document.createElement("div");
    head.className = "calendar-weekday";
    head.setAttribute("role", "columnheader");
    head.textContent = label;
    calendarGrid.appendChild(head);
  });

  const cells = buildMonthMatrix(state.calendarCursor);
  const byDate = new Map();
  items.forEach((project) => {
    if (!byDate.has(project.dueDate)) byDate.set(project.dueDate, []);
    byDate.get(project.dueDate).push(project);
  });

  cells.forEach((dateCell) => {
    const box = document.createElement("div");
    box.className = "calendar-cell";
    box.setAttribute("role", "gridcell");

    if (!dateCell) {
      box.classList.add("muted");
      box.setAttribute("aria-hidden", "true");
      calendarGrid.appendChild(box);
      return;
    }

    const iso = dateCell.toISOString().slice(0, 10);
    box.setAttribute("aria-label", `Día ${dateCell.getDate()} de ${getMonthLabel(state.calendarCursor)}`);
    const day = document.createElement("strong");
    day.textContent = String(dateCell.getDate());
    box.appendChild(day);

    const itemsInDay = byDate.get(iso) || [];
    if (!itemsInDay.length) {
      const hint = document.createElement("small");
      hint.className = "calendar-empty";
      hint.textContent = "Sin entregas";
      box.appendChild(hint);
    } else {
      const hasOverdue = itemsInDay.some((project) => project.status !== "completado" && daysUntil(project.dueDate) < 0);
      const hasDueSoon = itemsInDay.some((project) => {
        const remaining = daysUntil(project.dueDate);
        return project.status !== "completado" && remaining >= 0 && remaining <= 3;
      });

      if (hasOverdue) box.classList.add("calendar-cell-overdue");
      else if (hasDueSoon) box.classList.add("calendar-cell-due-soon");

      itemsInDay.slice(0, 3).forEach((project) => {
        const chip = document.createElement("p");
        chip.className = "calendar-chip";
        chip.dataset.status = project.status;
        chip.dataset.priority = project.priority;
        chip.textContent = project.name;
        chip.title = `${project.name} (${project.owner})`;
        box.appendChild(chip);
      });
      if (itemsInDay.length > 3) {
        const extra = document.createElement("small");
        extra.className = "calendar-extra";
        extra.textContent = `+${itemsInDay.length - 3} más`;
        box.appendChild(extra);
      }
    }

    calendarGrid.appendChild(box);
  });

  calendarLabel.textContent = getMonthLabel(state.calendarCursor);
}

function renderMetrics() {
  const total = state.projects.length;
  const inProgress = state.projects.filter((project) => project.status === "en-progreso").length;
  const overdue = state.projects.filter((project) => isOverdue(project)).length;
  const completed = state.projects.filter((project) => project.status === "completado").length;
  const completion = total === 0 ? 0 : Math.round((completed / total) * 100);
  const budgetTotal = state.projects.reduce((acc, project) => acc + (project.budget || 0), 0);
  const budgetPending = state.projects
    .filter((project) => project.status === "pendiente")
    .reduce((acc, project) => acc + (project.budget || 0), 0);
  const budgetProgress = state.projects
    .filter((project) => project.status === "en-progreso")
    .reduce((acc, project) => acc + (project.budget || 0), 0);
  const budgetCompleted = state.projects
    .filter((project) => project.status === "completado")
    .reduce((acc, project) => acc + (project.budget || 0), 0);

  metrics.total.textContent = String(total);
  metrics.progress.textContent = String(inProgress);
  metrics.overdue.textContent = String(overdue);
  metrics.completion.textContent = `${completion}%`;
  metrics.budgetTotal.textContent = formatMoney(budgetTotal);
  metrics.budgetPending.textContent = formatMoney(budgetPending);
  metrics.budgetProgress.textContent = formatMoney(budgetProgress);
  metrics.budgetCompleted.textContent = formatMoney(budgetCompleted);

  const ownerBudgetMap = state.projects.reduce((acc, project) => {
    const owner = project.owner || "Sin responsable";
    acc.set(owner, (acc.get(owner) || 0) + (project.budget || 0));
    return acc;
  }, new Map());

  const ownerRows = [...ownerBudgetMap.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5);

  ownerBudgetList.innerHTML = "";
  if (!ownerRows.length) {
    const empty = document.createElement("li");
    empty.className = "owner-budget-item";
    empty.textContent = "Sin datos de presupuesto.";
    ownerBudgetList.appendChild(empty);
    return;
  }

  ownerRows.forEach(([owner, value]) => {
    const row = document.createElement("li");
    row.className = "owner-budget-item";

    const name = document.createElement("span");
    name.textContent = owner;
    const amount = document.createElement("strong");
    amount.textContent = formatMoney(value);

    row.append(name, amount);
    ownerBudgetList.appendChild(row);
  });
}

function render() {
  const visibleProjects = getFilteredProjects();
  renderList(visibleProjects);
  renderKanban(visibleProjects);
  renderCalendar(visibleProjects);
  renderMetrics();

  projectCount.textContent = `${visibleProjects.length} proyecto${visibleProjects.length === 1 ? "" : "s"} visibles`;
}

function resetFormState() {
  form.reset();
  inputs.id.value = "";
  inputs.dueDate.value = todayISO();
  inputs.budget.value = "0";

  formTitle.textContent = "Nuevo proyecto";
  submitBtn.textContent = "Guardar proyecto";
  cancelEditBtn.classList.add("hidden");
}

function loadProjectIntoForm(projectId) {
  const project = state.projects.find((item) => item.id === projectId);
  if (!project) return;

  inputs.id.value = project.id;
  inputs.name.value = project.name;
  inputs.owner.value = project.owner;
  inputs.status.value = project.status;
  inputs.priority.value = project.priority;
  inputs.dueDate.value = project.dueDate;
  inputs.budget.value = String(project.budget);
  inputs.tags.value = project.tags.join(", ");
  inputs.description.value = project.description;

  formTitle.textContent = "Editando proyecto";
  submitBtn.textContent = "Actualizar proyecto";
  cancelEditBtn.classList.remove("hidden");
  form.scrollIntoView({ behavior: "smooth", block: "start" });
}

function cycleStatus(currentStatus) {
  const currentIndex = STATUS_ORDER.indexOf(currentStatus);
  const nextIndex = (currentIndex + 1) % STATUS_ORDER.length;
  return STATUS_ORDER[nextIndex];
}

function performCardAction(eventTarget) {
  const button = eventTarget.closest("button[data-action]");
  if (!button) return false;

  const card = button.closest(".project-card");
  if (!card) return false;

  const projectId = card.dataset.id;
  const action = button.dataset.action;

  if (action === "edit") {
    loadProjectIntoForm(projectId);
    return true;
  }

  if (action === "delete") {
    const confirmed = window.confirm("¿Eliminar este proyecto? Esta acción no se puede deshacer.");
    if (!confirmed) return true;

    setUndoSnapshot("eliminar proyecto");
    state.projects = state.projects.filter((project) => project.id !== projectId);
    if (inputs.id.value === projectId) resetFormState();
    saveProjects();
    setStatusMessage("Proyecto eliminado.", "success");
    render();
    return true;
  }

  if (action === "toggle-status") {
    setUndoSnapshot("cambiar estado");
    state.projects = state.projects.map((project) => {
      if (project.id !== projectId) return project;
      return { ...project, status: cycleStatus(project.status), updatedAt: Date.now() };
    });

    saveProjects();
    setStatusMessage("Estado actualizado.", "success");
    render();
    return true;
  }

  if (action === "duplicate") {
    const source = state.projects.find((project) => project.id === projectId);
    if (!source) return true;

    setUndoSnapshot("duplicar proyecto");
    const duplicate = {
      ...source,
      id: crypto.randomUUID(),
      name: `${source.name} (Copia)`,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
    state.projects.push(duplicate);
    saveProjects();
    setStatusMessage("Proyecto duplicado.", "success");
    render();
    return true;
  }

  return false;
}

function openShortcutsModal() {
  shortcutsModal.classList.remove("hidden");
}

function closeShortcutsModal() {
  shortcutsModal.classList.add("hidden");
}

function setView(view) {
  persistCurrentViewFilters();
  state.currentView = view;
  applyViewFilters(view);
  renderPresetOptions();
  clearPresetSelection();
  const listActive = view === "list";
  const kanbanActive = view === "kanban";
  const calendarActive = view === "calendar";

  listView.classList.toggle("hidden", !listActive);
  kanbanView.classList.toggle("hidden", !kanbanActive);
  calendarView.classList.toggle("hidden", !calendarActive);

  viewListBtn.classList.toggle("active", listActive);
  viewKanbanBtn.classList.toggle("active", kanbanActive);
  viewCalendarBtn.classList.toggle("active", calendarActive);

  viewListBtn.setAttribute("aria-selected", String(listActive));
  viewKanbanBtn.setAttribute("aria-selected", String(kanbanActive));
  viewCalendarBtn.setAttribute("aria-selected", String(calendarActive));
}

function debounce(fn, delayMs = 200) {
  let timeoutId = null;
  return (...args) => {
    clearTimeout(timeoutId);
    timeoutId = setTimeout(() => fn(...args), delayMs);
  };
}

function resetFilters() {
  applyFilterControls(getDefaultFilters());
  filterPreset.value = "";
  persistCurrentViewFilters();
  render();
}

function saveCurrentPreset() {
  const name = window.prompt("Nombre del preset de filtros:");
  if (!name) return;

  const cleanName = name.trim();
  if (!cleanName) return;

  setUndoSnapshot(`guardar preset "${cleanName}"`);
  state.filterPresets[cleanName] = {
    ...getCurrentFilters(),
    view: state.currentView,
  };
  if (saveFilterPresets()) {
    renderPresetOptions();
    filterPreset.value = cleanName;
    setStatusMessage(`Preset "${cleanName}" guardado.`, "success");
  }
}

function deleteCurrentPreset() {
  const name = filterPreset.value;
  if (!name) {
    setStatusMessage("Selecciona un preset para borrar.", "info");
    return;
  }

  const confirmed = window.confirm(`¿Borrar preset "${name}"?`);
  if (!confirmed) return;

  setUndoSnapshot(`borrar preset "${name}"`);
  delete state.filterPresets[name];
  if (saveFilterPresets()) {
    renderPresetOptions();
    filterPreset.value = "";
    setStatusMessage(`Preset "${name}" eliminado.`, "success");
  }
}

function isTypingTarget(element) {
  if (!element) return false;
  if (element.isContentEditable) return true;
  const tag = element.tagName;
  return tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT";
}

function bindKeyboardShortcuts() {
  window.addEventListener("keydown", (event) => {
    if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "z") {
      event.preventDefault();
      undoLastAction();
      return;
    }

    if (event.metaKey || event.ctrlKey || event.altKey) return;

    if (event.key === "/" && !isTypingTarget(document.activeElement)) {
      event.preventDefault();
      searchInput.focus();
      searchInput.select();
      return;
    }

    if (event.key.toLowerCase() === "n" && !isTypingTarget(document.activeElement)) {
      event.preventDefault();
      resetFormState();
      inputs.name.focus();
      form.scrollIntoView({ behavior: "smooth", block: "start" });
      setStatusMessage("Formulario listo para nuevo proyecto.", "info");
      return;
    }

    if (!isTypingTarget(document.activeElement)) {
      const key = event.key.toLowerCase();
      if (event.key === "?" || key === "h") {
        event.preventDefault();
        openShortcutsModal();
        return;
      }
      if (key === "l") {
        event.preventDefault();
        setView("list");
        setStatusMessage("Vista lista activa.", "info");
        return;
      }
      if (key === "k") {
        event.preventDefault();
        setView("kanban");
        setStatusMessage("Vista kanban activa.", "info");
        return;
      }
      if (key === "c") {
        event.preventDefault();
        setView("calendar");
        setStatusMessage("Vista calendario activa.", "info");
        return;
      }
    }

    if (event.key === "Escape") {
      if (!shortcutsModal.classList.contains("hidden")) {
        closeShortcutsModal();
        return;
      }
      if (inputs.id.value) {
        resetFormState();
        setStatusMessage("Edición cancelada.", "info");
      }
      if (document.activeElement && isTypingTarget(document.activeElement)) {
        document.activeElement.blur();
      }
    }
  });
}

function exportProjects() {
  const payload = {
    version: 2,
    exportedAt: new Date().toISOString(),
    projects: state.projects,
    filterPresets: state.filterPresets,
    viewFilters: state.viewFilters,
  };

  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = `project-manager-backup-${todayISO()}.json`;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);

  setStatusMessage("Backup completo exportado.", "success");
}

function mergeProjects(importedProjects) {
  const byId = new Map(state.projects.map((project) => [project.id, project]));
  importedProjects.forEach((project) => byId.set(project.id, project));
  state.projects = [...byId.values()];
}

async function importProjectsFromFile(file) {
  if (!file) return;

  if (file.size > MAX_FILE_SIZE_BYTES) {
    setStatusMessage("Archivo demasiado grande. Máximo 2MB.", "error");
    return;
  }

  try {
    const text = await file.text();
    const parsed = safeJSONParse(text, null);
    const payload = parseBackupPayload(parsed);
    if (!payload.isValid) {
      setStatusMessage("Formato JSON no compatible.", "error");
      return;
    }

    const importedProjects = payload.projects.map((item) => normalizeProject(item)).filter(Boolean);
    const importedPresets = payload.filterPresets;
    const importedViewFilters = payload.viewFilters;

    if (!payload.isLegacy && (importedPresets || importedViewFilters)) {
      const confirmed = window.confirm(
        "Este backup incluye presets y filtros por vista. ¿Quieres sobrescribir tu configuración actual?"
      );
      if (!confirmed) return;
    }

    setUndoSnapshot("importar backup");
    mergeProjects(importedProjects);
    if (importedPresets) state.filterPresets = importedPresets;
    if (importedViewFilters) state.viewFilters = importedViewFilters;

    const okProjects = saveProjects();
    const okPresets = saveFilterPresets();
    const okViewFilters = saveViewFilters();

    if (okProjects && okPresets && okViewFilters) {
      applyViewFilters(state.currentView);
      renderPresetOptions();
      clearPresetSelection();
      resetFormState();
      render();
      setStatusMessage(`Importación completada: ${importedProjects.length} proyecto(s).`, "success");
    }
  } catch {
    setStatusMessage("No se pudo importar el archivo JSON.", "error");
  }
}

function bindEvents() {
  form.addEventListener("submit", (event) => {
    event.preventDefault();

    const data = Object.fromEntries(new FormData(form).entries());
    const validation = validateProjectData(data);

    if (!validation.valid) {
      setStatusMessage(validation.message, "error");
      return;
    }

    if (data.projectId) {
      const existing = state.projects.find((project) => project.id === data.projectId);
      if (!existing) {
        setStatusMessage("No se encontró el proyecto a editar.", "error");
        return;
      }

      setUndoSnapshot("editar proyecto");
      const updated = {
        ...existing,
        name: data.name.trim(),
        owner: data.owner.trim(),
        status: data.status,
        priority: data.priority,
        dueDate: data.dueDate,
        budget: normalizeBudget(data.budget),
        tags: parseTags(data.tags),
        description: data.description.trim(),
        updatedAt: Date.now(),
      };

      state.projects = state.projects.map((project) => (project.id === updated.id ? updated : project));
      setStatusMessage("Proyecto actualizado.", "success");
    } else {
      setUndoSnapshot("crear proyecto");
      state.projects.push({
        id: crypto.randomUUID(),
        name: data.name.trim(),
        owner: data.owner.trim(),
        status: data.status,
        priority: data.priority,
        dueDate: data.dueDate,
        budget: normalizeBudget(data.budget),
        tags: parseTags(data.tags),
        description: data.description.trim(),
        createdAt: Date.now(),
        updatedAt: Date.now(),
      });
      setStatusMessage("Proyecto creado.", "success");
    }

    if (saveProjects()) {
      resetFormState();
      render();
    }
  });

  cancelEditBtn.addEventListener("click", resetFormState);

  [listView, kanbanView].forEach((container) => {
    container.addEventListener("click", (event) => {
      performCardAction(event.target);
    });
  });

  const debouncedRender = debounce(render, 180);
  [searchInput, filterOwner, filterTag, filterBudgetMin, filterBudgetMax].forEach((control) => {
    control.addEventListener("input", () => {
      clearPresetSelection();
      persistCurrentViewFilters();
      debouncedRender();
    });
  });

  [filterStatus, filterPriority, sortBy].forEach((control) => {
    control.addEventListener("change", () => {
      clearPresetSelection();
      persistCurrentViewFilters();
      render();
    });
  });

  filterPreset.addEventListener("change", () => {
    const name = filterPreset.value;
    if (!name) {
      persistCurrentViewFilters();
      setStatusMessage("Preset desactivado.", "info");
      return;
    }

    const preset = state.filterPresets[name];
    if (!preset) {
      setStatusMessage("Preset no encontrado.", "error");
      filterPreset.value = "";
      return;
    }

    applyFiltersFromPreset(preset);
    setStatusMessage(`Preset "${name}" aplicado.`, "success");
  });

  savePresetBtn.addEventListener("click", saveCurrentPreset);
  deletePresetBtn.addEventListener("click", deleteCurrentPreset);
  helpShortcutsBtn.addEventListener("click", openShortcutsModal);
  closeShortcutsBtn.addEventListener("click", closeShortcutsModal);
  shortcutsModal.addEventListener("click", (event) => {
    if (event.target === shortcutsModal) closeShortcutsModal();
  });

  resetFiltersBtn.addEventListener("click", () => {
    resetFilters();
    setStatusMessage("Filtros restablecidos.", "info");
  });

  clearCompletedBtn.addEventListener("click", () => {
    const totalCompleted = state.projects.filter((project) => project.status === "completado").length;
    if (!totalCompleted) {
      setStatusMessage("No hay proyectos completados para borrar.", "info");
      return;
    }

    const confirmed = window.confirm(`Se eliminarán ${totalCompleted} proyecto(s) completados. ¿Continuar?`);
    if (!confirmed) return;

    setUndoSnapshot("borrar completados");
    state.projects = state.projects.filter((project) => project.status !== "completado");
    if (saveProjects()) {
      render();
      setStatusMessage("Proyectos completados eliminados.", "success");
    }
  });

  viewListBtn.addEventListener("click", () => setView("list"));
  viewKanbanBtn.addEventListener("click", () => setView("kanban"));
  viewCalendarBtn.addEventListener("click", () => setView("calendar"));

  calendarPrevBtn.addEventListener("click", () => {
    state.calendarCursor = new Date(state.calendarCursor.getFullYear(), state.calendarCursor.getMonth() - 1, 1);
    render();
  });

  calendarNextBtn.addEventListener("click", () => {
    state.calendarCursor = new Date(state.calendarCursor.getFullYear(), state.calendarCursor.getMonth() + 1, 1);
    render();
  });

  exportBtn.addEventListener("click", exportProjects);
  undoActionBtn.addEventListener("click", undoLastAction);

  importFileInput.addEventListener("change", async (event) => {
    const file = event.target.files?.[0];
    await importProjectsFromFile(file);
    importFileInput.value = "";
  });
}

function init() {
  inputs.dueDate.value = todayISO();
  inputs.budget.value = "0";
  renderPresetOptions();
  setView("list");
  bindEvents();
  bindKeyboardShortcuts();
  render();
  setStatusMessage("Aplicación lista.", "info");
}

init();
