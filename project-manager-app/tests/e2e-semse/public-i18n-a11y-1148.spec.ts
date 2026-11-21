/**
 * #1148 — idioma y foco en páginas públicas, solo lectura: no envía formularios
 * ni crea cuentas. Pensado para local o preview:
 *   PLAYWRIGHT_BASE_URL=http://127.0.0.1:3000 pnpm exec playwright test -c playwright.semse.config.ts tests/e2e-semse/public-i18n-a11y-1148.spec.ts
 */
import { test, expect, type BrowserContext } from "@playwright/test";

const AUTH = ["/login", "/register", "/forgot-password"];

async function withLanguage(context: BrowserContext, baseURL: string, lang: "es" | "en") {
  await context.addCookies([{ name: "semse-language", value: lang, url: baseURL }]);
}

for (const route of AUTH) {
  test(`${route}: html lang, title and switch follow ES→EN→ES`, async ({ page, context, baseURL }) => {
    await withLanguage(context, baseURL!, "es");
    await page.goto(route);
    await expect(page.locator("html")).toHaveAttribute("lang", "es");
    await expect(page).toHaveTitle(/Profesionales verificados/);

    const group = page.getByRole("group", { name: "Idioma" });
    await expect(group.getByRole("button", { name: "ES", exact: true })).toHaveAttribute("aria-pressed", "true");
    await group.getByRole("button", { name: "EN", exact: true }).click();
    await expect(page.locator("html")).toHaveAttribute("lang", "en");
    await expect(page.getByRole("group", { name: "Language" }).getByRole("button", { name: "EN", exact: true }))
      .toHaveAttribute("aria-pressed", "true");

    await page.reload();
    await expect(page.locator("html")).toHaveAttribute("lang", "en");
    await expect(page).toHaveTitle(/Verified professionals/);

    await page.getByRole("button", { name: "ES", exact: true }).click();
    await expect(page.locator("html")).toHaveAttribute("lang", "es");
  });

  test(`${route}: keyboard focus on inputs is visible`, async ({ page }) => {
    await page.goto(route);
    const input = page.locator("input:not([type=hidden])").first();
    for (let i = 0; i < 12 && !(await input.evaluate((el) => el === document.activeElement)); i++) {
      await page.keyboard.press("Tab");
    }
    await expect(input).toBeFocused();
    const outline = await input.evaluate((el) => getComputedStyle(el).outlineStyle);
    expect(outline).not.toBe("none");
  });
}

test("Spanish-only public pages mark their content as Spanish under an EN cookie", async ({ page, context, baseURL }) => {
  await withLanguage(context, baseURL!, "en");
  for (const route of ["/", "/como-funciona"]) {
    await page.goto(route);
    await expect(page.locator("div.public-theme")).toHaveAttribute("lang", "es");
    await expect(page).toHaveTitle("SEMSE Project — Profesionales verificados y pagos seguros");
  }
});
