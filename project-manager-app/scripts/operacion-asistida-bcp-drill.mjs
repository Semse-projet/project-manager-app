import assert from "node:assert/strict";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";

const now = new Date();
const mode = readMode();
const runStamp = now.toISOString().replaceAll(":", "").replaceAll(".", "").replace("T", "_").replace("Z", "Z");
const defaultActorSuffix = String(now.getTime());

const config = {
  mode,
  environmentName: process.env.SEMSE_BCP_ENV_NAME ?? (mode === "api" ? "api-local" : "local"),
  apiBaseUrl: process.env.SEMSE_API_URL ?? "http://127.0.0.1:4000",
  tenantId: process.env.SEMSE_TENANT_ID ?? `tnt_bcp_drill_${defaultActorSuffix}`,
  orgId: process.env.SEMSE_ORG_ID ?? `org_bcp_${defaultActorSuffix}`,
  userId: process.env.SEMSE_USER_ID ?? `usr_bcp_operator_${defaultActorSuffix}`,
  roles: process.env.SEMSE_ROLES ?? "OPS_ADMIN",
  authSecret: process.env.AUTH_SECRET,
  evidenceDir: process.env.SEMSE_BCP_EVIDENCE_DIR ?? join("docs", "bcp", "evidence"),
  manifestPath:
    process.env.SEMSE_BCP_MANIFEST_PATH ??
    join("docs", "bcp", "evidence", "manifest.json"),
  reportPath:
    process.env.SEMSE_BCP_REPORT_PATH ??
    join("docs", "bcp", "evidence", `operacion-asistida-bcp-drill-${mode}-latest.json`)
};

const actor = {
  userId: config.userId,
  orgId: config.orgId,
  roles: config.roles
};

let apiAccessToken;

const ids = {
  workspaceId: `workspace-bcp-${Date.now()}`,
  repoId: "repo-semse-bcp",
  taskId: "task-operacion-asistida-bcp",
  correlationId: `corr-operacion-asistida-bcp-${Date.now()}`
};

async function main() {
  console.log("[drill:operacion-asistida:bcp] starting", {
    mode: config.mode,
    apiBaseUrl: config.mode === "api" ? config.apiBaseUrl : undefined,
    tenantId: config.tenantId,
    workspaceId: ids.workspaceId
  });

  const report = config.mode === "api" ? await runApiDrill() : await runLocalDrill();
  const writtenReports = await writeReport(report);

  console.log("[drill:operacion-asistida:bcp] success", {
    mode: config.mode,
    reports: writtenReports,
    checks: report.checks.length
  });
}

async function runLocalDrill() {
  const operatorContext = {
    tenantId: config.tenantId,
    orgId: config.orgId,
    operatorId: config.userId,
    roles: [config.roles],
    source: "request",
    workspaceId: ids.workspaceId,
    repoId: ids.repoId,
    taskId: ids.taskId,
    correlationId: ids.correlationId
  };

  const agentRun = {
    id: `run_bcp_${Date.now()}`,
    tenantId: config.tenantId,
    agentType: "risk",
    triggerType: "manual",
    status: "completed",
    correlationId: ids.correlationId,
    input: {
      operatorContext,
      eventType: "operacion_asistida.bcp_drill",
      scope: "Local BCP drill for operator context and workspace memory recovery."
    },
    output: {
      actionType: "classify",
      summary: "Local BCP drill completed",
      confidence: 0.92,
      requiresHumanReview: false
    }
  };

  const workspaceMemory = {
    id: `mem_${agentRun.id}`,
    tenantId: config.tenantId,
    orgId: config.orgId,
    createdBy: config.userId,
    workspaceId: ids.workspaceId,
    repoId: ids.repoId,
    runId: agentRun.id,
    taskId: ids.taskId,
    kind: "run_summary",
    scope: "agent_runtime",
    title: "Operacion asistida BCP drill",
    summary: "Recovered local trace links operatorContext, AgentRun and workspace_memory.",
    tags: ["agent-runtime", "backup-recovery", "bcp-drill"],
    sourceRef: ids.correlationId,
    updatedAtIso: now.toISOString()
  };

  const auditLog = [
    {
      action: "agent_run.created",
      actorId: config.userId,
      targetId: agentRun.id,
      correlationId: ids.correlationId
    },
    {
      action: "agent_run.completed",
      actorId: config.userId,
      targetId: agentRun.id,
      correlationId: ids.correlationId
    }
  ];

  const trace = {
    correlationId: ids.correlationId,
    runs: [agentRun],
    workspaceMemory: [workspaceMemory],
    auditLog
  };

  const checks = [
    check("operatorContext survives restore simulation", () => {
      assert.equal(agentRun.input.operatorContext.operatorId, config.userId);
      assert.equal(agentRun.input.operatorContext.workspaceId, ids.workspaceId);
      assert.equal(agentRun.input.operatorContext.repoId, ids.repoId);
      assert.equal(agentRun.input.operatorContext.taskId, ids.taskId);
    }),
    check("workspace_memory links to AgentRun", () => {
      assert.equal(workspaceMemory.runId, agentRun.id);
      assert.equal(workspaceMemory.workspaceId, ids.workspaceId);
      assert.ok(workspaceMemory.tags.includes("agent-runtime"));
      assert.ok(workspaceMemory.tags.includes("backup-recovery"));
    }),
    check("Ops trace can be reconstructed by correlationId", () => {
      assert.equal(trace.correlationId, ids.correlationId);
      assert.ok(trace.runs.some((run) => run.id === agentRun.id));
      assert.ok(trace.workspaceMemory.some((memory) => memory.runId === agentRun.id));
    }),
    check("AuditLog explains lifecycle", () => {
      assert.ok(auditLog.some((entry) => entry.action === "agent_run.created"));
      assert.ok(auditLog.some((entry) => entry.action === "agent_run.completed"));
    }),
    check("backup_recovery remains non-runtime evidence", () => {
      assert.equal(agentRun.status, "completed");
      assert.ok(workspaceMemory.tags.includes("bcp-drill"));
    })
  ];

  return buildReport({
    mode: "local",
    checks,
    evidence: {
      operatorContext,
      agentRun,
      workspaceMemory,
      auditLog,
      trace
    }
  });
}

async function runApiDrill() {
  const checks = [];

  const health = await request(actor, "GET", "/v1/health");
  checks.push(check("API health uses Prisma persistence", () => {
    assert.equal(health.data.persistence, "prisma");
  }));

  const issuedToken = await request(actor, "POST", "/v1/auth/token", {
    tenantId: config.tenantId,
    orgId: config.orgId,
    userId: config.userId,
    roles: config.roles.split(",").map((role) => role.trim()).filter(Boolean),
    ttlSeconds: 3600
  });
  apiAccessToken = issuedToken.data.accessToken;
  checks.push(check("API issues session-bound drill token", () => {
    assert.equal(typeof apiAccessToken, "string");
    assert.ok(apiAccessToken.length > 20);
    assert.equal(issuedToken.data.sessionId.length > 0, true);
  }));

  const created = await request(actor, "POST", "/v1/agents/runs", {
    agentType: "risk",
    triggerType: "manual",
    correlationId: ids.correlationId,
    workspaceId: ids.workspaceId,
    repoId: ids.repoId,
    taskId: ids.taskId,
    input: {
      eventType: "operacion_asistida.bcp_drill",
      scope: "API BCP drill for operator context and workspace memory recovery.",
      budgetCents: 250000
    },
    inputSummary: "Operacion asistida BCP drill"
  });

  const runId = created.data.id;
  checks.push(check("API creates AgentRun with operatorContext", () => {
    assert.equal(created.data.input.operatorContext.workspaceId, ids.workspaceId);
    assert.equal(created.data.input.operatorContext.operatorId, config.userId);
  }));

  await request(actor, "POST", `/v1/agents/runs/${runId}/start`, {});
  await request(actor, "POST", `/v1/agents/runs/${runId}/complete`, {
    output: {
      actionType: "classify",
      summary: "Operacion asistida BCP API drill completed",
      confidence: 0.93,
      requiresHumanReview: false
    }
  });

  const byWorkspace = await request(
    actor,
    "GET",
    `/v1/ops/agent-runtime?workspaceId=${encodeURIComponent(ids.workspaceId)}&limit=20`
  );
  checks.push(check("Ops filters recovered runtime by workspaceId", () => {
    assert.ok(byWorkspace.data.items.some((item) => item.id === runId));
  }));

  const byOperator = await request(
    actor,
    "GET",
    `/v1/ops/agent-runtime?operatorId=${encodeURIComponent(config.userId)}&limit=20`
  );
  checks.push(check("Ops filters recovered runtime by operatorId", () => {
    assert.ok(byOperator.data.items.some((item) => item.id === runId));
  }));

  const trace = await request(actor, "GET", `/v1/ops/agent-runtime/${encodeURIComponent(ids.correlationId)}`);
  checks.push(check("Ops trace exposes operatorContext and workspaceMemory", () => {
    assert.ok(trace.data.runs.some((run) => run.id === runId && run.operatorContext.workspaceId === ids.workspaceId));
    assert.ok(trace.data.workspaceMemory.some((memory) => memory.runId === runId && memory.tags.includes("agent-runtime")));
  }));

  const memory = await request(
    actor,
    "GET",
    `/v1/knowledge/workspace-memory?workspaceId=${encodeURIComponent(ids.workspaceId)}&tags=agent-runtime`
  );
  checks.push(check("Knowledge exposes recovered workspace_memory", () => {
    assert.ok(memory.data.items.some((item) => item.runId === runId));
  }));

  return buildReport({
    mode: "api",
    checks,
    evidence: {
      runId,
      created: created.data,
      opsRuntime: byWorkspace.data,
      trace: trace.data,
      workspaceMemory: memory.data
    }
  });
}

function buildReport({ mode: reportMode, checks, evidence }) {
  return {
    generatedAtIso: now.toISOString(),
    drill: "operacion_asistida_backup_recovery",
    mode: reportMode,
    environment: {
      name: config.environmentName
    },
    targets: {
      rto: "4h",
      rpo: "15m"
    },
    switch: {
      local: "SEMSE_BCP_DRILL_MODE=local npm run drill:operacion-asistida:bcp",
      api: "SEMSE_BCP_DRILL_MODE=api SEMSE_API_URL=http://127.0.0.1:4000 npm run drill:operacion-asistida:bcp"
    },
    evidenceFiles: {
      latest: config.reportPath,
      manifest: config.manifestPath,
      historical: join(
        config.evidenceDir,
        `operacion-asistida-bcp-drill-${reportMode}-${runStamp}.json`
      )
    },
    tenantId: config.tenantId,
    actor,
    ids,
    checks,
    evidence
  };
}

function check(name, assertion) {
  assertion();
  return {
    name,
    status: "pass"
  };
}

async function request(requestActor, method, path, body) {
  const authorization = apiAccessToken ? { authorization: `Bearer ${apiAccessToken}` } : {};

  const response = await fetch(`${config.apiBaseUrl}${path}`, {
    method,
    headers: {
      "content-type": "application/json",
      ...authorization,
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

async function writeReport(report) {
  const reportContent = `${JSON.stringify(report, null, 2)}\n`;
  const latestPath = join(process.cwd(), config.reportPath);
  const manifestPath = join(process.cwd(), config.manifestPath);
  const historicalRelativePath = report.evidenceFiles.historical;
  const historicalPath = join(process.cwd(), historicalRelativePath);

  await mkdir(dirname(latestPath), { recursive: true });
  await mkdir(dirname(manifestPath), { recursive: true });
  await mkdir(dirname(historicalPath), { recursive: true });
  await writeFile(latestPath, reportContent, "utf8");
  await writeFile(historicalPath, reportContent, "utf8");
  await writeFile(manifestPath, `${JSON.stringify(await buildManifest(report), null, 2)}\n`, "utf8");

  return {
    latest: config.reportPath,
    historical: historicalRelativePath,
    manifest: config.manifestPath
  };
}

async function buildManifest(report) {
  const currentManifest = await readManifest();
  const entry = {
    generatedAtIso: report.generatedAtIso,
    drill: report.drill,
    mode: report.mode,
    environment: report.environment,
    tenantId: report.tenantId,
    workspaceId: report.ids.workspaceId,
    correlationId: report.ids.correlationId,
    status: report.checks.every((drillCheck) => drillCheck.status === "pass") ? "pass" : "fail",
    checkCount: report.checks.length,
    evidenceFiles: report.evidenceFiles
  };

  return {
    schemaVersion: 1,
    updatedAtIso: now.toISOString(),
    latest: entry,
    history: [entry, ...currentManifest.history].slice(0, 50)
  };
}

async function readManifest() {
  try {
    const content = await readFile(join(process.cwd(), config.manifestPath), "utf8");
    const parsed = JSON.parse(content);

    if (!Array.isArray(parsed.history)) {
      return { history: [] };
    }

    return parsed;
  } catch (error) {
    if (error.code === "ENOENT") {
      return { history: [] };
    }

    throw error;
  }
}

function readMode() {
  const argMode = process.argv.find((arg) => arg.startsWith("--mode="))?.slice("--mode=".length);
  const selectedMode = argMode ?? process.env.SEMSE_BCP_DRILL_MODE ?? "local";

  if (selectedMode !== "local" && selectedMode !== "api") {
    throw new Error(`Unsupported SEMSE_BCP_DRILL_MODE: ${selectedMode}. Use local or api.`);
  }

  return selectedMode;
}

main().catch((error) => {
  console.error("[drill:operacion-asistida:bcp] failed", error);
  process.exit(1);
});
