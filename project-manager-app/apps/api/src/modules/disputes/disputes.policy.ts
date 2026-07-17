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

export function assertDisputeResolvable(
  actor: DisputeActor,
  ownership: DisputeOwnership,
  status: string,
  resolutionType: string,
): void {
  // El cliente dueño puede cerrar por acuerdo únicamente a favor del PRO.
  // Refunds, splits y escalamiento legal requieren intervención de OPS.
  const clientSettlement = actor.orgId === ownership.clientOrgId && resolutionType === "pro_favor";
  if (!(isOpsAdmin(actor) || clientSettlement)) {
    throw new ForbiddenException("actor cannot resolve this dispute");
  }

  if (status === "RESOLVED" || status === "REJECTED") {
    throw new ConflictException("dispute is already terminal");
  }
}
