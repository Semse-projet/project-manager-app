import { spawn } from "node:child_process";
import assert from "node:assert/strict";
import { once } from "node:events";
import http from "node:http";
import { createRequire } from "node:module";
import process from "node:process";
import { setTimeout as delay } from "node:timers/promises";

const HOST = "127.0.0.1";
const WEB_PORT = Number(process.env.SEMSE_WEB_SMOKE_PORT ?? 3301);
const API_PORT = Number(process.env.SEMSE_WEB_SMOKE_API_PORT ?? 4301);
const WEB_ORIGIN = `http://${HOST}:${WEB_PORT}`;
const API_ORIGIN = `http://${HOST}:${API_PORT}`;
const workspaceRequire = createRequire(new URL("../apps/web/package.json", import.meta.url));
const rootRequire = createRequire(import.meta.url);

let nextChild = null;
let apiServer = null;
let chromium = null;
let startInProgress = false;

const state = {
  jobs: [
    {
      id: "job_smoke_001",
      tenantId: "tenant-smoke",
      title: "Sprint 1.5 Smoke Job",
      scope: "Visible test job that links dashboard, milestones, evidence, escrow and dispute surfaces.",
      status: "accepted",
      budgetMin: 500,
      budgetMax: 1800
    }
  ],
  milestones: [],
  evidence: [],
  disputes: [],
  escrow: {
    job_smoke_001: {
      jobId: "job_smoke_001",
      status: "unfunded",
      totalAmount: 0,
      availableAmount: 0,
      releasedAmount: 0,
      currency: "USD"
    }
  },
  counters: {
    milestone: 1,
    evidence: 1,
    dispute: 1,
    presign: 1
  }
};

function log(step, message) {
  process.stdout.write(`[smoke:${step}] ${message}\n`);
}

function normalizeListenError(error, origin, purpose) {
  if (error && typeof error === "object" && "code" in error && error.code === "EPERM") {
    return new Error(
      `Cannot bind ${origin} for ${purpose}. The current environment blocks local listening sockets, so this smoke cannot complete here. Run it in a normal local shell or CI runner with loopback networking enabled.`
    );
  }

  return error instanceof Error ? error : new Error(String(error));
}

function json(response, status, data) {
  response.writeHead(status, { "content-type": "application/json" });
  response.end(JSON.stringify({ requestId: `req-${Date.now()}`, data }));
}

function error(response, status, message) {
  response.writeHead(status, { "content-type": "application/json" });
  response.end(JSON.stringify({ error: { status, message } }));
}

async function readJson(request) {
  const chunks = [];
  for await (const chunk of request) {
    chunks.push(chunk);
  }

  if (chunks.length === 0) {
    return {};
  }

  return JSON.parse(Buffer.concat(chunks).toString("utf8"));
}

function findJob(jobId) {
  return state.jobs.find((job) => job.id === jobId) ?? null;
}

function ensureEscrow(jobId) {
  if (!state.escrow[jobId]) {
    state.escrow[jobId] = {
      jobId,
      status: "unfunded",
      totalAmount: 0,
      availableAmount: 0,
      releasedAmount: 0,
      currency: "USD"
    };
  }

  return state.escrow[jobId];
}

function createApiServer() {
  return http.createServer(async (request, response) => {
    if (!request.url || !request.method) {
      return error(response, 400, "Missing request metadata");
    }

    const url = new URL(request.url, API_ORIGIN);
    const path = url.pathname;
    const method = request.method.toUpperCase();

    try {
      if (method === "GET" && path === "/v1/jobs") {
        return json(response, 200, state.jobs);
      }

      if (method === "GET" && path === "/v1/ops/dashboard") {
        return json(response, 200, {
          jobs: {
            total: state.jobs.length,
            published: 0,
            awarded: 0,
            posted: state.jobs.filter((job) => job.status === "posted").length,
            reserved: state.jobs.filter((job) => job.status === "reserved").length,
            accepted: state.jobs.filter((job) => job.status === "accepted").length,
            inProgress: state.jobs.filter((job) => job.status === "in_progress").length,
            review: state.jobs.filter((job) => job.status === "review").length,
            dispute: state.jobs.filter((job) => job.status === "dispute").length,
            completed: state.jobs.filter((job) => job.status === "completed").length,
            cancelled: state.jobs.filter((job) => job.status === "cancelled").length
          },
          projects: {
            total: 0,
            open: 0,
            inProgress: 0,
            blocked: 0,
            completed: 0,
            cancelled: 0
          },
          disputes: {
            total: state.disputes.length,
            open: state.disputes.filter((dispute) => dispute.status === "open").length,
            assigned: 0,
            resolved: state.disputes.filter((dispute) => dispute.status === "resolved").length
          },
          agents: {
            totalRuns: 0,
            queued: 0,
            running: 0,
            failed: 0,
            deadLettered: 0,
            maxAttemptsReached: 0
          }
        });
      }

      if (method === "GET" && path === "/v1/agents/runs") {
        return json(response, 200, []);
      }

      if (method === "GET" && path === "/v1/projects") {
        return json(response, 200, []);
      }

      const jobMatch = path.match(/^\/v1\/jobs\/([^/]+)$/);
      if (method === "GET" && jobMatch) {
        const job = findJob(jobMatch[1]);
        return job ? json(response, 200, job) : error(response, 404, "Job not found");
      }

      const jobMilestonesMatch = path.match(/^\/v1\/jobs\/([^/]+)\/milestones$/);
      if (jobMilestonesMatch) {
        const jobId = jobMilestonesMatch[1];
        if (method === "GET") {
          return json(
            response,
            200,
            state.milestones.filter((milestone) => milestone.jobId === jobId)
          );
        }

        if (method === "POST") {
          const body = await readJson(request);
          const milestone = {
            id: `milestone_${String(state.counters.milestone++).padStart(3, "0")}`,
            jobId,
            title: String(body.title ?? "Untitled milestone"),
            amount: Number(body.amount ?? 0),
            sequence: Number(body.sequence ?? 1),
            status: "draft"
          };
          state.milestones.push(milestone);
          return json(response, 200, milestone);
        }
      }

      const milestoneActionMatch = path.match(/^\/v1\/milestones\/([^/]+)\/(submit|approve|reject|request-changes)$/);
      if (method === "POST" && milestoneActionMatch) {
        const [, milestoneId, action] = milestoneActionMatch;
        const milestone = state.milestones.find((entry) => entry.id === milestoneId);
        if (!milestone) {
          return error(response, 404, "Milestone not found");
        }

        const body = await readJson(request);
        if (action === "submit") {
          milestone.status = "submitted";
        } else if (action === "approve") {
          milestone.status = "approved";
          milestone.reviewDecision = "approved";
        } else if (action === "reject") {
          milestone.status = "rejected";
          milestone.reviewDecision = "rejected";
          milestone.rejectionReason = String(body.reason ?? "Rejected");
        } else if (action === "request-changes") {
          milestone.status = "changes_requested";
          milestone.reviewDecision = "changes_requested";
          milestone.rejectionReason = String(body.reason ?? "Changes requested");
        }

        return json(response, 200, milestone);
      }

      const milestoneReleaseMatch = path.match(/^\/v1\/milestones\/([^/]+)\/escrow\/release$/);
      if (method === "POST" && milestoneReleaseMatch) {
        const milestone = state.milestones.find((entry) => entry.id === milestoneReleaseMatch[1]);
        if (!milestone) {
          return error(response, 404, "Milestone not found");
        }

        const escrow = ensureEscrow(milestone.jobId);
        const amount = Number(milestone.amount ?? 0);
        escrow.availableAmount = Math.max(0, escrow.availableAmount - amount);
        escrow.releasedAmount += amount;
        escrow.status = escrow.availableAmount > 0 ? "partially_released" : "released";
        milestone.status = "released";
        return json(response, 200, { milestoneId: milestone.id, releasedAmount: amount });
      }

      const escrowMatch = path.match(/^\/v1\/jobs\/([^/]+)\/escrow$/);
      if (method === "GET" && escrowMatch) {
        return json(response, 200, ensureEscrow(escrowMatch[1]));
      }

      const escrowFundMatch = path.match(/^\/v1\/jobs\/([^/]+)\/escrow\/fund$/);
      if (method === "POST" && escrowFundMatch) {
        const body = await readJson(request);
        const escrow = ensureEscrow(escrowFundMatch[1]);
        const amount = Number(body.amount ?? 0);
        escrow.totalAmount += amount;
        escrow.availableAmount += amount;
        escrow.currency = String(body.currency ?? "USD");
        escrow.status = "funded";
        return json(response, 200, escrow);
      }

      const evidenceListMatch = path.match(/^\/v1\/jobs\/([^/]+)\/evidence$/);
      if (method === "GET" && evidenceListMatch) {
        const jobId = evidenceListMatch[1];
        return json(
          response,
          200,
          state.evidence.filter((item) => item.jobId === jobId)
        );
      }

      if (method === "POST" && path === "/v1/evidence/presign") {
        const body = await readJson(request);
        const key = `uploads/${String(state.counters.presign++).padStart(3, "0")}-${String(body.filename ?? "file")}`;
        return json(response, 200, { key, uploadUrl: `${API_ORIGIN}/upload/${encodeURIComponent(key)}` });
      }

      if (method === "POST" && path === "/v1/evidence") {
        const body = await readJson(request);
        const item = {
          id: `evidence_${String(state.counters.evidence++).padStart(3, "0")}`,
          jobId: String(body.jobId ?? ""),
          milestoneId: body.milestoneId ? String(body.milestoneId) : null,
          kind: String(body.kind ?? "").toLowerCase(),
          key: String(body.key ?? ""),
          createdAt: new Date().toISOString()
        };
        state.evidence.unshift(item);
        return json(response, 200, item);
      }

      if (method === "GET" && path === "/v1/disputes") {
        return json(response, 200, state.disputes);
      }

      if (method === "POST" && path === "/v1/disputes") {
        const body = await readJson(request);
        const dispute = {
          id: `dispute_${String(state.counters.dispute++).padStart(3, "0")}`,
          jobId: String(body.jobId ?? ""),
          reason: String(body.reason ?? ""),
          status: "open"
        };
        state.disputes.unshift(dispute);
        const job = findJob(dispute.jobId);
        if (job) {
          job.status = "dispute";
        }
        return json(response, 200, dispute);
      }

      const disputeResolveMatch = path.match(/^\/v1\/disputes\/([^/]+)\/resolve$/);
      if (method === "POST" && disputeResolveMatch) {
        const dispute = state.disputes.find((entry) => entry.id === disputeResolveMatch[1]);
        if (!dispute) {
          return error(response, 404, "Dispute not found");
        }

        const body = await readJson(request);
        dispute.status = "resolved";
        dispute.resolution = String(body.resolution ?? "");
        const job = findJob(dispute.jobId);
        if (job) {
          job.status = "accepted";
        }
        return json(response, 200, dispute);
      }

      return error(response, 404, `Unhandled route: ${method} ${path}`);
    } catch (caught) {
      const message = caught instanceof Error ? caught.message : "Unknown stub error";
      return error(response, 500, message);
    }
  });
}

async function waitForHttp(url, label, timeoutMs = 120000) {
  const startedAt = Date.now();

  while (Date.now() - startedAt < timeoutMs) {
    try {
      const response = await fetch(url, { redirect: "manual" });
      if (response.status < 500) {
        log(label, `ready on ${url}`);
        return;
      }
    } catch {}

    await delay(1000);
  }

  throw new Error(`${label} did not become ready within ${timeoutMs}ms`);
}

const smokeEnv = {
  ...process.env,
  PORT: String(WEB_PORT),
  NEXT_PUBLIC_SEMSE_RUNTIME_ENABLED: "true",
  SEMSE_API_BASE_URL: API_ORIGIN,
  SEMSE_TENANT_ID: "tenant-smoke",
  SEMSE_ORG_ID: "org-smoke",
  SEMSE_USER_ID: "user-smoke",
  SEMSE_ROLES: "OPS_ADMIN"
};

async function runCommand(command, args, options = {}) {
  const child = spawn(command, args, {
    stdio: "inherit",
    env: smokeEnv,
    ...options
  });

  const [code, signal] = await once(child, "exit");
  if (code !== 0) {
    throw new Error(`${command} ${args.join(" ")} exited with code ${code ?? "null"} signal ${signal ?? "null"}`);
  }
}

async function startApiServer() {
  apiServer = createApiServer();

  await new Promise((resolve, reject) => {
    const onError = (error) => {
      apiServer.off("listening", onListening);
      reject(normalizeListenError(error, API_ORIGIN, "Sprint 1.5 web smoke stub"));
    };
    const onListening = () => {
      apiServer.off("error", onError);
      resolve();
    };

    apiServer.once("error", onError);
    apiServer.once("listening", onListening);
    apiServer.listen(API_PORT, HOST);
  });
}

function startNextServer() {
  nextChild = spawn(
    "pnpm",
    ["--filter", "@semse/web", "start", "--", "--hostname", HOST, "--port", String(WEB_PORT)],
    {
      cwd: process.cwd(),
      stdio: "inherit",
      env: smokeEnv
    }
  );
}

async function closeResources() {
  startInProgress = false;
  if (nextChild && !nextChild.killed) {
    nextChild.kill("SIGTERM");
    const exited = await Promise.race([
      once(nextChild, "exit").then(() => true).catch(() => false),
      delay(5000).then(() => false)
    ]);

    if (!exited && nextChild.pid) {
      try {
        process.kill(nextChild.pid, "SIGKILL");
      } catch {}
      await Promise.race([
        once(nextChild, "exit").catch(() => undefined),
        delay(2000)
      ]);
    }
  }

  if (apiServer) {
    await new Promise((resolve, reject) => {
      apiServer.close((error) => {
        if (error && error.code !== "ERR_SERVER_NOT_RUNNING") {
          reject(error);
          return;
        }

        resolve();
      });
    });
  }
}

async function runBrowserFlow() {
  if (!chromium) {
    throw new Error("Playwright browser automation is not available.");
  }

  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ baseURL: WEB_ORIGIN });

  try {
    log("browser", "opening dashboard");
    await page.goto("/", { waitUntil: "networkidle" });
    const jobsApiResponse = await page.request.get(`${WEB_ORIGIN}/api/semse/jobs`);
    log("debug", `jobs api status=${jobsApiResponse.status()} body=${await jobsApiResponse.text()}`);
    await page.getByRole("heading", { name: "Flujo visible principal del MVP" }).waitFor();
    await page.waitForFunction(() => {
      const marker = document.querySelector('[data-testid="jobs-count-debug"]');
      return marker?.textContent === '1';
    }, undefined, { timeout: 30000 });
    log("debug", `dashboard html=${(await page.locator("body").innerText()).slice(0, 1200)}`);
    await page.getByTestId("job-detail-link-job_smoke_001").waitFor({ timeout: 30000 });
    await page.getByTestId("job-detail-link-job_smoke_001").click();

    log("browser", "creating and approving milestone");
    await page.getByRole("heading", { name: "Job detail + milestones shell" }).waitFor();
    await page.getByTestId("milestone-title-input").fill("Smoke milestone");
    await page.getByTestId("milestone-amount-input").fill("700");
    await page.getByTestId("milestone-sequence-input").fill("1");
    await page.getByTestId("create-milestone-button").click();
    await page.getByText("Smoke milestone").waitFor();

    const milestoneRow = page.locator(".worker-row", { has: page.getByText("Smoke milestone") });
    await milestoneRow.getByRole("button", { name: "Submit" }).click();
    await milestoneRow.getByRole("button", { name: "Approve" }).click();
    await milestoneRow.getByRole("button", { name: "Release" }).click();
    await page.getByText("released").waitFor();

    log("browser", "registering evidence");
    await page.getByRole("link", { name: "Evidence" }).click();
    await page.getByRole("heading", { name: "Evidencia por job" }).waitFor();
    await page.getByTestId("evidence-kind-select").selectOption("DOCUMENT");
    await page.getByTestId("evidence-filename-input").fill("smoke-report.pdf");
    await page.getByTestId("register-evidence-button").click();
    await page.getByText("smoke-report.pdf").waitFor({ state: "visible" });

    log("browser", "funding escrow");
    await page.getByRole("link", { name: "Ver escrow" }).click();
    await page.getByRole("heading", { name: "Escrow por job" }).waitFor();
    await page.getByTestId("escrow-amount-input").fill("1200");
    await page.getByTestId("fund-escrow-button").click();
    await page.getByText("1200 USD").waitFor();

    log("browser", "opening and resolving dispute");
    await page.goto("/jobs/job_smoke_001", { waitUntil: "networkidle" });
    await page.getByTestId("dispute-reason-input").fill("Ops review required before closing the smoke flow.");
    await page.getByTestId("open-dispute-button").click();
    await page.getByText("Ops review required before closing the smoke flow.").waitFor();
    const disputeRow = page.locator(".worker-row", { has: page.getByText("Ops review required before closing the smoke flow.") });
    await disputeRow.getByRole("button", { name: "Resolve" }).click();
    await disputeRow.getByText("resolved").waitFor();

    assert.equal(state.milestones.length, 1, "Expected one milestone to be created");
    assert.equal(state.evidence.length, 1, "Expected one evidence item to be registered");
    assert.equal(state.disputes.length, 1, "Expected one dispute to be created");
    assert.equal(state.disputes[0].status, "resolved", "Expected dispute to be resolved");
    assert.equal(state.escrow.job_smoke_001.totalAmount, 1200, "Expected escrow funding to be reflected in the stub");
    assert.equal(state.escrow.job_smoke_001.releasedAmount, 700, "Expected milestone release to be reflected in the stub");
  } finally {
    await page.close();
    await browser.close();
  }
}

async function main() {
  process.on("SIGINT", async () => {
    await closeResources();
    process.exit(130);
  });
  process.on("SIGTERM", async () => {
    await closeResources();
    process.exit(143);
  });

  const requiredPackages = [
    "next/package.json",
    "@playwright/test/package.json",
    "typescript/package.json"
  ];

  const resolverFor = (packageName) =>
    packageName === "next/package.json" ? workspaceRequire : rootRequire;

  const missingPackages = requiredPackages.filter((packageName) => {
    try {
      resolverFor(packageName).resolve(packageName);
      return false;
    } catch {
      return true;
    }
  });

  if (missingPackages.length > 0) {
    throw new Error(
      `Missing workspace dependencies: ${missingPackages.join(", ")}. Run pnpm install before smoke:web:sprint15.`
    );
  }

  ({ chromium } = await import("@playwright/test"));

  await startApiServer();
  log("api", `stub server listening on ${API_ORIGIN}`);

  log("prep", "building shared schemas for apps/web");
  await runCommand("pnpm", ["--filter", "@semse/schemas", "build"]);

  log("prep", "building production web bundle for stable smoke");
  await runCommand("pnpm", ["--filter", "@semse/web", "build"]);

  log("web", "starting Next production server");
  startNextServer();
  await waitForHttp(WEB_ORIGIN, "web");

  await runBrowserFlow();
  log("result", "Sprint 1.5 smoke flow passed");
}

main()
  .catch(async (error) => {
    const message = error instanceof Error ? error.stack ?? error.message : String(error);
    process.stderr.write(`${message}\n`);
    process.exitCode = 1;
  })
  .finally(async () => {
    await closeResources();
  });
