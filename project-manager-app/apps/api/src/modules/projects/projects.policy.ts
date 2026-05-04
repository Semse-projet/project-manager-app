import { ConflictException, ForbiddenException } from "@nestjs/common";
import { type ProjectRecord } from "../../common/domain-store.js";

export type ProjectActor = {
  tenantId: string;
  orgId: string;
  userId: string;
  roles: string[];
};

export type ProjectOwnership = {
  clientOrgId: string;
  assignedProOrgId: string;
};

export type ProjectLifecycleSnapshot = {
  project: ProjectRecord;
  ownership: ProjectOwnership;
  activeDisputes: number;
  milestoneCounts: {
    total: number;
    draft: number;
    submitted: number;
    approved: number;
    rejected: number;
    paid: number;
  };
  escrow: {
    exists: boolean;
    totalDeposited: number;
    totalReleased: number;
    available: number;
  };
};

function isOpsAdmin(actor: ProjectActor): boolean {
  return actor.roles.includes("OPS_ADMIN");
}

export function canReadProject(actor: ProjectActor, ownership: ProjectOwnership): boolean {
  return isOpsAdmin(actor) || actor.orgId === ownership.clientOrgId || actor.orgId === ownership.assignedProOrgId;
}

export function canReadProjectFinancials(actor: ProjectActor, ownership: ProjectOwnership): boolean {
  return (
    isOpsAdmin(actor) ||
    actor.orgId === ownership.clientOrgId ||
    actor.orgId === ownership.assignedProOrgId
  );
}

export function canUpdateProjectStatus(
  actor: ProjectActor,
  ownership: ProjectOwnership,
  targetStatus: ProjectRecord["status"]
): boolean {
  void targetStatus;
  return isOpsAdmin(actor) || actor.orgId === ownership.clientOrgId;
}

export function assertProjectReadable(actor: ProjectActor, ownership: ProjectOwnership): void {
  if (!canReadProject(actor, ownership)) {
    throw new ForbiddenException("actor does not have access to this project");
  }
}

export function assertProjectFinancialsReadable(actor: ProjectActor, ownership: ProjectOwnership): void {
  if (!canReadProjectFinancials(actor, ownership)) {
    throw new ForbiddenException("actor does not have access to project financials");
  }
}

export function assertProjectStatusUpdatable(
  actor: ProjectActor,
  ownership: ProjectOwnership,
  targetStatus: ProjectRecord["status"]
): void {
  if (!canUpdateProjectStatus(actor, ownership, targetStatus)) {
    throw new ForbiddenException("actor cannot update project status");
  }
}

export function assertProjectLifecycleTransition(
  snapshot: ProjectLifecycleSnapshot,
  targetStatus: ProjectRecord["status"]
): void {
  const currentStatus = snapshot.project.status;
  const paidMilestones = snapshot.milestoneCounts.paid;
  const unpaidMilestones = snapshot.milestoneCounts.total - paidMilestones;
  const hasExecutionActivity =
    snapshot.milestoneCounts.submitted > 0 ||
    snapshot.milestoneCounts.approved > 0 ||
    snapshot.milestoneCounts.paid > 0;
  const hasHeldFunds = snapshot.escrow.available > 0;
  const hasReleasedFunds = snapshot.escrow.totalReleased > 0;

  if (currentStatus === targetStatus) {
    return;
  }

  if (currentStatus === "open" && targetStatus === "in_progress" && !snapshot.project.assignedProOrgId) {
    throw new ConflictException("project must be assigned before entering in_progress");
  }

  if (targetStatus === "completed") {
    if (snapshot.activeDisputes > 0) {
      throw new ConflictException("project cannot be completed while disputes remain open");
    }
    if (snapshot.milestoneCounts.total === 0) {
      throw new ConflictException("project cannot be completed without milestones");
    }
    if (unpaidMilestones > 0) {
      throw new ConflictException("project cannot be completed while milestones remain unpaid");
    }
  }

  if (targetStatus === "cancelled") {
    if (hasHeldFunds) {
      throw new ConflictException("project cannot be cancelled while escrow retains funds");
    }
    if (hasReleasedFunds || hasExecutionActivity) {
      throw new ConflictException("project cannot be cancelled after execution or releases without explicit policy");
    }
  }
}
