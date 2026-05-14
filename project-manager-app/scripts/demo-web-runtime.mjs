import { spawn } from "node:child_process";
import { once } from "node:events";
import fs from "node:fs/promises";
import http from "node:http";
import { createRequire } from "node:module";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const HOST = process.env.SEMSE_DEMO_HOST ?? "127.0.0.1";
const WEB_PORT = Number(process.env.SEMSE_DEMO_WEB_PORT ?? 3301);
const API_PORT = Number(process.env.SEMSE_DEMO_API_PORT ?? 4301);
const WEB_ORIGIN = `http://${HOST}:${WEB_PORT}`;
const API_ORIGIN = `http://${HOST}:${API_PORT}`;
const SEED_PATH = process.env.SEMSE_DEMO_SEED_PATH ?? path.resolve(__dirname, "../demo/seed/demo-seed.json");
const workspaceRequire = createRequire(new URL("../apps/web/package.json", import.meta.url));
const rootRequire = createRequire(import.meta.url);

let nextChild = null;
let apiServer = null;

function log(step, message) {
  process.stdout.write(`[demo:${step}] ${message}\n`);
}

function normalizeListenError(error, origin, purpose) {
  if (error && typeof error === "object" && "code" in error && error.code === "EPERM") {
    return new Error(
      `Cannot bind ${origin} for ${purpose}. The current environment blocks local listening sockets, so the demo runtime cannot start here. Run it in a normal local shell or CI runner with loopback networking enabled.`
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
  for await (const chunk of request) chunks.push(chunk);
  return chunks.length ? JSON.parse(Buffer.concat(chunks).toString("utf8")) : {};
}

function normalizeSeed(seed) {
  const jobs = Array.isArray(seed.jobs) ? structuredClone(seed.jobs) : [];
  const milestones = Array.isArray(seed.milestones) ? structuredClone(seed.milestones) : [];
  const evidence = Array.isArray(seed.evidence) ? structuredClone(seed.evidence) : [];
  const disputes = Array.isArray(seed.disputes) ? structuredClone(seed.disputes) : [];
  const escrow = seed.escrow && typeof seed.escrow === "object" ? structuredClone(seed.escrow) : {};

  const counters = {
    milestone: milestones.length + 1,
    evidence: evidence.length + 1,
    dispute: disputes.length + 1,
    presign: 1
  };

  return { jobs, milestones, evidence, disputes, escrow, counters };
}

async function loadState() {
  const raw = await fs.readFile(SEED_PATH, "utf8");
  return normalizeSeed(JSON.parse(raw));
}

function findJob(state, jobId) {
  return state.jobs.find((job) => job.id === jobId) ?? null;
}

function ensureEscrow(state, jobId) {
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

function createApiServer(state) {
  return http.createServer(async (request, response) => {
    if (!request.url || !request.method) return error(response, 400, "Missing request metadata");

    const url = new URL(request.url, API_ORIGIN);
    const pathName = url.pathname;
    const method = request.method.toUpperCase();

    try {
      if (method === "GET" && pathName === "/v1/jobs") {
        return json(response, 200, state.jobs);
      }

      const jobMatch = pathName.match(/^\/v1\/jobs\/([^/]+)$/);
      if (method === "GET" && jobMatch) {
        const job = findJob(state, jobMatch[1]);
        return job ? json(response, 200, job) : error(response, 404, "Job not found");
      }

      const jobMilestonesMatch = pathName.match(/^\/v1\/jobs\/([^/]+)\/milestones$/);
      if (jobMilestonesMatch) {
        const jobId = jobMilestonesMatch[1];
        if (method === "GET") {
          return json(response, 200, state.milestones.filter((milestone) => milestone.jobId === jobId));
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

      const milestoneActionMatch = pathName.match(/^\/v1\/milestones\/([^/]+)\/(submit|approve|reject|request-changes)$/);
      if (method === "POST" && milestoneActionMatch) {
        const [, milestoneId, action] = milestoneActionMatch;
        const milestone = state.milestones.find((entry) => entry.id === milestoneId);
        if (!milestone) return error(response, 404, "Milestone not found");

        const body = await readJson(request);
        if (action === "submit") milestone.status = "submitted";
        if (action === "approve") {
          milestone.status = "approved";
          milestone.reviewDecision = "approved";
        }
        if (action === "reject") {
          milestone.status = "rejected";
          milestone.reviewDecision = "rejected";
          milestone.rejectionReason = String(body.reason ?? "Rejected");
        }
        if (action === "request-changes") {
          milestone.status = "changes_requested";
          milestone.reviewDecision = "changes_requested";
          milestone.rejectionReason = String(body.reason ?? "Changes requested");
        }

        return json(response, 200, milestone);
      }

      const milestoneReleaseMatch = pathName.match(/^\/v1\/milestones\/([^/]+)\/escrow\/release$/);
      if (method === "POST" && milestoneReleaseMatch) {
        const milestone = state.milestones.find((entry) => entry.id === milestoneReleaseMatch[1]);
        if (!milestone) return error(response, 404, "Milestone not found");

        const escrow = ensureEscrow(state, milestone.jobId);
        const amount = Number(milestone.amount ?? 0);
        escrow.availableAmount = Math.max(0, escrow.availableAmount - amount);
        escrow.releasedAmount += amount;
        escrow.status = escrow.availableAmount > 0 ? "partially_released" : "released";
        milestone.status = "released";
        return json(response, 200, { milestoneId: milestone.id, releasedAmount: amount });
      }

      const escrowMatch = pathName.match(/^\/v1\/jobs\/([^/]+)\/escrow$/);
      if (method === "GET" && escrowMatch) return json(response, 200, ensureEscrow(state, escrowMatch[1]));

      const escrowFundMatch = pathName.match(/^\/v1\/jobs\/([^/]+)\/escrow\/fund$/);
      if (method === "POST" && escrowFundMatch) {
        const body = await readJson(request);
        const escrow = ensureEscrow(state, escrowFundMatch[1]);
        const amount = Number(body.amount ?? 0);
        escrow.totalAmount += amount;
        escrow.availableAmount += amount;
        escrow.currency = String(body.currency ?? "USD");
        escrow.status = "funded";
        return json(response, 200, escrow);
      }

      const evidenceListMatch = pathName.match(/^\/v1\/jobs\/([^/]+)\/evidence$/);
      if (method === "GET" && evidenceListMatch) {
        return json(response, 200, state.evidence.filter((item) => item.jobId === evidenceListMatch[1]));
      }

      if (method === "POST" && pathName === "/v1/evidence/presign") {
        const body = await readJson(request);
        const key = `uploads/${String(state.counters.presign++).padStart(3, "0")}-${String(body.filename ?? "file")}`;
        return json(response, 200, { key, uploadUrl: `${API_ORIGIN}/upload/${encodeURIComponent(key)}` });
      }

      if (method === "POST" && pathName === "/v1/evidence") {
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

      if (method === "GET" && pathName === "/v1/disputes") return json(response, 200, state.disputes);

      if (method === "POST" && pathName === "/v1/disputes") {
        const body = await readJson(request);
        const dispute = {
          id: `dispute_${String(state.counters.dispute++).padStart(3, "0")}`,
          jobId: String(body.jobId ?? ""),
          reason: String(body.reason ?? ""),
          status: "open"
        };
        state.disputes.unshift(dispute);
        const job = findJob(state, dispute.jobId);
        if (job) job.status = "dispute";
        return json(response, 200, dispute);
      }

      const disputeResolveMatch = pathName.match(/^\/v1\/disputes\/([^/]+)\/resolve$/);
      if (method === "POST" && disputeResolveMatch) {
        const dispute = state.disputes.find((entry) => entry.id === disputeResolveMatch[1]);
        if (!dispute) return error(response, 404, "Dispute not found");

        const body = await readJson(request);
        dispute.status = "resolved";
        dispute.resolution = String(body.resolution ?? "");
        const job = findJob(state, dispute.jobId);
        if (job) job.status = "accepted";
        return json(response, 200, dispute);
      }

      return error(response, 404, `Unhandled route: ${method} ${pathName}`);
    } catch (caught) {
      const message = caught instanceof Error ? caught.message : "Unknown demo stub error";
      return error(response, 500, message);
    }
  });
}

function startNextServer() {
  nextChild = spawn(
    "pnpm",
    ["--filter", "@semse/web", "dev", "--", "--hostname", HOST, "--port", String(WEB_PORT)],
    {
      cwd: process.cwd(),
      stdio: "inherit",
      env: {
        ...process.env,
        PORT: String(WEB_PORT),
        NEXT_PUBLIC_SEMSE_RUNTIME_ENABLED: "true",
        SEMSE_API_BASE_URL: API_ORIGIN,
        SEMSE_TENANT_ID: "tenant-demo",
        SEMSE_ORG_ID: "org-demo",
        SEMSE_USER_ID: "user-demo",
        SEMSE_ROLES: "OPS_ADMIN"
      }
    }
  );
}

async function closeResources() {
  if (nextChild && !nextChild.killed) {
    nextChild.kill("SIGTERM");
    await once(nextChild, "exit").catch(() => undefined);
  }
  if (apiServer) {
    await new Promise((resolve, reject) => {
      apiServer.close((caught) => {
        if (caught && caught.code !== "ERR_SERVER_NOT_RUNNING") return reject(caught);
        resolve();
      });
    });
  }
}

async function assertDeps() {
  const requiredPackages = ["next/package.json", "typescript/package.json"];
  const resolverFor = (packageName) => packageName === "next/package.json" ? workspaceRequire : rootRequire;
  const missingPackages = requiredPackages.filter((packageName) => {
    try {
      resolverFor(packageName).resolve(packageName);
      return false;
    } catch {
      return true;
    }
  });
  if (missingPackages.length) {
    throw new Error(`Missing workspace dependencies: ${missingPackages.join(", ")}. Run pnpm install first.`);
  }
}

async function startApiServer(state) {
  apiServer = createApiServer(state);

  await new Promise((resolve, reject) => {
    const onError = (error) => {
      apiServer.off("listening", onListening);
      reject(normalizeListenError(error, API_ORIGIN, "demo stub runtime"));
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

async function main() {
  process.on("SIGINT", async () => {
    await closeResources();
    process.exit(130);
  });
  process.on("SIGTERM", async () => {
    await closeResources();
    process.exit(143);
  });

  await assertDeps();
  const state = await loadState();

  await startApiServer(state);
  log("api", `demo stub ready on ${API_ORIGIN}`);

  log("prep", "building shared schemas for apps/web");
  await new Promise((resolve, reject) => {
    const child = spawn("pnpm", ["--filter", "@semse/schemas", "build"], { stdio: "inherit", cwd: process.cwd() });
    child.on("exit", (code) => code === 0 ? resolve() : reject(new Error(`schema build failed with code ${code}`)));
  });

  log("web", `starting Next dev server on ${WEB_ORIGIN}`);
  startNextServer();
  log("ready", `Open ${WEB_ORIGIN} and run the demo checklist. Seed: ${SEED_PATH}`);
}

main().catch(async (error) => {
  process.stderr.write(`${error instanceof Error ? error.stack ?? error.message : String(error)}\n`);
  process.exitCode = 1;
}).finally(async () => {
  if (process.exitCode && process.exitCode !== 0) {
    await closeResources();
  }
});
