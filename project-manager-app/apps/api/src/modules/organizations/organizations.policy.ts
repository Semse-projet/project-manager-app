import { isOpsAdmin, sameOrg } from "../../common/resource-scope.js";

export type OrgActor = {
  tenantId: string;
  orgId: string;
  userId: string;
  roles: string[];
};

export function canReadOrg(actor: OrgActor, orgId: string): boolean {
  return isOpsAdmin(actor) || sameOrg(actor.orgId, orgId);
}
