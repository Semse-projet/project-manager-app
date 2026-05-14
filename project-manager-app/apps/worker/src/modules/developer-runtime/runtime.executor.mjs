import { randomUUID } from "node:crypto";
import { spawn } from "node:child_process";
import { promises as fs } from "node:fs";
import path from "node:path";
import {
  getDeveloperRuntimeCommandTemplatePolicy,
  resolveDeveloperRuntimeCommandTemplate,
} from "@semse/shared";
import { buildValidationArtifacts, buildValidationResults } from "./validation.executor.mjs";

const MAX_CHUNK_BYTES = 4096;
const PROGRESS_INTERVAL_MS = 1500;
const READ_LIMIT_BYTES = 16_000;
const LIST_LIMIT = 50;
const SEARCH_LIMIT = 25;

function nowIso() {
  return new Date().toISOString();
}

function resolveRepoRoot() {
  return new URL("../../../", import.meta.url);
}

function ensureRepoScopedPath(rootPath, targetPath = "") {
  const resolved = path.resolve(rootPath, targetPath);
  const relative = path.relative(rootPath, resolved);
  if (relative.startsWith("..") || path.isAbsolute(relative)) {
    throw new Error(`Path escapes repo root: ${targetPath}`);
  }
  return resolved;
}

function snippet(value, max = 1200) {
  return value.trim().slice(0, max) || undefined;
}

function relativeRepoPath(rootPath, absolutePath) {
  return path.relative(rootPath, absolutePath) || ".";
}

function getApprovalState(approvals, stepId) {
  const record = approvals.find((approval) => approval.request?.stepId === stepId);
  if (!record) {
    return "not-required";
  }
  if (!record.decision) {
    return "pending";
  }
  return record.decision.approved ? "approved" : "rejected";
}

async function detectPackageManager(rootPath) {
  const packageJsonPath = path.join(rootPath, "package.json");
  try {
    const packageJson = JSON.parse(await fs.readFile(packageJsonPath, "utf8"));
    if (typeof packageJson.packageManager === "string") {
      if (packageJson.packageManager.startsWith("pnpm")) return "pnpm";
      if (packageJson.packageManager.startsWith("yarn")) return "yarn";
    }
  } catch {
    // noop
  }

  try {
    await fs.access(path.join(rootPath, "pnpm-lock.yaml"));
    return "pnpm";
  } catch {
    // noop
  }
  try {
    await fs.access(path.join(rootPath, "yarn.lock"));
    return "yarn";
  } catch {
    // noop
  }

  return "pnpm";
}

function commandForStep(step) {
  if (step.tool === "runBuild") {
    return {
      command: "./node_modules/.bin/tsc -p apps/api/tsconfig.json",
      validationName: "build",
    };
  }
  if (step.tool === "runLint") {
    return {
      command: "./node_modules/.bin/eslint apps/api/src/modules/developer-runtime --ext .ts",
      validationName: "lint",
    };
  }
  if (step.tool === "runTests") {
    return {
      command: "node --test apps/api/test/zod-validation.test.ts",
      validationName: "tests",
    };
  }

  return null;
}

async function runShellCommand(command, cwd, onChunk) {
  const startedAt = Date.now();
  return new Promise((resolve) => {
    const child = spawn("/bin/bash", ["-c", command], {
      cwd,
      env: process.env,
      stdio: ["ignore", "pipe", "pipe"],
    });

    let stdout = "";
    let stderr = "";
    let lastProgressAt = Date.now();

    const maybeFlushProgress = (partial) => {
      if (!onChunk) return;
      const now = Date.now();
      if (now - lastProgressAt >= PROGRESS_INTERVAL_MS) {
        lastProgressAt = now;
        const combined = `${stdout}${stderr ? `\n${stderr}` : ""}`.slice(-MAX_CHUNK_BYTES);
        onChunk(combined || partial || "(running...)");
      }
    };

    child.stdout.on("data", (chunk) => {
      stdout += chunk.toString("utf8");
      maybeFlushProgress(chunk.toString("utf8").slice(0, 200));
    });
    child.stderr.on("data", (chunk) => {
      stderr += chunk.toString("utf8");
      maybeFlushProgress(chunk.toString("utf8").slice(0, 200));
    });

    const killTimer = setTimeout(() => {
      child.kill("SIGTERM");
    }, 30_000);

    child.on("close", (code) => {
      clearTimeout(killTimer);
      resolve({
        ok: code === 0,
        stdout: stdout.slice(0, 1024 * 1024),
        stderr: stderr.slice(0, 256 * 1024),
        durationMs: Date.now() - startedAt,
      });
    });

    child.on("error", (error) => {
      clearTimeout(killTimer);
      resolve({
        ok: false,
        stdout,
        stderr: error.message,
        durationMs: Date.now() - startedAt,
      });
    });
  });
}

async function executeListFiles({ rootPath }) {
  const entries = await fs.readdir(rootPath, { withFileTypes: true });
  return {
    ok: true,
    stdout: entries
      .slice(0, LIST_LIMIT)
      .map((entry) => `${entry.isDirectory() ? "dir" : "file"} ${entry.name}`)
      .join("\n"),
    stderr: "",
    durationMs: 0,
  };
}

async function executeInspectEnv({ rootPath }) {
  const candidates = [".env", ".env.local", ".env.example", ".env.sample"];
  const present = [];
  for (const candidate of candidates) {
    try {
      await fs.access(path.join(rootPath, candidate));
      present.push(candidate);
    } catch {
      // noop
    }
  }

  return {
    ok: true,
    stdout: present.length > 0
      ? `Environment files present: ${present.join(", ")}`
      : "No .env files found in repo root.",
    stderr: "",
    durationMs: 0,
  };
}

async function executeGitStatus({ rootPath }) {
  return runShellCommand("git status --short", rootPath);
}

async function executeGitDiff({ rootPath }) {
  return runShellCommand("git diff --stat", rootPath);
}

async function executeReadFile({ rootPath, step }) {
  const relativePath = typeof step.expectedOutput === "string" && step.expectedOutput.trim()
    ? step.expectedOutput.trim()
    : "package.json";
  const filePath = ensureRepoScopedPath(rootPath, relativePath);
  const buffer = await fs.readFile(filePath);
  return {
    ok: true,
    stdout: `Read ${relativePath}\n${buffer.toString("utf8", 0, READ_LIMIT_BYTES)}`,
    stderr: "",
    durationMs: 0,
  };
}

async function executeSearchCode({ rootPath, step }) {
  const query = typeof step.expectedOutput === "string" && step.expectedOutput.trim()
    ? step.expectedOutput.trim()
    : "developer-runtime";
  const rgCommand = `rg -n --hidden --glob '!node_modules' --glob '!.git' ${JSON.stringify(query)} ${JSON.stringify(rootPath)}`;
  const result = await runShellCommand(rgCommand, rootPath);
  return {
    ...result,
    stdout: result.stdout.split("\n").filter(Boolean).slice(0, SEARCH_LIMIT).join("\n"),
  };
}

async function executeInstallDependencies({ rootPath }) {
  const manager = await detectPackageManager(rootPath);
  const command = manager === "pnpm"
    ? "pnpm install"
    : manager === "yarn"
      ? "yarn install"
      : "pnpm install";
  const result = await runShellCommand(command, rootPath);
  return {
    ...result,
    stdout: `manager=${manager}\n${result.stdout}`.trim(),
  };
}

async function executeRunCommand({ rootPath, mission }) {
  const template = typeof mission.intent.metadata?.commandTemplate === "string"
    ? mission.intent.metadata.commandTemplate
    : null;
  const resolvedTemplate = template ? resolveDeveloperRuntimeCommandTemplate(template) : null;
  const policy = template ? getDeveloperRuntimeCommandTemplatePolicy(template) : null;
  const args = Array.isArray(mission.intent.metadata?.commandArgs)
    ? mission.intent.metadata.commandArgs.filter((value) => typeof value === "string" && value.length > 0)
    : [];

  if (typeof mission.intent.metadata?.command === "string") {
    return {
      ok: false,
      stdout: "",
      stderr: "runCommand no longer accepts metadata.command; use metadata.commandTemplate",
      durationMs: 0,
    };
  }

  if (!resolvedTemplate) {
    return {
      ok: false,
      stdout: "",
      stderr: "runCommand requires allowed mission.intent.metadata.commandTemplate",
      durationMs: 0,
    };
  }

  if (!policy) {
    return {
      ok: false,
      stdout: "",
      stderr: "runCommand template policy not found",
      durationMs: 0,
    };
  }

  if (!policy.allowArgs && args.length > 0) {
    return {
      ok: false,
      stdout: "",
      stderr: `runCommand template ${template} does not allow args`,
      durationMs: 0,
    };
  }

  if (args.length > policy.maxArgs) {
    return {
      ok: false,
      stdout: "",
      stderr: `runCommand template ${template} exceeds maxArgs=${policy.maxArgs}`,
      durationMs: 0,
    };
  }

  const command = [resolvedTemplate, ...args.map((value) => JSON.stringify(value))].join(" ");
  return runShellCommand(command, rootPath);
}

function resolveWriteOperation(mission, step) {
  const operations = Array.isArray(mission.intent.metadata?.writeFiles)
    ? mission.intent.metadata.writeFiles
    : [];
  const matched = operations.filter((operation) => !operation.stepId || operation.stepId === step.id);
  return matched[0] ?? null;
}

function resolvePatchOperation(mission, step) {
  const operations = Array.isArray(mission.intent.metadata?.patches)
    ? mission.intent.metadata.patches
    : [];
  const matched = operations.filter((operation) => !operation.stepId || operation.stepId === step.id);
  return matched[0] ?? null;
}

async function getGitDiff(rootPath, relPath) {
  const result = await runShellCommand(`git diff -- ${JSON.stringify(relPath)}`, rootPath);
  if (result.ok && result.stdout.trim()) {
    return result.stdout.trim().slice(0, 4000);
  }
  const staged = await runShellCommand(
    `git diff --cached -- ${JSON.stringify(relPath)}`,
    rootPath,
  );
  if (staged.ok && staged.stdout.trim()) {
    return staged.stdout.trim().slice(0, 4000);
  }
  return null;
}

async function executeWriteFile({ rootPath, mission, step }) {
  const operation = resolveWriteOperation(mission, step);
  if (!operation) {
    return {
      ok: false,
      stdout: "",
      stderr: `writeFile requires mission.intent.metadata.writeFiles entry for step ${step.id}`,
      durationMs: 0,
    };
  }

  const filePath = ensureRepoScopedPath(rootPath, operation.path);
  const relPath = relativeRepoPath(rootPath, filePath);
  const dirPath = path.dirname(filePath);
  await fs.mkdir(dirPath, { recursive: true });
  await fs.writeFile(filePath, operation.content, "utf8");

  const gitDiff = await getGitDiff(rootPath, relPath);
  const fallbackSnippet = [
    `--- /dev/null`,
    `+++ b/${relPath}`,
    `@@ -0,0 +1,${operation.content.split("\n").length} @@`,
    ...operation.content.split("\n").map((line) => `+${line}`),
  ].join("\n").slice(0, 4000);

  return {
    ok: true,
    stdout: `Wrote ${relPath} (${operation.content.length} bytes)`,
    stderr: "",
    durationMs: 0,
    artifact: {
      type: "file",
      label: `write:${relPath}`,
      contentSnippet: gitDiff ?? fallbackSnippet,
    },
  };
}

async function executePatchFile({ rootPath, mission, step }) {
  const operation = resolvePatchOperation(mission, step);
  if (!operation) {
    return {
      ok: false,
      stdout: "",
      stderr: `patchFile requires mission.intent.metadata.patches entry for step ${step.id}`,
      durationMs: 0,
    };
  }

  const filePath = ensureRepoScopedPath(rootPath, operation.path);
  const relPath = relativeRepoPath(rootPath, filePath);
  const original = await fs.readFile(filePath, "utf8");
  if (!original.includes(operation.find)) {
    return {
      ok: false,
      stdout: "",
      stderr: `Target snippet not found in ${operation.path}`,
      durationMs: 0,
    };
  }

  const updated = original.replace(operation.find, operation.replace);
  await fs.writeFile(filePath, updated, "utf8");

  const gitDiff = await getGitDiff(rootPath, relPath);
  const findLines = operation.find.split("\n");
  const replaceLines = operation.replace.split("\n");
  const fallbackSnippet = [
    `--- a/${relPath}`,
    `+++ b/${relPath}`,
    `@@ -1,${findLines.length} +1,${replaceLines.length} @@`,
    ...findLines.map((line) => `-${line}`),
    ...replaceLines.map((line) => `+${line}`),
  ].join("\n").slice(0, 4000);

  return {
    ok: true,
    stdout: `Patched ${relPath}`,
    stderr: "",
    durationMs: 0,
    artifact: {
      type: "patch",
      label: `patch:${relPath}`,
      contentSnippet: gitDiff ?? fallbackSnippet,
    },
  };
}

async function executeTool({ rootPath, step, mission }) {
  switch (step.tool) {
    case "listFiles":
      return executeListFiles({ rootPath });
    case "inspectEnv":
      return executeInspectEnv({ rootPath });
    case "gitStatus":
      return executeGitStatus({ rootPath });
    case "gitDiff":
      return executeGitDiff({ rootPath });
    case "readFile":
      return executeReadFile({ rootPath, step });
    case "searchCode":
      return executeSearchCode({ rootPath, step });
    case "installDependencies":
      return executeInstallDependencies({ rootPath });
    case "runCommand":
      return executeRunCommand({ rootPath, mission });
    case "writeFile":
      return executeWriteFile({ rootPath, mission, step });
    case "patchFile":
      return executePatchFile({ rootPath, mission, step });
    default:
      return null;
  }
}

function pushStepLog({
  logs,
  sessionId,
  step,
  action,
  inputSummary,
  outputSummary,
  status,
  durationMs,
}) {
  logs.push({
    id: randomUUID(),
    sessionId,
    stepId: step.id,
    timestamp: nowIso(),
    agent: step.agent,
    tool: step.tool,
    action,
    inputSummary,
    outputSummary,
    status,
    durationMs,
  });
}

export async function executeDeveloperRuntimeJob({
  queueRun,
  requestJson,
  postJson,
  logger,
  workerId,
}) {
  const detailEnvelope = await requestJson(`/v1/developer-runtime/sessions/${queueRun.sessionId}`, {
    method: "GET",
  }, { tenantId: queueRun.tenantId });

  const detail = detailEnvelope.data;
  if (!detail?.mission) {
    logger.warn({ sessionId: queueRun.sessionId }, "developer runtime session has no mission");
    return { skipped: true };
  }

  await postJson(`/v1/developer-runtime/sessions/${queueRun.sessionId}/worker/start`, {
    workerId,
    startedAt: nowIso(),
  }, { tenantId: queueRun.tenantId });

  const repoRoot = resolveRepoRoot();
  const cwd = ensureRepoScopedPath(repoRoot.pathname, queueRun.cwd ?? ".");
  const mission = structuredClone(detail.mission);
  const session = structuredClone(detail.session);
  const approvals = Array.isArray(detail.approvals) ? structuredClone(detail.approvals) : [];
  const logs = [];
  const validations = [];
  const artifacts = [];

  let hasFailure = false;

  for (const step of mission.plan) {
    const approvalState = getApprovalState(approvals, step.id);
    if (step.approvalRequired && approvalState !== "approved") {
      step.status = "failed";
      pushStepLog({
        logs,
        sessionId: session.id,
        step,
        action: "step.blocked",
        inputSummary: step.description,
        outputSummary: approvalState === "rejected"
          ? "Execution blocked because approval was rejected."
          : "Execution blocked because approval is missing.",
        status: "error",
      });
      hasFailure = true;
      break;
    }

    pushStepLog({
      logs,
      sessionId: session.id,
      step,
      action: "step.started",
      inputSummary: step.description,
      outputSummary: `Tool ${step.tool} assigned to ${step.agent}.`,
      status: "ok",
    });

    step.status = "running";

    const toolResult = await executeTool({ rootPath: cwd, step, mission });
    if (toolResult) {
      step.status = toolResult.ok ? "done" : "failed";
      pushStepLog({
        logs,
        sessionId: session.id,
        step,
        action: toolResult.ok ? "step.finished" : "step.failed",
        inputSummary: step.description,
        outputSummary: snippet(toolResult.stdout || toolResult.stderr || "No output captured."),
        status: toolResult.ok ? "ok" : "error",
        durationMs: toolResult.durationMs,
      });
      if (step.tool === "installDependencies") {
        artifacts.push({
          id: randomUUID(),
          sessionId: session.id,
          stepId: step.id,
          type: "report",
          label: "install-dependencies",
          contentSnippet: snippet(toolResult.stdout || toolResult.stderr || "No install output."),
          createdAt: nowIso(),
        });
      }
      if (toolResult.artifact) {
        artifacts.push({
          id: randomUUID(),
          sessionId: session.id,
          stepId: step.id,
          type: toolResult.artifact.type,
          label: toolResult.artifact.label,
          contentSnippet: toolResult.artifact.contentSnippet,
          createdAt: nowIso(),
        });
      }
      if (!toolResult.ok) {
        hasFailure = true;
        break;
      }
      continue;
    }

    const resolved = commandForStep(step);
    if (!resolved) {
      step.status = "skipped";
      pushStepLog({
        logs,
        sessionId: session.id,
        step,
        action: "step.skipped",
        inputSummary: step.description,
        outputSummary: `Tool ${step.tool} is not executable yet in worker phase 1.`,
        status: "warning",
      });
      continue;
    }

    const onChunk = (chunk) => {
      const progressLog = {
        id: randomUUID(),
        sessionId: session.id,
        stepId: step.id,
        timestamp: nowIso(),
        agent: step.agent,
        tool: step.tool,
        action: "step.progress",
        inputSummary: resolved.command,
        outputSummary: chunk.slice(0, 800),
        status: "ok",
      };
      postJson(`/v1/developer-runtime/sessions/${queueRun.sessionId}/worker/progress`, {
        log: progressLog,
      }, { tenantId: queueRun.tenantId }).catch(() => {});
    };

    const result = await runShellCommand(resolved.command, cwd, onChunk);
    step.status = result.ok ? "done" : "failed";
    pushStepLog({
      logs,
      sessionId: session.id,
      step,
      action: result.ok ? "step.finished" : "step.failed",
      inputSummary: resolved.command,
      outputSummary: snippet(result.ok ? (result.stdout || "Command finished successfully.") : (result.stderr || "Command failed.")),
      status: result.ok ? "ok" : "error",
      durationMs: result.durationMs,
    });
    validations.push(...buildValidationResults({
      sessionId: session.id,
      stepId: step.id,
      validationName: resolved.validationName,
      result,
    }));
    artifacts.push(...buildValidationArtifacts({
      sessionId: session.id,
      stepId: step.id,
      validationName: resolved.validationName,
      result,
    }));

    if (!result.ok) {
      hasFailure = true;
      break;
    }
  }

  session.state = hasFailure ? "failed" : "completed";
  session.summary = hasFailure ? "Mission failed during worker execution." : "Mission completed by worker.";
  session.endedAt = nowIso();
  mission.status = hasFailure ? "failed" : "completed";

  if (hasFailure) {
    await postJson(`/v1/developer-runtime/sessions/${queueRun.sessionId}/worker/fail`, {
      workerId,
      error: "Worker execution failed on one or more steps.",
      session,
      mission,
      logs,
      validations,
      artifacts,
    }, { tenantId: queueRun.tenantId });
    return { failed: true };
  }

  await postJson(`/v1/developer-runtime/sessions/${queueRun.sessionId}/worker/complete`, {
    workerId,
    session,
    mission,
    logs,
    validations,
    artifacts,
  }, { tenantId: queueRun.tenantId });

  return { completed: true };
}
