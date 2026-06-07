import { test, expect } from "@playwright/test";

const WEB_BASE = process.env.SEMSE_WEB_BASE_URL ?? "http://127.0.0.1:3002";

function parseClock(text) {
  const [hours = "0", minutes = "0", seconds = "0"] = text.trim().split(":");
  return Number(hours) * 3600 + Number(minutes) * 60 + Number(seconds);
}

test("tracker persiste tras reload y solo cambia con pausa/reanudacion/detencion", async ({ page, context }) => {
  void context;

  await page.goto("/login");
  await page.getByRole("button", { name: /Admin/i }).click();
  await page.getByRole("button", { name: /Ingresar/i }).click();
  await page.waitForURL(/\/admin\/dashboard$/);

  await page.goto("/worker/tracker");

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

  await expect(page.getByTestId("tracker-current-job")).toContainText(job.title);
  await expect(page.getByTestId("tracker-status-chip")).toContainText("Corriendo");

  const firstElapsed = parseClock(await page.getByTestId("tracker-elapsed").innerText());
  await page.waitForTimeout(1500);
  const secondElapsed = parseClock(await page.getByTestId("tracker-elapsed").innerText());
  expect(secondElapsed).toBeGreaterThanOrEqual(firstElapsed + 1);

  await page.reload();
  await page.waitForLoadState("networkidle");

  await expect(page.getByTestId("tracker-current-job")).toContainText(job.title);
  await expect(page.getByTestId("tracker-status-chip")).toContainText("Corriendo");
  const thirdElapsed = parseClock(await page.getByTestId("tracker-elapsed").innerText());
  expect(thirdElapsed).toBeGreaterThanOrEqual(secondElapsed);

  await page.getByTestId("tracker-pause-button").click();
  await expect(page.getByTestId("tracker-status-chip")).toContainText("En pausa");

  const pausedElapsed = parseClock(await page.getByTestId("tracker-elapsed").innerText());
  await page.waitForTimeout(1200);
  const pausedElapsedAfterWait = parseClock(await page.getByTestId("tracker-elapsed").innerText());
  expect(pausedElapsedAfterWait).toBe(pausedElapsed);

  await page.reload();
  await page.waitForLoadState("networkidle");
  await expect(page.getByTestId("tracker-status-chip")).toContainText("En pausa");
  await expect(page.getByTestId("tracker-resume-button")).toBeVisible();

  await page.getByTestId("tracker-resume-button").click();
  await expect(page.getByTestId("tracker-status-chip")).toContainText("Corriendo");

  await page.waitForTimeout(1200);
  await page.getByTestId("tracker-stop-button").click();

  await expect(page.getByText("Selecciona un trabajo y presiona Iniciar")).toBeVisible();
  await expect(page.getByTestId("tracker-session-card").first()).toContainText(job.title);
});
