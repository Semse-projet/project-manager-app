/**
 * PR #973: authenticated, read-only ES/EN acceptance on an isolated QA preview.
 *
 * Require PLAYWRIGHT_BASE_URL, SEMSE_QA_{ADMIN,CLIENT,WORKER}_{EMAIL,PASSWORD}
 * and, for remote targets, SEMSE_QA_ISOLATED_PREVIEW=true. Inject QA credentials
 * via a secret manager, never into this repository or command-line arguments.
 *
 * Example (after provisioning env vars securely):
 * pnpm exec playwright test -c playwright.semse.config.ts tests/e2e-semse/i18n-pr973.spec.ts
 *
 * The suite only edits unsent fields; no ingestion, payment or mutation submits.
 * Missing credentials, disallowed target or failed login MUST fail acceptance.
 */
import { test, expect, type Page } from "@playwright/test";

type QaRole = "admin" | "client" | "worker";

function requireIsolatedPreview(): void {
  const target = process.env.PLAYWRIGHT_BASE_URL ?? process.env.SEMSE_WEB_BASE_URL;
  if (!target) throw new Error("PR #973 QA: set PLAYWRIGHT_BASE_URL to an isolated preview URL");
  let url: URL;
  try { url = new URL(target); }
  catch { throw new Error("PR #973 QA: invalid preview URL"); }
  const host = url.hostname.toLowerCase();
  const local = host === "localhost" || host === "127.0.0.1" || host === "[::1]";
  if (url.username || url.password || !["http:", "https:"].includes(url.protocol)) {
    throw new Error("PR #973 QA: invalid preview URL credentials or protocol");
  }
  if (host === "app.semseproject.com" || host === "semseproject.com" ||
      /(^|[.-])prod(?:uction)?([.-]|$)/i.test(host)) {
    throw new Error("PR #973 QA: production target is forbidden");
  }
  if (!local && (url.protocol !== "https:" || process.env.SEMSE_QA_ISOLATED_PREVIEW !== "true")) {
    throw new Error("PR #973 QA: remote target requires HTTPS and approved isolated-preview flag");
  }
}

async function loginAsQa(page: Page, role: QaRole): Promise<void> {
  requireIsolatedPreview();
  const prefix = `SEMSE_QA_${role.toUpperCase()}`;
  const email = process.env[`${prefix}_EMAIL`];
  const password = process.env[`${prefix}_PASSWORD`];
  if (!email?.trim() || !password) {
    throw new Error(`PR #973 QA: missing approved ${role} credentials in environment`);
  }
  await page.goto("/login", { waitUntil: "domcontentloaded" });
  const approvedTarget = process.env.PLAYWRIGHT_BASE_URL ?? process.env.SEMSE_WEB_BASE_URL!;
  if (new URL(page.url()).origin !== new URL(approvedTarget).origin) {
    throw new Error("PR #973 QA: login redirected outside approved preview origin");
  }
  await page.getByLabel("Email", { exact: true }).fill(email.trim());
  await page.getByLabel("Contraseña", { exact: true }).fill(password);
  await Promise.all([
    page.waitForURL((url) => !url.pathname.startsWith("/login"), { timeout: 30_000 }),
    page.getByRole("button", { name: /^Ingresar/ }).click(),
  ]);
}

const languagePicker = (page: import("@playwright/test").Page) =>
  page.getByRole("combobox", { name: /^(Idioma|Language)$/ });

// Never capture login credentials in traces, screenshots or video.
// Worker-scoped Playwright options must be set at file level, not in describe.
test.use({ trace: "off", screenshot: "off", video: "off" });

test.describe("PR #973 — authenticated ES/EN smoke", () => {
  test.setTimeout(120_000);

  test("OPS_ADMIN: Prometeo retains unsent ingestion fields after ES ↔ EN and tab changes", async ({ page }) => {
    await loginAsQa(page, "admin");
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

  test("OPS_ADMIN: large TXT upload encoding remains private without reaching backend", async ({ page }) => {
    await loginAsQa(page, "admin");
    await page.goto("/admin/prometeo", { waitUntil: "domcontentloaded" });
    await languagePicker(page).selectOption("en");

    const bytes = Buffer.alloc(256 * 1024, 0x61); // exceeds practical spread-argument limits
    let intercepted = false;
    await page.route("**/api/semse/prometeo/ingest-file", async (route) => {
      const body = route.request().postDataJSON() as {
        fileName: string; fileBase64: string; visibility: string; sourceType: string;
      };
      expect(route.request().method()).toBe("POST");
      expect(body.fileName).toBe("qa-large.txt");
      expect(body.fileBase64).toBe(bytes.toString("base64"));
      expect(body.visibility).toBe("tenant_private");
      expect(body.sourceType).toBe("text");
      intercepted = true;
      // Fulfill in the browser: no document is written to the API or database.
      await route.fulfill({ status: 200, contentType: "application/json", body: '{"data":{"id":"qa-intercepted"}}' });
    });

    await page.getByRole("button", { name: "File (PDF/DOCX/TXT)" }).click();
    await page.getByPlaceholder("Document title").fill("QA encoded TXT — intercepted, not uploaded");
    await expect(page.locator('select:has(option[value="tenant_private"])')).toHaveValue("tenant_private");
    await page.locator('input[type="file"]').setInputFiles({
      name: "qa-large.txt", mimeType: "text/plain", buffer: bytes,
    });
    await page.getByRole("button", { name: "Ingest file", exact: true }).click();
    await expect.poll(() => intercepted).toBe(true);
    await expect(page.getByText("Document submitted — indexing in background")).toBeVisible();
  });

  test("CLIENT: ProTools keeps an unsent estimate description while switching locale", async ({ page }) => {
    await loginAsQa(page, "client");
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
    await loginAsQa(page, "worker");
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
