export type UserActor = {
  tenantId: string;
  orgId: string;
  userId: string;
  roles: string[];
};

export function canReadUser(actor: UserActor, targetUserId: string): boolean {
  return actor.roles.includes("OPS_ADMIN") || actor.userId === targetUserId;
}

export function canReadUserMemberships(actor: UserActor, targetUserId: string): boolean {
  return actor.roles.includes("OPS_ADMIN") || actor.userId === targetUserId;
}

export function canVerifyUser(actor: UserActor): boolean {
  return actor.roles.includes("OPS_ADMIN");
}

export function canUpdateUserStatus(actor: UserActor): boolean {
  return actor.roles.includes("OPS_ADMIN");
}
