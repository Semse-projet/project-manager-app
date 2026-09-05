import type {
  CapabilityOperation,
  CapabilityOperationApproval,
  DeploymentPlan,
} from "./types.js";

export type CapabilityPolicyReasonCode =
  | "MISSING_OPERATE_PERMISSION"
  | "MISSING_ROLLBACK_PERMISSION"
  | "TARGET_NOT_ALLOWED"
  | "ADAPTER_NOT_ALLOWED"
  | "PLAN_BINDING_MISMATCH"
  | "INVALID_POLICY_TIME"
  | "INSUFFICIENT_DISTINCT_HUMAN_APPROVERS";

export interface CapabilityPolicyInput {
  operation: CapabilityOperation;
  plan: DeploymentPlan;
  currentPlanDigest: string;
  approvals: readonly CapabilityOperationApproval[];
  now: string;
  requesterPermissions: readonly string[];
  targetAllowed: boolean;
  adapterAllowed: boolean;
}

export interface CapabilityPolicyDecision {
  allowed: boolean;
  approvalMode: "none" | "single" | "dual";
  requiredApprovals: number;
  validApproverIds: string[];
  reasonCodes: CapabilityPolicyReasonCode[];
}

export class PolicyDeniedError extends Error {
  readonly reasonCodes: readonly CapabilityPolicyReasonCode[];

  constructor(reasonCodes: readonly CapabilityPolicyReasonCode[]) {
    super(`capability policy denied: ${reasonCodes.join(", ")}`);
    this.name = "PolicyDeniedError";
    this.reasonCodes = reasonCodes;
  }
}

function requiredApprovals(risk: CapabilityOperation["risk"]): number {
  if (risk === "critical") return 2;
  if (risk === "medium" || risk === "high") return 1;
  return 0;
}

function isApprovalValid(
  approval: CapabilityOperationApproval,
  input: CapabilityPolicyInput,
  nowMs: number,
): approval is CapabilityOperationApproval & { decidedByActorId: string } {
  if (
    approval.status !== "APPROVED" ||
    approval.operationId !== input.operation.id ||
    approval.planDigest !== input.currentPlanDigest ||
    approval.configurationRevision !== input.plan.configurationRevision ||
    approval.runtimeTargetId !== input.plan.target.targetId ||
    approval.requestedByActorId !== input.operation.requestedBy.actorId ||
    approval.decidedByActorType !== "user" ||
    approval.decidedByActorId === null ||
    approval.decidedByActorId === input.operation.requestedBy.actorId ||
    !approval.decidedByRoles.includes("OPS_ADMIN") ||
    approval.decidedByRoles.includes("CAPABILITY_EXECUTOR") ||
    approval.approvalMode !==
      (requiredApprovals(input.operation.risk) === 2 ? "dual" : "single") ||
    approval.decidedAt === null
  ) {
    return false;
  }

  const decidedAtMs = Date.parse(approval.decidedAt);
  const expiresAtMs = Date.parse(approval.expiresAt);
  return (
    Number.isFinite(decidedAtMs) &&
    Number.isFinite(expiresAtMs) &&
    decidedAtMs <= nowMs &&
    expiresAtMs > nowMs &&
    expiresAtMs > decidedAtMs &&
    expiresAtMs - decidedAtMs <= 15 * 60 * 1000
  );
}

export function evaluateCapabilityPolicy(
  input: CapabilityPolicyInput,
): CapabilityPolicyDecision {
  const reasons: CapabilityPolicyReasonCode[] = [];
  const approvalCount = requiredApprovals(input.operation.risk);
  const approvalMode = approvalCount === 0 ? "none" : approvalCount === 1 ? "single" : "dual";

  if (!input.requesterPermissions.includes("capabilities:operate")) {
    reasons.push("MISSING_OPERATE_PERMISSION");
  }
  if (
    input.operation.intent === "ROLLBACK" &&
    !input.requesterPermissions.includes("capabilities:rollback")
  ) {
    reasons.push("MISSING_ROLLBACK_PERMISSION");
  }
  if (!input.targetAllowed) reasons.push("TARGET_NOT_ALLOWED");
  if (!input.adapterAllowed) reasons.push("ADAPTER_NOT_ALLOWED");
  if (
    input.operation.planDigest !== input.currentPlanDigest ||
    input.operation.id !== input.plan.operationId
  ) {
    reasons.push("PLAN_BINDING_MISMATCH");
  }

  const nowMs = Date.parse(input.now);
  if (!Number.isFinite(nowMs)) reasons.push("INVALID_POLICY_TIME");
  const validApproverIds = [
    ...new Set(
      input.approvals
        .filter((approval) => isApprovalValid(approval, input, nowMs))
        .map((approval) => approval.decidedByActorId),
    ),
  ].sort();
  if (validApproverIds.length < approvalCount) {
    reasons.push("INSUFFICIENT_DISTINCT_HUMAN_APPROVERS");
  }

  return {
    allowed: reasons.length === 0,
    approvalMode,
    requiredApprovals: approvalCount,
    validApproverIds,
    reasonCodes: reasons,
  };
}

export function assertPolicyAllowed(decision: CapabilityPolicyDecision): void {
  if (!decision.allowed) throw new PolicyDeniedError(decision.reasonCodes);
}
