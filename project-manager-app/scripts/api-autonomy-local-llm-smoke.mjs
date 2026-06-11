import assert from "node:assert/strict";
import crypto from "node:crypto";
import { readFileSync } from "node:fs";
import { readFile as readFileAsync } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { config as loadEnv } from "dotenv";
import { PrismaClient } from "@prisma/client";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "..");
loadEnv({ path: path.join(repoRoot, "packages/db/.env") });

const prisma = new PrismaClient();

function uniqueId(prefix) {
  return `${prefix}_${Date.now().toString(36)}_${crypto.randomUUID().slice(0, 8)}`;
}

function readApiEnvValue(key) {
  try {
    const envText = readFileSync(new URL("../apps/api/.env", import.meta.url), "utf8");
    const line = envText
      .split(/\r?\n/)
      .find((entry) => entry.trim().startsWith(`${key}=`));
    return line?.slice(line.indexOf("=") + 1).trim() || undefined;
  } catch {
    return undefined;
  }
}

function b64url(input) {
  return Buffer.from(input).toString("base64url");
}

function signSmokeToken(input) {
  const now = Math.floor(Date.now() / 1000);
  const payload = {
    userId: input.userId,
    tenantId: input.tenantId,
    orgId: input.orgId,
    roles: input.roles.split(",").map((role) => role.trim()).filter(Boolean),
    sid: `smoke_${Date.now()}`,
    typ: "access",
    jti: crypto.randomUUID(),
    iat: now,
    exp: now + 3600
  };
  const encodedPayload = b64url(JSON.stringify(payload));
  const sig = crypto.createHmac("sha256", input.secret).update(encodedPayload).digest("base64url");
  return `${encodedPayload}.${sig}`;
}

const config = {
  apiBaseUrl: process.env.SEMSE_API_URL ?? "http://127.0.0.1:4132",
  tenantId: process.env.SEMSE_TENANT_ID ?? uniqueId("tnt_autonomy_local"),
  orgId: process.env.SEMSE_ORG_ID ?? uniqueId("org_autonomy_local"),
  userId: process.env.SEMSE_USER_ID ?? uniqueId("usr_autonomy_local"),
  roles: process.env.SEMSE_ROLES ?? "OPS_ADMIN",
  expectedModel: process.env.SEMSE_AUTONOMY_EXPECT_MODEL ?? "qwen2.5:3b",
  authToken: process.env.SEMSE_AUTH_TOKEN
};

const cleanup = {
  tenant: !process.env.SEMSE_TENANT_ID,
  org: !process.env.SEMSE_ORG_ID,
  user: !process.env.SEMSE_USER_ID
};

async function main() {
  try {
    await seedFixture();

    console.log("[smoke:autonomy:local-llm] starting", {
      apiBaseUrl: config.apiBaseUrl,
      tenantId: config.tenantId,
      expectedModel: config.expectedModel
    });

    const provider = await request("GET", "/v1/autonomy/provider");
    assert.equal(provider.data.provider, "ollama");
    assert.equal(provider.data.model, config.expectedModel);
    assert.equal(provider.data.configured, true);

    const created = await request("POST", "/v1/autonomy/runs", {
      task: "add semse readiness note",
      workspaceId: `ws-autonomy-local-${Date.now()}`,
      repoId: "repo_semse_demo",
      taskId: "task_autonomy_local_smoke"
    });

    assert.equal(created.data.status, "COMPLETED");
    assert.ok(created.data.generatedFile, "generatedFile should exist");

    const generated = await readFileAsync(created.data.generatedFile, "utf8");
    assert.ok(!generated.includes("mode: fallback"), "autonomy output fell back instead of generating a useful artifact");
    assert.ok(generated.trim().length > 0, "generated artifact should not be empty");

    console.log("[smoke:autonomy:local-llm] success", {
      runId: created.data.id,
      branchName: created.data.branchName,
      commitSha: created.data.commitSha,
      generatedFile: created.data.generatedFile
    });
  } finally {
    try {
      await cleanupFixture();
    } catch (cleanupErr) {
      console.warn("[smoke:autonomy:local-llm] cleanup warning (non-fatal):", cleanupErr.message);
    }
    await prisma.$disconnect();
  }
}

async function request(method, path, body) {
  const headers = {
    "content-type": "application/json",
    "x-tenant-id": config.tenantId,
    "x-user-id": config.userId,
    "x-org-id": config.orgId,
    "x-roles": config.roles
  };
  const authToken = resolveAuthToken();
  if (authToken) {
    headers.authorization = `Bearer ${authToken}`;
  }

  const response = await fetch(`${config.apiBaseUrl}${path}`, {
    method,
    headers,
    body: method === "GET" || body === undefined ? undefined : JSON.stringify(body)
  });

  const json = await response.json();
  assert.ok(response.ok, `[${method}] ${path} failed: ${response.status} ${JSON.stringify(json)}`);
  return json;
}

function resolveAuthToken() {
  if (config.authToken) {
    return config.authToken;
  }

  const secret = process.env.AUTH_SECRET || readApiEnvValue("AUTH_SECRET");
  if (!secret) {
    return null;
  }

  config.authToken = signSmokeToken({
    secret,
    tenantId: config.tenantId,
    orgId: config.orgId,
    userId: config.userId,
    roles: config.roles
  });
  return config.authToken;
}

async function seedFixture() {
  await prisma.tenant.upsert({
    where: { id: config.tenantId },
    update: {},
    create: {
      id: config.tenantId,
      slug: config.tenantId,
      name: `Autonomy Local Smoke ${config.tenantId}`,
      status: "active"
    }
  });
  await prisma.org.upsert({
    where: { id: config.orgId },
    update: {},
    create: {
      id: config.orgId,
      tenantId: config.tenantId,
      type: "admin",
      name: "Autonomy Local Smoke Org"
    }
  });
  await prisma.user.upsert({
    where: { id: config.userId },
    update: {},
    create: {
      id: config.userId,
      email: `${config.userId}@autonomy-local.test`,
      status: "active"
    }
  });
}

async function cleanupFixture() {
  if (cleanup.org) {
    await prisma.org.deleteMany({ where: { id: config.orgId, tenantId: config.tenantId } });
  }
  if (cleanup.tenant) {
    await prisma.tenant.deleteMany({ where: { id: config.tenantId } });
  }
  if (cleanup.user) {
    await prisma.user.deleteMany({ where: { id: config.userId } });
  }
}

main().catch((error) => {
  console.error("[smoke:autonomy:local-llm] failed", error);
  process.exit(1);
});
