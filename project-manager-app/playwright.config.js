import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./tests/e2e",
  timeout: 30000,
  retries: 0,
  workers: 1,
  globalSetup: "./scripts/e2e-static-server.mjs",
  use: {
    baseURL: "http://127.0.0.1:4173",
    headless: true,
  },
});
