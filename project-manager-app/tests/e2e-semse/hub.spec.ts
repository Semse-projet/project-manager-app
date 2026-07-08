import { test, expect } from "@playwright/test";
import { buildReport, writeEvidenceReport } from "./utils/evidence";

const HUB_MODULE_IDS = [
  "core",
  "connect",
  "payments",
  "trust",
  "ai",
  "agro",
  "buildops",
  "knowledge",
  "integrations",
];

test.describe("SEMSE Hub E2E", () => {
  test.setTimeout(120_000);

  test("hub renders the 9 ecosystem modules", async ({ page, baseURL }) => {
    const startedAt = new Date().toISOString();
    const errors: string[] = [];

    page.on("pageerror", (err) => {
      errors.push(err.message);
    });

    await page.goto("/hub", { waitUntil: "domcontentloaded", timeout: 90_000 });

    await expect(page.locator("h1")).toBeVisible();
    for (const id of HUB_MODULE_IDS) {
      await expect(page.getByTestId(`hub-module-${id}`)).toBeVisible();
    }
    expect(errors).toEqual([]);

    writeEvidenceReport(
      buildReport("hub-render", errors.length === 0 ? "passed" : "failed", startedAt, baseURL ?? "")
    );
  });

  test("every module detail page responds with its content", async ({ page }) => {
    for (const id of HUB_MODULE_IDS) {
      const response = await page.goto(`/modules/${id}`, {
        waitUntil: "domcontentloaded",
        timeout: 90_000,
      });
      expect(response?.status(), `/modules/${id} should be 200`).toBe(200);
      await expect(page.locator("h1")).toBeVisible();
    }
  });

  test("unknown module id returns 404", async ({ page }) => {
    const response = await page.goto("/modules/does-not-exist", {
      waitUntil: "domcontentloaded",
      timeout: 90_000,
    });
    expect(response?.status()).toBe(404);
  });

  test("module detail role CTAs route through login with redirect context", async ({ page }) => {
    await page.goto("/modules/connect", { waitUntil: "domcontentloaded", timeout: 90_000 });

    const ctas = page.getByTestId("module-role-ctas");
    await expect(ctas).toBeVisible();

    const workerLink = ctas.getByRole("link", { name: /Soy profesional/i });
    await expect(workerLink).toHaveAttribute("href", "/login?from=/worker/dashboard");

    const adminLink = ctas.getByRole("link", { name: /Opero una empresa/i });
    await expect(adminLink).toHaveAttribute("href", "/login?from=/admin/dashboard");
  });

  test("landing nav and footer link to the hub", async ({ page }) => {
    await page.goto("/", { waitUntil: "domcontentloaded", timeout: 90_000 });

    const navLink = page.getByRole("link", { name: /^Ecosistema$/ }).first();
    await expect(navLink).toBeVisible();
    await expect(navLink).toHaveAttribute("href", "/hub");

    const footerLink = page.getByRole("link", { name: /Ecosistema SEMSE/i }).first();
    await expect(footerLink).toHaveAttribute("href", "/hub");
  });
});
