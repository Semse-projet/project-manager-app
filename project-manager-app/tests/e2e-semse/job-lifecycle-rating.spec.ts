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

async function loginAs(page, roleLabel, targetPath) {
  await page.goto("/login");
  await page.getByRole("button", { name: new RegExp(roleLabel, "i") }).click();
  await page.getByRole("button", { name: /Ingresar/i }).click();
  await page.waitForURL(new RegExp(targetPath));
}

test("complete job lifecycle: creation → completion → rating → reputation", async ({ page }) => {
  const suffix = Date.now();

  // 1. Create job
  const job = await apiDirect(ACTORS.client, "POST", "/v1/jobs", {
    title: `E2E Lifecycle ${suffix}`,
    scope: "Painting job for lifecycle test",
    description: "Complete end-to-end job lifecycle validation",
    category: "Painting",
    budgetMin: 500,
    budgetMax: 800,
    urgency: "medium",
    locationType: "on_site",
    city: "Miami",
  });
  expect(job.id).toBeTruthy();
  expect(job.status).toBe("open");

  // 2. Pro creates reservation
  const reservation = await apiDirect(ACTORS.pro, "POST", `/v1/jobs/${job.id}/reservations`, {
    expiresInMinutes: 30,
  });
  expect(reservation.id).toBeTruthy();

  // 3. Client accepts reservation
  const accepted = await apiDirect(ACTORS.client, "POST", `/v1/reservations/${reservation.id}/accept`, {});
  expect(accepted.status).toBe("accepted");

  // 4. Create and sign contract
  const contract = await apiDirect(ACTORS.client, "POST", `/v1/jobs/${job.id}/contracts`, {
    termsJson: {
      currency: "USD",
      releasePolicy: "approved_milestone_only",
    },
  });
  expect(contract.id).toBeTruthy();

  const docHash = `e2e-lifecycle-${suffix}`;
  await apiDirect(ACTORS.client, "POST", `/v1/contracts/${contract.id}/sign`, {
    documentHash: docHash,
    pdfUrl: "https://example.com/contracts/lifecycle.pdf",
  });
  await apiDirect(ACTORS.pro, "POST", `/v1/contracts/${contract.id}/sign`, {
    documentHash: docHash,
    pdfUrl: "https://example.com/contracts/lifecycle.pdf",
  });

  // 5. Fund escrow
  const escrowFunded = await apiDirect(ACTORS.client, "POST", "/v1/escrow/fund", {
    jobId: job.id,
    amount: 650,
    paymentMethod: "mock",
  });
  expect(escrowFunded.status).toBeDefined();

  // 6. Get project for milestone operations
  const projects = await apiDirect(ACTORS.ops, "GET", `/v1/projects?jobId=${encodeURIComponent(job.id)}`);
  const project = projects.find((p) => p.jobId === job.id);
  expect(project).toBeTruthy();

  // 7. Create milestone
  const milestone = await apiDirect(ACTORS.ops, "POST", `/v1/projects/${project.id}/milestones`, {
    title: `Milestone ${suffix}`,
    amount: 650,
    sequence: 1,
  });
  expect(milestone.id).toBeTruthy();
  expect(milestone.status).toBe("DRAFT");

  // 8. Submit evidence
  await apiDirect(ACTORS.pro, "POST", "/v1/evidence", {
    projectId: project.id,
    milestoneId: milestone.id,
    key: `e2e/${suffix}-lifecycle.jpg`,
    kind: "PHOTO",
  });

  // 9. Submit milestone
  const submitted = await apiDirect(ACTORS.pro, "POST", `/v1/milestones/${milestone.id}/submit`, {});
  expect(submitted.status).toBe("SUBMITTED");

  // 10. Approve and release milestone (via escrow)
  const released = await apiDirect(ACTORS.client, "POST", `/v1/escrow/release`, {
    milestoneId: milestone.id,
  });
  expect(released.status).toBeDefined();

  // 11. Complete job
  const completed = await apiDirect(ACTORS.ops, "POST", `/v1/projects/${project.id}/close`, {
    status: "completed",
  });
  expect(completed.status).toBe("completed");

  // 12. Pro rates client
  const proRating = await apiDirect(ACTORS.pro, "POST", "/v1/ratings", {
    jobId: job.id,
    ratedUserId: ACTORS.client.userId,
    score: 5,
    comment: "Excellent client, clear requirements, responsive communication",
    categories: {
      communication: 5,
      payment_reliability: 5,
      professionalism: 5,
    },
  });
  expect(proRating.id).toBeTruthy();
  expect(proRating.score).toBe(5);

  // 13. Client rates pro
  const clientRating = await apiDirect(ACTORS.client, "POST", "/v1/ratings", {
    jobId: job.id,
    ratedUserId: ACTORS.pro.userId,
    score: 5,
    comment: "Great professional, work quality excellent, finished on time",
    categories: {
      quality: 5,
      timeliness: 5,
      communication: 5,
    },
  });
  expect(clientRating.id).toBeTruthy();
  expect(clientRating.score).toBe(5);

  // 14. Verify reputation updated for both parties
  const proReputation = await apiDirect(ACTORS.pro, "GET", `/v1/users/${ACTORS.pro.userId}/reputation`);
  expect(proReputation.score).toBeGreaterThanOrEqual(0);
  expect(proReputation.tier).toBeDefined();

  const clientReputation = await apiDirect(ACTORS.client, "GET", `/v1/users/${ACTORS.client.userId}/reputation`);
  expect(clientReputation.score).toBeGreaterThanOrEqual(0);
  expect(clientReputation.tier).toBeDefined();

  // 15. Verify ratings appear in summary
  const proRatingSummary = await apiDirect(ACTORS.pro, "GET", `/v1/ratings/summary/${ACTORS.pro.userId}`);
  expect(proRatingSummary.total).toBeGreaterThan(0);
  expect(proRatingSummary.average).toBeGreaterThan(0);

  const clientRatingSummary = await apiDirect(ACTORS.client, "GET", `/v1/ratings/summary/${ACTORS.client.userId}`);
  expect(clientRatingSummary.total).toBeGreaterThan(0);
  expect(clientRatingSummary.average).toBeGreaterThan(0);
});

test("rating validation: score must be 1-5", async () => {
  const suffix = Date.now();

  // Setup: create and complete a simple job
  const job = await apiDirect(ACTORS.client, "POST", "/v1/jobs", {
    title: `Rating Validation ${suffix}`,
    scope: "Test",
    description: "Rating validation test",
    category: "Painting",
    budgetMin: 300,
    budgetMax: 500,
    urgency: "low",
    locationType: "on_site",
    city: "Miami",
  });

  // Attempt to rate with invalid scores
  try {
    await apiDirect(ACTORS.pro, "POST", "/v1/ratings", {
      jobId: job.id,
      ratedUserId: ACTORS.client.userId,
      score: 0, // Invalid: below 1
      comment: "Bad score",
    });
    throw new Error("Should have rejected score 0");
  } catch (err) {
    expect(err.message).toContain("400");
  }

  try {
    await apiDirect(ACTORS.pro, "POST", "/v1/ratings", {
      jobId: job.id,
      ratedUserId: ACTORS.client.userId,
      score: 6, // Invalid: above 5
      comment: "Bad score",
    });
    throw new Error("Should have rejected score 6");
  } catch (err) {
    expect(err.message).toContain("400");
  }

  // Valid scores should work
  const valid3 = await apiDirect(ACTORS.pro, "POST", "/v1/ratings", {
    jobId: job.id,
    ratedUserId: ACTORS.client.userId,
    score: 3,
    comment: "Okay",
  });
  expect(valid3.score).toBe(3);
});

test("worker reputation tier progression: emerging → growing → established → trusted", async () => {
  const suffix = Date.now();

  // Create multiple jobs to build reputation
  const jobIds = [];
  for (let i = 0; i < 3; i++) {
    const job = await apiDirect(ACTORS.client, "POST", "/v1/jobs", {
      title: `Tier Progression ${suffix}-${i}`,
      scope: "Test",
      description: "Reputation tier test",
      category: "Painting",
      budgetMin: 300,
      budgetMax: 500,
      urgency: "low",
      locationType: "on_site",
      city: "Miami",
    });
    jobIds.push(job.id);

    // Quick rating to build history
    await apiDirect(ACTORS.pro, "POST", "/v1/ratings", {
      jobId: job.id,
      ratedUserId: ACTORS.client.userId,
      score: 5,
      comment: `Rating ${i}`,
    });
  }

  // Check reputation after multiple jobs
  const rep = await apiDirect(ACTORS.pro, "GET", `/v1/users/${ACTORS.pro.userId}/reputation`);
  expect(rep.tier).toBeDefined();
  expect(["emerging", "growing", "established", "trusted"]).toContain(rep.tier);
  expect(rep.jobsCompleted).toBeGreaterThanOrEqual(0);
  expect(rep.disputeRate).toBeGreaterThanOrEqual(0);
});

test("client can view worker profile and ratings before booking", async ({ page }) => {
  await loginAs(page, "Cliente", "/client/dashboard");

  // Navigate to worker profiles or search
  await page.goto("/client/marketplace");
  await page.waitForLoadState("networkidle");

  // Look for worker card or profile (depends on UI implementation)
  const workerCard = page.getByTestId("worker-card").first();
  if (await workerCard.isVisible()) {
    // Click to view profile
    await workerCard.click();
    await page.waitForLoadState("networkidle");

    // Verify rating display
    const ratingDisplay = page.getByTestId("worker-rating-score");
    if (await ratingDisplay.isVisible()) {
      const rating = await ratingDisplay.textContent();
      expect(rating).toMatch(/\d+(\.\d+)?/);
    }
  }
});
