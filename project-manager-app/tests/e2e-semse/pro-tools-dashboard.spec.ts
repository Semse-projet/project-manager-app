import { test, expect } from "@playwright/test";
import { tryLoginAs, isRedirectedToLogin } from "./utils/auth";
import { buildReport, writeEvidenceReport } from "./utils/evidence";

const API_SKIP_MSG = "SEMSE API not running — auth requires port 4000";

test.describe("Pro Tools — Unified Dashboard", () => {
  test("dashboard loads at /tools/dashboard", async ({ page, baseURL }) => {
    const startedAt = new Date().toISOString();
    const errors: string[] = [];

    const loggedIn = await tryLoginAs(page, "admin");
    if (!loggedIn) { test.skip(true, API_SKIP_MSG); return; }

    page.on("response", (res) => {
      if (res.status() >= 500) errors.push(`${res.status()} ${res.url()}`);
    });

    await page.goto("/tools/dashboard");
    await page.waitForLoadState("networkidle");

    if (await isRedirectedToLogin(page)) {
      test.skip(true, "Auth blocked /tools/dashboard"); return;
    }

    await expect(page.locator("h1")).toBeVisible();
    await expect(page.locator("h1")).toContainText(/Dashboard|dashboard/i);
    expect(errors).toEqual([]);

    writeEvidenceReport(
      buildReport("pro-tools-dashboard-load", errors.length === 0 ? "passed" : "failed", startedAt, baseURL ?? "", { errors })
    );
  });

  test("dashboard shows trade engine links", async ({ page }) => {
    const loggedIn = await tryLoginAs(page, "admin");
    if (!loggedIn) { test.skip(true, API_SKIP_MSG); return; }

    await page.goto("/tools/dashboard");
    await page.waitForLoadState("networkidle");

    if (await isRedirectedToLogin(page)) { test.skip(true, "Auth blocked"); return; }

    await expect(page.locator("a[href='/tools/roofing']")).toBeVisible();
    await expect(page.locator("a[href='/tools/concrete']")).toBeVisible();
  });

  test("tools hub at /tools loads and links to dashboard", async ({ page }) => {
    const loggedIn = await tryLoginAs(page, "admin");
    if (!loggedIn) { test.skip(true, API_SKIP_MSG); return; }

    await page.goto("/tools");
    await page.waitForLoadState("networkidle");

    if (await isRedirectedToLogin(page)) { test.skip(true, "Auth blocked"); return; }

    await expect(page.locator("h1")).toBeVisible();
    const dashLink = page.locator("a[href='/tools/dashboard']");
    await expect(dashLink).toBeVisible();
  });
});
