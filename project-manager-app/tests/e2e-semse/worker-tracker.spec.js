import { test, expect } from "@playwright/test";

const WEB_BASE = process.env.SEMSE_WEB_BASE_URL ?? "http://127.0.0.1:3002";

function parseClock(text) {
  const [hours = "0", minutes = "0", seconds = "0"] = text.trim().split(":");
  return Number(hours) * 3600 + Number(minutes) * 60 + Number(seconds);
}

test("tracker persiste tras reload y solo cambia con pausa/reanudacion/detencion", async ({ page, context }) => {
  test.setTimeout(120000);
  void context;

  page.on("console", (msg) => {
    console.log(`BROWSER CONSOLE [${msg.type()}]: ${msg.text()}`);
  });
  page.on("pageerror", (err) => {
    console.log(`BROWSER ERROR: ${err.message}`);
  });

  // Log in as Worker/Profesional — the tracker is a field-ops tool for professionals
  await page.goto("/login");
  await page.waitForLoadState("networkidle");
  await page.waitForTimeout(2000);
  await page.getByRole("button", { name: /Profesional/i }).click();
  await expect(page.locator("input[type='email']")).toHaveValue("worker@demo.semse");
  await page.getByRole("button", { name: /Ingresar/i }).click();
  await page.waitForURL(/\/worker\/dashboard$/);

  await page.goto("/worker/tracker");
  await page.waitForLoadState("networkidle");

  const seeded = await page.evaluate(async () => {
    const response = await fetch("/api/semse/tracker/bootstrap", {
      method: "POST",
      headers: { "content-type": "application/json" },
    });

    const payload = await response.json();
    if (!response.ok) {
      throw new Error(`/api/semse/tracker/bootstrap -> ${response.status} ${JSON.stringify(payload)}`);
    }

    return payload.data;
  });

  const job = seeded.job;
  await page.reload();
  await page.waitForLoadState("networkidle");

  // React data fetches run after hydration — wait explicitly for tracker to show job
  await expect(page.getByTestId("tracker-current-job")).toContainText(job.title, { timeout: 15000 });
  await expect(page.getByTestId("tracker-status-chip")).toContainText("Corriendo", { timeout: 10000 });

  const firstElapsed = parseClock(await page.getByTestId("tracker-elapsed").innerText());
  await page.waitForTimeout(1500);
  const secondElapsed = parseClock(await page.getByTestId("tracker-elapsed").innerText());
  expect(secondElapsed).toBeGreaterThanOrEqual(firstElapsed + 1);

  await page.reload();
  await page.waitForLoadState("networkidle");

  // Second reload — session must still be RUNNING
  await expect(page.getByTestId("tracker-current-job")).toContainText(job.title, { timeout: 15000 });
  await expect(page.getByTestId("tracker-status-chip")).toContainText("Corriendo", { timeout: 10000 });
  const thirdElapsed = parseClock(await page.getByTestId("tracker-elapsed").innerText());
  expect(thirdElapsed).toBeGreaterThanOrEqual(secondElapsed);

  await page.getByTestId("tracker-pause-button").click();
  await expect(page.getByTestId("tracker-status-chip")).toContainText("En pausa", { timeout: 5000 });

  const pausedElapsed = parseClock(await page.getByTestId("tracker-elapsed").innerText());
  await page.waitForTimeout(1200);
  const pausedElapsedAfterWait = parseClock(await page.getByTestId("tracker-elapsed").innerText());
  expect(pausedElapsedAfterWait).toBe(pausedElapsed);

  // Third reload — session must still be PAUSED
  await page.reload();
  await page.waitForLoadState("networkidle");
  await expect(page.getByTestId("tracker-status-chip")).toContainText("En pausa", { timeout: 15000 });
  await expect(page.getByTestId("tracker-resume-button")).toBeVisible({ timeout: 5000 });

  await page.getByTestId("tracker-resume-button").click();
  await expect(page.getByTestId("tracker-status-chip")).toContainText("Corriendo", { timeout: 5000 });

  await page.waitForTimeout(1200);
  await page.getByTestId("tracker-stop-button").click();

  await expect(page.getByText("Selecciona un trabajo y presiona Iniciar")).toBeVisible({ timeout: 10000 });
  await expect(page.getByTestId("tracker-session-card").first()).toContainText(job.title, { timeout: 10000 });
});
