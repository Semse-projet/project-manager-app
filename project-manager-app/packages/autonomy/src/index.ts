import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { AutonomyLogger } from "./logger.js";
import type {
  AutonomyLlmStatus,
  AutonomyRunOptions,
  AutonomyRunResult,
  AutonomyTargetStage,
  AutonomyTaskPlan
} from "./types.js";
import { currentBranch, detectBaseBranch, ensureCleanRepo, runGit } from "./git.js";
import { generateTaskPlan } from "./generator.js";
import { assertRepoPath } from "./validator.js";

const STAGE_ORDER: AutonomyTargetStage[] = ["branch", "change", "commit", "push", "pr"];

function trimToUndefined(value: string | undefined): string | undefined {
  const trimmed = value?.trim();
  return trimmed ? trimmed : undefined;
}

function shouldStopAt(targetStage: AutonomyTargetStage, currentStage: AutonomyTargetStage) {
  return targetStage === currentStage;
}

function ensureBranchContext(repoPath: string, branchName: string, allowDirty = false) {
  if (!allowDirty) {
    ensureCleanRepo(repoPath);
  }
  const branch = currentBranch(repoPath);
  if (branch !== branchName) {
    if (allowDirty) {
      throw new Error(`Repository must stay on branch ${branchName} to resume a dirty change stage; current branch is ${branch}`);
    }
    runGit(repoPath, ["checkout", branchName]);
  }
}

async function resolvePlan(task: string, options: AutonomyRunOptions): Promise<AutonomyTaskPlan> {
  if (options.resumeState) {
    return options.resumeState.plan;
  }

  return generateTaskPlan({
    task,
    llmApiKey: options.llmApiKey,
    llmModel: options.llmModel,
    llmBaseUrl: options.llmBaseUrl,
    openAiApiKey: options.openAiApiKey,
    openAiModel: options.openAiModel,
    openAiBaseUrl: options.openAiBaseUrl
  });
}

export function resolveAutonomyLlmStatus(options: {
  llmProvider?: string;
  llmApiKey?: string;
  llmModel?: string;
  llmBaseUrl?: string;
  openAiApiKey?: string;
  openAiModel?: string;
  openAiBaseUrl?: string;
}): AutonomyLlmStatus {
  const baseUrl = trimToUndefined(options.llmBaseUrl) ?? trimToUndefined(options.openAiBaseUrl) ?? null;
  const model = trimToUndefined(options.llmModel) ?? trimToUndefined(options.openAiModel) ?? null;
  const apiKey = trimToUndefined(options.llmApiKey) ?? trimToUndefined(options.openAiApiKey);
  const provider =
    trimToUndefined(options.llmProvider) ??
    (baseUrl?.includes("11434") || baseUrl?.includes("ollama") ? "ollama" : "openai-compatible");

  return {
    provider,
    model,
    baseUrl,
    configured: Boolean(model && baseUrl),
    apiKeyConfigured: Boolean(apiKey)
  };
}

async function createPullRequest(input: {
  localPrMode?: boolean;
  githubToken?: string;
  repoName?: string;
  githubApiBaseUrl?: string;
  prTitle: string;
  prBody: string;
  branchName: string;
  baseBranch: string;
}) {
  if (input.localPrMode) {
    return {
      html_url: `semse://local-pr/${input.branchName}`,
      state: "open",
      title: input.prTitle
    };
  }

  if (!input.githubToken || !input.repoName) {
    throw new Error("GitHub PR creation is not configured");
  }

  const response = await fetch(`${input.githubApiBaseUrl ?? "https://api.github.com"}/repos/${input.repoName}/pulls`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${input.githubToken}`,
      accept: "application/vnd.github+json"
    },
    body: JSON.stringify({
      title: input.prTitle,
      body: input.prBody,
      head: input.branchName,
      base: input.baseBranch
    })
  });

  if (!response.ok) {
    throw new Error(`PR creation failed: ${response.status} ${await response.text()}`);
  }

  return (await response.json()) as {
    html_url: string;
    state: string;
    title?: string;
  };
}

export async function runAutonomyTask(task: string, options: AutonomyRunOptions): Promise<AutonomyRunResult> {
  assertRepoPath(options.repoPath);
  const logger = new AutonomyLogger(undefined, options.resumeState?.existingLogs ?? []);
  const baseBranch = options.baseBranch ?? detectBaseBranch(options.repoPath);
  const targetStage = options.targetStage ?? "pr";
  const llmStatus = resolveAutonomyLlmStatus(options);
  const plan = await resolvePlan(task, options);

  logger.info("task_received", { task, repoPath: options.repoPath, baseBranch });
  logger.info("llm_target_resolved", {
    provider: llmStatus.provider,
    model: llmStatus.model,
    baseUrl: llmStatus.baseUrl,
    configured: llmStatus.configured,
    apiKeyConfigured: llmStatus.apiKeyConfigured
  });
  logger.info("run_target_stage", { targetStage });
  if (options.operatorContext) {
    logger.info("operator_context_resolved", {
      source: options.operatorContext.source,
      scope: options.operatorContext.scope,
      operatorId: options.operatorContext.operatorId,
      workspaceId: options.operatorContext.workspaceId,
      repoId: options.operatorContext.repoId,
      taskId: options.operatorContext.taskId
    });
  }

  let branchName = options.resumeState?.branchName ?? plan.branchName;
  let generatedFile = options.resumeState?.generatedFile ?? null;
  let commitSha = options.resumeState?.commitSha ?? null;
  let pr: AutonomyRunResult["pr"] = null;

  if (!options.resumeState) {
    ensureCleanRepo(options.repoPath);
    runGit(options.repoPath, ["checkout", baseBranch]);
    logger.info("task_parsed", { branchName: plan.branchName, filePath: plan.filePath });
    logger.info("task_plan_resolved", {
      branchName: plan.branchName,
      filePath: plan.filePath,
      content: plan.content,
      commitMessage: plan.commitMessage,
      prTitle: plan.prTitle,
      prBody: plan.prBody,
      summary: plan.summary
    });

    try {
      runGit(options.repoPath, ["checkout", "-b", branchName]);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      if (!message.includes("already exists")) {
        throw error;
      }
      branchName = `${plan.branchName}-${Date.now().toString(36)}`;
      logger.warn("branch_name_collision", { requested: plan.branchName, fallback: branchName });
      runGit(options.repoPath, ["checkout", "-b", branchName]);
    }
    logger.info("branch_created", { branchName });
    if (shouldStopAt(targetStage, "branch")) {
      logger.info("target_stage_reached", { targetStage, branchName });
      return { runId: logger.runId, task, targetStage, branchName, commitSha, generatedFile, pr, logs: logger.snapshot() };
    }
  } else {
    logger.info("run_continued", {
      fromStage: options.resumeState.currentStage,
      targetStage,
      branchName,
      generatedFile,
      commitSha
    });
    logger.info("task_plan_rehydrated", {
      branchName: plan.branchName,
      filePath: plan.filePath,
      commitMessage: plan.commitMessage,
      prTitle: plan.prTitle
    });
    const currentStageIndex = STAGE_ORDER.indexOf(options.resumeState.currentStage);
    const targetStageIndex = STAGE_ORDER.indexOf(targetStage);
    if (targetStageIndex <= currentStageIndex) {
      throw new Error(`Target stage ${targetStage} must be after current stage ${options.resumeState.currentStage}`);
    }

    if (options.resumeState.currentStage === "branch") {
      ensureBranchContext(options.repoPath, branchName, false);
    } else if (options.resumeState.currentStage === "change") {
      ensureBranchContext(options.repoPath, branchName, true);
    } else {
      ensureBranchContext(options.repoPath, branchName, false);
    }
  }

  const target = join(options.repoPath, plan.filePath);
  if (!options.resumeState || options.resumeState.currentStage === "branch") {
    mkdirSync(dirname(target), { recursive: true });
    writeFileSync(target, plan.content, "utf8");
    generatedFile = target;
    logger.info("change_applied", { file: target });
    if (shouldStopAt(targetStage, "change")) {
      logger.info("target_stage_reached", { targetStage, generatedFile: target });
      return { runId: logger.runId, task, targetStage, branchName, commitSha, generatedFile, pr, logs: logger.snapshot() };
    }
  }

  if (!options.resumeState || options.resumeState.currentStage === "branch" || options.resumeState.currentStage === "change") {
    runGit(options.repoPath, ["add", "."]);
    logger.info("changes_staged", { fileName: plan.filePath.split("/").pop() });
    runGit(options.repoPath, ["commit", "-m", plan.commitMessage]);
    commitSha = runGit(options.repoPath, ["rev-parse", "HEAD"]);
    logger.info("commit_created", { commitSha });
    if (shouldStopAt(targetStage, "commit")) {
      logger.info("target_stage_reached", { targetStage, commitSha });
      return { runId: logger.runId, task, targetStage, branchName, commitSha, generatedFile, pr, logs: logger.snapshot() };
    }
  }

  if (!options.resumeState || ["branch", "change", "commit"].includes(options.resumeState.currentStage)) {
    runGit(options.repoPath, ["push", "-u", "origin", branchName]);
    logger.info("branch_pushed", { branchName });
    if (shouldStopAt(targetStage, "push")) {
      logger.info("target_stage_reached", { targetStage, branchName });
      return { runId: logger.runId, task, targetStage, branchName, commitSha, generatedFile, pr, logs: logger.snapshot() };
    }
  }

  pr = await createPullRequest({
    localPrMode: options.localPrMode,
    githubToken: options.githubToken,
    repoName: options.repoName,
    githubApiBaseUrl: options.githubApiBaseUrl,
    prTitle: plan.prTitle,
    prBody: plan.prBody,
    branchName,
    baseBranch
  });
  logger.info("pr_created", { prUrl: pr.html_url, state: pr.state });
  logger.info("target_stage_reached", { targetStage, prUrl: pr.html_url });

  return {
    runId: logger.runId,
    task,
    targetStage,
    branchName,
    commitSha,
    generatedFile,
    pr,
    logs: logger.snapshot()
  };
}

export type { AutonomyRunLogEntry, AutonomyRunOptions, AutonomyRunResult, AutonomyTargetStage, AutonomyTaskPlan } from "./types.js";

// ── SPEC-AUT-001 — Permanent Loops v1 ────────────────────────────────────────
export type {
  PermanentLoopDefinition,
  PermanentLoopBudget,
  PermanentLoopStopCriteria,
  LoopFinding,
  LoopFindingKind,
  LoopCycleReport,
  LoopCycleStatus,
  LoopAuditEvent,
  LoopSuppressedFinding,
  LoopControlPort,
  LoopDecisionMemoryPort,
  LoopAnalyzer,
  LoopAnalyzerContext
} from "./loops/loop-types.js";
export {
  AUTONOMY_LOOPS_QUEUE,
  permanentLoops,
  dedupAbstractionsLoop,
  specDriftLoop,
  getLoopDefinition
} from "./loops/loop-definitions.js";
export { runPermanentLoopCycle, type LoopRunnerDeps } from "./loops/loop-runner.js";
export { buildExportInventory, findDuplicateCandidates, analyzeDedupAbstractions, type ExportRecord } from "./loops/dedup-loop.js";
export { analyzeSpecDrift, buildSpecHealthReport, parseSpecMetadata } from "./loops/spec-drift-loop.js";

// ── Browser agent (misiones stateful + adapters de engine) ──────────────────
export { BrowserSessionPool, type ActiveSession } from "./browser/session-pool.js";
export { BrowserToolRunner } from "./browser/browser-tool-runner.js";
export { EngineRouter } from "./browser/engine-router.js";
export { PlaywrightAdapter } from "./browser/playwright-adapter.js";
export { ObscuraAdapter } from "./browser/obscura-adapter.js";
export { SecureNetworkGateway } from "./browser/secure-network-gateway.js";
export { SessionManager } from "./browser/session-manager.js";
export type {
  BrowserEngineAdapter,
  BrowserInspectionOptions,
  BrowserInspectionResult,
} from "./browser/browser-engine.interface.js";
