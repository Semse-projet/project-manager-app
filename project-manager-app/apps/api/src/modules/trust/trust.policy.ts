import { ForbiddenException } from "@nestjs/common";
import { isOpsAdmin, sameOrg } from "../../common/resource-scope.js";

export type TrustActor = {
  tenantId: string;
  orgId: string;
  userId: string;
  roles: string[];
};

export type TrustOwnership = {
  clientOrgId: string;
  assignedProOrgId?: string | null;
  reservedProOrgId?: string | null;
  contractedProOrgId?: string | null;
};

export function canReadTrust(actor: TrustActor, ownership: TrustOwnership): boolean {
  return (
    isOpsAdmin(actor) ||
    sameOrg(actor.orgId, ownership.clientOrgId) ||
    sameOrg(actor.orgId, ownership.assignedProOrgId) ||
    sameOrg(actor.orgId, ownership.reservedProOrgId) ||
    sameOrg(actor.orgId, ownership.contractedProOrgId)
  );
}

export function assertTrustReadable(actor: TrustActor, ownership: TrustOwnership): void {
  if (!canReadTrust(actor, ownership)) {
    throw new ForbiddenException("actor cannot access trust for this resource");
  }
}
