/**
 * PR #973: functional ES/EN smoke tests against an isolated SEMSE preview.
 *
 * Prerequisites: real running Web + API and authorized demo/QA accounts.
 * Run: PLAYWRIGHT_BASE_URL=https://<isolated-preview> pnpm exec playwright test
 *       -c playwright.semse.config.ts tests/e2e-semse/i18n-pr973.spec.ts
 *
 * This suite edits forms in the browser only. It NEVER submits ingestion,
 * estimates, payment, evidence or any other mutation to the API.
 *
 * A missing login is a failing acceptance gate, not a skipped/pass test.
 */
import { test, expect } from "@playwright/test";
import { loginAs } from "./utils/auth";

const languagePicker = (page: import("@playwright/test").Page) =>
  page.getByRole("combobox", { name: /^(Idioma|Language)$/ });

test.describe("PR #973 — authenticated ES/EN smoke", () => {
  test.setTimeout(120_000);

  test("OPS_ADMIN: Prometeo retains unsent ingestion fields after ES ↔ EN and tab changes", async ({ page }) => {
    await loginAs(page, "admin");
    await page.goto("/admin/prometeo", { waitUntil: "domcontentloaded" });

    await languagePicker(page).selectOption("es");
    const title = page.getByPlaceholder("Título del documento");
    const body = page.getByPlaceholder("Pega aquí el contenido del documento...");
    await expect(title).toBeVisible();
    await expect(body).toBeVisible();
    await title.fill("Borrador privado de prueba ES/EN — no enviar");
    await body.fill("Texto de prueba que debe sobrevivir a los cambios de idioma.");
    const visibility = page.locator('select:has(option[value="tenant_private"])');
    await visibility.selectOption("tenant_private");

    await languagePicker(page).selectOption("en");
    await expect(page.getByPlaceholder("Document title")).toHaveValue("Borrador privado de prueba ES/EN — no enviar");
    await expect(page.getByPlaceholder("Paste the document content here...")).toHaveValue(
      "Texto de prueba que debe sobrevivir a los cambios de idioma.",
    );
    await expect(visibility).toHaveValue("tenant_private");

    await page.getByRole("button", { name: "Library", exact: true }).click();
    await page.getByRole("button", { name: "Ingest", exact: true }).click();
    await expect(page.getByPlaceholder("Document title")).toHaveValue("Borrador privado de prueba ES/EN — no enviar");
    await expect(visibility).toHaveValue("tenant_private");

    await languagePicker(page).selectOption("es");
    await expect(page.getByPlaceholder("Título del documento")).toHaveValue("Borrador privado de prueba ES/EN — no enviar");
    await expect(page.locator("html")).toHaveAttribute("lang", "es");
  });

  test("CLIENT: ProTools keeps an unsent estimate description while switching locale", async ({ page }) => {
    await loginAs(page, "client");
    await page.goto("/client/protools", { waitUntil: "domcontentloaded" });
    await languagePicker(page).selectOption("es");
    const description = page.getByPlaceholder(/Ej\.: Reemplazar panel eléctrico/);
    await expect(description).toBeVisible();
    await description.fill("Cambiar luminarias y circuitos; no calcular ni publicar.");
    await languagePicker(page).selectOption("en");
    await expect(page.getByPlaceholder(/E\.g\., upgrade a 100A panel/)).toHaveValue(
      "Cambiar luminarias y circuitos; no calcular ni publicar.",
    );
    await languagePicker(page).selectOption("es");
    await expect(description).toHaveValue("Cambiar luminarias y circuitos; no calcular ni publicar.");
  });

  test("WORKER mobile: five tab labels translate and language persists after reload", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await loginAs(page, "worker");
    await page.goto("/worker/dashboard", { waitUntil: "domcontentloaded" });
    const nav = page.locator(".worker-bottom-nav");
    await languagePicker(page).selectOption("es");
    await expect(nav).toBeVisible();
    await expect(nav.locator("a")).toHaveText(["Inicio", "Trabajos", "Tiempo", "Evidencia", "Ofertas"]);
    await languagePicker(page).selectOption("en");
    await expect(nav.locator("a")).toHaveText(["Home", "Jobs", "Time", "Evidence", "Offers"]);
    await expect(page.locator("html")).toHaveAttribute("lang", "en");
    await page.reload({ waitUntil: "domcontentloaded" });
    await expect(languagePicker(page)).toHaveValue("en");
    await expect(page.locator(".worker-bottom-nav a")).toHaveText(["Home", "Jobs", "Time", "Evidence", "Offers"]);
  });
});
