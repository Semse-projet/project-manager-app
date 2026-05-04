import { defineConfig } from "@playwright/test";

const baseURL = process.env.SEMSE_WEB_BASE_URL ?? "http://127.0.0.1:3002";

export default defineConfig({
  testDir: "./tests/e2e-semse",
  timeout: 45000,
  retries: 0,
  use: {
    baseURL,
    headless: true,
  },
});
