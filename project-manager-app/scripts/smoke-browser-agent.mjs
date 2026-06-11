import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { setTimeout as sleep } from "node:timers/promises";
import crypto from "node:crypto";

const config = {
  host: "127.0.0.1",
  port: 4250,
  databaseUrl: process.env.DATABASE_URL ?? "postgresql://semse:semse@127.0.0.1:5433/semse?schema=public",
  redisUrl: process.env.REDIS_URL ?? "redis://127.0.0.1:6379",
  authSecret: "semse_local_secret_123456789012345", // >32 characters
  ollamaBaseUrl: "http://127.0.0.1:11434",
  ollamaModel: "qwen2.5:3b"
};

const apiBaseUrl = `http://${config.host}:${config.port}`;

const commonEnv = {
  ...process.env,
  NODE_ENV: "development",
  DATABASE_URL: config.databaseUrl,
  REDIS_URL: config.redisUrl,
  AUTH_SECRET: config.authSecret,
  ENABLE_OPEN_SOURCE_MODELS: "true",
  OLLAMA_BASE_URL: config.ollamaBaseUrl,
  OLLAMA_MODEL: config.ollamaModel,
  LLM_DEFAULT_PROVIDER: "ollama",
  SEMSE_API_URL: apiBaseUrl,
  SEMSE_TENANT_ID: "tnt_smoke_001",
  SEMSE_USER_ID: "usr_smoke_001",
  SEMSE_ORG_ID: "org_smoke_001",
  SEMSE_ROLES: "OPS_ADMIN"
};

let apiProcess = null;
let workerProcess = null;
let authToken = "";

function signToken(claims, secret, ttlSeconds = 3600) {
  const now = Math.floor(Date.now() / 1000);
  const payload = { ...claims, jti: crypto.randomUUID(), iat: now, exp: now + ttlSeconds };
  const encodedPayload = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const sig = crypto.createHmac("sha256", secret).update(encodedPayload).digest("base64url");
  return `${encodedPayload}.${sig}`;
}

async function main() {
  console.log("🚀 Starting Sense Browser Agent Smoke Test...");
  console.log(`- API URL: ${apiBaseUrl}`);
  console.log(`- Postgres URL: ${config.databaseUrl}`);
  console.log(`- Redis URL: ${config.redisUrl}`);

  // Generate auth token
  authToken = signToken({
    userId: "usr_smoke_001",
    tenantId: "tnt_smoke_001",
    orgId: "org_smoke_001",
    roles: ["OPS_ADMIN"],
    sid: "ses_smoke_001"
  }, config.authSecret);

  // 1. Spawn NestJS API
  console.log("👉 Spawning API server...");
  apiProcess = spawn("node", ["apps/api/dist/main.js"], {
    env: {
      ...commonEnv,
      PORT: String(config.port),
      HOST: config.host
    },
    stdio: ["ignore", "pipe", "pipe"]
  });

  apiProcess.stdout.on("data", (chunk) => {
    process.stdout.write(`[api] ${chunk}`);
  });
  apiProcess.stderr.on("data", (chunk) => {
    process.stderr.write(`[api-stderr] ${chunk}`);
  });

  // 2. Spawn BullMQ Worker
  console.log("👉 Spawning BullMQ Worker...");
  workerProcess = spawn("node", ["apps/worker/src/main.mjs"], {
    env: commonEnv,
    stdio: ["ignore", "pipe", "pipe"]
  });

  workerProcess.stdout.on("data", (chunk) => {
    process.stdout.write(`[worker] ${chunk}`);
  });
  workerProcess.stderr.on("data", (chunk) => {
    process.stderr.write(`[worker-stderr] ${chunk}`);
  });

  // Handle process exits
  apiProcess.once("exit", (code) => {
    if (code !== null && code !== 0) {
      console.error(`❌ API process exited unexpectedly with code ${code}`);
    }
  });
  workerProcess.once("exit", (code) => {
    if (code !== null && code !== 0) {
      console.error(`❌ Worker process exited unexpectedly with code ${code}`);
    }
  });

  // 3. Wait for API to be healthy
  await waitForHealth();

  // 4. Trigger browser inspection
  console.log("👉 Triggering browser inspection of https://example.com ...");
  const triggerRes = await fetchApi("POST", "/v1/browser-agent/inspect", {
    url: "https://example.com",
    includeScreenshot: true,
    includeText: true,
    includeAiSummary: true
  });

  const { runId, status: initialStatus } = triggerRes.data;
  console.log(`✅ Run created successfully! RunId: ${runId}, Status: ${initialStatus}`);
  assert.equal(initialStatus, "queued");

  // 5. Poll result until completed
  console.log("👉 Polling inspection job result...");
  const maxAttempts = 30;
  let attempt = 0;
  let finalResult = null;

  while (attempt < maxAttempts) {
    attempt++;
    await sleep(2000);

    const pollRes = await fetchApi("GET", `/v1/browser-agent/inspect/${runId}`);
    const currentRun = pollRes.data;
    console.log(`   [Attempt ${attempt}/${maxAttempts}] Current Status: ${currentRun.status}`);

    if (currentRun.status === "completed") {
      finalResult = currentRun;
      break;
    }

    if (currentRun.status === "failed") {
      throw new Error(`Browser agent run failed: ${JSON.stringify(currentRun)}`);
    }
  }

  if (!finalResult) {
    throw new Error(`Inspection run did not complete within ${maxAttempts * 2} seconds.`);
  }

  // 6. Assertions on the result
  console.log("👉 Validating inspection output details...");
  assert.equal(finalResult.success, true, "Inspection success should be true");
  assert.ok(finalResult.title && finalResult.title.includes("Example Domain"), "Page title should contain 'Example Domain'");
  assert.ok(finalResult.visibleTextSample && finalResult.visibleTextSample.includes("Example Domain"), "Visible text sample should contain 'Example Domain'");
  assert.ok(finalResult.screenshotBase64 && finalResult.screenshotBase64.length > 1000, "Should contain a valid base64 screenshot");
  
  // AI summary validations
  assert.ok(finalResult.aiSummary, "Should contain an AI-generated summary");
  assert.ok(finalResult.aiSummary.summary_es, "AI summary should have spanish text");
  assert.ok(finalResult.aiSummary.summary_en, "AI summary should have english text");
  assert.ok(Array.isArray(finalResult.aiSummary.recommendations), "AI summary recommendations should be an array");
  
  console.log("\n🎉 AI Summary Output Sample:");
  console.log(`- Spanish: ${finalResult.aiSummary.summary_es}`);
  console.log(`- English: ${finalResult.aiSummary.summary_en}`);
  console.log(`- Recommendations: ${finalResult.aiSummary.recommendations.join(", ")}`);

  console.log("\n⭐⭐⭐ Browser Agent Smoke Test Passed Successfully! ⭐⭐⭐");
}

async function waitForHealth() {
  const deadline = Date.now() + 30000;
  while (Date.now() < deadline) {
    if (apiProcess.exitCode !== null) {
      throw new Error("API exited before health check succeeded");
    }
    try {
      const res = await fetch(`${apiBaseUrl}/v1/health`, {
        headers: {
          "authorization": `Bearer ${authToken}`,
          "x-tenant-id": "tnt_smoke_001",
          "x-user-id": "usr_smoke_001",
          "x-org-id": "org_smoke_001",
          "x-roles": "OPS_ADMIN"
        }
      });
      const json = await res.json();
      if (res.ok) {
        if (json.data?.persistence === "prisma") {
          console.log("✅ API server is healthy and ready!");
          return;
        } else {
          console.log(`⚠️ Health check responded but persistence is not prisma: ${JSON.stringify(json)}`);
        }
      } else {
        console.log(`⚠️ Health check returned status ${res.status}: ${JSON.stringify(json)}`);
      }
    } catch (err) {
      console.log(`⚠️ Health check connection waiting... (${err.message})`);
      if (err.cause) {
        console.log(`   Cause:`, err.cause);
      } else {
        console.log(`   Error stack:`, err.stack);
      }
    }
    await sleep(2000);
  }
  throw new Error("API server health check timed out");
}

async function fetchApi(method, path, body) {
  const response = await fetch(`${apiBaseUrl}${path}`, {
    method,
    headers: {
      "content-type": "application/json",
      "authorization": `Bearer ${authToken}`,
      "x-tenant-id": "tnt_smoke_001",
      "x-user-id": "usr_smoke_001",
      "x-org-id": "org_smoke_001",
      "x-roles": "OPS_ADMIN"
    },
    body: body ? JSON.stringify(body) : undefined
  });

  const json = await response.json();
  if (!response.ok) {
    throw new Error(`Request [${method}] ${path} failed with status ${response.status}: ${JSON.stringify(json)}`);
  }
  return json;
}

function cleanup() {
  console.log("👉 Cleaning up child processes...");
  if (apiProcess) {
    apiProcess.kill();
  }
  if (workerProcess) {
    workerProcess.kill();
  }
}

// Ensure cleanup on exit
process.on("exit", cleanup);
process.on("SIGINT", () => {
  cleanup();
  process.exit(0);
});
process.on("SIGTERM", () => {
  cleanup();
  process.exit(0);
});

main().catch((error) => {
  console.error("❌ Smoke test failed:", error);
  cleanup();
  process.exit(1);
});
