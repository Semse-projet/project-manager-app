import { z } from "zod";
import type { RequestIdentity } from "./index.js";

export const SEMSE_OPERATOR_CONTEXT_VERSION = "v1" as const;

export const operatorContextSourceSchema = z.enum([
  "user_session",
  "worker_runtime",
  "ops_runtime",
  "system_runtime"
]);

export const operatorScopeSchema = z.enum([
  "global",
  "workspace",
  "repo",
  "run",
  "task"
]);

export const operatorContextSchema = z.object({
  version: z.literal(SEMSE_OPERATOR_CONTEXT_VERSION),
  source: operatorContextSourceSchema,
  scope: operatorScopeSchema,
  operatorId: z.string().trim().min(1),
  tenantId: z.string().trim().min(1),
  orgId: z.string().trim().min(1),
  roles: z.array(z.string().trim().min(1)).default([]),
  workspaceId: z.string().trim().min(1).optional(),
  repoId: z.string().trim().min(1).optional(),
  runId: z.string().trim().min(1).optional(),
  taskId: z.string().trim().min(1).optional(),
  sessionId: z.string().trim().min(1).optional()
});

export type OperatorContextSource = z.infer<typeof operatorContextSourceSchema>;
export type OperatorScope = z.infer<typeof operatorScopeSchema>;
export type OperatorContext = z.infer<typeof operatorContextSchema>;

export type OperatorContextInput = Pick<RequestIdentity, "tenantId" | "orgId" | "roles"> & {
  operatorId: string;
  source: OperatorContextSource;
  scope?: OperatorScope;
  workspaceId?: string;
  repoId?: string;
  runId?: string;
  taskId?: string;
  sessionId?: string;
};

export function createOperatorContext(input: OperatorContextInput): OperatorContext {
  return operatorContextSchema.parse({
    version: SEMSE_OPERATOR_CONTEXT_VERSION,
    source: input.source,
    scope: input.scope ?? "global",
    operatorId: input.operatorId,
    tenantId: input.tenantId,
    orgId: input.orgId,
    roles: input.roles,
    workspaceId: input.workspaceId,
    repoId: input.repoId,
    runId: input.runId,
    taskId: input.taskId,
    sessionId: input.sessionId
  });
}

export function isOperatorContextScopedToWorkspace(context: OperatorContext): boolean {
  return context.scope === "workspace" || context.scope === "repo";
}
