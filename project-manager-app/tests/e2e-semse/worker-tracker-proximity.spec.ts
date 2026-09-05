import { test, expect } from "@playwright/test";
import { loginAs } from "./utils/auth";

// Zócalo, CDMX — arbitrary fixed coordinate used for both the seeded FreeProject
// site and the simulated worker position (well within the ~150m proximity radius).
const SITE = { latitude: 19.4326, longitude: -99.1332 };

test.describe("Time Tracker — check-in por proximidad", () => {
  test.beforeEach(async ({ context }) => {
    // geolocation=(self) in next.config.ts still requires the browser to grant
    // permission — Playwright's context permission is separate from that header.
    await context.grantPermissions(["geolocation"]);
    await context.setGeolocation(SITE);
  });

  test("banner de proximidad aparece cerca de un proyecto libre y arranca el timer al confirmar", async ({ page }) => {
    test.setTimeout(60_000);

    await loginAs(page, "worker");

    // Seed a FreeProject with manually-set coordinates (avoids depending on a
    // live Google Maps API key in CI — same "manual override" path the
    // ProyectosTab "Usar mi ubicación actual" button exercises).
    const project = await page.evaluate(async (site) => {
      const response = await fetch("/api/semse/labor/free-projects", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          name: `Proximidad E2E ${Date.now()}`,
          location: "Zócalo, CDMX",
          latitude: site.latitude,
          longitude: site.longitude,
        }),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(`create free-project -> ${response.status} ${JSON.stringify(payload)}`);
      return payload.data;
    }, SITE);

    expect(project.latitude).toBeCloseTo(SITE.latitude, 3);

    await page.goto("/worker/tracker");
    await page.waitForLoadState("networkidle");

    const banner = page.getByTestId("tracker-proximity-banner");
    await expect(banner).toBeVisible({ timeout: 30_000 });
    await expect(banner).toContainText(project.name);

    await page.getByTestId("tracker-proximity-accept").click();

    await expect(page.getByTestId("tracker-status-chip")).toContainText(/Corriendo|running/i, { timeout: 15_000 });
    await expect(page.getByTestId("tracker-current-job")).toContainText(project.name);

    // Cleanup: stop the timer so the seeded project doesn't leave an active session behind.
    await page.getByTestId("tracker-stop-button").click();
  });

  test("con proximityCheckInMode = off, el navegador nunca recibe una solicitud de geolocalización", async ({ page }) => {
    await loginAs(page, "worker");

    await page.evaluate(async () => {
      const response = await fetch("/api/semse/users/me/profile", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ proximityCheckInMode: "off" }),
      });
      if (!response.ok) throw new Error(`update profile -> ${response.status}`);
    });

    let geolocationRequested = false;
    await page.exposeFunction("__markGeolocationRequested", () => {
      geolocationRequested = true;
    });
    await page.addInitScript(() => {
      const original = navigator.geolocation.watchPosition.bind(navigator.geolocation);
      navigator.geolocation.watchPosition = (...args) => {
        // @ts-expect-error — injected by the init script for the test only
        window.__markGeolocationRequested();
        return original(...args);
      };
    });

    await page.goto("/worker/tracker");
    await page.waitForLoadState("networkidle");
    await page.waitForTimeout(2000);

    expect(geolocationRequested).toBe(false);
    await expect(page.getByTestId("tracker-proximity-banner")).not.toBeVisible();
  });
});
