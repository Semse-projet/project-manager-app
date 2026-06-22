import { test, expect } from "@playwright/test";

const API_BASE = process.env.SEMSE_API_URL ?? "http://127.0.0.1:4122";

const ACTORS = {
  client: {
    tenantId: "tenant_default",
    orgId: "org_client_001",
    userId: "usr_client_001",
    roles: ["CLIENT"],
  },
  pro: {
    tenantId: "tenant_default",
    orgId: "org_pro_001",
    userId: "usr_worker_001",
    roles: ["PRO"],
  },
  ops: {
    tenantId: "tenant_default",
    orgId: "org_admin_001",
    userId: "usr_admin_001",
    roles: ["OPS_ADMIN"],
  },
};

async function apiDirect(actor, method, path, body) {
  const response = await fetch(`${API_BASE}${path}`, {
    method,
    headers: {
      "content-type": "application/json",
      "x-tenant-id": actor.tenantId,
      "x-org-id": actor.orgId,
      "x-user-id": actor.userId,
      "x-roles": actor.roles.join(","),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok || payload.error) {
    throw new Error(`${method} ${path} -> ${response.status} ${JSON.stringify(payload)}`);
  }
  return payload.data;
}

test("dispute workflow: client files dispute → ops reviews → resolution recorded", async () => {
  const suffix = Date.now();

  // 1. Create and complete a job
  const job = await apiDirect(ACTORS.client, "POST", "/v1/jobs", {
    title: `E2E Dispute ${suffix}`,
    scope: "Test job for dispute",
    description: "Job to test dispute workflow",
    category: "Painting",
    budgetMin: 400,
    budgetMax: 600,
    urgency: "medium",
    locationType: "on_site",
    city: "Miami",
  });

  const reservation = await apiDirect(ACTORS.pro, "POST", `/v1/jobs/${job.id}/reservations`, {
    expiresInMinutes: 30,
  });
  await apiDirect(ACTORS.client, "POST", `/v1/reservations/${reservation.id}/accept`, {});

  const contract = await apiDirect(ACTORS.client, "POST", `/v1/jobs/${job.id}/contracts`, {
    termsJson: { currency: "USD", releasePolicy: "approved_milestone_only" },
  });
  await apiDirect(ACTORS.client, "POST", `/v1/contracts/${contract.id}/sign`, {
    documentHash: `dispute-${suffix}`,
    pdfUrl: "https://example.com/contracts/dispute.pdf",
  });
  await apiDirect(ACTORS.pro, "POST", `/v1/contracts/${contract.id}/sign`, {
    documentHash: `dispute-${suffix}`,
    pdfUrl: "https://example.com/contracts/dispute.pdf",
  });

  // 2. Fund escrow
  await apiDirect(ACTORS.client, "POST", "/v1/escrow/fund", {
    jobId: job.id,
    amount: 500,
    paymentMethod: "mock",
  });

  // 3. Get project
  const projects = await apiDirect(ACTORS.ops, "GET", `/v1/projects?jobId=${encodeURIComponent(job.id)}`);
  const project = projects.find((p) => p.jobId === job.id);

  // 4. Create milestone
  const milestone = await apiDirect(ACTORS.ops, "POST", `/v1/projects/${project.id}/milestones`, {
    title: `Milestone ${suffix}`,
    amount: 500,
    sequence: 1,
  });

  // 5. Submit milestone
  await apiDirect(ACTORS.pro, "POST", "/v1/evidence", {
    projectId: project.id,
    milestoneId: milestone.id,
    key: `e2e/${suffix}-dispute.jpg`,
    kind: "PHOTO",
  });
  await apiDirect(ACTORS.pro, "POST", `/v1/milestones/${milestone.id}/submit`, {});

  // 6. File dispute instead of releasing
  const dispute = await apiDirect(ACTORS.client, "POST", "/v1/disputes", {
    jobId: job.id,
    milestoneId: milestone.id,
    type: "quality",
    title: "Work quality does not meet contract specs",
    description: "The painting finish is uneven and does not match the agreed standard",
    severity: "high",
  });
  expect(dispute.id).toBeTruthy();
  expect(dispute.status).toBe("OPEN");

  // 7. OPS reviews dispute
  const disputeDetail = await apiDirect(ACTORS.ops, "GET", `/v1/disputes/${dispute.id}`);
  expect(disputeDetail.status).toBe("OPEN");

  // 8. OPS assigns to themselves
  const assigned = await apiDirect(ACTORS.ops, "PATCH", `/v1/disputes/${dispute.id}`, {
    status: "ASSIGNED",
    assignedToUserId: ACTORS.ops.userId,
  });
  expect(assigned.status).toBe("ASSIGNED");

  // 9. OPS moves to review
  const underReview = await apiDirect(ACTORS.ops, "PATCH", `/v1/disputes/${dispute.id}`, {
    status: "UNDER_REVIEW",
    notes: "Examining evidence to validate quality claim",
  });
  expect(underReview.status).toBe("UNDER_REVIEW");

  // 10. OPS resolves dispute (partial refund case)
  const resolved = await apiDirect(ACTORS.ops, "PATCH", `/v1/disputes/${dispute.id}`, {
    status: "RESOLVED",
    resolution: "partial_refund",
    refundAmount: 150,
    notes: "Quality issues confirmed. Approved 30% refund to client.",
  });
  expect(resolved.status).toBe("RESOLVED");
  expect(resolved.refundAmount).toBe(150);

  // 11. Verify dispute appears in history
  const allDisputes = await apiDirect(ACTORS.ops, "GET", `/v1/disputes?jobId=${encodeURIComponent(job.id)}`);
  const found = allDisputes.find((d) => d.id === dispute.id);
  expect(found).toBeTruthy();
  expect(found.status).toBe("RESOLVED");

  // 12. Verify impact on reputation
  const clientRepAfterDispute = await apiDirect(ACTORS.client, "GET", `/v1/users/${ACTORS.client.userId}/reputation`);
  expect(clientRepAfterDispute.disputeRate).toBeDefined();

  const proRepAfterDispute = await apiDirect(ACTORS.pro, "GET", `/v1/users/${ACTORS.pro.userId}/reputation`);
  expect(proRepAfterDispute.disputeRate).toBeDefined();
});

test("dispute types: quality, payment, safety, damage, material, delay, other", async () => {
  const suffix = Date.now();
  const disputeTypes = ["quality", "payment", "safety", "damage", "material", "delay", "other"];

  // Create a test job for each dispute type
  for (const type of disputeTypes) {
    const job = await apiDirect(ACTORS.client, "POST", "/v1/jobs", {
      title: `Dispute Type ${type} ${suffix}`,
      scope: "Test",
      description: `Test ${type} dispute type`,
      category: "Painting",
      budgetMin: 300,
      budgetMax: 500,
      urgency: "low",
      locationType: "on_site",
      city: "Miami",
    });

    // File dispute of this type
    const dispute = await apiDirect(ACTORS.client, "POST", "/v1/disputes", {
      jobId: job.id,
      type,
      title: `Test ${type} dispute`,
      description: `This is a test ${type} dispute`,
      severity: "medium",
    });

    expect(dispute.type).toBe(type);
    expect(dispute.status).toBe("OPEN");
  }
});

test("dispute severity levels: low, medium, high, critical", async () => {
  const suffix = Date.now();
  const severities = ["low", "medium", "high", "critical"];

  for (const severity of severities) {
    const job = await apiDirect(ACTORS.client, "POST", "/v1/jobs", {
      title: `Severity ${severity} ${suffix}`,
      scope: "Test",
      description: `Test ${severity} severity`,
      category: "Painting",
      budgetMin: 300,
      budgetMax: 500,
      urgency: "low",
      locationType: "on_site",
      city: "Miami",
    });

    const dispute = await apiDirect(ACTORS.client, "POST", "/v1/disputes", {
      jobId: job.id,
      type: "quality",
      title: `Test severity ${severity}`,
      description: `Severity level: ${severity}`,
      severity,
    });

    expect(dispute.severity).toBe(severity);
  }
});

test("disputed milestone blocks escrow release until resolution", async () => {
  const suffix = Date.now();

  // Setup job with milestone
  const job = await apiDirect(ACTORS.client, "POST", "/v1/jobs", {
    title: `Blocked Release ${suffix}`,
    scope: "Test",
    description: "Test escrow blocking",
    category: "Painting",
    budgetMin: 400,
    budgetMax: 600,
    urgency: "medium",
    locationType: "on_site",
    city: "Miami",
  });

  const reservation = await apiDirect(ACTORS.pro, "POST", `/v1/jobs/${job.id}/reservations`, {
    expiresInMinutes: 30,
  });
  await apiDirect(ACTORS.client, "POST", `/v1/reservations/${reservation.id}/accept`, {});

  const contract = await apiDirect(ACTORS.client, "POST", `/v1/jobs/${job.id}/contracts`, {
    termsJson: { currency: "USD", releasePolicy: "approved_milestone_only" },
  });
  await apiDirect(ACTORS.client, "POST", `/v1/contracts/${contract.id}/sign`, {
    documentHash: `blocked-${suffix}`,
    pdfUrl: "https://example.com/contracts/blocked.pdf",
  });
  await apiDirect(ACTORS.pro, "POST", `/v1/contracts/${contract.id}/sign`, {
    documentHash: `blocked-${suffix}`,
    pdfUrl: "https://example.com/contracts/blocked.pdf",
  });

  await apiDirect(ACTORS.client, "POST", "/v1/escrow/fund", {
    jobId: job.id,
    amount: 500,
    paymentMethod: "mock",
  });

  const projects = await apiDirect(ACTORS.ops, "GET", `/v1/projects?jobId=${encodeURIComponent(job.id)}`);
  const project = projects.find((p) => p.jobId === job.id);

  const milestone = await apiDirect(ACTORS.ops, "POST", `/v1/projects/${project.id}/milestones`, {
    title: `Milestone ${suffix}`,
    amount: 500,
    sequence: 1,
  });

  await apiDirect(ACTORS.pro, "POST", "/v1/evidence", {
    projectId: project.id,
    milestoneId: milestone.id,
    key: `e2e/${suffix}-blocked.jpg`,
    kind: "PHOTO",
  });
  await apiDirect(ACTORS.pro, "POST", `/v1/milestones/${milestone.id}/submit`, {});

  // File dispute
  const dispute = await apiDirect(ACTORS.client, "POST", "/v1/disputes", {
    jobId: job.id,
    milestoneId: milestone.id,
    type: "quality",
    title: "Quality issue",
    description: "Work does not meet standard",
    severity: "high",
  });

  // Attempt to release should fail or be blocked
  try {
    await apiDirect(ACTORS.client, "POST", `/v1/escrow/release`, {
      milestoneId: milestone.id,
    });
    // If it succeeds, check that milestone is locked
    const postRelease = await apiDirect(ACTORS.ops, "GET", `/v1/milestones/${milestone.id}`);
    expect(postRelease.releaseBlocked).toBe(true);
  } catch (err) {
    // Expected: release blocked due to dispute
    expect(err.message).toContain("400");
  }
});
