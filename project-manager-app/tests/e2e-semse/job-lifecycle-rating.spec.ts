/**
 * Hiring flow against the real API, end to end:
 * job → reservation → accept → contract → both signatures → escrow (mock) →
 * milestone → evidence → submit → approve → release → job in_progress →
 * review → completed → ratings both ways → summary and reputation.
 * Plus the guards the API enforces at each step (negative cases).
 *
 * Talks to the API directly with header identity, which only a local API
 * accepts: SEMSE_ALLOW_HEADER_IDENTITY=true, NODE_ENV=test and no AUTH_SECRET, also
 * not in apps/api/.env or packages/db/.env, which the API reloads on start
 * (see docs/semse-kit/local-stack.md). Default target http://127.0.0.1:4122,
 * override with SEMSE_API_URL. Uses the seeded demo orgs and users.
 *
 *   SEMSE_API_URL=http://127.0.0.1:4122 pnpm exec playwright test -c playwright.semse.config.ts tests/e2e-semse/job-lifecycle-rating.spec.ts
 */
import { test, expect } from "@playwright/test";

const API_BASE = (process.env.SEMSE_API_URL ?? "http://127.0.0.1:4122").replace(/\/+$/, "");
// Explicit qualification runs must FAIL rather than count four skipped tests as green.
// This spec mutates hiring, escrow (mock), and ratings data: never target production.
const REQUIRE_HIRING_E2E = process.env.SEMSE_REQUIRE_HIRING_E2E === "1";
const apiTarget = new URL(API_BASE);
if (!["localhost", "127.0.0.1", "[::1]"].includes(apiTarget.hostname)) {
  throw new Error("Hiring E2E requires a loopback-only test API, never a remote or production URL");
}
const TENANT = "tenant_default";

function skipOrFail(reason: string): void {
  if (REQUIRE_HIRING_E2E) throw new Error(`Hiring E2E preflight failed: ${reason}`);
  test.skip(true, reason);
}

type Actor = { orgId: string; userId: string; roles: string[] };
const ACTORS = {
  client: { orgId: "org_client_001", userId: "usr_client_001", roles: ["CLIENT"] },
  pro: { orgId: "org_pro_001", userId: "usr_worker_001", roles: ["PRO"] },
  ops: { orgId: "org_admin_001", userId: "usr_admin_001", roles: ["OPS_ADMIN"] },
} satisfies Record<string, Actor>;

type Answer = { status: number; data: any; error: any };

async function api(actor: Actor, method: string, path: string, body?: unknown): Promise<Answer> {
  const response = await fetch(`${API_BASE}${path}`, {
    method,
    headers: {
      "content-type": "application/json",
      "x-tenant-id": TENANT,
      "x-org-id": actor.orgId,
      "x-user-id": actor.userId,
      "x-roles": actor.roles.join(","),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const payload = (await response.json().catch(() => ({}))) as { data?: unknown; error?: unknown };
  return { status: response.status, data: payload.data, error: payload.error };
}

// A step that must succeed: fails with the API's own error otherwise.
async function ok(actor: Actor, method: string, path: string, body?: unknown) {
  const answer = await api(actor, method, path, body);
  expect(answer.status, `${method} ${path} → ${answer.status} ${JSON.stringify(answer.error)}`).toBeLessThan(300);
  return answer.data;
}

async function expectRefused(actor: Actor, method: string, path: string, body: unknown, status: number, message?: RegExp) {
  const answer = await api(actor, method, path, body);
  expect(answer.status, `${method} ${path} should be refused with ${status}`).toBe(status);
  if (message) expect(JSON.stringify(answer.error)).toMatch(message);
}

test.beforeAll(async () => {
  const health = await fetch(`${API_BASE}/v1/health`).then((r) => r.status, () => 0);
  if (health !== 200) {
    skipOrFail(`API not reachable at ${API_BASE}/v1/health (see docs/semse-kit/local-stack.md)`);
    return;
  }
  const probe = await api(ACTORS.client, "GET", "/v1/jobs");
  if (probe.status === 401 || probe.status === 503) {
    skipOrFail(`API at ${API_BASE} does not accept header identity (SEMSE_ALLOW_HEADER_IDENTITY=true, NODE_ENV=test, no AUTH_SECRET, and none in apps/api/.env or packages/db/.env)`);
  }
});

const run = () => `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
const signature = (id: string) => ({ documentHash: `sha256-e2e-${id}-0000000000`, pdfUrl: "https://example.com/contracts/e2e.pdf" });

async function createJob(id: string) {
  const job = await ok(ACTORS.client, "POST", "/v1/jobs", {
    title: `TEST_${id} pintura`,
    scope: `Trabajo sintético del test de contratación ${id}`,
    category: "painting",
  });
  expect(job.status).toBe("POSTED");
  return job;
}

// Job with an accepted reservation, a contract signed by both parties and a funded escrow.
async function fundedJob(id: string, amount = 500) {
  const job = await createJob(id);
  const reservation = await ok(ACTORS.pro, "POST", `/v1/jobs/${job.id}/reservations`, { expiresInMinutes: 30 });
  const accepted = await ok(ACTORS.client, "POST", `/v1/reservations/${reservation.id}/accept`, {});
  expect(accepted.status).toBe("ACCEPTED");
  const contract = await ok(ACTORS.client, "POST", `/v1/jobs/${job.id}/contracts`, { termsJson: { currency: "USD" } });
  await ok(ACTORS.client, "POST", `/v1/contracts/${contract.id}/sign`, signature(id));
  const signed = await ok(ACTORS.pro, "POST", `/v1/contracts/${contract.id}/sign`, signature(id));
  expect(signed.signedClientAt).toBeTruthy();
  expect(signed.signedProAt).toBeTruthy();
  const funded = await ok(ACTORS.client, "POST", `/v1/jobs/${job.id}/escrow/fund`, { amount, currency: "USD", provider: "mock" });
  return { job, contract, projectId: funded.escrow.projectId as string };
}

test("hiring flow: job → contract → escrow → milestone → release → completed → ratings → reputation", async () => {
  const id = run();
  const { job, projectId } = await fundedJob(id);

  const escrowBefore = await ok(ACTORS.client, "GET", `/v1/jobs/${job.id}/escrow`);
  expect(escrowBefore.totalDeposited).toBe(500);
  expect(escrowBefore.totalReleased).toBe(0);

  const milestone = await ok(ACTORS.ops, "POST", `/v1/projects/${projectId}/milestones`, { title: `Hito ${id}`, amount: 500, sequence: 1 });
  expect(milestone.status).toBe("DRAFT");
  await ok(ACTORS.pro, "POST", "/v1/evidence", { projectId, milestoneId: milestone.id, key: `tenants/${TENANT}/evidence/e2e/${id}.jpg`, kind: "PHOTO" });
  expect((await ok(ACTORS.pro, "POST", `/v1/milestones/${milestone.id}/submit`, {})).status).toBe("SUBMITTED");
  expect((await ok(ACTORS.client, "POST", `/v1/milestones/${milestone.id}/approve`, {})).status).toBe("APPROVED");
  await ok(ACTORS.client, "POST", `/v1/milestones/${milestone.id}/escrow/release`, {});

  const escrowAfter = await ok(ACTORS.client, "GET", `/v1/jobs/${job.id}/escrow`);
  expect(escrowAfter.totalReleased).toBe(500);

  // Job FSM (docs/foundation/STATE_MACHINES.md): the professional starts and asks for review, the client completes.
  expect((await ok(ACTORS.pro, "POST", `/v1/jobs/${job.id}/transition`, { targetStatus: "in_progress" })).status).toBe("IN_PROGRESS");
  expect((await ok(ACTORS.pro, "POST", `/v1/jobs/${job.id}/transition`, { targetStatus: "review" })).status).toBe("REVIEW");
  expect((await ok(ACTORS.client, "POST", `/v1/jobs/${job.id}/transition`, { targetStatus: "completed" })).status).toBe("COMPLETED");

  const before = await ok(ACTORS.pro, "GET", `/v1/ratings/users/${ACTORS.pro.userId}/summary`);
  const toPro = await ok(ACTORS.client, "POST", "/v1/ratings", { jobId: job.id, toUserId: ACTORS.pro.userId, score: 5, comment: "Buen trabajo" });
  expect(toPro.score).toBe(5);
  await ok(ACTORS.pro, "POST", "/v1/ratings", { jobId: job.id, toUserId: ACTORS.client.userId, score: 4, comment: "Buen cliente" });

  const after = await ok(ACTORS.pro, "GET", `/v1/ratings/users/${ACTORS.pro.userId}/summary`);
  expect(after.totalRatings).toBe(before.totalRatings + 1);
  const reputation = await ok(ACTORS.client, "GET", `/v1/ratings/users/${ACTORS.pro.userId}/reputation`);
  expect(reputation.signals.completedJobs).toBeGreaterThan(0);
  expect(reputation.signals.totalRatings).toBeGreaterThan(0);
});

test("guards: no contract without an accepted reservation, no funding before both signatures", async () => {
  const id = run();
  const job = await createJob(id);
  await expectRefused(ACTORS.client, "POST", `/v1/jobs/${job.id}/contracts`, { termsJson: { currency: "USD" } }, 409, /accepted reservation/);

  const reservation = await ok(ACTORS.pro, "POST", `/v1/jobs/${job.id}/reservations`, { expiresInMinutes: 30 });
  await ok(ACTORS.client, "POST", `/v1/reservations/${reservation.id}/accept`, {});
  const contract = await ok(ACTORS.client, "POST", `/v1/jobs/${job.id}/contracts`, { termsJson: { currency: "USD" } });
  await ok(ACTORS.client, "POST", `/v1/contracts/${contract.id}/sign`, signature(id));
  await expectRefused(ACTORS.client, "POST", `/v1/jobs/${job.id}/escrow/fund`, { amount: 100, currency: "USD", provider: "mock" }, 409, /fully signed contract/);
});

test("guards: a milestone needs evidence to be submitted and approval to be released", async () => {
  const id = run();
  const { projectId } = await fundedJob(id, 300);
  const milestone = await ok(ACTORS.ops, "POST", `/v1/projects/${projectId}/milestones`, { title: `Hito ${id}`, amount: 300, sequence: 1 });

  await expectRefused(ACTORS.pro, "POST", `/v1/milestones/${milestone.id}/submit`, {}, 409, /without evidence/);
  await expectRefused(ACTORS.client, "POST", `/v1/milestones/${milestone.id}/escrow/release`, {}, 409, /must be approved/);

  await ok(ACTORS.pro, "POST", "/v1/evidence", { projectId, milestoneId: milestone.id, key: `tenants/${TENANT}/evidence/e2e/${id}.jpg`, kind: "PHOTO" });
  await ok(ACTORS.pro, "POST", `/v1/milestones/${milestone.id}/submit`, {});
  await expectRefused(ACTORS.client, "POST", `/v1/milestones/${milestone.id}/escrow/release`, {}, 409, /must be approved/);
});

test("guards: job transitions follow the role rules, completion needs closure, and ratings need a completed job and a 1-5 score", async () => {
  const id = run();
  const { job, projectId } = await fundedJob(id, 200);
  const milestone = await ok(ACTORS.ops, "POST", `/v1/projects/${projectId}/milestones`, { title: `Hito ${id}`, amount: 200, sequence: 1 });

  await expectRefused(ACTORS.client, "POST", "/v1/ratings", { jobId: job.id, toUserId: ACTORS.pro.userId, score: 5 }, 400, /completed jobs/);

  await ok(ACTORS.pro, "POST", `/v1/jobs/${job.id}/transition`, { targetStatus: "in_progress" });
  await ok(ACTORS.pro, "POST", `/v1/jobs/${job.id}/transition`, { targetStatus: "review" });
  // Only the client (or ops) completes a job; another client org cannot touch it.
  await expectRefused(ACTORS.pro, "POST", `/v1/jobs/${job.id}/transition`, { targetStatus: "completed" }, 422, /client-only/);
  const otherClient: Actor = { orgId: `org_client_e2e_${id}`, userId: `usr_client_e2e_${id}`, roles: ["CLIENT"] };
  const intruder = await api(otherClient, "POST", `/v1/jobs/${job.id}/transition`, { targetStatus: "completed" });
  expect([403, 404, 422], `other client org completing ${job.id}: ${intruder.status}`).toContain(intruder.status);
  // Field workers have no transition permission at all.
  await expectRefused({ ...ACTORS.pro, roles: ["WORKER"] }, "POST", `/v1/jobs/${job.id}/transition`, { targetStatus: "completed" }, 403);

  // DOMAIN_INVARIANTS.md: no completion while a milestone is open or escrow holds funds, not even for ops.
  await expectRefused(ACTORS.client, "POST", `/v1/jobs/${job.id}/transition`, { targetStatus: "completed" }, 409, /not approved.*escrow still holds 200/);
  await expectRefused(ACTORS.ops, "POST", `/v1/jobs/${job.id}/transition`, { targetStatus: "completed" }, 409, /cannot be completed/);
  await ok(ACTORS.pro, "POST", "/v1/evidence", { projectId, milestoneId: milestone.id, key: `tenants/${TENANT}/evidence/e2e/${id}.jpg`, kind: "PHOTO" });
  await ok(ACTORS.pro, "POST", `/v1/milestones/${milestone.id}/submit`, {});
  await ok(ACTORS.client, "POST", `/v1/milestones/${milestone.id}/approve`, {});
  await expectRefused(ACTORS.client, "POST", `/v1/jobs/${job.id}/transition`, { targetStatus: "completed" }, 409, /escrow still holds 200/);
  await ok(ACTORS.client, "POST", `/v1/milestones/${milestone.id}/escrow/release`, {});

  await ok(ACTORS.client, "POST", `/v1/jobs/${job.id}/transition`, { targetStatus: "completed" });
  for (const score of [0, 6, 4.5]) {
    await expectRefused(ACTORS.client, "POST", "/v1/ratings", { jobId: job.id, toUserId: ACTORS.pro.userId, score }, 400);
  }
  await ok(ACTORS.client, "POST", "/v1/ratings", { jobId: job.id, toUserId: ACTORS.pro.userId, score: 3 });
});
