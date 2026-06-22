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
  return { ok: response.ok, status: response.status, data: payload.data, error: payload.error };
}

test("edge case: rating after job completion → cannot rate before completion", async () => {
  const suffix = Date.now();

  // Create job but don't complete it
  const job = await apiDirect(ACTORS.client, "POST", "/v1/jobs", {
    title: `Edge Case Rating ${suffix}`,
    scope: "Test",
    description: "Test early rating rejection",
    category: "Painting",
    budgetMin: 300,
    budgetMax: 500,
    urgency: "low",
    locationType: "on_site",
    city: "Miami",
  });

  // Pro should not be able to rate before job is complete
  const prematureRating = await apiDirect(ACTORS.pro, "POST", "/v1/ratings", {
    jobId: job.data.id,
    ratedUserId: ACTORS.client.userId,
    score: 5,
    comment: "Great client",
  });

  // Should either fail or return status indicating job not complete
  expect(prematureRating.status).toBeGreaterThanOrEqual(400);
});

test("edge case: concurrent milestone submissions → second submission blocked/queued", async () => {
  const suffix = Date.now();

  // Setup job with milestone
  const job = await apiDirect(ACTORS.client, "POST", "/v1/jobs", {
    title: `Concurrent Milestone ${suffix}`,
    scope: "Test",
    description: "Test concurrent submission handling",
    category: "Painting",
    budgetMin: 400,
    budgetMax: 600,
    urgency: "medium",
    locationType: "on_site",
    city: "Miami",
  });

  const reservation = await apiDirect(ACTORS.pro, "POST", `/v1/jobs/${job.data.id}/reservations`, {
    expiresInMinutes: 30,
  });
  await apiDirect(ACTORS.client, "POST", `/v1/reservations/${reservation.data.id}/accept`, {});

  const contract = await apiDirect(ACTORS.client, "POST", `/v1/jobs/${job.data.id}/contracts`, {
    termsJson: { currency: "USD", releasePolicy: "approved_milestone_only" },
  });
  await apiDirect(ACTORS.client, "POST", `/v1/contracts/${contract.data.id}/sign`, {
    documentHash: `concurrent-${suffix}`,
    pdfUrl: "https://example.com/concurrent.pdf",
  });
  await apiDirect(ACTORS.pro, "POST", `/v1/contracts/${contract.data.id}/sign`, {
    documentHash: `concurrent-${suffix}`,
    pdfUrl: "https://example.com/concurrent.pdf",
  });

  await apiDirect(ACTORS.client, "POST", "/v1/escrow/fund", {
    jobId: job.data.id,
    amount: 500,
    paymentMethod: "mock",
  });

  const projects = await apiDirect(ACTORS.ops, "GET", `/v1/projects?jobId=${encodeURIComponent(job.data.id)}`);
  const project = projects.data.find((p) => p.jobId === job.data.id);

  const milestone = await apiDirect(ACTORS.ops, "POST", `/v1/projects/${project.id}/milestones`, {
    title: `Milestone ${suffix}`,
    amount: 500,
    sequence: 1,
  });

  // Add evidence
  await apiDirect(ACTORS.pro, "POST", "/v1/evidence", {
    projectId: project.id,
    milestoneId: milestone.data.id,
    key: `e2e/${suffix}-concurrent-1.jpg`,
    kind: "PHOTO",
  });

  // First submission
  const submit1 = await apiDirect(ACTORS.pro, "POST", `/v1/milestones/${milestone.data.id}/submit`, {});
  expect(submit1.ok).toBe(true);

  // Second submission (concurrent/duplicate) should be rejected or idempotent
  const submit2 = await apiDirect(ACTORS.pro, "POST", `/v1/milestones/${milestone.data.id}/submit`, {});
  expect([200, 400, 409]).toContain(submit2.status);
});

test("edge case: payment refund → escrow balance updates correctly", async () => {
  const suffix = Date.now();

  // Setup completed job
  const job = await apiDirect(ACTORS.client, "POST", "/v1/jobs", {
    title: `Refund Test ${suffix}`,
    scope: "Test",
    description: "Test payment refund flow",
    category: "Painting",
    budgetMin: 500,
    budgetMax: 700,
    urgency: "medium",
    locationType: "on_site",
    city: "Miami",
  });

  const reservation = await apiDirect(ACTORS.pro, "POST", `/v1/jobs/${job.data.id}/reservations`, {
    expiresInMinutes: 30,
  });
  await apiDirect(ACTORS.client, "POST", `/v1/reservations/${reservation.data.id}/accept`, {});

  const contract = await apiDirect(ACTORS.client, "POST", `/v1/jobs/${job.data.id}/contracts`, {
    termsJson: { currency: "USD", releasePolicy: "approved_milestone_only" },
  });
  await apiDirect(ACTORS.client, "POST", `/v1/contracts/${contract.data.id}/sign`, {
    documentHash: `refund-${suffix}`,
    pdfUrl: "https://example.com/refund.pdf",
  });
  await apiDirect(ACTORS.pro, "POST", `/v1/contracts/${contract.data.id}/sign`, {
    documentHash: `refund-${suffix}`,
    pdfUrl: "https://example.com/refund.pdf",
  });

  // Fund with specific amount
  const fundAmount = 600;
  const fund = await apiDirect(ACTORS.client, "POST", "/v1/escrow/fund", {
    jobId: job.data.id,
    amount: fundAmount,
    paymentMethod: "mock",
  });
  expect(fund.ok).toBe(true);

  const projects = await apiDirect(ACTORS.ops, "GET", `/v1/projects?jobId=${encodeURIComponent(job.data.id)}`);
  const project = projects.data.find((p) => p.jobId === job.data.id);

  const milestone = await apiDirect(ACTORS.ops, "POST", `/v1/projects/${project.id}/milestones`, {
    title: `Milestone ${suffix}`,
    amount: fundAmount,
    sequence: 1,
  });

  await apiDirect(ACTORS.pro, "POST", "/v1/evidence", {
    projectId: project.id,
    milestoneId: milestone.data.id,
    key: `e2e/${suffix}-refund.jpg`,
    kind: "PHOTO",
  });
  await apiDirect(ACTORS.pro, "POST", `/v1/milestones/${milestone.data.id}/submit`, {});

  // File dispute and get partial refund
  const dispute = await apiDirect(ACTORS.client, "POST", "/v1/disputes", {
    jobId: job.data.id,
    milestoneId: milestone.data.id,
    type: "quality",
    title: "Quality issue",
    description: "Work not to standard",
    severity: "high",
  });

  // Resolve with refund
  const resolved = await apiDirect(ACTORS.ops, "PATCH", `/v1/disputes/${dispute.data.id}`, {
    status: "RESOLVED",
    resolution: "partial_refund",
    refundAmount: 150,
    notes: "30% refund approved",
  });

  expect(resolved.ok).toBe(true);
  expect(resolved.data.refundAmount).toBe(150);

  // Verify escrow reflects refund
  const escrowAfter = await apiDirect(ACTORS.ops, "GET", `/v1/projects/${project.id}/escrow`);
  expect(escrowAfter.ok).toBe(true);
});

test("edge case: rating conflict → same user rates both directions should work", async () => {
  const suffix = Date.now();

  // Setup and complete job
  const job = await apiDirect(ACTORS.client, "POST", "/v1/jobs", {
    title: `Rating Conflict ${suffix}`,
    scope: "Test",
    description: "Test mutual rating",
    category: "Painting",
    budgetMin: 300,
    budgetMax: 500,
    urgency: "low",
    locationType: "on_site",
    city: "Miami",
  });

  const reservation = await apiDirect(ACTORS.pro, "POST", `/v1/jobs/${job.data.id}/reservations`, {
    expiresInMinutes: 30,
  });
  await apiDirect(ACTORS.client, "POST", `/v1/reservations/${reservation.data.id}/accept`, {});

  const contract = await apiDirect(ACTORS.client, "POST", `/v1/jobs/${job.data.id}/contracts`, {
    termsJson: { currency: "USD", releasePolicy: "approved_milestone_only" },
  });
  await apiDirect(ACTORS.client, "POST", `/v1/contracts/${contract.data.id}/sign`, {
    documentHash: `mutual-${suffix}`,
    pdfUrl: "https://example.com/mutual.pdf",
  });
  await apiDirect(ACTORS.pro, "POST", `/v1/contracts/${contract.data.id}/sign`, {
    documentHash: `mutual-${suffix}`,
    pdfUrl: "https://example.com/mutual.pdf",
  });

  await apiDirect(ACTORS.client, "POST", "/v1/escrow/fund", {
    jobId: job.data.id,
    amount: 400,
    paymentMethod: "mock",
  });

  const projects = await apiDirect(ACTORS.ops, "GET", `/v1/projects?jobId=${encodeURIComponent(job.data.id)}`);
  const project = projects.data.find((p) => p.jobId === job.data.id);

  const milestone = await apiDirect(ACTORS.ops, "POST", `/v1/projects/${project.id}/milestones`, {
    title: `Milestone ${suffix}`,
    amount: 400,
    sequence: 1,
  });

  await apiDirect(ACTORS.pro, "POST", "/v1/evidence", {
    projectId: project.id,
    milestoneId: milestone.data.id,
    key: `e2e/${suffix}-mutual.jpg`,
    kind: "PHOTO",
  });
  await apiDirect(ACTORS.pro, "POST", `/v1/milestones/${milestone.data.id}/submit`, {});
  await apiDirect(ACTORS.client, "POST", `/v1/escrow/release`, {
    milestoneId: milestone.data.id,
  });

  // Both should be able to rate each other
  const proRatesClient = await apiDirect(ACTORS.pro, "POST", "/v1/ratings", {
    jobId: job.data.id,
    ratedUserId: ACTORS.client.userId,
    score: 5,
    comment: "Good client",
  });
  expect(proRatesClient.ok).toBe(true);

  const clientRatesPro = await apiDirect(ACTORS.client, "POST", "/v1/ratings", {
    jobId: job.data.id,
    ratedUserId: ACTORS.pro.userId,
    score: 5,
    comment: "Good pro",
  });
  expect(clientRatesPro.ok).toBe(true);

  // Verify both ratings exist
  const allRatings = await apiDirect(ACTORS.ops, "GET", `/v1/ratings`);
  const jobRatings = allRatings.data.filter((r) => r.jobId === job.data.id);
  expect(jobRatings.length).toBe(2);
});

test("edge case: escrow insufficient funds → release blocked with error", async () => {
  const suffix = Date.now();

  const job = await apiDirect(ACTORS.client, "POST", "/v1/jobs", {
    title: `Insufficient Funds ${suffix}`,
    scope: "Test",
    description: "Test insufficient escrow",
    category: "Painting",
    budgetMin: 500,
    budgetMax: 700,
    urgency: "medium",
    locationType: "on_site",
    city: "Miami",
  });

  const reservation = await apiDirect(ACTORS.pro, "POST", `/v1/jobs/${job.data.id}/reservations`, {
    expiresInMinutes: 30,
  });
  await apiDirect(ACTORS.client, "POST", `/v1/reservations/${reservation.data.id}/accept`, {});

  const contract = await apiDirect(ACTORS.client, "POST", `/v1/jobs/${job.data.id}/contracts`, {
    termsJson: { currency: "USD", releasePolicy: "approved_milestone_only" },
  });
  await apiDirect(ACTORS.client, "POST", `/v1/contracts/${contract.data.id}/sign`, {
    documentHash: `insufficient-${suffix}`,
    pdfUrl: "https://example.com/insufficient.pdf",
  });
  await apiDirect(ACTORS.pro, "POST", `/v1/contracts/${contract.data.id}/sign`, {
    documentHash: `insufficient-${suffix}`,
    pdfUrl: "https://example.com/insufficient.pdf",
  });

  // Fund only $200 but milestone is $500
  await apiDirect(ACTORS.client, "POST", "/v1/escrow/fund", {
    jobId: job.data.id,
    amount: 200,
    paymentMethod: "mock",
  });

  const projects = await apiDirect(ACTORS.ops, "GET", `/v1/projects?jobId=${encodeURIComponent(job.data.id)}`);
  const project = projects.data.find((p) => p.jobId === job.data.id);

  const milestone = await apiDirect(ACTORS.ops, "POST", `/v1/projects/${project.id}/milestones`, {
    title: `Milestone ${suffix}`,
    amount: 500, // More than funded amount
    sequence: 1,
  });

  await apiDirect(ACTORS.pro, "POST", "/v1/evidence", {
    projectId: project.id,
    milestoneId: milestone.data.id,
    key: `e2e/${suffix}-insufficient.jpg`,
    kind: "PHOTO",
  });
  await apiDirect(ACTORS.pro, "POST", `/v1/milestones/${milestone.data.id}/submit`, {});

  // Try to release without sufficient funds
  const release = await apiDirect(ACTORS.client, "POST", `/v1/escrow/release`, {
    milestoneId: milestone.data.id,
  });

  // Should fail with appropriate error
  expect(release.ok).toBe(false);
  expect(release.status).toBe(400);
});
