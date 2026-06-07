import { ConflictException, ForbiddenException } from "@nestjs/common";

export type MilestoneActor = {
  tenantId: string;
  orgId: string;
  userId: string;
  roles: string[];
};

export type MilestoneOwnership = {
  clientOrgId: string;
  assignedProOrgId: string;
};

export type MilestoneLifecycleSnapshot = {
  milestoneId: string;
  currentStatus: "draft" | "awaiting_review" | "submitted" | "approved" | "rejected" | "paid";
  ownership: MilestoneOwnership;
  evidenceCount: number;
};

function isOpsAdmin(actor: MilestoneActor): boolean {
  return actor.roles.includes("OPS_ADMIN");
}

export function assertMilestoneReadable(actor: MilestoneActor, ownership: MilestoneOwnership): void {
  if (
    isOpsAdmin(actor) ||
    actor.orgId === ownership.clientOrgId ||
    actor.orgId === ownership.assignedProOrgId
  ) {
    return;
  }

  throw new ForbiddenException("actor does not have access to this milestone");
}

export function assertMilestoneCreatable(actor: MilestoneActor, ownership: MilestoneOwnership): void {
  if (isOpsAdmin(actor) || actor.orgId === ownership.clientOrgId) {
    return;
  }

  throw new ForbiddenException("actor cannot create milestones for this project");
}

export function assertMilestoneSubmittable(actor: MilestoneActor, snapshot: MilestoneLifecycleSnapshot): void {
  if (!(isOpsAdmin(actor) || actor.orgId === snapshot.ownership.assignedProOrgId)) {
    throw new ForbiddenException("actor cannot submit this milestone");
  }

  if (
    snapshot.currentStatus !== "draft" &&
    snapshot.currentStatus !== "rejected" &&
    snapshot.currentStatus !== "awaiting_review"
  ) {
    throw new ConflictException(`cannot submit milestone in status '${snapshot.currentStatus}'`);
  }

  if (snapshot.evidenceCount <= 0) {
    throw new ConflictException("milestone cannot be submitted without evidence");
  }
}

export function assertMilestoneApprovable(actor: MilestoneActor, snapshot: MilestoneLifecycleSnapshot): void {
  if (!(isOpsAdmin(actor) || actor.orgId === snapshot.ownership.clientOrgId)) {
    throw new ForbiddenException("actor cannot approve this milestone");
  }

  if (snapshot.currentStatus !== "submitted") {
    throw new ConflictException(`cannot approve milestone in status '${snapshot.currentStatus}'`);
  }
}

export function assertMilestoneRejectable(actor: MilestoneActor, snapshot: MilestoneLifecycleSnapshot): void {
  if (!(isOpsAdmin(actor) || actor.orgId === snapshot.ownership.clientOrgId)) {
    throw new ForbiddenException("actor cannot reject this milestone");
  }

  if (snapshot.currentStatus === "paid") {
    throw new ConflictException("cannot reject milestone in paid status");
  }

  if (snapshot.currentStatus !== "submitted" && snapshot.currentStatus !== "approved") {
    throw new ConflictException(`cannot reject milestone in status '${snapshot.currentStatus}'`);
  }
}
