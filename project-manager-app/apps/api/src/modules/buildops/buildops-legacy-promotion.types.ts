import type { BuildOpsPlanActorInput } from "./buildops-plan-approval.types.js";

export type PromoteApprovedPlanToLegacyInput = BuildOpsPlanActorInput & {
  buildOpsProjectId: string;
};

export type BuildOpsLegacyPromotionResult = {
  status: "promoted" | "already_promoted";
  buildOpsProjectId: string;
  legacyProjectId: string;
  milestonesCreated: number;
  tasksCreated: number;
  evidenceCreated: number;
  alreadyPromoted: boolean;
  promotedAt: string;
  paymentEscrowCreated: false;
};
