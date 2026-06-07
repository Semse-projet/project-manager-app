import assert from "node:assert/strict";

const config = {
  apiBaseUrl: process.env.SEMSE_API_URL ?? "http://127.0.0.1:4000",
  tenantId: process.env.SEMSE_TENANT_ID ?? "tenant_default",
  userId: process.env.SEMSE_USER_ID ?? "usr_admin_001",
  orgId: process.env.SEMSE_ORG_ID ?? "org_admin_001",
  roles: process.env.SEMSE_ROLES ?? "OPS_ADMIN",
};

async function main() {
  console.log("[smoke:ai-models] starting", config.apiBaseUrl);

  const registry = await request("GET", "/v1/ai-models");
  assert.ok(Array.isArray(registry.data), "registry should return enabled models array");
  assert.ok(registry.data.length >= 1, "expected at least one enabled model");

  const readiness = await request("GET", "/v1/ai-models/readiness");
  assert.ok(Array.isArray(readiness.data.models), "readiness should include models");
  assert.ok(Array.isArray(readiness.data.routeSamples), "readiness should include routeSamples");
  assert.ok(typeof readiness.data.llmOrchestrator?.hasProvider === "boolean", "readiness should include orchestrator state");

  const generated = await request("POST", "/v1/ai-models/generate", {
    agentId: "assistant",
    taskType: "general_chat",
    input: "Di hola desde el smoke del gateway AI.",
    userId: config.userId,
  });
  assert.equal(generated.data.success, true);
  assert.ok(typeof generated.data.output === "string");
  assert.ok(generated.data.output.length >= 0);

  const ctxGlobal = await request("GET", "/v1/ai-models/operational-context");
  assert.ok(ctxGlobal.data);
  assert.ok(typeof ctxGlobal.data.mode === "string");
  assert.ok(ctxGlobal.data.user?.id === config.userId);

  const contextOnly = await request("POST", "/v1/ai-models/prometeo/chat", {
    message: "Necesito el estado del proyecto actual",
    agentId: "pulse",
  });
  assert.equal(contextOnly.data.mode, "context_only");

  const report = await request("POST", "/v1/ai-models/prometeo/chat", {
    message: "Dame un resumen operativo",
    agentId: "assistant",
  });
  assert.equal(report.data.mode, "report");

  const logs = await request("GET", "/v1/ai-models/logs?limit=10");
  assert.ok(Array.isArray(logs.data), "logs should be an array");
  const modes = new Set(logs.data.map((entry) => entry.mode));
  assert.ok(modes.has("runtime") || modes.has("fallback"), "logs should include a gateway interaction");
  assert.ok(modes.has("report"), "logs should include report mode");
  assert.ok(modes.has("context_only"), "logs should include context_only mode");

  const stats = await request("GET", "/v1/ai-models/logs/stats");
  assert.ok(typeof stats.data.total === "number");
  assert.ok(stats.data.byMode && typeof stats.data.byMode === "object");

  console.log("[smoke:ai-models] success", {
    enabledModels: registry.data.length,
    runtimeProviders: readiness.data.llmOrchestrator.providers,
    modes: [...modes],
    totalLogs: stats.data.total,
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
      "x-roles": config.roles,
    },
    body: method === "GET" || body === undefined ? undefined : JSON.stringify(body),
  });

  const json = await response.json().catch(() => ({}));
  assert.ok(response.ok, `[${method}] ${path} failed: ${response.status} ${JSON.stringify(json)}`);
  return json;
}

main().catch((error) => {
  console.error("[smoke:ai-models] failed", error);
  process.exit(1);
});
