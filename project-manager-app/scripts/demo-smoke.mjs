import { spawn } from "node:child_process";
import process from "node:process";

const HOST = process.env.SEMSE_DEMO_HOST ?? "127.0.0.1";
const WEB_PORT = Number(process.env.SEMSE_DEMO_WEB_PORT ?? 3305);
const API_PORT = Number(process.env.SEMSE_DEMO_API_PORT ?? 4305);
const WEB_ORIGIN = `http://${HOST}:${WEB_PORT}`;
const API_ORIGIN = `http://${HOST}:${API_PORT}`;

function log(step, message) {
  process.stdout.write(`[demo-smoke:${step}] ${message}\n`);
}

async function waitFor(check, label, timeoutMs = 120000, intervalMs = 1000) {
  const started = Date.now();
  let lastError = null;
  while (Date.now() - started < timeoutMs) {
    try {
      return await check();
    } catch (error) {
      lastError = error;
      await new Promise((resolve) => setTimeout(resolve, intervalMs));
    }
  }
  throw new Error(`${label} did not become ready in ${timeoutMs}ms${lastError ? ` | last error: ${lastError.message}` : ""}`);
}

async function fetchJson(url, options) {
  const response = await fetch(url, options);
  if (!response.ok) {
    throw new Error(`${options?.method ?? "GET"} ${url} failed with ${response.status}`);
  }
  return response.json();
}

async function fetchText(url) {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`GET ${url} failed with ${response.status}`);
  }
  return response.text();
}

async function main() {
  log("boot", `starting demo runtime on web=${WEB_PORT} api=${API_PORT}`);

  const child = spawn("node", ["./scripts/demo-web-runtime.mjs"], {
    cwd: process.cwd(),
    env: {
      ...process.env,
      SEMSE_DEMO_HOST: HOST,
      SEMSE_DEMO_WEB_PORT: String(WEB_PORT),
      SEMSE_DEMO_API_PORT: String(API_PORT)
    },
    stdio: ["ignore", "pipe", "pipe"]
  });

  let output = "";
  const append = (chunk) => {
    const text = chunk.toString();
    output += text;
    process.stdout.write(text);
  };
  child.stdout.on("data", append);
  child.stderr.on("data", append);

  const stop = async (signal = "SIGTERM") => {
    if (child.exitCode !== null) return;
    child.kill(signal);
    await new Promise((resolve) => child.once("exit", resolve));
  };

  process.on("SIGINT", async () => {
    await stop("SIGINT");
    process.exit(130);
  });
  process.on("SIGTERM", async () => {
    await stop("SIGTERM");
    process.exit(143);
  });

  try {
    await waitFor(async () => {
      const body = await fetchJson(`${API_ORIGIN}/v1/jobs`);
      if (!body?.data || !Array.isArray(body.data) || body.data.length < 2) {
        throw new Error("seed jobs not available yet");
      }
      return body;
    }, "demo api");
    log("check", "api jobs ready");

    await waitFor(async () => {
      const html = await fetchText(WEB_ORIGIN);
      if (!html.includes("SEMSE") && !html.includes("__next")) {
        throw new Error("web html does not look like Next app yet");
      }
      return html;
    }, "demo web");
    log("check", "web root ready");

    const jobs = await fetchJson(`${API_ORIGIN}/v1/jobs`);
    const kitchen = jobs.data.find((job) => job.title.includes("Kitchen Remodel"));
    const roof = jobs.data.find((job) => job.title.includes("Roof Repair"));
    if (!kitchen || !roof) throw new Error("expected demo jobs were not found");

    const createdMilestone = await fetchJson(`${API_ORIGIN}/v1/jobs/${kitchen.id}/milestones`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ title: "Smoke milestone", amount: 777, sequence: 99 })
    });
    if (createdMilestone.data.status !== "draft") throw new Error("milestone was not created in draft");
    log("check", `milestone created: ${createdMilestone.data.id}`);

    const submitted = await fetchJson(`${API_ORIGIN}/v1/milestones/${createdMilestone.data.id}/submit`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({})
    });
    const approved = await fetchJson(`${API_ORIGIN}/v1/milestones/${createdMilestone.data.id}/approve`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({})
    });
    const released = await fetchJson(`${API_ORIGIN}/v1/milestones/${createdMilestone.data.id}/escrow/release`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({})
    });
    if (submitted.data.status !== "submitted") throw new Error("submit transition failed");
    if (approved.data.status !== "approved") throw new Error("approve transition failed");
    if (released.data.releasedAmount !== 777) throw new Error("release transition failed");
    log("check", "milestone lifecycle ok");

    const funded = await fetchJson(`${API_ORIGIN}/v1/jobs/${kitchen.id}/escrow/fund`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ amount: 1500, currency: "USD" })
    });
    if (funded.data.totalAmount < 13500) throw new Error("escrow funding did not increase total amount");
    log("check", "escrow funding ok");

    const presign = await fetchJson(`${API_ORIGIN}/v1/evidence/presign`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ filename: "smoke-proof.pdf" })
    });
    const evidence = await fetchJson(`${API_ORIGIN}/v1/evidence`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        jobId: kitchen.id,
        milestoneId: createdMilestone.data.id,
        kind: "DOCUMENT",
        key: presign.data.key
      })
    });
    if (!String(evidence.data.key).includes("smoke-proof.pdf")) throw new Error("evidence registration failed");
    log("check", "evidence registration ok");

    const disputes = await fetchJson(`${API_ORIGIN}/v1/disputes`);
    const openDispute = disputes.data.find((entry) => entry.jobId === roof.id && entry.status === "open");
    if (!openDispute) throw new Error("expected open dispute was not found");
    const resolved = await fetchJson(`${API_ORIGIN}/v1/disputes/${openDispute.id}/resolve`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ resolution: "Smoke resolution" })
    });
    if (resolved.data.status !== "resolved") throw new Error("dispute resolve failed");
    log("check", "dispute resolution ok");

    log("pass", `demo smoke passed | web=${WEB_ORIGIN} api=${API_ORIGIN}`);
  } finally {
    await stop();
  }
}

main().catch((error) => {
  process.stderr.write(`${error instanceof Error ? error.stack ?? error.message : String(error)}\n`);
  process.exit(1);
});
