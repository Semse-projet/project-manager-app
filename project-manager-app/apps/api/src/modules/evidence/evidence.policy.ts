import { ForbiddenException } from "@nestjs/common";

export type EvidenceActor = {
  tenantId: string;
  orgId: string;
  userId: string;
  roles: string[];
};

export type EvidenceOwnership = {
  clientOrgId: string;
  assignedProOrgId: string;
};

function isOpsAdmin(actor: EvidenceActor): boolean {
  return actor.roles.includes("OPS_ADMIN");
}

export function assertEvidenceReadable(actor: EvidenceActor, ownership: EvidenceOwnership): void {
  if (
    isOpsAdmin(actor) ||
    actor.orgId === ownership.clientOrgId ||
    actor.orgId === ownership.assignedProOrgId
  ) {
    return;
  }

  throw new ForbiddenException("actor does not have access to this evidence");
}

export function assertEvidenceWritable(actor: EvidenceActor, ownership: EvidenceOwnership): void {
  if (
    isOpsAdmin(actor) ||
    actor.orgId === ownership.clientOrgId ||
    actor.orgId === ownership.assignedProOrgId
  ) {
    return;
  }

  throw new ForbiddenException("actor cannot register evidence for this resource");
}
