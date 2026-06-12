import assert from "node:assert/strict";
import crypto from "node:crypto";
import { setTimeout as sleep } from "node:timers/promises";

const config = {
  apiBaseUrl: process.env.SEMSE_API_URL ?? "http://127.0.0.1:4000",
  authSecret: process.env.AUTH_SECRET ?? "semse_local_secret_123456789012345",
  authToken: process.env.SEMSE_AUTH_TOKEN ?? "",
  tenantId: process.env.SEMSE_TENANT_ID ?? "tnt_smoke_001",
  userId: process.env.SEMSE_USER_ID ?? "usr_smoke_001",
  orgId: process.env.SEMSE_ORG_ID ?? "org_smoke_001",
  roles: process.env.SEMSE_ROLES ?? "OPS_ADMIN"
};

let authToken = config.authToken;

function signToken(claims, secret, ttlSeconds = 3600) {
  const now = Math.floor(Date.now() / 1000);
  const payload = { ...claims, jti: crypto.randomUUID(), iat: now, exp: now + ttlSeconds };
  const encodedPayload = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const sig = crypto.createHmac("sha256", secret).update(encodedPayload).digest("base64url");
  return `${encodedPayload}.${sig}`;
}

async function main() {
  console.log("🚀 Starting Remote Sense Browser Agent Smoke Test...");
  console.log(`- Remote API URL: ${config.apiBaseUrl}`);
  console.log(`- Tenant ID: ${config.tenantId}`);

  // Generate auth token if not provided
  if (!authToken) {
    console.log("👉 Signing auth token using AUTH_SECRET...");
    authToken = signToken({
      userId: config.userId,
      tenantId: config.tenantId,
      orgId: config.orgId,
      roles: config.roles.split(",").map(r => r.trim()).filter(Boolean),
      sid: "ses_smoke_remote_001"
    }, config.authSecret);
  } else {
    console.log("👉 Using provided SEMSE_AUTH_TOKEN...");
  }

  // 1. Verify remote API health
  console.log("👉 Checking remote API health...");
  const healthRes = await fetch(`${config.apiBaseUrl}/v1/health`, {
    headers: {
      "authorization": `Bearer ${authToken}`,
      "x-tenant-id": config.tenantId,
      "x-user-id": config.userId,
      "x-org-id": config.orgId,
      "x-roles": config.roles
    }
  });
  const healthJson = await healthRes.json();
  if (!healthRes.ok) {
    throw new Error(`Remote API health check failed (${healthRes.status}): ${JSON.stringify(healthJson)}`);
  }
  console.log("✅ Remote API is healthy:", JSON.stringify(healthJson.data));

  // 2. Trigger browser inspection
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

  // 3. Poll result until completed
  console.log("👉 Polling inspection job result on remote worker...");
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
      throw new Error(`Remote browser agent run failed: ${JSON.stringify(currentRun)}`);
    }
  }

  if (!finalResult) {
    throw new Error(`Inspection run did not complete within ${maxAttempts * 2} seconds.`);
  }

  // 4. Assertions on the result
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

  console.log("\n⭐⭐⭐ Remote Browser Agent Smoke Test Passed Successfully! ⭐⭐⭐");
  process.exit(0);
}

async function fetchApi(method, path, body) {
  const response = await fetch(`${config.apiBaseUrl}${path}`, {
    method,
    headers: {
      "content-type": "application/json",
      "authorization": `Bearer ${authToken}`,
      "x-tenant-id": config.tenantId,
      "x-user-id": config.userId,
      "x-org-id": config.orgId,
      "x-roles": config.roles
    },
    body: body ? JSON.stringify(body) : undefined
  });

  const json = await response.json();
  if (!response.ok) {
    throw new Error(`Request [${method}] ${path} failed with status ${response.status}: ${JSON.stringify(json)}`);
  }
  return json;
}

main().catch((error) => {
  console.error("❌ Remote Smoke test failed:", error);
  process.exit(1);
});
