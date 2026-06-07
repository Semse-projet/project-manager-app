import { Injectable } from "@nestjs/common";
import { spawnSync } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { operatorContextFromIdentity } from "@semse/auth";
import { resolveAutonomyLlmStatus, runAutonomyTask } from "@semse/autonomy";
import { buildWorkspaceMemoryId, type WorkspaceMemoryRecord } from "@semse/knowledge";
import type { AutonomyLlmStatusView, AutonomyRunListView, AutonomyRunView, AutonomyTargetStage } from "@semse/schemas";

type ResumableAutonomyTaskPlan = {
  task: string;
  branchName: string;
  filePath: string;
  content: string;
  commitMessage: string;
  prTitle: string;
  prBody: string;
  summary: string;
};
import { WorkspaceMemoryRepository } from "../knowledge/workspace-memory.repository.js";
import { AutonomyRepository } from "./autonomy.repository.js";

const STAGE_ORDER: AutonomyTargetStage[] = ["branch", "change", "commit", "push", "pr"];
const STAGE_MESSAGE_MAP: Record<AutonomyTargetStage, string> = {
  branch: "branch_created",
  change: "change_applied",
  commit: "commit_created",
  push: "branch_pushed",
  pr: "pr_created"
};

function boolFromEnv(value: string | undefined): boolean {
  return value?.trim().toLowerCase() === "true";
}

function isAutonomyTaskPlan(value: unknown): value is ResumableAutonomyTaskPlan {
  if (!value || typeof value !== "object") {
    return false;
  }

  const candidate = value as Record<string, unknown>;
  return [
    "branchName",
    "filePath",
    "content",
    "commitMessage",
    "prTitle",
    "prBody",
    "summary"
  ].every((key) => typeof candidate[key] === "string");
}

@Injectable()
export class AutonomyService {
  constructor(
    private readonly repository: AutonomyRepository,
    private readonly workspaceMemoryRepository: WorkspaceMemoryRepository
  ) {}

  async list(input: { tenantId: string }): Promise<AutonomyRunListView> {
    const items = await this.repository.list(input);
    return { items: await Promise.all(items.map((item) => this.enrichRun(item, false))) };
  }

  async detail(input: { tenantId: string; runId: string }): Promise<AutonomyRunView> {
    const run = await this.repository.detail(input);
    return this.enrichRun(run, true);
  }

  providerStatus(): AutonomyLlmStatusView {
    return resolveAutonomyLlmStatus({
      llmProvider: process.env.SEMSE_AUTONOMY_LLM_PROVIDER,
      llmApiKey: process.env.SEMSE_AUTONOMY_LLM_API_KEY,
      llmModel: process.env.SEMSE_AUTONOMY_LLM_MODEL,
      llmBaseUrl: process.env.SEMSE_AUTONOMY_LLM_BASE_URL,
      openAiApiKey: process.env.SEMSE_AUTONOMY_OPENAI_API_KEY ?? process.env.OPENAI_API_KEY,
      openAiModel: process.env.SEMSE_AUTONOMY_OPENAI_MODEL ?? process.env.OPENAI_MODEL,
      openAiBaseUrl: process.env.SEMSE_AUTONOMY_OPENAI_BASE_URL ?? process.env.OPENAI_BASE_URL
    });
  }

  async run(input: {
    tenantId: string;
    orgId: string;
    userId: string;
    roles: string[];
    task: string;
    baseBranch?: string;
    targetStage?: AutonomyTargetStage;
    workspaceId?: string;
    repoId?: string;
    taskId?: string;
  }): Promise<AutonomyRunView> {
    const repoPath = this.resolveRepoPath();
    this.ensureDemoRepo(repoPath);
    const baseBranch = input.baseBranch ?? process.env.SEMSE_AUTONOMY_BASE_BRANCH?.trim() ?? "main";
    const targetStage = input.targetStage ?? "pr";
    const operatorContext = operatorContextFromIdentity(
      {
        userId: input.userId,
        tenantId: input.tenantId,
        orgId: input.orgId,
        roles: input.roles
      },
      {
        source: "user_session",
        operatorId: input.userId,
        scope: input.taskId ? "task" : input.repoId ? "repo" : input.workspaceId ? "workspace" : "global",
        workspaceId: input.workspaceId,
        repoId: input.repoId,
        taskId: input.taskId
      }
    );

    const pending = await this.repository.createPending({
      tenantId: input.tenantId,
      orgId: input.orgId,
      userId: input.userId,
      task: input.task,
      repoPath,
      baseBranch
    });

    try {
      const result = await runAutonomyTask(input.task, {
        repoPath,
        baseBranch,
        targetStage,
        operatorContext,
        localPrMode: this.resolveLocalPrMode(),
        githubToken: process.env.SEMSE_AUTONOMY_GITHUB_TOKEN ?? process.env.GITHUB_TOKEN,
        repoName: process.env.SEMSE_AUTONOMY_REPO_NAME ?? process.env.REPO_NAME,
        githubApiBaseUrl: process.env.GITHUB_API_BASE_URL,
        llmProvider: process.env.SEMSE_AUTONOMY_LLM_PROVIDER,
        llmApiKey: process.env.SEMSE_AUTONOMY_LLM_API_KEY,
        llmModel: process.env.SEMSE_AUTONOMY_LLM_MODEL,
        llmBaseUrl: process.env.SEMSE_AUTONOMY_LLM_BASE_URL,
        openAiApiKey: process.env.SEMSE_AUTONOMY_OPENAI_API_KEY ?? process.env.OPENAI_API_KEY,
        openAiModel: process.env.SEMSE_AUTONOMY_OPENAI_MODEL ?? process.env.OPENAI_MODEL,
        openAiBaseUrl: process.env.SEMSE_AUTONOMY_OPENAI_BASE_URL ?? process.env.OPENAI_BASE_URL
      });

      const completed = await this.repository.complete({
        id: pending.id,
        branchName: result.branchName,
        commitSha: result.commitSha,
        generatedFile: result.generatedFile,
        prUrl: result.pr?.html_url ?? null,
        prState: result.pr?.state ?? null,
        logs: result.logs
      });

      await this.recordRunSummary({
        operatorId: operatorContext.operatorId,
        tenantId: input.tenantId,
        orgId: input.orgId,
        workspaceId: operatorContext.workspaceId,
        repoId: operatorContext.repoId,
        runId: completed.id,
        taskId: operatorContext.taskId,
        task: input.task,
        targetStage,
        branchName: completed.branchName,
        commitSha: completed.commitSha,
        prUrl: completed.prUrl,
        status: "completed",
        summary: `Autonomy run completed until '${targetStage}' for '${input.task}'`
      });

      return this.enrichRun(completed, true);
    } catch (error) {
      const failed = await this.repository.fail({
        id: pending.id,
        error: error instanceof Error ? error.message : "Unknown autonomy error",
        logs: [
          {
            level: "error",
            message: "run_failed",
            timestamp: new Date().toISOString(),
            data: {
              error: error instanceof Error ? error.message : String(error),
              targetStage
            }
          }
        ]
      });

      await this.recordRunSummary({
        operatorId: operatorContext.operatorId,
        tenantId: input.tenantId,
        orgId: input.orgId,
        workspaceId: operatorContext.workspaceId,
        repoId: operatorContext.repoId,
        runId: failed.id,
        taskId: operatorContext.taskId,
        task: input.task,
        targetStage,
        status: "failed",
        summary: `Autonomy run failed before '${targetStage}' for '${input.task}': ${failed.error ?? "unknown error"}`
      });

      return this.enrichRun(failed, true);
    }
  }

  async continueRun(input: {
    tenantId: string;
    orgId: string;
    userId: string;
    roles: string[];
    runId: string;
    targetStage?: AutonomyTargetStage;
  }): Promise<AutonomyRunView> {
    const run = await this.repository.detail({ tenantId: input.tenantId, runId: input.runId });
    const currentStage = this.resolveCurrentStage(run);
    if (currentStage === "pr") {
      throw new Error(`Autonomy run ${input.runId} already reached PR stage`);
    }

    const targetStage = input.targetStage ?? this.resolveNextStage(currentStage);
    const taskPlan = this.extractTaskPlan(run);
    const operatorContext = operatorContextFromIdentity(
      {
        userId: input.userId,
        tenantId: input.tenantId,
        orgId: input.orgId,
        roles: input.roles
      },
      {
        source: "user_session",
        operatorId: input.userId,
        scope: "global"
      }
    );

    const result = await runAutonomyTask(run.task, {
      repoPath: run.repoPath,
      baseBranch: run.baseBranch,
      targetStage,
      resumeState: {
        currentStage,
        branchName: run.branchName,
        commitSha: run.commitSha,
        generatedFile: run.generatedFile,
        existingLogs: run.logs as Array<{
          level: "info" | "warn" | "error";
          message: string;
          timestamp: string;
          data?: Record<string, unknown>;
        }>,
        plan: taskPlan
      },
      operatorContext,
      localPrMode: this.resolveLocalPrMode(),
      githubToken: process.env.SEMSE_AUTONOMY_GITHUB_TOKEN ?? process.env.GITHUB_TOKEN,
      repoName: process.env.SEMSE_AUTONOMY_REPO_NAME ?? process.env.REPO_NAME,
      githubApiBaseUrl: process.env.GITHUB_API_BASE_URL,
      llmProvider: process.env.SEMSE_AUTONOMY_LLM_PROVIDER,
      llmApiKey: process.env.SEMSE_AUTONOMY_LLM_API_KEY,
      llmModel: process.env.SEMSE_AUTONOMY_LLM_MODEL,
      llmBaseUrl: process.env.SEMSE_AUTONOMY_LLM_BASE_URL,
      openAiApiKey: process.env.SEMSE_AUTONOMY_OPENAI_API_KEY ?? process.env.OPENAI_API_KEY,
      openAiModel: process.env.SEMSE_AUTONOMY_OPENAI_MODEL ?? process.env.OPENAI_MODEL,
      openAiBaseUrl: process.env.SEMSE_AUTONOMY_OPENAI_BASE_URL ?? process.env.OPENAI_BASE_URL
    });

    const updated = await this.repository.complete({
      id: run.id,
      branchName: result.branchName,
      commitSha: result.commitSha,
      generatedFile: result.generatedFile,
      prUrl: result.pr?.html_url ?? run.prUrl,
      prState: result.pr?.state ?? run.prState,
      logs: result.logs
    });

    return this.enrichRun(updated, true);
  }

  private extractTaskPlan(run: AutonomyRunView): ResumableAutonomyTaskPlan {
    const payload = [...run.logs]
      .reverse()
      .find((entry) => entry.message === "task_plan_resolved")?.data;

    if (!isAutonomyTaskPlan(payload)) {
      throw new Error(`Autonomy run ${run.id} does not contain a resumable task plan yet`);
    }

    const taskPlan = payload;

    return {
      task: run.task,
      branchName: taskPlan.branchName,
      filePath: taskPlan.filePath,
      content: taskPlan.content,
      commitMessage: taskPlan.commitMessage,
      prTitle: taskPlan.prTitle,
      prBody: taskPlan.prBody,
      summary: taskPlan.summary
    };
  }

  private resolveCurrentStage(run: AutonomyRunView): AutonomyTargetStage {
    return this.resolveReachedStage(run) ?? "branch";
  }

  private resolveReachedStage(run: Pick<AutonomyRunView, "logs">): AutonomyTargetStage | null {
    let current: AutonomyTargetStage | null = null;
    for (const stage of STAGE_ORDER) {
      if (run.logs.some((entry) => entry.message === STAGE_MESSAGE_MAP[stage])) {
        current = stage;
      }
    }
    return current;
  }

  private resolveRequestedTargetStage(run: Pick<AutonomyRunView, "logs">): AutonomyTargetStage | null {
    const targetStage = [...run.logs]
      .reverse()
      .find((entry) => entry.message === "target_stage_reached" || entry.message === "run_target_stage")?.data?.targetStage;

    return typeof targetStage === "string" && STAGE_ORDER.includes(targetStage as AutonomyTargetStage)
      ? (targetStage as AutonomyTargetStage)
      : null;
  }

  private resolveNextStage(stage: AutonomyTargetStage): AutonomyTargetStage {
    const index = STAGE_ORDER.indexOf(stage);
    return STAGE_ORDER[Math.min(index + 1, STAGE_ORDER.length - 1)] ?? "pr";
  }

  private buildStageSummary(run: AutonomyRunView) {
    const currentStage = this.resolveReachedStage(run);
    const targetStage = this.resolveRequestedTargetStage(run);
    const nextStage = currentStage ? (currentStage === "pr" ? null : this.resolveNextStage(currentStage)) : "branch";
    const completedStageCount = STAGE_ORDER.filter((stage) => run.logs.some((entry) => entry.message === STAGE_MESSAGE_MAP[stage])).length;

    return {
      currentStage,
      targetStage,
      nextStage,
      completedStageCount
    };
  }

  private async enrichRun(run: AutonomyRunView, includeGeneratedContent: boolean): Promise<AutonomyRunView> {
    const stageSummary = this.buildStageSummary(run);

    if (!includeGeneratedContent || !run.generatedFile) {
      return {
        ...run,
        ...stageSummary
      };
    }

    try {
      const generatedContent = await readFile(run.generatedFile, "utf8");
      return {
        ...run,
        ...stageSummary,
        generatedContent
      };
    } catch {
      return {
        ...run,
        ...stageSummary,
        generatedContent: null
      };
    }
  }

  private resolveRepoPath(): string {
    return process.env.SEMSE_AUTONOMY_REPO_PATH?.trim() || "/tmp/semse-demo-repo";
  }

  private resolveLocalPrMode(): boolean {
    if (process.env.SEMSE_AUTONOMY_LOCAL_PR_MODE) {
      return boolFromEnv(process.env.SEMSE_AUTONOMY_LOCAL_PR_MODE);
    }
    const hasGitHub = !!((process.env.SEMSE_AUTONOMY_GITHUB_TOKEN ?? process.env.GITHUB_TOKEN) && (process.env.SEMSE_AUTONOMY_REPO_NAME ?? process.env.REPO_NAME));
    return !hasGitHub && process.env.NODE_ENV !== "production";
  }

  private ensureDemoRepo(repoPath: string): void {
    if (repoPath !== "/tmp/semse-demo-repo") {
      return;
    }

    const marker = join(repoPath, ".git");
    const existing = spawnSync("test", ["-d", marker]);
    if (existing.status === 0) {
      return;
    }

    const remotePath = "/tmp/semse-demo-remote.git";
    spawnSync("rm", ["-rf", repoPath, remotePath]);
    mkdirSync(repoPath, { recursive: true });
    spawnSync("git", ["init", "--bare", remotePath], { stdio: "ignore" });
    spawnSync("git", ["init", repoPath], { stdio: "ignore" });
    spawnSync("git", ["-C", repoPath, "config", "user.email", "semse@example.com"]);
    spawnSync("git", ["-C", repoPath, "config", "user.name", "SEMSE"]);
    writeFileSync(join(repoPath, "README.md"), "# SEMSE Demo Repo\n", "utf8");
    spawnSync("git", ["-C", repoPath, "add", "."]);
    spawnSync("git", ["-C", repoPath, "commit", "-m", "init"], { stdio: "ignore" });
    spawnSync("git", ["-C", repoPath, "branch", "-M", "main"]);
    spawnSync("git", ["-C", repoPath, "remote", "add", "origin", remotePath]);
    spawnSync("git", ["-C", repoPath, "push", "-u", "origin", "main"], { stdio: "ignore" });
  }

  private async recordRunSummary(input: {
    operatorId: string;
    tenantId: string;
    orgId: string;
    workspaceId?: string;
    repoId?: string;
    runId: string;
    taskId?: string;
    task: string;
    targetStage: AutonomyTargetStage;
    branchName?: string | null;
    commitSha?: string | null;
    prUrl?: string | null;
    status: "completed" | "failed";
    summary: string;
  }): Promise<void> {
    if (!input.workspaceId) {
      return;
    }

    const timestamp = new Date().toISOString();
    const record: WorkspaceMemoryRecord = {
      id: buildWorkspaceMemoryId({
        workspaceId: input.workspaceId,
        kind: "run_summary",
        slug: input.runId.replace(/[^a-zA-Z0-9_-]/g, "-")
      }),
      tenantId: input.tenantId,
      orgId: input.orgId,
      createdBy: input.operatorId,
      workspaceId: input.workspaceId,
      repoId: input.repoId,
      runId: input.runId,
      taskId: input.taskId,
      kind: "run_summary",
      scope: input.taskId ? "task" : input.repoId ? "repo" : "workspace",
      title: `Autonomy run ${input.status}: ${input.runId}`,
      summary: input.summary,
      body: [
        `Task: ${input.task}`,
        `Target stage: ${input.targetStage}`,
        input.branchName ? `Branch: ${input.branchName}` : null,
        input.commitSha ? `Commit: ${input.commitSha}` : null,
        input.prUrl ? `PR: ${input.prUrl}` : null
      ]
        .filter(Boolean)
        .join("\n"),
      tags: ["autonomy", "run-summary", input.status, `target-stage:${input.targetStage}`],
      sourceRef: input.prUrl ?? undefined,
      updatedAtIso: timestamp
    };

    await this.workspaceMemoryRepository.append(record);
  }
}
