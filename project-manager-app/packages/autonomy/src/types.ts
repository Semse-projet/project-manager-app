import type { OperatorContext } from "@semse/shared";

export type AutonomyTargetStage = "branch" | "change" | "commit" | "push" | "pr";

export interface AutonomyTaskPlan {
  task: string;
  branchName: string;
  filePath: string;
  content: string;
  commitMessage: string;
  prTitle: string;
  prBody: string;
  summary: string;
}

export interface AutonomyRunLogEntry {
  level: "info" | "warn" | "error";
  message: string;
  timestamp: string;
  data?: Record<string, unknown>;
}

export interface AutonomyResumeState {
  currentStage: AutonomyTargetStage;
  branchName: string | null;
  commitSha: string | null;
  generatedFile: string | null;
  existingLogs: AutonomyRunLogEntry[];
  plan: AutonomyTaskPlan;
}

export interface AutonomyRunResult {
  runId: string;
  task: string;
  targetStage: AutonomyTargetStage;
  branchName: string | null;
  commitSha: string | null;
  generatedFile: string | null;
  pr: {
    html_url: string;
    state: string;
    number?: number;
    title?: string;
  } | null;
  logs: AutonomyRunLogEntry[];
}

export interface AutonomyRunOptions {
  repoPath: string;
  baseBranch?: string;
  targetStage?: AutonomyTargetStage;
  resumeState?: AutonomyResumeState;
  operatorContext?: OperatorContext;
  localPrMode?: boolean;
  githubToken?: string;
  repoName?: string;
  githubApiBaseUrl?: string;
  llmProvider?: string;
  llmApiKey?: string;
  llmModel?: string;
  llmBaseUrl?: string;
  openAiApiKey?: string;
  openAiModel?: string;
  openAiBaseUrl?: string;
}

export interface AutonomyLlmStatus {
  provider: string;
  model: string | null;
  baseUrl: string | null;
  configured: boolean;
  apiKeyConfigured: boolean;
}
