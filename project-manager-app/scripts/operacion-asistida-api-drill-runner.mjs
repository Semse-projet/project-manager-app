import assert from "node:assert/strict";
import { spawn } from "node:child_process";

const config = {
  host: process.env.SEMSE_API_DRILL_HOST ?? "127.0.0.1",
  port: Number(process.env.SEMSE_API_DRILL_PORT ?? 4140),
  databaseUrl:
    process.env.DATABASE_URL ??
    process.env.SEMSE_API_DRILL_DATABASE_URL ??
    "postgresql://semse:semse@127.0.0.1:5433/semse?schema=public",
  authSecret:
    process.env.AUTH_SECRET ??
    process.env.SEMSE_API_DRILL_AUTH_SECRET ??
    "semse_local_secret_123456789012345",
  runMigrations: (process.env.SEMSE_API_DRILL_MIGRATE ?? "true") !== "false",
  healthTimeoutMs: Number(process.env.SEMSE_API_DRILL_HEALTH_TIMEOUT_MS ?? 30_000)
};

const apiBaseUrl = `http://${config.host}:${config.port}`;
const envName = process.env.SEMSE_API_DRILL_ENV_NAME ?? "api-local";
const reportPath = process.env.SEMSE_BCP_REPORT_PATH ?? "docs/bcp/evidence/operacion-asistida-bcp-drill-api-latest.json";
const apiEnv = {
  ...process.env,
  NODE_ENV: process.env.NODE_ENV ?? "development",
  HOST: config.host,
  PORT: String(config.port),
  DATABASE_URL: config.databaseUrl,
  AUTH_SECRET: config.authSecret,
  SEMSE_API_URL: apiBaseUrl
};

let apiProcess;

async function main() {
  console.log("[drill:operacion-asistida:api-local] starting", {
    apiBaseUrl,
    database: redactDatabaseUrl(config.databaseUrl),
    runMigrations: config.runMigrations
  });

  if (config.runMigrations) {
    await runCommand("pnpm", ["db:migrate"], { env: apiEnv });
  }

  apiProcess = spawn("node", ["apps/api/dist/main.js"], {
    cwd: process.cwd(),
    env: apiEnv,
    stdio: ["ignore", "pipe", "pipe"]
  });

  apiProcess.stdout.on("data", (chunk) => process.stdout.write(`[api] ${chunk}`));
  apiProcess.stderr.on("data", (chunk) => process.stderr.write(`[api] ${chunk}`));

  apiProcess.once("exit", (code, signal) => {
    if (code !== null && code !== 0) {
      process.stderr.write(`[api] exited before drill completed code=${code} signal=${signal ?? "none"}\n`);
    }
  });

  await waitForHealth();

  await runCommand("node", ["./scripts/operacion-asistida-bcp-drill.mjs"], {
    env: {
      ...apiEnv,
      SEMSE_BCP_DRILL_MODE: "api",
      SEMSE_BCP_ENV_NAME: envName,
      SEMSE_API_URL: apiBaseUrl,
      SEMSE_BCP_REPORT_PATH: reportPath
    }
  });

  console.log("[drill:operacion-asistida:api-local] success", {
    apiBaseUrl,
    reportPath
  });
}

async function waitForHealth() {
  const deadline = Date.now() + config.healthTimeoutMs;
  let lastError;

  while (Date.now() < deadline) {
    if (apiProcess.exitCode !== null) {
      throw new Error(`API process exited before healthcheck succeeded with code ${apiProcess.exitCode}`);
    }

    try {
      const response = await fetch(`${apiBaseUrl}/v1/health`);
      const json = await response.json();

      if (response.ok && json.data?.persistence === "prisma") {
        console.log("[drill:operacion-asistida:api-local] health ready", json.data);
        return;
      }

      lastError = new Error(`Healthcheck returned ${response.status}: ${JSON.stringify(json)}`);
    } catch (error) {
      lastError = error;
    }

    await sleep(500);
  }

  throw new Error(
    `API did not become healthy within ${config.healthTimeoutMs}ms. Last error: ${
      lastError instanceof Error ? lastError.message : String(lastError)
    }`
  );
}

async function runCommand(command, args, options = {}) {
  console.log("[drill:operacion-asistida:api-local] run", [command, ...args].join(" "));

  await new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      cwd: process.cwd(),
      env: options.env ?? process.env,
      stdio: "inherit"
    });

    child.once("error", reject);
    child.once("exit", (code, signal) => {
      try {
        assert.equal(signal, null, `${command} terminated by signal ${signal}`);
        assert.equal(code, 0, `${command} exited with code ${code}`);
        resolve();
      } catch (error) {
        reject(error);
      }
    });
  });
}

function redactDatabaseUrl(databaseUrl) {
  return databaseUrl.replace(/:\/\/([^:]+):([^@]+)@/, "://$1:***@");
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function shutdown() {
  if (!apiProcess || apiProcess.exitCode !== null) {
    return;
  }

  apiProcess.kill("SIGTERM");

  await new Promise((resolve) => {
    const timeout = setTimeout(() => {
      if (apiProcess.exitCode === null) {
        apiProcess.kill("SIGKILL");
      }
      resolve();
    }, 5_000);

    apiProcess.once("exit", () => {
      clearTimeout(timeout);
      resolve();
    });
  });
}

main()
  .catch((error) => {
    console.error("[drill:operacion-asistida:api-local] failed", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await shutdown();
  });
