import { ForbiddenException } from "@nestjs/common";
import { hasScopeAccess, scopeFromOwnership } from "../../common/resource-scope.js";

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

export function assertEvidenceReadable(actor: EvidenceActor, ownership: EvidenceOwnership): void {
  if (hasScopeAccess(actor, scopeFromOwnership(actor, ownership), "read")) {
    return;
  }

  throw new ForbiddenException("actor does not have access to this evidence");
}

export function assertEvidenceWritable(actor: EvidenceActor, ownership: EvidenceOwnership): void {
  if (hasScopeAccess(actor, scopeFromOwnership(actor, ownership), "read")) {
    return;
  }

  throw new ForbiddenException("actor cannot register evidence for this resource");
}
