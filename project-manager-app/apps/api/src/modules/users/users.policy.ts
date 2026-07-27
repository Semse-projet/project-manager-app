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

/** A user may only request verification for themselves — this only queues a
 * request for OPS_ADMIN review, it never executes the verification itself
 * (that stays gated by canVerifyUser). See AUDIT_REMEDIATION_PLAN.md 2.28. */
export function canRequestVerification(actor: UserActor, targetUserId: string): boolean {
  return actor.userId === targetUserId || actor.roles.includes("OPS_ADMIN");
}

export function canUpdateUserStatus(actor: UserActor): boolean {
  return actor.roles.includes("OPS_ADMIN");
}
