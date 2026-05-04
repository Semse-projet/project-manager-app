import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const config = {
  apiBaseUrl: process.env.SEMSE_API_URL ?? "http://127.0.0.1:4132",
  tenantId: process.env.SEMSE_TENANT_ID ?? "tnt_demo",
  orgId: process.env.SEMSE_ORG_ID ?? "org_demo",
  userId: process.env.SEMSE_USER_ID ?? "usr_demo",
  roles: process.env.SEMSE_ROLES ?? "OPS_ADMIN",
  expectedModel: process.env.SEMSE_AUTONOMY_EXPECT_MODEL ?? "qwen2.5:3b"
};

async function main() {
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

  const generated = await readFile(created.data.generatedFile, "utf8");
  assert.ok(!generated.includes("mode: fallback"), "autonomy output fell back instead of generating a useful artifact");
  assert.ok(generated.trim().length > 0, "generated artifact should not be empty");

  console.log("[smoke:autonomy:local-llm] success", {
    runId: created.data.id,
    branchName: created.data.branchName,
    commitSha: created.data.commitSha,
    generatedFile: created.data.generatedFile
  });
}

async function request(method, path, body) {
  const response = await fetch(`${config.apiBaseUrl}${path}`, {
    method,
    headers: {
      "content-type": "application/json",
      "x-tenant-id": config.tenantId,
      "x-user-id": config.userId,
      "x-org-id": config.orgId,
      "x-roles": config.roles
    },
    body: method === "GET" || body === undefined ? undefined : JSON.stringify(body)
  });

  const json = await response.json();
  assert.ok(response.ok, `[${method}] ${path} failed: ${response.status} ${JSON.stringify(json)}`);
  return json;
}

main().catch((error) => {
  console.error("[smoke:autonomy:local-llm] failed", error);
  process.exit(1);
});
