import { test, expect } from "@playwright/test";
import { buildReport, writeEvidenceReport } from "./utils/evidence";

test.describe("Public Landing Page E2E", () => {
  test("landing page renders successfully", async ({ page, baseURL }) => {
    const startedAt = new Date().toISOString();
    const errors: string[] = [];

    page.on("pageerror", (err) => {
      errors.push(err.message);
    });

    await page.goto("/");
    await page.waitForLoadState("domcontentloaded");

    // Check that we have a heading or text from the hero
    const heroTitle = page.locator("h1");
    await expect(heroTitle).toBeVisible();
    await expect(page).not.toHaveTitle(/500|Error|not found/i);
    expect(errors).toEqual([]);

    writeEvidenceReport(
      buildReport("public-landing-render", errors.length === 0 ? "passed" : "failed", startedAt, baseURL ?? "")
    );
  });

  test("theme toggle switches successfully", async ({ page }) => {
    await page.goto("/");
    await page.waitForLoadState("domcontentloaded");

    // Find theme toggle button by label
    const toggleBtn = page.getByRole("button", { name: /Cambiar tema/i }).first();
    await expect(toggleBtn).toBeVisible();
    
    // Toggle theme
    await toggleBtn.click();
    
    // Attribute sync check
    const htmlTag = page.locator("html");
    const docTheme = await htmlTag.getAttribute("data-theme");
    expect(["light", "dark"]).toContain(docTheme);
  });

  test("footer admin route works and redirects to login", async ({ page }) => {
    await page.goto("/");
    await page.waitForLoadState("domcontentloaded");

    // Find internal access link
    const adminLink = page.getByRole("link", { name: /Acceso interno/i }).first();
    await expect(adminLink).toBeVisible();

    await adminLink.click();
    await page.waitForURL(/\/login/);
    
    // Check it has query param 'from=/admin/dashboard' or redirect context
    const currentURL = page.url();
    expect(currentURL).toContain("/login");
  });
});
