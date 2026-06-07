import type { RequestIdentity } from "@semse/shared";
import {
  createOperatorContext,
  type OperatorContext,
  type OperatorContextInput,
  type OperatorContextSource,
  type OperatorScope
} from "@semse/shared";
import type { SessionPayload } from "./session.js";

type SessionOperatorContextOptions = {
  source?: Extract<OperatorContextSource, "user_session" | "worker_runtime" | "ops_runtime">;
  scope?: OperatorScope;
  workspaceId?: string;
  repoId?: string;
  runId?: string;
  taskId?: string;
};

export function operatorContextFromSession(
  session: SessionPayload,
  options: SessionOperatorContextOptions = {}
): OperatorContext {
  return createOperatorContext({
    source: options.source ?? "user_session",
    scope: options.scope,
    operatorId: session.userId,
    tenantId: session.tenantId,
    orgId: session.orgId,
    roles: session.roles,
    workspaceId: options.workspaceId,
    repoId: options.repoId,
    runId: options.runId,
    taskId: options.taskId,
    sessionId: session.sid
  });
}

export function operatorContextFromIdentity(
  identity: RequestIdentity,
  input: Omit<OperatorContextInput, "tenantId" | "orgId" | "roles">
): OperatorContext {
  return createOperatorContext({
    ...input,
    tenantId: identity.tenantId,
    orgId: identity.orgId,
    roles: identity.roles,
    sessionId: input.sessionId ?? identity.sessionId
  });
}
