import type {
  BuildOpsMilestoneStatus,
  BuildOpsProjectStatus,
  BuildOpsTaskPriority,
  BuildOpsTaskStatus,
} from "./buildops-api";

type Translate = (key: string) => string;

function fallbackLabel(t: Translate, key: string, fallback: string) {
  const value = t(key);
  return value === key ? fallback : value;
}

export function buildOpsTradeLabel(t: Translate, trade: string) {
  return fallbackLabel(t, `buildops.trade.${trade}`, trade);
}

export function buildOpsProjectTypeLabel(t: Translate, projectType: string) {
  return fallbackLabel(t, `buildops.projectType.${projectType}`, projectType);
}

export function buildOpsRiskLabel(t: Translate, risk: string) {
  return fallbackLabel(t, `risk.${risk}`, risk);
}

export function buildOpsProjectStatusLabel(t: Translate, status: BuildOpsProjectStatus) {
  switch (status) {
    case "draft":
      return t("status.draft");
    case "estimating":
      return t("buildops.projectStatus.estimating");
    case "quoted":
      return t("buildops.projectStatus.quoted");
    case "approved":
      return t("status.approved");
    case "in_progress":
      return t("status.in_progress");
    case "paused":
      return t("status.paused");
    case "completed":
      return t("status.completed");
    case "dispute":
      return t("status.dispute");
    case "closed":
      return t("status.closed");
  }
}

export function buildOpsTaskStatusLabel(t: Translate, status: BuildOpsTaskStatus) {
  switch (status) {
    case "todo":
      return t("buildops.taskStatus.todo");
    case "in_progress":
      return t("status.in_progress");
    case "blocked":
      return t("buildops.status.blocked");
    case "done":
      return t("buildops.taskStatus.done");
    case "canceled":
      return t("buildops.taskStatus.canceled");
  }
}

export function buildOpsTaskPriorityLabel(t: Translate, priority: BuildOpsTaskPriority) {
  return t(`priority.${priority}`);
}

export function buildOpsMilestoneStatusLabel(t: Translate, status: BuildOpsMilestoneStatus) {
  switch (status) {
    case "draft":
      return t("status.draft");
    case "awaiting_review":
      return t("buildops.milestoneStatus.awaitingReview");
    case "submitted":
      return t("status.submitted");
    case "approved":
      return t("status.approved");
    case "rejected":
      return t("status.rejected");
    case "paid":
      return t("finance.paid");
  }
}
