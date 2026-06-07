import assert from "node:assert/strict";

const config = {
  apiBaseUrl: process.env.SEMSE_API_URL ?? "http://127.0.0.1:4112",
  tenantId: process.env.SEMSE_TENANT_ID ?? "tnt_demo",
  orgId: process.env.SEMSE_ORG_ID ?? "org_ops",
  userId: process.env.SEMSE_USER_ID ?? "usr_ops_admin",
  roles: (process.env.SEMSE_ROLES ?? "OPS_ADMIN").split(",").map((entry) => entry.trim()).filter(Boolean)
};

const STAGES = ["branch", "change", "commit", "push", "pr"];

async function main() {
  console.log("[smoke:autonomy:staged] starting", {
    apiBaseUrl: config.apiBaseUrl,
    tenantId: config.tenantId,
    userId: config.userId,
    stages: STAGES
  });

  const token = await issueToken();
  const task = `add status badge smoke stage flow ${Date.now()}`;

  const created = await request("POST", "/v1/autonomy/runs", token, {
    task,
    targetStage: "branch"
  });

  assert.equal(created.data.status, "COMPLETED");
  assert.equal(created.data.branchName?.startsWith("feat/"), true);
  assert.equal(created.data.commitSha, null);
  assert.equal(created.data.currentStage, "branch");
  assert.equal(created.data.targetStage, "branch");
  assert.equal(created.data.nextStage, "change");

  const runId = created.data.id;
  console.log("[smoke:autonomy:staged] branch", {
    runId,
    branchName: created.data.branchName
  });

  for (const stage of STAGES.slice(1)) {
    const continued = await request("POST", `/v1/autonomy/runs/${encodeURIComponent(runId)}/continue`, token, {
      targetStage: stage
    });

    assert.equal(continued.data.id, runId);
    assert.equal(continued.data.status, "COMPLETED");

    assert.equal(continued.data.currentStage, stage);
    assert.equal(continued.data.targetStage, stage);

    if (stage === "change") {
      assert.ok(continued.data.generatedFile, "generatedFile should exist after change stage");
      assert.equal(continued.data.nextStage, "commit");
    }

    if (stage === "commit") {
      assert.ok(continued.data.commitSha, "commitSha should exist after commit stage");
      assert.equal(continued.data.nextStage, "push");
    }

    if (stage === "push") {
      assert.ok(
        continued.data.logs.some((entry) => entry.message === "branch_pushed"),
        "push stage should log branch_pushed"
      );
      assert.equal(continued.data.nextStage, "pr");
    }

    if (stage === "pr") {
      assert.ok(continued.data.prUrl, "prUrl should exist after pr stage");
      assert.equal(continued.data.prState, "open");
      assert.equal(continued.data.nextStage, null);
    }

    console.log(`[smoke:autonomy:staged] ${stage}`, {
      runId,
      branchName: continued.data.branchName,
      commitSha: continued.data.commitSha,
      prUrl: continued.data.prUrl
    });
  }

  const final = await request("GET", `/v1/autonomy/runs/${encodeURIComponent(runId)}`, token);
  assert.equal(final.data.id, runId);
  assert.equal(final.data.status, "COMPLETED");
  assert.ok(final.data.commitSha, "final run should retain commitSha");
  assert.ok(final.data.prUrl, "final run should retain prUrl");
  assert.equal(final.data.currentStage, "pr");
  assert.equal(final.data.targetStage, "pr");
  assert.equal(final.data.nextStage, null);
  assert.equal(final.data.completedStageCount, STAGES.length);

  for (const message of ["branch_created", "change_applied", "commit_created", "branch_pushed", "pr_created"]) {
    assert.ok(final.data.logs.some((entry) => entry.message === message), `missing log message ${message}`);
  }

  console.log("[smoke:autonomy:staged] success", {
    runId,
    branchName: final.data.branchName,
    commitSha: final.data.commitSha,
    prUrl: final.data.prUrl
  });
}

async function issueToken() {
  const response = await fetch(`${config.apiBaseUrl}/v1/auth/token`, {
    method: "POST",
    headers: {
      "content-type": "application/json"
    },
    body: JSON.stringify({
      userId: config.userId,
      tenantId: config.tenantId,
      orgId: config.orgId,
      roles: config.roles
    })
  });

  const json = await response.json();
  assert.ok(response.ok, `[POST] /v1/auth/token failed: ${response.status} ${JSON.stringify(json)}`);
  assert.ok(json?.data?.accessToken, "auth token response must include accessToken");
  return json.data.accessToken;
}

async function request(method, path, token, body) {
  const response = await fetch(`${config.apiBaseUrl}${path}`, {
    method,
    headers: {
      authorization: `Bearer ${token}`,
      "content-type": "application/json"
    },
    body: method === "GET" || body === undefined ? undefined : JSON.stringify(body)
  });

  const json = await response.json();
  assert.ok(response.ok, `[${method}] ${path} failed: ${response.status} ${JSON.stringify(json)}`);
  return json;
}

main().catch((error) => {
  console.error("[smoke:autonomy:staged] failed", error);
  process.exit(1);
});
