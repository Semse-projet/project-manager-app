import { ConflictException, ForbiddenException } from "@nestjs/common";

export type DisputeActor = {
  tenantId: string;
  orgId: string;
  userId: string;
  roles: string[];
};

export type DisputeOwnership = {
  clientOrgId: string;
  assignedProOrgId: string;
};

function isOpsAdmin(actor: DisputeActor): boolean {
  return actor.roles.includes("OPS_ADMIN");
}

export function assertDisputeReadable(actor: DisputeActor, ownership: DisputeOwnership): void {
  if (
    isOpsAdmin(actor) ||
    actor.orgId === ownership.clientOrgId ||
    actor.orgId === ownership.assignedProOrgId
  ) {
    return;
  }

  throw new ForbiddenException("actor does not have access to this dispute");
}

export function assertDisputeCreatable(actor: DisputeActor, ownership: DisputeOwnership): void {
  assertDisputeReadable(actor, ownership);
}

export function assertDisputeAssignable(actor: DisputeActor): void {
  if (isOpsAdmin(actor)) {
    return;
  }

  throw new ForbiddenException("actor cannot assign disputes");
}

export function assertDisputeResolvable(actor: DisputeActor, ownership: DisputeOwnership, status: string): void {
  if (!(isOpsAdmin(actor) || actor.orgId === ownership.clientOrgId)) {
    throw new ForbiddenException("actor cannot resolve this dispute");
  }

  if (status === "RESOLVED" || status === "REJECTED") {
    throw new ConflictException("dispute is already terminal");
  }
}
