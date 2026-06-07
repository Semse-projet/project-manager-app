import { z } from "zod";

export const autonomyTargetStageSchema = z.enum(["branch", "change", "commit", "push", "pr"]);

export const createAutonomyRunSchema = z.object({
  task: z.string().min(3).max(300),
  baseBranch: z.string().min(1).max(120).optional(),
  targetStage: autonomyTargetStageSchema.optional(),
  workspaceId: z.string().min(1).max(120).optional(),
  repoId: z.string().min(1).max(200).optional(),
  taskId: z.string().min(1).max(200).optional()
});

export const continueAutonomyRunSchema = z.object({
  targetStage: autonomyTargetStageSchema.optional()
});

export const autonomyRunIdParamSchema = z.object({
  runId: z.string().min(1)
});

export type AutonomyTargetStage = z.infer<typeof autonomyTargetStageSchema>;

export type AutonomyRunView = {
  id: string;
  tenantId: string;
  orgId: string;
  userId: string;
  task: string;
  status: "RUNNING" | "COMPLETED" | "FAILED";
  repoPath: string;
  baseBranch: string;
  branchName: string | null;
  commitSha: string | null;
  generatedFile: string | null;
  generatedContent: string | null;
  prUrl: string | null;
  prState: string | null;
  error: string | null;
  currentStage: AutonomyTargetStage | null;
  targetStage: AutonomyTargetStage | null;
  nextStage: AutonomyTargetStage | null;
  completedStageCount: number;
  logs: Array<{
    level: string;
    message: string;
    timestamp: string;
    data?: Record<string, unknown>;
  }>;
  createdAt: string;
  updatedAt: string;
};

export type AutonomyRunListView = {
  items: AutonomyRunView[];
};

export type AutonomyLlmStatusView = {
  provider: string;
  model: string | null;
  baseUrl: string | null;
  configured: boolean;
  apiKeyConfigured: boolean;
};
