import { z } from "zod";
import { runtimeServiceStatusSchema } from "./runtime-node.schema.js";

export const knowledgeDomainIdSchema = z.enum(["semse.anatomy", "semse.repo", "semse.runtime"]);

export const knowledgeDomainSummarySchema = z.object({
  id: knowledgeDomainIdSchema,
  title: z.string().trim().min(1).max(120),
  description: z.string().trim().min(1).max(400),
  rootId: z.string().trim().min(1).max(120),
  apiBasePath: z.string().trim().min(1).max(160),
  uiPath: z.string().trim().min(1).max(160),
  capabilities: z.array(z.string().trim().min(1).max(80)).min(1).max(12)
});

export const knowledgeOverviewSchema = z.object({
  domains: z.array(knowledgeDomainSummarySchema).min(1),
  runtimeStatuses: z.array(runtimeServiceStatusSchema),
  totals: z.object({
    domains: z.number().int().nonnegative(),
    services: z.number().int().nonnegative(),
    onlineServices: z.number().int().nonnegative(),
    degradedServices: z.number().int().nonnegative(),
    offlineServices: z.number().int().nonnegative()
  })
});

export const workspaceMemoryKindSchema = z.enum([
  "operator_note",
  "repo_fact",
  "runtime_fact",
  "decision",
  "run_summary",
  "task_state"
]);

export const workspaceMemoryScopeSchema = z.enum(["workspace", "repo", "run", "task"]);

export const workspaceMemoryQuerySchema = z.object({
  workspaceId: z.string().trim().min(1).max(120),
  repoId: z.string().trim().min(1).max(200).optional(),
  runId: z.string().trim().min(1).max(200).optional(),
  taskId: z.string().trim().min(1).max(200).optional(),
  kinds: z.union([workspaceMemoryKindSchema, z.array(workspaceMemoryKindSchema)]).optional(),
  tags: z.union([z.string().trim().min(1).max(80), z.array(z.string().trim().min(1).max(80))]).optional()
});

export const workspaceMemoryRecordSchema = z.object({
  id: z.string().trim().min(1),
  tenantId: z.string().trim().min(1),
  orgId: z.string().trim().min(1),
  createdBy: z.string().trim().min(1),
  workspaceId: z.string().trim().min(1),
  repoId: z.string().trim().min(1).optional(),
  runId: z.string().trim().min(1).optional(),
  taskId: z.string().trim().min(1).optional(),
  kind: workspaceMemoryKindSchema,
  scope: workspaceMemoryScopeSchema,
  title: z.string().trim().min(1).max(200),
  summary: z.string().trim().min(1).max(500),
  body: z.string().optional(),
  tags: z.array(z.string().trim().min(1).max(80)),
  sourceRef: z.string().trim().min(1).optional(),
  updatedAtIso: z.string().trim().min(1)
});

export const workspaceMemoryListSchema = z.object({
  items: z.array(workspaceMemoryRecordSchema)
});

export type KnowledgeDomainId = z.infer<typeof knowledgeDomainIdSchema>;
export type KnowledgeDomainSummary = z.infer<typeof knowledgeDomainSummarySchema>;
export type KnowledgeOverview = z.infer<typeof knowledgeOverviewSchema>;
export type WorkspaceMemoryQueryView = z.infer<typeof workspaceMemoryQuerySchema>;
export type WorkspaceMemoryRecordView = z.infer<typeof workspaceMemoryRecordSchema>;
export type WorkspaceMemoryListView = z.infer<typeof workspaceMemoryListSchema>;
