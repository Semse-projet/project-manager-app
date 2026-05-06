import { defineConfig, devices } from "@playwright/test";

const baseURL = process.env.PLAYWRIGHT_BASE_URL ?? process.env.SEMSE_WEB_BASE_URL ?? "http://localhost:3000";

export default defineConfig({
  testDir: "./tests/e2e-semse",
  testMatch: "**/*.spec.ts",
  timeout: 45_000,
  retries: process.env.CI ? 2 : 0,
  fullyParallel: false,
  workers: 1,

  reporter: [
    ["list"],
    ["json", { outputFile: "artifacts/evidence/playwright/report.json" }],
    ["html", { outputFolder: "artifacts/evidence/playwright/html", open: "never" }],
  ],

  use: {
    baseURL,
    headless: true,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    video: "retain-on-failure",
  },

  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],

  outputDir: "artifacts/evidence/playwright/test-results",
});
