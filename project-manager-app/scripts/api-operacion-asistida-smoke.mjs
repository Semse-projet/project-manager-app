import assert from "node:assert/strict";

const config = {
  apiBaseUrl: process.env.SEMSE_API_URL ?? "http://127.0.0.1:4000",
  tenantId: process.env.SEMSE_TENANT_ID ?? `tnt_operacion_asistida_${Date.now()}`,
  orgId: process.env.SEMSE_ORG_ID ?? "org_ops",
  userId: process.env.SEMSE_USER_ID ?? "usr_ops",
  roles: process.env.SEMSE_ROLES ?? "OPS_ADMIN"
};

const actor = {
  userId: config.userId,
  orgId: config.orgId,
  roles: config.roles
};

const ids = {
  workspaceId: `workspace-smoke-${Date.now()}`,
  repoId: "repo-semse-smoke",
  taskId: "task-operacion-asistida-smoke",
  correlationId: `corr-operacion-asistida-${Date.now()}`
};

async function main() {
  console.log("[smoke:operacion-asistida] starting", {
    apiBaseUrl: config.apiBaseUrl,
    tenantId: config.tenantId,
    workspaceId: ids.workspaceId
  });

  const health = await request(actor, "GET", "/v1/health");
  assert.equal(health.data.persistence, "prisma");

  const created = await request(actor, "POST", "/v1/agents/runs", {
    agentType: "risk",
    triggerType: "manual",
    correlationId: ids.correlationId,
    workspaceId: ids.workspaceId,
    repoId: ids.repoId,
    taskId: ids.taskId,
    input: {
      eventType: "operacion_asistida.smoke",
      scope: "Validate operator context filters and workspace memory traceability.",
      budgetCents: 250000
    },
    inputSummary: "Operacion asistida filter smoke"
  });

  const runId = created.data.id;
  assert.equal(created.data.input.operatorContext.workspaceId, ids.workspaceId);
  assert.equal(created.data.input.operatorContext.operatorId, config.userId);

  await request(actor, "POST", `/v1/agents/runs/${runId}/start`, {});
  await request(actor, "POST", `/v1/agents/runs/${runId}/complete`, {
    output: {
      actionType: "classify",
      summary: "Operacion asistida smoke completed",
      confidence: 0.91,
      requiresHumanReview: false
    }
  });

  const byWorkspace = await request(
    actor,
    "GET",
    `/v1/ops/agent-runtime?workspaceId=${encodeURIComponent(ids.workspaceId)}&limit=20`
  );
  assert.ok(byWorkspace.data.items.some((item) => item.id === runId), "workspaceId filter should include the completed run");

  const byOperator = await request(
    actor,
    "GET",
    `/v1/ops/agent-runtime?operatorId=${encodeURIComponent(config.userId)}&limit=20`
  );
  assert.ok(byOperator.data.items.some((item) => item.id === runId), "operatorId filter should include the completed run");

  const byMemoryTag = await request(actor, "GET", "/v1/ops/agent-runtime?memoryTag=agent-runtime&limit=20");
  assert.ok(byMemoryTag.data.items.some((item) => item.id === runId), "memoryTag filter should include the completed run");

  const trace = await request(actor, "GET", `/v1/ops/agent-runtime/${encodeURIComponent(ids.correlationId)}`);
  assert.ok(trace.data.runs.some((run) => run.id === runId && run.operatorContext.workspaceId === ids.workspaceId));
  assert.ok(trace.data.workspaceMemory.some((memory) => memory.runId === runId && memory.tags.includes("agent-runtime")));

  const memory = await request(
    actor,
    "GET",
    `/v1/knowledge/workspace-memory?workspaceId=${encodeURIComponent(ids.workspaceId)}&tags=agent-runtime`
  );
  assert.ok(memory.data.items.some((item) => item.runId === runId), "knowledge workspace-memory should expose the run summary");

  console.log("[smoke:operacion-asistida] success", {
    tenantId: config.tenantId,
    runId,
    workspaceId: ids.workspaceId,
    correlationId: ids.correlationId
  });
}

async function request(requestActor, method, path, body) {
  const response = await fetch(`${config.apiBaseUrl}${path}`, {
    method,
    headers: {
      "content-type": "application/json",
      "x-tenant-id": config.tenantId,
      "x-user-id": requestActor.userId,
      "x-org-id": requestActor.orgId,
      "x-roles": requestActor.roles
    },
    body: method === "GET" || body === undefined ? undefined : JSON.stringify(body)
  });

  const json = await response.json();
  assert.ok(response.ok, `[${method}] ${path} failed: ${response.status} ${JSON.stringify(json)}`);
  return json;
}

main().catch((error) => {
  console.error("[smoke:operacion-asistida] failed", error);
  process.exit(1);
});
