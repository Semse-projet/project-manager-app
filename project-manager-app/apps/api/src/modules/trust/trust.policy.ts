import { ForbiddenException } from "@nestjs/common";

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
    actor.roles.includes("OPS_ADMIN") ||
    actor.orgId === ownership.clientOrgId ||
    actor.orgId === ownership.assignedProOrgId ||
    actor.orgId === ownership.reservedProOrgId ||
    actor.orgId === ownership.contractedProOrgId
  );
}

export function assertTrustReadable(actor: TrustActor, ownership: TrustOwnership): void {
  if (!canReadTrust(actor, ownership)) {
    throw new ForbiddenException("actor cannot access trust for this resource");
  }
}
