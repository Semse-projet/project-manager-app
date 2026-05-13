export type BuildOpsPlanApprovalStatus =
  | "pending"
  | "approved"
  | "changes_requested"
  | "rejected";

export type BuildOpsPlanApprovalSource = "client" | "admin_override";

export type BuildOpsPlanActorInput = {
  tenantId: string;
  orgId: string;
  userId: string;
  roles: string[];
};

export type ApproveClientPlanInput = BuildOpsPlanActorInput & {
  buildOpsProjectId: string;
  source: BuildOpsPlanApprovalSource;
  reason?: string | null;
};

export type RequestChangesInput = BuildOpsPlanActorInput & {
  buildOpsProjectId: string;
  comment: string;
};

export type RejectClientPlanInput = BuildOpsPlanActorInput & {
  buildOpsProjectId: string;
  comment: string;
};

export type UnapproveClientPlanInput = BuildOpsPlanActorInput & {
  buildOpsProjectId: string;
  reason: string;
};

export type BuildOpsPlanApprovalResult = {
  buildOpsProjectId: string;
  clientPlanApprovalStatus: BuildOpsPlanApprovalStatus;
  clientPlanApprovedAt: string | null;
  clientPlanApprovedById: string | null;
  clientPlanApprovalSource: BuildOpsPlanApprovalSource | null;
  clientPlanReviewedAt: string | null;
  clientPlanReviewComment: string | null;
};
