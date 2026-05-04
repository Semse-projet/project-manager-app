export type OrgActor = {
  tenantId: string;
  orgId: string;
  userId: string;
  roles: string[];
};

export function canReadOrg(actor: OrgActor, orgId: string): boolean {
  return actor.roles.includes("OPS_ADMIN") || actor.orgId === orgId;
}
