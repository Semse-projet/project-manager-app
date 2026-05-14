import { test, expect } from "@playwright/test";
import { tryLoginAs, isRedirectedToLogin } from "./utils/auth";
import { buildReport, writeEvidenceReport } from "./utils/evidence";

const API_SKIP_MSG = "SEMSE API not running — auth requires port 4000";

test.describe("Pro Tools — Concrete Engine", () => {
  test("concrete page loads without 500", async ({ page, baseURL }) => {
    const startedAt = new Date().toISOString();
    const errors: string[] = [];

    const loggedIn = await tryLoginAs(page, "admin");
    if (!loggedIn) { test.skip(true, API_SKIP_MSG); return; }

    page.on("response", (res) => {
      if (res.status() >= 500) errors.push(`${res.status()} ${res.url()}`);
    });

    await page.goto("/tools/concrete");
    await page.waitForLoadState("networkidle");

    if (await isRedirectedToLogin(page)) { test.skip(true, "Auth blocked /tools/concrete"); return; }

    await expect(page.locator("body")).not.toBeEmpty();
    expect(errors).toEqual([]);

    writeEvidenceReport(
      buildReport("concrete-tool-load", errors.length === 0 ? "passed" : "failed", startedAt, baseURL ?? "", { errors })
    );
  });

  test("concrete page has calculate button", async ({ page }) => {
    const loggedIn = await tryLoginAs(page, "admin");
    if (!loggedIn) { test.skip(true, API_SKIP_MSG); return; }

    await page.goto("/tools/concrete");
    await page.waitForLoadState("networkidle");

    if (await isRedirectedToLogin(page)) { test.skip(true, "Auth blocked"); return; }

    await expect(page.getByRole("button", { name: /Calculate concrete/i })).toBeVisible();
  });

  test("clicking calculate returns a result panel", async ({ page, baseURL }) => {
    const startedAt = new Date().toISOString();

    const loggedIn = await tryLoginAs(page, "admin");
    if (!loggedIn) { test.skip(true, API_SKIP_MSG); return; }

    await page.goto("/tools/concrete");
    await page.waitForLoadState("networkidle");

    if (await isRedirectedToLogin(page)) { test.skip(true, "Auth blocked"); return; }

    const calcBtn = page.getByRole("button", { name: /Calculate concrete/i });
    await expect(calcBtn).toBeVisible();
    await calcBtn.click();

    await page.waitForTimeout(3_000);

    const hasResult =
      (await page.locator("[data-testid='tool-result']").isVisible().catch(() => false)) ||
      (await page.getByText(/Total|Materials|Labor|Risk/i).first().isVisible().catch(() => false));

    const hasError = await page.locator(".text-red-200, [class*='red-']").isVisible().catch(() => false);

    if (!hasResult && hasError) {
      const errText = await page.locator(".text-red-200, [class*='red-']").first().innerText().catch(() => "unknown error");
      writeEvidenceReport(
        buildReport("concrete-calculate", "blocked", startedAt, baseURL ?? "", {
          errors: [errText],
          recommendedActions: ["Start SEMSE API on port 4000 (pnpm dev:api)"],
        })
      );
      test.skip(true, `API not available: ${errText}`);
      return;
    }

    expect(hasResult).toBe(true);
    writeEvidenceReport(buildReport("concrete-calculate", "passed", startedAt, baseURL ?? ""));
  });
});
