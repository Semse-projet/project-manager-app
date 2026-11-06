/**
 * PR #1068: authenticated, BFF-intercepted UI acceptance. All mutations are
 * intercepted inside Playwright: no room task is written to any real database.
 * This does NOT replace isolated API/PostgreSQL or authorization tests.
 *
 * Opt-in:
 * SEMSE_PR1068_E2E_QA=1 PLAYWRIGHT_BASE_URL=<isolated preview> \
 * SEMSE_QA_ISOLATED_PREVIEW=true SEMSE_QA_SUPERVISOR_EMAIL=... \
 * SEMSE_QA_SUPERVISOR_PASSWORD=... SEMSE_QA_WORKER_EMAIL=... \
 * SEMSE_QA_WORKER_PASSWORD=... pnpm exec playwright test \
 *   -c playwright.semse.config.ts tests/e2e-semse/room-assignments-pr1068.spec.ts
 */
import { expect, test, type Browser, type Page, type Route } from "@playwright/test";

const CREW = "qa-crew-205";
const TASK = "qa-task-205";
const ALLOCATION = "qa-alloc-205";
const WORKER = "qa-worker-205";
const TITLE = "Hab. 205 — Reparar pared";
const enabled = process.env.SEMSE_PR1068_E2E_QA === "1";

function isolatedPreview(): void {
  const target = process.env.PLAYWRIGHT_BASE_URL ?? process.env.SEMSE_WEB_BASE_URL;
  if (!target) throw new Error("PR #1068 QA requires an isolated preview URL");
  const url = new URL(target);
  const host = url.hostname.toLowerCase();
  const local = ["localhost", "127.0.0.1", "[::1]"].includes(host);
  if (!["http:", "https:"].includes(url.protocol) || url.username || url.password ||
      host === "semseproject.com" || host === "app.semseproject.com" ||
      /(^|[.-])prod(?:uction)?([.-]|$)/i.test(host)) {
    throw new Error("PR #1068 QA forbids production or embedded credentials");
  }
  if (!local && (url.protocol !== "https:" || process.env.SEMSE_QA_ISOLATED_PREVIEW !== "true")) {
    throw new Error("PR #1068 QA remote preview must be explicitly isolated");
  }
}

async function login(page: Page, role: "SUPERVISOR" | "WORKER") {
  isolatedPreview();
  const email = process.env[`SEMSE_QA_${role}_EMAIL`];
  const password = process.env[`SEMSE_QA_${role}_PASSWORD`];
  if (!email?.trim() || !password) throw new Error(`Missing PR #1068 QA ${role} credentials`);
  await page.goto("/login", { waitUntil: "domcontentloaded" });
  const target = process.env.PLAYWRIGHT_BASE_URL ?? process.env.SEMSE_WEB_BASE_URL!;
  if (new URL(page.url()).origin !== new URL(target).origin) {
    throw new Error("Login redirected outside isolated preview");
  }
  await page.getByLabel("Email", { exact: true }).fill(email);
  await page.getByLabel("Contraseña", { exact: true }).fill(password);
  await Promise.all([
    page.waitForURL((url) => !url.pathname.startsWith("/login"), { timeout: 30_000 }),
    page.getByRole("button", { name: /^Ingresar/ }).click()
  ]);
  await page.getByRole("combobox", { name: /^(Idioma|Language)$/ }).selectOption("es");
}

const respond = (route: Route, data: unknown) =>
  route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ data }) });

// QA is explicitly opt-in: normal unit/CI test suites cannot accidentally call a remote preview.
test.skip(!enabled, "Set SEMSE_PR1068_E2E_QA=1 only for approved isolated-preview QA");
test.use({ trace: "off", screenshot: "off", video: "off" });
test("supervisor assigns room 205; worker acknowledges, blocks, submits, and supervisor releases", async ({ browser }: { browser: Browser }) => {
  test.setTimeout(120_000);
  const supervisorContext = await browser.newContext();
  const workerContext = await browser.newContext();
  try {
    const supervisor = await supervisorContext.newPage();
    const worker = await workerContext.newPage();
    await login(supervisor, "SUPERVISOR");
    await login(worker, "WORKER");

    let titleCreated = "";
    let assignedTo: string[] = [];
    let workerStatus = "ASSIGNED";
    let workerStatusNote: string | null = null;
    let workerStatusCalls = 0;
    let releasedBySupervisor = false;
    const crew = { crewId: CREW, orgId: "qa-org", name: "QA Cuadrilla", supervisorUserId: "qa-supervisor", worksiteId: null, status: "ACTIVE" };
    const task = () => ({ taskId: TASK, title: titleCreated, description: null, dueDate: null, priority: "medium", status: "pending", createdAt: null });
    const allocation = () => ({
      allocationId: ALLOCATION, taskTitle: titleCreated, orgId: "qa-org", taskId: TASK, crewId: CREW,
      userId: WORKER, status: workerStatus, assignReason: null, statusNote: workerStatusNote,
      assignedAt: "2026-10-28T00:00:00Z", acknowledgedAt: null, releasedAt: null, releaseReason: null
    });

    await supervisor.route("**/api/semse/crews/**", async (route) => {
      const { pathname } = new URL(route.request().url());
      const method = route.request().method();
      if (pathname === "/api/semse/crews/mine" && method === "GET") return respond(route, [crew]);
      if (pathname === `/api/semse/crews/${CREW}/roster` && method === "GET") {
        return respond(route, { crewId: CREW, members: [{ userId: WORKER, addedAt: "2026-10-28T00:00:00Z" }] });
      }
      if (pathname === `/api/semse/crews/${CREW}/tasks` && method === "GET") {
        return respond(route, titleCreated ? [task()] : []);
      }
      if (pathname === `/api/semse/crews/${CREW}/tasks` && method === "POST") {
        titleCreated = (route.request().postDataJSON() as { title: string }).title;
        return respond(route, task());
      }
      if (pathname === `/api/semse/crews/${CREW}/tasks/${TASK}/allocations` && method === "POST") {
        assignedTo = (route.request().postDataJSON() as { userIds: string[] }).userIds;
        return respond(route, [allocation()]);
      }
      if (pathname === `/api/semse/crews/${CREW}/tasks/${TASK}/allocations` && method === "GET") {
        return respond(route, assignedTo.length ? [allocation()] : []);
      }
      if (pathname === `/api/semse/crews/${CREW}/tasks/${TASK}/allocations/${WORKER}/release` && method === "POST") {
        const { reason } = route.request().postDataJSON() as { reason: string };
        if (reason !== "Reasignación supervisada") throw new Error("Release reason did not match authorized QA action");
        workerStatus = "RELEASED";
        releasedBySupervisor = true;
        return respond(route, { status: workerStatus });
      }
      throw new Error(`Unexpected intercepted crew call: ${method} ${pathname}`);
    });

    await worker.route("**/api/semse/task-allocations/**", async (route) => {
      const { pathname } = new URL(route.request().url());
      const method = route.request().method();
      if (pathname === "/api/semse/task-allocations/mine" && method === "GET") {
        return respond(route, assignedTo.includes(WORKER) ? [allocation()] : []);
      }
      if (pathname === `/api/semse/task-allocations/${ALLOCATION}/status` && method === "POST") {
        const body = route.request().postDataJSON() as { status: string; note?: string };
        if (body.status === "BLOCKED" && !body.note?.trim()) throw new Error("BLOCKED requires a note");
        workerStatusCalls++;
        workerStatus = body.status;
        workerStatusNote = body.note ?? null;
        return respond(route, { status: workerStatus });
      }
      throw new Error(`Unexpected intercepted allocation call: ${method} ${pathname}`);
    });

    await supervisor.goto("/worker/crew");
    await supervisor.getByLabel("Habitación o área").fill("Hab. 205");
    await supervisor.getByLabel("Trabajo a realizar").fill("Reparar pared");
    await supervisor.getByRole("button", { name: "Crear tarea" }).click();
    await expect(supervisor.getByText("Tarea creada.")).toBeVisible();
    expect(titleCreated).toBe(TITLE);
    await supervisor.getByLabel(WORKER).check();
    await supervisor.getByRole("button", { name: "Asignar", exact: true }).click();
    await expect.poll(() => assignedTo).toEqual([WORKER]);

    await worker.goto("/worker/assignments");
    await expect(worker.getByText(TITLE, { exact: true })).toBeVisible();
    await worker.getByRole("button", { name: "Enterado", exact: true }).click();
    await expect.poll(() => workerStatus).toBe("ACKNOWLEDGED");
    await expect(worker.getByText("Enterado", { exact: true })).toBeVisible();

    await worker.getByRole("button", { name: "Empezar", exact: true }).click();
    await expect.poll(() => workerStatus).toBe("IN_PROGRESS");
    await expect(worker.getByText("En curso", { exact: true })).toBeVisible();

    const beforeInvalidBlock = workerStatusCalls;
    await worker.getByRole("button", { name: "Bloquear", exact: true }).click();
    expect(workerStatusCalls).toBe(beforeInvalidBlock);
    expect(workerStatus).toBe("IN_PROGRESS");
    await worker.getByRole("textbox", { name: "Motivo o nota" }).fill("Falta material");
    await worker.getByRole("button", { name: "Bloquear", exact: true }).click();
    await expect.poll(() => workerStatus).toBe("BLOCKED");
    await expect(worker.getByText("Bloqueada", { exact: true })).toBeVisible();
    await expect(worker.getByText("Falta material", { exact: true })).toBeVisible();

    await worker.getByRole("button", { name: "Reanudar", exact: true }).click();
    await expect.poll(() => workerStatus).toBe("IN_PROGRESS");
    await worker.getByRole("button", { name: "Enviar", exact: true }).click();
    await expect.poll(() => workerStatus).toBe("SUBMITTED");
    await expect(worker.getByText("Enviada", { exact: true })).toBeVisible();

    await supervisor.getByRole("button", { name: "Ver asignaciones", exact: true }).click();
    await expect(supervisor.getByText("Enviada", { exact: true })).toBeVisible();
    await supervisor.getByRole("textbox", { name: "Motivo para liberar" }).fill("Reasignación supervisada");
    await supervisor.getByRole("button", { name: "Liberar", exact: true }).click();
    await expect.poll(() => releasedBySupervisor).toBe(true);
    await expect.poll(() => workerStatus).toBe("RELEASED");
  } finally {
    await supervisorContext.close();
    await workerContext.close();
  }
});
