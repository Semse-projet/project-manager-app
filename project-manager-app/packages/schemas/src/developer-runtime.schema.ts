import { z } from "zod";

export const developerRuntimeTaskCategorySchema = z.enum([
  "bootstrap",
  "diagnostic",
  "bugfix",
  "refactor",
  "generate",
  "validate",
  "deploy",
  "document",
]);

export const developerRuntimeRiskLevelSchema = z.enum([
  "low",
  "medium",
  "high",
  "critical",
]);

export const developerRuntimeExecutionStateSchema = z.enum([
  "idle",
  "interpreting",
  "planning",
  "awaiting_approval",
  "executing",
  "validating",
  "summarizing",
  "completed",
  "failed",
  "blocked",
]);

export const developerRuntimeStepStatusSchema = z.enum([
  "pending",
  "running",
  "done",
  "failed",
  "skipped",
]);

export const developerRuntimeMissionStatusSchema = z.enum([
  "draft",
  "approved",
  "running",
  "completed",
  "failed",
  "blocked",
]);

export const developerRuntimeLogStatusSchema = z.enum([
  "ok",
  "warning",
  "error",
]);

export const developerRuntimeValidationStatusSchema = z.enum([
  "passed",
  "failed",
  "skipped",
]);

export const developerRuntimeArtifactTypeSchema = z.enum([
  "command_output",
  "diff",
  "file",
  "report",
  "validation",
  "preview",
  "patch",
]);

export const developerRuntimeAutonomyLevelSchema = z.enum([
  "observation",
  "suggestion",
  "safe-execution",
  "supervised-execution",
  "controlled-autonomy",
]);

export const developerRuntimeToolNameSchema = z.enum([
  "runCommand",
  "readFile",
  "writeFile",
  "patchFile",
  "listFiles",
  "searchCode",
  "runBuild",
  "runLint",
  "runTests",
  "gitStatus",
  "gitDiff",
  "installDependencies",
  "inspectEnv",
  "requestApproval",
]);

export const developerRuntimeProviderCapabilitySchema = z.enum([
  "reasoning",
  "code_generation",
  "code_editing",
  "retrieval",
  "embedding",
  "vision",
  "classification",
]);

export const developerRuntimeWriteFileOperationSchema = z.object({
  stepId: z.string().min(1).optional(),
  path: z.string().min(1),
  content: z.string(),
});

export const developerRuntimePatchFileOperationSchema = z.object({
  stepId: z.string().min(1).optional(),
  path: z.string().min(1),
  find: z.string().min(1),
  replace: z.string(),
});

export const developerRuntimeIntentMetadataSchema = z.object({
  command: z.string().min(1).optional(),
  commandTemplate: z.string().min(1).optional(),
  commandArgs: z.array(z.string()).optional(),
  writeFiles: z.array(developerRuntimeWriteFileOperationSchema).optional(),
  patches: z.array(developerRuntimePatchFileOperationSchema).optional(),
}).passthrough();

export const developerRuntimeIntentTaskSchema = z.object({
  id: z.string().min(1),
  goal: z.string().min(1),
  category: developerRuntimeTaskCategorySchema,
  confidence: z.number().min(0).max(1),
  riskLevel: developerRuntimeRiskLevelSchema,
  requiresApproval: z.boolean(),
  repoId: z.string().min(1),
  branch: z.string().trim().optional(),
  metadata: developerRuntimeIntentMetadataSchema.optional(),
});

export const developerRuntimeExecutionStepSchema = z.object({
  id: z.string().min(1),
  missionId: z.string().min(1),
  title: z.string().min(1),
  description: z.string().min(1),
  tool: developerRuntimeToolNameSchema,
  agent: z.string().min(1),
  order: z.number().int().nonnegative(),
  riskLevel: developerRuntimeRiskLevelSchema,
  approvalRequired: z.boolean(),
  expectedOutput: z.string().trim().optional(),
  verificationRule: z.string().trim().optional(),
  status: developerRuntimeStepStatusSchema,
});

export const developerRuntimeSessionSchema = z.object({
  id: z.string().min(1),
  userId: z.string().min(1),
  repoId: z.string().min(1),
  branch: z.string().trim().optional(),
  startedAt: z.string().datetime(),
  endedAt: z.string().datetime().optional(),
  goal: z.string().min(1),
  state: developerRuntimeExecutionStateSchema,
  selectedAgents: z.array(z.string().min(1)).default([]),
  missionId: z.string().min(1),
  summary: z.string().trim().optional(),
});

export const developerRuntimeMissionSchema = z.object({
  id: z.string().min(1),
  sessionId: z.string().min(1),
  intent: developerRuntimeIntentTaskSchema,
  plan: z.array(developerRuntimeExecutionStepSchema).default([]),
  riskLevel: developerRuntimeRiskLevelSchema,
  status: developerRuntimeMissionStatusSchema,
});

export const developerRuntimeSessionLogSchema = z.object({
  id: z.string().min(1),
  sessionId: z.string().min(1),
  stepId: z.string().min(1).optional(),
  timestamp: z.string().datetime(),
  agent: z.string().min(1),
  tool: z.string().min(1),
  action: z.string().min(1),
  inputSummary: z.string().min(1),
  outputSummary: z.string().trim().optional(),
  status: developerRuntimeLogStatusSchema,
  durationMs: z.number().int().nonnegative().optional(),
});

export const developerRuntimeArtifactSchema = z.object({
  id: z.string().min(1),
  sessionId: z.string().min(1),
  stepId: z.string().min(1).optional(),
  type: developerRuntimeArtifactTypeSchema,
  label: z.string().min(1),
  uri: z.string().trim().optional(),
  contentSnippet: z.string().trim().optional(),
  createdAt: z.string().datetime(),
});

export const developerRuntimeValidationResultSchema = z.object({
  id: z.string().min(1),
  sessionId: z.string().min(1),
  stepId: z.string().min(1).optional(),
  name: z.string().min(1),
  status: developerRuntimeValidationStatusSchema,
  details: z.string().trim().optional(),
  evidenceRef: z.string().trim().optional(),
});

export const developerRuntimeApprovalRequestSchema = z.object({
  id: z.string().min(1),
  sessionId: z.string().min(1),
  stepId: z.string().min(1),
  title: z.string().min(1),
  reason: z.string().min(1),
  riskLevel: developerRuntimeRiskLevelSchema,
  actionPreview: z.string().min(1),
  createdAt: z.string().datetime(),
});

export const developerRuntimeApprovalDecisionSchema = z.object({
  requestId: z.string().min(1),
  approved: z.boolean(),
  decidedAt: z.string().datetime(),
  decidedBy: z.string().min(1),
  comment: z.string().trim().optional(),
});

export const developerRuntimeApprovalRecordSchema = z.object({
  request: developerRuntimeApprovalRequestSchema,
  decision: developerRuntimeApprovalDecisionSchema.optional(),
});

export const developerRuntimeRunCommandInputSchema = z.object({
  command: z.string().min(1),
  cwd: z.string().trim().optional(),
  timeoutMs: z.number().int().positive().optional(),
  env: z.record(z.string(), z.string()).optional(),
});

export const developerRuntimeRunCommandResultSchema = z.object({
  exitCode: z.number().int(),
  stdout: z.string(),
  stderr: z.string(),
  durationMs: z.number().int().nonnegative(),
});

export const developerRuntimeProviderRouteSchema = z.object({
  provider: z.string().min(1),
  model: z.string().min(1),
  capability: developerRuntimeProviderCapabilitySchema,
});

export const developerRuntimeSessionIdParamSchema = z.object({
  sessionId: z.string().min(1),
});

export const developerRuntimeApprovalIdParamSchema = z.object({
  approvalId: z.string().min(1),
});

export const developerRuntimeListSessionsQuerySchema = z.object({
  repoId: z.string().trim().optional(),
  state: developerRuntimeExecutionStateSchema.optional(),
});

export const developerRuntimeCreateSessionInputSchema = z.object({
  repoId: z.string().min(1),
  branch: z.string().trim().optional(),
  goal: z.string().min(1),
  selectedAgents: z.array(z.string().min(1)).default([]),
});

export const developerRuntimeCreateMissionInputSchema = z.object({
  intent: developerRuntimeIntentTaskSchema.omit({ id: true }),
});

export const developerRuntimeExecuteSessionInputSchema = z.object({
  cwd: z.string().trim().optional(),
});

export const developerRuntimeApprovalResponseInputSchema = z.object({
  approved: z.boolean(),
  comment: z.string().trim().optional(),
});

export const developerRuntimeWorkerProgressInputSchema = z.object({
  log: developerRuntimeSessionLogSchema,
});

export const developerRuntimeWorkerStartInputSchema = z.object({
  workerId: z.string().min(1),
  startedAt: z.string().datetime().optional(),
});

export const developerRuntimeWorkerCompleteInputSchema = z.object({
  workerId: z.string().min(1),
  session: developerRuntimeSessionSchema,
  mission: developerRuntimeMissionSchema,
  logs: z.array(developerRuntimeSessionLogSchema).default([]),
  validations: z.array(developerRuntimeValidationResultSchema).default([]),
  artifacts: z.array(developerRuntimeArtifactSchema).default([]),
});

export const developerRuntimeWorkerFailInputSchema = z.object({
  workerId: z.string().min(1),
  error: z.string().min(1),
  session: developerRuntimeSessionSchema,
  mission: developerRuntimeMissionSchema,
  logs: z.array(developerRuntimeSessionLogSchema).default([]),
  validations: z.array(developerRuntimeValidationResultSchema).default([]),
  artifacts: z.array(developerRuntimeArtifactSchema).default([]),
});

export type DeveloperRuntimeTaskCategory = z.infer<typeof developerRuntimeTaskCategorySchema>;
export type DeveloperRuntimeRiskLevel = z.infer<typeof developerRuntimeRiskLevelSchema>;
export type DeveloperRuntimeExecutionState = z.infer<typeof developerRuntimeExecutionStateSchema>;
export type DeveloperRuntimeStepStatus = z.infer<typeof developerRuntimeStepStatusSchema>;
export type DeveloperRuntimeMissionStatus = z.infer<typeof developerRuntimeMissionStatusSchema>;
export type DeveloperRuntimeLogStatus = z.infer<typeof developerRuntimeLogStatusSchema>;
export type DeveloperRuntimeValidationStatus = z.infer<typeof developerRuntimeValidationStatusSchema>;
export type DeveloperRuntimeArtifactType = z.infer<typeof developerRuntimeArtifactTypeSchema>;
export type DeveloperRuntimeAutonomyLevel = z.infer<typeof developerRuntimeAutonomyLevelSchema>;
export type DeveloperRuntimeToolName = z.infer<typeof developerRuntimeToolNameSchema>;
export type DeveloperRuntimeProviderCapability = z.infer<typeof developerRuntimeProviderCapabilitySchema>;
export type DeveloperRuntimeWriteFileOperation = z.infer<typeof developerRuntimeWriteFileOperationSchema>;
export type DeveloperRuntimePatchFileOperation = z.infer<typeof developerRuntimePatchFileOperationSchema>;
export type DeveloperRuntimeIntentMetadata = z.infer<typeof developerRuntimeIntentMetadataSchema>;
export type DeveloperRuntimeIntentTask = z.infer<typeof developerRuntimeIntentTaskSchema>;
export type DeveloperRuntimeExecutionStep = z.infer<typeof developerRuntimeExecutionStepSchema>;
export type DeveloperRuntimeSession = z.infer<typeof developerRuntimeSessionSchema>;
export type DeveloperRuntimeMission = z.infer<typeof developerRuntimeMissionSchema>;
export type DeveloperRuntimeSessionLog = z.infer<typeof developerRuntimeSessionLogSchema>;
export type DeveloperRuntimeArtifact = z.infer<typeof developerRuntimeArtifactSchema>;
export type DeveloperRuntimeValidationResult = z.infer<typeof developerRuntimeValidationResultSchema>;
export type DeveloperRuntimeApprovalRequest = z.infer<typeof developerRuntimeApprovalRequestSchema>;
export type DeveloperRuntimeApprovalDecision = z.infer<typeof developerRuntimeApprovalDecisionSchema>;
export type DeveloperRuntimeApprovalRecord = z.infer<typeof developerRuntimeApprovalRecordSchema>;
export type DeveloperRuntimeRunCommandInput = z.infer<typeof developerRuntimeRunCommandInputSchema>;
export type DeveloperRuntimeRunCommandResult = z.infer<typeof developerRuntimeRunCommandResultSchema>;
export type DeveloperRuntimeProviderRoute = z.infer<typeof developerRuntimeProviderRouteSchema>;
export type DeveloperRuntimeSessionIdParam = z.infer<typeof developerRuntimeSessionIdParamSchema>;
export type DeveloperRuntimeApprovalIdParam = z.infer<typeof developerRuntimeApprovalIdParamSchema>;
export type DeveloperRuntimeListSessionsQuery = z.infer<typeof developerRuntimeListSessionsQuerySchema>;
export type DeveloperRuntimeCreateSessionInput = z.infer<typeof developerRuntimeCreateSessionInputSchema>;
export type DeveloperRuntimeCreateMissionInput = z.infer<typeof developerRuntimeCreateMissionInputSchema>;
export type DeveloperRuntimeExecuteSessionInput = z.infer<typeof developerRuntimeExecuteSessionInputSchema>;
export type DeveloperRuntimeApprovalResponseInput = z.infer<typeof developerRuntimeApprovalResponseInputSchema>;
export type DeveloperRuntimeWorkerProgressInput = z.infer<typeof developerRuntimeWorkerProgressInputSchema>;
export type DeveloperRuntimeWorkerStartInput = z.infer<typeof developerRuntimeWorkerStartInputSchema>;
export type DeveloperRuntimeWorkerCompleteInput = z.infer<typeof developerRuntimeWorkerCompleteInputSchema>;
export type DeveloperRuntimeWorkerFailInput = z.infer<typeof developerRuntimeWorkerFailInputSchema>;
