import { defineConfig } from "@playwright/test";

const baseURL = process.env.SEMSE_WEB_BASE_URL ?? "http://127.0.0.1:3002";
const chromiumExecutablePath = process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH?.trim();

export default defineConfig({
  testDir: "./tests/e2e-semse",
  timeout: 45000,
  retries: 0,
  use: {
    baseURL,
    headless: true,
    launchOptions: chromiumExecutablePath ? { executablePath: chromiumExecutablePath } : undefined,
  },
});
