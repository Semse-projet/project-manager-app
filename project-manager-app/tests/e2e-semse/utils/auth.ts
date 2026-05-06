import type { Page } from "@playwright/test";

export type DemoRole = "client" | "worker" | "admin";

const PRESET_LABELS: Record<DemoRole, RegExp> = {
  client: /Cliente/i,
  worker: /Profesional/i,
  admin: /Admin/i,
};

/**
 * Attempts login via the SEMSE demo login page.
 * Returns true if login succeeded, false if API is not available.
 * Throws only if the page itself fails to load (real error).
 */
export async function tryLoginAs(page: Page, role: DemoRole = "admin"): Promise<boolean> {
  await page.goto("/login");
  await page.waitForLoadState("domcontentloaded");

  const presetBtn = page.getByRole("button", { name: PRESET_LABELS[role] }).first();
  if (await presetBtn.isVisible()) {
    await presetBtn.click();
  }

  await page.getByRole("button", { name: /Ingresar/i }).click();

  try {
    await page.waitForURL((url) => !url.pathname.startsWith("/login"), { timeout: 10_000 });
    return true;
  } catch {
    return false;
  }
}

/**
 * Logs in via the SEMSE demo login page.
 * Throws if login fails — use tryLoginAs() for graceful skip.
 */
export async function loginAs(page: Page, role: DemoRole = "admin"): Promise<void> {
  const ok = await tryLoginAs(page, role);
  if (!ok) {
    throw new Error(`Login failed for role "${role}" — SEMSE API may not be running on port 4000`);
  }
}

/**
 * Returns true if the page redirected to /login, indicating the route is auth-protected.
 */
export async function isRedirectedToLogin(page: Page): Promise<boolean> {
  return page.url().includes("/login");
}
