import { buildWorkspaceMemoryId, type WorkspaceMemoryRecord } from "@semse/knowledge";

function nowIso() {
  return new Date().toISOString();
}

export function buildJobWorkspaceMemoryRecord(input: {
  tenantId: string;
  orgId: string;
  userId: string;
  jobId: string;
  title: string;
  status: string;
  scope: string;
  category?: string;
  budgetType?: string;
  budgetMin?: number;
  budgetMax?: number;
  location?: string;
  urgency?: string;
  deadline?: string;
  action: "created" | "archived" | "restored";
}): WorkspaceMemoryRecord {
  const workspaceId = `job:${input.jobId}`;

  return {
    id: buildWorkspaceMemoryId({
      workspaceId,
      kind: "task_state",
      slug: `job-${input.action}`
    }),
    tenantId: input.tenantId,
    orgId: input.orgId,
    createdBy: input.userId,
    workspaceId,
    taskId: input.jobId,
    kind: "task_state",
    scope: "task",
    title: `Job ${input.action}: ${input.title}`,
    summary: `Job ${input.jobId} ${input.action} with status ${input.status}.`,
    body: [
      `Title: ${input.title}`,
      input.category ? `Category: ${input.category}` : null,
      `Status: ${input.status}`,
      `Scope: ${input.scope}`,
      input.budgetType ? `Budget type: ${input.budgetType}` : null,
      input.budgetMin !== undefined ? `Budget min: ${input.budgetMin}` : null,
      input.budgetMax !== undefined ? `Budget max: ${input.budgetMax}` : null,
      input.location ? `Location: ${input.location}` : null,
      input.urgency ? `Urgency: ${input.urgency}` : null,
      input.deadline ? `Deadline: ${input.deadline}` : null,
    ]
      .filter(Boolean)
      .join("\n"),
    tags: ["jobs", "task-state", `job-${input.action}`],
    sourceRef: input.jobId,
    updatedAtIso: nowIso()
  };
}

export function buildJobPreferredProfessionalWorkspaceMemoryRecord(input: {
  tenantId: string;
  orgId: string;
  userId: string;
  jobId: string;
  targetUserId: string;
  targetDisplayName: string;
  targetPublicSlug?: string;
}): WorkspaceMemoryRecord {
  const workspaceId = `job:${input.jobId}`;
  const body = JSON.stringify({
    userId: input.targetUserId,
    displayName: input.targetDisplayName,
    publicSlug: input.targetPublicSlug ?? null,
    selectedAt: nowIso(),
  });

  return {
    id: buildWorkspaceMemoryId({
      workspaceId,
      kind: "decision",
      slug: `preferred-professional-${input.targetUserId}`,
    }),
    tenantId: input.tenantId,
    orgId: input.orgId,
    createdBy: input.userId,
    workspaceId,
    taskId: input.jobId,
    kind: "decision",
    scope: "task",
    title: `Preferred professional selected: ${input.targetDisplayName}`,
    summary: `Job ${input.jobId} carries ${input.targetDisplayName} as the preferred professional target.`,
    body,
    tags: ["jobs", "decision", "preferred-professional", "matching-target"],
    sourceRef: input.targetUserId,
    updatedAtIso: nowIso(),
  };
}

export function buildProjectWorkspaceMemoryRecord(input: {
  tenantId: string;
  orgId: string;
  userId: string;
  projectId: string;
  jobId: string;
  previousStatus: string;
  status: string;
}): WorkspaceMemoryRecord {
  const workspaceId = `project:${input.projectId}`;

  return {
    id: buildWorkspaceMemoryId({
      workspaceId,
      kind: "decision",
      slug: `project-status-${input.status}`
    }),
    tenantId: input.tenantId,
    orgId: input.orgId,
    createdBy: input.userId,
    workspaceId,
    taskId: input.projectId,
    kind: "decision",
    scope: "task",
    title: `Project status changed to ${input.status}`,
    summary: `Project ${input.projectId} moved from ${input.previousStatus} to ${input.status}.`,
    body: [`Project: ${input.projectId}`, `Job: ${input.jobId}`, `From: ${input.previousStatus}`, `To: ${input.status}`].join("\n"),
    tags: ["projects", "decision", "status-change"],
    sourceRef: input.projectId,
    updatedAtIso: nowIso()
  };
}

export function buildMilestoneWorkspaceMemoryRecord(input: {
  tenantId: string;
  orgId: string;
  userId: string;
  milestoneId: string;
  projectId: string;
  jobId?: string;
  title: string;
  amount: number;
  status: string;
  action: "submitted" | "approved" | "rejected" | "paid";
  evidenceCount?: number;
  reason?: string;
}): WorkspaceMemoryRecord {
  const workspaceId = `project:${input.projectId}`;
  const kind = input.action === "approved" || input.action === "rejected" ? "decision" : "task_state";

  return {
    id: buildWorkspaceMemoryId({
      workspaceId,
      kind,
      slug: `milestone-${input.milestoneId}-${input.action}`
    }),
    tenantId: input.tenantId,
    orgId: input.orgId,
    createdBy: input.userId,
    workspaceId,
    taskId: input.milestoneId,
    kind,
    scope: "task",
    title: `Milestone ${input.action}: ${input.title}`,
    summary: `Milestone '${input.milestoneId}' (${input.title}) — ${input.action}. Amount: $${input.amount}.`,
    body: [
      `Milestone: ${input.milestoneId}`,
      `Title: ${input.title}`,
      `Amount: $${input.amount}`,
      `Status: ${input.status}`,
      `Project: ${input.projectId}`,
      input.jobId ? `Job: ${input.jobId}` : null,
      input.evidenceCount !== undefined ? `Evidence: ${input.evidenceCount}` : null,
      input.reason ? `Reason: ${input.reason}` : null
    ]
      .filter(Boolean)
      .join("\n"),
    tags: ["milestones", kind === "decision" ? "decision" : "task-state", `milestone-${input.action}`],
    sourceRef: input.milestoneId,
    updatedAtIso: nowIso()
  };
}

export function buildPaymentWorkspaceMemoryRecord(input: {
  tenantId: string;
  orgId: string;
  userId: string;
  projectId: string;
  jobId?: string;
  milestoneId?: string;
  escrowId?: string;
  transactionId?: string;
  amount: number;
  currency: string;
  action: "funded" | "released" | "refunded";
}): WorkspaceMemoryRecord {
  const workspaceId = `project:${input.projectId}`;
  const slug = input.action === "funded"
    ? `escrow-funded-${input.escrowId ?? Date.now()}`
    : input.action === "released"
      ? `escrow-released-${input.milestoneId ?? Date.now()}`
      : `escrow-refunded-${input.transactionId ?? input.escrowId ?? Date.now()}`;

  return {
    id: buildWorkspaceMemoryId({
      workspaceId,
      kind: "decision",
      slug
    }),
    tenantId: input.tenantId,
    orgId: input.orgId,
    createdBy: input.userId,
    workspaceId,
    taskId: input.milestoneId ?? input.escrowId,
    kind: "decision",
    scope: "task",
    title: `Escrow ${input.action}: $${input.amount} ${input.currency}`,
    summary: `Escrow ${input.action} of $${input.amount} ${input.currency} for project '${input.projectId}'.`,
    body: [
      `Project: ${input.projectId}`,
      input.jobId ? `Job: ${input.jobId}` : null,
      input.milestoneId ? `Milestone: ${input.milestoneId}` : null,
      input.escrowId ? `Escrow: ${input.escrowId}` : null,
      input.transactionId ? `Transaction: ${input.transactionId}` : null,
      `Amount: $${input.amount} ${input.currency}`
    ]
      .filter(Boolean)
      .join("\n"),
    tags: ["payments", "decision", `escrow-${input.action}`],
    sourceRef: input.transactionId ?? input.escrowId,
    updatedAtIso: nowIso()
  };
}

export function buildWorkerPayoutMethodWorkspaceMemoryRecord(input: {
  tenantId: string;
  orgId: string;
  userId: string;
  type: "bank_account" | "debit_card" | "paypal" | "zelle" | "cashapp";
  label: string;
  bankName?: string;
  last4?: string;
  email?: string;
  verified?: boolean;
}): WorkspaceMemoryRecord {
  const workspaceId = `worker:${input.userId}:payments`;
  const body = JSON.stringify({
    type: input.type,
    label: input.label,
    bankName: input.bankName,
    last4: input.last4,
    email: input.email,
    verified: input.verified ?? false
  });

  return {
    id: buildWorkspaceMemoryId({
      workspaceId,
      kind: "decision",
      slug: "worker-payout-method"
    }),
    tenantId: input.tenantId,
    orgId: input.orgId,
    createdBy: input.userId,
    workspaceId,
    taskId: input.userId,
    kind: "decision",
    scope: "workspace",
    title: `Worker payout method updated: ${input.label}`,
    summary: `Worker ${input.userId} updated payout method to ${input.label}.`,
    body,
    tags: ["payments", "worker", "payout-method"],
    sourceRef: input.userId,
    updatedAtIso: nowIso()
  };
}

export function buildDisputeWorkspaceMemoryRecord(input: {
  tenantId: string;
  orgId: string;
  userId: string;
  disputeId: string;
  projectId: string;
  jobId: string;
  status: string;
  reason: string;
  action: "opened" | "assigned" | "under_review" | "resolved";
  resolution?: string;
  assigneeUserId?: string;
}): WorkspaceMemoryRecord {
  const workspaceId = `dispute:${input.disputeId}`;

  return {
    id: buildWorkspaceMemoryId({
      workspaceId,
      kind: input.action === "resolved" ? "decision" : "task_state",
      slug: `dispute-${input.action}`
    }),
    tenantId: input.tenantId,
    orgId: input.orgId,
    createdBy: input.userId,
    workspaceId,
    taskId: input.disputeId,
    kind: input.action === "resolved" ? "decision" : "task_state",
    scope: "task",
    title: `Dispute ${input.action}: ${input.disputeId}`,
    summary: `Dispute ${input.disputeId} is ${input.status}.`,
    body: [
      `Project: ${input.projectId}`,
      `Job: ${input.jobId}`,
      `Reason: ${input.reason}`,
      input.assigneeUserId ? `Assignee: ${input.assigneeUserId}` : null,
      input.resolution ? `Resolution: ${input.resolution}` : null
    ]
      .filter(Boolean)
      .join("\n"),
    tags: ["disputes", input.action === "resolved" ? "decision" : "task-state", `dispute-${input.action}`],
    sourceRef: input.disputeId,
    updatedAtIso: nowIso()
  };
}
