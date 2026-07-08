import { test, expect } from "@playwright/test";
import { buildReport, writeEvidenceReport } from "./utils/evidence";

test.describe("Landing Personas E2E", () => {
  test.setTimeout(120_000);

  test("persona selector renders with all modules in default state", async ({ page, baseURL }) => {
    const startedAt = new Date().toISOString();
    const errors: string[] = [];
    page.on("pageerror", (err) => errors.push(err.message));

    await page.goto("/", { waitUntil: "domcontentloaded", timeout: 90_000 });

    const selector = page.getByTestId("persona-selector");
    await selector.scrollIntoViewIfNeeded();
    await expect(selector).toBeVisible();

    // Default: no persona → all 9 modules visible
    const cards = page.getByTestId("persona-modules").locator("[data-testid^='persona-card-']");
    await expect(cards).toHaveCount(9);
    expect(errors).toEqual([]);

    writeEvidenceReport(
      buildReport("landing-personas-default", errors.length === 0 ? "passed" : "failed", startedAt, baseURL ?? "")
    );
  });

  test("switching persona changes the visible cards", async ({ page }) => {
    await page.goto("/", { waitUntil: "domcontentloaded", timeout: 90_000 });

    await page.getByTestId("persona-tab-agro").click();
    await expect(page.getByTestId("persona-card-agro")).toBeVisible();
    await expect(page.getByTestId("persona-card-core")).toHaveCount(0);

    await page.getByTestId("persona-tab-empresa").click();
    await expect(page.getByTestId("persona-card-core")).toBeVisible();
    await expect(page.getByTestId("persona-card-agro")).toHaveCount(0);
  });

  test("cliente persona shows the intake card linking to job creation", async ({ page }) => {
    await page.goto("/", { waitUntil: "domcontentloaded", timeout: 90_000 });

    await page.getByTestId("persona-tab-cliente").click();
    const intakeCard = page.getByTestId("persona-card-intake");
    await expect(intakeCard).toBeVisible();
    await expect(intakeCard).toHaveAttribute("href", "/client/jobs/new");
  });

  test("deep link /?persona=agro preselects the agricultor persona", async ({ page }) => {
    await page.goto("/?persona=agro", { waitUntil: "domcontentloaded", timeout: 90_000 });

    const agroTab = page.getByTestId("persona-tab-agro");
    await agroTab.scrollIntoViewIfNeeded();
    await expect(agroTab).toHaveAttribute("aria-selected", "true");
    await expect(page.getByTestId("persona-card-agro")).toBeVisible();
  });

  test("persona persists across reloads via localStorage", async ({ page }) => {
    await page.goto("/", { waitUntil: "domcontentloaded", timeout: 90_000 });
    await page.getByTestId("persona-tab-contratista").click();

    await page.reload({ waitUntil: "domcontentloaded" });

    const tab = page.getByTestId("persona-tab-contratista");
    await tab.scrollIntoViewIfNeeded();
    await expect(tab).toHaveAttribute("aria-selected", "true");

    const stored = await page.evaluate(() => localStorage.getItem("semse.persona"));
    expect(stored).toBe("contratista");
  });

  test("hub highlights modules for the stored persona", async ({ page }) => {
    await page.goto("/?persona=agro", { waitUntil: "domcontentloaded", timeout: 90_000 });
    await expect(page.getByTestId("persona-tab-agro")).toHaveAttribute("aria-selected", "true");

    await page.goto("/hub", { waitUntil: "domcontentloaded", timeout: 90_000 });
    await expect(page.getByTestId("hub-persona-hint")).toBeVisible();
    await expect(page.getByTestId("hub-module-agro")).toHaveAttribute("data-recommended", "true");
  });
});
