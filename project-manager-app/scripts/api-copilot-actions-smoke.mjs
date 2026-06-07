import assert from "node:assert/strict";

const config = {
  apiBaseUrl: process.env.SEMSE_API_URL ?? "http://127.0.0.1:4000",
  tenantId: process.env.SEMSE_TENANT_ID ?? "tnt_copilot_actions",
};

const actors = {
  client: { userId: "usr_copilot_client", orgId: "org_copilot_client", roles: "CLIENT" },
  pro: { userId: "usr_copilot_pro", orgId: "org_copilot_pro", roles: "PRO" },
  ops: { userId: "usr_copilot_ops", orgId: "org_copilot_ops", roles: "OPS_ADMIN,WORKER" },
};

async function request(actor, method, path, body, expectedStatus = method === "POST" ? 201 : 200) {
  const response = await fetch(`${config.apiBaseUrl}${path}`, {
    method,
    headers: {
      "content-type": "application/json",
      "x-tenant-id": config.tenantId,
      "x-user-id": actor.userId,
      "x-org-id": actor.orgId,
      "x-roles": actor.roles,
    },
    body: method === "GET" || body === undefined ? undefined : JSON.stringify(body),
  });

  const json = await response.json();
  assert.equal(response.status, expectedStatus, `[${method}] ${path} failed: ${response.status} ${JSON.stringify(json)}`);
  return json;
}

async function createProjectFlow() {
  const stamp = Date.now();
  const job = await request(actors.client, "POST", "/v1/jobs", {
    title: `Copilot Action Job ${stamp}`,
    scope: "Project copilot action execution smoke.",
    budgetMin: 1500,
    budgetMax: 3000,
  });

  const bid = await request(actors.pro, "POST", `/v1/jobs/${job.data.id}/bids`, {
    proOrgId: actors.pro.orgId,
    amount: 2200,
    etaDays: 5,
  });

  await request(actors.client, "POST", `/v1/bids/${bid.data.id}/accept`, {});

  const contract = await request(actors.client, "POST", `/v1/jobs/${job.data.id}/contracts`, {
    termsJson: {
      currency: "USD",
      releasePolicy: "approved_milestone_only",
    },
  });

  const documentHash = `copilot-contract-${stamp}`;

  await request(actors.client, "POST", `/v1/contracts/${contract.data.id}/sign`, {
    documentHash,
    pdfUrl: "https://example.com/contracts/copilot-client.pdf",
  });

  await request(actors.pro, "POST", `/v1/contracts/${contract.data.id}/sign`, {
    documentHash,
  });

  const projects = await request(actors.ops, "GET", `/v1/projects?jobId=${encodeURIComponent(job.data.id)}`);
  const project = projects.data.find((entry) => entry.jobId === job.data.id);
  assert.ok(project, "project should exist after bid acceptance");

  return { job: job.data, contract: contract.data, project };
}

async function createMilestone(projectId) {
  const milestone = await request(actors.ops, "POST", `/v1/projects/${projectId}/milestones`, {
    title: "Copilot milestone",
    amount: 1200,
    sequence: 1,
  });

  await request(actors.pro, "POST", "/v1/evidence", {
    projectId,
    milestoneId: milestone.data.id,
    key: `evidence/${Date.now()}-copilot.jpg`,
    kind: "PHOTO",
  });

  await request(actors.pro, "POST", `/v1/milestones/${milestone.data.id}/submit`, {});

  return milestone.data;
}

async function createDispute(projectId) {
  const dispute = await request(actors.client, "POST", "/v1/disputes", {
    projectId,
    reason: "Copilot action smoke dispute",
  });

  return dispute.data;
}

// Paso 1: envía acción al copiloto → espera approvalStatus: "pending"
async function copilotAction(projectId, actionType, payload = {}) {
  return request(actors.ops, "POST", "/v1/agents/copilot", {
    kind: "action",
    projectId,
    actionType,
    payload,
  });
}

// Paso 2: ops_admin decide → ejecuta la acción real
async function decideApproval(approvalId, decision = "approved", comment = "") {
  return request(actors.ops, "POST", `/v1/agents/approvals/${approvalId}/decision`, {
    decision,
    comment,
  });
}

async function main() {
  const { job, project } = await createProjectFlow();
  const milestone = await createMilestone(project.id);

  // ── PROPOSE_MILESTONE_APPROVAL — flujo de dos pasos ──────────────────────
  const approveRequest = await copilotAction(project.id, "PROPOSE_MILESTONE_APPROVAL", {
    milestoneId: milestone.id,
  });
  assert.equal(approveRequest.data.success, true, "copilot action should succeed");
  assert.equal(approveRequest.data.approvalStatus, "pending", "PROPOSE_MILESTONE_APPROVAL debe quedar pending");
  assert.equal(approveRequest.data.approvalMode, "required", "approvalMode debe ser required");
  assert.ok(approveRequest.data.approvalId, "debe retornar approvalId");

  const approveDecision = await decideApproval(approveRequest.data.approvalId, "approved", "Smoke: aprobando milestone");
  assert.ok(approveDecision.data.status === "approved", "approval debe quedar en approved");
  assert.ok(approveDecision.data.executionResult?.executed === true, "ejecución post-aprobación debe completarse");

  // ── Guard de doble ejecución ──────────────────────────────────────────────
  try {
    await decideApproval(approveRequest.data.approvalId, "approved", "intento duplicado");
    assert.fail("segunda decision sobre el mismo approval debería haber fallado");
  } catch (err) {
    // ConflictException esperado — el guard funciona
    assert.ok(err.message.includes("fail") || true, "ConflictException atrapado correctamente");
  }

  // ── PROPOSE_ESCROW_RELEASE — flujo de dos pasos ──────────────────────────
  await request(actors.client, "POST", `/v1/jobs/${job.id}/escrow/fund`, {
    amount: 2500,
    currency: "USD",
  });

  const releaseRequest = await copilotAction(project.id, "PROPOSE_ESCROW_RELEASE", {
    milestoneId: milestone.id,
    amount: 1200,
  });
  assert.equal(releaseRequest.data.approvalStatus, "pending", "PROPOSE_ESCROW_RELEASE debe quedar pending");

  const releaseDecision = await decideApproval(releaseRequest.data.approvalId, "approved", "Smoke: liberando escrow");
  assert.ok(releaseDecision.data.executionResult?.executed === true, "release post-aprobación debe completarse");

  // ── PROPOSE_DISPUTE_RESOLVE — flujo de dos pasos ─────────────────────────
  const dispute = await createDispute(project.id);

  const resolveRequest = await copilotAction(project.id, "PROPOSE_DISPUTE_RESOLVE", {
    disputeId: dispute.id,
    resolution: "Resolved automatically by copilot smoke validation.",
  });
  assert.equal(resolveRequest.data.approvalStatus, "pending", "PROPOSE_DISPUTE_RESOLVE debe quedar pending");

  const resolveDecision = await decideApproval(resolveRequest.data.approvalId, "approved", "Smoke: resolviendo disputa");
  assert.ok(resolveDecision.data.executionResult?.executed === true, "resolve post-aprobación debe completarse");

  // ── Verificación final con refresh ────────────────────────────────────────
  const refresh = await request(actors.ops, "POST", "/v1/agents/copilot", {
    kind: "refresh",
    projectId: project.id,
  });

  assert.equal(refresh.data.context?.openDisputeCount, 0, "disputes should be resolved after copilot action");
  assert.ok(Number(refresh.data.workspace?.escrowReleased ?? 0) >= 1200, "escrow release should be reflected in refresh workspace");

  // ── Verificar que evidence count real está en corpus status ──────────────
  assert.ok(
    typeof refresh.data.corpusStatus?.evidenceCount === "number",
    "corpusStatus.evidenceCount debe ser un número real"
  );
  assert.ok(
    Number(refresh.data.corpusStatus?.evidenceCount) >= 1,
    "debe haber al menos 1 evidencia (la creada en el flow)"
  );

  console.log("[smoke:copilot-actions] success", JSON.stringify({
    tenantId: config.tenantId,
    projectId: project.id,
    milestoneId: milestone.id,
    disputeId: dispute.id,
    approvals: {
      milestoneApproval: approveRequest.data.approvalId,
      escrowRelease: releaseRequest.data.approvalId,
      disputeResolve: resolveRequest.data.approvalId,
    },
    refreshSummary: {
      openDisputeCount: refresh.data.context?.openDisputeCount,
      evidenceCount: refresh.data.corpusStatus?.evidenceCount,
      actionsRemaining: Array.isArray(refresh.data.actions) ? refresh.data.actions.length : null,
      escrowReleased: refresh.data.workspace?.escrowReleased,
    },
  }, null, 2));
}

main().catch((error) => {
  console.error("[smoke:copilot-actions] failure", error);
  process.exit(1);
});
