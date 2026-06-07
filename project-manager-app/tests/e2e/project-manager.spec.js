import { test, expect } from "@playwright/test";

test.beforeEach(async ({ page }) => {
  await page.goto("/");
  await page.evaluate(() => localStorage.clear());
  await page.reload();
});

test("crear proyecto y verlo en lista", async ({ page }) => {
  await page.locator("#name").fill("Proyecto E2E");
  await page.locator("#owner").fill("Ana QA");
  await page.locator("#dueDate").fill("2026-03-20");
  await page.locator("#description").fill("Prueba automatizada");

  await page.getByRole("button", { name: "Guardar proyecto" }).click();

  await expect(page.getByText("Proyecto creado.")).toBeVisible();
  await expect(page.locator(".project-card h3").first()).toHaveText("Proyecto E2E");
  await expect(page.getByText("1 proyecto visible")).toBeVisible();
});

test("cambiar a kanban y cambiar estado", async ({ page }) => {
  await page.locator("#name").fill("Flujo Kanban");
  await page.locator("#owner").fill("Bruno");
  await page.locator("#dueDate").fill("2026-03-21");
  await page.getByRole("button", { name: "Guardar proyecto" }).click();

  await page.locator("#view-kanban").click();
  await expect(page.locator("#kanban-pendiente .project-card")).toHaveCount(1);

  await page.locator("#kanban-pendiente .project-card button[data-action='toggle-status']").first().click();
  await expect(page.locator("#kanban-en-progreso .project-card")).toHaveCount(1);
});

test("atajos de teclado: '/' enfoca búsqueda y 'n' enfoca nuevo proyecto", async ({ page }) => {
  await page.keyboard.press("/");
  await expect(page.locator("#search")).toBeFocused();

  await page.keyboard.press("Escape");
  await page.keyboard.press("n");
  await expect(page.locator("#name")).toBeFocused();
});

test("guardar y aplicar preset de filtros", async ({ page }) => {
  await page.locator("#filter-status").selectOption("pendiente");
  await page.locator("#filter-priority").selectOption("alta");
  await page.locator("#filter-owner").fill("Ana");

  page.once("dialog", (dialog) => dialog.accept("Urgentes Ana"));
  await page.locator("#save-preset").click();

  await expect(page.locator("#filter-preset")).toHaveValue("Urgentes Ana");

  await page.locator("#reset-filters").click();
  await expect(page.locator("#filter-status")).toHaveValue("todos");

  await page.locator("#filter-preset").selectOption("Urgentes Ana");
  await expect(page.locator("#filter-status")).toHaveValue("pendiente");
  await expect(page.locator("#filter-priority")).toHaveValue("alta");
  await expect(page.locator("#filter-owner")).toHaveValue("Ana");
});

test("métricas financieras y ranking por responsable", async ({ page }) => {
  await page.locator("#name").fill("Proyecto A");
  await page.locator("#owner").fill("Ana");
  await page.locator("#dueDate").fill("2026-04-01");
  await page.locator("#budget").fill("1000");
  await page.getByRole("button", { name: "Guardar proyecto" }).click();

  await page.locator("#name").fill("Proyecto B");
  await page.locator("#owner").fill("Bruno");
  await page.locator("#status").selectOption("en-progreso");
  await page.locator("#dueDate").fill("2026-04-02");
  await page.locator("#budget").fill("2000");
  await page.getByRole("button", { name: "Guardar proyecto" }).click();

  await expect(page.locator("#metric-budget-total")).toContainText("3000");
  await expect(page.locator("#metric-budget-pending")).toContainText("1000");
  await expect(page.locator("#metric-budget-progress")).toContainText("2000");
  await expect(page.locator("#owner-budget-list .owner-budget-item").first()).toContainText("Bruno");
});

test("vista calendario muestra proyectos por fecha límite", async ({ page }) => {
  const dueDate = await page.evaluate(() => {
    const now = new Date();
    const safeDay = Math.min(15, new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate());
    const d = new Date(now.getFullYear(), now.getMonth(), safeDay);
    return d.toISOString().slice(0, 10);
  });

  await page.locator("#name").fill("Proyecto Calendario");
  await page.locator("#owner").fill("Marta");
  await page.locator("#dueDate").fill(dueDate);
  await page.getByRole("button", { name: "Guardar proyecto" }).click();

  await page.locator("#view-calendar").click();
  await expect(page.locator("#calendar-view")).toBeVisible();
  await expect(page.locator("#calendar-grid .calendar-chip").first()).toContainText("Proyecto Calendario");
});

test("vista calendario marca celdas próximas a vencer", async ({ page }) => {
  const nearDate = await page.evaluate(() => {
    const now = new Date();
    const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
    return d.toISOString().slice(0, 10);
  });

  await page.locator("#name").fill("Entrega Cercana");
  await page.locator("#owner").fill("Sofía");
  await page.locator("#dueDate").fill(nearDate);
  await page.locator("#status").selectOption("pendiente");
  await page.getByRole("button", { name: "Guardar proyecto" }).click();

  await page.locator("#view-calendar").click();
  await expect(page.locator(".calendar-cell-due-soon .calendar-chip").first()).toContainText("Entrega Cercana");
});

test("atajos de vista: l, k y c", async ({ page }) => {
  await page.keyboard.press("k");
  await expect(page.locator("#kanban-view")).toBeVisible();

  await page.keyboard.press("c");
  await expect(page.locator("#calendar-view")).toBeVisible();

  await page.keyboard.press("l");
  await expect(page.locator("#list-view")).toBeVisible();
});

test("filtros se recuerdan por vista (lista/kanban)", async ({ page }) => {
  await page.locator("#filter-status").selectOption("pendiente");
  await expect(page.locator("#filter-status")).toHaveValue("pendiente");

  await page.locator(".hero").click();
  await page.keyboard.press("k");
  await expect(page.locator("#kanban-view")).toBeVisible();

  await page.locator("#filter-status").selectOption("en-progreso");
  await expect(page.locator("#filter-status")).toHaveValue("en-progreso");

  await page.locator(".hero").click();
  await page.keyboard.press("l");
  await expect(page.locator("#list-view")).toBeVisible();
  await expect(page.locator("#filter-status")).toHaveValue("pendiente");
});

test("importar backup completo restaura proyectos y configuración", async ({ page }) => {
  const backup = {
    version: 2,
    exportedAt: "2026-03-05T00:00:00.000Z",
    projects: [
      {
        id: "p-backup-1",
        name: "Proyecto Restore",
        owner: "Nora",
        status: "pendiente",
        priority: "alta",
        dueDate: "2026-03-20",
        budget: 1200,
        tags: ["restore"],
        description: "Importado desde backup",
        createdAt: Date.now(),
        updatedAt: Date.now(),
      },
    ],
    filterPresets: {
      "Preset Restore": {
        search: "",
        status: "pendiente",
        priority: "alta",
        owner: "Nora",
        sortBy: "dueDate",
        view: "list",
      },
    },
    viewFilters: {
      list: { search: "", status: "pendiente", priority: "alta", owner: "Nora", sortBy: "dueDate" },
      kanban: { search: "", status: "en-progreso", priority: "todas", owner: "", sortBy: "dueDate" },
      calendar: { search: "", status: "todos", priority: "baja", owner: "", sortBy: "dueDate" },
    },
  };

  page.once("dialog", (dialog) => dialog.accept());
  await page.locator("#import-file").setInputFiles({
    name: "backup.json",
    mimeType: "application/json",
    buffer: Buffer.from(JSON.stringify(backup), "utf8"),
  });

  await expect(page.locator(".project-card h3").first()).toHaveText("Proyecto Restore");
  await expect(page.locator("#filter-status")).toHaveValue("pendiente");
  await page.locator("#filter-preset").selectOption("Preset Restore");
  await expect(page.locator("#filter-priority")).toHaveValue("alta");
});

test("deshacer recupera proyecto eliminado", async ({ page }) => {
  await page.locator("#name").fill("Proyecto Undo");
  await page.locator("#owner").fill("Mauro");
  await page.locator("#dueDate").fill("2026-03-25");
  await page.getByRole("button", { name: "Guardar proyecto" }).click();
  await expect(page.locator(".project-card h3").first()).toHaveText("Proyecto Undo");

  page.once("dialog", (dialog) => dialog.accept());
  await page.locator(".project-card button[data-action='delete']").first().click();
  await expect(page.getByText("No hay proyectos para mostrar.")).toBeVisible();

  await page.locator("#undo-action").click();
  await expect(page.locator(".project-card h3").first()).toHaveText("Proyecto Undo");
});

test("duplicar proyecto y usar filtros avanzados (tag + presupuesto)", async ({ page }) => {
  await page.locator("#name").fill("Proyecto Filtro");
  await page.locator("#owner").fill("Lina");
  await page.locator("#dueDate").fill("2026-03-28");
  await page.locator("#budget").fill("1500");
  await page.locator("#tags").fill("infra, sprint");
  await page.getByRole("button", { name: "Guardar proyecto" }).click();

  await page.locator(".project-card button[data-action='duplicate']").first().click();
  await expect(page.locator("#list-view .project-card")).toHaveCount(2);
  await expect(page.locator("#list-view .project-card h3")).toContainText([
    "Proyecto Filtro",
    "Proyecto Filtro (Copia)",
  ]);

  await page.locator("#filter-tag").fill("infra");
  await page.locator("#filter-budget-min").fill("1000");
  await page.locator("#filter-budget-max").fill("1600");
  await expect(page.locator("#list-view .project-card")).toHaveCount(2);

  await page.locator("#filter-budget-min").fill("2000");
  await expect(page.getByText("No hay proyectos para mostrar.")).toBeVisible();
});
