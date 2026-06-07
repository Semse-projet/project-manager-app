import assert from "node:assert/strict";
import http from "node:http";

const API_BASE = process.env.SEMSE_API_URL ?? "http://127.0.0.1:4112";
const tenantId = process.env.SEMSE_TENANT_ID ?? "tnt_demo";
const orgId = process.env.SEMSE_ORG_ID ?? "seed-org-ops";
const userId = process.env.SEMSE_USER_ID ?? "seed-user-admin";
const roles = (process.env.SEMSE_ROLES ?? "OPS_ADMIN,WORKER").split(",").map((value) => value.trim()).filter(Boolean);

function log(step, detail) {
  process.stdout.write(`[tracker-smoke:${step}] ${detail}\n`);
}

async function request(path, init = {}) {
  const url = new URL(path, API_BASE);
  const method = init.method ?? "GET";
  const headers = {
    "content-type": "application/json",
    ...(init.headers ?? {}),
  };
  const body = typeof init.body === "string" ? init.body : undefined;

  const payload = await new Promise((resolve, reject) => {
    const req = http.request(
      url,
      {
        method,
        headers,
      },
      (res) => {
        const chunks = [];
        res.on("data", (chunk) => chunks.push(chunk));
        res.on("end", () => {
          const text = Buffer.concat(chunks).toString("utf8");
          try {
            resolve({
              statusCode: res.statusCode ?? 500,
              json: text.length > 0 ? JSON.parse(text) : {},
            });
          } catch (error) {
            reject(error);
          }
        });
      }
    );

    req.on("error", reject);
    if (body) req.write(body);
    req.end();
  });

  if (payload.statusCode < 200 || payload.statusCode >= 300) {
    throw new Error(`${path} -> ${payload.statusCode} ${JSON.stringify(payload.json)}`);
  }

  return payload.json.data;
}

async function issueToken() {
  return request("/v1/auth/token", {
    method: "POST",
    body: JSON.stringify({
      tenantId,
      orgId,
      userId,
      roles,
    }),
  });
}

async function authedRequest(path, token, init = {}) {
  return request(path, {
    ...init,
    headers: {
      authorization: `Bearer ${token}`,
      ...(init.headers ?? {}),
    },
  });
}

async function main() {
  log("auth", "issuing session-bound token");
  const auth = await issueToken();
  assert.ok(auth.accessToken, "missing accessToken");

  const token = auth.accessToken;

  log("job", "creating smoke job");
  const job = await authedRequest("/v1/jobs", token, {
    method: "POST",
    body: JSON.stringify({
      title: "Tracker Smoke Job",
      scope: "Trabajo técnico para validar sesiones persistentes del tracker.",
      budgetMin: 100,
      budgetMax: 300,
    }),
  });
  assert.ok(job.id, "missing job id");

  log("snapshot", "reading initial tracker snapshot");
  const initialSnapshot = await authedRequest("/v1/field-ops/tracker", token);
  if (initialSnapshot.activeSession?.id) {
    log("cleanup", `stopping previous session ${initialSnapshot.activeSession.id}`);
    await authedRequest(`/v1/field-ops/tracker/${initialSnapshot.activeSession.id}/stop`, token, {
      method: "POST",
      body: JSON.stringify({ notes: "cleanup" }),
    });
  }

  log("start", "starting tracker session");
  const started = await authedRequest("/v1/field-ops/tracker/start", token, {
    method: "POST",
    body: JSON.stringify({
      jobId: job.id,
      notes: "inicio smoke",
    }),
  });
  assert.equal(started.status, "RUNNING");
  assert.equal(started.jobId, job.id);

  await new Promise((resolve) => setTimeout(resolve, 1200));

  log("pause", "pausing tracker session");
  const paused = await authedRequest(`/v1/field-ops/tracker/${started.id}/pause`, token, {
    method: "POST",
    body: JSON.stringify({ notes: "pausa smoke" }),
  });
  assert.equal(paused.status, "PAUSED");
  assert.ok(paused.accumulatedSeconds >= 1);

  log("resume", "resuming tracker session");
  const resumed = await authedRequest(`/v1/field-ops/tracker/${started.id}/resume`, token, {
    method: "POST",
    body: JSON.stringify({ notes: "reanudar smoke" }),
  });
  assert.equal(resumed.status, "RUNNING");

  await new Promise((resolve) => setTimeout(resolve, 1200));

  log("stop", "stopping tracker session");
  const stopped = await authedRequest(`/v1/field-ops/tracker/${started.id}/stop`, token, {
    method: "POST",
    body: JSON.stringify({ notes: "stop smoke" }),
  });
  assert.equal(stopped.status, "STOPPED");
  assert.ok(stopped.elapsedSeconds >= 2);

  log("snapshot", "reading final tracker snapshot");
  const finalSnapshot = await authedRequest("/v1/field-ops/tracker", token);
  assert.equal(finalSnapshot.activeSession, null);
  assert.ok(finalSnapshot.recentSessions.some((entry) => entry.id === started.id));

  log("ok", `session ${started.id} completed with ${stopped.elapsedSeconds}s`);
}

main().catch((error) => {
  process.stderr.write(`${error.stack ?? error}\n`);
  process.exitCode = 1;
});
