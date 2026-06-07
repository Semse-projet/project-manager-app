import type { BuildOpsPlanActorInput } from "./buildops-plan-approval.types.js";

export type BuildOpsPlanVersionStatus =
  | "running"
  | "active"
  | "superseded"
  | "failed";

export type RerunBuildOpsPlanInput = BuildOpsPlanActorInput & {
  buildOpsProjectId: string;
};

export type BuildOpsPlanRerunResult = {
  status: "rerun_completed";
  buildOpsProjectId: string;
  activeVersionId: string;
  activeVersionNumber: number;
  previousVersionId: string | null;
  previousVersionNumber: number | null;
  tasksCreated: number;
  tasksReused: number;
  approvalStatus: "pending";
  rerunCompletedAt: string;
};
